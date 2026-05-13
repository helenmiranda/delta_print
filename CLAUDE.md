# Delta Print — Guia para Claude Code

## Visão geral

Sistema web interno para gestão de uma gráfica, embutido como iframe dentro do **Chatwoot** (instância em `https://chat.anexusdigital.com.br`). Construído com React 18 + TypeScript + Vite, backend Supabase (PostgreSQL + Realtime + Storage) e armazenamento de arquivos no Cloudflare R2.

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| Estilo | Tailwind CSS 3 + classes customizadas (`glass-card`, `btn-primary`, etc.) |
| Ícones | `lucide-react` (não instalar outras bibliotecas de ícones) |
| Roteamento | `react-router-dom` v7 |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Backend | Supabase (PostgreSQL + Realtime + Storage) |
| Upload de arquivos | Cloudflare R2 via `PUT` direto com `VITE_R2_AUTH_KEY` |
| Datas | `date-fns` |
| PDF | `pdfjs-dist` |

## Comandos

```bash
npm run dev          # servidor de desenvolvimento
npm run build        # build de produção
npm run typecheck    # tsc --noEmit (sem emitir arquivos)
npm run lint         # eslint
```

## Variáveis de ambiente (`.env`)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CHATWOOT_BASE_URL=  # URL base do Chatwoot (https://chat.anexusdigital.com.br/)
VITE_CHATWOOT_ACCOUNT_ID=
VITE_CHATWOOT_ACCESS_TOKEN=
VITE_R2_PUBLIC_URL=      # URL base do worker R2 para upload
VITE_R2_AUTH_KEY=        # header X-Custom-Auth-Key para uploads
```

## Rotas da aplicação

| Rota | Página | Descrição |
|---|---|---|
| `/` | redirect | Redireciona para `/orcamentos-expressa` |
| `/orcamentos-expressa` | `QuotesPage` | Orçamentos da Gráfica Expressa |
| `/orcamentos-industrial` | `QuotesPage` | Orçamentos da Gráfica Industrial |
| `/impressao-expressa` | `ImpressaoExpressaPage` | Fila de impressão (só Expressa) |
| `/aprovacao` | `ApprovalPage` | Aprovação de orçamentos |
| `/pre-impressao` | `PrePressPage` | Pré-impressão |
| `/provas` | `PrintProofsPage` | Provas de impressão |
| `/design` | `DesignKanban` | Kanban do setor de Design |

## Estrutura de diretórios

```
src/
├── App.tsx                     # Roteamento raiz e providers
├── main.tsx
├── index.css                   # Estilos globais + classes Tailwind customizadas
├── vite-env.d.ts
├── types/
│   └── design.types.ts         # Interfaces TypeScript do módulo Design Kanban
├── lib/
│   ├── supabase.ts             # Cliente Supabase singleton
│   ├── logActivity.ts          # Log de atividades para orçamentos (quote_activities)
│   ├── printJobs.ts            # Lógica de envio para impressão (print_jobs)
│   ├── r2Upload.ts             # Upload de arquivos para Cloudflare R2
│   └── uploadValidation.ts     # Validação de tipo e tamanho de arquivo
├── contexts/
│   ├── ChatwootUserContext.tsx  # Usuário completo do Chatwoot (com token/account_id)
│   ├── UserContext.tsx          # Usuário simplificado com fallback dev (email + name)
│   └── ToastContext.tsx         # Notificações globais
├── hooks/
│   ├── useAutoRefresh.ts        # Polling a cada 60s + recarrega ao focar aba
│   ├── useDesignCards.ts        # CRUD + Realtime de cards do Kanban
│   ├── useDesignColumns.ts
│   ├── useDesignComments.ts
│   ├── useDesignAttachments.ts
│   ├── useDesignChecklist.ts
│   ├── useDesignActivity.ts
│   ├── useDesignHistory.ts
│   ├── useDesignLabels.ts
│   └── useUser.ts
├── pages/
│   ├── QuotesPage.tsx           # Lista de orçamentos com filtros e ações
│   ├── ApprovalPage.tsx
│   ├── PrePressPage.tsx
│   ├── PrintProofsPage.tsx
│   ├── ImpressaoExpressaPage.tsx
│   └── DesignKanban.tsx
└── components/
    ├── design-kanban/           # Componentes exclusivos do módulo Kanban
    └── *.tsx                    # Componentes compartilhados (modais, drawers, badges)
```

## Módulo de orçamentos

### Setores
- `GRAFICA_EXPRESSA` — rota `/orcamentos-expressa`
- `GRAFICA_INDUSTRIAL` — rota `/orcamentos-industrial`

### Fluxo de status dos orçamentos
```
PENDENTE_ORCAMENTO
  → PRONTO_PARA_ENVIAR
    → ORCAMENTO_ENVIADO
      → APROVADO_CLIENTE
        → OS_GERADA
  → NAO_APROVADO
  → AJUSTE_NECESSARIO (bloqueia envio)
```

### Prioridades
`BAIXA | MEDIA | ALTA | URGENTE`

### Soft delete
Orçamentos usam `deleted_at` (timestamp). Sempre filtrar com `.is('deleted_at', null)`.

## Módulo Design Kanban

Kanban para pedidos de arte do setor de design. Usa **Supabase Realtime** para sincronização em tempo real.

### Tabelas principais
- `design_columns` — colunas do kanban (Solicita, Desenvolve, Aprovação, etc.)
- `design_cards` — cards com `is_archived` para soft delete
- `design_labels` / `design_card_labels` — etiquetas de cor
- `design_comments` — comentários por card
- `design_attachments` — anexos por card
- `design_checklist_items` — checklist por card
- `design_activity_log` — histórico de ações

### Prioridades dos cards
`baixa | media | alta | urgente` (lowercase, diferente dos orçamentos que são UPPERCASE)

## Contextos de usuário

Dois contextos coexistem porque o módulo de Design foi adicionado depois:

| Contexto | Hook | Dados | Uso |
|---|---|---|---|
| `ChatwootUserContext` | `useChatwootUser()` | `{id, name, email, token, account_id}` | Módulo de orçamentos e log de atividades |
| `UserContext` | `useUser()` | `{email, name}` + `isDevMode` | Módulo Design Kanban |

Ambos recebem dados via `postMessage` do Chatwoot (iframe pai) com `event.origin === 'https://chat.anexusdigital.com.br'` e tipo `CW_USER`. O `UserContext` tem fallback para `dev@anexus.com` após 3 segundos (para desenvolvimento local).

## Upload de arquivos

- **R2**: upload direto via `PUT` para `${VITE_R2_PUBLIC_URL}/<path>` com header `X-Custom-Auth-Key`
- Função: `uploadFileToR2({ folder, quoteId, tipo, file })` em `src/lib/r2Upload.ts`
- **Validação** (em `uploadValidation.ts`):
  - Tamanho máximo: **350 MB**
  - Extensões: `pdf, jpg, jpeg, png, webp, zip, rar, 7z, cdr, ai, psd`

## Banco de dados (Supabase)

### Tabelas principais
- `quotes` — orçamentos com campos `setor`, `status`, `prioridade`, `deleted_at`
- `orders` — ordens de serviço geradas após aprovação
- `print_jobs` — fila de impressão (só `GRAFICA_EXPRESSA`)
- `print_proofs` — provas de impressão
- `quote_versions` + `quote_version_items` — versões de orçamento com itens
- `quote_payments` — dados financeiros/pagamento por orçamento
- `quote_activities` — log de atividades dos orçamentos
- `quote_comments` — comentários nos orçamentos

### Migrations
Ficam em `supabase/migrations/`. Sempre criar nova migration (nunca editar existentes).

## Padrões de estilo

### Classes CSS customizadas (definidas em `index.css`)
- `.glass-card` — card com glassmorphism (fundo branco translúcido, blur, sombra)
- `.glass-card-static` — igual sem hover
- `.btn-primary` — botão azul principal (`primary-500`)
- `.btn-secondary` — botão outline
- `.btn-ghost` — botão transparente
- `.input-field` — input padrão (altura 32px)
- `.input-field-textarea` — textarea padrão
- `.section-title` — título de seção em `primary-500`
- `.text-body` — texto secundário cinza

### Paleta de cores principal
- `primary-500`: `#1E4FA3` (azul corporativo)
- `background`: `#f2f2f2`
- Font: **Inter** (Google Fonts)
- Base font-size: **13px**

### Regras de UI
- Sempre usar ícones do `lucide-react` — não instalar outras bibliotecas
- Não instalar bibliotecas de UI (sem shadcn, MUI, etc.)
- Design compacto: tabelas, inputs e botões têm altura reduzida via overrides globais no `index.css`
- Colunas responsivas: `col-iframe-hide` oculta colunas em telas < 1000px

## Auto-refresh

O hook `useAutoRefresh` faz polling a cada **60 segundos** e recarrega quando a aba volta ao foco. Usado nas páginas de orçamentos.

O Design Kanban usa **Supabase Realtime** (não polling).

## Regras importantes

1. **Nunca editar migrations existentes** — criar sempre uma nova
2. **Soft delete em quotes**: filtrar sempre com `.is('deleted_at', null)`
3. **Orçamentos com `OS_GERADA` não podem ser excluídos** (bloqueio no front e na lógica)
4. **Print jobs são exclusivos da `GRAFICA_EXPRESSA`** — validação em `printJobs.ts`
5. **Origem do postMessage**: sempre validar `event.origin === 'https://chat.anexusdigital.com.br'`
6. **Cards do Kanban com `is_archived: true`** são filtrados do estado (soft delete)
7. **Upload R2**: o campo `tipo` existe na interface mas não é usado no path — apenas `folder` e `quoteId`
