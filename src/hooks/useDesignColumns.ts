// Hook para buscar as colunas do Kanban de design no Supabase
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignColumn } from '../types/design.types';

interface UseDesignColumnsResult {
  columns: DesignColumn[];
  loading: boolean;
  error: string | null;
}

export function useDesignColumns(): UseDesignColumnsResult {
  const [columns, setColumns] = useState<DesignColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchColumns() {
      setLoading(true);
      setError(null);

      // Buscar apenas colunas ativas, ordenadas pela posição definida no banco
      const { data, error: fetchError } = await supabase
        .from('design_columns')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (fetchError) {
        setError('Erro ao carregar colunas do Kanban.');
        console.error('[useDesignColumns]', fetchError);
      } else {
        setColumns(data ?? []);
      }

      setLoading(false);
    }

    fetchColumns();
  }, []);

  return { columns, loading, error };
}
