export const MAX_UPLOAD_BYTES = 350 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'webp',
  'zip', 'rar', '7z', 'cdr', 'ai', 'psd',
] as const;

export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.zip,.rar,.7z,.cdr,.ai,.psd';

export function getFileExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isAllowedExtension(ext: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export interface ValidationResult {
  ok: boolean;
  errorMessage?: string;
}

export function validateUploadFile(file: File): ValidationResult {
  const ext = getFileExt(file.name);

  if (!isAllowedExtension(ext)) {
    return {
      ok: false,
      errorMessage: `Tipo de arquivo não permitido: .${ext.toUpperCase() || '???'}`,
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      errorMessage: 'Arquivo muito grande. Máximo permitido: 350MB.',
    };
  }

  return { ok: true };
}
