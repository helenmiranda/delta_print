DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_proofs' AND column_name = 'comentarios'
  ) THEN
    ALTER TABLE print_proofs ADD COLUMN comentarios text;
  END IF;
END $$;
