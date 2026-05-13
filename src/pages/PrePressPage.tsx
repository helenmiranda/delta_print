import { useEffect, useState } from 'react';
import { Loader2, Printer, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import PrePressDrawer from '../components/PrePressDrawer';
import PrintProofsTable from '../components/PrintProofsTable';
import ProofRequestModal from '../components/ProofRequestModal';
import LastUpdated from '../components/LastUpdated';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface PrePressOrder {
  id: number;
  codigo_os: string;
  status_os: string;
  updated_at: string;
  quote: {
    id: number;
    cliente_nome: string;
    vendedor_nome: string | null;
    prioridade: string;
  } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type TabType = 'pre-impressao' | 'provas';

export default function PrePressPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pre-impressao');
  const [orders, setOrders] = useState<PrePressOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [showNewProofModal, setShowNewProofModal] = useState(false);
  const [filterPeriodoPrePress, setFilterPeriodoPrePress] = useState<string>('30dias');
  const [filterPeriodo, setFilterPeriodo] = useState<string>('30dias');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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

  async function fetchOrders() {
    setLoading(true);
    const dateFilter = getDateFilter(filterPeriodoPrePress);

    let query = supabase
      .from('orders')
      .select(`
        id,
        codigo_os,
        status_os,
        updated_at,
        quote:quotes (
          id,
          cliente_nome,
          vendedor_nome,
          prioridade
        )
      `)
      .eq('status_os', 'EM_PRE_IMPRESSAO');

    if (dateFilter) {
      query = query.gte('updated_at', dateFilter);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setOrders(data as PrePressOrder[]);
    }
    setLoading(false);
    setLastUpdated(new Date());
  }

  function handleRefreshProofs() {
    setRefreshTrigger(prev => prev + 1);
  }

  function handleProofCreated() {
    setRefreshTrigger(prev => prev + 1);
  }

  useEffect(() => {
    fetchOrders();
  }, [filterPeriodoPrePress]);

  useAutoRefresh(() => {
    fetchOrders();
    setRefreshTrigger(prev => prev + 1);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
              <img src="/asset_1.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {activeTab === 'pre-impressao' && (
              <div className="flex items-center gap-3">
                <select
                  value={filterPeriodoPrePress}
                  onChange={(e) => setFilterPeriodoPrePress(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="90dias">Últimos 90 dias</option>
                  <option value="mes_atual">Este mês</option>
                  <option value="todos">Todos</option>
                </select>
                <LastUpdated timestamp={lastUpdated} />
                <button onClick={fetchOrders} className="btn-ghost text-sm" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('pre-impressao')}
              className={`px-6 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'pre-impressao'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Pre-Impressao
            </button>
            <button
              onClick={() => setActiveTab('provas')}
              className={`px-6 py-3 text-sm font-medium transition-all relative ${
                activeTab === 'provas'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Provas
            </button>
          </div>
        </div>

        <div className="mb-8">
          {activeTab === 'pre-impressao' ? (
            <>
              <h1 className="section-title">Pre-Impressao</h1>
              <p className="text-body mt-1">Ordens de servico aguardando preparacao para producao.</p>
            </>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="section-title">Provas de Impressão</h1>
                <p className="text-body mt-1">Gerencie as solicitações de provas de impressão</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={filterPeriodo}
                  onChange={(e) => setFilterPeriodo(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="7dias">Últimos 7 dias</option>
                  <option value="30dias">Últimos 30 dias</option>
                  <option value="90dias">Últimos 90 dias</option>
                  <option value="mes_atual">Este mês</option>
                  <option value="todos">Todos</option>
                </select>
                <button onClick={handleRefreshProofs} className="btn-ghost text-sm">
                  <RefreshCw className="w-4 h-4" />
                  Atualizar
                </button>
                <button onClick={() => setShowNewProofModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Nova prova
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'pre-impressao' ? (
          <div className="glass-card overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-glass bg-primary-50 flex items-center justify-center mb-4">
                  <Printer className="w-7 h-7 text-primary-400" />
                </div>
                <p className="text-gray-600 font-medium">Nenhuma OS em pre-impressao</p>
                <p className="text-body mt-1">Ordens de servico enviadas para pre-impressao aparecerao aqui.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Codigo OS</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Cliente</th>
                      <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">Vendedor</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Prioridade</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Status</th>
                      <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Atualizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="border-b border-gray-50 last:border-0 transition-colors hover:bg-white/50 cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-primary-500">
                            {order.codigo_os}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-800 font-medium">
                            {order.quote?.cliente_nome || '—'}
                          </span>
                        </td>
                        <td className="col-iframe-hide px-6 py-4 hidden sm:table-cell">
                          <span className="text-sm text-gray-600">
                            {order.quote?.vendedor_nome || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {order.quote && <PriorityBadge priority={order.quote.prioridade} />}
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <StatusBadge status={order.status_os} />
                        </td>
                        <td className="col-iframe-hide px-6 py-4 hidden lg:table-cell">
                          <span className="text-sm text-gray-500">{formatDate(order.updated_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <PrintProofsTable filterPeriodo={filterPeriodo} refreshTrigger={refreshTrigger} />
        )}
      </div>

      {selectedOrderId !== null && (
        <PrePressDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={fetchOrders}
        />
      )}

      {showNewProofModal && (
        <ProofRequestModal
          onClose={() => setShowNewProofModal(false)}
          onSuccess={handleProofCreated}
        />
      )}
    </div>
  );
}
