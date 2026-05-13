import { useEffect, useState, useCallback } from 'react';
import {
  X, Upload, Loader2, ExternalLink, Eye, CheckCircle,
  FileImage, Download, Image, Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import FileViewerModal from './FileViewerModal';
import Toast from './Toast';

export interface PrintJob {
  id: string;
  created_at: string;
  updated_at: string;
  setor: string;
  os_id: number | null;
  os_code: string | null;
  client_name: string;
  client_phone: string | null;
  status: string;
  final_art_url: string | null;
  notes: string | null;
}

interface QuoteFile {
  id: number;
  quote_id: number;
  tipo: string | null;
  arquivo_url: string;
  arquivo_nome: string | null;
  created_at: string;
}

interface LiveQuoteData {
  descricao_pedido: string | null;
  observacoes: string | null;
  aprovado_descricao: string | null;
  observacoes_financeiro: string | null;
  observacoes_pre_impressao: string | null;
}

interface PrintJobDrawerProps {
  job: PrintJob;
  onClose: () => void;
  onUpdated: (updated: PrintJob) => void;
}

function StatusBadgePrintJob({ status }: { status: string }) {
  if (status === 'PRONTO') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle className="w-3 h-3" />
        Pronto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
      <Loader2 className="w-3 h-3" />
      Solicitado
    </span>
  );
}

function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  } catch {
    return 'arquivo';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PrintJobDrawer({ job, onClose, onUpdated }: PrintJobDrawerProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(job.status);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [markingPronto, setMarkingPronto] = useState(false);
  const [uploadingArt, setUploadingArt] = useState(false);
  const [artUrl, setArtUrl] = useState(job.final_art_url);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [quoteArts, setQuoteArts] = useState<QuoteFile[]>([]);
  const [loadingArts, setLoadingArts] = useState(false);
  const [liveData, setLiveData] = useState<LiveQuoteData | null>(null);

  const loadQuoteArts = useCallback(async () => {
    if (!job.os_id) return;
    setLoadingArts(true);
    const { data: orderData } = await supabase
      .from('orders')
      .select('id, quote_id, observacoes_pre_impressao')
      .eq('id', job.os_id)
      .maybeSingle();

    if (orderData?.quote_id) {
      const [filesResult, quoteResult, paymentResult] = await Promise.all([
        supabase
          .from('quote_files')
          .select('*')
          .eq('quote_id', orderData.quote_id)
          .eq('tipo', 'ARTE')
          .order('created_at', { ascending: false }),
        supabase
          .from('quotes')
          .select('descricao_pedido, observacoes, aprovado_descricao')
          .eq('id', orderData.quote_id)
          .single(),
        supabase
          .from('quote_payments')
          .select('observacoes_financeiro')
          .eq('quote_id', orderData.quote_id)
          .maybeSingle(),
      ]);

      setQuoteArts(filesResult.data ?? []);

      console.log('quote.descricao_pedido', quoteResult.data?.descricao_pedido);

      setLiveData({
        descricao_pedido: quoteResult.data?.descricao_pedido ?? null,
        observacoes: quoteResult.data?.observacoes ?? null,
        aprovado_descricao: quoteResult.data?.aprovado_descricao ?? null,
        observacoes_financeiro: (paymentResult.data as any)?.observacoes_financeiro ?? null,
        observacoes_pre_impressao: (orderData as any)?.observacoes_pre_impressao ?? null,
      });
    }
    setLoadingArts(false);
  }, [job.os_id]);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    loadQuoteArts();
  }, [loadQuoteArts]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  async function uploadArtFile(file: File) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'image/svg+xml'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const extAllowed = ['png', 'jpg', 'jpeg', 'pdf', 'svg', 'cdr', 'ai', 'psd', 'eps'];

    if (!allowedTypes.includes(file.type) && !extAllowed.includes(ext ?? '')) {
      setToast('Tipo de arquivo nao suportado');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setToast('Arquivo muito grande. Maximo 50MB');
      return;
    }

    setUploadingArt(true);
    try {
      const fileName = `arte_final_${job.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('artwork-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('artwork-files')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('print_jobs')
        .update({ final_art_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', job.id);

      if (error) throw error;

      setArtUrl(publicUrl);
      onUpdated({ ...job, final_art_url: publicUrl, status, notes });
      setToast('Arte enviada com sucesso');
    } catch {
      setToast('Erro ao enviar arquivo');
    }
    setUploadingArt(false);
  }

  async function handleSave() {
    setSaving(true);
    const combinedNotes = [job.notes, notes.trim()].filter(Boolean).join('\n\n---\n\n') || null;
    const { data, error } = await supabase
      .from('print_jobs')
      .update({ status, notes: combinedNotes, updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .select()
      .maybeSingle();

    if (error) {
      setToast('Erro ao salvar');
    } else if (data) {
      onUpdated({ ...data, final_art_url: artUrl } as PrintJob);
      setNotes('');
      setToast('Salvo com sucesso');
    }
    setSaving(false);
  }

  async function handleMarkPronto() {
    setMarkingPronto(true);
    const { data, error } = await supabase
      .from('print_jobs')
      .update({ status: 'PRONTO', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .select()
      .maybeSingle();

    if (error) {
      setToast('Erro ao marcar como pronto');
    } else if (data) {
      setStatus('PRONTO');
      const updated = { ...data, final_art_url: artUrl } as PrintJob;
      onUpdated(updated);
      setToast('Marcado como pronto');
    }
    setMarkingPronto(false);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[42%] sm:min-w-[400px] sm:max-w-[540px] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col" style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.08)',
        }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/80">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-lg font-semibold text-primary-500 truncate">
                {job.os_code ? `OS ${job.os_code}` : job.id.slice(0, 8).toUpperCase()}
              </h2>
              <StatusBadgePrintJob status={status} />
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dados</h3>
              <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">OS</p>
                    <p className="text-sm text-gray-800 font-medium">{job.os_code ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Telefone</p>
                    <p className="text-sm text-gray-800">{job.client_phone ?? '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Cliente</p>
                  <p className="text-sm text-gray-800 font-medium">{job.client_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Criado em</p>
                    <p className="text-xs text-gray-600">{formatDate(job.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5">Atualizado</p>
                    <p className="text-xs text-gray-600">{formatDate(job.updated_at)}</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5" />
                Artes do orcamento
              </h3>
              <div className="glass-card-static rounded-glass-sm overflow-hidden">
                {loadingArts ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                  </div>
                ) : quoteArts.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-gray-400 italic">
                    {job.os_id ? 'Nenhuma arte cadastrada no orcamento.' : 'Sem OS vinculada.'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100/60">
                    {quoteArts.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                          <FileImage className="w-4 h-4 text-sky-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate font-medium">
                            {file.arquivo_nome ?? fileNameFromUrl(file.arquivo_url)}
                          </p>
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(file.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => { setViewerUrl(file.arquivo_url); setViewerTitle(file.arquivo_nome ?? 'Arte'); }}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={file.arquivo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                            title="Baixar / Abrir"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Arte final</h3>
              <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                {artUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <FileImage className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 leading-none mb-0.5">Arte enviada</p>
                        <p className="text-sm text-gray-700 truncate">{fileNameFromUrl(artUrl)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setViewerUrl(artUrl); setViewerTitle('Arte Final'); }}
                        className="btn-primary text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Visualizar
                      </button>
                      <a
                        href={artUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm inline-flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir
                      </a>
                    </div>
                    <p className="text-xs text-gray-400 text-center">Arraste ou clique abaixo para substituir</p>
                  </div>
                ) : null}

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) uploadArtFile(f);
                  }}
                  className={`relative border-2 border-dashed rounded-lg transition-all ${dragOver ? 'border-primary-500 bg-primary-50/50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/20'} ${uploadingArt ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <label className="flex flex-col items-center justify-center gap-2 p-4 cursor-pointer">
                    {uploadingArt ? (
                      <><Loader2 className="w-6 h-6 text-primary-500 animate-spin" /><span className="text-sm text-gray-600">Enviando...</span></>
                    ) : (
                      <><Upload className="w-5 h-5 text-gray-400" /><span className="text-sm text-gray-600">{artUrl ? 'Substituir arte' : 'Enviar arte final'}</span></>
                    )}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.svg,.cdr,.ai,.psd,.eps"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArtFile(f); }}
                      className="hidden"
                      disabled={uploadingArt}
                    />
                  </label>
                </div>
              </div>
            </section>

            {job.os_id && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observacoes do orcamento</h3>
                <div className="glass-card-static p-4 rounded-glass-sm space-y-2">
                  {[
                    { label: 'DESCRIÇÃO DO PEDIDO', value: liveData?.descricao_pedido },
                    { label: 'OBS ORÇAMENTO', value: liveData?.observacoes },
                    { label: 'OBS FINANCEIRO', value: liveData?.observacoes_financeiro },
                    { label: 'OBS PRÉ-IMPRESSÃO', value: liveData?.observacoes_pre_impressao },
                    { label: 'ITENS APROVADOS', value: liveData?.aprovado_descricao },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{value || '-'}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observacoes da impressao</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Observacoes adicionais sobre a impressao..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </section>
          </div>

          <div className="px-6 py-4 border-t border-gray-100/80 space-y-2">
            {status !== 'PRONTO' && (
              <button
                onClick={handleMarkPronto}
                disabled={markingPronto}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {markingPronto ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {markingPronto ? 'Marcando...' : 'Marcar como PRONTO'}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {viewerUrl && (
        <FileViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      )}
    </>
  );
}
