/*
  # Add setor column to orders table

  ## Summary
  Adds a `setor` column to the `orders` table so each OS inherits
  the sector of its originating quote.

  ## Changes
  - `orders` table: new nullable TEXT column `setor`
    - Accepted values: 'GRAFICA_EXPRESSA', 'GRAFICA_INDUSTRIAL'
    - Nullable to remain compatible with any pre-existing rows

  ## Notes
  - No default is set intentionally; existing rows may have NULL and
    backfill is handled separately via SQL if needed.
  - No destructive operations are performed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'setor'
  ) THEN
    ALTER TABLE orders ADD COLUMN setor text;
  END IF;
END $$;
