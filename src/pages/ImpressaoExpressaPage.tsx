import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Loader2, Printer, CheckCircle, ExternalLink, Eye, PenLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { PrintJob } from '../components/PrintJobDrawer';
import PrintJobDrawer from '../components/PrintJobDrawer';
import NewPrintJobModal from '../components/NewPrintJobModal';
import Toast from '../components/Toast';
import FileViewerModal from '../components/FileViewerModal';
import LastUpdated from '../components/LastUpdated';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

function PrintJobStatusBadge({ status }: { status: string }) {
  if (status === 'PRONTO') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full font-semibold bg-emerald-100 text-emerald-700" style={{ fontSize: '11px', padding: '2px 8px' }}>
        <CheckCircle className="w-3 h-3" />
        Pronto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full font-semibold bg-orange-100 text-orange-700" style={{ fontSize: '11px', padding: '2px 8px' }}>
      <Loader2 className="w-3 h-3" />
      Solicitado
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function jobCode(job: PrintJob) {
  return `IMP-${job.id.slice(0, 6).toUpperCase()}`;
}

function getDateFilter(periodo: string): string | null {
  if (periodo === 'todos') return null;
  const now = new Date();
  let dateLimit: Date;
  switch (periodo) {
    case '7dias': dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case '30dias': dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case '90dias': dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
    default: return null;
  }
  return dateLimit.toISOString();
}

export default function ImpressaoExpressaPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('30dias');
  const [showModal, setShowModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [markingProntoId, setMarkingProntoId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchJobs() {
    setLoading(true);
    const dateFilter = getDateFilter(periodo);

    let query = supabase
      .from('print_jobs')
      .select('*')
      .eq('setor', 'GRAFICA_EXPRESSA')
      .order('created_at', { ascending: false });

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setJobs(data as PrintJob[]);
    }
    setLoading(false);
    setLastUpdated(new Date());
  }

  useEffect(() => {
    fetchJobs();
  }, [periodo]);

  useAutoRefresh(fetchJobs);

  async function handleMarkPronto(e: React.MouseEvent, job: PrintJob) {
    e.stopPropagation();
    setMarkingProntoId(job.id);
    const { error } = await supabase
      .from('print_jobs')
      .update({ status: 'PRONTO', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    if (!error) {
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'PRONTO' } : j));
      if (selectedJob?.id === job.id) setSelectedJob((prev) => prev ? { ...prev, status: 'PRONTO' } : null);
      setToast('Marcado como pronto');
    } else {
      setToast('Erro ao atualizar status');
    }
    setMarkingProntoId(null);
  }

  function handleUpdated(updated: PrintJob) {
    setJobs((prev) => prev.map((j) => j.id === updated.id ? updated : j));
    setSelectedJob(updated);
  }

  function handleCreated(job: PrintJob) {
    setJobs((prev) => [job, ...prev]);
    setShowModal(false);
    setToast('Impressao solicitada com sucesso');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
                <img src="/asset_1.svg" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest leading-none mb-1">
                  Grafica Expressa
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
                  Impressao
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="7dias">Ultimos 7 dias</option>
                <option value="30dias">Ultimos 30 dias</option>
                <option value="90dias">Ultimos 90 dias</option>
                <option value="todos">Todos</option>
              </select>
              <LastUpdated timestamp={lastUpdated} />
              <button onClick={fetchJobs} className="btn-ghost text-sm" disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Nova impressao
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex gap-2 pt-6 border-b border-gray-200">
          <button
            onClick={() => navigate('/orcamentos-expressa')}
            className="px-8 py-4 text-base font-semibold transition-all relative text-gray-500 hover:text-gray-700 bg-gray-50/50 rounded-t-lg border-t border-x border-gray-200"
          >
            Orcamentos / OS
          </button>
          <button
            className="px-8 py-4 text-base font-semibold transition-all relative text-primary-600 bg-white rounded-t-xl border-t-2 border-x-2 border-primary-500 -mb-[1px]"
          >
            Impressao
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 mt-0">
        <div className="glass-card overflow-hidden border-t-0 rounded-t-none">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-glass bg-primary-50 flex items-center justify-center mb-4">
                <Printer className="w-7 h-7 text-primary-400" />
              </div>
              <p className="text-gray-600 font-medium">Nenhuma impressao encontrada</p>
              <p className="text-sm text-gray-400 mt-1">Clique em "Nova impressao" para comecar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Codigo</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">OS</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Cliente</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Telefone</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Arte Final</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">Data</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const isSolicitado = job.status === 'SOLICITADO';
                    const rowBg = isSolicitado
                      ? 'bg-orange-50/40 hover:bg-orange-50/70'
                      : 'bg-emerald-50/30 hover:bg-emerald-50/60';

                    return (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`border-b border-gray-100/60 last:border-0 cursor-pointer transition-colors ${rowBg}`}
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono font-medium text-primary-500">{jobCode(job)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">{job.os_code ?? '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-800 font-medium">{job.client_name}</span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className="text-sm text-gray-600">{job.client_phone ?? '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <PrintJobStatusBadge status={job.status} />
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          {job.final_art_url ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setViewerUrl(job.final_art_url!); setViewerTitle('Arte Final'); }}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-primary-400 hover:text-primary-600 hover:bg-primary-100 transition-all"
                                title="Visualizar arte"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={job.final_art_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                                title="Abrir arte"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-sm text-gray-500">{formatDate(job.created_at)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {isSolicitado && (
                              <button
                                onClick={(e) => handleMarkPronto(e, job)}
                                disabled={markingProntoId === job.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Marcar como pronto"
                              >
                                {markingProntoId === job.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                Pronto
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-all"
                              title="Editar / Ver detalhes"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewPrintJobModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}

      {selectedJob && (
        <PrintJobDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdated={handleUpdated}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {viewerUrl && (
        <FileViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      )}
    </div>
  );
}
