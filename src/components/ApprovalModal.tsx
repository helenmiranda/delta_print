import { useState, useEffect } from 'react';
import { X, Loader2, Upload, FileText, CheckSquare, Square, AlertCircle } from 'lucide-react';
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

export default function ApprovalModal({ quote, onClose, onConfirm }: ApprovalModalProps) {
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [comprovantePagamento, setComprovantePagamento] = useState<File | null>(null);
  const [comprovanteAprovacao, setComprovanteAprovacao] = useState<File | null>(null);
  const [possuiContratoSocial, setPossuiContratoSocial] = useState<string>('nao');
  const [contratoSocial, setContratoSocial] = useState<File | null>(null);

  const [paymentTerms, setPaymentTerms] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentRules, setPaymentRules] = useState('');

  const [dragOverPagamento, setDragOverPagamento] = useState(false);
  const [dragOverAprovacao, setDragOverAprovacao] = useState(false);
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

    const { publicUrl } = await uploadFileToR2({
      folder: 'aprovacoes',
      quoteId: quote.id,
      tipo,
      file,
    });
    return publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setUploading(true);

    try {
      const data: ApprovalData = {
        descricao,
        valor: parseFloat(valor),
        approved_quote_version_id: selectedVersionId || undefined,
      };

      if (comprovantePagamento) {
        data.comprovante_pagamento_url = await uploadFile(comprovantePagamento, 'COMPROVANTE_PAGAMENTO');
      }
      if (comprovanteAprovacao) {
        data.comprovante_aprovacao_url = await uploadFile(comprovanteAprovacao, 'COMPROVANTE_APROVACAO');
      }
      if (possuiContratoSocial === 'sim' && contratoSocial) {
        data.contrato_social_url = await uploadFile(contratoSocial, 'CONTRATO_SOCIAL');
      }

      setUploading(false);

      if (selectedVersionId) {
        const { error: versionUpdateError } = await supabase
          .from('quote_versions')
          .update({
            prazo_pagamento: paymentTerms || null,
            forma_pagamento: paymentMethod || null,
            pagamento_regras: paymentRules || null,
          })
          .eq('id', selectedVersionId);
        if (versionUpdateError) console.error('Error updating payment fields:', versionUpdateError);
      }

      await supabase
        .from('quote_approved_items')
        .delete()
        .eq('quote_id', quote.id);

      if (checkedItemObjects.length > 0 && selectedVersionId) {
        const rows = checkedItemObjects.map((it) => ({
          quote_id: quote.id,
          quote_version_id: selectedVersionId,
          quote_version_item_id: it.id,
        }));
        const { error: insertError } = await supabase
          .from('quote_approved_items')
          .insert(rows);
        if (insertError) console.error('Error inserting approved items:', insertError);
      }

      await onConfirm(data);
    } catch (error) {
      console.error('Error submitting approval:', error);
      setUploading(false);
      setLoading(false);
    }
  }

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void,
    onError?: (msg: string) => void,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validateUploadFile(file);
    if (!result.ok) {
      onError?.(result.errorMessage!);
      return;
    }
    setter(file);
  }

  function handleDragOver(e: React.DragEvent, setDrag: (v: boolean) => void) {
    e.preventDefault(); e.stopPropagation(); setDrag(true);
  }
  function handleDragLeave(e: React.DragEvent, setDrag: (v: boolean) => void) {
    e.preventDefault(); e.stopPropagation(); setDrag(false);
  }
  function handleDrop(
    e: React.DragEvent,
    setter: (f: File | null) => void,
    setDrag: (v: boolean) => void,
    onError?: (msg: string) => void,
  ) {
    e.preventDefault(); e.stopPropagation(); setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const result = validateUploadFile(file);
    if (!result.ok) { onError?.(result.errorMessage!); return; }
    setter(file);
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
          ) : versions.length === 0 ? (
            <div className="flex items-center gap-2.5 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Nenhuma versao de orcamento encontrada. Envie um PDF de orcamento antes de aprovar.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Versao do orcamento
                </label>
                <div className="flex flex-wrap gap-2">
                  {[...versions].sort((a, b) => a.version_number - b.version_number).map((v, idx) => {
                    const isLatest = idx === versions.length - 1;
                    const isSelected = v.id === selectedVersionId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVersionId(v.id)}
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
                              <button
                                type="button"
                                onClick={toggleAll}
                                className="text-gray-400 hover:text-primary-500 transition-colors"
                              >
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
                                <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                                  {it.quantidade ?? '—'}
                                </td>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prazo de pagamento
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="input-field"
                  placeholder="Ex: 30/60/90 dias"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de pagamento
                </label>
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field"
                  placeholder="Ex: Boleto, PIX, Cartao"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observacoes / Regras de pagamento
                </label>
                <textarea
                  value={paymentRules}
                  onChange={(e) => setPaymentRules(e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Regras ou observacoes adicionais sobre o pagamento..."
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Documentos</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comprovante de pagamento
                </label>
                <div
                  onDragOver={(e) => handleDragOver(e, setDragOverPagamento)}
                  onDragLeave={(e) => handleDragLeave(e, setDragOverPagamento)}
                  onDrop={(e) => handleDrop(e, (f) => { clearFileError('pagamento'); setComprovantePagamento(f); }, setDragOverPagamento, (msg) => setFileError('pagamento', msg))}
                  className={`relative border-2 border-dashed rounded-lg transition-all ${
                    dragOverPagamento ? 'border-primary-500 bg-primary-50/50' : fileErrors.pagamento ? 'border-red-300' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                  }`}
                >
                  <label className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer">
                    <Upload className={`w-8 h-8 ${dragOverPagamento ? 'text-primary-500' : 'text-gray-400'}`} />
                    <div className="text-center">
                      <span className={`text-sm font-medium ${fileErrors.pagamento ? 'text-red-600' : 'text-gray-700'}`}>
                        {fileErrors.pagamento ?? (comprovantePagamento ? comprovantePagamento.name : 'Arraste ou clique para selecionar')}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG, ZIP, CDR, AI — máx. 350MB</p>
                    </div>
                    <input type="file" accept={ACCEPT_ATTR} onChange={(e) => handleFileChange(e, (f) => { clearFileError('pagamento'); setComprovantePagamento(f); }, (msg) => setFileError('pagamento', msg))} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comprovante de aprovacao
                </label>
                <div
                  onDragOver={(e) => handleDragOver(e, setDragOverAprovacao)}
                  onDragLeave={(e) => handleDragLeave(e, setDragOverAprovacao)}
                  onDrop={(e) => handleDrop(e, (f) => { clearFileError('aprovacao'); setComprovanteAprovacao(f); }, setDragOverAprovacao, (msg) => setFileError('aprovacao', msg))}
                  className={`relative border-2 border-dashed rounded-lg transition-all ${
                    dragOverAprovacao ? 'border-primary-500 bg-primary-50/50' : fileErrors.aprovacao ? 'border-red-300' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/30'
                  }`}
                >
                  <label className="flex flex-col items-center justify-center gap-2 p-6 cursor-pointer">
                    <Upload className={`w-8 h-8 ${dragOverAprovacao ? 'text-primary-500' : 'text-gray-400'}`} />
                    <div className="text-center">
                      <span className={`text-sm font-medium ${fileErrors.aprovacao ? 'text-red-600' : 'text-gray-700'}`}>
                        {fileErrors.aprovacao ?? (comprovanteAprovacao ? comprovanteAprovacao.name : 'Arraste ou clique para selecionar')}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG, ZIP, CDR, AI — máx. 350MB</p>
                    </div>
                    <input type="file" accept={ACCEPT_ATTR} onChange={(e) => handleFileChange(e, (f) => { clearFileError('aprovacao'); setComprovanteAprovacao(f); }, (msg) => setFileError('aprovacao', msg))} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente possui contrato social?
                </label>
                <select
                  value={possuiContratoSocial}
                  onChange={(e) => setPossuiContratoSocial(e.target.value)}
                  className="input-field"
                >
                  <option value="nao">Nao</option>
                  <option value="sim">Sim</option>
                </select>
              </div>

              {possuiContratoSocial === 'sim' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload do contrato social
                  </label>
                  <div
                    onDragOver={(e) => handleDragOver(e, setDragOverContrato)}
                    onDragLeave={(e) => handleDragLeave(e, setDragOverContrato)}
                    onDrop={(e) => handleDrop(e, (f) => { clearFileError('contrato'); setContratoSocial(f); }, setDragOverContrato, (msg) => setFileError('contrato', msg))}
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
                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG, ZIP, CDR, AI — máx. 350MB</p>
                      </div>
                      <input type="file" accept={ACCEPT_ATTR} onChange={(e) => handleFileChange(e, (f) => { clearFileError('contrato'); setContratoSocial(f); }, (msg) => setFileError('contrato', msg))} className="hidden" />
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
                  {uploading ? 'Enviando arquivos...' : 'Salvando...'}
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
