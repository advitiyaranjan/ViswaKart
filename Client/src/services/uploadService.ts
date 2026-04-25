import api from './api';

type UploadOptions = {
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
};

export const uploadService = {
  uploadImage: (file: File, options?: UploadOptions) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e: ProgressEvent) => {
        if (!e || !e.total) return;
        const percent = Math.round((e.loaded * 100) / e.total);
        options?.onProgress?.(percent);
      },
      signal: options?.signal,
    });
  },
};
