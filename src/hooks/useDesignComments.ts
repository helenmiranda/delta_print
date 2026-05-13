// Hook para gerenciar comentários de um card com suporte a Realtime do Supabase
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignComment } from '../types/design.types';

interface UseDesignCommentsResult {
  comments: DesignComment[];
  loading: boolean;
  addComment: (content: string, authorEmail: string, authorName: string) => Promise<void>;
}

export function useDesignComments(cardId: string): UseDesignCommentsResult {
  const [comments, setComments] = useState<DesignComment[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca comentários ordenados por data de criação (mais antigo primeiro)
  const fetchComments = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('design_comments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[useDesignComments] fetchComments error:', error);
    } else {
      setComments(data ?? []);
    }

    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    fetchComments();

    if (!cardId) return;

    // Subscrição Realtime: escuta novos comentários inseridos no card
    const channel = supabase
      .channel(`design_comments_${cardId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'design_comments',
          filter: `card_id=eq.${cardId}`,
        },
        (payload) => {
          const newComment = payload.new as DesignComment;
          // Adicionar ao estado apenas se ainda não estiver presente (evita duplicata)
          setComments((prev) => {
            if (prev.some((c) => c.id === newComment.id)) return prev;
            return [...prev, newComment];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComments, cardId]);

  // Inserir novo comentário no banco
  const addComment = useCallback(
    async (content: string, authorEmail: string, authorName: string) => {
      if (!content.trim()) return;

      const { error } = await supabase.from('design_comments').insert({
        card_id: cardId,
        author_email: authorEmail,
        author_name: authorName,
        content: content.trim(),
        is_edited: false,
      });

      if (error) {
        console.error('[useDesignComments] addComment error:', error);
      }
      // Não precisa atualizar estado manualmente — o Realtime trata isso
    },
    [cardId]
  );

  return { comments, loading, addComment };
}
