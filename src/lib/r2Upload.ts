import { validateUploadFile } from './uploadValidation';

export class R2UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'R2UploadError';
  }
}

export function validateFile(file: File): void {
  const result = validateUploadFile(file);
  if (!result.ok) {
    throw new R2UploadError(result.errorMessage!);
  }
}

interface UploadParams {
  folder: string;
  quoteId?: string | number | null;
  tipo: string;
  file: File;
}

interface UploadResult {
  publicUrl: string;
  key: string;
}

export async function uploadFileToR2({
  folder,
  quoteId,
  file,
}: UploadParams): Promise<UploadResult> {
  validateFile(file);

  const baseUrl = import.meta.env.VITE_R2_PUBLIC_URL as string;
  const authKey = import.meta.env.VITE_R2_AUTH_KEY as string;

  if (!baseUrl) {
    throw new R2UploadError('VITE_R2_PUBLIC_URL não está configurado');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${quoteId ?? 'sem-id'}/${Date.now()}_${safeName}`;
  const url = `${baseUrl}/${path}`;
  const contentType = file.type?.trim() ? file.type : 'application/octet-stream';

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'X-Custom-Auth-Key': authKey,
    },
    body: file,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText);
    console.error('[R2 upload] status:', response.status, 'body:', body);
    throw new R2UploadError(`Falha ao enviar arquivo (${response.status}): ${body}`);
  }

  return { publicUrl: url, key: path };
}
