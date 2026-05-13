// Hook para buscar todas as etiquetas (labels) disponíveis para cards de design
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DesignLabel } from '../types/design.types';

interface UseDesignLabelsResult {
  labels: DesignLabel[];
  loading: boolean;
}

export function useDesignLabels(): UseDesignLabelsResult {
  const [labels, setLabels] = useState<DesignLabel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLabels() {
      setLoading(true);

      const { data, error } = await supabase
        .from('design_labels')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[useDesignLabels]', error);
      } else {
        setLabels(data ?? []);
      }

      setLoading(false);
    }

    fetchLabels();
  }, []);

  return { labels, loading };
}
