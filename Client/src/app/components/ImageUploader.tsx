import React, { useRef, useState, DragEvent, useEffect } from "react";
import { uploadService } from "../../services/uploadService";

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  onUploadingChange?: (isUploading: boolean) => void;
}

type UploadItem = {
  id: string;
  preview: string;
  url?: string;
  status: "uploading" | "done" | "error";
  progress: number;
  controller?: AbortController;
  name?: string;
};

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function resizeFile(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      if (ratio >= 1) {
        URL.revokeObjectURL(img.src);
        resolve(file);
        return;
      }
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            URL.revokeObjectURL(img.src);
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          const newFile = new File([blob], file.name, { type: blob.type });
          URL.revokeObjectURL(img.src);
          resolve(newFile);
        },
        file.type,
        quality
      );
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(img.src);
      reject(e);
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function ImageUploader({ images, onChange, max = 6, onUploadingChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const imagesRef = useRef<string[]>(images);

  useEffect(() => { imagesRef.current = images; }, [images]);

  useEffect(() => {
    const isUploading = uploads.some((u) => u.status === "uploading");
    onUploadingChange?.(isUploading);
  }, [uploads, onUploadingChange]);

  useEffect(() => {
    return () => {
      uploads.forEach((u) => {
        if (u.preview && u.preview.startsWith("blob:")) URL.revokeObjectURL(u.preview);
      });
    };
  }, [uploads]);

  // Prevent accidental navigation when files are dropped outside the uploader
  // and avoid letting drag/drop events bubble to parent components (which
  // can close modals or trigger unwanted behavior). Keep listeners while
  // component is mounted.
  useEffect(() => {
    const prevent = (e: Event) => {
      try { e.preventDefault(); } catch (err) {}
      try { (e as any).stopPropagation && (e as any).stopPropagation(); } catch (err) {}
    };
    window.addEventListener('dragover', prevent as any);
    window.addEventListener('drop', prevent as any);
    return () => {
      window.removeEventListener('dragover', prevent as any);
      window.removeEventListener('drop', prevent as any);
    };
  }, []);

  const handleOpen = () => inputRef.current?.click();

  const addUploadItem = (item: UploadItem) => setUploads((prev) => [...prev, item]);
  const updateUpload = (id: string, patch: Partial<UploadItem>) => setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const removeUploadItem = (id: string) => setUploads((prev) => {
    const toRemove = prev.find((u) => u.id === id);
    if (toRemove && toRemove.preview && toRemove.preview.startsWith("blob:")) URL.revokeObjectURL(toRemove.preview);
    return prev.filter((u) => u.id !== id);
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const occupied = images.length + uploads.filter((u) => u.status !== "error").length;
    const availableSlots = Math.max(0, max - occupied);
    const toUpload = Array.from(files).slice(0, availableSlots);
    if (toUpload.length === 0) return;

    for (const file of toUpload) {
      const id = genId();
      const preview = URL.createObjectURL(file);
      const controller = new AbortController();
      addUploadItem({ id, preview, status: "uploading", progress: 0, controller, name: file.name });

      try {
        const resized = await resizeFile(file, 1600, 1600, 0.8);
        const res = await uploadService.uploadImage(resized, {
          onProgress: (p) => updateUpload(id, { progress: p }),
          signal: controller.signal,
        });
        const url = res?.data?.url;
        if (url) {
          onChange([...imagesRef.current, url]);
          updateUpload(id, { url, status: "done", progress: 100, preview: url });
          setTimeout(() => removeUploadItem(id), 3000);
        } else {
          updateUpload(id, { status: "error" });
        }
      } catch (err: any) {
        if (err?.name === "CanceledError" || err?.message === "canceled") {
          // aborted by user - nothing
        } else {
          console.error("upload error", err);
        }
        updateUpload(id, { status: "error" });
      }
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (e.target) e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

  const handleRemove = (srcOrId: string) => {
    if (images.includes(srcOrId)) {
      onChange(images.filter((i) => i !== srcOrId));
      return;
    }
    const item = uploads.find((u) => u.id === srcOrId);
    if (item) {
      item.controller?.abort();
      removeUploadItem(srcOrId);
    }
  };

  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
        onMouseDown={(e) => { e.stopPropagation(); }}
        className={
          "w-full rounded-lg border border-dashed p-6 text-center cursor-pointer transition-colors " +
          (dragActive ? "border-primary bg-primary/5" : "border-border bg-transparent")
        }
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') handleOpen(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onInputChange}
          className="hidden"
        />
        <div className="flex items-center justify-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12v9M12 3v6" />
          </svg>
          <div className="text-left">
            <div className="font-medium">Click or drag images to upload</div>
            <div className="text-xs text-muted-foreground">Supports multiple images. Max {max} images.</div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto">
        {images.length === 0 && uploads.length === 0 && (
          <div className="text-sm text-muted-foreground">No images uploaded yet.</div>
        )}

        {images.map((src, i) => (
          <div key={src} className="relative w-28 h-28 flex-shrink-0">
            <img src={src} alt={`img-${i}`} className="w-28 h-28 object-cover rounded-lg border" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(src); }}
              className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow border"
              aria-label={`Remove image ${i + 1}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.28 5.22a.75.75 0 011.06 0L10 7.94l2.66-2.72a.75.75 0 011.06 1.06L11.06 9l2.72 2.66a.75.75 0 11-1.06 1.06L10 10.06l-2.66 2.72a.75.75 0 11-1.06-1.06L8.94 9 6.22 6.34a.75.75 0 010-1.12z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}

        {uploads.map((u) => (
          <div key={u.id} className="relative w-28 h-28 flex-shrink-0">
            <img src={u.preview} alt={u.name || 'upload'} className="w-28 h-28 object-cover rounded-lg border opacity-90" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(u.id); }}
              className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow border"
              aria-label={`Remove upload ${u.name}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.28 5.22a.75.75 0 011.06 0L10 7.94l2.66-2.72a.75.75 0 011.06 1.06L11.06 9l2.72 2.66a.75.75 0 11-1.06 1.06L10 10.06l-2.66 2.72a.75.75 0 11-1.06-1.06L8.94 9 6.22 6.34a.75.75 0 010-1.12z" clipRule="evenodd" />
              </svg>
            </button>

            {u.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                    <svg className="w-12 h-12" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" stroke="rgba(255,255,255,0.12)" strokeWidth="3" fill="none" />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        stroke="#10b981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={String(2 * Math.PI * 16)}
                        strokeDashoffset={String((1 - u.progress / 100) * 2 * Math.PI * 16)}
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                    <div className="absolute text-xs font-medium text-white">{u.progress}%</div>
                  </div>
                </div>
              </div>
            )}

            {u.status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 font-medium">Failed</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
