# Delta Print — Guia do Projeto

Sistema web interno para gestão de uma gráfica, embutido como iframe dentro do **Chatwoot** (`https://chat.anexusdigital.com.br`). React 18 + TypeScript + Vite, backend Supabase, arquivos no Cloudflare R2.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Estilo | Tailwind CSS 3 + classes customizadas |
| Ícones | `lucide-react` — não instalar outras bibliotecas |
| Roteamento | `react-router-dom` v7 |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Backend | Supabase (PostgreSQL + Realtime + Storage) |
| Upload | Cloudflare R2 via `PUT` com `X-Custom-Auth-Key` |
| Datas | `date-fns` |
| PDF | `pdfjs-dist` |

## Comandos

```bash
npm run dev        # dev server
npm run build      # produção
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## Variáveis de ambiente (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CHATWOOT_BASE_URL=          # https://chat.anexusdigital.com.br/
VITE_CHATWOOT_ACCOUNT_ID=
VITE_CHATWOOT_ACCESS_TOKEN=
VITE_R2_PUBLIC_URL=              # URL base do worker R2
VITE_R2_AUTH_KEY=                # header X-Custom-Auth-Key
VITE_EVOLUTION_API_URL=          # URL base da Evolution API (WhatsApp)
VITE_EVOLUTION_INSTANCE=         # nome da instância Evolution
VITE_EVOLUTION_API_KEY=          # apikey da Evolution
VITE_VENDEDOR_WHATSAPP=          # número fixo do vendedor (ex: 5511999999999)
```

---

## Rotas

| Rota | Página | Descrição |
|---|---|---|
| `/` | redirect | → `/orcamentos-expressa` |
| `/orcamentos-expressa` | `QuotesPage` | Orçamentos Gráfica Expressa |
| `/orcamentos-industrial` | `QuotesPage` | Orçamentos Gráfica Industrial |
| `/orcamentos-comunica-visual` | `QuotesPage` | Orçamentos Comunicação Visual |
| `/impressao-expressa` | `ImpressaoExpressaPage` | Fila de impressão (só Expressa) |
| `/aprovacao` | `ApprovalPage` | Aprovação de orçamentos |
| `/pre-impressao` | `PrePressPage` | Pré-impressão |
| `/provas` | `PrintProofsPage` | Provas de impressão |
| `/design` | `DesignKanban` | Kanban do setor de Design |
| `/tickets` | `TicketsPage` | Tickets internos |

**Para adicionar um novo setor:** editar `SetorType` e `SETOR_LABELS` em `QuotesPage.tsx` e adicionar rota em `App.tsx`. Sem migration — coluna `setor` é TEXT sem constraint.

---

## Estrutura de arquivos

```
src/
├── App.tsx                      # Rotas + providers
├── index.css                    # Estilos globais e classes Tailwind custom
├── types/design.types.ts        # Tipos do módulo Kanban
├── lib/
│   ├── supabase.ts              # Cliente Supabase singleton
│   ├── logActivity.ts           # Log de atividades (quote_activities)
│   ├── printJobs.ts             # Envio para impressão (só GRAFICA_EXPRESSA)
│   ├── r2Upload.ts              # Upload para Cloudflare R2
│   └── uploadValidation.ts      # Validação de arquivo (2GB, extensões permitidas)
├── contexts/
│   ├── ChatwootUserContext.tsx  # Usuário Chatwoot (orçamentos)
│   ├── UserContext.tsx          # Usuário com fallback dev (Design Kanban)
│   └── ToastContext.tsx         # Notificações globais
├── hooks/
│   ├── useAutoRefresh.ts        # Polling 60s + foco de aba
│   └── useDesign*.ts            # Hooks do módulo Kanban
├── pages/
│   ├── QuotesPage.tsx           # Lista de orçamentos (todos os setores)
│   ├── ApprovalPage.tsx
│   ├── PrePressPage.tsx
│   ├── PrintProofsPage.tsx
│   ├── ImpressaoExpressaPage.tsx
│   ├── DesignKanban.tsx
│   └── TicketsPage.tsx
└── components/
    ├── QuoteDrawer.tsx           # Drawer principal do orçamento
    ├── NewQuoteModal.tsx         # Modal criação de orçamento
    ├── NewManualApprovalModal.tsx
    ├── FinanceDrawer.tsx         # Dados financeiros e geração de OS
    ├── ApprovalModal.tsx
    ├── RejectQuoteModal.tsx
    ├── DeleteQuoteModal.tsx
    ├── PrintProofsTable.tsx      # Tabela de provas (com botões de ação na linha)
    ├── PrintProofDrawer.tsx      # Drawer de detalhe da prova
    ├── ProofRequestModal.tsx     # Modal de nova prova (upload múltiplo)
    ├── PrePressDrawer.tsx
    ├── PrintJobDrawer.tsx
    ├── NewPrintJobModal.tsx
    ├── QuoteArtFiles.tsx
    ├── QuoteComments.tsx
    ├── QuoteActivities.tsx
    ├── StatusBadge.tsx
    ├── PriorityBadge.tsx
    ├── FileViewerModal.tsx
    ├── TicketDrawer.tsx
    ├── NewTicketModal.tsx
    └── design-kanban/            # Componentes exclusivos do Kanban
```

---

## Módulo de Orçamentos

### Setores (`SetorType`)
```typescript
'GRAFICA_EXPRESSA' | 'GRAFICA_INDUSTRIAL' | 'COMUNICA_VISUAL'
```

### Fluxo de status
```
PENDENTE_ORCAMENTO
  → PRONTO_PARA_ENVIAR      (cotista anexou PDF ou digitou manualmente)
    → ORCAMENTO_ENVIADO     (enviado ao cliente)
      → APROVADO_CLIENTE
        → OS_GERADA
  → NAO_APROVADO
  → AJUSTE_NECESSARIO       (bloqueia envio)
```

### Prioridades
`BAIXA | MEDIA | ALTA | URGENTE`

### Tabela `quotes` — campos principais
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | bigint PK | |
| `codigo_orcamento` | text | gerado automaticamente |
| `cliente_nome` | text | obrigatório |
| `cliente_telefone` | text | |
| `cliente_whatsapp` | text | |
| `cliente_email` | text | |
| `cliente_cpf_cnpj` | text | |
| `endereco_entrega` | text | |
| `descricao_pedido` | text | obrigatório |
| `observacoes` | text | |
| `vendedor_nome` | text | obrigatório |
| `prioridade` | text | BAIXA/MEDIA/ALTA/URGENTE |
| `status` | text | ver fluxo acima |
| `setor` | text | GRAFICA_EXPRESSA / GRAFICA_INDUSTRIAL / COMUNICA_VISUAL |
| `origem` | text | `MANUAL` (padrão) ou `AGENTE` (criado por automação externa) |
| `arquivo_arte_url` | text | URL arte no Supabase Storage |
| `arquivo_orcamento_url` | text | |
| `orcamento_opcoes_json` | jsonb | opções parseadas do webhook |
| `aprovado_descricao` | text | descrição do que foi aprovado |
| `aprovado_valor_total` | numeric | |
| `aprovado_em` | timestamptz | |
| `approved_quote_version_id` | uuid | versão aprovada |
| `conversa_id` | text | ID conversa Chatwoot |
| `deleted_at` | timestamptz | soft delete — sempre filtrar `.is('deleted_at', null)` |
| `deleted_reason` | text | |
| `created_at` / `updated_at` | timestamptz | |

### Regras críticas de `quotes`
- **Soft delete**: sempre filtrar `.is('deleted_at', null)`
- **OS_GERADA**: não pode ser excluído (bloqueio no front)
- **Print jobs**: exclusivos da `GRAFICA_EXPRESSA` (`printJobs.ts`)

### Insert mínimo para criar orçamento (agente externo)
```json
{
  "cliente_nome": "...",
  "descricao_pedido": "...",
  "vendedor_nome": "...",
  "prioridade": "MEDIA",
  "status": "PENDENTE_ORCAMENTO",
  "setor": "GRAFICA_EXPRESSA",
  "origem": "AGENTE"
}
```

---

## Módulo de Provas de Impressão

### Tabelas
**`print_proofs`** — uma prova por registro
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | bigint PK | |
| `order_id` | bigint FK | opcional |
| `nome_prova` | text | obrigatório |
| `tipo_impressao` | text | PADRAO / CAPA / MIOLO |
| `cores` | text | COLORIDO / PB |
| `lados` | text | FRENTE / FRENTE_VERSO |
| `ajuste` | text | AJUSTADO / SEM_AJUSTE |
| `formato` | text | A4, A3_PLUS, A4_PLUS, FORMATO_MAIOR, ou texto livre |
| `papel_tipo` | text | COUCHE / SULFITE / C2S / OUTROS |
| `papel_gramatura` | text | |
| `papel_outros` | text | |
| `arquivo_prova_url` | text | primeiro arquivo (compat. retroativa) |
| `arquivo_prova_nome_original` | text | |
| `observacoes` | text | |
| `status_prova` | text | SOLICITADA / FEITO |

**`print_proof_files`** — múltiplos arquivos por prova (novo)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `print_proof_id` | bigint FK → print_proofs | |
| `arquivo_url` | text | |
| `arquivo_nome_original` | text | |

**Exibição no drawer**: usa `print_proof_files` se existir, senão faz fallback para `arquivo_prova_url`.

### Ações na tabela de provas
- **Download**: abre arquivo diretamente na linha (sem abrir drawer)
- **Feito**: marca como `FEITO` inline, aparece só quando `status_prova = SOLICITADA`

---

## Upload de Arquivos

### Cloudflare R2 (`r2Upload.ts`)
- Função: `uploadFileToR2({ folder, quoteId, tipo, file })`
- PUT direto para `${VITE_R2_PUBLIC_URL}/<path>` com header `X-Custom-Auth-Key`
- Usado em: provas de impressão, arte dos orçamentos

### Validação (`uploadValidation.ts`)
- Tamanho máximo: **2 GB**
- Extensões: `pdf, jpg, jpeg, png, webp, zip, rar, 7z, cdr, ai, psd`

### Supabase Storage
- Bucket `artwork-files`: arte dos orçamentos (imagens + PDF, máx 10MB, upload pelo modal de novo orçamento)

---

## Envio via WhatsApp (Evolution API)

Quando `quote.origem === 'AGENTE'`, aparece botão verde no drawer para enviar o PDF ao vendedor:

```
POST {VITE_EVOLUTION_API_URL}/message/sendMedia/{VITE_EVOLUTION_INSTANCE}
Headers: { apikey: VITE_EVOLUTION_API_KEY }
Body: { number, mediatype: 'document', mimetype: 'application/pdf', media: pdfUrl, fileName, caption }
```

O número de destino é fixo: `VITE_VENDEDOR_WHATSAPP`.

---

## Módulo Design Kanban

Kanban para pedidos de arte. Usa **Supabase Realtime** (não polling).

### Tabelas
- `design_columns` — colunas do kanban
- `design_cards` — cards com `is_archived` (soft delete)
- `design_labels` / `design_card_labels` — etiquetas
- `design_comments` — comentários
- `design_attachments` — anexos
- `design_checklist_items` — checklist
- `design_activity_log` — histórico

### Prioridades dos cards
`baixa | media | alta | urgente` (lowercase — diferente dos orçamentos que são UPPERCASE)

---

## Módulo de Tickets

Tabelas: `tickets` + `ticket_comments`

| Campo | Valores |
|---|---|
| `categoria` | bug, melhoria, dúvida... |
| `status` | aberto, em_andamento, resolvido |
| `prioridade` | baixa, media, alta, urgente |

Suporta arquivo anexo (`arquivo_url`, `arquivo_nome_original`).

---

## Contextos de Usuário

| Contexto | Hook | Dados | Uso |
|---|---|---|---|
| `ChatwootUserContext` | `useChatwootUser()` | `{id, name, email, token, account_id}` | Orçamentos, log de atividades |
| `UserContext` | `useUser()` | `{email, name}` + `isDevMode` | Design Kanban |

Ambos recebem dados via `postMessage` do Chatwoot com `event.origin === 'https://chat.anexusdigital.com.br'` e `type === 'CW_USER'`. `UserContext` tem fallback para `dev@anexus.com` após 3s.

---

## Padrões de Estilo

### Classes CSS custom (`index.css`)
| Classe | Uso |
|---|---|
| `.glass-card` | card glassmorphism com hover |
| `.glass-card-static` | glass sem hover |
| `.btn-primary` | botão azul principal |
| `.btn-secondary` | botão outline |
| `.btn-ghost` | botão transparente |
| `.input-field` | input padrão (32px) |
| `.input-field-textarea` | textarea padrão |
| `.section-title` | título em primary-500 |
| `.text-body` | texto cinza secundário |
| `.col-iframe-hide` | oculta coluna em telas < 1000px |

### Cores e tipografia
- `primary-500`: `#1E4FA3`
- Background: `#f2f2f2`
- Font: Inter, base 13px

### Regras de UI
- Ícones: sempre `lucide-react`
- Sem bibliotecas de UI externas (shadcn, MUI, etc.)
- Design compacto — não aumentar alturas padrão sem necessidade

---

## Banco de Dados — Outras Tabelas

### `orders` — Ordens de Serviço
| Campo | Tipo |
|---|---|
| `id` | bigint PK |
| `quote_id` | bigint FK |
| `codigo_os` | text |
| `status_os` | text |
| `setor` | text (mesmo valores de quotes.setor) |
| `observacoes_pre_impressao` | text |

### `quote_versions` — Versões de orçamento
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `quote_id` | bigint FK |
| `version_number` | int |
| `pdf_url` | text (null = versão manual) |
| `pdf_nome_original` | text |
| `orcamento_numero` | text (texto livre quando manual) |
| `prazo_pagamento` | text |
| `forma_pagamento` | text |
| `status` | text |

### `quote_version_items`
`id, quote_version_id, orc_item_codigo, quantidade, preco_unitario, valor_total, descricao`

### `quote_payments`
`id, quote_id, comprovante_pagamento_url, comprovante_aprovacao_url, contrato_social_url`

### `quote_activities`
Log de ações nos orçamentos. Inserir via `logActivity()` em `src/lib/logActivity.ts`.

### `quote_comments`
Comentários por orçamento com campos `edited_at` e `edited_by`.

### `print_jobs`
Fila de impressão — exclusivo de `GRAFICA_EXPRESSA`. Validação em `printJobs.ts`.

---

## Migrations

Ficam em `supabase/migrations/`. **Nunca editar existentes — sempre criar nova.**

Nomenclatura: `YYYYMMDDHHMMSS_descricao.sql`

---

## Regras Críticas

1. **Soft delete em quotes**: sempre filtrar `.is('deleted_at', null)`
2. **OS_GERADA**: orçamento não pode ser excluído
3. **Print jobs**: exclusivos da `GRAFICA_EXPRESSA`
4. **postMessage**: validar `event.origin === 'https://chat.anexusdigital.com.br'`
5. **Kanban soft delete**: filtrar `is_archived: true`
6. **R2 upload**: campo `tipo` existe na interface mas não é usado no path
7. **Migrations**: nunca editar, sempre criar nova
8. **setor em quotes/orders**: coluna TEXT sem constraint — novos valores funcionam sem migration
