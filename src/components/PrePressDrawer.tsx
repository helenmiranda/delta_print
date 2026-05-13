import { useEffect, useState, useCallback } from 'react';
import {
  X, Copy, User, Phone, FileText, Download, Loader2, ClipboardCopy,
  Truck, Package, Calendar, Upload, Save, CheckCircle2, Printer,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveArteUrl } from '../lib/utils';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import Toast from './Toast';
import ProofRequestModal from './ProofRequestModal';

interface OrderDetail {
  id: number;
  codigo_os: string;
  status_os: string;
  created_at: string;
  updated_at: string;
  arte_final_url: string | null;
  observacoes_pre_impressao: string | null;
  data_liberacao_producao: string | null;
  quote: {
    id: number;
    codigo_orcamento: string | null;
    cliente_nome: string;
    cliente_telefone: string | null;
    vendedor_nome: string | null;
    prioridade: string;
    descricao_pedido: string;
    aprovado_descricao: string | null;
    aprovado_valor_total: number | null;
    arquivo_orcamento_url: string | null;
    arquivo_arte_url: string | null;
  } | null;
}

interface PrePressDrawerProps {
  orderId: number;
  onClose: () => void;
  onUpdated: () => void;
}

function CopyBtn({ value, onCopy }: { value: string; onCopy: (t: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCopy(value); }}
      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all flex-shrink-0"
      title="Copiar"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

function ReadOnlyField({
  icon: Icon, label, value, onCopy,
}: { icon: React.ElementType; label: string; value: string | null; onCopy: (t: string) => void }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80 last:border-0 group">
      <Icon className="w-4 h-4 text-primary-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 break-words">{value}</p>
      </div>
      <CopyBtn value={value} onCopy={onCopy} />
    </div>
  );
}

function formatCurrency(v: number | null) {
  if (v == null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PrePressDrawer({ orderId, onClose, onUpdated }: PrePressDrawerProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [uploadingArt, setUploadingArt] = useState(false);
  const [dragOverArt, setDragOverArt] = useState(false);
  const [sendingToProduction, setSendingToProduction] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast('Texto copiado');
  }, []);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          codigo_os,
          status_os,
          created_at,
          updated_at,
          arte_final_url,
          observacoes_pre_impressao,
          data_liberacao_producao,
          quote:quotes (
            id,
            codigo_orcamento,
            cliente_nome,
            cliente_telefone,
            vendedor_nome,
            prioridade,
            descricao_pedido,
            aprovado_descricao,
            aprovado_valor_total,
            arquivo_orcamento_url,
            arquivo_arte_url
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (!error && data) {
        setOrder(data as OrderDetail);
        setObservacoes(data.observacoes_pre_impressao || '');
      }
      setLoading(false);
    }
    load();
    requestAnimationFrame(() => setOpen(true));
  }, [orderId]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function copyOsSummary() {
    if (!order || !order.quote) return;
    const lines: string[] = [];
    lines.push(`OS: ${order.codigo_os}`);
    lines.push(`Cliente: ${order.quote.cliente_nome}`);
    if (order.quote.vendedor_nome) lines.push(`Vendedor: ${order.quote.vendedor_nome}`);
    lines.push(`Prioridade: ${order.quote.prioridade}`);
    if (order.quote.aprovado_descricao) lines.push(`Produto: ${order.quote.aprovado_descricao}`);
    lines.push(`Valor: ${formatCurrency(order.quote.aprovado_valor_total)}`);
    lines.push(`Status: ${order.status_os}`);
    copyToClipboard(lines.join('\n'));
  }

  async function uploadArteFinal(file: File) {
    if (!order) return;

    setUploadingArt(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `arte_final_${order.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('artwork-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('artwork-files')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('orders')
        .update({ arte_final_url: publicUrl })
        .eq('id', order.id);

      if (!error) {
        setOrder({ ...order, arte_final_url: publicUrl });
        setToast('Arte final enviada com sucesso');
      } else {
        setToast('Erro ao salvar arte final');
      }
    } catch (error) {
      console.error('Error uploading art:', error);
      setToast('Erro ao fazer upload');
    }

    setUploadingArt(false);
  }

  function handleArtFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadArteFinal(file);
    }
  }

  function handleDragOverArt(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverArt(true);
  }

  function handleDragLeaveArt(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverArt(false);
  }

  function handleDropArt(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverArt(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      uploadArteFinal(files[0]);
    }
  }

  async function handleSaveObservacoes() {
    if (!order) return;

    const { error } = await supabase
      .from('orders')
      .update({ observacoes_pre_impressao: observacoes })
      .eq('id', order.id);

    if (!error) {
      setOrder({ ...order, observacoes_pre_impressao: observacoes });
      setToast('Observacoes salvas');
    } else {
      setToast('Erro ao salvar observacoes');
    }
  }

  async function handleSendToProduction() {
    if (!order || !order.arte_final_url) {
      setToast('E necessario enviar a arte final antes de liberar para producao');
      return;
    }

    setSendingToProduction(true);

    const { error } = await supabase
      .from('orders')
      .update({
        status_os: 'EM_PRODUCAO',
        data_liberacao_producao: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (!error) {
      setToast('Liberado para producao');
      onUpdated();
      handleClose();
    } else {
      setToast('Erro ao liberar para producao');
    }

    setSendingToProduction(false);
  }

  function handleRequestProof() {
    setShowProofModal(true);
  }

  function handleProofSuccess() {
    setToast('Prova solicitada');
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[42%] sm:min-w-[380px] sm:max-w-[560px] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col" style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.08)',
        }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : !order || !order.quote ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <p className="text-gray-500">Registro nao encontrado.</p>
              <button onClick={handleClose} className="btn-ghost mt-4 text-sm">Fechar</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/80">
                <div className="flex items-center gap-3 min-w-0">
                  <Truck className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  <h2 className="text-lg font-semibold text-primary-500 truncate">
                    {order.codigo_os}
                  </h2>
                  <StatusBadge status={order.status_os} />
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 px-6 py-3 border-b border-gray-100/80">
                <button onClick={copyOsSummary} className="btn-ghost text-xs py-1.5 px-3">
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Copiar resumo da OS
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Resumo da OS</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm">
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80">
                      <Package className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Codigo OS</p>
                        <p className="text-sm font-semibold text-primary-500">{order.codigo_os}</p>
                      </div>
                      <CopyBtn value={order.codigo_os} onCopy={copyToClipboard} />
                    </div>
                    <ReadOnlyField icon={User} label="Cliente" value={order.quote.cliente_nome} onCopy={copyToClipboard} />
                    <ReadOnlyField icon={Phone} label="Telefone" value={order.quote.cliente_telefone} onCopy={copyToClipboard} />
                    {order.quote.vendedor_nome && (
                      <ReadOnlyField icon={User} label="Vendedor" value={order.quote.vendedor_nome} onCopy={copyToClipboard} />
                    )}
                    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80 last:border-0">
                      <Package className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Prioridade</p>
                        <div className="mt-1">
                          <PriorityBadge priority={order.quote.prioridade} />
                        </div>
                      </div>
                    </div>
                    <div className="py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary-400" />
                        <span className="text-[11px] text-gray-400 uppercase tracking-wide">Pedido</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{order.quote.descricao_pedido}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Arquivos finais de arte</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                    {order.arte_final_url && (
                      <a
                        href={order.arte_final_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm w-full"
                      >
                        <Download className="w-4 h-4" />
                        Baixar arte final
                      </a>
                    )}

                    <div
                      onDragOver={handleDragOverArt}
                      onDragLeave={handleDragLeaveArt}
                      onDrop={handleDropArt}
                      className={`relative border-2 border-dashed rounded-lg transition-all ${
                        dragOverArt
                          ? 'border-primary-500 bg-primary-50/50'
                          : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                      } ${uploadingArt ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <label className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer">
                        {uploadingArt ? (
                          <>
                            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                            <div className="text-center">
                              <span className="text-sm font-medium text-gray-700">Fazendo upload...</span>
                              <p className="text-xs text-gray-500 mt-1">Por favor, aguarde</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className={`w-8 h-8 ${dragOverArt ? 'text-primary-500' : 'text-gray-400'}`} />
                            <div className="text-center">
                              <span className="text-sm font-medium text-gray-700">
                                {order.arte_final_url ? 'Reenviar arte final' : 'Enviar arte final'}
                              </span>
                              <p className="text-xs text-gray-500 mt-1">Arraste o arquivo ou clique para selecionar</p>
                            </div>
                          </>
                        )}
                        <input
                          type="file"
                          onChange={handleArtFileChange}
                          className="hidden"
                          disabled={uploadingArt}
                        />
                      </label>
                    </div>

                    {resolveArteUrl(order.quote.arquivo_arte_url) && (
                      <a
                        href={resolveArteUrl(order.quote.arquivo_arte_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-sm w-full"
                      >
                        <Download className="w-4 h-4" />
                        Baixar arte original do cliente
                      </a>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observacoes da pre-impressao</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                    <textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={4}
                      className="input-field text-sm resize-none"
                      placeholder="Adicione observacoes sobre a preparacao da arte..."
                    />
                    <button
                      onClick={handleSaveObservacoes}
                      className="btn-ghost text-sm w-full"
                    >
                      <Save className="w-4 h-4" />
                      Salvar observacoes
                    </button>
                  </div>
                </section>

                <section>
                  <div className="space-y-3">
                    <button
                      onClick={handleSendToProduction}
                      disabled={!order.arte_final_url || sendingToProduction}
                      className="btn-primary text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingToProduction ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {sendingToProduction ? 'Enviando...' : 'OK — Enviar para Producao'}
                    </button>

                    <button
                      onClick={handleRequestProof}
                      className="btn-secondary text-sm w-full"
                    >
                      <Printer className="w-4 h-4" />
                      Solicitar Prova de Impressao
                    </button>
                  </div>
                </section>

                <div className="text-xs text-gray-400 pt-2 pb-4">
                  Criado em {formatDateTime(order.created_at)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {showProofModal && order && (
        <ProofRequestModal
          orderId={order.id}
          onClose={() => setShowProofModal(false)}
          onSuccess={handleProofSuccess}
        />
      )}
    </>
  );
}
