import { useEffect, useState } from 'react';
import {
  X, Loader2, Send, CheckCircle2, Clock, AlertCircle, User, Tag, MessageSquare, ChevronDown,
  Paperclip, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useChatwootUser } from '../contexts/ChatwootUserContext';
import { useUser } from '../contexts/UserContext';

interface TicketComment {
  id: number;
  autor_nome: string;
  autor_email: string;
  conteudo: string;
  created_at: string;
}

interface Ticket {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  status: string;
  prioridade: string;
  reportado_por_nome: string;
  reportado_por_email: string;
  resolvido_por_nome: string | null;
  resolvido_por_email: string | null;
  resolvido_em: string | null;
  arquivo_url: string | null;
  arquivo_nome_original: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aberto: { label: 'Aberto', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  em_andamento: { label: 'Em andamento', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  resolvido: { label: 'Resolvido', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'text-gray-500' },
  media: { label: 'Média', color: 'text-blue-600' },
  alta: { label: 'Alta', color: 'text-orange-600' },
  urgente: { label: 'Urgente', color: 'text-red-600' },
};

const CATEGORIA_LABELS: Record<string, string> = {
  bug: 'Bug / Erro',
  melhoria: 'Melhoria',
  duvida: 'Dúvida',
  outro: 'Outro',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(startIso: string, endIso: string | null) {
  const end = endIso ? new Date(endIso) : new Date();
  const diffMs = end.getTime() - new Date(startIso).getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

interface Props {
  ticketId: number;
  onClose: () => void;
  onUpdated: () => void;
}

export default function TicketDrawer({ ticketId, onClose, onUpdated }: Props) {
  const chatwootUser = useChatwootUser();
  const { user: appUser } = useUser();
  const userName = chatwootUser?.name ?? appUser.name;
  const userEmail = chatwootUser?.email ?? appUser.email;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  async function fetchData() {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('ticket_comments').select('*').eq('ticket_id', ticketId).order('created_at'),
    ]);
    if (t) setTicket(t);
    if (c) setComments(c);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [ticketId]);

  async function handleStatusChange(newStatus: string) {
    if (!ticket) return;
    setUpdatingStatus(true);
    setShowStatusMenu(false);

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'resolvido') {
      updates.resolvido_por_nome = userName;
      updates.resolvido_por_email = userEmail;
      updates.resolvido_em = new Date().toISOString();
    } else if (ticket.status === 'resolvido') {
      updates.resolvido_por_nome = null;
      updates.resolvido_por_email = null;
      updates.resolvido_em = null;
    }

    await supabase.from('tickets').update(updates).eq('id', ticketId);
    await fetchData();
    onUpdated();
    setUpdatingStatus(false);
  }

  async function handleSendComment() {
    if (!newComment.trim()) return;
    setSendingComment(true);
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      autor_nome: userName,
      autor_email: userEmail,
      conteudo: newComment.trim(),
    });
    setNewComment('');
    await fetchData();
    setSendingComment(false);
  }

  const statusCfg = ticket ? STATUS_CONFIG[ticket.status] : null;
  const prioridadeCfg = ticket ? PRIORIDADE_CONFIG[ticket.prioridade] : null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-800">Detalhes do Ticket</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : ticket ? (
          <div className="flex-1 overflow-y-auto">
            {/* Título e status */}
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-900 leading-snug flex-1">{ticket.titulo}</h3>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowStatusMenu((v) => !v)}
                    disabled={updatingStatus}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-opacity ${statusCfg?.bg} ${statusCfg?.color} ${updatingStatus ? 'opacity-60' : 'hover:opacity-80'}`}
                  >
                    {updatingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {statusCfg?.label}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showStatusMenu && (
                    <div className="absolute right-0 top-full mt-1 w-40 glass-card-static shadow-lg z-10 py-1">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 ${cfg.color} ${ticket.status === key ? 'bg-gray-50 font-semibold' : ''}`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  {CATEGORIA_LABELS[ticket.categoria] ?? ticket.categoria}
                </span>
                <span className={`flex items-center gap-1 font-medium ${prioridadeCfg?.color}`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  {prioridadeCfg?.label}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {ticket.reportado_por_nome}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(ticket.created_at)}
                </span>
              </div>
            </div>

            {/* Descrição */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Descrição</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ticket.descricao}</p>
            </div>

            {/* Arquivo anexado */}
            {ticket.arquivo_url && (
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Arquivo anexado</p>
                <a
                  href={ticket.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[240px]">{ticket.arquivo_nome_original ?? 'Arquivo'}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                </a>
              </div>
            )}

            {/* Info resolução */}
            {ticket.status === 'resolvido' && ticket.resolvido_em && (
              <div className="px-5 py-3 border-b border-gray-100 bg-green-50">
                <div className="flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Resolvido por <strong>{ticket.resolvido_por_nome}</strong> em{' '}
                    {formatDate(ticket.resolvido_em)} &mdash; tempo total:{' '}
                    <strong>{formatDuration(ticket.created_at, ticket.resolvido_em)}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Comentários */}
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Comentários ({comments.length})
              </p>

              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 mb-4">Nenhum comentário ainda.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700">{c.autor_nome}</span>
                        <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{c.conteudo}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  className="input-field-textarea flex-1 min-h-[60px]"
                  placeholder="Adicionar comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendComment();
                  }}
                />
                <button
                  onClick={handleSendComment}
                  disabled={!newComment.trim() || sendingComment}
                  className="btn-primary self-end px-3"
                >
                  {sendingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Ctrl+Enter para enviar</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Ticket não encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
