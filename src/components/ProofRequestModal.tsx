import { useState, useEffect } from 'react';
import { X, Upload, Loader2, FileText, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileToR2, R2UploadError } from '../lib/r2Upload';
import { validateUploadFile, ACCEPT_ATTR } from '../lib/uploadValidation';

interface OrderOption {
  id: number;
  codigo_os: string;
  quote: {
    cliente_nome: string;
  } | null;
}

interface ProofRequestModalProps {
  orderId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProofRequestModal({ orderId, onClose, onSuccess }: ProofRequestModalProps) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | undefined>(orderId);

  const [form, setForm] = useState({
    nome_prova: '',
    tipo_impressao: 'PADRAO',
    cores: 'COLORIDO',
    lados: 'FRENTE_VERSO',
    ajuste: 'AJUSTADO',
    formato: 'A4',
    formato_custom: '',
    papel_tipo: 'COUCHE',
    papel_gramatura: '',
    papel_outros: '',
    arquivo_prova_url: '',
    arquivo_prova_nome_original: '',
    observacoes: '',
  });

  const [formatoType, setFormatoType] = useState<'preset' | 'custom'>('preset');

  useEffect(() => {
    if (!orderId) {
      async function loadOrders() {
        const { data } = await supabase
          .from('orders')
          .select(`
            id,
            codigo_os,
            quote:quotes (
              cliente_nome
            )
          `)
          .order('created_at', { ascending: false });

        if (data) {
          setOrders(data as OrderOption[]);
        }
      }
      loadOrders();
    }
  }, [orderId]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function uploadProofFile(file: File) {
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      setUploadError(validation.errorMessage!);
      setUploadStatus('error');
      return;
    }

    setUploadingFile(true);
    setUploadStatus('uploading');
    setUploadError(null);

    try {
      const { publicUrl } = await uploadFileToR2({
        folder: 'provas',
        quoteId: null,
        tipo: 'PROVA',
        file,
      });

      setForm((prev) => ({
        ...prev,
        arquivo_prova_url: publicUrl,
        arquivo_prova_nome_original: file.name,
      }));
      setUploadStatus('done');
    } catch (err) {
      console.error('Error uploading proof file:', err);
      const msg = err instanceof R2UploadError ? err.message : 'Erro ao fazer upload do arquivo';
      setUploadError(msg);
      setUploadStatus('error');
    }

    setUploadingFile(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadProofFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      uploadProofFile(files[0]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.nome_prova.trim()) {
      alert('Nome da prova e obrigatorio');
      return;
    }

    if (formatoType === 'custom' && !form.formato_custom.trim()) {
      alert('Descreva o formato customizado');
      return;
    }

    if (form.papel_tipo === 'OUTROS' && !form.papel_outros.trim()) {
      alert('Especifique qual tipo de papel');
      return;
    }

    if (!form.arquivo_prova_url) {
      alert('Arquivo da prova e obrigatorio');
      return;
    }

    setSubmitting(true);

    const payload: any = {
      order_id: selectedOrderId || null,
      nome_prova: form.nome_prova,
      tipo_impressao: form.tipo_impressao,
      cores: form.cores,
      lados: form.lados,
      ajuste: form.ajuste,
      formato: form.formato,
      papel_tipo: form.papel_tipo,
      arquivo_prova_url: form.arquivo_prova_url,
      arquivo_prova_nome_original: form.arquivo_prova_nome_original || null,
      observacoes: form.observacoes || null,
      status_prova: 'SOLICITADA',
    };

    if (['COUCHE', 'SULFITE', 'C2S'].includes(form.papel_tipo)) {
      payload.papel_gramatura = form.papel_gramatura || null;
      payload.papel_outros = null;
    } else if (form.papel_tipo === 'OUTROS') {
      payload.papel_outros = form.papel_outros || null;
      payload.papel_gramatura = form.papel_gramatura || null;
    }

    const { error } = await supabase.from('print_proofs').insert(payload);

    setSubmitting(false);

    if (!error) {
      onSuccess();
      handleClose();
    } else {
      alert('Erro ao solicitar prova: ' + error.message);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none transition-all duration-300 ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-glass shadow-2xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100/80 bg-white/95 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-gray-800">Solicitar Prova de Impressao</h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {!orderId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Ordem de Servico (OS)
                </label>
                <select
                  value={selectedOrderId || ''}
                  onChange={(e) => setSelectedOrderId(e.target.value ? Number(e.target.value) : undefined)}
                  className="input-field"
                >
                  <option value="">Selecione uma OS (opcional)</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.codigo_os} - {order.quote?.cliente_nome || 'Sem cliente'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome da prova <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nome_prova"
                value={form.nome_prova}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Ex: Prova inicial capa"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de impressao
              </label>
              <div className="flex gap-3">
                {['PADRAO', 'CAPA', 'MIOLO'].map((tipo) => (
                  <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipo_impressao"
                      value={tipo}
                      checked={form.tipo_impressao === tipo}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{tipo}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cores
              </label>
              <div className="flex gap-3">
                {['COLORIDO', 'PB'].map((cor) => (
                  <label key={cor} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cores"
                      value={cor}
                      checked={form.cores === cor}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{cor === 'PB' ? 'P&B' : cor}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lados
              </label>
              <div className="flex gap-3">
                {['FRENTE', 'FRENTE_VERSO'].map((lado) => (
                  <label key={lado} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lados"
                      value={lado}
                      checked={form.lados === lado}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{lado.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ajuste
              </label>
              <div className="flex gap-3">
                {['AJUSTADO', 'SEM_AJUSTE'].map((ajuste) => (
                  <label key={ajuste} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ajuste"
                      value={ajuste}
                      checked={form.ajuste === ajuste}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{ajuste.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formato
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['A4', 'A3_PLUS', 'A4_PLUS', 'FORMATO_MAIOR', 'OUTRO'].map((formato) => (
                  <label key={formato} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="formato"
                      value={formato}
                      checked={formatoType === (formato === 'OUTRO' ? 'custom' : 'preset') && (formato === 'OUTRO' || form.formato === formato)}
                      onChange={(e) => {
                        if (formato === 'OUTRO') {
                          setFormatoType('custom');
                          setForm((prev) => ({ ...prev, formato: '' }));
                        } else {
                          setFormatoType('preset');
                          setForm((prev) => ({ ...prev, formato: e.target.value }));
                        }
                      }}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{formato.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>

              {formatoType === 'custom' && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Formato (descreva) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="formato_custom"
                    value={form.formato_custom}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, formato_custom: e.target.value, formato: e.target.value }));
                    }}
                    className="input-field"
                    placeholder="Ex: A2, 30x40cm, 21x29.7cm"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de papel
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['COUCHE', 'SULFITE', 'C2S', 'OUTROS'].map((papel) => (
                  <label key={papel} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="papel_tipo"
                      value={papel}
                      checked={form.papel_tipo === papel}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{papel}</span>
                  </label>
                ))}
              </div>

              {['COUCHE', 'SULFITE', 'C2S'].includes(form.papel_tipo) && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Gramatura
                  </label>
                  <input
                    type="text"
                    name="papel_gramatura"
                    value={form.papel_gramatura}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Ex: 150g, 200g"
                  />
                </div>
              )}

              {form.papel_tipo === 'OUTROS' && (
                <>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Qual papel? <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="papel_outros"
                      value={form.papel_outros}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Ex: Supremo, Reciclato, Kraft"
                      required
                    />
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Gramatura (opcional)
                    </label>
                    <input
                      type="text"
                      name="papel_gramatura"
                      value={form.papel_gramatura}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Ex: 150g, 200g"
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Arquivo da prova <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Formatos aceitos: PDF, CDR, AI, PSD, JPG, PNG, ZIP, RAR, 7Z — máx. 350MB
              </p>

              {uploadStatus === 'error' && uploadError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              {uploadStatus === 'done' && form.arquivo_prova_url && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      Arquivo enviado com sucesso
                    </p>
                    <p className="text-xs text-green-600 mt-1 truncate">
                      {form.arquivo_prova_nome_original || form.arquivo_prova_url.split('/').pop()}
                    </p>
                  </div>
                  <a
                    href={form.arquivo_prova_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                    title="Baixar arquivo"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg transition-all ${
                  dragOver
                    ? 'border-primary-500 bg-primary-50/50'
                    : uploadStatus === 'error'
                    ? 'border-red-300 hover:border-red-400'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                } ${uploadingFile ? 'pointer-events-none opacity-60' : ''}`}
              >
                <label className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer">
                  {uploadingFile ? (
                    <>
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-700">Enviando...</span>
                        <p className="text-xs text-gray-500 mt-1">Por favor, aguarde</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className={`w-8 h-8 ${dragOver ? 'text-primary-500' : 'text-gray-400'}`} />
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-700">
                          {uploadStatus === 'done' ? 'Reenviar arquivo' : 'Enviar arquivo'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Arraste ou clique para selecionar</p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept={ACCEPT_ATTR}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Observacoes
              </label>
              <textarea
                name="observacoes"
                value={form.observacoes}
                onChange={handleInputChange}
                rows={3}
                className="input-field resize-none"
                placeholder="Adicione observacoes sobre a prova..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="btn-ghost flex-1"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={submitting || uploadingFile}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Solicitando...
                  </>
                ) : (
                  'Solicitar prova'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
