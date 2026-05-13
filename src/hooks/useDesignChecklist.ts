// Hook para gerenciar itens de checklist de um card de design
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignChecklistItem } from '../types/design.types';

interface UseDesignChecklistResult {
  items: DesignChecklistItem[];
  loading: boolean;
  // Percentual de conclusão de 0 a 100
  progress: number;
  addItem: (title: string) => Promise<void>;
  toggleItem: (item: DesignChecklistItem, actorEmail: string) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
}

export function useDesignChecklist(cardId: string): UseDesignChecklistResult {
  const [items, setItems] = useState<DesignChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca todos os itens do card, ordenados por posição
  const fetchItems = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('design_checklist_items')
      .select('*')
      .eq('card_id', cardId)
      .order('position', { ascending: true });

    if (error) {
      console.error('[useDesignChecklist] fetchItems error:', error);
    } else {
      setItems(data ?? []);
    }

    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Calcula o percentual de itens concluídos (0–100)
  const progress =
    items.length === 0
      ? 0
      : Math.round((items.filter((i) => i.is_completed).length / items.length) * 100);

  // Adicionar novo item ao final da lista
  const addItem = useCallback(
    async (title: string) => {
      if (!title.trim()) return;

      // Próxima posição: maior posição atual + 1
      const maxPos = items.reduce((max, i) => Math.max(max, i.position), 0);

      const { data, error } = await supabase
        .from('design_checklist_items')
        .insert({
          card_id: cardId,
          title: title.trim(),
          is_completed: false,
          position: maxPos + 1,
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('[useDesignChecklist] addItem error:', error);
        return;
      }

      if (data) {
        // Atualização otimista: adicionar ao estado local imediatamente
        setItems((prev) => [...prev, data]);
      }
    },
    [cardId, items]
  );

  // Alternar estado de conclusão de um item
  const toggleItem = useCallback(
    async (item: DesignChecklistItem, actorEmail: string) => {
      const nowCompleted = !item.is_completed;

      // Atualização otimista: reflete na UI antes da resposta do servidor
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                is_completed: nowCompleted,
                completed_at: nowCompleted ? new Date().toISOString() : null,
                completed_by: nowCompleted ? actorEmail : null,
              }
            : i
        )
      );

      const { error } = await supabase
        .from('design_checklist_items')
        .update({
          is_completed: nowCompleted,
          completed_at: nowCompleted ? new Date().toISOString() : null,
          completed_by: nowCompleted ? actorEmail : null,
        })
        .eq('id', item.id);

      if (error) {
        console.error('[useDesignChecklist] toggleItem error:', error);
        // Reverter atualização otimista em caso de erro
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? item : i
          )
        );
      }
    },
    []
  );

  // Remover um item da lista
  const deleteItem = useCallback(async (itemId: string) => {
    // Atualização otimista: remover da UI antes da resposta
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    const { error } = await supabase
      .from('design_checklist_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('[useDesignChecklist] deleteItem error:', error);
      // Recarregar caso falhe
      fetchItems();
    }
  }, [fetchItems]);

  return { items, loading, progress, addItem, toggleItem, deleteItem };
}
