// Coluna individual do Kanban — droppable, botão + abre NewCardModal com coluna pré-selecionada
import { memo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Inbox } from 'lucide-react';
import type { DesignColumn, DesignCard } from '../../types/design.types';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  column: DesignColumn;
  cards: DesignCard[];
  onCardClick: (card: DesignCard) => void;
  // Callback para abrir o modal centralizado de criação com a coluna pré-selecionada
  onCreateClick: (columnId: string) => void;
  onFinalizeCard?: (card: DesignCard) => void;
  isOver?: boolean;
  // ID do card que deve exibir o efeito de destaque após navegação via busca
  highlightedCardId?: string | null;
  // Callback para registrar o elemento DOM desta coluna (usada pelo board para scroll)
  columnRef?: (el: HTMLDivElement | null) => void;
}

function EmptyColumnState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <Inbox style={{ width: '32px', height: '32px', color: '#cbd5e1', marginBottom: '8px' }} />
      <p className="font-medium" style={{ color: '#94a3b8', fontSize: '13px' }}>
        Nenhum pedido aqui
      </p>
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  column,
  cards,
  onCardClick,
  onCreateClick,
  onFinalizeCard,
  isOver,
  highlightedCardId,
  columnRef,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id });

  const cardIds = cards.map((c) => c.id);

  return (
    <div
      ref={columnRef}
      className="flex flex-col rounded-xl flex-shrink-0 overflow-hidden"
      style={{
        width: '280px',
        minWidth: '280px',
        background: '#f8fafc',
        borderRadius: '12px',
        transition: 'box-shadow 0.2s ease',
        boxShadow: isOver
          ? `inset 0 0 0 2px ${column.color}80, 0 4px 12px rgba(0,0,0,0.08)`
          : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header da coluna */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{
          background: `${column.color}18`,
          borderTop: `4px solid ${column.color}`,
          borderBottom: `1px solid ${column.color}22`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="font-semibold truncate"
            style={{
              fontSize: '12px',
              color: column.color,
              fontFamily: "'Outfit', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {column.title}
          </span>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full font-bold flex-shrink-0"
            style={{ background: column.color, color: '#fff', fontSize: '10px' }}
          >
            {cards.length}
          </span>
        </div>

        {/* Botão + da coluna — abre o modal centralizado com esta coluna pré-selecionada */}
        <button
          onClick={() => onCreateClick(column.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all ml-1 flex-shrink-0"
          style={{ background: `${column.color}22`, color: column.color }}
          title="Adicionar pedido"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Área droppable com scroll vertical — altura calculada para não ultrapassar a tela */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto space-y-2"
        style={{
          padding: '8px',
          minHeight: '80px',
          maxHeight: 'calc(100vh - 64px - 24px)',
          background: isOver ? `${column.color}06` : 'transparent',
          transition: 'background 0.15s ease',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
        }}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.length === 0 ? (
            <EmptyColumnState />
          ) : (
            cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                columnSlug={column.slug}
                onClick={onCardClick}
                onFinalize={onFinalizeCard}
                highlighted={highlightedCardId === card.id}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
});

export default KanbanColumn;
