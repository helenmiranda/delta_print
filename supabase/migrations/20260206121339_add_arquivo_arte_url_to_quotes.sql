/*
  # Add artwork file URL to quotes

  1. Modified Tables
    - `quotes`
      - Added `arquivo_arte_url` (text, nullable) - Optional URL for ready artwork file

  2. Notes
    - This is an optional field commonly used when clients provide their own artwork
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'arquivo_arte_url'
  ) THEN
    ALTER TABLE quotes ADD COLUMN arquivo_arte_url text;
  END IF;
END $$;
