/*
  # Adiciona campo origem à tabela quotes

  ## Motivo
  Permite identificar se o orçamento foi criado manualmente pelo time interno
  ou por um agente externo (automação/workflow).

  ## Mudanças
  - `origem` text DEFAULT 'MANUAL' — valores: 'MANUAL' | 'AGENTE'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'origem'
  ) THEN
    ALTER TABLE quotes ADD COLUMN origem text NOT NULL DEFAULT 'MANUAL';
  END IF;
END $$;
