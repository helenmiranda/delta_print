import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Loader2, Search, X, AlertCircle, Clock, CheckCircle2, TicketIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NewTicketModal from '../components/NewTicketModal';
import TicketDrawer from '../components/TicketDrawer';
import Toast from '../components/Toast';

interface Ticket {
  id: number;
  titulo: string;
  categoria: string;
  status: string;
  prioridade: string;
  reportado_por_nome: string;
  reportado_por_email: string;
  resolvido_por_nome: string | null;
  resolvido_em: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  aberto: { label: 'Aberto', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  em_andamento: { label: 'Em andamento', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  resolvido: { label: 'Resolvido', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'text-gray-500' },
  media: { label: 'Média', color: 'text-blue-600' },
  alta: { label: 'Alta', color: 'text-orange-600' },
  urgente: { label: 'Urgente', color: 'text-red-600' },
};

const CATEGORIA_LABELS: Record<string, string> = {
  bug: 'Bug / Erro',
  melhoria: 'Melhoria',
  duvida: 'Dúvida',
  outro: 'Outro',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso) : new Date();
  const diffMs = end.getTime() - new Date(startIso).getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function calcAvgResolutionTime(tickets: Ticket[]): string {
  const resolved = tickets.filter((t) => t.status === 'resolvido' && t.resolvido_em);
  if (resolved.length === 0) return '—';

  const totalMs = resolved.reduce((acc, t) => {
    return acc + (new Date(t.resolvido_em!).getTime() - new Date(t.created_at).getTime());
  }, 0);

  const avgMs = totalMs / resolved.length;
  const totalMinutes = Math.floor(avgMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${totalMinutes}min`;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  const [search, setSearch] = useState('');

  async function fetchTickets() {
    setLoading(true);
    const { data, error } = await supabase
      .from('tickets')
      .select('id, titulo, categoria, status, prioridade, reportado_por_nome, reportado_por_email, resolvido_por_nome, resolvido_em, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) setTickets(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchTickets();
  }, []);

  const filtered = tickets.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCategoria && t.categoria !== filterCategoria) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.titulo.toLowerCase().includes(q) && !t.reportado_por_nome.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const countAbertos = tickets.filter((t) => t.status === 'aberto').length;
  const countAndamento = tickets.filter((t) => t.status === 'em_andamento').length;
  const countResolvidos = tickets.filter((t) => t.status === 'resolvido').length;
  const avgTime = calcAvgResolutionTime(tickets);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3">
        <img src="/asset_1.svg" alt="Anexus Digital" className="h-6" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="section-title">Tickets</h1>
            <p className="text-body mt-1">Reporte e acompanhe erros e melhorias do sistema.</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button onClick={fetchTickets} className="btn-ghost text-sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Abrir Ticket
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card-static px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-red-50">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
              </div>
              <span className="text-xs text-gray-500">Abertos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{countAbertos}</p>
          </div>

          <div className="glass-card-static px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-yellow-50">
                <Clock className="w-3.5 h-3.5 text-yellow-600" />
              </div>
              <span className="text-xs text-gray-500">Em andamento</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{countAndamento}</p>
          </div>

          <div className="glass-card-static px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-green-50">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-xs text-gray-500">Resolvidos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{countResolvidos}</p>
          </div>

          <div className="glass-card-static px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-full bg-blue-50">
                <TicketIcon className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-xs text-gray-500">Tempo médio</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgTime}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="glass-card-static px-4 py-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                className="input-field w-full pl-8"
                placeholder="Buscar por título ou autor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>

            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="aberto">Aberto</option>
              <option value="em_andamento">Em andamento</option>
              <option value="resolvido">Resolvido</option>
            </select>

            <select
              className="input-field"
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
            >
              <option value="">Todas categorias</option>
              <option value="bug">Bug / Erro</option>
              <option value="melhoria">Melhoria</option>
              <option value="duvida">Dúvida</option>
              <option value="outro">Outro</option>
            </select>

            {(filterStatus || filterCategoria || search) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterCategoria(''); setSearch(''); }}
                className="btn-ghost text-xs text-gray-500"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Tabela */}
        <div className="glass-card-static overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <TicketIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Nenhum ticket encontrado.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Título</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 col-iframe-hide">Categoria</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 col-iframe-hide">Prioridade</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 col-iframe-hide">Reportado por</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 col-iframe-hide">Aberto em</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => {
                  const statusCfg = STATUS_CONFIG[ticket.status];
                  const prioCfg = PRIORIDADE_CONFIG[ticket.prioridade];
                  const tempoLabel = ticket.status === 'resolvido'
                    ? formatDuration(ticket.created_at, ticket.resolvido_em)
                    : formatDuration(ticket.created_at, null);

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedId(ticket.id)}
                      className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{ticket.id}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-800 line-clamp-1">{ticket.titulo}</span>
                      </td>
                      <td className="px-4 py-3 col-iframe-hide">
                        <span className="text-xs text-gray-500">{CATEGORIA_LABELS[ticket.categoria] ?? ticket.categoria}</span>
                      </td>
                      <td className="px-4 py-3 col-iframe-hide">
                        <span className={`text-xs font-medium ${prioCfg?.color}`}>{prioCfg?.label}</span>
                      </td>
                      <td className="px-4 py-3 col-iframe-hide">
                        <span className="text-xs text-gray-600">{ticket.reportado_por_nome}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg?.bg} ${statusCfg?.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg?.dot}`} />
                          {statusCfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 col-iframe-hide">
                        <span className="text-xs text-gray-500">{formatDate(ticket.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium tabular-nums ${ticket.status === 'resolvido' ? 'text-green-600' : 'text-gray-500'}`}>
                          {tempoLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-2 text-right">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {showModal && (
        <NewTicketModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            fetchTickets();
            setToast('Ticket aberto com sucesso!');
          }}
        />
      )}

      {selectedId !== null && (
        <TicketDrawer
          ticketId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchTickets}
        />
      )}

      {toast && (
        <Toast
          message={toast}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}
