import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { validateFile, R2UploadError } from '../lib/r2Upload';
import type { DesignAttachment } from '../types/design.types';

interface UseDesignAttachmentsResult {
  attachments: DesignAttachment[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  uploadFile: (
    file: File,
    cardId: string,
    uploaderEmail: string,
    uploaderName: string
  ) => Promise<void>;
  deleteAttachment: (attachment: DesignAttachment) => Promise<void>;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImage(fileType: string | null): boolean {
  return !!fileType && fileType.startsWith('image/');
}

export function useDesignAttachments(cardId: string): UseDesignAttachmentsResult {
  const [attachments, setAttachments] = useState<DesignAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchAttachments = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('design_attachments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useDesignAttachments] fetchAttachments error:', error);
    } else {
      setAttachments(data ?? []);
    }
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const uploadFile = useCallback(
    async (
      file: File,
      cardId: string,
      uploaderEmail: string,
      uploaderName: string
    ) => {
      const r2BaseUrl = import.meta.env.VITE_R2_PUBLIC_URL as string;

      if (!r2BaseUrl) {
        console.warn('[useDesignAttachments] VITE_R2_PUBLIC_URL não configurado');
        return;
      }

      try {
        validateFile(file);
      } catch (err) {
        if (err instanceof R2UploadError) {
          alert(err.message);
        }
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const authKey = import.meta.env.VITE_R2_AUTH_KEY as string;
        const path = `design-files/${cardId}/${Date.now()}_${safeFileName}`;
        const uploadUrl = `${r2BaseUrl}/${path}`;
        const publicUrl = uploadUrl;
        const contentType = file.type?.trim() ? file.type : 'application/octet-stream';

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload falhou: ${xhr.status}`));
          };

          xhr.onerror = () => reject(new Error('Erro de rede durante upload'));

          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', contentType);
          if (authKey) xhr.setRequestHeader('X-Custom-Auth-Key', authKey);
          xhr.send(file);
        });

        setUploadProgress(100);

        const thumbUrl = isImage(file.type) ? publicUrl : null;

        const { data: inserted, error: insertError } = await supabase
          .from('design_attachments')
          .insert({
            card_id: cardId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type || null,
            file_size: file.size,
            thumbnail_url: thumbUrl,
            uploaded_by: uploaderEmail,
            uploaded_by_name: uploaderName,
          })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error('[useDesignAttachments] insert error:', insertError);
        } else if (inserted) {
          setAttachments((prev) => [inserted, ...prev]);

          await supabase.from('design_activity_log').insert({
            card_id: cardId,
            actor_email: uploaderEmail,
            actor_name: uploaderName,
            action: 'attached',
            details: { file_name: file.name, file_id: inserted.id },
          });
        }
      } catch (err) {
        console.error('[useDesignAttachments] upload error:', err);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [fetchAttachments]
  );

  const deleteAttachment = useCallback(async (attachment: DesignAttachment) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));

    const { error } = await supabase
      .from('design_attachments')
      .delete()
      .eq('id', attachment.id);

    if (error) {
      console.error('[useDesignAttachments] deleteAttachment error:', error);
      fetchAttachments();
    }
  }, [fetchAttachments]);

  return {
    attachments,
    loading,
    uploading,
    uploadProgress,
    uploadFile,
    deleteAttachment,
  };
}
