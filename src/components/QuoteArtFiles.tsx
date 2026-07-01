import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Image, FileText, Trash2, Plus, Loader2, Link2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileToR2, R2UploadError } from '../lib/r2Upload';

interface QuoteFile {
  id: number;
  quote_id: number;
  tipo: string;
  arquivo_url: string;
  arquivo_nome: string | null;
  created_at: string;
}

interface QuoteArtFilesProps {
  quoteId: number;
  onToast: (msg: string) => void;
  onViewFile: (url: string, title: string) => void;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];

function getExt(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function isImage(filename: string): boolean {
  return IMAGE_EXTS.includes(getExt(filename));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QuoteArtFiles({ quoteId, onToast, onViewFile }: QuoteArtFilesProps) {
  const [files, setFiles] = useState<QuoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchFiles() {
    const { data } = await supabase
      .from('quote_files')
      .select('*')
      .eq('quote_id', quoteId)
      .eq('tipo', 'ARTE')
      .order('created_at', { ascending: false });
    setFiles((data as QuoteFile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchFiles();
  }, [quoteId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;
    e.target.value = '';

    setUploading(true);
    let errors = 0;

    for (const file of selected) {
      try {
        const { publicUrl } = await uploadFileToR2({
          folder: 'quotes',
          quoteId,
          tipo: 'ARTE',
          file,
        });

        const { error: insertError } = await supabase.from('quote_files').insert({
          quote_id: quoteId,
          tipo: 'ARTE',
          arquivo_url: publicUrl,
          arquivo_nome: file.name,
        });

        if (insertError) throw insertError;
      } catch (err) {
        console.error('Erro ao enviar arte:', err);
        if (err instanceof R2UploadError) {
          onToast(err.message);
          setUploading(false);
          return;
        }
        errors++;
      }
    }

    setUploading(false);

    if (errors === 0) {
      onToast('Artes anexadas');
    } else if (errors < selected.length) {
      onToast(`${selected.length - errors} arte(s) anexada(s), ${errors} com erro`);
    } else {
      onToast('Falha ao anexar artes');
    }

    fetchFiles();
  }

  async function handleAddLink() {
    const url = linkUrl.trim();
    if (!url) {
      onToast('Informe a URL do link');
      return;
    }

    setSavingLink(true);
    try {
      const { error } = await supabase.from('quote_files').insert({
        quote_id: quoteId,
        tipo: 'ARTE',
        arquivo_url: url,
        arquivo_nome: linkTitle.trim() || url,
      });
      if (error) throw error;
      onToast('Link adicionado');
      setLinkTitle('');
      setLinkUrl('');
      setShowLinkForm(false);
      fetchFiles();
    } catch (err) {
      console.error('Erro ao adicionar link:', err);
      onToast('Falha ao adicionar link');
    }
    setSavingLink(false);
  }

  async function handleDelete(file: QuoteFile) {
    setDeletingId(file.id);
    try {
      const { error } = await supabase.from('quote_files').delete().eq('id', file.id);
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.id !== file.id));
      onToast('Arte removida');
    } catch (err) {
      console.error('Erro ao excluir arte:', err);
      onToast('Falha ao remover arte');
    }
    setDeletingId(null);
  }

  const displayName = (file: QuoteFile, index: number) =>
    file.arquivo_nome || `Arte #${index + 1}`;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Image className="w-3.5 h-3.5" />
          Artes do cliente
        </h3>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Enviando...' : 'Adicionar arte'}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 w-40 glass-card-static rounded-glass-sm shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  inputRef.current?.click();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Enviar arquivo
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowLinkForm(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                Adicionar link
              </button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.rar,.7z,.cdr,.ai,.psd"
          onChange={handleFileChange}
        />
      </div>

      {showLinkForm && (
        <div className="glass-card-static rounded-glass-sm p-3 mb-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600">Adicionar link de arte</p>
            <button
              onClick={() => {
                setShowLinkForm(false);
                setLinkTitle('');
                setLinkUrl('');
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Título (opcional)"
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
            className="input-field w-full"
          />
          <input
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            className="input-field w-full"
          />
          <button
            onClick={handleAddLink}
            disabled={savingLink || !linkUrl.trim()}
            className="btn-primary w-full text-xs py-1.5 disabled:opacity-50"
          >
            {savingLink ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      )}

      <div className="glass-card-static rounded-glass-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-6 cursor-pointer hover:bg-gray-50/60 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
              <Image className="w-4.5 h-4.5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-400">Nenhuma arte anexada</p>
            <p className="text-xs text-primary-500 font-medium">Clique para adicionar</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100/80">
            {files.map((file, idx) => {
              const name = displayName(file, idx);
              const ext = getExt(name);
              const img = isImage(name);

              return (
                <li key={file.id} className="flex items-center gap-3 p-3 hover:bg-gray-50/40 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {img ? (
                      <img
                        src={file.arquivo_url}
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          (e.currentTarget.parentElement as HTMLElement).innerHTML =
                            '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                        }}
                      />
                    ) : (
                      <FileText className="w-4 h-4 text-primary-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate font-medium" title={name}>{name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(file.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onViewFile(file.arquivo_url, name)}
                      title="Visualizar"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={file.arquivo_url}
                      download={name}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Baixar"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={deletingId === file.id}
                      title="Excluir"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40"
                    >
                      {deletingId === file.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {files.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-100/80">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {uploading ? 'Enviando...' : 'Adicionar mais'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
