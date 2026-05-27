import { useState, useEffect } from 'react';
import { X, Loader2, FileText, CheckSquare, Square, AlertCircle, Plus, Trash2, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileToR2, R2UploadError } from '../lib/r2Upload';
import { validateUploadFile, ACCEPT_ATTR } from '../lib/uploadValidation';

interface QuoteVersionItem {
  id: string;
  orc_item_codigo: string | null;
  descricao: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  valor_total: number | null;
}

interface QuoteVersion {
  id: string;
  version_number: number;
  orcamento_numero: string | null;
  created_at: string;
  items: QuoteVersionItem[];
}

interface ApprovalModalProps {
  quote: {
    id: number;
    cliente_cpf_cnpj?: string | null;
    orcamento_opcoes_json?: any | null;
  };
  onClose: () => void;
  onConfirm: (data: ApprovalData) => Promise<void>;
}

export interface ApprovalData {
  descricao: string;
  valor: number;
  approved_quote_version_id?: string;
  comprovante_pagamento_url?: string;
  comprovante_aprovacao_url?: string;
  contrato_social_url?: string;
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface FileListProps {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  label: string;
  dragActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  error?: string;
}

function FileList({ files, onAdd, onRemove, label, dragActive, onDragOver, onDragLeave, onDrop, error }: FileListProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      {files.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-xs text-green-800 truncate">{f.name}</span>
              </div>
              <button type="button" onClick={() => onRemove(i)} className="p-1 text-gray-400 hover:text-red-500 rounded flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-lg transition-all ${
          dragActive ? 'border-primary-500 bg-primary-50/50' : error ? 'border-red-300' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
        }`}
      >
        <label className="flex items-center justify-center gap-2 p-4 cursor-pointer">
          <Plus className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {files.length === 0 ? 'Adicionar arquivo' : 'Adicionar mais'}
          </span>
          <input
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            onChange={(e) => onAdd(Array.from(e.target.files || []))}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

export default function ApprovalModal({ quote, onClose, onConfirm }: ApprovalModalProps) {
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [manualNumero, setManualNumero] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);

  const [comprovantePagamentoFiles, setComprovantePagamentoFiles] = useState<File[]>([]);
  const [comprovanteAprovacaoFiles, setComprovanteAprovacaoFiles] = useState<File[]>([]);
  const [orcamentoAnexoFiles, setOrcamentoAnexoFiles] = useState<File[]>([]);
  const [possuiContratoSocial, setPossuiContratoSocial] = useState<string>('nao');
  const [contratoSocial, setContratoSocial] = useState<File | null>(null);

  const [paymentTerms, setPaymentTerms] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRules, setPaymentRules] = useState('');

  const [dragOverPagamento, setDragOverPagamento] = useState(false);
  const [dragOverAprovacao, setDragOverAprovacao] = useState(false);
  const [dragOverOrcamento, setDragOverOrcamento] = useState(false);
  const [dragOverContrato, setDragOverContrato] = useState(false);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});

  function setFileError(key: string, msg: string) {
    setFileErrors((prev) => ({ ...prev, [key]: msg }));
  }
  function clearFileError(key: string) {
    setFileErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  useEffect(() => {
    async function loadVersions() {
      const { data } = await supabase
        .from('quote_versions')
        .select('*, items:quote_version_items(*)')
        .eq('quote_id', quote.id)
        .order('version_number', { ascending: false });

      const mapped: QuoteVersion[] = (data ?? []).map((v: any) => ({
        ...v,
        items: v.items ?? [],
      }));
      setVersions(mapped);

      if (mapped.length > 0) {
        setSelectedVersionId(mapped[0].id);
      }
      setVersionsLoading(false);
    }
    loadVersions();
  }, [quote.id]);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? null;
  const items = selectedVersion?.items ?? [];

  const checkedItemObjects = items.filter((it) => checkedItems.has(it.id));
  const totalAprovado = checkedItemObjects.reduce((sum, it) => sum + (it.valor_total ?? 0), 0);

  useEffect(() => {
    if (checkedItemObjects.length === 0) return;
    const descParts = checkedItemObjects.map((it) => {
      const parts = [it.orc_item_codigo, it.descricao].filter(Boolean);
      return parts.join(' - ');
    });
    setDescricao(descParts.join(', '));
    setValor(totalAprovado.toFixed(2));
  }, [checkedItems, selectedVersionId]);

  useEffect(() => {
    setCheckedItems(new Set());
  }, [selectedVersionId]);

  useEffect(() => {
    if (!selectedVersionId) return;
    async function loadPaymentFields() {
      const { data } = await supabase
        .from('quote_versions')
        .select('prazo_pagamento, forma_pagamento, pagamento_regras')
        .eq('id', selectedVersionId)
        .maybeSingle();
      setPaymentTerms(data?.prazo_pagamento ?? '');
      setPaymentMethod(data?.forma_pagamento ?? '');
      setPaymentRules(data?.pagamento_regras ?? '');
    }
    loadPaymentFields();
  }, [selectedVersionId]);

  function toggleItem(id: string) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedItems.size === items.length) {
      setCheckedItems(new Set());
    } else {
      setCheckedItems(new Set(items.map((it) => it.id)));
    }
  }

  async function uploadFile(file: File, tipo: string): Promise<string> {
    const validation = validateUploadFile(file);
    if (!validation.ok) throw new R2UploadError(validation.errorMessage!);
    const { publicUrl } = await uploadFileToR2({ folder: 'aprovacoes', quoteId: quote.id, tipo, file });
    return publicUrl;
  }

  function addFiles(prev: File[], incoming: File[], errorKey: string): File[] {
    const valid: File[] = [];
    for (const f of incoming) {
      const r = validateUploadFile(f);
      if (!r.ok) { setFileError(errorKey, r.errorMessage!); continue; }
      clearFileError(errorKey);
      valid.push(f);
    }
    return [...prev, ...valid];
  }

  function handleDragFiles(
    e: React.DragEvent,
    setter: React.Dispatch<React.SetStateAction<File[]>>,
    setDrag: (v: boolean) => void,
    errorKey: string,
  ) {
    e.preventDefault(); e.stopPropagation(); setDrag(false);
    const files = Array.from(e.dataTransfer.files);
    setter((prev) => addFiles(prev, files, errorKey));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let resolvedVersionId = selectedVersionId;

      // Criar versão manual quando nenhuma versão do sistema foi selecionada
      if (!resolvedVersionId && manualNumero.trim()) {
        const { data: maxV } = await supabase
          .from('quote_versions')
          .select('version_number')
          .eq('quote_id', quote.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextNum = maxV ? maxV.version_number + 1 : 1;

        const { data: newVersion, error: vErr } = await supabase
          .from('quote_versions')
          .insert({
            quote_id: quote.id,
            version_number: nextNum,
            pdf_url: null,
            orcamento_numero: manualNumero.trim() || null,
            status: 'ENVIADO',
          })
          .select('id')
          .single();

        if (vErr || !newVersion) {
          setLoading(false);
          return;
        }
        resolvedVersionId = newVersion.id;
      }

      // Upload de todos os arquivos em paralelo
      const pagamentoUrls: string[] = [];
      const aprovacaoUrls: string[] = [];
      const orcamentoUrls: string[] = [];

      await Promise.all([
        ...comprovantePagamentoFiles.map((f) =>
          uploadFile(f, 'COMPROVANTE_PAGAMENTO').then((url) => pagamentoUrls.push(url))
        ),
        ...comprovanteAprovacaoFiles.map((f) =>
          uploadFile(f, 'COMPROVANTE_APROVACAO').then((url) => aprovacaoUrls.push(url))
        ),
        ...orcamentoAnexoFiles.map((f) =>
          uploadFile(f, 'ORCAMENTO_ANEXO').then((url) => orcamentoUrls.push(url))
        ),
      ]);

      let contratoUrl: string | undefined;
      if (possuiContratoSocial === 'sim' && contratoSocial) {
        contratoUrl = await uploadFile(contratoSocial, 'CONTRATO_SOCIAL');
      }

      const data: ApprovalData = {
        descricao,
        valor: parseFloat(valor),
        approved_quote_version_id: resolvedVersionId || undefined,
        comprovante_pagamento_url: pagamentoUrls[0],
        comprovante_aprovacao_url: aprovacaoUrls[0],
        contrato_social_url: contratoUrl,
      };

      if (resolvedVersionId) {
        await supabase
          .from('quote_versions')
          .update({
            prazo_pagamento: paymentTerms || null,
            forma_pagamento: paymentMethod || null,
            pagamento_regras: paymentRules || null,
          })
          .eq('id', resolvedVersionId);
      }

      await supabase.from('quote_approved_items').delete().eq('quote_id', quote.id);

      if (checkedItemObjects.length > 0 && resolvedVersionId) {
        await supabase.from('quote_approved_items').insert(
          checkedItemObjects.map((it) => ({
            quote_id: quote.id,
            quote_version_id: resolvedVersionId,
            quote_version_item_id: it.id,
          }))
        );
      }

      // Salvar arquivos extras em quote_files
      const extraFiles: Array<{ quote_id: number; tipo: string; arquivo_url: string }> = [];

      pagamentoUrls.slice(1).forEach((url) =>
        extraFiles.push({ quote_id: quote.id, tipo: 'comprovante_pagamento', arquivo_url: url })
      );
      aprovacaoUrls.slice(1).forEach((url) =>
        extraFiles.push({ quote_id: quote.id, tipo: 'comprovante_aprovacao', arquivo_url: url })
      );
      orcamentoUrls.forEach((url) =>
        extraFiles.push({ quote_id: quote.id, tipo: 'orcamento', arquivo_url: url })
      );

      if (extraFiles.length > 0) {
        await supabase.from('quote_files').insert(extraFiles);
      }

      await onConfirm(data);
    } catch (error) {
      console.error('Error submitting approval:', error);
      setLoading(false);
    }
  }

  const allChecked = items.length > 0 && checkedItems.size === items.length;
  const someChecked = checkedItems.size > 0 && checkedItems.size < items.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-card-static relative w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title text-lg">Aprovar orcamento</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {versionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
            </div>
          ) : (
            <>
              {/* Seleção de versão */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Versao do orcamento
                </label>

                <div className={`flex gap-4 ${versions.length > 0 ? 'flex-col sm:flex-row sm:items-start' : ''}`}>
                  {/* Versões do sistema */}
                  {versions.length > 0 && (
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-2">Versões do sistema</p>
                      <div className="flex flex-wrap gap-2">
                        {[...versions].sort((a, b) => a.version_number - b.version_number).map((v, idx) => {
                          const isLatest = idx === versions.length - 1;
                          const isSelected = v.id === selectedVersionId;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => { setSelectedVersionId(v.id); setManualNumero(''); }}
                              className={`inline-flex flex-col items-start px-3.5 py-2.5 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-primary-50/40'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold">Versao {v.version_number}</span>
                                {isLatest && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-600'
                                  }`}>
                                    Mais recente
                                  </span>
                                )}
                              </div>
                              <div className={`flex items-center gap-2 mt-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                                {v.orcamento_numero && (
                                  <span className="text-[11px]">{v.orcamento_numero}</span>
                                )}
                                <span className="text-[11px]">
                                  {new Date(v.created_at).toLocaleDateString('pt-BR', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                  })}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Número manual */}
                  <div className={versions.length > 0 ? 'sm:w-52 sm:flex-shrink-0' : 'w-full'}>
                    <p className="text-xs text-gray-500 mb-2">
                      {versions.length > 0 ? 'Ou digitar número' : 'Número do orçamento'}
                    </p>
                    <input
                      type="text"
                      value={manualNumero}
                      onChange={(e) => {
                        setManualNumero(e.target.value);
                        if (e.target.value) setSelectedVersionId('');
                      }}
                      className="input-field"
                      placeholder="Ex: ORC-2024/001"
                    />
                    {!selectedVersionId && manualNumero.trim() && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        <p className="text-[11px] text-amber-600">Será registrado como versão manual</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itens da versão */}
              {selectedVersion && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Itens da versao — marque o que foi aprovado
                  </label>

                  {items.length === 0 ? (
                    <div className="flex items-center gap-2.5 p-4 rounded-lg bg-gray-50 border border-gray-200">
                      <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-500">Esta versao nao possui itens cadastrados.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="w-10 px-3 py-2.5 text-center">
                              <button type="button" onClick={toggleAll} className="text-gray-400 hover:text-primary-500 transition-colors">
                                {allChecked ? (
                                  <CheckSquare className="w-4 h-4 text-primary-500" />
                                ) : someChecked ? (
                                  <CheckSquare className="w-4 h-4 text-primary-300" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Codigo</th>
                            <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Descricao</th>
                            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Qtd</th>
                            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Unitario</th>
                            <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((it) => {
                            const checked = checkedItems.has(it.id);
                            return (
                              <tr
                                key={it.id}
                                onClick={() => toggleItem(it.id)}
                                className={`cursor-pointer transition-colors ${
                                  checked ? 'bg-primary-50/60' : 'bg-white hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-3 py-2.5 text-center">
                                  {checked ? (
                                    <CheckSquare className="w-4 h-4 text-primary-500 mx-auto" />
                                  ) : (
                                    <Square className="w-4 h-4 text-gray-300 mx-auto" />
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600 font-mono text-xs whitespace-nowrap">
                                  {it.orc_item_codigo ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-gray-700 max-w-[200px]">
                                  <span className="line-clamp-2 leading-snug">{it.descricao ?? '—'}</span>
                                </td>
                                <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{it.quantidade ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums whitespace-nowrap">
                                  {it.preco_unitario != null ? `R$ ${fmt(it.preco_unitario)}` : '—'}
                                </td>
                                <td className={`px-3 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                                  checked ? 'text-primary-600' : 'text-gray-700'
                                }`}>
                                  {it.valor_total != null ? `R$ ${fmt(it.valor_total)}` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {checkedItems.size > 0 && (
                          <tfoot>
                            <tr className="bg-primary-50 border-t border-primary-100">
                              <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-primary-700 text-right">
                                Valor total aprovado ({checkedItems.size} {checkedItems.size === 1 ? 'item' : 'itens'}):
                              </td>
                              <td className="px-3 py-2.5 text-right text-base font-bold text-primary-600 whitespace-nowrap tabular-nums">
                                R$ {fmt(totalAprovado)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descricao do aprovado <span className="text-red-500">*</span>
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              rows={3}
              className="input-field resize-none"
              placeholder="Descreva o que foi aprovado pelo cliente..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor total (R$) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
              className="input-field"
              placeholder="0,00"
            />
          </div>

          {quote.cliente_cpf_cnpj && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
              <div className="input-field bg-gray-50">{quote.cliente_cpf_cnpj}</div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Forma de pagamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prazo de pagamento</label>
                <input type="text" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="input-field" placeholder="Ex: 30/60/90 dias" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</label>
                <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field" placeholder="Ex: Boleto, PIX, Cartao" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacoes / Regras de pagamento</label>
                <textarea value={paymentRules} onChange={(e) => setPaymentRules(e.target.value)} rows={3} className="input-field resize-none" placeholder="Regras ou observacoes adicionais sobre o pagamento..." />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Documentos</h3>

            <div className="space-y-5">
              {/* Orçamento em anexo */}
              <FileList
                label="Orçamento (anexo)"
                files={orcamentoAnexoFiles}
                onAdd={(files) => setOrcamentoAnexoFiles((prev) => addFiles(prev, files, 'orcamento'))}
                onRemove={(i) => setOrcamentoAnexoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                dragActive={dragOverOrcamento}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverOrcamento(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverOrcamento(false); }}
                onDrop={(e) => handleDragFiles(e, setOrcamentoAnexoFiles, setDragOverOrcamento, 'orcamento')}
                error={fileErrors.orcamento}
              />

              {/* Comprovante de pagamento */}
              <FileList
                label="Comprovante de pagamento"
                files={comprovantePagamentoFiles}
                onAdd={(files) => setComprovantePagamentoFiles((prev) => addFiles(prev, files, 'pagamento'))}
                onRemove={(i) => setComprovantePagamentoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                dragActive={dragOverPagamento}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPagamento(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPagamento(false); }}
                onDrop={(e) => handleDragFiles(e, setComprovantePagamentoFiles, setDragOverPagamento, 'pagamento')}
                error={fileErrors.pagamento}
              />

              {/* Comprovante de aprovação */}
              <FileList
                label="Comprovante de aprovacao"
                files={comprovanteAprovacaoFiles}
                onAdd={(files) => setComprovanteAprovacaoFiles((prev) => addFiles(prev, files, 'aprovacao'))}
                onRemove={(i) => setComprovanteAprovacaoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                dragActive={dragOverAprovacao}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverAprovacao(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverAprovacao(false); }}
                onDrop={(e) => handleDragFiles(e, setComprovanteAprovacaoFiles, setDragOverAprovacao, 'aprovacao')}
                error={fileErrors.aprovacao}
              />

              {/* Contrato social */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente possui contrato social?
                </label>
                <select value={possuiContratoSocial} onChange={(e) => setPossuiContratoSocial(e.target.value)} className="input-field">
                  <option value="nao">Nao</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              {possuiContratoSocial === 'sim' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload do contrato social</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverContrato(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverContrato(false); }}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation(); setDragOverContrato(false);
                      const file = e.dataTransfer.files?.[0];
                      if (!file) return;
                      const r = validateUploadFile(file);
                      if (!r.ok) { setFileError('contrato', r.errorMessage!); return; }
                      clearFileError('contrato');
                      setContratoSocial(file);
                    }}
                    className={`relative border-2 border-dashed rounded-lg transition-all ${
                      dragOverContrato ? 'border-primary-500 bg-primary-50/50' : fileErrors.contrato ? 'border-red-300' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                    }`}
                  >
                    <label className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer">
                      <FileText className={`w-8 h-8 ${dragOverContrato ? 'text-primary-500' : 'text-gray-400'}`} />
                      <div className="text-center">
                        <span className={`text-sm font-medium ${fileErrors.contrato ? 'text-red-600' : 'text-gray-700'}`}>
                          {fileErrors.contrato ?? (contratoSocial ? contratoSocial.name : 'Arraste ou clique para selecionar')}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG, ZIP, CDR, AI — máx. 2GB</p>
                      </div>
                      <input
                        type="file"
                        accept={ACCEPT_ATTR}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const r = validateUploadFile(file);
                          if (!r.ok) { setFileError('contrato', r.errorMessage!); return; }
                          clearFileError('contrato');
                          setContratoSocial(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                'Confirmar aprovacao'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
