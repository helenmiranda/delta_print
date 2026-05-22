import { useRef, useState } from 'react';
import { X, Loader2, Paperclip, File as FileIcon, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useChatwootUser } from '../contexts/ChatwootUserContext';
import { useUser } from '../contexts/UserContext';
import { uploadFileToR2, validateFile, R2UploadError } from '../lib/r2Upload';

const CATEGORIAS = [
  { value: 'bug', label: 'Bug / Erro' },
  { value: 'melhoria', label: 'Melhoria' },
  { value: 'duvida', label: 'Dúvida' },
  { value: 'outro', label: 'Outro' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewTicketModal({ onClose, onCreated }: Props) {
  const chatwootUser = useChatwootUser();
  const { user: appUser } = useUser();
  const userName = chatwootUser?.name ?? appUser.name;
  const userEmail = chatwootUser?.email ?? appUser.email;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    categoria: 'bug',
    prioridade: 'media',
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);
    if (!file) { setSelectedFile(null); return; }
    try {
      validateFile(file);
      setSelectedFile(file);
    } catch (err) {
      setFileError(err instanceof R2UploadError ? err.message : 'Arquivo inválido');
      setSelectedFile(null);
    }
    e.target.value = '';
  }

  function removeFile() {
    setSelectedFile(null);
    setFileError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) return;

    setSaving(true);

    let arquivoUrl: string | null = null;
    let arquivoNome: string | null = null;

    if (selectedFile) {
      try {
        const result = await uploadFileToR2({
          folder: 'tickets',
          quoteId: null,
          tipo: 'anexo',
          file: selectedFile,
        });
        arquivoUrl = result.publicUrl;
        arquivoNome = selectedFile.name;
      } catch (err) {
        setFileError(err instanceof R2UploadError ? err.message : 'Erro ao enviar arquivo');
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase.from('tickets').insert({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      prioridade: form.prioridade,
      status: 'aberto',
      reportado_por_nome: userName,
      reportado_por_email: userEmail,
      arquivo_url: arquivoUrl,
      arquivo_nome_original: arquivoNome,
    });

    setSaving(false);
    if (!error) {
      onCreated();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card-static w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Abrir Ticket</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Reporter info (read-only) */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{userName}</span>
            <span>·</span>
            <span>{userEmail}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input
              className="input-field w-full"
              placeholder="Descreva o problema em poucas palavras"
              value={form.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                className="input-field w-full"
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
              <select
                className="input-field w-full"
                value={form.prioridade}
                onChange={(e) => set('prioridade', e.target.value)}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
            <textarea
              className="input-field-textarea w-full"
              rows={5}
              placeholder="Descreva o erro com o máximo de detalhes: o que aconteceu, onde, como reproduzir..."
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              required
            />
          </div>

          {/* Arquivo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Anexo (opcional)</label>
            {selectedFile ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-xs text-blue-700 truncate flex-1">{selectedFile.name}</span>
                <button type="button" onClick={removeFile} className="shrink-0">
                  <XCircle className="w-4 h-4 text-blue-400 hover:text-blue-600" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary w-full justify-center text-xs"
              >
                <Paperclip className="w-3.5 h-3.5" />
                Selecionar arquivo
              </button>
            )}
            {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.zip,.rar,.7z,.cdr,.ai,.psd"
            />
            <p className="text-xs text-gray-400 mt-1">PDF, imagens, ZIP, CDR, AI, PSD — máx. 350 MB</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? 'Enviando...' : 'Abrir Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
