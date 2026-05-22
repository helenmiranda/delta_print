-- Habilita RLS e cria políticas permissivas (sistema interno sem autenticação própria)
alter table tickets enable row level security;

create policy "tickets_allow_all"
  on tickets for all
  to anon, authenticated
  using (true)
  with check (true);

alter table ticket_comments enable row level security;

create policy "ticket_comments_allow_all"
  on ticket_comments for all
  to anon, authenticated
  using (true)
  with check (true);

-- Campos de arquivo anexado ao ticket
alter table tickets add column if not exists arquivo_url text;
alter table tickets add column if not exists arquivo_nome_original text;
