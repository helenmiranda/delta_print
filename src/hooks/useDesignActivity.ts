// Hook para buscar e escutar o log de atividades de um card em tempo real
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignActivityLog } from '../types/design.types';

const PAGE_SIZE = 20;

interface UseDesignActivityResult {
  activities: DesignActivityLog[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  createLog: (
    cardId: string,
    actorEmail: string,
    actorName: string,
    action: string,
    details?: Record<string, unknown>
  ) => Promise<void>;
}

export function useDesignActivity(cardId: string): UseDesignActivityResult {
  const [activities, setActivities] = useState<DesignActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  // Ref para o offset atual (evita closure stale em loadMore)
  const offsetRef = useRef(0);

  // Busca os logs mais recentes do card (paginação por offset)
  const fetchActivities = useCallback(async (reset = true) => {
    if (!cardId) return;
    if (reset) setLoading(true);

    const currentOffset = reset ? 0 : offsetRef.current;

    const { data, error, count } = await supabase
      .from('design_activity_log')
      .select('*', { count: 'exact' })
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (error) {
      console.error('[useDesignActivity] fetchActivities error:', error);
      if (reset) setLoading(false);
      return;
    }

    const newItems = data ?? [];

    if (reset) {
      setActivities(newItems);
      offsetRef.current = newItems.length;
    } else {
      setActivities((prev) => [...prev, ...newItems]);
      offsetRef.current = currentOffset + newItems.length;
    }

    // Verificar se ainda há mais registros além do que foi carregado
    setHasMore((count ?? 0) > offsetRef.current);

    if (reset) setLoading(false);
  }, [cardId]);

  useEffect(() => {
    fetchActivities(true);

    if (!cardId) return;

    // Subscription Realtime: escuta novos logs inseridos para este card específico
    const channel = supabase
      .channel(`design_activity_log_${cardId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'design_activity_log',
          filter: `card_id=eq.${cardId}`,
        },
        (payload) => {
          const newLog = payload.new as DesignActivityLog;
          // Adicionar no topo (mais recente primeiro), evitando duplicatas
          setActivities((prev) => {
            if (prev.some((a) => a.id === newLog.id)) return prev;
            return [newLog, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Carrega mais atividades (página seguinte)
  const loadMore = useCallback(async () => {
    await fetchActivities(false);
  }, [fetchActivities]);

  // Insere um novo registro de atividade no banco
  const createLog = useCallback(
    async (
      cardId: string,
      actorEmail: string,
      actorName: string,
      action: string,
      details?: Record<string, unknown>
    ) => {
      const { error } = await supabase.from('design_activity_log').insert({
        card_id: cardId,
        actor_email: actorEmail,
        actor_name: actorName,
        action,
        details: details ?? null,
      });

      if (error) {
        console.error('[useDesignActivity] createLog error:', error);
      }
    },
    []
  );

  return { activities, loading, hasMore, loadMore, createLog };
}
