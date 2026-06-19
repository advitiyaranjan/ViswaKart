import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ImagePlus, Loader2, RotateCcw, Star, X } from "lucide-react";
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
  file: File;
  status: "uploading" | "error";
  progress: number;
  error?: string;
  controller?: AbortController;
};

const SERVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const SERVER_MAX_BYTES = 5 * 1024 * 1024; // matches the upload route's limit
const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // phone photos are resized before upload
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Downscales large photos (and re-encodes formats the server rejects, e.g. HEIC where the browser can decode it). */
async function resizeFile(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  const supported = SERVER_IMAGE_TYPES.includes(file.type);
  // GIFs would lose their animation on a canvas, so they are uploaded as-is.
  if (file.type === "image/gif") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This file couldn't be read as an image."));
      image.src = url;
    });
    const ratio = Math.min(1, maxSide / img.width, maxSide / img.height);
    if (ratio === 1 && supported && file.size <= SERVER_MAX_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = supported && file.type !== "image/png" ? file.type : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + (type === "image/jpeg" ? ".jpg" : `.${type.split("/")[1]}`), { type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function precheck(file: File) {
  if (!file.type.startsWith("image/")) return `${file.name} isn't an image.`;
  if (file.size > MAX_SOURCE_BYTES) return `${file.name} is larger than 25 MB.`;
  return "";
}

export default function ImageUploader({ images, onChange, max = 6, onUploadingChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState("");
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    onUploadingChange?.(uploads.some((item) => item.status === "uploading"));
  }, [uploads, onUploadingChange]);

  // Abort in-flight uploads and release previews when the form unmounts.
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;
  useEffect(
    () => () =>
      uploadsRef.current.forEach((item) => {
        item.controller?.abort();
        URL.revokeObjectURL(item.preview);
      }),
    [],
  );

  // A photo dropped just outside the drop zone would otherwise make the browser open it and lose the form.
  useEffect(() => {
    const prevent = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const update = (id: string, patch: Partial<UploadItem>) => setUploads((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const discard = (id: string) =>
    setUploads((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item) {
        item.controller?.abort();
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((entry) => entry.id !== id);
    });

  async function upload(item: UploadItem) {
    const controller = new AbortController();
    update(item.id, { status: "uploading", progress: 0, error: undefined, controller });
    try {
      const file = await resizeFile(item.file);
      if (!SERVER_IMAGE_TYPES.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP or GIF image.");
      if (file.size > SERVER_MAX_BYTES) throw new Error("This image is still larger than 5 MB after compressing.");
      const res = await uploadService.uploadImage(file, { onProgress: (progress) => update(item.id, { progress }), signal: controller.signal });
      const url = res?.data?.url;
      if (!url) throw new Error("The upload didn't return an image address.");
      onChange([...imagesRef.current, url]);
      discard(item.id);
    } catch (err: any) {
      if (err?.name === "CanceledError" || controller.signal.aborted) return;
      update(item.id, { status: "error", error: err?.response?.data?.message || err?.message || "Upload failed." });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setNotice("");
    const free = Math.max(0, max - images.length - uploads.length);
    const chosen = Array.from(files);
    if (chosen.length > free) setNotice(free ? `Only ${free} more photo${free === 1 ? "" : "s"} can be added.` : `You can add up to ${max} photos.`);
    const rejected: string[] = [];
    for (const file of chosen.slice(0, free)) {
      const problem = precheck(file);
      if (problem) {
        rejected.push(problem);
        continue;
      }
      const item: UploadItem = { id: genId(), preview: URL.createObjectURL(file), file, status: "uploading", progress: 0 };
      setUploads((prev) => [...prev, item]);
      void upload(item);
    }
    if (rejected.length) setNotice(rejected.join(" "));
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };
  const makeCover = (src: string) => onChange([src, ...images.filter((image) => image !== src)]);
  const full = images.length + uploads.length >= max;

  return (
    <div>
      <div
        role="button"
        tabIndex={full ? -1 : 0}
        aria-disabled={full}
        aria-label={`Add photos, ${images.length} of ${max} added`}
        onClick={() => !full && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!full && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"} ${full ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple onChange={onInputChange} className="hidden" />
        <ImagePlus className="h-6 w-6 shrink-0 text-primary" />
        <div className="text-left">
          <div className="text-sm font-medium">{full ? `${max} photos added` : "Click or drag photos here"}</div>
          <div className="text-xs text-muted-foreground">
            {images.length}/{max} · large photos are resized automatically
          </div>
        </div>
      </div>

      {notice && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {notice}
        </p>
      )}

      {(images.length > 0 || uploads.length > 0) && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {images.map((src, index) => (
            <li key={src} className="group relative aspect-square">
              <img src={src} alt={`Photo ${index + 1}`} className="h-full w-full rounded-lg border border-border bg-muted object-cover" />
              {index === 0 ? (
                <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(src)}
                  aria-label={`Use photo ${index + 1} as cover`}
                  className="absolute bottom-1 left-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm hover:text-primary"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(images.filter((image) => image !== src))}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-red-600 shadow-sm hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
          {uploads.map((item) => (
            <li key={item.id} className="relative aspect-square">
              <img src={item.preview} alt="" className="h-full w-full rounded-lg border border-border object-cover opacity-60" />
              {item.status === "uploading" ? (
                <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-black/35 text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs font-semibold">{item.progress}%</span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-red-50/95 p-1 text-center">
                  <span className="line-clamp-3 text-[10px] font-medium leading-tight text-red-700" title={item.error}>
                    {item.error}
                  </span>
                  <button type="button" onClick={() => void upload(item)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline">
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => discard(item.id)}
                aria-label={item.status === "uploading" ? "Cancel upload" : "Dismiss failed upload"}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-slate-600 shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
