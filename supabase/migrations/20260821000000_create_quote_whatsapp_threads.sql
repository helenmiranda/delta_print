-- Rastreia duvidas de orcamento avisadas ao vendedor via WhatsApp, para
-- correlacionar a resposta dele com o comentario original quando ele responder
-- (via tag [Q{quote_id}] na mensagem + historico do WAHA, com fallback de
-- contagem de pendentes + confirmacao por texto).
create table if not exists quote_whatsapp_threads (
  id serial primary key,
  quote_id integer not null references quotes(id) on delete cascade,
  quote_comment_id integer not null references quote_comments(id) on delete cascade,
  vendedor_nome text not null,
  vendedor_telefone text not null,
  cliente_nome text not null,
  codigo_orcamento text,
  mensagem_duvida text not null,
  status text not null default 'AGUARDANDO_RESPOSTA',
  resposta_texto text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table quote_whatsapp_threads is
  'Rastreia duvidas de orcamento avisadas ao vendedor via WhatsApp, para correlacionar a resposta dele (por tag/historico do WAHA + confirmacao) com o comentario original.';
comment on column quote_whatsapp_threads.status is
  'AGUARDANDO_RESPOSTA | AGUARDANDO_CONFIRMACAO | RESPONDIDO | EXPIRADO';
comment on column quote_whatsapp_threads.quote_comment_id is
  'Comentario especifico (quote_comments.id) da duvida sendo respondida - garante marcar so aquele comentario como resolvido, nao "o mais recente"';
comment on column quote_whatsapp_threads.resposta_texto is
  'Texto da resposta do vendedor a gravar em quote_comments quando o thread for resolvido - guardado no momento em que a duvida certa e identificada, ANTES da confirmacao ("sim") chegar';

create index if not exists idx_quote_whatsapp_threads_status on quote_whatsapp_threads(status);
create index if not exists idx_quote_whatsapp_threads_vendedor_status on quote_whatsapp_threads(vendedor_nome, status);
create index if not exists idx_quote_whatsapp_threads_quote_id on quote_whatsapp_threads(quote_id);
create index if not exists idx_quote_whatsapp_threads_quote_comment_id on quote_whatsapp_threads(quote_comment_id);

alter table quote_whatsapp_threads enable row level security;

create policy "quote_whatsapp_threads_allow_all"
  on quote_whatsapp_threads for all
  to anon, authenticated
  using (true)
  with check (true);
