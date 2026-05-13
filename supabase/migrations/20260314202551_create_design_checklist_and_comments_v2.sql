/*
  # Criar tabelas de checklist e comentários para o Design Kanban

  ## Novas Tabelas

  ### design_checklist_items
  - `id` (uuid, PK)
  - `card_id` (uuid, FK → design_cards)
  - `title` (text)
  - `is_completed` (boolean)
  - `position` (integer)
  - `completed_at` (timestamptz)
  - `completed_by` (text)
  - `created_at` (timestamptz)

  ### design_comments
  - Já existente — garantir que a tabela está correta

  ## Segurança
  - RLS habilitado com políticas de acesso para anon/authenticated
*/

-- Tabela de itens de checklist por card
CREATE TABLE IF NOT EXISTS design_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES design_cards(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  is_completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir que design_comments existe com a estrutura correta
CREATE TABLE IF NOT EXISTS design_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES design_cards(id) ON DELETE CASCADE,
  author_email text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE design_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_comments ENABLE ROW LEVEL SECURITY;

-- Políticas para checklist_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_checklist_items' AND policyname = 'Allow select design_checklist_items'
  ) THEN
    CREATE POLICY "Allow select design_checklist_items"
      ON design_checklist_items FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_checklist_items' AND policyname = 'Allow insert design_checklist_items'
  ) THEN
    CREATE POLICY "Allow insert design_checklist_items"
      ON design_checklist_items FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_checklist_items' AND policyname = 'Allow update design_checklist_items'
  ) THEN
    CREATE POLICY "Allow update design_checklist_items"
      ON design_checklist_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_checklist_items' AND policyname = 'Allow delete design_checklist_items'
  ) THEN
    CREATE POLICY "Allow delete design_checklist_items"
      ON design_checklist_items FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

-- Políticas para design_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_comments' AND policyname = 'Allow select design_comments'
  ) THEN
    CREATE POLICY "Allow select design_comments"
      ON design_comments FOR SELECT TO anon, authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_comments' AND policyname = 'Allow insert design_comments'
  ) THEN
    CREATE POLICY "Allow insert design_comments"
      ON design_comments FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_comments' AND policyname = 'Allow update design_comments'
  ) THEN
    CREATE POLICY "Allow update design_comments"
      ON design_comments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_comments' AND policyname = 'Allow delete design_comments'
  ) THEN
    CREATE POLICY "Allow delete design_comments"
      ON design_comments FOR DELETE TO anon, authenticated USING (true);
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_design_checklist_items_card_id ON design_checklist_items(card_id);
CREATE INDEX IF NOT EXISTS idx_design_checklist_items_position ON design_checklist_items(card_id, position);
CREATE INDEX IF NOT EXISTS idx_design_comments_card_id ON design_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_design_comments_created_at ON design_comments(card_id, created_at);
