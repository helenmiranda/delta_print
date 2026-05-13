import { supabase } from './supabase';

export interface OrderForPrint {
  id: number;
  setor: string;
  codigo_os: string;
  quote: {
    cliente_nome: string;
    cliente_telefone: string | null;
    id?: number;
    observacoes?: string | null;
    aprovado_descricao?: string | null;
  } | null;
}

export type EnviarParaImpressaoResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function enviarParaImpressao(order: OrderForPrint): Promise<EnviarParaImpressaoResult> {
  if (order.setor !== 'GRAFICA_EXPRESSA') {
    return { ok: false, message: 'Esta OS nao pertence a Grafica Expressa.' };
  }

  const { data: existing, error: checkError } = await supabase
    .from('print_jobs')
    .select('id')
    .eq('os_id', order.id)
    .neq('status', 'PRONTO')
    .maybeSingle();

  if (checkError) {
    return { ok: false, message: 'Erro ao verificar fila de impressao.' };
  }

  if (existing) {
    return { ok: false, message: 'Esta OS ja possui uma impressao solicitada.' };
  }

  const clientName = order.quote?.cliente_nome ?? 'Cliente';
  const clientPhone = order.quote?.cliente_telefone ?? null;
  const osCode = order.codigo_os || String(order.id);

  let obsFinanceiro: string | null = null;
  let obsPreImpressao: string | null = null;

  if (order.quote?.id) {
    const { data: paymentData } = await supabase
      .from('quote_payments')
      .select('observacoes_financeiro')
      .eq('quote_id', order.quote.id)
      .maybeSingle();
    obsFinanceiro = paymentData?.observacoes_financeiro ?? null;
  }

  const { data: orderData } = await supabase
    .from('orders')
    .select('observacoes_pre_impressao')
    .eq('id', order.id)
    .maybeSingle();
  obsPreImpressao = (orderData as any)?.observacoes_pre_impressao ?? null;

  const notesLines = [
    `DESCRIÇÃO DO PEDIDO: ${(order.quote as any)?.descricao_pedido || '-'}`,
    `OBS ORCAMENTO: ${order.quote?.observacoes || '-'}`,
    `OBS FINANCEIRO: ${obsFinanceiro || '-'}`,
    `OBS PRE-IMPRESSAO: ${obsPreImpressao || '-'}`,
    `ITENS APROVADOS: ${order.quote?.aprovado_descricao || '-'}`,
  ];
  const notes = notesLines.join('\n');

  const { error: insertError } = await supabase.from('print_jobs').insert({
    setor: 'GRAFICA_EXPRESSA',
    os_id: order.id,
    os_code: osCode,
    client_name: clientName,
    client_phone: clientPhone,
    status: 'SOLICITADO',
    final_art_url: null,
    notes,
  });

  if (insertError) {
    return { ok: false, message: 'Erro ao enviar para impressao.' };
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status_os: 'EM_IMPRESSAO', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  if (updateError) {
    return { ok: false, message: 'Impressao criada mas erro ao atualizar status da OS.' };
  }

  return { ok: true, message: 'OS enviada para impressao com sucesso.' };
}
