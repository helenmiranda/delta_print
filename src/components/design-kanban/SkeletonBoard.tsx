// Skeleton animado do board — imita a estrutura real com 5 colunas pulsantes
// Exibe cards fictícios com opacidade pulsante enquanto os dados carregam do Supabase

// Card skeleton individual com estrutura idêntica ao KanbanCard real
function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-xl p-3 border border-gray-100"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: '3px solid #e2e8f0' }}
    >
      {/* Título do pedido */}
      <div className="h-3 bg-gray-200 rounded-full w-3/4 mb-2.5 animate-pulse" />
      {/* Bloco de cliente */}
      <div className="bg-blue-50/60 rounded-lg p-2 mb-2.5 space-y-1.5">
        <div className="h-2.5 bg-blue-100 rounded-full w-1/2 animate-pulse" />
        <div className="h-2 bg-blue-100 rounded-full w-1/3 animate-pulse" style={{ animationDelay: '0.1s' }} />
      </div>
      {/* Badges */}
      <div className="flex gap-1.5 mb-2">
        <div className="h-4 bg-gray-100 rounded w-12 animate-pulse" style={{ animationDelay: '0.15s' }} />
        <div className="h-4 bg-gray-100 rounded w-16 animate-pulse" style={{ animationDelay: '0.2s' }} />
      </div>
      {/* Rodapé */}
      <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
        <div className="h-2.5 bg-gray-100 rounded-full w-10 animate-pulse" style={{ animationDelay: '0.25s' }} />
        <div className="w-5 h-5 bg-gray-200 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );
}

// Coluna skeleton com header e cards — entra em cascata via animation delay
function SkeletonColumn({ color, cardCount, delay }: { color: string; cardCount: number; delay: number }) {
  return (
    <div
      className="flex flex-col rounded-xl flex-shrink-0 overflow-hidden"
      style={{
        width: '280px',
        minWidth: '260px',
        background: '#f8fafc',
        opacity: 0,
        animation: `sk-fadein 0.4s ease-out ${delay}ms forwards`,
      }}
    >
      {/* Header com cor da coluna */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: `${color}18`, borderTop: `4px solid ${color}`, borderBottom: `1px solid ${color}22` }}
      >
        <div className="h-3 rounded-full w-24 animate-pulse" style={{ background: `${color}40` }} />
        <div className="w-5 h-5 rounded-full animate-pulse" style={{ background: `${color}40` }} />
      </div>
      {/* Cards skeleton */}
      <div className="p-2 space-y-2">
        {Array.from({ length: cardCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

// Configuração das 5 colunas padrão do Design Board
const SKELETON_COLS = [
  { color: '#6366f1', cards: 3 },
  { color: '#0ea5e9', cards: 2 },
  { color: '#f59e0b', cards: 3 },
  { color: '#10b981', cards: 2 },
  { color: '#3D4465', cards: 1 },
];

export default function SkeletonBoard() {
  return (
    <>
      {/* Keyframe de entrada em cascata */}
      <style>{`
        @keyframes sk-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex gap-4 h-full pb-4" style={{ overflowX: 'auto', alignItems: 'flex-start' }}>
        {SKELETON_COLS.map((col, i) => (
          <SkeletonColumn key={i} color={col.color} cardCount={col.cards} delay={i * 80} />
        ))}
      </div>
    </>
  );
}
