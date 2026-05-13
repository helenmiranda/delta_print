// Componente de anexos — thumbnails 64×64px para imagens, lightbox ao clicar, ícone para outros tipos
import { useState, useRef, useCallback, DragEvent } from 'react';
import { Paperclip, FileText, File, Download, Trash2, Upload, AlertCircle, X, ZoomIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useDesignAttachments, formatFileSize, isImage } from '../../hooks/useDesignAttachments';
import type { DesignAttachment } from '../../types/design.types';

interface CardAttachmentsProps {
  cardId: string;
  userEmail: string;
  userName: string;
}

// Lightbox simples para visualizar imagem em tamanho completo
function ImageLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={url}
        alt={name}
        className="rounded-xl shadow-2xl object-contain"
        style={{ maxWidth: '90vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Ícone por tipo MIME para arquivos não-imagem
function FileTypeIcon({ fileType }: { fileType: string | null }) {
  if (fileType === 'application/pdf' || fileType?.includes('text')) {
    return <FileText className="w-5 h-5 text-red-400" />;
  }
  return <File className="w-5 h-5 text-gray-400" />;
}

// Item individual de anexo
function AttachmentItem({
  attachment,
  onDelete,
  onImageClick,
}: {
  attachment: DesignAttachment;
  onDelete: () => void;
  onImageClick: (url: string, name: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isImg = isImage(attachment.file_type);
  const hasRealUrl = !attachment.file_url.startsWith('#');

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      {/* Thumbnail 64×64 para imagens ou ícone para outros tipos */}
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100"
        style={{ width: '64px', height: '64px', background: '#f8fafc' }}
      >
        {isImg && hasRealUrl ? (
          <div
            className="relative w-full h-full cursor-pointer"
            onClick={() => onImageClick(attachment.file_url, attachment.file_name)}
          >
            <img
              src={attachment.thumbnail_url ?? attachment.file_url}
              alt={attachment.file_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-all flex items-center justify-center">
              <ZoomIn className="w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : (
          <FileTypeIcon fileType={attachment.file_type} />
        )}
      </div>

      {/* Informações do arquivo */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate leading-none mb-1">
          {attachment.file_name}
        </p>
        <p className="text-xs text-gray-400 leading-none">
          {formatFileSize(attachment.file_size)}
          {attachment.uploaded_by_name ? ` · ${attachment.uploaded_by_name}` : ''}
          {' · '}
          {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>

      {/* Ações ao hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {hasRealUrl && (
          <a
            href={attachment.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
            title="Baixar arquivo"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded text-xs text-white bg-red-500 hover:bg-red-600 transition-colors"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Remover anexo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Atualiza cover_image_url do card quando a primeira imagem for anexada
async function updateCoverIfNeeded(cardId: string, fileUrl: string, fileType: string | null) {
  if (!isImage(fileType)) return;

  const { data } = await supabase
    .from('design_cards')
    .select('cover_image_url')
    .eq('id', cardId)
    .maybeSingle();

  if (!data?.cover_image_url) {
    await supabase
      .from('design_cards')
      .update({ cover_image_url: fileUrl, updated_at: new Date().toISOString() })
      .eq('id', cardId);
  }
}

export default function CardAttachments({ cardId, userEmail, userName }: CardAttachmentsProps) {
  const { attachments, loading, uploading, uploadProgress, uploadFile, deleteAttachment } =
    useDesignAttachments(cardId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState('');

  const r2Configured = !!(import.meta.env.VITE_R2_PUBLIC_URL && import.meta.env.VITE_R2_AUTH_KEY);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        await uploadFile(file, cardId, userEmail, userName);
        // Após upload, atualizar capa se for imagem e o card ainda não tiver capa
        const r2Url = import.meta.env.VITE_R2_PUBLIC_URL;
        if (r2Url && isImage(file.type || null)) {
          // Buscar o anexo recém-inserido para obter a URL real
          const { data: latest } = await supabase
            .from('design_attachments')
            .select('file_url, file_type')
            .eq('card_id', cardId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latest?.file_url) {
            await updateCoverIfNeeded(cardId, latest.file_url, latest.file_type);
          }
        }
      }
    },
    [uploadFile, cardId, userEmail, userName]
  );

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(true);
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) { handleFiles(files); e.target.value = ''; }
  }

  return (
    <div>
      {/* Lightbox de imagem em tamanho completo */}
      {lightboxUrl && (
        <ImageLightbox
          url={lightboxUrl}
          name={lightboxName}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Anexos</span>
          {attachments.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ background: '#3D4465' }}
            >
              {attachments.length}
            </span>
          )}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 border border-gray-200"
        >
          <Upload className="w-3.5 h-3.5" />
          Anexar arquivo
        </button>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleInputChange} />
      </div>

      {/* Aviso quando R2 não está configurado */}
      {!r2Configured && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg mb-3 text-xs text-amber-700"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Configure o Cloudflare R2 nas variáveis de ambiente (VITE_R2_PUBLIC_URL e VITE_R2_AUTH_KEY) para habilitar uploads.
          </span>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className="rounded-lg mb-3 flex items-center justify-center gap-2 cursor-pointer transition-all"
        style={{
          border: `2px dashed ${isDragOver ? '#3D4465' : '#cbd5e1'}`,
          background: isDragOver ? '#f0f4ff' : '#f8fafc',
          padding: '12px',
          minHeight: '56px',
        }}
      >
        {uploading ? (
          <div className="w-full px-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">Enviando arquivo...</span>
              <span className="text-xs text-gray-500 font-medium">{uploadProgress}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
              <div
                className="h-full transition-all duration-200"
                style={{ width: `${uploadProgress}%`, background: '#3D4465', borderRadius: '999px' }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">
              {isDragOver ? 'Solte para anexar' : 'Arraste arquivos ou clique para selecionar'}
            </span>
          </>
        )}
      </div>

      {/* Lista de anexos */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5 pt-1">
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">Nenhum arquivo anexado</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {attachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              onDelete={() => deleteAttachment(att)}
              onImageClick={(url, name) => { setLightboxUrl(url); setLightboxName(name); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
