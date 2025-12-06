'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

function ViewerPageContent() {
  const searchParams = useSearchParams();
  const modelUrl = searchParams.get('modelUrl');
  const thumbUrlParam = searchParams.get('thumb');
  const titleParam = searchParams.get('title');
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const animationRef = useRef<number>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [color, setColor] = useState('#ffffff');
  const colorRef = useRef(color);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  const modelExtension = useMemo(() => {
    if (!modelUrl) return null;
    try {
      if (/^https?:/i.test(modelUrl)) {
        const parsed = new URL(modelUrl);
        const ext = parsed.pathname.split('.').pop();
        return ext ? ext.toLowerCase() : null;
      }
      const cleaned = modelUrl.split('?')[0] ?? '';
      const segments = cleaned.split('/');
      const lastSegment = segments.pop() ?? cleaned;
      const ext = lastSegment.split('.').pop();
      return ext ? ext.toLowerCase() : null;
    } catch {
      return null;
    }
  }, [modelUrl]);

  const proxiedModelUrl = useMemo(() => {
    if (!modelUrl) return null;
    
    // Check if it's a local file path (starts with /files/ or /static/)
    if (modelUrl.startsWith('/files/') || modelUrl.startsWith('/static/')) {
      // Local files don't need proxying
      return modelUrl;
    }
    
    // Check if it's an external URL (starts with http:// or https://)
    const isExternalUrl = /^https?:\/\//i.test(modelUrl);
    
    if (isExternalUrl) {
      // Check if it's from the same host (local server)
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(modelUrl);
          const isSameHost = url.host === window.location.host;
          if (isSameHost) {
            // Same host, use the pathname directly
            return url.pathname;
          }
        } catch (e) {
          // Invalid URL, fall through
        }
      }
      // External URL, use proxy
      return `/api/proxy-model?url=${encodeURIComponent(modelUrl)}`;
    }
    
    // Relative path, use as-is
    return modelUrl;
  }, [modelUrl]);

  const resolvedThumbUrl = useMemo(() => {
    if (!thumbUrlParam) return null;
    if (/^https?:/i.test(thumbUrlParam)) return thumbUrlParam;
    if (typeof window === 'undefined') return thumbUrlParam;
    return new URL(thumbUrlParam, window.location.origin).toString();
  }, [thumbUrlParam]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !proxiedModelUrl) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06080d');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      2000
    );
    camera.position.set(0, 1, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;

    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1.25);
    directional.position.set(2.5, 4, 3.5);
    scene.add(directional);

    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    sceneRef.current = scene;
    setLoading(true);
    setError(null);

    const onError = (err: any) => {
      setError(`Failed to load model: ${err?.message ?? 'Unknown error'}`);
      setLoading(false);
    };

    const setupModelInScene = (object: THREE.Object3D) => {
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const material = mesh.material;
          const materials = Array.isArray(material) ? material : [material];
          materials.forEach((mat) => {
            if (mat && 'color' in mat) {
              (mat as THREE.MeshStandardMaterial).color.set(colorRef.current);
            }
            if (mat && 'side' in mat) {
              (mat as THREE.Material).side = THREE.DoubleSide;
            }
          });
        }
      });
      scene.add(object);
      modelRef.current = object;

      const boundingBox = new THREE.Box3().setFromObject(object);
      const size = boundingBox.getSize(new THREE.Vector3());
      const center = boundingBox.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fitDistance = maxDim * 1.6;

      camera.position.copy(center.clone().add(new THREE.Vector3(fitDistance, fitDistance * 0.6, fitDistance)));
      camera.near = maxDim / 100;
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();

      controls.target.copy(center);
      controls.update();
      controls.saveState();

      setLoading(false);
    };

    if (modelExtension === 'stl') {
      const loader = new STLLoader();
      loader.load(
        proxiedModelUrl,
        (geometry) => {
          const material = new THREE.MeshStandardMaterial({
            color: colorRef.current,
            metalness: 0.1,
            roughness: 0.6,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geometry, material);
          setupModelInScene(mesh);
        },
        undefined,
        onError
      );
    } else if (modelExtension === 'obj') {
      const loader = new OBJLoader();
      loader.load(
        proxiedModelUrl,
        (object) => {
          setupModelInScene(object);
        },
        undefined,
        onError
      );
    } else if (modelExtension === 'usdz') {
      const loader = new USDZLoader();
      loader.load(
        proxiedModelUrl,
        (group) => {
          setupModelInScene(group);
        },
        undefined,
        onError
      );
    } else {
      // Default to GLTF/GLB
      const loader = new GLTFLoader();
      loader.load(
        proxiedModelUrl,
        (gltf) => {
          const object = gltf.scene || gltf.scenes?.[0];
          if (!object) {
            setError('Loaded scene is empty.');
            setLoading(false);
            return;
          }
          setupModelInScene(object);
        },
        undefined,
        onError
      );
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container && rendererRef.current && cameraRef.current) {
          const { width, height } = entry.contentRect;
          rendererRef.current.setSize(width, height);
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
        }
      }
    });
    observer.observe(container);
    resizeObserverRef.current = observer;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement.parentElement) {
          rendererRef.current.domElement.parentElement.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.clear();
        sceneRef.current = null;
      }
      modelRef.current = null;
      cameraRef.current = null;
      gridRef.current = null;
    };
  }, [proxiedModelUrl]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      controls.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (showGrid) {
      if (!gridRef.current) {
        const grid = new THREE.GridHelper(10, 20, 0x3a3f51, 0x1c1f2a);
        grid.position.y = -0.01;
        scene.add(grid);
        gridRef.current = grid;
      }
    } else if (gridRef.current) {
      scene.remove(gridRef.current);
      gridRef.current = null;
    }
  }, [showGrid]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const material = mesh.material;
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((mat) => {
          if (mat && 'color' in mat) {
            (mat as THREE.MeshStandardMaterial).color.set(color);
          }
        });
      }
    });
  }, [color]);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleDownloadStl = () => {
    const model = modelRef.current;
    if (!model) {
      setError('Model not loaded yet.');
      return;
    }
    try {
      const exporter = new STLExporter();
      const result = exporter.parse(model, { binary: true }) as unknown as ArrayBuffer;
      const blob = new Blob([result], { type: 'model/stl' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${titleParam?.replace(/\s+/g, '-') || 'meshy-model'}.stl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export STL');
    }
  };

  if (!modelUrl) {
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">3D Viewer</h1>
          <button className="btn" type="button" onClick={() => router.push('/3dmodel')}>
            Back to 3D model Creation
          </button>
        </header>
        <div className="card p-6 text-sm text-white/70">
          Provide a <code className="mx-1 rounded bg-white/10 px-2 py-1">modelUrl</code> query parameter to load a model.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">3D Viewer</h1>
          <p className="text-sm text-white/60">Inspect, recolor, and export your Meshy-generated model.</p>
        </div>
        <button className="btn" type="button" onClick={() => router.push('/3dmodel')}>
          Back to 3D model Creation
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[65vh] min-h-[420px] rounded-2xl border border-white/10 bg-black/20" ref={containerRef}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/70">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Loading model…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/80 text-center text-sm text-red-300">
              <span>{error}</span>
              <button className="btn btn-secondary" type="button" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}
          {resolvedThumbUrl && !modelRef.current && !loading && !error && (
            <img
              src={resolvedThumbUrl}
              alt="Model thumbnail"
              className="absolute inset-0 h-full w-full rounded-2xl object-contain opacity-70"
            />
          )}
        </div>

        <aside className="card space-y-5 p-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-white/80">Appearance</div>
            <label className="flex items-center justify-between gap-3 text-sm text-white/70">
              <span>Model color</span>
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-8 w-16 cursor-pointer rounded border border-white/10 bg-transparent" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-white/70">
              <span>Show grid</span>
              <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-white/70">
              <span>Auto spin</span>
              <input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />
            </label>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-white/80">Actions</div>
            <button className="btn w-full" type="button" onClick={handleResetCamera}>
              Reset camera
            </button>
            <button className="btn w-full" type="button" onClick={handleDownloadStl}>
              Download as STL
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/50">
            <p className="font-semibold text-white/70">Tips</p>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>Use your mouse or touch to orbit, pan, and zoom.</li>
              <li>Toggle auto spin to present the model hands-free.</li>
              <li>Export STL for printing or further processing.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white p-8">
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="h-10 w-10 mx-auto mb-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-white/60">Loading viewer...</p>
          </div>
        </div>
      </div>
    }>
      <ViewerPageContent />
    </Suspense>
  );
}
