/*
  # Add soft delete columns to quotes table

  ## Summary
  Adds soft delete support to the `quotes` table without removing any data.

  ## Changes
  ### Modified Table: `quotes`
  - `deleted_at` (timestamptz, nullable): Timestamp when the quote was soft-deleted. NULL means active.
  - `deleted_reason` (text, nullable): The reason provided by the user when deleting the quote.

  ## Notes
  - No data is ever physically deleted. Setting `deleted_at` hides the quote from all listings.
  - All queries should filter with `.is('deleted_at', null)` to exclude deleted quotes.
  - No RLS changes needed; existing policies cover these new columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'deleted_reason'
  ) THEN
    ALTER TABLE quotes ADD COLUMN deleted_reason text DEFAULT NULL;
  END IF;
END $$;
