// Modal de busca do Design Kanban — encontra cards e navega até eles no board
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, Tag } from 'lucide-react';
import type { DesignCard, DesignColumn, DesignLabel, DesignCardPriority } from '../../types/design.types';

interface SearchModalProps {
  cards: DesignCard[];
  columns: DesignColumn[];
  labels: DesignLabel[];
  onClose: () => void;
  onSelectCard: (card: DesignCard) => void;
}

const PRIORITY_CONFIG: Record<DesignCardPriority, { label: string; color: string }> = {
  baixa:   { label: 'Baixa',   color: '#9ca3af' },
  media:   { label: 'Média',   color: '#3b82f6' },
  alta:    { label: 'Alta',    color: '#f97316' },
  urgente: { label: 'Urgente', color: '#ef4444' },
};

const ALL_PRIORITIES: DesignCardPriority[] = ['baixa', 'media', 'alta', 'urgente'];

export default function SearchModal({ cards, columns, labels, onClose, onSelectCard }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeColumnIds, setActiveColumnIds] = useState<string[]>(columns.map((c) => c.id));
  const [activePriorities, setActivePriorities] = useState<DesignCardPriority[]>([...ALL_PRIORITIES]);
  const [activeLabelIds, setActiveLabelIds] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foco automático no input ao abrir o modal
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Debounce da busca (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Filtrar resultados com base em query + filtros rápidos
  const results = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();

    return cards.filter((card) => {
      // Filtro por coluna ativa
      if (!activeColumnIds.includes(card.column_id)) return false;

      // Filtro por prioridade ativa
      if (!activePriorities.includes(card.priority)) return false;

      // Filtro por etiqueta ativa (card deve ter PELO MENOS UMA das selecionadas)
      if (activeLabelIds.length > 0) {
        const cardLabelIds = (card.labels ?? []).map((l) => l.id);
        const hasAny = activeLabelIds.some((id) => cardLabelIds.includes(id));
        if (!hasAny) return false;
      }

      // Filtro por texto (busca em título, cliente, telefone e descrição)
      if (q) {
        const haystack = [
          card.title,
          card.cliente_nome ?? '',
          card.cliente_telefone ?? '',
          card.description ?? '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [cards, debouncedQuery, activeColumnIds, activePriorities, activeLabelIds]);

  // Resetar índice focado quando resultados mudam
  useEffect(() => { setFocusedIndex(0); }, [results]);

  // Scroll automático para o item focado
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(`[data-index="${focusedIndex}"]`) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  // Navegação por teclado
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[focusedIndex]) {
      onSelectCard(results[focusedIndex]);
    }
  }, [results, focusedIndex, onClose, onSelectCard]);

  // Fechar com ESC no overlay
  function handleOverlayKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function toggleColumn(id: string) {
    setActiveColumnIds((prev) =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter((v) => v !== id) : prev
        : [...prev, id]
    );
  }

  function togglePriority(p: DesignCardPriority) {
    setActivePriorities((prev) =>
      prev.includes(p)
        ? prev.length > 1 ? prev.filter((v) => v !== p) : prev
        : [...prev, p]
    );
  }

  function toggleLabel(id: string) {
    setActiveLabelIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  const columnMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, c])),
    [columns]
  );

  return (
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.4)', paddingTop: '8vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleOverlayKeyDown}
      tabIndex={-1}
    >
      <div
        className="w-full bg-white flex flex-col"
        style={{
          maxWidth: '700px',
          maxHeight: '80vh',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
          animation: 'searchModalIn 0.2s ease',
          overflow: 'hidden',
          margin: '0 16px',
        }}
        onKeyDown={handleKeyDown}
      >
        <style>{`
          @keyframes searchModalIn {
            from { opacity: 0; transform: scale(0.95) translateY(-8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>

        {/* Campo de busca */}
        <div
          className="flex items-center gap-3"
          style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}
        >
          <Search style={{ width: '20px', height: '20px', color: '#94a3b8', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, cliente, telefone..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontSize: '16px', color: '#1e293b' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            title="Fechar (ESC)"
          >
            <X style={{ width: '18px', height: '18px', color: '#64748b' }} />
          </button>
        </div>

        {/* Filtros rápidos */}
        <div
          style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}
        >
          {/* Chips de colunas */}
          <div className="flex flex-wrap items-center" style={{ gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Etapa</span>
            {columns.map((col) => {
              const active = activeColumnIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  className="transition-all"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: `1.5px solid ${col.color}`,
                    background: active ? col.color : 'transparent',
                    color: active ? '#fff' : col.color,
                    cursor: 'pointer',
                  }}
                >
                  {col.title}
                </button>
              );
            })}
          </div>

          {/* Chips de prioridade */}
          <div className="flex flex-wrap items-center" style={{ gap: '6px', marginBottom: labels.length > 0 ? '8px' : '0' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Prioridade</span>
            {ALL_PRIORITIES.map((p) => {
              const cfg = PRIORITY_CONFIG[p];
              const active = activePriorities.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePriority(p)}
                  className="transition-all"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    border: `1.5px solid ${cfg.color}`,
                    background: active ? cfg.color : 'transparent',
                    color: active ? '#fff' : cfg.color,
                    cursor: 'pointer',
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Chips de etiquetas (somente se houver etiquetas) */}
          {labels.length > 0 && (
            <div className="flex flex-wrap items-center" style={{ gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>Etiqueta</span>
              {labels.map((label) => {
                const active = activeLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className="transition-all"
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 500,
                      border: `1.5px solid ${label.color}`,
                      background: active ? label.color : 'transparent',
                      color: active ? '#fff' : label.color,
                      cursor: 'pointer',
                    }}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contador e lista de resultados */}
        <div className="flex-1 overflow-y-auto" ref={listRef}>
          {/* Contador */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '10px 20px 6px', flexShrink: 0 }}
          >
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              {results.length === 0
                ? 'Nenhum card encontrado'
                : `${results.length} card${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`}
            </span>
            {(debouncedQuery || activeLabelIds.length > 0 || activePriorities.length < 4 || activeColumnIds.length < columns.length) && (
              <button
                onClick={() => {
                  setQuery('');
                  setActiveColumnIds(columns.map((c) => c.id));
                  setActivePriorities([...ALL_PRIORITIES]);
                  setActiveLabelIds([]);
                }}
                style={{ fontSize: '12px', color: '#3D4465', fontWeight: 500 }}
                className="hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Estado vazio */}
          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Search style={{ width: '40px', height: '40px', color: '#e2e8f0', marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>Nenhum card corresponde à busca</p>
            </div>
          )}

          {/* Resultados */}
          {results.map((card, index) => {
            const col = columnMap[card.column_id];
            const priorityCfg = PRIORITY_CONFIG[card.priority];
            const isFocused = index === focusedIndex;

            return (
              <button
                key={card.id}
                data-index={index}
                onClick={() => onSelectCard(card)}
                onMouseEnter={() => setFocusedIndex(index)}
                className="w-full text-left transition-colors"
                style={{
                  padding: '10px 20px',
                  background: isFocused ? '#f8fafc' : 'transparent',
                  borderBottom: '1px solid #f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Indicador da coluna */}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: col?.color ?? '#cbd5e1',
                    flexShrink: 0,
                  }}
                />

                {/* Conteúdo principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span style={{ fontSize: '11px', color: col?.color ?? '#94a3b8', fontWeight: 500, flexShrink: 0 }}>
                      {col?.title ?? '—'}
                    </span>
                    {card.labels && card.labels.length > 0 && (
                      <div className="flex items-center gap-1 overflow-hidden">
                        {card.labels.slice(0, 3).map((label) => (
                          <span
                            key={label.id}
                            style={{
                              background: label.color,
                              color: '#fff',
                              fontSize: '10px',
                              fontWeight: 500,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              flexShrink: 0,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                        {card.labels.length > 3 && (
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>+{card.labels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <p
                    className="font-medium truncate"
                    style={{ fontSize: '14px', color: '#1e293b' }}
                  >
                    {card.title}
                  </p>
                  {card.cliente_nome && (
                    <p
                      className="truncate"
                      style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}
                    >
                      {card.cliente_nome}
                      {card.cliente_telefone && <span style={{ color: '#94a3b8' }}> · {card.cliente_telefone}</span>}
                    </p>
                  )}
                </div>

                {/* Badge de prioridade */}
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: `${priorityCfg.color}18`,
                    color: priorityCfg.color,
                    flexShrink: 0,
                  }}
                >
                  {priorityCfg.label}
                </span>
              </button>
            );
          })}

          {/* Espaço no final da lista */}
          {results.length > 0 && <div style={{ height: '8px' }} />}
        </div>

        {/* Rodapé com dicas de teclado */}
        <div
          className="flex items-center gap-4"
          style={{
            padding: '10px 20px',
            borderTop: '1px solid #f1f5f9',
            flexShrink: 0,
            background: '#fafafa',
          }}
        >
          {[
            { key: '↑↓', desc: 'Navegar' },
            { key: 'Enter', desc: 'Abrir' },
            { key: 'ESC', desc: 'Fechar' },
          ].map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-1.5">
              <kbd
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  color: '#475569',
                  fontFamily: 'monospace',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
