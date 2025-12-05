'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildServerUrl } from '@/lib/api';
import { FileUpload } from '@/components/FileUpload';

type FileCategory = 'image' | 'stl' | 'model' | 'other';

type StoredFile = {
  name: string;
  url: string;
  size: number;
  modifiedAt: number;
  extension: string;
  category: FileCategory;
};

type FileListResponse = {
  files: StoredFile[];
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function StlPreview() {
  return (
    <div className="relative h-20 w-20">
      <div className="absolute inset-0 rounded-2xl bg-sky-500/20 blur-md" />
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="h-14 w-14 rounded-[18px] border border-sky-400/70 bg-sky-400/15 animate-[spin_6s_linear_infinite]" />
        <div className="absolute h-6 w-6 rounded-full border border-sky-300/70 bg-sky-300/40 animate-[spin_3s_linear_infinite]" />
      </div>
    </div>
  );
}

function FilePreview({ file }: { file: StoredFile }) {
  const directUrl = useMemo(() => buildServerUrl(file.url), [file.url]);

  if (file.category === 'image') {
    return (
      <a
        href={directUrl}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-white/10"
      >
        <img
          src={directUrl}
          alt={file.name}
          className="h-20 w-20 object-cover transition-transform hover:scale-105"
        />
      </a>
    );
  }

  if (file.category === 'stl') {
    return <StlPreview />;
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs text-white/60">
      {file.extension.toUpperCase()}
    </div>
  );
}

export default function FilesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildServerUrl('/file-library'));
      if (!response.ok) {
        throw new Error(`Failed to load files (${response.status})`);
      }
      const payload = (await response.json()) as FileListResponse;
      setFiles(Array.isArray(payload.files) ? payload.files : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = useCallback(
    async (file: StoredFile) => {
      const confirmed = window.confirm(`Delete ${file.name}? This cannot be undone.`);
      if (!confirmed) return;
      setBusyFile(file.name);
      try {
        const response = await fetch(buildServerUrl(`/file-library/${encodeURIComponent(file.name)}`), {
          method: 'DELETE'
        });
        if (!response.ok) {
          throw new Error(`Delete failed (${response.status})`);
        }
        await fetchFiles();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Failed to delete file');
      } finally {
        setBusyFile(null);
      }
    },
    [fetchFiles]
  );

  const handleOpenViewer = useCallback(
    (file: StoredFile) => {
      // Use the relative URL directly - the viewer will handle it properly
      const params = new URLSearchParams();
      params.set('modelUrl', file.url);
      params.set('title', file.name);
      router.push(`/3dViewer?${params.toString()}`);
    },
    [router]
  );

  const handleCreateModel = useCallback(
    (file: StoredFile) => {
      const absoluteUrl = buildServerUrl(file.url);
      const params = new URLSearchParams();
      params.set('imageUrl', absoluteUrl);
      params.set('imageName', file.name);
      router.push(`/3dmodel?${params.toString()}`);
    },
    [router]
  );

  const handlePrinter = useCallback((file: StoredFile) => {
    window.alert(`Sending ${file.name} to the 3D printer is coming soon.`);
  }, []);

  const handleLaser = useCallback((file: StoredFile) => {
    window.alert(`Laser cutter workflow for ${file.name} is coming soon.`);
  }, []);

  const directLinkLabel = useMemo(() => {
    const example = buildServerUrl('/files');
    return example ? example.replace(/\/$/, '') : '';
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Shared Files</h1>
        <p className="text-sm text-white/60">
          Central library for every asset Jarvis creates. Direct downloads are available at
          <span className="ml-1 font-mono text-white/80">
            {directLinkLabel || 'https://your-server-address/files/*'}
          </span>
          .
        </p>
      </header>

      {/* File Upload Section */}
      <section className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Upload Files</h2>
        <FileUpload onUploadComplete={fetchFiles} />
      </section>

      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-white/70">
            {loading
              ? 'Loading files…'
              : files.length === 0
              ? 'No files yet. Generate a model or image to populate the library.'
              : `${files.length} file${files.length === 1 ? '' : 's'} ready to share.`}
          </div>
          <button className="btn" type="button" onClick={fetchFiles} disabled={loading}>
            Refresh
          </button>
        </div>
        {error && <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {files.map((file) => {
          const directUrl = buildServerUrl(file.url);
          const isBusy = busyFile === file.name;
          return (
            <article key={file.name} className="card flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-white break-all">{file.name}</div>
                  <div className="text-xs text-white/50">
                    {file.extension.toUpperCase()} · {formatBytes(file.size)} · Updated {formatDate(file.modifiedAt)}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-white/40">{file.category}</div>
                  <a
                    href={directUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs text-sky-300 hover:text-sky-200"
                  >
                    Open raw file ↗
                  </a>
                </div>
                <FilePreview file={file} />
              </div>

              <div className="flex flex-wrap gap-2">
                {file.category === 'stl' && (
                  <>
                    <button
                      type="button"
                      className="btn flex-1"
                      onClick={() => handleOpenViewer(file)}
                      disabled={isBusy}
                    >
                      Open in 3D viewer
                    </button>
                    <button type="button" className="btn flex-1" onClick={() => handlePrinter(file)} disabled={isBusy}>
                      Send to 3D printer
                    </button>
                  </>
                )}
                {file.category === 'image' && (
                  <>
                    <button
                      type="button"
                      className="btn flex-1"
                      onClick={() => handleCreateModel(file)}
                      disabled={isBusy}
                    >
                      Create 3D model
                    </button>
                    <button type="button" className="btn flex-1" onClick={() => handleLaser(file)} disabled={isBusy}>
                      Send to laser cutter
                    </button>
                  </>
                )}
                {file.category !== 'stl' && file.category !== 'image' && (
                  <button type="button" className="btn flex-1" onClick={() => handleOpenViewer(file)} disabled={isBusy}>
                    View details
                  </button>
                )}
                <button
                  type="button"
                  className="btn flex-1 border-red-500/70 text-red-100 hover:bg-red-500/20"
                  onClick={() => handleDelete(file)}
                  disabled={isBusy}
                >
                  {isBusy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
