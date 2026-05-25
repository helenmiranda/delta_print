/*
  # Criar tabela print_proof_files

  ## Motivo
  Permite múltiplos arquivos por prova de impressão.
  Antes havia um único campo arquivo_prova_url na tabela print_proofs.

  ## Mudanças
  - Nova tabela print_proof_files com FK para print_proofs
  - RLS permissivo (sistema interno)
*/

CREATE TABLE IF NOT EXISTS print_proof_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  print_proof_id bigint NOT NULL REFERENCES print_proofs(id) ON DELETE CASCADE,
  arquivo_url text NOT NULL,
  arquivo_nome_original text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE print_proof_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_proof_files_allow_all"
  ON print_proof_files FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_print_proof_files_proof_id ON print_proof_files(print_proof_id);
