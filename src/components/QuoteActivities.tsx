import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Upload, CheckCircle2, XCircle, Send, Printer,
  FileText, Bot, Clock, RefreshCw, Activity,
} from 'lucide-react';

interface QuoteActivity {
  id: number;
  quote_id: number;
  action: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
}

interface ActionMeta {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  UPLOAD_ORCAMENTO:      { label: 'PDF do orçamento anexado',       icon: Upload,         color: 'text-blue-500',   bg: 'bg-blue-50' },
  IA_PARSE_OK:           { label: 'Leitura automática concluída',    icon: Bot,            color: 'text-teal-500',   bg: 'bg-teal-50' },
  PRONTO_PARA_ENVIAR:    { label: 'Marcado como pronto para enviar', icon: Clock,          color: 'text-yellow-500', bg: 'bg-yellow-50' },
  ORCAMENTO_ENVIADO:     { label: 'Orçamento enviado ao cliente',    icon: Send,           color: 'text-sky-500',    bg: 'bg-sky-50' },
  ENVIADO_CHATWOOT:      { label: 'PDF enviado via Chatwoot',        icon: Send,           color: 'text-sky-500',    bg: 'bg-sky-50' },
  ENVIADO_VENDEDOR_WEBHOOK: { label: 'Orçamento enviado ao vendedor (WhatsApp automático)', icon: Send, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  APROVADO_CLIENTE:      { label: 'Aprovado pelo cliente',           icon: CheckCircle2,   color: 'text-green-500',  bg: 'bg-green-50' },
  RECUSADO:              { label: 'Recusado',                        icon: XCircle,        color: 'text-red-500',    bg: 'bg-red-50' },
  OS_GERADA:             { label: 'OS gerada',                       icon: FileText,       color: 'text-orange-500', bg: 'bg-orange-50' },
  OS_NUMERO_SALVO:       { label: 'Número de OS salvo',              icon: FileText,       color: 'text-orange-500', bg: 'bg-orange-50' },
  ENVIADO_IMPRESSAO:     { label: 'Enviado para impressão',          icon: Printer,        color: 'text-gray-600',   bg: 'bg-gray-100' },
  IMPR_BAIXADA_PRONTA:   { label: 'Impressão concluída',             icon: CheckCircle2,   color: 'text-green-600',  bg: 'bg-green-50' },
  FINANCEIRO_SALVO:      { label: 'Dados financeiros salvos',        icon: RefreshCw,      color: 'text-blue-400',   bg: 'bg-blue-50' },
};

function getActionMeta(action: string): ActionMeta {
  return ACTION_META[action] ?? {
    label: action,
    icon: Activity,
    color: 'text-gray-400',
    bg: 'bg-gray-50',
  };
}

interface QuoteActivitiesProps {
  quoteId: number;
  refreshKey?: number;
}

export default function QuoteActivities({ quoteId, refreshKey = 0 }: QuoteActivitiesProps) {
  const [activities, setActivities] = useState<QuoteActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quote_activities')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false });
    setActivities(data ?? []);
    setLoading(false);
  }, [quoteId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-3 px-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 bg-gray-100 rounded w-2/3" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Activity className="w-8 h-8 text-gray-200 mb-2" />
        <p className="text-sm text-gray-400">Nenhuma atividade registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
      <div className="space-y-1">
        {activities.map((act) => {
          const meta = getActionMeta(act.action);
          const Icon = meta.icon;
          return (
            <div key={act.id} className="flex gap-3 relative">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 z-10 border border-white ${meta.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              </div>
              <div className="flex-1 pb-4 min-w-0">
                <p className="text-sm font-medium text-gray-700 leading-tight">{meta.label}</p>
                {act.message && (
                  <p className="text-xs text-gray-500 mt-0.5 break-words leading-relaxed">
                    {act.message}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] font-medium text-gray-500">
                    {act.author_name ?? 'Sistema'}
                  </span>
                  <span className="text-[11px] text-gray-300">·</span>
                  <span className="text-[11px] text-gray-400">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
