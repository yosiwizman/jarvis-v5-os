"use client";

import { useCallback, useState } from "react";
import { buildServerUrl } from "@/lib/api";

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(buildServerUrl("/file-library/upload"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Upload failed: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (err) {
      throw err;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    setUploading(true);
    setUploadProgress({});

    const fileArray = Array.from(files);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of fileArray) {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

        try {
          await uploadFile(file);
          setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
          successCount++;
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          failCount++;
          setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
        }
      }

      if (successCount > 0) {
        setSuccess(
          `✅ Successfully uploaded ${successCount} file${successCount === 1 ? "" : "s"}${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`,
        );
        onUploadComplete?.();
      }

      if (failCount > 0 && successCount === 0) {
        setError(
          `❌ Failed to upload ${failCount} file${failCount === 1 ? "" : "s"}`,
        );
      }

      // Clear progress after 3 seconds
      setTimeout(() => {
        setUploadProgress({});
        if (successCount > 0 && failCount === 0) {
          setSuccess(null);
        }
      }, 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      await handleFiles(e.dataTransfer.files);
    },
    [onUploadComplete],
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await handleFiles(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [onUploadComplete],
  );

  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed transition-all
          ${
            isDragging
              ? "border-cyan-400 bg-cyan-500/10"
              : "border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10"
          }
          ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}
        `}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          disabled={uploading}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Upload files"
        />

        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          {/* Upload Icon */}
          <div className="mb-4 rounded-full bg-cyan-500/10 p-4">
            <svg
              className="h-10 w-10 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {uploading ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-white">Uploading...</p>
              <p className="text-sm text-white/60">
                Please wait while files are being uploaded
              </p>
            </div>
          ) : (
            <>
              <p className="text-lg font-semibold text-white">
                {isDragging ? "Drop files here" : "Drag & drop files here"}
              </p>
              <p className="mt-2 text-sm text-white/60">
                or <span className="text-cyan-400">click to browse</span>
              </p>
              <p className="mt-4 text-xs text-white/40">
                Supports images, 3D models (STL, OBJ, GLB), and other file types
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white/80">
            Upload Progress
          </div>
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-white/70">{filename}</span>
                <span
                  className={progress === -1 ? "text-red-400" : "text-white/50"}
                >
                  {progress === -1
                    ? "Failed"
                    : progress === 100
                      ? "Complete"
                      : "Uploading..."}
                </span>
              </div>
              {progress >= 0 && (
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full transition-all duration-300 ${
                      progress === 100 ? "bg-green-500" : "bg-cyan-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="rounded-xl border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-100">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
