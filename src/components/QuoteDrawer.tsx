import { useEffect, useState, useCallback } from 'react';
import {
  X, Copy, User, Phone, MapPin, CreditCard, FileText,
  MessageSquare, Download, Upload, Loader2, CheckCircle2, XCircle,
  ClipboardList, ClipboardCopy, Eye, History, ExternalLink, Printer, Trash2, AlertTriangle, Send,
  Mail, DollarSign, MessageCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { enviarParaImpressao, OrderForPrint } from '../lib/printJobs';
import { logActivity } from '../lib/logActivity';
import { isEligibleForVendorWebhook, sendQuoteToVendorWebhook, getLatestVersionPdfUrl } from '../lib/quoteVendorWebhook';
import { useChatwootUser } from '../contexts/ChatwootUserContext';
import StatusBadge from './StatusBadge';
import ApprovalModal, { ApprovalData } from './ApprovalModal';
import RejectQuoteModal from './RejectQuoteModal';
import Toast from './Toast';
import FileViewerModal from './FileViewerModal';
import QuoteComments from './QuoteComments';
import QuoteActivities from './QuoteActivities';
import DeleteQuoteModal from './DeleteQuoteModal';
import QuoteArtFiles from './QuoteArtFiles';

export interface QuoteVersionItem {
  id: string;
  quote_version_id: string;
  orc_item_codigo: string | null;
  quantidade: number | null;
  descricao: string | null;
  preco_unitario: number | null;
  valor_total: number | null;
  created_at: string;
}

export interface QuoteVersion {
  id: string;
  quote_id: number;
  version_number: number;
  pdf_url: string | null;
  pdf_nome_original: string | null;
  orcamento_numero: string | null;
  prazo_pagamento: string | null;
  forma_pagamento: string | null;
  pagamento_regras: string | null;
  status: string;
  created_at: string;
  items: QuoteVersionItem[];
}

interface QuoteDetailOrder {
  id: number;
  setor: string;
  codigo_os: string;
  status_os: string;
  created_at: string;
}

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
  observacoes: string | null;
  status: string;
  arquivo_arte_url: string | null;
  arquivo_orcamento_url: string | null;
  orcamento_opcoes_json: any | null;
  aprovado_descricao: string | null;
  aprovado_valor_total: number | null;
  approved_quote_version_id: string | null;
  conversa_id: string | null;
  origem: string;
  created_at: string;
  updated_at: string;
  order?: QuoteDetailOrder | null;
}

interface QuotePayment {
  id: number;
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

function handlePrint(url: string) {
  const win = window.open(url, '_blank');
  if (!win) return;
  win.addEventListener('load', () => {
    try { win.print(); } catch (e) { console.error(e); }
  });
}

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—';
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

interface QuoteDrawerProps {
  quoteId: number;
  onClose: () => void;
  onUpdated: () => void;
  onVersionsLoaded?: (versions: QuoteVersion[]) => void;
  setor?: string;
}

function CopyButton({ value, onCopy }: { value: string; onCopy: (text: string) => void }) {
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

function InfoField({
  icon: Icon, label, value, onCopy,
}: {
  icon: React.ElementType; label: string; value: string | null; onCopy: (text: string) => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80 last:border-0 group">
      <Icon className="w-4 h-4 text-primary-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 break-words">{value}</p>
      </div>
      <CopyButton value={value} onCopy={onCopy} />
    </div>
  );
}

export default function QuoteDrawer({ quoteId, onClose, onUpdated, onVersionsLoaded, setor }: QuoteDrawerProps) {
  const chatwootUser = useChatwootUser();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [payment, setPayment] = useState<QuotePayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [activitiesKey, setActivitiesKey] = useState(0);
  const [dragOverPdf, setDragOverPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pedidoEditMode, setPedidoEditMode] = useState(false);
  const [pedidoForm, setPedidoForm] = useState({ descricao_pedido: '', observacoes: '' });
  const [savingPedido, setSavingPedido] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [uploadMode, setUploadMode] = useState<'pdf' | 'manual'>('pdf');
  const [manualText, setManualText] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [sendingPrintJob, setSendingPrintJob] = useState(false);
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<QuoteVersion | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [sendingPdfVersion, setSendingPdfVersion] = useState<string | null>(null);
  const [sendingPdfVendedor, setSendingPdfVendedor] = useState<string | null>(null);
  const [sendingVendorWebhook, setSendingVendorWebhook] = useState(false);
  const [hasOpenQuestions, setHasOpenQuestions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setToast('Texto copiado');
  }, []);

  const activityAuthor = chatwootUser
    ? { id: chatwootUser.id, name: chatwootUser.name, email: chatwootUser.email, account_id: chatwootUser.account_id }
    : null;

  async function fetchOpenQuestionsCount(qId: number) {
    const { count } = await supabase
      .from('quote_comments')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', qId)
      .eq('is_question', true)
      .eq('is_resolved', false);
    setHasOpenQuestions((count ?? 0) > 0);
  }

  useEffect(() => {
    async function load() {
      const [{ data: quoteData }, { data: versionsData }, { data: paymentData }] = await Promise.all([
        supabase
          .from('quotes')
          .select('*, order:orders(id, setor, codigo_os, status_os, created_at)')
          .eq('id', quoteId)
          .maybeSingle(),
        supabase
          .from('quote_versions')
          .select('*, items:quote_version_items(*)')
          .eq('quote_id', quoteId)
          .order('version_number', { ascending: true }),
        supabase
          .from('quote_payments')
          .select('*')
          .eq('quote_id', quoteId)
          .maybeSingle(),
      ]);

      if (quoteData) {
        const normalized = {
          ...quoteData,
          order: Array.isArray(quoteData.order)
            ? (quoteData.order[0] ?? null)
            : (quoteData.order ?? null),
        } as QuoteDetail;
        setQuote(normalized);
      } else {
        setQuote(null);
      }

      const mappedVersions: QuoteVersion[] = (versionsData ?? []).map((v: any) => ({
        ...v,
        items: v.items ?? [],
      }));
      setVersions(mappedVersions);
      onVersionsLoaded?.(mappedVersions);
      setShowUploadArea(mappedVersions.length === 0);
      setPayment(paymentData ?? null);
      if (quoteData) await fetchOpenQuestionsCount(quoteId);
      setLoading(false);
    }
    load();
    requestAnimationFrame(() => setOpen(true));
  }, [quoteId]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  function copyClientData() {
    if (!quote) return;
    const parts = [
      quote.cliente_nome && `Nome: ${quote.cliente_nome}`,
      quote.cliente_telefone && `Telefone: ${quote.cliente_telefone}`,
      quote.cliente_cpf_cnpj && `CPF/CNPJ: ${quote.cliente_cpf_cnpj}`,
      quote.endereco_entrega && `Endereco: ${quote.endereco_entrega}`,
    ].filter(Boolean);
    copyToClipboard(parts.join('\n'));
  }

  function copyAll() {
    if (!quote) return;
    const sections: string[] = [];

    sections.push('--- DADOS DO CLIENTE ---');
    if (quote.cliente_nome) sections.push(`Nome: ${quote.cliente_nome}`);
    if (quote.cliente_telefone) sections.push(`Telefone: ${quote.cliente_telefone}`);
    if (quote.cliente_whatsapp) sections.push(`WhatsApp: ${quote.cliente_whatsapp}`);
    if (quote.cliente_cpf_cnpj) sections.push(`CPF/CNPJ: ${quote.cliente_cpf_cnpj}`);
    if (quote.endereco_entrega) sections.push(`Endereco: ${quote.endereco_entrega}`);

    sections.push('\n--- PEDIDO ---');
    sections.push(quote.descricao_pedido);
    if (quote.observacoes) sections.push(`\nObservacoes: ${quote.observacoes}`);

    if (quote.aprovado_descricao) {
      sections.push('\n--- APROVADO ---');
      sections.push(quote.aprovado_descricao);
      if (quote.aprovado_valor_total != null) {
        sections.push(`Valor: R$ ${quote.aprovado_valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
    }

    copyToClipboard(sections.join('\n'));
  }

  async function uploadAndSavePdf(file: File) {
    if (!quote) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (file.type !== 'application/pdf' && fileExt !== 'pdf') {
      setToast('Apenas arquivos PDF são aceitos');
      return;
    }

    if (file.size > 350 * 1024 * 1024) {
      setToast('Arquivo muito grande. Máximo permitido: 350MB.');
      return;
    }

    setUploadingPdf(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `orcamento_${quote.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('artwork-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('artwork-files')
        .getPublicUrl(fileName);

      const { data: maxVersionData } = await supabase
        .from('quote_versions')
        .select('version_number')
        .eq('quote_id', quote.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersionNumber = maxVersionData ? maxVersionData.version_number + 1 : 1;

      const { data: newVersion, error: versionError } = await supabase
        .from('quote_versions')
        .insert({
          quote_id: quote.id,
          version_number: nextVersionNumber,
          pdf_url: publicUrl,
          pdf_nome_original: file.name,
          status: 'ENVIADO',
        })
        .select('*, items:quote_version_items(*)')
        .maybeSingle();

      if (versionError) throw versionError;

      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ status: 'PRONTO_PARA_ENVIAR' })
        .eq('id', quote.id);

      if (quoteError) console.error('Error updating quote status:', quoteError);

      const mapped: QuoteVersion = { ...newVersion, items: newVersion?.items ?? [] };
      const updatedVersions = [...versions, mapped];
      setVersions(updatedVersions);
      onVersionsLoaded?.(updatedVersions);
      setQuote(prev => prev ? { ...prev, status: 'PRONTO_PARA_ENVIAR' } : null);
      setShowUploadArea(false);
      onUpdated();
      setToast('Orcamento enviado com sucesso');

      logActivity({
        quote_id: quote.id,
        action: 'UPLOAD_ORCAMENTO',
        message: `Versão ${nextVersionNumber}: ${file.name}`,
        entity_type: 'QUOTE_VERSION',
        entity_id: String(newVersion!.id),
        author: activityAuthor,
      });

      logActivity({
        quote_id: quote.id,
        action: 'PRONTO_PARA_ENVIAR',
        author: activityAuthor,
      });

      try {
        const n8nPayload = {
          quote_id: quote.id,
          quote_version_id: newVersion!.id,
          orcamento_pdf_url: newVersion!.pdf_url,
          pdf_nome_original: newVersion!.pdf_nome_original || file.name,
        };
        console.log('N8N payload', n8nPayload);
        const webhookRes = await fetch('https://n8n.anexusdigital.com.br/webhook/67ad75af-f836-428e-a892-929bed0c3247', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload),
        });
        if (webhookRes.ok) {
          setToast('Enviado para leitura automatica');
          logActivity({
            quote_id: quote.id,
            action: 'IA_PARSE_OK',
            entity_type: 'QUOTE_VERSION',
            entity_id: String(newVersion!.id),
            author: activityAuthor,
          });
        } else {
          console.error('N8N webhook error', webhookRes.status, await webhookRes.text().catch(() => ''));
          setToast('Falha ao enviar para leitura automatica');
        }
      } catch (webhookError) {
        console.error('N8N webhook exception', webhookError);
        setToast('Falha ao enviar para leitura automatica');
      }
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      const msg = error?.message ?? '';
      if (msg.includes('Payload too large') || msg.includes('413')) {
        setToast('Arquivo muito grande. Máximo permitido: 350MB.');
      } else if (msg.includes('mime') || msg.includes('type')) {
        setToast('Tipo de arquivo não permitido');
      } else if (msg.includes('duplicate') || msg.includes('already exists')) {
        setToast('Erro: arquivo duplicado. Tente novamente');
      } else if (msg) {
        setToast(`Erro no upload: ${msg}`);
      } else {
        setToast('Erro ao fazer upload. Tente novamente');
      }
    }

    setUploadingPdf(false);
  }

  function handlePdfFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadAndSavePdf(file);
    }
  }

  function handleDragOverPdf(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPdf(true);
  }

  function handleDragLeavePdf(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPdf(false);
  }

  function handleDropPdf(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPdf(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (file.type !== 'application/pdf' && ext !== 'pdf') {
        setToast('Apenas arquivos PDF são aceitos');
        return;
      }
      uploadAndSavePdf(file);
    }
  }

  async function handleSavePedido() {
    if (!quote) return;
    setSavingPedido(true);

    const { error } = await supabase
      .from('quotes')
      .update({
        descricao_pedido: pedidoForm.descricao_pedido.trim(),
        observacoes: pedidoForm.observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quote.id);

    if (error) {
      setToast('Erro ao salvar pedido');
      setSavingPedido(false);
      return;
    }

    setQuote((prev) => prev ? {
      ...prev,
      descricao_pedido: pedidoForm.descricao_pedido.trim(),
      observacoes: pedidoForm.observacoes.trim() || null,
    } : null);
    setPedidoEditMode(false);
    setSavingPedido(false);
    setToast('Pedido atualizado');
    onUpdated();
    logActivity({
      quote_id: quote.id,
      action: 'PEDIDO_EDITADO',
      author: activityAuthor,
    });
  }

  async function handleManualVersion() {
    if (!quote || !manualText.trim()) return;
    setSavingManual(true);

    const { data: maxVersionData } = await supabase
      .from('quote_versions')
      .select('version_number')
      .eq('quote_id', quote.id)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersionNumber = maxVersionData ? maxVersionData.version_number + 1 : 1;

    const { data: newVersion, error } = await supabase
      .from('quote_versions')
      .insert({
        quote_id: quote.id,
        version_number: nextVersionNumber,
        pdf_url: null,
        pdf_nome_original: null,
        orcamento_numero: manualText.trim(),
        status: 'ENVIADO',
      })
      .select('*, items:quote_version_items(*)')
      .maybeSingle();

    if (error || !newVersion) {
      setToast('Erro ao salvar orçamento manual');
      setSavingManual(false);
      return;
    }

    await supabase
      .from('quotes')
      .update({ status: 'PRONTO_PARA_ENVIAR' })
      .eq('id', quote.id);

    const mapped: QuoteVersion = { ...newVersion, items: newVersion.items ?? [] };
    const updatedVersions = [...versions, mapped];
    setVersions(updatedVersions);
    onVersionsLoaded?.(updatedVersions);
    setQuote((prev) => prev ? { ...prev, status: 'PRONTO_PARA_ENVIAR' } : null);
    setManualText('');
    setShowUploadArea(false);
    onUpdated();
    setToast('Orçamento registrado com sucesso');

    logActivity({
      quote_id: quote.id,
      action: 'UPLOAD_ORCAMENTO',
      message: `Versão ${nextVersionNumber}: orçamento manual`,
      entity_type: 'QUOTE_VERSION',
      entity_id: String(newVersion.id),
      author: activityAuthor,
    });
    logActivity({
      quote_id: quote.id,
      action: 'PRONTO_PARA_ENVIAR',
      author: activityAuthor,
    });

    setSavingManual(false);
  }

  async function handleApproval(data: ApprovalData) {
    if (!quote) return;

    const { error: quoteError } = await supabase
      .from('quotes')
      .update({
        aprovado_descricao: data.descricao,
        aprovado_valor_total: data.valor,
        status: 'APROVADO_CLIENTE',
        aprovado_em: new Date().toISOString(),
        ...(data.approved_quote_version_id
          ? { approved_quote_version_id: data.approved_quote_version_id }
          : {}),
      })
      .eq('id', quote.id);

    if (quoteError) {
      console.error('Error updating quote:', quoteError);
      setToast('Erro ao atualizar orcamento');
      return;
    }

    const { data: existingPayment } = await supabase
      .from('quote_payments')
      .select('id')
      .eq('quote_id', quote.id)
      .maybeSingle();

    const paymentData = {
      quote_id: quote.id,
      comprovante_pagamento_url: data.comprovante_pagamento_url || null,
      comprovante_aprovacao_url: data.comprovante_aprovacao_url || null,
      contrato_social_url: data.contrato_social_url || null,
    };

    if (existingPayment) {
      const { error: paymentError } = await supabase
        .from('quote_payments')
        .update(paymentData)
        .eq('id', existingPayment.id);

      if (paymentError) {
        console.error('Error updating payment:', paymentError);
      }
    } else {
      const { error: paymentError } = await supabase
        .from('quote_payments')
        .insert(paymentData);

      if (paymentError) {
        console.error('Error creating payment:', paymentError);
      }
    }

    setQuote({
      ...quote,
      aprovado_descricao: data.descricao,
      aprovado_valor_total: data.valor,
      status: 'APROVADO_CLIENTE'
    });
    setShowApproval(false);
    onUpdated();
    setToast('Orcamento aprovado');

    logActivity({
      quote_id: quote.id,
      action: 'APROVADO_CLIENTE',
      message: data.descricao
        ? `${data.descricao}${data.valor ? ` — R$ ${Number(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}`
        : data.valor ? `R$ ${Number(data.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null,
      author: activityAuthor,
    });
    setActivitiesKey((k) => k + 1);
  }

  async function handleEnviarParaImpressaoDrawer() {
    if (!quote?.order) return;
    setSendingPrintJob(true);
    const orderForPrint: OrderForPrint = {
      id: quote.order.id,
      setor: quote.order.setor,
      codigo_os: quote.order.codigo_os,
      quote: {
        id: quote.id,
        cliente_nome: quote.cliente_nome,
        cliente_telefone: quote.cliente_telefone,
        observacoes: quote.observacoes,
        aprovado_descricao: quote.aprovado_descricao,
      },
    };
    const result = await enviarParaImpressao(orderForPrint);
    setToast(result.message);
    if (result.ok) {
      logActivity({
        quote_id: quote.id,
        action: 'ENVIADO_IMPRESSAO',
        message: `OS: ${quote.order.codigo_os}`,
        entity_type: 'ORDER',
        entity_id: String(quote.order.id),
        author: activityAuthor,
      });
      setActivitiesKey((k) => k + 1);
    }
    setSendingPrintJob(false);
  }

  async function handleDeleteVersion() {
    if (!deleteVersionTarget || !quote) return;
    setDeletingVersion(true);

    if (quote.approved_quote_version_id === deleteVersionTarget.id) {
      const { error: clearError } = await supabase
        .from('quotes')
        .update({ approved_quote_version_id: null })
        .eq('id', quote.id);
      if (clearError) {
        setToast('Erro ao excluir versao');
        setDeletingVersion(false);
        return;
      }
      setQuote((prev) => prev ? { ...prev, approved_quote_version_id: null } : null);
    }

    const { error } = await supabase
      .from('quote_versions')
      .delete()
      .eq('id', deleteVersionTarget.id);

    if (error) {
      setToast('Erro ao excluir versao');
      setDeletingVersion(false);
      return;
    }

    const remaining = versions.filter((v) => v.id !== deleteVersionTarget.id);

    const renumbered = [...remaining]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((v, i) => ({ ...v, version_number: i + 1 }));

    for (const v of renumbered) {
      await supabase
        .from('quote_versions')
        .update({ version_number: v.version_number })
        .eq('id', v.id);
    }

    if (renumbered.length === 0) {
      await supabase
        .from('quotes')
        .update({ status: 'ORCAMENTO_PENDENTE' })
        .eq('id', quote.id);
      setQuote((prev) => prev ? { ...prev, status: 'ORCAMENTO_PENDENTE' } : null);
    }

    setVersions(renumbered);
    onVersionsLoaded?.(renumbered);
    setShowUploadArea(renumbered.length === 0);
    setDeleteVersionTarget(null);
    setDeleteConfirmText('');
    onUpdated();
    setToast('Versao excluida');
    setDeletingVersion(false);
  }

  function handleReject() {
    setShowRejectModal(true);
  }

  async function handleRejectConfirm(justificativa: string) {
    if (!quote) return;
    setRejectLoading(true);

    const { error } = await supabase
      .from('quotes')
      .update({
        status: 'NAO_APROVADO',
        recusa_justificativa: justificativa,
        recusado_em: new Date().toISOString(),
        recusado_por: chatwootUser?.name ?? null,
      })
      .eq('id', quote.id);

    if (!error) {
      await supabase.from('quote_comments').insert({
        quote_id: quote.id,
        message: `Recusado: ${justificativa}`,
        is_question: true,
        author_chatwoot_user_id: chatwootUser?.id ?? null,
        author_name: chatwootUser?.name ?? 'Sistema',
      });

      logActivity({
        quote_id: quote.id,
        action: 'RECUSADO',
        message: justificativa,
        author: activityAuthor,
      });

      setQuote({ ...quote, status: 'NAO_APROVADO' });
      setShowRejectModal(false);
      setActivitiesKey((k) => k + 1);
      onUpdated();
      setToast('Orcamento recusado com sucesso.');
    } else {
      setToast('Erro ao recusar orcamento.');
    }
    setRejectLoading(false);
  }


  async function handleSendPdfToClient(version: QuoteVersion) {
    if (!quote) return;

    const conversaId = quote.conversa_id;
    const pdfUrl = version.pdf_url;
    const orcamentoNumero = version.orcamento_numero;
    const accountId = import.meta.env.VITE_CHATWOOT_ACCOUNT_ID;
    const accessToken = import.meta.env.VITE_CHATWOOT_ACCESS_TOKEN;
    const chatwootBaseUrl = import.meta.env.VITE_CHATWOOT_BASE_URL;

    if (!conversaId) {
      setToast('Conversa do Chatwoot nao vinculada a este orcamento');
      return;
    }
    if (!pdfUrl) {
      setToast('Esta versao nao possui PDF');
      return;
    }
    if (!accountId || !accessToken || !chatwootBaseUrl) {
      setToast('Configuracao do Chatwoot incompleta. Verifique as variaveis de ambiente');
      return;
    }

    setSendingPdfVersion(version.id);

    try {
      let blob: Blob;
      try {
        const fetchResp = await fetch(pdfUrl);
        if (!fetchResp.ok) throw new Error(`HTTP ${fetchResp.status}`);
        blob = await fetchResp.blob();
      } catch (fetchErr: any) {
        if (fetchErr?.message?.includes('CORS') || fetchErr?.message?.includes('Failed to fetch')) {
          setToast('Erro de CORS: o bucket do Supabase precisa permitir acesso publico');
        } else {
          setToast(`Erro ao baixar o PDF: ${fetchErr?.message ?? 'falha desconhecida'}`);
        }
        setSendingPdfVersion(null);
        return;
      }

      const fileName = `orcamento-${orcamentoNumero ?? 'sem-numero'}.pdf`;
      const file = new File([blob], fileName, { type: blob.type || 'application/pdf' });

      const formData = new FormData();
      formData.append('content', 'Ola! Segue o orcamento conforme solicitado.');
      formData.append('message_type', 'outgoing');
      formData.append('private', 'false');
      formData.append('attachments[]', file);

      const url = `${chatwootBaseUrl}/api/v1/accounts/${accountId}/conversations/${conversaId}/messages`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { api_access_token: accessToken },
        body: formData,
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        if (resp.status === 413) {
          setToast('Arquivo muito grande para envio via Chatwoot');
        } else {
          setToast(`Erro ao enviar PDF: ${errorText.slice(0, 120)}`);
        }
        setSendingPdfVersion(null);
        return;
      }

      setToast('PDF enviado na conversa!');
      logActivity({
        quote_id: quote.id,
        action: 'ENVIADO_CHATWOOT',
        message: `Versão ${version.version_number ?? ''} enviada via Chatwoot`,
        entity_type: 'QUOTE_VERSION',
        entity_id: String(version.id),
        author: activityAuthor,
      });
      setActivitiesKey((k) => k + 1);
    } catch (err: any) {
      setToast(`Erro inesperado: ${err?.message ?? 'tente novamente'}`);
    }

    setSendingPdfVersion(null);
  }

  async function handleSendPdfToVendedor(version: QuoteVersion) {
    if (!quote) return;

    const pdfUrl = version.pdf_url;
    const evolutionUrl = import.meta.env.VITE_EVOLUTION_API_URL;
    const evolutionInstance = import.meta.env.VITE_EVOLUTION_INSTANCE;
    const evolutionKey = import.meta.env.VITE_EVOLUTION_API_KEY;
    const vendedorNumero = import.meta.env.VITE_VENDEDOR_WHATSAPP;

    if (!pdfUrl) { setToast('Esta versão não possui PDF'); return; }
    if (!evolutionUrl || !evolutionInstance || !evolutionKey || !vendedorNumero) {
      setToast('Configuração da Evolution API incompleta. Verifique as variáveis de ambiente.');
      return;
    }

    setSendingPdfVendedor(version.id);

    try {
      const fileName = version.pdf_nome_original ?? `orcamento-v${version.version_number}.pdf`;
      const caption = [
        `📋 Orçamento pronto para envio ao cliente!`,
        `Cliente: ${quote.cliente_nome}`,
        version.orcamento_numero ? `Nº: ${version.orcamento_numero}` : null,
        quote.descricao_pedido ? `Pedido: ${quote.descricao_pedido.slice(0, 120)}` : null,
      ].filter(Boolean).join('\n');

      const resp = await fetch(
        `${evolutionUrl}/message/sendMedia/${evolutionInstance}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({
            number: vendedorNumero,
            mediatype: 'document',
            mimetype: 'application/pdf',
            media: pdfUrl,
            fileName,
            caption,
          }),
        }
      );

      if (!resp.ok) {
        const errorText = await resp.text();
        setToast(`Erro ao enviar para vendedor: ${errorText.slice(0, 120)}`);
        setSendingPdfVendedor(null);
        return;
      }

      setToast('PDF enviado para o vendedor via WhatsApp!');
      logActivity({
        quote_id: quote.id,
        action: 'ENVIADO_VENDEDOR',
        message: `Versão ${version.version_number} enviada ao vendedor via WhatsApp`,
        entity_type: 'QUOTE_VERSION',
        entity_id: String(version.id),
        author: activityAuthor,
      });
      setActivitiesKey((k) => k + 1);
    } catch (err: any) {
      setToast(`Erro inesperado: ${err?.message ?? 'tente novamente'}`);
    }

    setSendingPdfVendedor(null);
  }

  async function handleEnviarOrcamentoAoVendedor() {
    const pdfUrl = getLatestVersionPdfUrl(versions);
    if (!quote || !quote.vendedor_nome || !pdfUrl) return;
    setSendingVendorWebhook(true);
    const result = await sendQuoteToVendorWebhook({
      vendedorNome: quote.vendedor_nome,
      pdfUrl,
      clienteNome: quote.cliente_nome,
      codigoOrcamento: quote.codigo_orcamento,
      quoteId: quote.id,
    });
    setToast(result.message);
    if (result.ok) {
      logActivity({
        quote_id: quote.id,
        action: 'ENVIADO_VENDEDOR_WEBHOOK',
        message: `Orçamento enviado a ${quote.vendedor_nome} via webhook n8n`,
        entity_type: 'QUOTE',
        entity_id: String(quote.id),
        author: activityAuthor,
      });
      setActivitiesKey((k) => k + 1);
    }
    setSendingVendorWebhook(false);
  }

  const whatsappHref = quote?.cliente_whatsapp
    ? `https://wa.me/${quote.cliente_whatsapp.replace(/\D/g, '')}`
    : quote?.cliente_telefone
      ? `https://wa.me/${quote.cliente_telefone.replace(/\D/g, '')}`
      : undefined;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[42%] sm:min-w-[380px] sm:max-w-[560px] transition-transform duration-300 ease-out ${
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
              <p className="text-gray-500">Orcamento nao encontrado.</p>
              <button onClick={handleClose} className="btn-ghost mt-4 text-sm">Fechar</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/80">
                <div className="flex items-center gap-3 min-w-0">
                  <h2 className="text-lg font-semibold text-primary-500 truncate">
                    {quote.codigo_orcamento ?? `#${quote.id}`}
                  </h2>
                  <StatusBadge status={quote.status} />
                  {quote.origem === 'AGENTE' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 leading-none flex-shrink-0">
                      AGENTE
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
                <button onClick={copyClientData} className="btn-ghost text-xs py-1.5 px-3">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Copiar cliente
                </button>
                <button onClick={copyAll} className="btn-ghost text-xs py-1.5 px-3">
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Copiar tudo
                </button>
                <div className="flex-1" />
                {quote && isEligibleForVendorWebhook({
                  setor: quote.order?.setor ?? setor,
                  vendedor_nome: quote.vendedor_nome,
                  status: quote.status,
                  pdfUrl: getLatestVersionPdfUrl(versions),
                }) && (
                  <button
                    onClick={handleEnviarOrcamentoAoVendedor}
                    disabled={sendingVendorWebhook}
                    title="Enviar orçamento ao vendedor via WhatsApp"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingVendorWebhook ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MessageCircle className="w-3.5 h-3.5" />
                    )}
                    Enviar orçamento
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={quote.status === 'OS_GERADA'}
                  title={quote.status === 'OS_GERADA' ? 'Orçamentos com OS gerada não podem ser excluídos.' : 'Excluir orçamento'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dados do cliente</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm">
                    <InfoField icon={User} label="Nome" value={quote.cliente_nome} onCopy={copyToClipboard} />
                    {quote.cliente_whatsapp || quote.cliente_telefone ? (
                      <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80 group">
                        <Phone className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Telefone / WhatsApp</p>
                          {whatsappHref ? (
                            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:underline break-words">
                              {quote.cliente_whatsapp ?? quote.cliente_telefone}
                            </a>
                          ) : (
                            <p className="text-sm text-gray-800 break-words">{quote.cliente_whatsapp ?? quote.cliente_telefone}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(quote.cliente_whatsapp ?? quote.cliente_telefone ?? ''); }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all flex-shrink-0"
                          title="Copiar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}
                    {quote.cliente_whatsapp && quote.cliente_telefone && quote.cliente_whatsapp !== quote.cliente_telefone && (
                      <InfoField icon={Phone} label="Telefone" value={quote.cliente_telefone} onCopy={copyToClipboard} />
                    )}
                    {quote.cliente_email ? (
                      <div className="flex items-center gap-3 py-2.5 border-b border-gray-100/80 group">
                        <Mail className="w-4 h-4 text-primary-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">E-mail</p>
                          <a href={`mailto:${quote.cliente_email}`} className="text-sm text-primary-500 hover:underline break-words">{quote.cliente_email}</a>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(quote.cliente_email!); }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all flex-shrink-0"
                          title="Copiar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}
                    <InfoField icon={CreditCard} label="CPF / CNPJ" value={quote.cliente_cpf_cnpj} onCopy={copyToClipboard} />
                    <InfoField icon={MapPin} label="Endereco" value={quote.endereco_entrega} onCopy={copyToClipboard} />
                    <InfoField icon={User} label="Vendedor" value={quote.vendedor_nome} onCopy={copyToClipboard} />
                  </div>
                </section>

                {payment && (payment.forma_pagamento || payment.condicoes_pagamento || payment.entrada_valor != null) && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Financeiro</h3>
                    <div className="glass-card-static p-4 rounded-glass-sm space-y-2.5">
                      {payment.forma_pagamento && (
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-4 h-4 text-primary-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Forma de pagamento</p>
                            <p className="text-sm text-gray-800">{payment.forma_pagamento}</p>
                          </div>
                        </div>
                      )}
                      {payment.condicoes_pagamento && (
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-primary-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Condicoes</p>
                            <p className="text-sm text-gray-800">{payment.condicoes_pagamento}</p>
                          </div>
                        </div>
                      )}
                      {(payment.entrada_percentual != null || payment.entrada_valor != null) && (
                        <div className="flex items-center gap-3">
                          <DollarSign className="w-4 h-4 text-primary-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Entrada</p>
                            <p className="text-sm text-gray-800">
                              {payment.entrada_valor != null ? formatCurrency(payment.entrada_valor) : ''}
                              {payment.entrada_valor != null && payment.entrada_percentual != null ? ' ' : ''}
                              {payment.entrada_percentual != null ? `(${payment.entrada_percentual}%)` : ''}
                            </p>
                          </div>
                        </div>
                      )}
                      {payment.observacoes_financeiro && (
                        <p className="text-xs text-gray-500 italic">{payment.observacoes_financeiro}</p>
                      )}
                    </div>
                  </section>
                )}

                {payment && (() => {
                  const paymentDocs: Array<{ label: string; url: string }> = [
                    { label: 'Comprovante de pagamento', url: payment.comprovante_pagamento_url ?? '' },
                    { label: 'Comprovante de aprovacao', url: payment.comprovante_aprovacao_url ?? '' },
                    { label: 'Contrato social', url: payment.contrato_social_url ?? '' },
                    { label: 'Comprovante de entrada', url: payment.comprovante_entrada_url ?? '' },
                  ].filter((d) => !!d.url);

                  if (paymentDocs.length === 0) return null;

                  return (
                    <section>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Documentos anexados</h3>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-600 text-[10px] font-semibold">
                          {paymentDocs.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {paymentDocs.map((doc) => {
                          let fileName = doc.url;
                          try {
                            const path = new URL(doc.url).pathname;
                            const parts = path.split('/');
                            fileName = decodeURIComponent(parts[parts.length - 1]) || doc.url;
                          } catch { /* keep original */ }

                          return (
                            <div key={doc.label} className="glass-card-static rounded-glass-sm px-4 py-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-primary-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-400 leading-none mb-0.5">{doc.label}</p>
                                <p className="text-sm text-gray-700 truncate">{fileName}</p>
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
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
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
                          );
                        })}
                      </div>
                    </section>
                  );
                })()}

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pedido</h3>
                    <div className="flex items-center gap-2">
                      {!pedidoEditMode && (
                        <>
                          <button
                            onClick={() => copyToClipboard(
                              quote.descricao_pedido + (quote.observacoes ? `\n\nObs: ${quote.observacoes}` : '')
                            )}
                            className="text-xs text-primary-400 hover:text-primary-600 flex items-center gap-1 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copiar
                          </button>
                          <button
                            onClick={() => {
                              setPedidoForm({
                                descricao_pedido: quote.descricao_pedido,
                                observacoes: quote.observacoes ?? '',
                              });
                              setPedidoEditMode(true);
                            }}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-all"
                            title="Editar pedido"
                          >
                            <ClipboardCopy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {pedidoEditMode ? (
                    <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                      <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                          Descrição do pedido <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={pedidoForm.descricao_pedido}
                          onChange={(e) => setPedidoForm((p) => ({ ...p, descricao_pedido: e.target.value }))}
                          rows={4}
                          className="input-field-textarea w-full resize-none"
                          placeholder="Descreva os itens e serviços solicitados..."
                          disabled={savingPedido}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                          Observações
                        </label>
                        <textarea
                          value={pedidoForm.observacoes}
                          onChange={(e) => setPedidoForm((p) => ({ ...p, observacoes: e.target.value }))}
                          rows={2}
                          className="input-field-textarea w-full resize-none"
                          placeholder="Informações adicionais..."
                          disabled={savingPedido}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setPedidoEditMode(false)}
                          disabled={savingPedido}
                          className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSavePedido}
                          disabled={savingPedido || !pedidoForm.descricao_pedido.trim()}
                          className="flex-1 btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {savingPedido ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {savingPedido ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-3.5 h-3.5 text-primary-400" />
                          <span className="text-[11px] text-gray-400 uppercase tracking-wide">Descricao</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.descricao_pedido}</p>
                      </div>
                      {quote.observacoes && (
                        <div className="pt-2 border-t border-gray-100/80">
                          <div className="flex items-center gap-2 mb-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-primary-400" />
                            <span className="text-[11px] text-gray-400 uppercase tracking-wide">Observacoes</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{quote.observacoes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <QuoteArtFiles
                  quoteId={quote.id}
                  onToast={setToast}
                  onViewFile={(url, title) => { setViewerUrl(url); setViewerTitle(title); }}
                />

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Versoes de orcamento
                    </h3>
                    {versions.length > 0 && !showUploadArea && (
                      <button
                        onClick={() => setShowUploadArea(true)}
                        className="text-xs text-primary-500 hover:text-primary-700 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        Nova versao
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {versions.length > 0 && (() => {
                      const maxV = Math.max(...versions.map((v) => v.version_number));
                      return [...versions].reverse().map((v) => {
                        const isLatest = v.version_number === maxV;
                        return (
                          <div
                            key={v.id}
                            className={`glass-card-static rounded-glass-sm px-4 py-3 ${
                              isLatest ? 'border border-primary-200 bg-primary-50/30' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isLatest ? 'bg-primary-100' : 'bg-gray-100'
                              }`}>
                                <FileText className={`w-4 h-4 ${isLatest ? 'text-primary-500' : 'text-gray-400'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-semibold ${isLatest ? 'text-primary-600' : 'text-gray-700'}`}>
                                    v{v.version_number}
                                  </span>
                                  {isLatest && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-600 leading-none">
                                      Mais recente
                                    </span>
                                  )}
                                  {!v.pdf_url && v.orcamento_numero && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 leading-none">
                                      Manual
                                    </span>
                                  )}
                                  {v.pdf_url && v.orcamento_numero && (
                                    <span className="text-xs text-gray-500 truncate">{v.orcamento_numero}</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {new Date(v.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {v.pdf_url && (
                                <>
                                  <button
                                    onClick={() => { setViewerUrl(v.pdf_url!); setViewerTitle(`Orcamento v${v.version_number}`); }}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-400 hover:text-primary-600 hover:bg-primary-100 transition-all"
                                    title="Visualizar"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <a
                                    href={v.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                                    title="Abrir PDF"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={() => handleSendPdfToClient(v)}
                                    disabled={!!sendingPdfVersion || !quote?.conversa_id}
                                    title={
                                      !quote?.conversa_id
                                        ? 'Conversa do Chatwoot nao vinculada a este orcamento'
                                        : 'Enviar PDF ao Cliente via Chatwoot'
                                    }
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                      !quote?.conversa_id
                                        ? 'text-gray-200 cursor-not-allowed'
                                        : sendingPdfVersion === v.id
                                          ? 'text-blue-400 bg-blue-50 cursor-wait'
                                          : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'
                                    }`}
                                  >
                                    {sendingPdfVersion === v.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4" />
                                    )}
                                  </button>
                                  {quote?.origem === 'AGENTE' && (
                                    <button
                                      onClick={() => handleSendPdfToVendedor(v)}
                                      disabled={!!sendingPdfVendedor}
                                      title="Enviar PDF ao Vendedor via WhatsApp"
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                        sendingPdfVendedor === v.id
                                          ? 'text-green-400 bg-green-50 cursor-wait'
                                          : 'text-green-500 hover:text-green-700 hover:bg-green-50'
                                      }`}
                                    >
                                      {sendingPdfVendedor === v.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <MessageSquare className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => { setDeleteVersionTarget(v); setDeleteConfirmText(''); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                title="Excluir versao"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            </div>
                            {!v.pdf_url && v.orcamento_numero && (
                              <div className="mt-3 pt-3 border-t border-gray-100/80">
                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {v.orcamento_numero}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {showUploadArea && (
                      <div className="relative border border-gray-200 rounded-lg overflow-hidden">
                        {/* Tabs PDF / Manual */}
                        <div className="flex border-b border-gray-200">
                          <button
                            type="button"
                            onClick={() => setUploadMode('pdf')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                              uploadMode === 'pdf'
                                ? 'bg-white text-primary-600 border-b-2 border-primary-500 -mb-px'
                                : 'bg-gray-50 text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => setUploadMode('manual')}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                              uploadMode === 'manual'
                                ? 'bg-white text-primary-600 border-b-2 border-primary-500 -mb-px'
                                : 'bg-gray-50 text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Digitar manualmente
                          </button>
                        </div>

                        {/* Conteúdo da tab ativa */}
                        {uploadMode === 'pdf' ? (
                          <div
                            onDragOver={handleDragOverPdf}
                            onDragLeave={handleDragLeavePdf}
                            onDrop={handleDropPdf}
                            className={`relative transition-all ${
                              dragOverPdf
                                ? 'bg-primary-50/50'
                                : uploadingPdf ? 'bg-gray-50' : 'hover:bg-primary-50/20'
                            } ${uploadingPdf ? 'pointer-events-none opacity-60' : ''}`}
                          >
                            <label className="flex flex-col items-center justify-center gap-2 p-5 cursor-pointer">
                              {uploadingPdf ? (
                                <>
                                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                                  <div className="text-center">
                                    <span className="text-sm font-medium text-gray-700">Fazendo upload...</span>
                                    <p className="text-xs text-gray-500 mt-1">Por favor, aguarde</p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Upload className={`w-7 h-7 ${dragOverPdf ? 'text-primary-500' : 'text-gray-400'}`} />
                                  <div className="text-center">
                                    <span className="text-sm font-medium text-gray-700">
                                      Arraste o PDF ou clique para selecionar
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {versions.length > 0
                                        ? `Sera criada a versao v${Math.max(...versions.map((v) => v.version_number)) + 1}`
                                        : 'Sera criada a versao v1'}
                                    </p>
                                  </div>
                                </>
                              )}
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={handlePdfFileChange}
                                className="hidden"
                                disabled={uploadingPdf}
                              />
                            </label>
                          </div>
                        ) : (
                          <div className="p-3 space-y-2">
                            <textarea
                              value={manualText}
                              onChange={(e) => setManualText(e.target.value)}
                              rows={4}
                              className="input-field-textarea w-full resize-none"
                              placeholder="Descreva o orçamento: itens, valores, condições..."
                              disabled={savingManual}
                            />
                            <button
                              type="button"
                              onClick={handleManualVersion}
                              disabled={savingManual || !manualText.trim()}
                              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {savingManual ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              {savingManual ? 'Salvando...' : 'Salvar e marcar pronto para envio'}
                            </button>
                          </div>
                        )}

                        {/* Botão fechar */}
                        {versions.length > 0 && !uploadingPdf && !savingManual && (
                          <button
                            onClick={() => setShowUploadArea(false)}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                {quote.status !== 'OS_GERADA' && quote.status !== 'APROVADO_CLIENTE' && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aprovacao do cliente</h3>
                    <div className="glass-card-static p-4 rounded-glass-sm space-y-3">
                      {hasOpenQuestions && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200">
                          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <p className="text-xs text-orange-700">
                            Ha uma duvida pendente. Resolva antes de aprovar.
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => setShowApproval(true)}
                        disabled={hasOpenQuestions}
                        className="btn-primary text-sm w-full disabled:opacity-40 disabled:cursor-not-allowed"
                        title={hasOpenQuestions ? 'Ha uma duvida pendente. Resolva antes de aprovar.' : undefined}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovado pelo cliente
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={rejectLoading}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-red-500 font-medium border border-red-200 rounded-glass-sm transition-all duration-200 hover:bg-red-50 hover:border-red-300 text-sm disabled:opacity-50"
                      >
                        {rejectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {rejectLoading ? 'Recusando...' : 'Nao aprovado / cancelado'}
                      </button>
                    </div>
                  </section>
                )}

                {quote.aprovado_descricao && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aprovado</h3>
                    <div className="glass-card-static p-4 rounded-glass-sm space-y-2">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.aprovado_descricao}</p>
                      {quote.aprovado_valor_total != null && (
                        <p className="text-lg font-semibold text-primary-500">
                          R$ {quote.aprovado_valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {(quote.status === 'APROVADO_CLIENTE' || quote.status === 'OS_GERADA') && quote.order && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ordem de Servico</h3>
                    <div className="glass-card-static p-4 rounded-glass-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <ClipboardList className="w-4 h-4 text-primary-400" />
                          <div className="flex-1">
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-0.5">Codigo OS</p>
                            <p className="text-sm font-semibold text-primary-500">{quote.order.codigo_os}</p>
                          </div>
                          <CopyButton value={quote.order.codigo_os} onCopy={copyToClipboard} />
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-gray-400 uppercase tracking-wide">Status:</span>
                          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border bg-blue-50 text-blue-700 border-blue-100">
                            {quote.order.status_os.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 pt-1">
                          Gerada em {new Date(quote.order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {quote.status === 'OS_GERADA' && quote.order?.setor === 'GRAFICA_EXPRESSA' && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Impressao</h3>
                    <div className="glass-card-static p-4 rounded-glass-sm">
                      <button
                        onClick={handleEnviarParaImpressaoDrawer}
                        disabled={sendingPrintJob}
                        className="btn-primary text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingPrintJob ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Printer className="w-4 h-4" />
                        )}
                        {sendingPrintJob ? 'Enviando...' : 'Enviar para impressao'}
                      </button>
                    </div>
                  </section>
                )}

                <QuoteComments
                  quoteId={quote.id}
                  quoteVersionId={quote.approved_quote_version_id}
                  onToast={setToast}
                  onStatusChange={async (newStatus) => {
                    const { data } = await supabase
                      .from('quotes')
                      .select('*')
                      .eq('id', quote.id)
                      .maybeSingle();
                    if (data) {
                      const normalized = {
                        ...data,
                        order: Array.isArray(data.order) ? (data.order[0] ?? null) : (data.order ?? null),
                      } as QuoteDetail;
                      setQuote(normalized);
                    } else {
                      setQuote((prev) => prev ? { ...prev, status: newStatus } : null);
                    }
                    await fetchOpenQuestionsCount(quote.id);
                  }}
                  onPendingCountChange={async () => {
                    await fetchOpenQuestionsCount(quote.id);
                  }}
                />

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

      {deleteVersionTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => { setDeleteVersionTarget(null); setDeleteConfirmText(''); }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Excluir versao v{deleteVersionTarget.version_number}?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Esta acao nao pode ser desfeita. O arquivo PDF sera removido permanentemente.
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-gray-700 mb-2">
                Para confirmar, digite <span className="font-semibold text-gray-900">excluir</span> abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="excluir"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmText === 'excluir') handleDeleteVersion();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteVersionTarget(null); setDeleteConfirmText(''); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                disabled={deletingVersion}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteVersion}
                disabled={deleteConfirmText !== 'excluir' || deletingVersion}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingVersion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingVersion ? 'Excluindo...' : 'Excluir versao'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproval && quote && (
        <ApprovalModal
          quote={quote}
          onClose={() => setShowApproval(false)}
          onConfirm={handleApproval}
        />
      )}

      {showRejectModal && (
        <RejectQuoteModal
          onCancel={() => setShowRejectModal(false)}
          onConfirm={handleRejectConfirm}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {viewerUrl && (
        <FileViewerModal
          url={viewerUrl}
          title={viewerTitle}
          onClose={() => setViewerUrl(null)}
        />
      )}

      {showDeleteModal && quote && (
        <DeleteQuoteModal
          quoteId={quote.id}
          quoteCode={quote.codigo_orcamento ?? `#${quote.id}`}
          quoteStatus={quote.status}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            onUpdated();
            handleClose();
          }}
          onToast={setToast}
        />
      )}

    </>
  );
}
