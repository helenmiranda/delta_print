// Log de atividades do card — timeline vertical com subscription Realtime
import { Activity, Plus, ArrowRight, MessageCircle, Paperclip, CreditCard as Edit2, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDesignActivity } from '../../hooks/useDesignActivity';
import type { DesignActivityLog } from '../../types/design.types';

interface CardActivityLogProps {
  cardId: string;
  // Mapa de id→título de colunas para traduzir IDs em nomes legíveis
  columnMap: Record<string, string>;
}

// Configuração visual (cor de fundo, cor do ícone) por tipo de ação
const ACTION_CONFIG: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  card_created: { icon: <Plus className="w-3 h-3" />, bg: '#dcfce7', text: '#16a34a' },
  card_moved:   { icon: <ArrowRight className="w-3 h-3" />, bg: '#dbeafe', text: '#2563eb' },
  commented:    { icon: <MessageCircle className="w-3 h-3" />, bg: '#ede9fe', text: '#7c3aed' },
  attached:     { icon: <Paperclip className="w-3 h-3" />, bg: '#ffedd5', text: '#ea580c' },
  updated:      { icon: <Edit2 className="w-3 h-3" />, bg: '#f1f5f9', text: '#64748b' },
  archived:     { icon: <Edit2 className="w-3 h-3" />, bg: '#f1f5f9', text: '#64748b' },
  label_added:  { icon: <Tag className="w-3 h-3" />, bg: '#fef9c3', text: '#ca8a04' },
  label_removed:{ icon: <Tag className="w-3 h-3" />, bg: '#fee2e2', text: '#dc2626' },
};

// Fallback para ações desconhecidas
const DEFAULT_CONFIG = ACTION_CONFIG.updated;

// Gera texto descritivo legível para cada tipo de log
function buildDescription(
  log: DesignActivityLog,
  columnMap: Record<string, string>
): string {
  const actor = log.actor_name || log.actor_email || 'Alguém';
  const d = log.details as Record<string, string> | null;

  switch (log.action) {
    case 'card_created':
      return `${actor} criou esta solicitação`;

    case 'card_moved': {
      const from = d?.from_column ? (columnMap[d.from_column] ?? d.from_column) : '?';
      const to   = d?.to_column   ? (columnMap[d.to_column]   ?? d.to_column)   : '?';
      return `${actor} moveu de "${from}" para "${to}"`;
    }

    case 'commented':
      return `${actor} adicionou um comentário`;

    case 'attached':
      return `${actor} anexou ${d?.file_name ?? 'um arquivo'}`;

    case 'archived':
      return `${actor} arquivou esta solicitação`;

    case 'updated':
      return `${actor} atualizou ${d?.field ?? 'o card'}`;

    case 'label_added':
      return `${actor} adicionou a etiqueta "${d?.label_name ?? ''}"`;

    case 'label_removed':
      return `${actor} removeu a etiqueta "${d?.label_name ?? ''}"`;

    default:
      return `${actor} realizou uma ação`;
  }
}

// Item individual da timeline com linha conectora
function ActivityItem({
  log,
  columnMap,
  isLast,
}: {
  log: DesignActivityLog;
  columnMap: Record<string, string>;
  isLast: boolean;
}) {
  const config = ACTION_CONFIG[log.action] ?? DEFAULT_CONFIG;
  const description = buildDescription(log, columnMap);

  return (
    <div className="flex gap-3 relative">
      {/* Linha conectora vertical — não exibida no último item */}
      {!isLast && (
        <div
          className="absolute left-3.5 top-7 bottom-0 w-0.5"
          style={{ background: '#e2e8f0', transform: 'translateX(-50%)' }}
        />
      )}

      {/* Ícone circular colorido por tipo de ação */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
        style={{ background: config.bg, color: config.text }}
      >
        {config.icon}
      </div>

      {/* Texto descritivo e data relativa */}
      <div className="flex-1 pb-4 min-w-0">
        <p className="leading-snug" style={{ fontSize: '13px', color: '#64748b' }}>
          {description}
        </p>
        <p className="mt-0.5" style={{ fontSize: '12px', color: '#94a3b8' }}>
          {formatDistanceToNow(new Date(log.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>
    </div>
  );
}

export default function CardActivityLog({ cardId, columnMap }: CardActivityLogProps) {
  const { activities, loading, hasMore, loadMore } = useDesignActivity(cardId);

  return (
    <div>
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">Atividades</span>
      </div>

      {loading ? (
        // Skeleton de carregamento da timeline
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5 pb-4">
                <div className="h-3 bg-gray-200 rounded w-4/5" />
                <div className="h-2.5 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Nenhuma atividade registrada
        </p>
      ) : (
        <>
          {/* Timeline de atividades */}
          <div>
            {activities.map((log, idx) => (
              <ActivityItem
                key={log.id}
                log={log}
                columnMap={columnMap}
                isLast={idx === activities.length - 1 && !hasMore}
              />
            ))}
          </div>

          {/* Botão para carregar mais atividades */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
            >
              Ver mais atividades
            </button>
          )}
        </>
      )}
    </div>
  );
}
