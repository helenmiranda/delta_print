import type { SetorType } from '../pages/QuotesPage';

export const VENDOR_WEBHOOK_SETORES: SetorType[] = ['GRAFICA_INDUSTRIAL', 'GRAFICA_EXPRESSA'];
export const VENDOR_WEBHOOK_VENDEDORES = ['Thiago', 'Marcelo'] as const;
export const VENDOR_WEBHOOK_STATUSES = ['PRONTO_PARA_ENVIAR', 'ORCAMENTO_ENVIADO'] as const;

export interface QuoteEligibilityInput {
  setor: string | null | undefined;
  vendedor_nome: string | null | undefined;
  status: string | null | undefined;
  pdfUrl: string | null | undefined;
}

export function matchVendorWebhookName(vendedorNome: string | null | undefined): 'Thiago' | 'Marcelo' | null {
  if (!vendedorNome) return null;
  const normalized = vendedorNome.trim().toLowerCase();
  for (const canonical of VENDOR_WEBHOOK_VENDEDORES) {
    if (normalized.startsWith(canonical.toLowerCase())) return canonical;
  }
  return null;
}

export function isEligibleForVendorWebhook(q: QuoteEligibilityInput): boolean {
  if (!q.setor || !VENDOR_WEBHOOK_SETORES.includes(q.setor as SetorType)) return false;
  if (!matchVendorWebhookName(q.vendedor_nome)) return false;
  if (!q.status || !(VENDOR_WEBHOOK_STATUSES as readonly string[]).includes(q.status)) return false;
  if (!q.pdfUrl) return false;
  return true;
}

export interface QuoteVersionForLatestPdf {
  pdf_url: string | null;
  version_number: number;
}

export function getLatestVersionPdfUrl(versions: QuoteVersionForLatestPdf[] | null | undefined): string | null {
  if (!versions || versions.length === 0) return null;
  const latest = versions.reduce((max, v) => (v.version_number > max.version_number ? v : max), versions[0]);
  return latest.pdf_url ?? null;
}

const VENDEDOR_PHONE_ENV_MAP: Record<string, string | undefined> = {
  Thiago: import.meta.env.VITE_VENDEDOR_WHATSAPP_THIAGO,
  Marcelo: import.meta.env.VITE_VENDEDOR_WHATSAPP_MARCELO,
};

export interface SendQuoteToVendorParams {
  vendedorNome: string;
  pdfUrl: string;
  clienteNome: string;
  codigoOrcamento: string | null;
  quoteId: number;
}

export type SendQuoteToVendorResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function sendQuoteToVendorWebhook(
  params: SendQuoteToVendorParams
): Promise<SendQuoteToVendorResult> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_ORCAMENTO_URL;
  if (!webhookUrl) {
    return { ok: false, message: 'VITE_N8N_WEBHOOK_ORCAMENTO_URL não configurado. Verifique as variáveis de ambiente.' };
  }

  const canonicalVendedor = matchVendorWebhookName(params.vendedorNome);
  if (!canonicalVendedor) {
    return { ok: false, message: `Vendedor "${params.vendedorNome}" não é Thiago nem Marcelo.` };
  }

  const telefone = VENDEDOR_PHONE_ENV_MAP[canonicalVendedor];
  if (!telefone) {
    return {
      ok: false,
      message: `Telefone de "${canonicalVendedor}" não configurado (verifique VITE_VENDEDOR_WHATSAPP_${canonicalVendedor.toUpperCase()}).`,
    };
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendedor_nome: params.vendedorNome,
        vendedor_telefone: telefone,
        cliente_nome: params.clienteNome,
        codigo_orcamento: params.codigoOrcamento,
        arquivo_orcamento_url: params.pdfUrl,
        quote_id: params.quoteId,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { ok: false, message: `Erro ao enviar orçamento (${resp.status}): ${body.slice(0, 120)}` };
    }

    return { ok: true, message: `Orçamento enviado a ${params.vendedorNome} via WhatsApp!` };
  } catch (err: any) {
    return { ok: false, message: `Erro inesperado: ${err?.message ?? 'tente novamente'}` };
  }
}

export interface SendQuoteDuvidaToVendorParams {
  vendedorNome: string;
  clienteNome: string;
  codigoOrcamento: string | null;
  quoteId: number;
  quoteCommentId: number;
  mensagemDuvida: string;
}

export type SendQuoteDuvidaToVendorResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function sendQuoteDuvidaToVendorWebhook(
  params: SendQuoteDuvidaToVendorParams
): Promise<SendQuoteDuvidaToVendorResult> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_DUVIDA_URL;
  if (!webhookUrl) {
    return { ok: false, message: 'VITE_N8N_WEBHOOK_DUVIDA_URL não configurado. Verifique as variáveis de ambiente.' };
  }

  const canonicalVendedor = matchVendorWebhookName(params.vendedorNome);
  if (!canonicalVendedor) {
    return { ok: false, message: `Vendedor "${params.vendedorNome}" não é Thiago nem Marcelo.` };
  }

  const telefone = VENDEDOR_PHONE_ENV_MAP[canonicalVendedor];
  if (!telefone) {
    return {
      ok: false,
      message: `Telefone de "${canonicalVendedor}" não configurado (verifique VITE_VENDEDOR_WHATSAPP_${canonicalVendedor.toUpperCase()}).`,
    };
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quote_id: params.quoteId,
        quote_comment_id: params.quoteCommentId,
        vendedor_nome: params.vendedorNome,
        vendedor_telefone: telefone,
        cliente_nome: params.clienteNome,
        codigo_orcamento: params.codigoOrcamento,
        mensagem_duvida: params.mensagemDuvida,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { ok: false, message: `Erro ao avisar vendedor sobre a dúvida (${resp.status}): ${body.slice(0, 120)}` };
    }

    return { ok: true, message: `Dúvida enviada a ${params.vendedorNome} via WhatsApp!` };
  } catch (err: any) {
    return { ok: false, message: `Erro inesperado: ${err?.message ?? 'tente novamente'}` };
  }
}
