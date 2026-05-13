// Modal de histórico — exibe todos os cards finalizados (is_archived = true)
// com busca, filtros de período/atendente, paginação e acesso ao CardModal em modo leitura
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Clock, Search, ChevronDown, Inbox, Loader2, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useDesignHistory,
  EMPTY_HISTORY_FILTERS,
  type HistoryFilters,
} from '../../hooks/useDesignHistory';
import type { DesignCard, DesignColumn } from '../../types/design.types';
import CardModal from './CardModal';

interface HistoryModalProps {
  columns: DesignColumn[];
  userEmail: string;
  userName: string;
  onClose: () => void;
}

const PERIOD_OPTIONS: { value: HistoryFilters['period']; label: string }[] = [
  { value: 'all', label: 'Todos os períodos' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 3 meses' },
];

// Extrai lista única de atendentes dos cards
function getUniqueAtendentes(cards: DesignCard[]): string[] {
  const names = cards
    .map((c) => c.requested_by_name)
    .filter((n): n is string => Boolean(n));
  return Array.from(new Set(names)).sort();
}

export default function HistoryModal({ columns, userEmail, userName, onClose }: HistoryModalProps) {
  const { archivedCards, loading, totalCount, hasMore, loadMore, fetchHistory, reopenCard } =
    useDesignHistory();

  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<HistoryFilters['period']>('all');
  const [atendente, setAtendente] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animação de entrada
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Carrega dados na abertura
  useEffect(() => {
    fetchHistory(EMPTY_HISTORY_FILTERS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce na busca textual
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchHistory({ search, period, atendente });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, period, atendente]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  // Coluna "Solicita" — primeira coluna com slug 'solicita' ou a primeira disponível
  const solicitaColumn = columns.find((c) => c.slug === 'solicita') ?? columns[0];

  const handleReopen = useCallback(async (cardId: string) => {
    if (!solicitaColumn) return;
    setReopening(cardId);
    await reopenCard(cardId, solicitaColumn.id, userEmail, userName);
    setReopening(null);
    setSelectedCardId(null);
  }, [solicitaColumn, reopenCard, userEmail, userName]);

  const uniqueAtendentes = getUniqueAtendentes(archivedCards);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: `rgba(0,0,0,${visible ? 0.45 : 0})`,
          transition: 'background 0.2s ease-out',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full"
          style={{
            maxWidth: '900px',
            maxHeight: '85vh',
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
          }}
        >
          {/* Header do modal */}
          <div
            className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid #e2e8f0' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f0f6ff' }}
              >
                <Clock className="w-5 h-5" style={{ color: '#3D4465' }} />
              </div>
              <div>
                <h2
                  className="font-bold text-gray-800"
                  style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px' }}
                >
                  Histórico de Trabalhos
                </h2>
                <p className="text-gray-400" style={{ fontSize: '12px' }}>
                  {loading ? 'Carregando...' : `${totalCount} trabalho${totalCount !== 1 ? 's' : ''} finalizado${totalCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de filtros */}
          <div
            className="flex-shrink-0 px-6 py-3 flex flex-wrap items-center gap-3"
            style={{ borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}
          >
            {/* Campo de busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título ou cliente..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none transition-colors"
                style={{ borderColor: '#e2e8f0', fontSize: '13px' }}
                onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            {/* Filtro por período */}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as HistoryFilters['period'])}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm outline-none bg-white transition-colors"
                style={{ borderColor: '#e2e8f0', fontSize: '13px', color: '#374151' }}
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Filtro por atendente */}
            <div className="relative">
              <select
                value={atendente}
                onChange={(e) => setAtendente(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border text-sm outline-none bg-white transition-colors"
                style={{ borderColor: '#e2e8f0', fontSize: '13px', color: '#374151' }}
              >
                <option value="">Todos os atendentes</option>
                {uniqueAtendentes.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Corpo com scroll */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : archivedCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Inbox className="w-12 h-12 text-gray-200 mb-3" />
                <p className="font-medium text-gray-500">Nenhum trabalho finalizado ainda</p>
                <p className="text-gray-400 text-sm mt-1">
                  Os trabalhos finalizados aparecerão aqui.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Título</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Atendente</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Designer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Criado em</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Finalizado em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {archivedCards.map((card, idx) => (
                    <HistoryRow
                      key={card.id}
                      card={card}
                      isEven={idx % 2 === 0}
                      reopening={reopening === card.id}
                      onOpen={() => setSelectedCardId(card.id)}
                      onReopen={() => handleReopen(card.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}

            {/* Botão carregar mais */}
            {hasMore && !loading && (
              <div className="flex justify-center py-4">
                <button
                  onClick={loadMore}
                  className="px-5 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ borderColor: '#e2e8f0' }}
                >
                  Carregar mais
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CardModal em modo somente leitura para o card selecionado */}
      {selectedCardId && (
        <CardModal
          cardId={selectedCardId}
          columns={columns}
          userEmail={userEmail}
          userName={userName}
          readOnly
          onClose={() => setSelectedCardId(null)}
          onCardUpdated={() => {}}
          onReopenCard={handleReopen}
        />
      )}
    </>
  );
}

// Linha individual da tabela de histórico
interface HistoryRowProps {
  card: DesignCard;
  isEven: boolean;
  reopening: boolean;
  onOpen: () => void;
  onReopen: () => void;
}

function HistoryRow({ card, isEven, reopening, onOpen, onReopen }: HistoryRowProps) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer transition-colors hover:bg-blue-50"
      style={{ background: isEven ? '#ffffff' : '#fafbfc', borderBottom: '1px solid #f1f5f9' }}
    >
      {/* Título + labels */}
      <td className="px-4 py-3">
        <p className="font-medium text-gray-800" style={{ fontSize: '13px' }}>{card.title}</p>
        {card.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {card.labels.map((label) => (
              <span
                key={label.id}
                className="inline-block px-1.5 py-0.5 rounded-full text-white font-medium"
                style={{ background: label.color, fontSize: '10px' }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Cliente */}
      <td className="px-4 py-3 hidden md:table-cell">
        <p className="font-medium text-gray-700" style={{ fontSize: '13px' }}>
          {card.cliente_nome ?? <span className="text-gray-400 italic">—</span>}
        </p>
        {card.cliente_telefone && (
          <p className="text-gray-400" style={{ fontSize: '11px' }}>{card.cliente_telefone}</p>
        )}
      </td>

      {/* Atendente */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-gray-600" style={{ fontSize: '12px' }}>
          {card.requested_by_name ?? <span className="text-gray-400 italic">—</span>}
        </span>
      </td>

      {/* Designer */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-gray-600" style={{ fontSize: '12px' }}>
          {card.assigned_to_name ?? <span className="text-gray-400 italic">—</span>}
        </span>
      </td>

      {/* Criado em */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-gray-500" style={{ fontSize: '12px' }}>
          {format(parseISO(card.created_at), 'dd/MM/yy', { locale: ptBR })}
        </span>
      </td>

      {/* Finalizado em (updated_at após is_archived = true) */}
      <td className="px-4 py-3">
        <span className="text-gray-500" style={{ fontSize: '12px' }}>
          {format(parseISO(card.updated_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
        </span>
      </td>

      {/* Botão reabrir */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onReopen}
          disabled={reopening}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
          style={{ borderColor: '#e2e8f0', whiteSpace: 'nowrap' }}
          title="Reabrir este trabalho"
        >
          {reopening ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">Reabrir</span>
        </button>
      </td>
    </tr>
  );
}
