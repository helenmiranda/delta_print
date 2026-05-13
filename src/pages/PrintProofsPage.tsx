import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import PrintProofsTable from '../components/PrintProofsTable';
import ProofRequestModal from '../components/ProofRequestModal';
import LastUpdated from '../components/LastUpdated';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

export default function PrintProofsPage() {
  const [showNewProofModal, setShowNewProofModal] = useState(false);
  const [filterPeriodo, setFilterPeriodo] = useState<string>('30dias');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function handleRefresh() {
    setRefreshTrigger(prev => prev + 1);
    setLastUpdated(new Date());
  }

  function handleProofCreated() {
    setRefreshTrigger(prev => prev + 1);
  }

  useAutoRefresh(() => {
    setRefreshTrigger(prev => prev + 1);
    setLastUpdated(new Date());
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
              <img src="/asset_1.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filterPeriodo}
                onChange={(e) => setFilterPeriodo(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="7dias">Últimos 7 dias</option>
                <option value="30dias">Últimos 30 dias</option>
                <option value="90dias">Últimos 90 dias</option>
                <option value="mes_atual">Mês atual</option>
                <option value="todos">Todos</option>
              </select>
              <LastUpdated timestamp={lastUpdated} />
              <button onClick={handleRefresh} className="btn-ghost text-sm">
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </button>
              <button onClick={() => setShowNewProofModal(true)} className="btn-primary">
                <Plus className="w-5 h-5" />
                Nova prova
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="section-title">Provas de Impressao</h1>
          <p className="text-body mt-1">Gerencie as solicitacoes de provas de impressao</p>
        </div>

        <PrintProofsTable filterPeriodo={filterPeriodo} refreshTrigger={refreshTrigger} />
      </div>

      {showNewProofModal && (
        <ProofRequestModal
          onClose={() => setShowNewProofModal(false)}
          onSuccess={handleProofCreated}
        />
      )}
    </div>
  );
}
