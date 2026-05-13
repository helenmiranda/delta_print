// Hook para buscar cards finalizados (arquivados) com filtros e paginação
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignCard, DesignLabel } from '../types/design.types';

const PAGE_SIZE = 20;

export interface HistoryFilters {
  search: string;
  period: 'all' | '7d' | '30d' | '90d';
  atendente: string;
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  search: '',
  period: 'all',
  atendente: '',
};

interface UseDesignHistoryResult {
  archivedCards: DesignCard[];
  loading: boolean;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  fetchHistory: (filters?: HistoryFilters) => Promise<void>;
  reopenCard: (cardId: string, solicitaColumnId: string, actorEmail: string, actorName: string) => Promise<boolean>;
  filters: HistoryFilters;
  setFilters: (f: HistoryFilters) => void;
}

// Busca as labels de um card
async function fetchLabelsForCard(cardId: string): Promise<DesignLabel[]> {
  const { data } = await supabase
    .from('design_card_labels')
    .select('design_labels(id, name, color)')
    .eq('card_id', cardId);
  if (!data) return [];
  return data
    .map((row: { design_labels: DesignLabel | null }) => row.design_labels)
    .filter((l): l is DesignLabel => l !== null);
}

// Calcula a data de corte com base no período
function getPeriodCutoff(period: HistoryFilters['period']): string | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === '7d') now.setDate(now.getDate() - 7);
  else if (period === '30d') now.setDate(now.getDate() - 30);
  else if (period === '90d') now.setDate(now.getDate() - 90);
  return now.toISOString();
}

export function useDesignHistory(): UseDesignHistoryResult {
  const [archivedCards, setArchivedCards] = useState<DesignCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFiltersState] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);

  // Monta a query base com os filtros aplicados
  function buildQuery(f: HistoryFilters, from: number) {
    let q = supabase
      .from('design_cards')
      .select('*', { count: 'exact' })
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (f.search.trim()) {
      q = q.or(`title.ilike.%${f.search.trim()}%,cliente_nome.ilike.%${f.search.trim()}%`);
    }

    if (f.atendente.trim()) {
      q = q.ilike('requested_by_name', `%${f.atendente.trim()}%`);
    }

    const cutoff = getPeriodCutoff(f.period);
    if (cutoff) {
      q = q.gte('updated_at', cutoff);
    }

    return q;
  }

  // Busca inicial (ou refetch com filtros)
  const fetchHistory = useCallback(async (newFilters?: HistoryFilters) => {
    const f = newFilters ?? filters;
    setLoading(true);

    const { data, error, count } = await buildQuery(f, 0);

    if (error) {
      console.error('[useDesignHistory] fetchHistory error:', error);
      setLoading(false);
      return;
    }

    const items = data ?? [];
    const withLabels = await Promise.all(
      items.map(async (card) => ({
        ...card,
        labels: await fetchLabelsForCard(card.id),
      }))
    );

    setArchivedCards(withLabels);
    setTotalCount(count ?? 0);
    setOffset(items.length);
    setHasMore((count ?? 0) > items.length);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Carrega mais itens (próxima página)
  const loadMore = useCallback(async () => {
    const { data, error, count } = await buildQuery(filters, offset);

    if (error) {
      console.error('[useDesignHistory] loadMore error:', error);
      return;
    }

    const items = data ?? [];
    const withLabels = await Promise.all(
      items.map(async (card) => ({
        ...card,
        labels: await fetchLabelsForCard(card.id),
      }))
    );

    setArchivedCards((prev) => [...prev, ...withLabels]);
    const newOffset = offset + items.length;
    setOffset(newOffset);
    setHasMore((count ?? 0) > newOffset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, offset]);

  // Reabrir um card arquivado — move de volta para a coluna "Solicita"
  const reopenCard = useCallback(async (
    cardId: string,
    solicitaColumnId: string,
    actorEmail: string,
    actorName: string
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('design_cards')
      .update({
        is_archived: false,
        column_id: solicitaColumnId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);

    if (error) {
      console.error('[useDesignHistory] reopenCard error:', error);
      return false;
    }

    await supabase.from('design_activity_log').insert({
      card_id: cardId,
      actor_email: actorEmail,
      actor_name: actorName,
      action: 'reopened',
      details: {
        reopened_at: new Date().toISOString(),
        reopened_by: actorName,
        moved_to_column: solicitaColumnId,
      },
    });

    // Remove o card da lista local
    setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
    setTotalCount((prev) => Math.max(0, prev - 1));

    return true;
  }, []);

  function setFilters(f: HistoryFilters) {
    setFiltersState(f);
  }

  return {
    archivedCards,
    loading,
    totalCount,
    hasMore,
    loadMore,
    fetchHistory,
    reopenCard,
    filters,
    setFilters,
  };
}
