// Hook principal do Kanban — gerencia cards com Realtime do Supabase
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignCard, DesignLabel } from '../types/design.types';

// Dados necessários para criar um novo card
export interface CreateCardData {
  column_id: string;
  title: string;
  cliente_nome: string;
  cliente_telefone?: string;
  requested_by: string;
  requested_by_name: string;
  priority?: 'baixa' | 'media' | 'alta' | 'urgente';
  due_date?: string | null;
  description?: string;
}

interface UseDesignCardsResult {
  cards: DesignCard[];
  loading: boolean;
  createCard: (data: CreateCardData) => Promise<void>;
  updateCard: (id: string, changes: Partial<DesignCard>) => Promise<void>;
  moveCard: (
    cardId: string,
    newColumnId: string,
    newPosition: number,
    actorEmail: string,
    actorName: string
  ) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  archiveCard: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// Busca as labels associadas a um card via tabela de junção
async function fetchLabelsForCard(cardId: string): Promise<DesignLabel[]> {
  const { data } = await supabase
    .from('design_card_labels')
    .select('design_labels(id, name, color)')
    .eq('card_id', cardId);

  if (!data) return [];

  // Extrair o objeto label de dentro do join
  return data
    .map((row: { design_labels: DesignLabel | null }) => row.design_labels)
    .filter((l): l is DesignLabel => l !== null);
}

// Busca a contagem de comentários de um card
async function fetchCommentsCount(cardId: string): Promise<number> {
  const { count } = await supabase
    .from('design_comments')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  return count ?? 0;
}

// Busca a contagem de anexos de um card
async function fetchAttachmentsCount(cardId: string): Promise<number> {
  const { count } = await supabase
    .from('design_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  return count ?? 0;
}

// Monta um card completo com labels e contagens
async function buildFullCard(raw: DesignCard): Promise<DesignCard> {
  const [labels, comments_count, attachments_count] = await Promise.all([
    fetchLabelsForCard(raw.id),
    fetchCommentsCount(raw.id),
    fetchAttachmentsCount(raw.id),
  ]);

  return { ...raw, labels, comments_count, attachments_count };
}

export function useDesignCards(): UseDesignCardsResult {
  const [cards, setCards] = useState<DesignCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca todos os cards ativos (não arquivados)
  const fetchCards = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('design_cards')
      .select('*')
      .eq('is_archived', false)
      .order('position', { ascending: true });

    if (error) {
      console.error('[useDesignCards] fetchCards error:', error);
      setLoading(false);
      return;
    }

    // Enriquecer cada card com labels e contagens em paralelo
    const full = await Promise.all((data ?? []).map(buildFullCard));
    setCards(full);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCards();

    // Escuta mudanças em tempo real na tabela design_cards
    const channel = supabase
      .channel('design_cards_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'design_cards' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Novo card: adicionar ao estado com dados completos
            const full = await buildFullCard(payload.new as DesignCard);
            setCards((prev) => {
              // Evitar duplicatas
              if (prev.some((c) => c.id === full.id)) return prev;
              return [...prev, full].sort((a, b) => a.position - b.position);
            });
          } else if (payload.eventType === 'UPDATE') {
            // Card atualizado: substituir no estado
            const updated = payload.new as DesignCard;
            if (updated.is_archived) {
              // Se arquivado, remover da lista
              setCards((prev) => prev.filter((c) => c.id !== updated.id));
            } else {
              setCards((prev) =>
                prev.map((c) =>
                  c.id === updated.id
                    ? { ...c, ...updated }
                    : c
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            // Card removido: tirar do estado
            setCards((prev) => prev.filter((c) => c.id !== (payload.old as DesignCard).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCards]);

  // Criar um novo card na coluna especificada
  const createCard = useCallback(async (data: CreateCardData) => {
    // Calcular a próxima posição dentro da coluna
    const cardsInColumn = cards.filter((c) => c.column_id === data.column_id);
    const maxPos = cardsInColumn.reduce((max, c) => Math.max(max, c.position), 0);

    const { data: inserted, error } = await supabase
      .from('design_cards')
      .insert({
        column_id: data.column_id,
        title: data.title,
        cliente_nome: data.cliente_nome,
        cliente_telefone: data.cliente_telefone || null,
        requested_by: data.requested_by,
        requested_by_name: data.requested_by_name,
        position: maxPos + 1,
        is_archived: false,
        priority: data.priority ?? 'media',
        due_date: data.due_date ?? null,
        description: data.description ?? null,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[useDesignCards] createCard error:', error);
      return;
    }

    if (inserted) {
      // Registrar atividade de criação no log
      await supabase.from('design_activity_log').insert({
        card_id: inserted.id,
        actor_email: data.requested_by,
        actor_name: data.requested_by_name,
        action: 'card_created',
        details: { column_id: data.column_id, title: data.title },
      });
    }
  }, [cards]);

  // Atualizar campos de um card existente
  const updateCard = useCallback(async (id: string, changes: Partial<DesignCard>) => {
    const { error } = await supabase
      .from('design_cards')
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[useDesignCards] updateCard error:', error);
    }
  }, []);

  // Mover card para outra coluna ou reordenar dentro da mesma coluna
  const moveCard = useCallback(async (
    cardId: string,
    newColumnId: string,
    newPosition: number,
    actorEmail: string,
    actorName: string
  ) => {
    const card = cards.find((c) => c.id === cardId);
    const oldColumnId = card?.column_id;

    const { error } = await supabase
      .from('design_cards')
      .update({
        column_id: newColumnId,
        position: newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId);

    if (error) {
      console.error('[useDesignCards] moveCard error:', error);
      return;
    }

    // Registrar no log apenas se mudou de coluna
    if (oldColumnId && oldColumnId !== newColumnId) {
      await supabase.from('design_activity_log').insert({
        card_id: cardId,
        actor_email: actorEmail,
        actor_name: actorName,
        action: 'card_moved',
        details: {
          from_column: oldColumnId,
          to_column: newColumnId,
        },
      });
    }
  }, [cards]);

  // Deletar permanentemente um card
  const deleteCard = useCallback(async (id: string) => {
    const { error } = await supabase.from('design_cards').delete().eq('id', id);
    if (error) {
      console.error('[useDesignCards] deleteCard error:', error);
    }
  }, []);

  // Arquivar um card (soft delete)
  const archiveCard = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('design_cards')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[useDesignCards] archiveCard error:', error);
    }
  }, []);

  return {
    cards,
    loading,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    archiveCard,
    refetch: fetchCards,
  };
}
