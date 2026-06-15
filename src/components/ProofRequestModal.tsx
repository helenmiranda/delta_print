import { useState, useEffect } from 'react';
import { X, Upload, Loader2, FileText, Download, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileToR2, R2UploadError } from '../lib/r2Upload';
import { validateUploadFile, ACCEPT_ATTR } from '../lib/uploadValidation';

interface UploadedFile {
  url: string;
  nome: string;
}

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
  solicitanteNome?: string;
}

export default function ProofRequestModal({ orderId, onClose, onSuccess, solicitanteNome }: ProofRequestModalProps) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
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
      return;
    }

    setUploadingCount((c) => c + 1);
    setUploadError(null);

    try {
      const { publicUrl } = await uploadFileToR2({
        folder: 'provas',
        quoteId: null,
        tipo: 'PROVA',
        file,
      });
      setUploadedFiles((prev) => [...prev, { url: publicUrl, nome: file.name }]);
    } catch (err) {
      const msg = err instanceof R2UploadError ? err.message : 'Erro ao fazer upload do arquivo';
      setUploadError(msg);
    }

    setUploadingCount((c) => c - 1);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files || []).forEach(uploadProofFile);
    e.target.value = '';
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
    Array.from(e.dataTransfer.files).forEach(uploadProofFile);
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

    if (uploadedFiles.length === 0) {
      alert('Adicione ao menos um arquivo da prova');
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
      arquivo_prova_url: uploadedFiles[0].url,
      arquivo_prova_nome_original: uploadedFiles[0].nome,
      observacoes: form.observacoes || null,
      status_prova: 'SOLICITADA',
      solicitante_nome: solicitanteNome || null,
    };

    if (['COUCHE', 'SULFITE', 'C2S'].includes(form.papel_tipo)) {
      payload.papel_gramatura = form.papel_gramatura || null;
      payload.papel_outros = null;
    } else if (form.papel_tipo === 'OUTROS') {
      payload.papel_outros = form.papel_outros || null;
      payload.papel_gramatura = form.papel_gramatura || null;
    }

    const { data: proof, error } = await supabase
      .from('print_proofs')
      .insert(payload)
      .select('id')
      .single();

    if (error || !proof) {
      setSubmitting(false);
      alert('Erro ao solicitar prova: ' + error?.message);
      return;
    }

    await supabase.from('print_proof_files').insert(
      uploadedFiles.map((f) => ({
        print_proof_id: proof.id,
        arquivo_url: f.url,
        arquivo_nome_original: f.nome,
      }))
    );

    setSubmitting(false);
    onSuccess();
    handleClose();
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
                Arquivos da prova <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Formatos aceitos: PDF, CDR, AI, PSD, JPG, PNG, ZIP, RAR, 7Z — máx. 2GB por arquivo
              </p>

              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-green-800 truncate">{f.nome}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {uploadError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg transition-all ${
                  dragOver
                    ? 'border-primary-500 bg-primary-50/50'
                    : uploadError
                    ? 'border-red-300 hover:border-red-400'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                } ${uploadingCount > 0 ? 'pointer-events-none opacity-60' : ''}`}
              >
                <label className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer">
                  {uploadingCount > 0 ? (
                    <>
                      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-700">
                          Enviando {uploadingCount} arquivo{uploadingCount > 1 ? 's' : ''}...
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Por favor, aguarde</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className={`w-8 h-8 ${dragOver ? 'text-primary-500' : 'text-gray-400'}`} />
                      <div className="text-center">
                        <span className="text-sm font-medium text-gray-700">
                          {uploadedFiles.length > 0 ? 'Adicionar mais arquivos' : 'Enviar arquivos'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Arraste ou clique para selecionar</p>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept={ACCEPT_ATTR}
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                    disabled={uploadingCount > 0}
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
                disabled={submitting || uploadingCount > 0}
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
