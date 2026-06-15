DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_proofs' AND column_name = 'solicitante_nome'
  ) THEN
    ALTER TABLE print_proofs ADD COLUMN solicitante_nome text;
  END IF;
END $$;
