// Card individual do Kanban — draggable, cover image, badges de data inteligentes
// Exibe botão "Finalizar" quando o card está na coluna Produção (slug 'producao')
import { memo, useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MessageSquare, Paperclip, Phone, User, Clock, AlertCircle, CheckSquare, CheckCircle } from 'lucide-react';
import { format, isPast, isToday, differenceInCalendarDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DesignCard } from '../../types/design.types';

interface KanbanCardProps {
  card: DesignCard;
  columnSlug?: string;
  onClick: (card: DesignCard) => void;
  onFinalize?: (card: DesignCard) => void;
  isDragOverlay?: boolean;
  // Quando true, exibe efeito de glow/pulse temporário para indicar ao usuário qual card foi encontrado
  highlighted?: boolean;
}

// Borda esquerda 3px por prioridade
const PRIORITY_BORDER: Record<string, string> = {
  baixa:   '#cbd5e1',
  media:   '#3b82f6',
  alta:    '#f59e0b',
  urgente: '#ef4444',
};

const PRIORITY_LABEL: Record<string, string> = {
  baixa:   'Baixa',
  media:   'Média',
  alta:    'Alta',
  urgente: 'Urgente',
};

// 10 cores de avatar — mesma cor sempre para o mesmo email/nome
const AVATAR_COLORS = [
  '#3D4465', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#14b8a6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4',
];

export function getAvatarColor(seed: string | null): string {
  if (!seed) return '#3D4465';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

// Badge de data com cor contextual
function DueDateBadge({ dueDate }: { dueDate: string }) {
  const date = parseISO(dueDate);
  const daysUntil = differenceInCalendarDays(date, new Date());
  const overdue = isPast(date) && !isToday(date);

  let bg = '#f1f5f9', text = '#64748b';
  if (overdue)             { bg = '#fef2f2'; text = '#dc2626'; }
  else if (isToday(date))  { bg = '#fefce8'; text = '#ca8a04'; }
  else if (daysUntil <= 3) { bg = '#eff6ff'; text = '#2563eb'; }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium"
      style={{ background: bg, color: text, fontSize: '10px' }}
    >
      <Clock className="w-2.5 h-2.5" />
      {format(date, 'dd/MM', { locale: ptBR })}
      {overdue && ' · Atr.'}
    </span>
  );
}

// Mini modal de confirmação de finalização
interface FinalizeConfirmProps {
  cardTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function FinalizeConfirmModal({ cardTitle, onConfirm, onCancel }: FinalizeConfirmProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full"
        style={{ maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#f0fdf4' }}
          >
            <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
          </div>
          <h3
            className="font-bold text-gray-800"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px' }}
          >
            Finalizar trabalho?
          </h3>
        </div>

        <p className="text-sm text-gray-500 mb-5 leading-relaxed">
          <span className="font-semibold text-gray-700">"{cardTitle}"</span> será movido para o histórico.
          Esta ação pode ser desfeita reabrindo o card no Histórico.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#e2e8f0' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: '#22c55e' }}
          >
            <span className="flex items-center justify-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              Finalizar
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const KanbanCard = memo(function KanbanCard({
  card,
  columnSlug,
  onClick,
  onFinalize,
  isDragOverlay,
  highlighted,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  // Estado interno de glow — ativo quando highlighted=true, desliga após 2 segundos
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (!highlighted) return;
    setGlowing(true);
    const timer = setTimeout(() => setGlowing(false), 2000);
    return () => clearTimeout(timer);
  }, [highlighted]);

  const priorityColor = PRIORITY_BORDER[card.priority] ?? '#cbd5e1';

  // Botão Finalizar aparece apenas na coluna Produção e fora do drag overlay
  const isProducao = columnSlug === 'producao';
  const showFinalizeButton = isProducao && !isDragOverlay;

  const boxShadow = glowing
    ? `0 0 0 3px ${priorityColor}60, 0 0 16px ${priorityColor}40, 0 4px 12px rgba(0,0,0,0.12)`
    : isDragOverlay
      ? '0 12px 28px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.08)'
      : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)';

  const cardTransform = fadeOut
    ? 'scale(0.92)'
    : isDragOverlay
      ? `${CSS.Transform.toString(transform) ?? ''} rotate(2deg)`
      : (CSS.Transform.toString(transform) ?? undefined);

  const style: React.CSSProperties = {
    transform: cardTransform,
    transition: fadeOut
      ? 'opacity 0.28s ease, transform 0.28s ease'
      : glowing
        ? 'box-shadow 0.3s ease'
        : transition,
    opacity: (isDragging && !isDragOverlay) || fadeOut ? 0 : 1,
    borderLeft: `3px solid ${priorityColor}`,
    boxShadow,
  };

  const checkTotal = card.checklist_total ?? 0;
  const checkDone  = card.checklist_done ?? 0;
  const hasChecklist = checkTotal > 0;

  function handleFinalizeClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowFinalizeConfirm(true);
  }

  function handleConfirmFinalize() {
    setShowFinalizeConfirm(false);
    setFadeOut(true);
    setTimeout(() => {
      onFinalize?.(card);
    }, 280);
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => !isDragging && onClick(card)}
        className={`
          bg-white rounded-xl cursor-pointer select-none
          border border-gray-100
          transition-all duration-200
          hover:shadow-[0_4px_12px_rgba(0,0,0,0.10),0_2px_4px_rgba(0,0,0,0.06)]
          hover:scale-[1.02]
          active:scale-[0.99]
          overflow-hidden
          ${isDragOverlay ? 'opacity-90' : ''}
        `}
      >
        {/* Imagem de capa quando disponível */}
        {card.cover_image_url && (
          <div style={{ height: '140px', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
            <img
              src={card.cover_image_url}
              alt="Capa"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              draggable={false}
            />
          </div>
        )}

        {/* Conteúdo do card */}
        <div className="p-3">

          {/* Etiquetas coloridas */}
          {card.labels && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {card.labels.map((label) => (
                <span
                  key={label.id}
                  className="inline-block px-1.5 py-0.5 rounded-full text-white font-medium"
                  style={{ background: label.color, fontSize: '10px' }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {/* Título */}
          <p
            className="font-medium text-gray-800 leading-snug mb-2.5"
            style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}
          >
            {card.title}
          </p>

          {/* Bloco de dados do cliente */}
          <div className="rounded-lg px-2.5 py-2 mb-2.5 space-y-1" style={{ background: '#eff6ff' }}>
            {card.cliente_nome && (
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 flex-shrink-0" style={{ color: '#3b82f6' }} />
                <span
                  className="font-semibold truncate"
                  style={{ fontSize: '12px', color: '#1e293b', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {card.cliente_nome}
                </span>
              </div>
            )}
            {card.cliente_telefone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 flex-shrink-0" style={{ color: '#64748b' }} />
                <span style={{ fontSize: '11px', color: '#475569' }}>{card.cliente_telefone}</span>
              </div>
            )}
          </div>

          {/* Badges de prioridade e data */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium"
              style={{ background: `${priorityColor}18`, color: priorityColor, fontSize: '10px' }}
            >
              {card.priority === 'urgente' && <AlertCircle className="w-2.5 h-2.5" />}
              {PRIORITY_LABEL[card.priority]}
            </span>
            {card.due_date && <DueDateBadge dueDate={card.due_date} />}
          </div>

          {/* Mini barra de progresso do checklist */}
          {hasChecklist && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1" style={{ color: '#94a3b8' }}>
                  <CheckSquare className="w-2.5 h-2.5" />
                  <span style={{ fontSize: '10px' }}>{checkDone}/{checkTotal}</span>
                </div>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {Math.round((checkDone / checkTotal) * 100)}%
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((checkDone / checkTotal) * 100)}%`,
                    background: checkDone === checkTotal ? '#10b981' : '#3D4465',
                  }}
                />
              </div>
            </div>
          )}

          {/* Rodapé: contadores + atendente itálico + avatar designer */}
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
            <div className="flex items-center gap-2.5" style={{ color: '#9ca3af' }}>
              {(card.comments_count ?? 0) > 0 && (
                <span className="flex items-center gap-0.5" style={{ fontSize: '11px' }}>
                  <MessageSquare className="w-3 h-3" />
                  {card.comments_count}
                </span>
              )}
              {(card.attachments_count ?? 0) > 0 && (
                <span className="flex items-center gap-0.5" style={{ fontSize: '11px' }}>
                  <Paperclip className="w-3 h-3" />
                  {card.attachments_count}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {card.requested_by_name && (
                <span className="truncate max-w-[72px] italic" style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {card.requested_by_name.split(' ')[0]}
                </span>
              )}
              {card.assigned_to_name ? (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                  style={{ background: getAvatarColor(card.assigned_to ?? card.assigned_to_name), fontSize: '9px' }}
                  title={card.assigned_to_name}
                >
                  {getInitials(card.assigned_to_name)}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-200 flex-shrink-0" title="Sem responsável" />
              )}
            </div>
          </div>

        </div>

        {/* Botão Finalizar — aparece apenas na coluna Produção */}
        {showFinalizeButton && (
          <button
            onClick={handleFinalizeClick}
            className="w-full flex items-center justify-center gap-1.5 font-medium text-white"
            style={{
              background: '#22c55e',
              borderRadius: '0 0 9px 9px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#16a34a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#22c55e')}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Finalizar
          </button>
        )}
      </div>

      {/* Modal de confirmação de finalização */}
      {showFinalizeConfirm && (
        <FinalizeConfirmModal
          cardTitle={card.title}
          onConfirm={handleConfirmFinalize}
          onCancel={() => setShowFinalizeConfirm(false)}
        />
      )}
    </>
  );
});

export default KanbanCard;
