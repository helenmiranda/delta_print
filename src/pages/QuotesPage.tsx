import { useEffect, useState } from 'react';
import { Plus, FileText, Loader2, RefreshCw, Search, X, Printer, DollarSign, Send, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { enviarParaImpressao, OrderForPrint } from '../lib/printJobs';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import NewQuoteModal from '../components/NewQuoteModal';
import QuoteDrawer from '../components/QuoteDrawer';
import FinanceDrawer from '../components/FinanceDrawer';
import Toast from '../components/Toast';
import DeleteQuoteModal from '../components/DeleteQuoteModal';
import LastUpdated from '../components/LastUpdated';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface QuoteOrder {
  id: number;
  setor: string;
  codigo_os: string;
  status_os: string;
}

interface Quote {
  id: number;
  codigo_orcamento: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  status: string;
  created_at: string;
  aprovado_em?: string | null;
  aprovado_valor_total?: number | null;
  aprovado_descricao?: string | null;
  observacoes?: string | null;
  prioridade: string;
  vendedor_nome: string | null;
  order?: QuoteOrder | null;
}

type TabType = 'orcamentos' | 'aprovados';

export type SetorType = 'GRAFICA_EXPRESSA' | 'GRAFICA_INDUSTRIAL' | 'COMUNICA_VISUAL';

interface QuotesPageProps {
  setor: SetorType;
}

const SETOR_LABELS: Record<SetorType, string> = {
  GRAFICA_EXPRESSA: 'Gráfica Expressa',
  GRAFICA_INDUSTRIAL: 'Gráfica Industrial',
  COMUNICA_VISUAL: 'Comunicação Visual',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function QuotesPage({ setor }: QuotesPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('orcamentos');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [aprovados, setAprovados] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sendingPrintJobId, setSendingPrintJobId] = useState<number | null>(null);
  const [selectedFinanceId, setSelectedFinanceId] = useState<number | null>(null);
  const [markingEnviadoId, setMarkingEnviadoId] = useState<number | null>(null);
  const [deleteTargetQuote, setDeleteTargetQuote] = useState<Quote | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('');
  const [filterVendedor, setFilterVendedor] = useState<string>('');
  const [filterCliente, setFilterCliente] = useState<string>('');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('30dias');
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function getDateFilter(periodo: string): string | null {
    if (periodo === 'todos') return null;

    const now = new Date();
    let dateLimit: Date;

    switch (periodo) {
      case '7dias':
        dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30dias':
        dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90dias':
        dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'mes_atual':
        dateLimit = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return null;
    }

    return dateLimit.toISOString();
  }

  async function fetchQuotes() {
    setLoading(true);
    const dateFilter = getDateFilter(filterPeriodo);

    let query = supabase
      .from('quotes')
      .select(`
        id,
        codigo_orcamento,
        cliente_nome,
        cliente_telefone,
        status,
        created_at,
        aprovado_em,
        aprovado_valor_total,
        aprovado_descricao,
        observacoes,
        prioridade,
        vendedor_nome,
        order:orders(id, setor, codigo_os, status_os)
      `)
      .eq('setor', setor);

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data, error } = await query.is('deleted_at', null).order('created_at', { ascending: false });

    if (!error && data) {
      const normalized = (data as any[]).map((q) => ({
        ...q,
        order: Array.isArray(q.order) ? (q.order[0] ?? null) : (q.order ?? null),
      })) as Quote[];
      setQuotes(normalized);
      const filteredAprovados = normalized
        .filter((q) => q.status === 'APROVADO_CLIENTE' || q.status === 'OS_GERADA')
        .sort((a, b) => {
          const dateA = a.aprovado_em ?? a.created_at;
          const dateB = b.aprovado_em ?? b.created_at;
          return dateB.localeCompare(dateA);
        });
      setAprovados(filteredAprovados);
    }
    setLoading(false);
    setLastUpdated(new Date());
  }

  async function fetchVendedores() {
    const { data, error } = await supabase
      .from('quotes')
      .select('vendedor_nome')
      .eq('setor', setor)
      .is('deleted_at', null)
      .not('vendedor_nome', 'is', null)
      .order('vendedor_nome');

    if (!error && data) {
      const uniqueVendedores = Array.from(new Set(data.map((q) => q.vendedor_nome).filter(Boolean))) as string[];
      setVendedores(uniqueVendedores);
    }
  }

  useEffect(() => {
    fetchQuotes();
    fetchVendedores();
  }, [filterPeriodo, setor]);

  useAutoRefresh(fetchQuotes);

  function handleCreated() {
    setShowModal(false);
    fetchQuotes();
  }

  function applyFilters(data: Quote[]) {
    return data.filter((q) => {
      if (filterStatus && q.status !== filterStatus) return false;
      if (filterPrioridade && q.prioridade !== filterPrioridade) return false;
      if (filterVendedor && q.vendedor_nome !== filterVendedor) return false;
      if (filterCliente && !q.cliente_nome.toLowerCase().includes(filterCliente.toLowerCase())) return false;
      return true;
    });
  }

  function clearFilters() {
    setFilterStatus('');
    setFilterPrioridade('');
    setFilterVendedor('');
    setFilterCliente('');
    setFilterPeriodo('30dias');
  }

  async function handleEnviarParaImpressao(e: React.MouseEvent, q: Quote) {
    e.stopPropagation();
    if (!q.order) return;
    setSendingPrintJobId(q.id);
    const orderForPrint: OrderForPrint = {
      id: q.order.id,
      setor: q.order.setor,
      codigo_os: q.order.codigo_os,
      quote: {
        id: q.id,
        cliente_nome: q.cliente_nome,
        cliente_telefone: q.cliente_telefone,
        observacoes: q.observacoes,
        aprovado_descricao: q.aprovado_descricao,
      },
    };
    const result = await enviarParaImpressao(orderForPrint);
    setToast(result.message);
    setSendingPrintJobId(null);
    if (result.ok) {
      await fetchQuotes();
    }
  }

  async function handleMarcarEnviado(e: React.MouseEvent, q: Quote) {
    e.stopPropagation();
    setMarkingEnviadoId(q.id);
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'ORCAMENTO_ENVIADO', updated_at: new Date().toISOString() })
      .eq('id', q.id)
      .select('id,status')
      .single();
    if (error || !data) {
      setToast('Erro ao atualizar status. Tente novamente.');
    } else {
      setQuotes((prev) => prev.map((item) => item.id === q.id ? { ...item, status: 'ORCAMENTO_ENVIADO' } : item));
      setToast('Orçamento marcado como enviado');
    }
    setMarkingEnviadoId(null);
  }

  const baseData = activeTab === 'orcamentos' ? quotes : aprovados;
  const currentData = applyFilters(baseData);
  const hasActiveFilters = filterStatus || filterPrioridade || filterVendedor || filterCliente || filterPeriodo !== '30dias';

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
                  Orçamentos
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
                  {SETOR_LABELS[setor]}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LastUpdated timestamp={lastUpdated} />
              <button onClick={fetchQuotes} className="btn-ghost text-sm" disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Novo orcamento
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex gap-2 pt-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('orcamentos')}
            className={`px-8 py-4 text-base font-semibold transition-all relative ${
              activeTab === 'orcamentos'
                ? 'text-primary-600 bg-white rounded-t-xl border-t-2 border-x-2 border-primary-500 -mb-[1px]'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50/50 rounded-t-lg border-t border-x border-gray-200'
            }`}
          >
            Orçamentos
          </button>
          <button
            onClick={() => setActiveTab('aprovados')}
            className={`px-8 py-4 text-base font-semibold transition-all relative ${
              activeTab === 'aprovados'
                ? 'text-primary-600 bg-white rounded-t-xl border-t-2 border-x-2 border-primary-500 -mb-[1px]'
                : 'text-gray-500 hover:text-gray-700 bg-gray-50/50 rounded-t-lg border-t border-x border-gray-200'
            }`}
          >
            Aprovados / OS
          </button>
          {setor === 'GRAFICA_EXPRESSA' && (
            <button
              onClick={() => navigate('/impressao-expressa')}
              className="px-8 py-4 text-base font-semibold transition-all relative text-gray-500 hover:text-gray-700 bg-gray-50/50 rounded-t-lg border-t border-x border-gray-200"
            >
              Impressao
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
        <div className="glass-card border-t-0 rounded-t-none p-6 mb-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="filter-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Período</label>
                <select
                  value={filterPeriodo}
                  onChange={(e) => setFilterPeriodo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="90dias">Últimos 90 dias</option>
                  <option value="mes_atual">Este mês</option>
                  <option value="todos">Todos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="">Todos</option>
                  <option value="PENDENTE_ORCAMENTO">Pendente Orçamento</option>
                  <option value="PRONTO_PARA_ENVIAR">Pronto p/ envio</option>
                  <option value="ORCAMENTO_ENVIADO">Orçamento Enviado</option>
                  <option value="APROVADO_CLIENTE">Aprovado Cliente</option>
                  <option value="NAO_APROVADO">Não Aprovado</option>
                  <option value="OS_GERADA">OS Gerada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Prioridade</label>
                <select
                  value={filterPrioridade}
                  onChange={(e) => setFilterPrioridade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="">Todas</option>
                  <option value="BAIXA">Baixa</option>
                  <option value="MEDIA">Média</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Vendedor</label>
                <select
                  value={filterVendedor}
                  onChange={(e) => setFilterVendedor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="">Todos</option>
                  {vendedores.map((vendedor) => (
                    <option key={vendedor} value={vendedor}>
                      {vendedor}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Buscar Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filterCliente}
                    onChange={(e) => setFilterCliente(e.target.value)}
                    placeholder="Nome do cliente..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : currentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-glass bg-primary-50 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-primary-400" />
              </div>
              <p className="text-gray-600 font-medium">
                {activeTab === 'orcamentos' ? 'Nenhum orcamento encontrado' : 'Nenhum orcamento aprovado'}
              </p>
              <p className="text-body mt-1">
                {activeTab === 'orcamentos'
                  ? 'Clique em "Novo orcamento" para comecar.'
                  : 'Orcamentos aprovados aparecerao aqui.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                      Codigo
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                      Cliente
                    </th>
                    <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">
                      Vendedor
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">
                      Prioridade
                    </th>
                    {activeTab === 'aprovados' && (
                      <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">
                        Valor aprovado
                      </th>
                    )}
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                      Status
                    </th>
                    <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">
                      Data
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => {
                        if (activeTab === 'aprovados') {
                          setSelectedFinanceId(q.id);
                        } else {
                          setSelectedId(q.id);
                        }
                      }}
                      className={`border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                        (activeTab === 'aprovados' ? selectedFinanceId === q.id : selectedId === q.id)
                          ? 'bg-primary-50/60'
                          : 'hover:bg-white/50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-primary-500">
                          {q.codigo_orcamento ?? `#${q.id}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-800 font-medium">{q.cliente_nome}</span>
                      </td>
                      <td className="col-iframe-hide px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm text-gray-600">{q.vendedor_nome ?? '—'}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <PriorityBadge priority={q.prioridade} />
                      </td>
                      {activeTab === 'aprovados' && (
                        <td className="col-iframe-hide px-6 py-4 hidden sm:table-cell">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(q.aprovado_valor_total)}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="col-iframe-hide px-6 py-4 hidden sm:table-cell">
                        <span className="text-sm text-gray-500">{formatDate(q.created_at)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {activeTab === 'orcamentos' && q.status === 'PRONTO_PARA_ENVIAR' && (
                            <button
                              onClick={(e) => handleMarcarEnviado(e, q)}
                              disabled={markingEnviadoId === q.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Marcar como enviado"
                            >
                              {markingEnviadoId === q.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              Marcar enviado
                            </button>
                          )}
                          {activeTab === 'orcamentos' && q.status === 'AJUSTE_NECESSARIO' && (
                            <button
                              disabled
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                              title="Existe uma dúvida pendente. Resolva antes de enviar."
                            >
                              <Send className="w-3.5 h-3.5" />
                              Marcar enviado
                            </button>
                          )}
                          {activeTab === 'orcamentos' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTargetQuote(q); }}
                              disabled={q.status === 'OS_GERADA'}
                              title={q.status === 'OS_GERADA' ? 'Orçamentos com OS gerada não podem ser excluídos.' : 'Excluir orçamento'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </button>
                          )}
                          {activeTab === 'aprovados' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedFinanceId(q.id); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all"
                              title="Ver financeiro"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Financeiro
                            </button>
                          )}
                          {activeTab === 'aprovados' && setor === 'GRAFICA_EXPRESSA' && q.order && q.order.setor === 'GRAFICA_EXPRESSA' && q.order.status_os !== 'EM_IMPRESSAO' && (
                            <button
                              onClick={(e) => handleEnviarParaImpressao(e, q)}
                              disabled={sendingPrintJobId === q.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Enviar para impressao"
                            >
                              {sendingPrintJobId === q.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Printer className="w-3.5 h-3.5" />
                              )}
                              Impressao
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewQuoteModal
          setor={setor}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}


      {selectedId !== null && (
        <QuoteDrawer
          quoteId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchQuotes}
          setor={setor}
        />
      )}

      {selectedFinanceId !== null && (
        <FinanceDrawer
          quoteId={selectedFinanceId}
          onClose={() => setSelectedFinanceId(null)}
          onUpdated={fetchQuotes}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {deleteTargetQuote && (
        <DeleteQuoteModal
          quoteId={deleteTargetQuote.id}
          quoteCode={deleteTargetQuote.codigo_orcamento ?? `#${deleteTargetQuote.id}`}
          quoteStatus={deleteTargetQuote.status}
          onClose={() => setDeleteTargetQuote(null)}
          onDeleted={() => {
            setDeleteTargetQuote(null);
            fetchQuotes();
          }}
          onToast={setToast}
        />
      )}
    </div>
  );
}
