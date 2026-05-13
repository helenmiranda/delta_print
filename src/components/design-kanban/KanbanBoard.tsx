// Board principal do Kanban — drag & drop desktop + tabs mobile + NewCardModal centralizado
import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { DesignColumn, DesignCard } from '../../types/design.types';
import type { CreateCardData } from '../../hooks/useDesignCards';
import { useToast } from '../../contexts/ToastContext';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import NewCardModal from './NewCardModal';

interface KanbanBoardProps {
  columns: DesignColumn[];
  cards: DesignCard[];
  requestedBy: string;
  requestedByName: string;
  onCardClick: (card: DesignCard) => void;
  onCreateCard: (data: CreateCardData) => Promise<void>;
  onMoveCard: (
    cardId: string,
    newColumnId: string,
    newPosition: number,
    actorEmail: string,
    actorName: string
  ) => Promise<void>;
  onFinalizeCard?: (card: DesignCard) => void;
}

// Interface pública do ref exposto pelo board — permite que o pai role até um card
export interface KanbanBoardRef {
  scrollToCard: (cardId: string) => void;
}

const MOBILE_PRIORITY_COLORS: Record<string, string> = {
  baixa: '#cbd5e1', media: '#3b82f6', alta: '#f59e0b', urgente: '#ef4444',
};

const KanbanBoard = forwardRef<KanbanBoardRef, KanbanBoardProps>(function KanbanBoard({
  columns,
  cards,
  requestedBy,
  requestedByName,
  onCardClick,
  onCreateCard,
  onMoveCard,
  onFinalizeCard,
}, ref) {
  const { addToast } = useToast();

  const [activeCard, setActiveCard] = useState<DesignCard | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [localCards, setLocalCards] = useState<DesignCard[]>([]);
  const [initialized, setInitialized] = useState(false);

  // ID do card pré-selecionada no NewCardModal (null = modal fechado)
  const [createModalColumnId, setCreateModalColumnId] = useState<string | null>(null);

  // ID do card destacado após navegação via SearchModal
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  // Ref do container de scroll horizontal do board
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs de cada coluna — mapeadas por column_id — para localizar e rolar até cards
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  if (!initialized && cards.length > 0) {
    setLocalCards(cards);
    setInitialized(true);
  }

  const displayCards = activeCard ? localCards : cards;

  const [mobileColId, setMobileColId] = useState<string | null>(null);
  const activeTabId = mobileColId ?? columns[0]?.id ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getCardsForColumn = useCallback(
    (columnId: string) =>
      displayCards
        .filter((c) => c.column_id === columnId)
        .sort((a, b) => a.position - b.position),
    [displayCards]
  );

  const countByCol = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, cards.filter((r) => r.column_id === c.id).length])),
    [columns, cards]
  );

  // Rola o board até um card específico e ativa o glow nele por 2 segundos
  useImperativeHandle(ref, () => ({
    scrollToCard(cardId: string) {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      const colEl = columnRefs.current[card.column_id];
      if (colEl && scrollContainerRef.current) {
        // Calcula a posição da coluna dentro do container de scroll horizontal
        const containerRect = scrollContainerRef.current.getBoundingClientRect();
        const colRect = colEl.getBoundingClientRect();
        const scrollLeft = scrollContainerRef.current.scrollLeft;
        const targetScrollLeft = scrollLeft + (colRect.left - containerRect.left) - 16;

        scrollContainerRef.current.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
      }

      // Ativa o glow no card (via estado — KanbanCard reage via prop highlighted)
      setHighlightedCardId(cardId);
      setTimeout(() => setHighlightedCardId(null), 2200);
    },
  }));

  function handleDragStart(event: DragStartEvent) {
    const dragged = cards.find((c) => c.id === event.active.id);
    if (dragged) { setActiveCard(dragged); setLocalCards([...cards]); }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !activeCard) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const overCard = localCards.find((c) => c.id === overId);
    const targetColId = overCard ? overCard.column_id : overId;
    setOverColumnId(targetColId);

    const activeData = localCards.find((c) => c.id === activeId);
    if (!activeData) return;
    const isSame = activeData.column_id === targetColId;

    setLocalCards((prev) => {
      const updated = prev.map((c) => c.id === activeId ? { ...c, column_id: targetColId } : c);
      if (isSame && overCard) {
        const colCards = updated.filter((c) => c.column_id === targetColId).sort((a, b) => a.position - b.position);
        const ai = colCards.findIndex((c) => c.id === activeId);
        const oi = colCards.findIndex((c) => c.id === overId);
        if (ai !== -1 && oi !== -1) {
          const reordered = arrayMove(colCards, ai, oi).map((c, idx) => ({ ...c, position: idx + 1 }));
          return updated.map((c) => reordered.find((r) => r.id === c.id) ?? c);
        }
      }
      return updated;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setOverColumnId(null);
    if (!over || !activeCard) { setActiveCard(null); return; }

    const activeId = String(active.id);
    const overId = String(over.id);
    const movedCard = localCards.find((c) => c.id === activeId);
    if (!movedCard) { setActiveCard(null); return; }

    const overCard = localCards.find((c) => c.id === overId);
    const targetColId = overCard ? overCard.column_id : overId;

    const colCards = localCards
      .filter((c) => c.column_id === targetColId && c.id !== activeId)
      .sort((a, b) => a.position - b.position);

    const overIdx = overCard ? colCards.findIndex((c) => c.id === overId) : colCards.length;
    const newPos = overIdx >= 0 ? overIdx + 1 : colCards.length + 1;

    if (movedCard.column_id !== targetColId) {
      const destCol = columns.find((c) => c.id === targetColId);
      if (destCol) addToast(`Movido para "${destCol.title}"`, 'info');
    }

    await onMoveCard(activeId, targetColId, newPos, requestedBy, requestedByName);
    setActiveCard(null);
  }

  async function handleCreate(data: CreateCardData) {
    await onCreateCard(data);
    addToast('Solicitação criada com sucesso', 'success');
  }

  return (
    <>
      {/* Modal centralizado de criação — aberto pelo botão + das colunas ou FAB mobile */}
      {createModalColumnId !== null && (
        <NewCardModal
          columns={columns}
          defaultColumnId={createModalColumnId}
          requestedBy={requestedBy}
          requestedByName={requestedByName}
          onSubmit={handleCreate}
          onClose={() => setCreateModalColumnId(null)}
        />
      )}

      {/* ── DESKTOP (≥768px): colunas com DnD ─── */}
      <div className="hidden md:block h-full">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <style>{`
            .kb-scroll::-webkit-scrollbar { height: 6px; }
            .kb-scroll::-webkit-scrollbar-track { background: transparent; }
            .kb-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
          `}</style>

          {/* Área de scroll horizontal — edge-to-edge, padding apenas nas extremidades */}
          <div
            ref={scrollContainerRef}
            className="kb-scroll flex h-full"
            style={{
              overflowX: 'auto',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px 16px 16px',
            }}
          >
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                cards={getCardsForColumn(col.id)}
                onCardClick={onCardClick}
                onCreateClick={(colId) => setCreateModalColumnId(colId)}
                onFinalizeCard={onFinalizeCard}
                isOver={overColumnId === col.id}
                highlightedCardId={highlightedCardId}
                columnRef={(el) => { columnRefs.current[col.id] = el; }}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard ? <KanbanCard card={activeCard} onClick={() => {}} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── MOBILE (<768px): tabs por coluna ─── */}
      <div className="flex flex-col h-full md:hidden">
        {/* Tabs scrolláveis */}
        <div className="flex gap-1 px-2 pb-2 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {columns.map((col) => {
            const active = col.id === activeTabId;
            return (
              <button
                key={col.id}
                onClick={() => setMobileColId(col.id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all"
                style={{
                  background: active ? col.color : `${col.color}18`,
                  color: active ? '#fff' : col.color,
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.title}
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full font-bold"
                  style={{ background: active ? 'rgba(255,255,255,0.3)' : col.color, color: '#fff', fontSize: '9px' }}
                >
                  {countByCol[col.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cards da coluna ativa */}
        <div className="flex-1 overflow-y-auto px-3 pb-24 space-y-2">
          {activeTabId && getCardsForColumn(activeTabId).map((card) => (
            <div
              key={card.id}
              onClick={() => onCardClick(card)}
              className="bg-white rounded-xl p-3.5 cursor-pointer border border-gray-100 transition-all active:scale-[0.98]"
              style={{
                borderLeft: `3px solid ${MOBILE_PRIORITY_COLORS[card.priority] ?? '#cbd5e1'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                minHeight: '44px',
              }}
            >
              <p className="font-medium text-gray-800 mb-1.5" style={{ fontSize: '14px' }}>
                {card.title}
              </p>
              {(card.cliente_nome || card.cliente_telefone) && (
                <div className="rounded-lg px-2.5 py-1.5 mb-1.5" style={{ background: '#eff6ff' }}>
                  {card.cliente_nome && (
                    <p className="font-semibold" style={{ fontSize: '13px', color: '#1e293b' }}>
                      {card.cliente_nome}
                    </p>
                  )}
                  {card.cliente_telefone && (
                    <p style={{ fontSize: '12px', color: '#475569' }}>{card.cliente_telefone}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {activeTabId && getCardsForColumn(activeTabId).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>Nenhum pedido nesta etapa</p>
            </div>
          )}
        </div>

        {/* FAB — abre NewCardModal com a coluna ativa pré-selecionada */}
        {activeTabId && (
          <button
            onClick={() => setCreateModalColumnId(activeTabId)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white z-40 transition-transform active:scale-90"
            style={{ background: columns.find((c) => c.id === activeTabId)?.color ?? '#3D4465' }}
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>
    </>
  );
});

export default KanbanBoard;
