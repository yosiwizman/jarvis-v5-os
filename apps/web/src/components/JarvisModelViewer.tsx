'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

interface ModelProps {
  url: string;
}

function Model({ url }: ModelProps) {
  const gltf = useLoader(GLTFLoader, url);
  const meshRef = useRef<THREE.Group>(null);

  // Auto-rotate the model
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  // Center and scale the model
  useEffect(() => {
    if (gltf.scene && meshRef.current) {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;

      gltf.scene.position.sub(center);
      meshRef.current.scale.setScalar(scale);
    }
  }, [gltf]);

  return <primitive ref={meshRef} object={gltf.scene} />;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#22d3ee" wireframe />
    </mesh>
  );
}

interface JarvisModelViewerProps {
  modelUrl: string;
  onError?: (error: Error) => void;
}

export function JarvisModelViewer({ modelUrl, onError }: JarvisModelViewerProps) {
  const handleError = (error: any) => {
    console.error('3D Model loading error:', error);
    onError?.(error);
  };

  return (
    <div className="w-full h-full">
      <Canvas
        onError={handleError}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        <pointLight position={[0, 5, 0]} intensity={0.5} color="#22d3ee" />
        
        {/* Environment for reflections */}
        <Environment preset="studio" />
        
        {/* 3D Model */}
        <Suspense fallback={<LoadingFallback />}>
          <Model url={modelUrl} />
        </Suspense>
        
        {/* Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={true}
          enableRotate={true}
          maxDistance={10}
          minDistance={2}
        />
      </Canvas>
    </div>
  );
}

