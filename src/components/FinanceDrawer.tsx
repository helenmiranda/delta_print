import { useEffect, useState, useCallback } from 'react';
import {
  X, Copy, User, Phone, CreditCard, FileText, Download,
  Loader2, ClipboardCopy, DollarSign, Truck, Save, CheckCircle2,
  Mail, MapPin, Eye, Printer, Paperclip, ClipboardList,
  FileCheck, ExternalLink, Tag, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/logActivity';
import { useChatwootUser } from '../contexts/ChatwootUserContext';
import QuoteActivities from './QuoteActivities';
import StatusBadge from './StatusBadge';
import Toast from './Toast';
import FileViewerModal from './FileViewerModal';

interface QuoteDetail {
  id: number;
  codigo_orcamento: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_whatsapp: string | null;
  cliente_email: string | null;
  cliente_cpf_cnpj: string | null;
  endereco_entrega: string | null;
  vendedor_nome: string | null;
  descricao_pedido: string;
  aprovado_descricao: string | null;
  aprovado_valor_total: number | null;
  valor_aprovado: number | null;
  arquivo_orcamento_url: string | null;
  status: string;
  created_at: string;
  setor: string | null;
  approved_quote_version_id: number | null;
}

interface QuoteVersion {
  id: number;
  version_number: number | null;
  orcamento_numero: string | null;
  pdf_url: string | null;
  forma_pagamento: string | null;
  prazo_pagamento: string | null;
  pagamento_regras: string | null;
}

interface QuoteVersionItem {
  id: number;
  quote_version_id: number;
  orc_item_codigo: string | null;
  descricao: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  valor_total: number | null;
}

interface Payment {
  id: number;
  quote_id: number;
  forma_pagamento: string | null;
  condicoes_pagamento: string | null;
  entrada_percentual: number | null;
  entrada_valor: number | null;
  comprovante_entrada_url: string | null;
  comprovante_pagamento_url: string | null;
  comprovante_aprovacao_url: string | null;
  contrato_social_url: string | null;
  observacoes_financeiro: string | null;
}

interface Order {
  id: number;
  quote_id: number;
  codigo_os: string;
  status_os: string;
  created_at: string;
}

interface QuoteFile {
  id: number;
  quote_id: number;
  tipo: string | null;
  arquivo_url: string;
  created_at: string;
}

interface Document {
  id: string;
  label: string;
  url: string;
  fileName: string;
  created_at: string | null;
}

interface FinanceDrawerProps {
  quoteId: number;
  onClose: () => void;
  onUpdated: () => void;
}

const TIPO_LABEL: Record<string, string> = {
  comprovante_pagamento: 'Comprovante de pagamento',
  comprovante_aprovacao: 'Comprovante de aprovacao',
  contrato_social: 'Contrato social',
  comprovante_entrada: 'Comprovante de entrada',
  arte: 'Arte',
  orcamento: 'Orcamento PDF',
  outro: 'Outro',
};

function labelForTipo(tipo: string | null) {
  if (!tipo) return 'Documento';
  return TIPO_LABEL[tipo] ?? tipo;
}

function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    return decodeURIComponent(parts[parts.length - 1]) || 'arquivo';
  } catch {
    return 'arquivo';
  }
}

function CopyBtn({ value, onCopy }: { value: string; onCopy: (t: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCopy(value); }}
      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all flex-shrink-0"
      title="Copiar"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

function ReadOnlyField({
  icon: Icon, label, value, onCopy, href,
}: { icon: React.ElementType; label: string; value: string | null; onCopy: (t: string) => void; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80 last:border-0 group">
      <Icon className="w-4 h-4 text-primary-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        {href ? (
          <a href={href} className="text-sm text-primary-500 hover:underline break-words">{value}</a>
        ) : (
          <p className="text-sm text-gray-800 break-words">{value}</p>
        )}
      </div>
      <CopyBtn value={value} onCopy={onCopy} />
    </div>
  );
}

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function handlePrint(url: string) {
  const win = window.open(url, '_blank');
  if (!win) return;
  win.addEventListener('load', () => {
    try { win.print(); } catch (e) { console.error(e); }
  });
}


export default function FinanceDrawer({ quoteId, onClose, onUpdated }: FinanceDrawerProps) {
  const chatwootUser = useChatwootUser();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [approvedVersion, setApprovedVersion] = useState<QuoteVersion | null>(null);
  const [approvedItems, setApprovedItems] = useState<QuoteVersionItem[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [quoteFiles, setQuoteFiles] = useState<QuoteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');

  const [payEditMode, setPayEditMode] = useState(false);
  const [payForm, setPayForm] = useState({
    forma_pagamento: '',
    condicoes_pagamento: '',
    entrada_percentual: '',
    entrada_valor: '',
    comprovante_entrada_url: '',
    observacoes_financeiro: '',
  });
  const [savingPay, setSavingPay] = useState(false);
  const [showOsModal, setShowOsModal] = useState(false);
  const [osInput, setOsInput] = useState('');
  const [savingOs, setSavingOs] = useState(false);
  const [activitiesKey, setActivitiesKey] = useState(0);

  const activityAuthor = chatwootUser
    ? { id: chatwootUser.id, name: chatwootUser.name, email: chatwootUser.email, account_id: chatwootUser.account_id }
    : null;

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast('Texto copiado');
  }, []);

  function paymentToForm(data: Payment) {
    return {
      forma_pagamento: data.forma_pagamento ?? '',
      condicoes_pagamento: data.condicoes_pagamento ?? '',
      entrada_percentual: data.entrada_percentual?.toString() ?? '',
      entrada_valor: data.entrada_valor?.toString() ?? '',
      comprovante_entrada_url: data.comprovante_entrada_url ?? '',
      observacoes_financeiro: data.observacoes_financeiro ?? '',
    };
  }

  const loadPayment = useCallback(async () => {
    const { data } = await supabase.from('quote_payments').select('*').eq('quote_id', quoteId).maybeSingle();
    setPayment(data ?? null);
    if (data) setPayForm(paymentToForm(data));
  }, [quoteId]);

  function buildFormFromVersion(version: QuoteVersion) {
    return {
      forma_pagamento: version.forma_pagamento ?? '',
      condicoes_pagamento: [version.prazo_pagamento, version.pagamento_regras].filter(Boolean).join(' | '),
      entrada_percentual: '',
      entrada_valor: '',
      comprovante_entrada_url: '',
      observacoes_financeiro: '',
    };
  }

  useEffect(() => {
    async function load() {
      const [qRes, pRes, oRes, fRes] = await Promise.all([
        supabase
          .from('quotes')
          .select('id, codigo_orcamento, cliente_nome, cliente_telefone, cliente_whatsapp, cliente_email, cliente_cpf_cnpj, endereco_entrega, vendedor_nome, descricao_pedido, aprovado_descricao, aprovado_valor_total, valor_aprovado, arquivo_orcamento_url, status, created_at, setor, approved_quote_version_id')
          .eq('id', quoteId)
          .maybeSingle(),
        supabase.from('quote_payments').select('*').eq('quote_id', quoteId).maybeSingle(),
        supabase.from('orders').select('*').eq('quote_id', quoteId).maybeSingle(),
        supabase.from('quote_files').select('*').eq('quote_id', quoteId).order('created_at', { ascending: true }),
      ]);

      const q = qRes.data as QuoteDetail | null;
      setQuote(q);
      setPayment(pRes.data);
      setOrder(oRes.data);
      setQuoteFiles(fRes.data ?? []);

      if (pRes.data) {
        setPayForm(paymentToForm(pRes.data));
      }

      let resolvedApprovedVersion: QuoteVersion | null = null;
      if (q?.approved_quote_version_id) {
        const vRes = await supabase
          .from('quote_versions')
          .select('id, version_number, orcamento_numero, pdf_url, forma_pagamento, prazo_pagamento, pagamento_regras')
          .eq('id', q.approved_quote_version_id)
          .maybeSingle();
        resolvedApprovedVersion = vRes.data ?? null;
        setApprovedVersion(resolvedApprovedVersion);
      } else {
        setApprovedVersion(null);
      }

      if (!pRes.data && resolvedApprovedVersion) {
        setPayForm(buildFormFromVersion(resolvedApprovedVersion));
      }

      if (q?.id) {
        const approvedIdsRes = await supabase
          .from('quote_approved_items')
          .select('quote_version_item_id')
          .eq('quote_id', q.id);
        const ids = (approvedIdsRes.data ?? []).map((r: { quote_version_item_id: number }) => r.quote_version_item_id);
        if (ids.length > 0) {
          const itemsRes = await supabase
            .from('quote_version_items')
            .select('*')
            .in('id', ids)
            .order('orc_item_codigo', { ascending: true });
          setApprovedItems(itemsRes.data ?? []);
        }
      }

      setLoading(false);
    }
    load();
    requestAnimationFrame(() => setOpen(true));
  }, [quoteId]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function handlePayChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setPayForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSavePayment() {
    setSavingPay(true);

    const resolvedQuoteId = quoteId;

    const payload = {
      quote_id: resolvedQuoteId,
      forma_pagamento: payForm.forma_pagamento || null,
      condicoes_pagamento: payForm.condicoes_pagamento || null,
      entrada_percentual: payForm.entrada_percentual ? parseFloat(payForm.entrada_percentual) : null,
      entrada_valor: payForm.entrada_valor ? parseFloat(payForm.entrada_valor) : null,
      comprovante_entrada_url: payForm.comprovante_entrada_url || null,
      observacoes_financeiro: payForm.observacoes_financeiro || null,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabase
      .from('quote_payments')
      .upsert(payload, { onConflict: 'quote_id' })
      .select('*')
      .single();

    setSavingPay(false);

    if (error) {
      console.error('handleSavePayment error — quoteId:', resolvedQuoteId, 'payload:', payload, 'error:', error);
      const detail = (error as { details?: string }).details;
      setToast(`Erro ao salvar financeiro: ${error.message}${detail ? ` — ${detail}` : ''}`);
      return;
    }

    setPayment(saved);
    setPayForm(paymentToForm(saved));
    setPayEditMode(false);
    setToast('Financeiro salvo');
    onUpdated();
    logActivity({
      quote_id: resolvedQuoteId,
      action: 'FINANCEIRO_SALVO',
      message: payForm.forma_pagamento || null,
      author: activityAuthor,
    });
    setActivitiesKey((k) => k + 1);
  }

  async function handleSaveOs() {
    if (!quote || !osInput.trim()) return;
    setSavingOs(true);
    const codigoOs = osInput.trim();

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('quote_id', quote.id)
      .maybeSingle();

    let savedOrder: Order | null = null;
    let orderError = null;

    if (existingOrder) {
      const { data, error } = await supabase
        .from('orders')
        .update({
          codigo_os: codigoOs,
          status_os: 'GERADA',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id)
        .select('*')
        .single();
      savedOrder = data;
      orderError = error;
    } else {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          quote_id: quote.id,
          codigo_os: codigoOs,
          status_os: 'GERADA',
          setor: quote.setor ?? 'GRAFICA_INDUSTRIAL',
          observacoes_pre_impressao: `Cliente: ${quote.cliente_nome ?? ''} | Tel: ${quote.cliente_telefone ?? ''}`,
        })
        .select('*')
        .single();
      savedOrder = data;
      orderError = error;
    }

    if (orderError || !savedOrder) {
      setToast('Erro ao salvar OS');
      setSavingOs(false);
      return;
    }

    await supabase
      .from('quotes')
      .update({ status: 'OS_GERADA', updated_at: new Date().toISOString() })
      .eq('id', quote.id);

    setOrder(savedOrder);
    setQuote({ ...quote, status: 'OS_GERADA' });
    setToast('OS salva com sucesso.');
    onUpdated();
    logActivity({
      quote_id: quote.id,
      action: 'OS_GERADA',
      message: `OS: ${codigoOs}`,
      entity_type: 'ORDER',
      entity_id: String(savedOrder.id),
      author: activityAuthor,
    });
    setActivitiesKey((k) => k + 1);
    setShowOsModal(false);
    setOsInput('');
    setSavingOs(false);
  }

  function copyFinanceSummary() {
    if (!quote) return;
    const lines: string[] = [];
    lines.push(`Cliente: ${quote.cliente_nome}`);
    if (quote.aprovado_descricao) lines.push(`Aprovado: ${quote.aprovado_descricao}`);
    const valorDisplay = quote.valor_aprovado ?? quote.aprovado_valor_total;
    lines.push(`Valor: ${formatCurrency(valorDisplay)}`);
    if (payForm.forma_pagamento) lines.push(`Pagamento: ${payForm.forma_pagamento}`);
    if (payForm.condicoes_pagamento) lines.push(`Condicoes: ${payForm.condicoes_pagamento}`);
    if (payForm.entrada_valor) lines.push(`Entrada: R$ ${parseFloat(payForm.entrada_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    if (order) lines.push(`OS: ${order.codigo_os}`);
    copyToClipboard(lines.join('\n'));
  }

  function buildDocuments(): Document[] {
    const docs: Document[] = [];

    if (payment) {
      const pairs: Array<{ key: keyof Payment; label: string }> = [
        { key: 'comprovante_pagamento_url', label: 'Comprovante de pagamento' },
        { key: 'comprovante_aprovacao_url', label: 'Comprovante de aprovacao' },
        { key: 'contrato_social_url', label: 'Contrato social' },
        { key: 'comprovante_entrada_url', label: 'Comprovante de entrada' },
      ];
      for (const { key, label } of pairs) {
        const url = payment[key] as string | null;
        if (url) {
          docs.push({
            id: `pay_${key}`,
            label,
            url,
            fileName: fileNameFromUrl(url),
            created_at: null,
          });
        }
      }
    }

    for (const f of quoteFiles) {
      docs.push({
        id: `file_${f.id}`,
        label: labelForTipo(f.tipo),
        url: f.arquivo_url,
        fileName: fileNameFromUrl(f.arquivo_url),
        created_at: f.created_at,
      });
    }

    return docs;
  }

  const documents = quote ? buildDocuments() : [];

  const whatsappHref = quote?.cliente_whatsapp
    ? `https://wa.me/${quote.cliente_whatsapp.replace(/\D/g, '')}`
    : quote?.cliente_telefone
      ? `https://wa.me/${quote.cliente_telefone.replace(/\D/g, '')}`
      : undefined;

  const valorAprovado = quote?.valor_aprovado ?? quote?.aprovado_valor_total;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[42%] sm:min-w-[400px] sm:max-w-[580px] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col" style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.08)',
        }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : !quote ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <p className="text-gray-500">Registro nao encontrado.</p>
              <button onClick={handleClose} className="btn-ghost mt-4 text-sm">Fechar</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/80">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-primary-500 truncate">
                      {order ? order.codigo_os : (quote.codigo_orcamento ?? `#${quote.id}`)}
                    </h2>
                    {order && (
                      <p className="text-xs text-gray-400 mt-0.5">Orc. {quote.codigo_orcamento ?? `#${quote.id}`}</p>
                    )}
                  </div>
                  <StatusBadge status={quote.status} />
                  {order && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                      {order.status_os.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex gap-2 px-6 py-3 border-b border-gray-100/80">
                <button onClick={copyFinanceSummary} className="btn-ghost text-xs py-1.5 px-3">
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Copiar resumo financeiro
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

                {/* Dados do cliente */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dados do cliente</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm">
                    <ReadOnlyField icon={User} label="Nome" value={quote.cliente_nome} onCopy={copyToClipboard} />
                    <ReadOnlyField
                      icon={Phone}
                      label="Telefone / WhatsApp"
                      value={quote.cliente_whatsapp ?? quote.cliente_telefone}
                      onCopy={copyToClipboard}
                      href={whatsappHref}
                    />
                    {quote.cliente_whatsapp && quote.cliente_telefone && quote.cliente_whatsapp !== quote.cliente_telefone && (
                      <ReadOnlyField icon={Phone} label="Telefone" value={quote.cliente_telefone} onCopy={copyToClipboard} />
                    )}
                    <ReadOnlyField icon={Mail} label="E-mail" value={quote.cliente_email} onCopy={copyToClipboard} href={quote.cliente_email ? `mailto:${quote.cliente_email}` : undefined} />
                    <ReadOnlyField icon={CreditCard} label="CPF / CNPJ" value={quote.cliente_cpf_cnpj} onCopy={copyToClipboard} />
                    <ReadOnlyField icon={MapPin} label="Endereco de entrega" value={quote.endereco_entrega} onCopy={copyToClipboard} />
                    <ReadOnlyField icon={User} label="Vendedor" value={quote.vendedor_nome} onCopy={copyToClipboard} />
                  </div>
                </section>

                {/* Orcamento aprovado */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" />
                    Orcamento aprovado
                  </h3>

                  {!quote.approved_quote_version_id ? (
                    <div className="glass-card-static p-4 rounded-glass-sm">
                      <p className="text-sm text-gray-400 italic">Ainda nao ha versao aprovada para este orcamento.</p>
                    </div>
                  ) : (
                    <div className="glass-card-static rounded-glass-sm overflow-hidden">
                      {/* Version info */}
                      <div className="px-4 py-3 border-b border-gray-100/80 space-y-2.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-1">Versao aprovada</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {approvedVersion?.version_number != null ? `v${approvedVersion.version_number}` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-1">Num. do orcamento</p>
                            <p className="text-sm font-semibold text-gray-800">
                              {approvedVersion?.orcamento_numero ?? '—'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-1">Valor aprovado</p>
                            <p className="text-xl font-bold text-primary-500">
                              {formatCurrency(valorAprovado)}
                            </p>
                          </div>
                          {valorAprovado != null && (
                            <CopyBtn value={formatCurrency(valorAprovado)} onCopy={copyToClipboard} />
                          )}
                        </div>

                        {approvedVersion?.pdf_url && (
                          <a
                            href={approvedVersion.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary-500 hover:text-primary-700 hover:underline transition-colors font-medium"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver PDF do orcamento aprovado
                          </a>
                        )}
                      </div>

                      {/* Approved items */}
                      {approvedItems.length > 0 ? (
                        <div className="px-4 py-3">
                          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Itens aprovados</p>
                          <div className="overflow-x-auto -mx-1">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="border-b border-gray-100">
                                  <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1.5 px-1">Codigo</th>
                                  <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1.5 px-1">Descricao</th>
                                  <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1.5 px-1">Qtd</th>
                                  <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1.5 px-1">Unit.</th>
                                  <th className="text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide py-1.5 px-1">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {approvedItems.map((item) => (
                                  <tr key={item.id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                                    <td className="py-2 px-1 align-top">
                                      {item.orc_item_codigo ? (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 whitespace-nowrap">
                                          <Tag className="w-2.5 h-2.5" />
                                          {item.orc_item_codigo}
                                        </span>
                                      ) : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="py-2 px-1 text-gray-700 align-top leading-snug">{item.descricao ?? '—'}</td>
                                    <td className="py-2 px-1 text-right text-gray-700 align-top whitespace-nowrap">{item.quantidade ?? '—'}</td>
                                    <td className="py-2 px-1 text-right text-gray-600 align-top whitespace-nowrap text-xs">{formatCurrency(item.preco_unitario)}</td>
                                    <td className="py-2 px-1 text-right font-semibold text-gray-800 align-top whitespace-nowrap">{formatCurrency(item.valor_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : quote.aprovado_descricao ? (
                        <div className="px-4 py-3">
                          <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Itens aprovados (resumo)</p>
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap flex-1">{quote.aprovado_descricao}</p>
                            <CopyBtn value={quote.aprovado_descricao} onCopy={copyToClipboard} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>

                {/* Pagamento da versao aprovada (read-only) */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Pagamento do orcamento (versao aprovada)
                  </h3>
                  <div className="glass-card-static rounded-glass-sm overflow-hidden">
                    {!approvedVersion ? (
                      <div className="p-4 text-sm text-gray-400 italic">Nenhuma versao aprovada selecionada ainda.</div>
                    ) : (
                      <div className="divide-y divide-gray-100/60">
                        {approvedVersion.forma_pagamento ? (
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <DollarSign className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Forma de pagamento</p>
                              <p className="text-sm text-gray-800">{approvedVersion.forma_pagamento}</p>
                            </div>
                          </div>
                        ) : null}
                        {approvedVersion.prazo_pagamento ? (
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <FileText className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Prazo de pagamento</p>
                              <p className="text-sm text-gray-800">{approvedVersion.prazo_pagamento}</p>
                            </div>
                          </div>
                        ) : null}
                        {approvedVersion.pagamento_regras ? (
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            <FileText className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Regras de pagamento</p>
                              <p className="text-sm text-gray-800">{approvedVersion.pagamento_regras}</p>
                            </div>
                          </div>
                        ) : null}
                        {!approvedVersion.forma_pagamento && !approvedVersion.prazo_pagamento && !approvedVersion.pagamento_regras && (
                          <div className="p-4 text-sm text-gray-400 italic">Versao aprovada sem dados de pagamento.</div>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {/* Pagamento */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Financeiro</h3>
                    {!payEditMode && (
                      <button
                        onClick={() => {
                          if (payment) {
                            setPayForm(paymentToForm(payment));
                          } else if (approvedVersion) {
                            setPayForm(buildFormFromVersion(approvedVersion));
                          }
                          setPayEditMode(true);
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-all"
                        title="Editar financeiro"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {!payEditMode ? (
                    <div className="glass-card-static rounded-glass-sm overflow-hidden">
                      {!payment ? (
                        <div className="p-4 text-sm text-gray-400 italic">Nenhum dado financeiro cadastrado.</div>
                      ) : (
                        <div className="divide-y divide-gray-100/60">
                          {payment.forma_pagamento && (
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <DollarSign className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Forma de pagamento</p>
                                <p className="text-sm text-gray-800">{payment.forma_pagamento}</p>
                              </div>
                            </div>
                          )}
                          {payment.condicoes_pagamento && (
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <FileText className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Condicoes</p>
                                <p className="text-sm text-gray-800">{payment.condicoes_pagamento}</p>
                              </div>
                            </div>
                          )}
                          {(payment.entrada_percentual != null || payment.entrada_valor != null) && (
                            <div className="flex items-center gap-3 px-4 py-2.5">
                              <DollarSign className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Entrada</p>
                                <p className="text-sm text-gray-800">
                                  {payment.entrada_valor != null ? formatCurrency(payment.entrada_valor) : ''}
                                  {payment.entrada_valor != null && payment.entrada_percentual != null ? ' ' : ''}
                                  {payment.entrada_percentual != null ? `(${payment.entrada_percentual}%)` : ''}
                                </p>
                              </div>
                            </div>
                          )}
                          {payment.observacoes_financeiro && (
                            <div className="px-4 py-2.5">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Observacoes</p>
                              <p className="text-xs text-gray-600 italic">{payment.observacoes_financeiro}</p>
                            </div>
                          )}
                          {(payment.comprovante_entrada_url || payment.comprovante_pagamento_url || payment.comprovante_aprovacao_url || payment.contrato_social_url) && (
                            <div className="px-4 py-2.5">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mb-2">Comprovantes</p>
                              <div className="space-y-1.5">
                                {([
                                  { label: 'Entrada', url: payment.comprovante_entrada_url },
                                  { label: 'Pagamento', url: payment.comprovante_pagamento_url },
                                  { label: 'Aprovacao', url: payment.comprovante_aprovacao_url },
                                  { label: 'Contrato social', url: payment.contrato_social_url },
                                ] as Array<{ label: string; url: string | null }>).map(({ label, url }) => (
                                  <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">{label}</span>
                                    {url ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => { setViewerUrl(url); setViewerTitle(label); }}
                                          className="inline-flex items-center gap-1 text-[11px] text-primary-500 hover:text-primary-700 transition-colors"
                                        >
                                          <Eye className="w-3 h-3" />
                                          Visualizar
                                        </button>
                                        <span className="text-gray-200">|</span>
                                        <a
                                          href={url}
                                          download
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
                                        >
                                          <Download className="w-3 h-3" />
                                          Baixar
                                        </a>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                      <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">Forma de pagamento</label>
                        <input name="forma_pagamento" value={payForm.forma_pagamento} onChange={handlePayChange} className="input-field text-sm" placeholder="PIX, Boleto, Cartao..." />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">Condicoes de pagamento</label>
                        <input name="condicoes_pagamento" value={payForm.condicoes_pagamento} onChange={handlePayChange} className="input-field text-sm" placeholder="Ex: 50% entrada + 50% na entrega" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">Entrada (%)</label>
                          <input name="entrada_percentual" type="number" step="0.01" min="0" max="100" value={payForm.entrada_percentual} onChange={handlePayChange} className="input-field text-sm" placeholder="50" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">Entrada (R$)</label>
                          <input name="entrada_valor" type="number" step="0.01" min="0" value={payForm.entrada_valor} onChange={handlePayChange} className="input-field text-sm" placeholder="0,00" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">URL comprovante entrada</label>
                        <input name="comprovante_entrada_url" value={payForm.comprovante_entrada_url} onChange={handlePayChange} className="input-field text-sm" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1">Observacoes financeiro</label>
                        <textarea name="observacoes_financeiro" value={payForm.observacoes_financeiro} onChange={handlePayChange} rows={2} className="input-field text-sm resize-none" placeholder="Anotacoes adicionais..." />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setPayEditMode(false)}
                          disabled={savingPay}
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSavePayment}
                          disabled={savingPay || !payForm.forma_pagamento.trim()}
                          className="flex-1 btn-primary text-sm disabled:opacity-50"
                        >
                          {savingPay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          {savingPay ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Documentos */}
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Documentos anexados</h3>
                    {documents.length > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-600 text-[10px] font-bold">
                        {documents.length}
                      </span>
                    )}
                  </div>
                  <div className="glass-card-static rounded-glass-sm overflow-hidden">
                    {documents.length === 0 ? (
                      <div className="flex items-center gap-3 p-4">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Paperclip className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-400">Nenhum documento anexado</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100/80">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                              <Paperclip className="w-3.5 h-3.5 text-primary-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{doc.label}</p>
                              <p className="text-[11px] text-gray-400 truncate">{doc.fileName}</p>
                              {doc.created_at && (
                                <p className="text-[10px] text-gray-300">{formatDate(doc.created_at)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => { setViewerUrl(doc.url); setViewerTitle(doc.label); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-primary-400 hover:text-primary-600 hover:bg-primary-100 transition-all"
                                title="Visualizar"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={doc.url}
                                download={doc.fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                                title="Baixar"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handlePrint(doc.url)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                                title="Imprimir"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {(order || quote.status === 'APROVADO_CLIENTE') && (
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ordem de Servico</h3>
                      {order && (
                        <button
                          onClick={() => { setOsInput(order.codigo_os); setShowOsModal(true); }}
                          className="text-xs text-primary-400 hover:text-primary-600 transition-colors"
                        >
                          Editar OS
                        </button>
                      )}
                    </div>
                    <div className="glass-card-static p-4 rounded-glass-sm">
                      {order ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Truck className="w-4 h-4 text-primary-400" />
                            <div className="flex-1">
                              <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Codigo OS</p>
                              <p className="text-sm font-semibold text-primary-500">{order.codigo_os}</p>
                            </div>
                            <CopyBtn value={order.codigo_os} onCopy={copyToClipboard} />
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] text-gray-400 uppercase tracking-wide">Status:</span>
                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border bg-blue-50 text-blue-700 border-blue-100">
                              {order.status_os.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 pt-1">
                            Gerada em {formatDate(order.created_at)}
                          </p>
                        </div>
                      ) : (
                        <button onClick={() => { setOsInput(''); setShowOsModal(true); }} className="btn-primary text-sm w-full">
                          <ClipboardList className="w-4 h-4" />
                          Adicionar numero de OS
                        </button>
                      )}
                    </div>
                  </section>
                )}

                <section className="mt-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="w-1 h-3 rounded-full bg-gray-300 inline-block" />
                    Atividades
                  </h3>
                  <QuoteActivities quoteId={quote.id} refreshKey={activitiesKey} />
                </section>

                <div className="text-xs text-gray-400 pt-2 pb-4">
                  Criado em {new Date(quote.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {viewerUrl && (
        <FileViewerModal url={viewerUrl} title={viewerTitle} onClose={() => setViewerUrl(null)} />
      )}

      {showOsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => { setShowOsModal(false); setOsInput(''); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-primary-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {order ? 'Editar numero de OS' : 'Adicionar numero de OS'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {quote?.codigo_orcamento ?? `#${quote?.id}`}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Numero da OS</label>
              <input
                type="text"
                value={osInput}
                onChange={(e) => setOsInput(e.target.value)}
                placeholder="Ex: OS-001, 2024/001..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && osInput.trim()) handleSaveOs(); }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowOsModal(false); setOsInput(''); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                disabled={savingOs}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOs}
                disabled={!osInput.trim() || savingOs}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingOs ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {savingOs ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
