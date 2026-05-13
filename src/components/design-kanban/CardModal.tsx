// Modal centralizado de detalhes de um card — substitui o CardDrawer lateral
// Layout 2 colunas em desktop (esquerda: conteúdo / direita: metadados), 1 coluna no mobile
// Suporta modo somente leitura (readOnly) para exibição no Histórico
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, User, Phone, Calendar, ChevronDown, Tag, Plus,
  AlertCircle, Clock, UserCheck, AlignLeft, Archive, Trash2, RotateCcw,
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import type { DesignCard, DesignColumn, DesignLabel, DesignCardPriority } from '../../types/design.types';
import { useDesignLabels } from '../../hooks/useDesignLabels';
import CardChecklist from './CardChecklist';
import CardComments from './CardComments';
import CardAttachments from './CardAttachments';
import CardActivityLog from './CardActivityLog';

interface CardModalProps {
  cardId: string | null;
  columns: DesignColumn[];
  userEmail: string;
  userName: string;
  readOnly?: boolean;
  onClose: () => void;
  onCardUpdated: () => void;
  onCardArchived?: (cardId: string) => void;
  onCardDeleted?: (cardId: string) => void;
  onReopenCard?: (cardId: string) => void;
}

const PRIORITY_OPTIONS: { value: DesignCardPriority; label: string; color: string }[] = [
  { value: 'baixa',   label: 'Baixa',   color: '#9ca3af' },
  { value: 'media',   label: 'Média',   color: '#3b82f6' },
  { value: 'alta',    label: 'Alta',    color: '#f97316' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
];

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function getAvatarColor(email: string | null): string {
  if (!email) return '#3D4465';
  const colors = ['#3D4465', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Campo de texto editável inline — clica para virar input
function InlineField({
  value, placeholder, onSave, className = '', inputType = 'text',
}: {
  value: string; placeholder: string; onSave: (val: string) => void; className?: string; inputType?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleBlur() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleBlur(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(value); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full px-2 py-1 rounded-lg border outline-none text-sm ${className}`}
        style={{ borderColor: '#3D4465' }}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 transition-colors text-sm ${!value ? 'text-gray-400 italic' : 'text-gray-800'} ${className}`}
    >
      {value || placeholder}
    </span>
  );
}

function Divider() {
  return <div className="my-4" style={{ borderTop: '1px solid #e2e8f0' }} />;
}

// Título editável no header do modal
function TitleEditor({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(title); }, [title]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function handleBlur() {
    setEditing(false);
    if (draft.trim() && draft !== title) onSave(draft.trim());
    else setDraft(title);
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleBlur(); }
    if (e.key === 'Escape') { setEditing(false); setDraft(title); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full font-bold text-gray-800 text-lg px-2 py-1 rounded-lg border outline-none"
        style={{ borderColor: '#3D4465', fontFamily: "'Outfit', sans-serif" }}
      />
    );
  }
  return (
    <h2
      onClick={() => setEditing(true)}
      className="font-bold text-gray-800 leading-snug cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
      style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px' }}
      title="Clique para editar o título"
    >
      {title}
    </h2>
  );
}

export default function CardModal({
  cardId, columns, userEmail, userName, readOnly = false, onClose, onCardUpdated, onCardArchived, onCardDeleted, onReopenCard,
}: CardModalProps) {
  const [card, setCard] = useState<DesignCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const { labels: allLabels } = useDesignLabels();
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const descDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animação de entrada
  useEffect(() => {
    if (cardId) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [cardId]);

  const fetchCard = useCallback(async () => {
    if (!cardId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('design_cards').select('*').eq('id', cardId).maybeSingle();

    if (error) { console.error('[CardModal] fetchCard error:', error); setLoading(false); return; }

    if (data) {
      const { data: labelRows } = await supabase
        .from('design_card_labels').select('design_labels(id, name, color)').eq('card_id', cardId);

      const labels: DesignLabel[] = (labelRows ?? [])
        .map((r: { design_labels: DesignLabel | null }) => r.design_labels)
        .filter((l): l is DesignLabel => l !== null);

      setCard({ ...data, labels });
    }
    setLoading(false);
  }, [cardId]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function saveField(field: Partial<DesignCard>) {
    if (!card) return;
    setCard((prev) => prev ? { ...prev, ...field } : prev);
    const { error } = await supabase
      .from('design_cards')
      .update({ ...field, updated_at: new Date().toISOString() })
      .eq('id', card.id);
    if (error) console.error('[CardModal] saveField error:', error);
    else onCardUpdated();
  }

  async function saveColumnChange(newColumnId: string) {
    if (!card || card.column_id === newColumnId) return;
    const oldColumnId = card.column_id;
    await saveField({ column_id: newColumnId });
    await supabase.from('design_activity_log').insert({
      card_id: card.id, actor_email: userEmail, actor_name: userName,
      action: 'card_moved', details: { from_column: oldColumnId, to_column: newColumnId },
    });
  }

  async function addLabel(label: DesignLabel) {
    if (!card || card.labels?.some((l) => l.id === label.id)) return;
    const { error } = await supabase.from('design_card_labels').insert({ card_id: card.id, label_id: label.id });
    if (!error) {
      setCard((prev) => prev ? { ...prev, labels: [...(prev.labels ?? []), label] } : prev);
      await supabase.from('design_activity_log').insert({
        card_id: card.id, actor_email: userEmail, actor_name: userName,
        action: 'label_added', details: { label_id: label.id, label_name: label.name },
      });
    }
    setShowLabelDropdown(false);
  }

  async function removeLabel(labelId: string) {
    if (!card) return;
    const { error } = await supabase.from('design_card_labels')
      .delete().eq('card_id', card.id).eq('label_id', labelId);
    if (!error) setCard((prev) => prev ? { ...prev, labels: prev.labels?.filter((l) => l.id !== labelId) } : prev);
  }

  function handleDescriptionChange(value: string) {
    setCard((prev) => prev ? { ...prev, description: value } : prev);
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(() => saveField({ description: value }), 1000);
  }

  async function handleArchive() {
    if (!card) return;
    setArchiving(true);
    const { error } = await supabase.from('design_cards')
      .update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', card.id);
    if (!error) {
      await supabase.from('design_activity_log').insert({
        card_id: card.id, actor_email: userEmail, actor_name: userName, action: 'archived', details: null,
      });
      onCardArchived?.(card.id);
      handleClose();
      onCardUpdated();
    }
    setArchiving(false);
  }

  async function handleDelete() {
    if (!card) return;
    setDeleting(true);
    const { error } = await supabase.from('design_cards').delete().eq('id', card.id);
    if (!error) { onCardDeleted?.(card.id); handleClose(); onCardUpdated(); }
    setDeleting(false);
    setShowDeleteConfirm(false);
  }

  const currentColumn = columns.find((c) => c.id === card?.column_id);
  const availableLabels = allLabels.filter((l) => !card?.labels?.some((cl) => cl.id === l.id));
  const columnMap: Record<string, string> = Object.fromEntries(columns.map((c) => [c.id, c.title]));
  const isOverdue = card?.due_date && isPast(parseISO(card.due_date));

  if (!cardId) return null;

  return (
    <>
      {/* Confirmação de exclusão */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-800 text-lg mb-2">Deletar card?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Esta ação é permanente e não pode ser desfeita. Todos os comentários, checklist e anexos serão removidos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ borderColor: '#e2e8f0' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: '#ef4444' }}
              >
                {deleting ? 'Deletando...' : 'Deletar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay + Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: `rgba(0,0,0,${visible ? 0.45 : 0})`,
          transition: 'background 0.2s ease-out',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
          }}
        >
          {loading || !card ? (
            <div className="p-6 space-y-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-100 rounded w-1/4" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          ) : (
            <div className="flex flex-col" style={{ maxHeight: '90vh' }}>

              {/* Header fixo */}
              <div
                className="flex-shrink-0 px-6 pt-5 pb-4"
                style={{ borderBottom: '1px solid #e2e8f0' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    {readOnly ? (
                      <h2
                        className="font-bold text-gray-800 leading-snug px-1 py-0.5"
                        style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px' }}
                      >
                        {card.title}
                      </h2>
                    ) : (
                      <TitleEditor title={card.title} onSave={(t) => saveField({ title: t })} />
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all mt-0.5"
                    aria-label="Fechar modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {readOnly && (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-white text-xs font-medium"
                      style={{ background: '#22c55e' }}
                    >
                      Finalizado
                    </span>
                  )}
                  {currentColumn && (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-white text-xs font-medium"
                      style={{ background: currentColumn.color }}
                    >
                      {currentColumn.title}
                    </span>
                  )}
                </div>
              </div>

              {/* Corpo com scroll — 2 colunas desktop */}
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col lg:flex-row">

                  {/* Coluna esquerda: conteúdo principal */}
                  <div className="flex-1 px-6 py-5 min-w-0" style={{ borderRight: '1px solid #f1f5f9' }}>

                    {/* Descrição */}
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlignLeft className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição</span>
                      </div>
                      <textarea
                        value={card.description ?? ''}
                        onChange={(e) => !readOnly && handleDescriptionChange(e.target.value)}
                        readOnly={readOnly}
                        placeholder={readOnly ? 'Sem descrição' : 'Descreva o que precisa ser feito...'}
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none leading-relaxed"
                        style={{
                          borderColor: '#e2e8f0',
                          fontSize: '13px',
                          background: readOnly ? '#fafbfc' : undefined,
                          cursor: readOnly ? 'default' : undefined,
                        }}
                        onFocus={(e) => { if (!readOnly) e.target.style.borderColor = '#3D4465'; }}
                        onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                      />
                    </div>

                    <Divider />

                    {/* Checklist */}
                    <div className="mb-5">
                      <CardChecklist cardId={card.id} userEmail={userEmail} />
                    </div>

                    <Divider />

                    {/* Anexos */}
                    <div className="mb-5">
                      <CardAttachments cardId={card.id} userEmail={userEmail} userName={userName} />
                    </div>

                    <Divider />

                    {/* Comentários */}
                    <div className="mb-5">
                      <CardComments cardId={card.id} userEmail={userEmail} userName={userName} />
                    </div>

                    <Divider />

                    {/* Log de atividades */}
                    <div className="mb-4">
                      <CardActivityLog cardId={card.id} columnMap={columnMap} />
                    </div>
                  </div>

                  {/* Coluna direita: metadados */}
                  <div className="lg:w-72 flex-shrink-0 px-6 py-5 space-y-5" style={{ background: '#fafbfc' }}>

                    {/* Dados do cliente */}
                    <div className="p-4 rounded-xl" style={{ background: '#f0f6ff', border: '1px solid #dbeafe' }}>
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Dados do Cliente</p>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        {readOnly ? (
                          <span className="text-sm text-gray-800">{card.cliente_nome || <span className="text-gray-400 italic">—</span>}</span>
                        ) : (
                          <InlineField
                            value={card.cliente_nome ?? ''} placeholder="Nome do cliente"
                            onSave={(v) => saveField({ cliente_nome: v })}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        {readOnly ? (
                          <span className="text-sm text-gray-600">{card.cliente_telefone || <span className="text-gray-400 italic">—</span>}</span>
                        ) : (
                          <InlineField
                            value={card.cliente_telefone ?? ''} placeholder="Telefone" inputType="tel"
                            onSave={(v) => saveField({ cliente_telefone: v })}
                          />
                        )}
                      </div>
                    </div>

                    {/* Informações do pedido */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informações do Pedido</p>

                      <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-1">Etapa</label>
                        {readOnly ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-white text-xs font-medium"
                            style={{ background: currentColumn?.color ?? '#94a3b8' }}
                          >
                            {currentColumn?.title ?? '—'}
                          </span>
                        ) : (
                          <div className="relative">
                            <select
                              value={card.column_id}
                              onChange={(e) => saveColumnChange(e.target.value)}
                              className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border text-sm outline-none transition-colors bg-white"
                              style={{ borderColor: '#e2e8f0', fontSize: '13px' }}
                            >
                              {columns.map((col) => (
                                <option key={col.id} value={col.id}>{col.title}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-1">Prioridade</label>
                        {readOnly ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-lg font-medium text-xs"
                            style={{
                              background: `${PRIORITY_OPTIONS.find((p) => p.value === card.priority)?.color ?? '#94a3b8'}18`,
                              color: PRIORITY_OPTIONS.find((p) => p.value === card.priority)?.color ?? '#94a3b8',
                            }}
                          >
                            {PRIORITY_OPTIONS.find((p) => p.value === card.priority)?.label ?? '—'}
                          </span>
                        ) : (
                          <div className="relative">
                            <select
                              value={card.priority}
                              onChange={(e) => saveField({ priority: e.target.value as DesignCardPriority })}
                              className="w-full appearance-none px-3 py-2 pr-8 rounded-xl border text-sm outline-none transition-colors bg-white font-medium"
                              style={{
                                borderColor: '#e2e8f0', fontSize: '13px',
                                color: PRIORITY_OPTIONS.find((p) => p.value === card.priority)?.color,
                              }}
                            >
                              {PRIORITY_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value} style={{ color: p.color }}>{p.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Entrega
                        </label>
                        {readOnly ? (
                          <span className="text-sm" style={{ color: isOverdue ? '#ef4444' : '#374151' }}>
                            {card.due_date
                              ? format(parseISO(card.due_date), 'dd/MM/yyyy', { locale: ptBR })
                              : <span className="text-gray-400 italic">—</span>}
                            {isOverdue && <span className="text-red-500 ml-1">(Atrasado)</span>}
                          </span>
                        ) : (
                          <>
                            <input
                              type="date"
                              value={card.due_date ? card.due_date.substring(0, 10) : ''}
                              onChange={(e) => saveField({ due_date: e.target.value || null })}
                              className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors"
                              style={{
                                borderColor: isOverdue ? '#ef4444' : '#e2e8f0',
                                color: isOverdue ? '#ef4444' : '#374151',
                                fontSize: '13px',
                              }}
                            />
                            {isOverdue && (
                              <p className="flex items-center gap-1 mt-1 text-xs text-red-500">
                                <AlertCircle className="w-3 h-3" /> Prazo vencido
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Responsável
                        </label>
                        {readOnly ? (
                          <span className="text-sm text-gray-700">
                            {card.assigned_to_name || <span className="text-gray-400 italic">—</span>}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={card.assigned_to_name ?? ''}
                            onChange={(e) => setCard((prev) => prev ? { ...prev, assigned_to_name: e.target.value } : prev)}
                            placeholder="Nome do designer"
                            className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors"
                            style={{ borderColor: '#e2e8f0', fontSize: '13px' }}
                            onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#e2e8f0';
                              const name = e.target.value.trim();
                              saveField({
                                assigned_to_name: name || null,
                                assigned_to: name ? name.toLowerCase().replace(/\s+/g, '.') + '@designer' : null,
                              });
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Solicitado por */}
                    <div className="p-3 rounded-xl" style={{ background: '#fefce8', border: '1px solid #fef08a' }}>
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Solicitado por</p>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ background: getAvatarColor(card.requested_by), fontSize: '10px' }}
                        >
                          {getInitials(card.requested_by_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 truncate">{card.requested_by_name || 'Desconhecido'}</p>
                          <p className="text-xs text-gray-400 truncate">{card.requested_by}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(card.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>

                    {/* Etiquetas */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Etiquetas</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(card.labels ?? []).map((label) => (
                          <span
                            key={label.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-white font-medium"
                            style={{ background: label.color, fontSize: '11px' }}
                          >
                            {label.name}
                            {!readOnly && (
                              <button onClick={() => removeLabel(label.id)} className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        ))}
                        {!readOnly && (
                          <div className="relative">
                            <button
                              onClick={() => setShowLabelDropdown((v) => !v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                              style={{ borderColor: '#e2e8f0' }}
                            >
                              <Plus className="w-3 h-3" /> Etiqueta
                            </button>
                            {showLabelDropdown && (
                              <div
                                className="absolute left-0 top-8 z-10 bg-white rounded-xl shadow-xl border py-1 min-w-[160px]"
                                style={{ borderColor: '#e2e8f0' }}
                              >
                                {availableLabels.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-gray-400">Nenhuma disponível</p>
                                ) : (
                                  availableLabels.map((label) => (
                                    <button
                                      key={label.id}
                                      onClick={() => addLabel(label)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
                                    >
                                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: label.color }} />
                                      {label.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {readOnly && (card.labels ?? []).length === 0 && (
                          <span className="text-gray-400 italic text-xs">Sem etiquetas</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé com ações */}
              <div
                className="flex-shrink-0 flex items-center gap-3 px-6 py-3"
                style={{ borderTop: '1px solid #e2e8f0', background: '#fafafa' }}
              >
                {readOnly ? (
                  <>
                    {/* Modo somente leitura — apenas botão Reabrir */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                      <Clock className="w-3.5 h-3.5" />
                      Visualização somente leitura
                    </div>
                    <button
                      onClick={() => onReopenCard?.(card.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ml-auto hover:opacity-90"
                      style={{ background: '#3D4465' }}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reabrir
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleArchive}
                      disabled={archiving}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 border border-gray-200"
                    >
                      <Archive className="w-4 h-4" />
                      {archiving ? 'Arquivando...' : 'Arquivar'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border border-red-200 ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Deletar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
