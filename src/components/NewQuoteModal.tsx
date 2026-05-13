import { useState, useRef } from 'react';
import { X, Loader2, Image, Upload, File, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

import type { SetorType } from '../pages/QuotesPage';

interface NewQuoteModalProps {
  setor: SetorType;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewQuoteModal({ setor, onClose, onCreated }: NewQuoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_whatsapp: '',
    cliente_cpf_cnpj: '',
    endereco_entrega: '',
    descricao_pedido: '',
    observacoes: '',
    arquivo_arte_url: '',
    vendedor_nome: '',
    prioridade: 'MEDIA',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }

  function handleFile(file: File) {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de arquivo não suportado. Use imagens (JPG, PNG, GIF, WEBP, SVG) ou PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. O tamanho máximo é 10MB.');
      return;
    }

    setSelectedFile(file);
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function uploadFile(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('artwork-files')
      .upload(filePath, file);

    if (uploadError) {
      alert('Erro ao fazer upload do arquivo: ' + uploadError.message);
      return null;
    }

    const { data } = supabase.storage
      .from('artwork-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let artworkUrl = form.arquivo_arte_url;

    if (selectedFile) {
      setUploadingFile(true);
      const uploadedUrl = await uploadFile(selectedFile);
      setUploadingFile(false);

      if (!uploadedUrl) {
        setLoading(false);
        return;
      }

      artworkUrl = uploadedUrl;
    }

    const { error } = await supabase.from('quotes').insert({
      cliente_nome: form.cliente_nome,
      cliente_telefone: form.cliente_telefone || null,
      cliente_whatsapp: form.cliente_whatsapp || null,
      cliente_cpf_cnpj: form.cliente_cpf_cnpj || null,
      endereco_entrega: form.endereco_entrega || null,
      descricao_pedido: form.descricao_pedido,
      observacoes: form.observacoes || null,
      arquivo_arte_url: artworkUrl || null,
      vendedor_nome: form.vendedor_nome,
      prioridade: form.prioridade,
      status: 'PENDENTE_ORCAMENTO',
      setor,
    });

    setLoading(false);

    if (error) {
      alert('Erro ao criar orçamento: ' + error.message);
      return;
    }

    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-card-static relative w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title text-xl">Novo Orcamento</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do cliente <span className="text-red-500">*</span>
            </label>
            <input
              name="cliente_nome"
              value={form.cliente_nome}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendedor <span className="text-red-500">*</span>
              </label>
              <input
                name="vendedor_nome"
                value={form.vendedor_nome}
                onChange={handleChange}
                required
                className="input-field"
                placeholder="Nome do vendedor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade <span className="text-red-500">*</span>
              </label>
              <select
                name="prioridade"
                value={form.prioridade}
                onChange={handleChange}
                required
                className="input-field"
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                name="cliente_telefone"
                value={form.cliente_telefone}
                onChange={handleChange}
                className="input-field"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                name="cliente_whatsapp"
                value={form.cliente_whatsapp}
                onChange={handleChange}
                className="input-field"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF / CNPJ</label>
            <input
              name="cliente_cpf_cnpj"
              value={form.cliente_cpf_cnpj}
              onChange={handleChange}
              className="input-field"
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereco de entrega</label>
            <textarea
              name="endereco_entrega"
              value={form.endereco_entrega}
              onChange={handleChange}
              className="input-field resize-none"
              rows={2}
              placeholder="Rua, numero, bairro, cidade..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descricao do pedido <span className="text-red-500">*</span>
            </label>
            <textarea
              name="descricao_pedido"
              value={form.descricao_pedido}
              onChange={handleChange}
              required
              className="input-field resize-none"
              rows={3}
              placeholder="Descreva os itens e servicos solicitados..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes</label>
            <textarea
              name="observacoes"
              value={form.observacoes}
              onChange={handleChange}
              className="input-field resize-none"
              rows={2}
              placeholder="Informacoes adicionais..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Image className="w-4 h-4 text-gray-400" />
                Arquivo de arte pronta
                <span className="text-xs text-gray-400 font-normal">(opcional)</span>
              </span>
            </label>

            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-100/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInput}
                  accept="image/*,.pdf"
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium text-blue-600">Clique para selecionar</span> ou arraste o arquivo
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF, WEBP, SVG ou PDF (máx. 10MB)
                </p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <File className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {uploadingFile ? 'Enviando arquivo...' : loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
