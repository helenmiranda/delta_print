/*
  # Add edit tracking fields to quote_comments

  1. Changes to `quote_comments`
    - `edited_at` (timestamptz, nullable) — timestamp of last edit
    - `edited_by` (text, nullable) — name of user who last edited
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_comments' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE quote_comments ADD COLUMN edited_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_comments' AND column_name = 'edited_by'
  ) THEN
    ALTER TABLE quote_comments ADD COLUMN edited_by text;
  END IF;
END $$;
