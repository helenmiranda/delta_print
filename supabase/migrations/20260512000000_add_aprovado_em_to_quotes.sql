-- Adiciona campo de data de aprovação pelo cliente na tabela quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'aprovado_em'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN aprovado_em timestamptz;
  END IF;
END $$;
