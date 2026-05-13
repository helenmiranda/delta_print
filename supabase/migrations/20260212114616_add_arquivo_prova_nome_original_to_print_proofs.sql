/*
  # Add original filename column to print_proofs table

  1. Changes
    - Add `arquivo_prova_nome_original` column to `print_proofs` table
      - Stores the original filename uploaded by the user
      - Text type, nullable to support existing records
      - Will be populated for new uploads going forward

  2. Notes
    - Existing records will have NULL for this field
    - New uploads will capture the original filename for better user experience
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_proofs' AND column_name = 'arquivo_prova_nome_original'
  ) THEN
    ALTER TABLE print_proofs ADD COLUMN arquivo_prova_nome_original text;
  END IF;
END $$;