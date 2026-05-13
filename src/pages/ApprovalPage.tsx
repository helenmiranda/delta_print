import { useEffect, useState } from 'react';
import { FileText, Loader2, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import FinanceDrawer from '../components/FinanceDrawer';
import Toast from '../components/Toast';

interface ApprovalQuote {
  id: number;
  codigo_orcamento: string | null;
  cliente_nome: string;
  status: string;
  aprovado_valor_total: number | null;
  created_at: string;
  order?: {
    id: number;
    codigo_os: string;
    status_os: string;
  } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(v: number | null) {
  if (v == null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function ApprovalPage() {
  const [quotes, setQuotes] = useState<ApprovalQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sendingToPrePress, setSendingToPrePress] = useState<number | null>(null);

  async function fetchQuotes() {
    setLoading(true);
    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select('id, codigo_orcamento, cliente_nome, status, aprovado_valor_total, created_at')
      .in('status', ['APROVADO_CLIENTE', 'OS_GERADA'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!quotesError && quotesData) {
      const quotesWithOrders = await Promise.all(
        quotesData.map(async (quote) => {
          if (quote.status === 'OS_GERADA') {
            const { data: orderData } = await supabase
              .from('orders')
              .select('id, codigo_os, status_os')
              .eq('quote_id', quote.id)
              .maybeSingle();

            return { ...quote, order: orderData };
          }
          return { ...quote, order: null };
        })
      );

      setQuotes(quotesWithOrders);
    }
    setLoading(false);
  }

  async function sendToPrePress(orderId: number) {
    setSendingToPrePress(orderId);

    const { error } = await supabase
      .from('orders')
      .update({ status_os: 'EM_PRE_IMPRESSAO' })
      .eq('id', orderId);

    if (error) {
      setToast({ message: 'Erro ao enviar para pré-impressão', type: 'error' });
    } else {
      setToast({ message: 'Enviado para pré-impressão', type: 'success' });
      await fetchQuotes();
    }

    setSendingToPrePress(null);
  }

  useEffect(() => {
    fetchQuotes();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="section-title">Aprovacao / Financeiro & OS</h1>
            <p className="text-body mt-1">Gerencie pagamentos e ordens de servico dos orcamentos aprovados.</p>
          </div>
          <button onClick={fetchQuotes} className="btn-ghost text-sm self-start" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        <div className="glass-card overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-glass bg-primary-50 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-primary-400" />
              </div>
              <p className="text-gray-600 font-medium">Nenhum orcamento aprovado encontrado</p>
              <p className="text-body mt-1">Orcamentos aprovados aparecerao aqui automaticamente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Codigo</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Cliente</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">Valor aprovado</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Data</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4 min-w-[220px]">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr
                      key={q.id}
                      className="border-b border-gray-50 last:border-0 transition-colors hover:bg-white/50"
                    >
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedId(q.id)}
                      >
                        <span className="text-sm font-medium text-primary-500">
                          {q.codigo_orcamento ?? `#${q.id}`}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedId(q.id)}
                      >
                        <span className="text-sm text-gray-800 font-medium">{q.cliente_nome}</span>
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedId(q.id)}
                      >
                        <StatusBadge status={q.status} />
                      </td>
                      <td
                        className="px-6 py-4 hidden sm:table-cell cursor-pointer"
                        onClick={() => setSelectedId(q.id)}
                      >
                        <span className="text-sm font-semibold text-gray-700">{formatCurrency(q.aprovado_valor_total)}</span>
                      </td>
                      <td
                        className="px-6 py-4 hidden md:table-cell cursor-pointer"
                        onClick={() => setSelectedId(q.id)}
                      >
                        <span className="text-sm text-gray-500">{formatDate(q.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 min-w-[220px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(q.id);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Ver Financeiro
                          </button>
                          {q.status === 'OS_GERADA' && q.order && q.order.status_os === 'GERADA' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sendToPrePress(q.order!.id);
                              }}
                              disabled={sendingToPrePress === q.order.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                              {sendingToPrePress === q.order.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  Enviar para Pre-Impressao
                                </>
                              )}
                            </button>
                          )}
                          {q.status === 'OS_GERADA' && q.order && q.order.status_os !== 'GERADA' && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              {q.order.status_os.replace(/_/g, ' ')}
                            </div>
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

      {selectedId !== null && (
        <FinanceDrawer
          quoteId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchQuotes}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
