/*
  # Add orcamento_opcoes_json column to quotes table

  1. Changes
    - Add `orcamento_opcoes_json` column to `quotes` table
      - Type: jsonb (to store parsed PDF options from webhook)
      - Nullable: true (only populated after webhook processing)
      - Default: null

  2. Purpose
    - Store parsed budget options returned by external PDF processing webhook
    - Enable automatic pre-filling of approval description and total value
    - Improve user experience by showing structured options in approval modal
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'orcamento_opcoes_json'
  ) THEN
    ALTER TABLE quotes ADD COLUMN orcamento_opcoes_json jsonb DEFAULT null;
  END IF;
END $$;
