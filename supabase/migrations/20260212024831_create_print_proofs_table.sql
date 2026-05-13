/*
  # Create print_proofs table

  1. New Tables
    - `print_proofs`
      - `id` (uuid, primary key) - Unique identifier for each print proof request
      - `order_id` (integer, foreign key) - References the order this proof belongs to
      - `nome_prova` (text) - Name/description of the proof
      - `tipo_impressao` (text) - Type of print: PADRAO, CAPA, or MIOLO
      - `cores` (text) - Color mode: COLORIDO or PB
      - `lados` (text) - Print sides: FRENTE or FRENTE_VERSO
      - `ajuste` (text) - Adjustment: AJUSTADO or SEM_AJUSTE
      - `formato` (text) - Paper format: A4, A3_PLUS, A4_PLUS, or FORMATO_MAIOR
      - `papel_tipo` (text) - Paper type: COUCHE, SULFITE, C2S, or OUTROS
      - `papel_gramatura` (text, nullable) - Paper weight (for COUCHE/SULFITE/C2S)
      - `papel_outros` (text, nullable) - Other paper specification (for OUTROS)
      - `arquivo_prova_url` (text) - URL of the uploaded proof file (PDF)
      - `observacoes` (text, nullable) - Additional notes/observations
      - `status_prova` (text, default 'SOLICITADA') - Status: SOLICITADA, EM_ANALISE, APROVADA, REJEITADA
      - `created_at` (timestamptz, default now()) - Creation timestamp
      - `updated_at` (timestamptz, default now()) - Last update timestamp

  2. Security
    - Enable RLS on `print_proofs` table
    - Add policies for authenticated users to manage proofs
*/

CREATE TABLE IF NOT EXISTS print_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  nome_prova text NOT NULL,
  tipo_impressao text NOT NULL DEFAULT 'PADRAO',
  cores text NOT NULL DEFAULT 'COLORIDO',
  lados text NOT NULL DEFAULT 'FRENTE_VERSO',
  ajuste text NOT NULL DEFAULT 'AJUSTADO',
  formato text NOT NULL DEFAULT 'A4',
  papel_tipo text NOT NULL DEFAULT 'COUCHE',
  papel_gramatura text,
  papel_outros text,
  arquivo_prova_url text NOT NULL,
  observacoes text,
  status_prova text NOT NULL DEFAULT 'SOLICITADA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE print_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all print proofs"
  ON print_proofs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert print proofs"
  ON print_proofs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update print proofs"
  ON print_proofs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete print proofs"
  ON print_proofs FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_print_proofs_order_id ON print_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_proofs_status ON print_proofs(status_prova);
CREATE INDEX IF NOT EXISTS idx_print_proofs_created_at ON print_proofs(created_at DESC);
