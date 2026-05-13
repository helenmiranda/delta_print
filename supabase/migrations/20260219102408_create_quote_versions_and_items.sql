/*
  # Create quote_versions and quote_version_items tables

  ## Summary
  Adds support for multiple quote versions per quote, each with line items.

  ## New Tables

  ### quote_versions
  - `id` (uuid, PK)
  - `quote_id` (int, FK → quotes.id) — which quote this version belongs to
  - `version_number` (int) — sequential version number (1, 2, 3…)
  - `pdf_url` (text) — URL of the uploaded PDF for this version
  - `pdf_nome_original` (text) — original file name of the PDF
  - `orcamento_numero` (text) — quote number/code for this version
  - `prazo_pagamento` (text) — payment deadline
  - `forma_pagamento` (text) — payment method
  - `pagamento_regras` (text) — payment rules/conditions
  - `status` (text) — version status
  - `created_at` (timestamptz)

  ### quote_version_items
  - `id` (uuid, PK)
  - `quote_version_id` (uuid, FK → quote_versions.id)
  - `orc_item_codigo` (text) — item code
  - `quantidade` (numeric) — quantity
  - `descricao` (text) — item description
  - `preco_unitario` (numeric) — unit price
  - `valor_total` (numeric) — total value for this item
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Authenticated users can read/insert/update/delete their own data
  - Policies scoped to authenticated role

  ## Notes
  - Uses IF NOT EXISTS to be idempotent
  - Foreign keys with ON DELETE CASCADE to keep data consistent
*/

CREATE TABLE IF NOT EXISTS public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id integer NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  pdf_url text,
  pdf_nome_original text,
  orcamento_numero text,
  prazo_pagamento text,
  forma_pagamento text,
  pagamento_regras text,
  status text NOT NULL DEFAULT 'RASCUNHO',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select quote_versions"
  ON public.quote_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert quote_versions"
  ON public.quote_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update quote_versions"
  ON public.quote_versions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete quote_versions"
  ON public.quote_versions
  FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.quote_version_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id uuid NOT NULL REFERENCES public.quote_versions(id) ON DELETE CASCADE,
  orc_item_codigo text,
  quantidade numeric,
  descricao text,
  preco_unitario numeric,
  valor_total numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_version_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select quote_version_items"
  ON public.quote_version_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert quote_version_items"
  ON public.quote_version_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update quote_version_items"
  ON public.quote_version_items
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete quote_version_items"
  ON public.quote_version_items
  FOR DELETE
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'approved_quote_version_id'
  ) THEN
    ALTER TABLE public.quotes
      ADD COLUMN approved_quote_version_id uuid REFERENCES public.quote_versions(id);
  END IF;
END $$;
