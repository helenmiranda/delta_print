// Componente de checklist dentro do drawer de detalhes do card
import { useState, KeyboardEvent } from 'react';
import { Trash2, CheckSquare } from 'lucide-react';
import { useDesignChecklist } from '../../hooks/useDesignChecklist';
import type { DesignChecklistItem } from '../../types/design.types';

interface CardChecklistProps {
  cardId: string;
  userEmail: string;
}

// Item individual do checklist com checkbox animado e botão de exclusão
function ChecklistItem({
  item,
  onToggle,
  onDelete,
}: {
  item: DesignChecklistItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 group">
      {/* Checkbox customizado */}
      <button
        onClick={onToggle}
        className="flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200"
        style={{
          borderColor: item.is_completed ? '#22c55e' : '#d1d5db',
          background: item.is_completed ? '#22c55e' : 'white',
        }}
        aria-label={item.is_completed ? 'Desmarcar item' : 'Marcar item como concluído'}
      >
        {item.is_completed && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Texto do item — riscado quando concluído */}
      <span
        className="flex-1 text-sm transition-all duration-200"
        style={{
          textDecoration: item.is_completed ? 'line-through' : 'none',
          color: item.is_completed ? '#9ca3af' : '#374151',
        }}
      >
        {item.title}
      </span>

      {/* Botão lixeira — visível apenas no hover */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
        aria-label="Remover item"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function CardChecklist({ cardId, userEmail }: CardChecklistProps) {
  const { items, loading, progress, addItem, toggleItem, deleteItem } =
    useDesignChecklist(cardId);

  // Controle do campo de novo item
  const [newItemText, setNewItemText] = useState('');
  const [adding, setAdding] = useState(false);

  // Enviar novo item ao pressionar Enter
  async function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleAddItem();
    }
    if (e.key === 'Escape') {
      setNewItemText('');
    }
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return;
    setAdding(true);
    await addItem(newItemText);
    setNewItemText('');
    setAdding(false);
  }

  const completedCount = items.filter((i) => i.is_completed).length;

  return (
    <div>
      {/* Cabeçalho com título e contador */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Checklist</span>
        </div>
        {items.length > 0 && (
          <span className="text-xs text-gray-400">
            {completedCount}/{items.length} concluídos
          </span>
        )}
      </div>

      {/* Barra de progresso visual */}
      {items.length > 0 && (
        <div className="mb-3">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: '#e2e8f0' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? '#22c55e' : '#3D4465',
              }}
            />
          </div>
        </div>
      )}

      {/* Lista de itens */}
      {loading ? (
        <div className="space-y-2 mb-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-0 mb-3">
          {items.map((item) => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={() => toggleItem(item, userEmail)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      )}

      {/* Campo para adicionar novo item */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar item..."
          disabled={adding}
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none transition-colors disabled:opacity-50"
          style={{
            borderColor: '#e2e8f0',
            fontSize: '13px',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
          onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
        />
        <button
          onClick={handleAddItem}
          disabled={!newItemText.trim() || adding}
          className="px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#3D4465', fontSize: '12px' }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
