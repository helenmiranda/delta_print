create table tickets (
  id serial primary key,
  titulo text not null,
  descricao text not null,
  categoria text not null default 'bug',
  status text not null default 'aberto',
  prioridade text not null default 'media',
  reportado_por_nome text not null,
  reportado_por_email text not null,
  resolvido_por_nome text,
  resolvido_por_email text,
  resolvido_em timestamptz,
  created_at timestamptz default now() not null
);

create table ticket_comments (
  id serial primary key,
  ticket_id integer not null references tickets(id) on delete cascade,
  autor_nome text not null,
  autor_email text not null,
  conteudo text not null,
  created_at timestamptz default now() not null
);

create index idx_tickets_status on tickets(status);
create index idx_ticket_comments_ticket_id on ticket_comments(ticket_id);
