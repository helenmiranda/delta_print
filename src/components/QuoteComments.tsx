import { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, Loader2, CheckCircle2, HelpCircle, CheckCheck, Pencil, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useChatwootUser } from '../contexts/ChatwootUserContext';

interface QuoteComment {
  id: number;
  quote_id: number;
  quote_version_id: number | null;
  message: string;
  is_question: boolean;
  is_resolved: boolean;
  author_chatwoot_user_id: number | null;
  author_name: string | null;
  author_email: string | null;
  author_account_id: number | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  edited_at: string | null;
  edited_by: string | null;
}

function formatCommentDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface QuoteCommentsProps {
  quoteId: number;
  quoteVersionId?: string | null;
  onToast: (msg: string) => void;
  onStatusChange?: (newStatus: string) => void;
  onPendingCountChange?: () => void;
}

interface EditState {
  id: number;
  text: string;
  saving: boolean;
}

export default function QuoteComments({
  quoteId,
  quoteVersionId,
  onToast,
  onStatusChange,
  onPendingCountChange,
}: QuoteCommentsProps) {
  const chatwootUser = useChatwootUser();
  const [comments, setComments] = useState<QuoteComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  async function fetchComments() {
    const { data, error } = await supabase
      .from('quote_comments')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    if (error) {
      onToast('Erro ao carregar comentarios');
    } else {
      const list = data ?? [];
      setComments(list);
      onPendingCountChange?.();
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchComments();
  }, [quoteId]);

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, loading]);

  useEffect(() => {
    if (editState) {
      editTextareaRef.current?.focus();
    }
  }, [editState?.id]);

  const pendingQuestions = comments.filter((c) => c.is_question && !c.is_resolved);

  function canEdit(c: QuoteComment) {
    if (!chatwootUser) return false;
    if (c.author_chatwoot_user_id === null) return false;
    if (c.is_resolved) return false;
    return c.author_chatwoot_user_id === chatwootUser.id;
  }

  function startEdit(c: QuoteComment) {
    setEditState({ id: c.id, text: c.message, saving: false });
  }

  function cancelEdit() {
    setEditState(null);
  }

  async function saveEdit() {
    if (!editState || !chatwootUser) return;
    const trimmed = editState.text.trim();
    if (!trimmed) {
      onToast('O comentario nao pode ficar vazio');
      return;
    }

    setEditState((prev) => prev && { ...prev, saving: true });

    const { error } = await supabase
      .from('quote_comments')
      .update({
        message: trimmed,
        edited_at: new Date().toISOString(),
        edited_by: chatwootUser.name,
      })
      .eq('id', editState.id);

    if (error) {
      onToast('Erro ao atualizar comentario');
      setEditState((prev) => prev && { ...prev, saving: false });
      return;
    }

    setComments((prev) =>
      prev.map((c) =>
        c.id === editState.id
          ? { ...c, message: trimmed, edited_at: new Date().toISOString(), edited_by: chatwootUser.name }
          : c
      )
    );
    setEditState(null);
    onToast('Comentario atualizado');
  }

  async function handleSend() {
    if (!message.trim() || !chatwootUser) return;
    setSending(true);

    const { error } = await supabase.from('quote_comments').insert({
      quote_id: quoteId,
      quote_version_id: quoteVersionId ? parseInt(quoteVersionId, 10) : null,
      message: message.trim(),
      is_question: isQuestion,
      is_resolved: false,
      author_chatwoot_user_id: chatwootUser.id,
      author_name: chatwootUser.name,
      author_email: chatwootUser.email,
      author_account_id: chatwootUser.account_id,
    });

    if (error) {
      onToast('Erro ao enviar comentario');
      setSending(false);
      return;
    }

    setMessage('');
    setIsQuestion(false);
    await fetchComments();
    onToast('Comentario enviado');

    if (isQuestion) {
      const { error: statusError } = await supabase
        .from('quotes')
        .update({ status: 'AJUSTE_NECESSARIO' })
        .eq('id', quoteId);

      if (statusError) {
        onToast('Comentario salvo, mas nao foi possivel atualizar o status');
      } else {
        onStatusChange?.('AJUSTE_NECESSARIO');
      }
    }

    setSending(false);
  }

  async function handleResolve() {
    setResolving(true);

    const { error } = await supabase
      .from('quote_comments')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: chatwootUser?.name ?? 'Usuario',
      })
      .eq('quote_id', quoteId)
      .eq('is_question', true)
      .eq('is_resolved', false);

    if (error) {
      onToast('Erro ao resolver pendencia');
      setResolving(false);
      return;
    }

    await fetchComments();
    onToast('Pendencia resolvida');

    const { count, error: countError } = await supabase
      .from('quote_comments')
      .select('*', { count: 'exact', head: true })
      .eq('quote_id', quoteId)
      .eq('is_question', true)
      .eq('is_resolved', false);

    if (!countError) {
      const newStatus = (count ?? 0) === 0 ? 'PENDENTE_ORCAMENTO' : 'AJUSTE_NECESSARIO';
      const { error: statusError } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (statusError) {
        onToast('Pendencia resolvida, mas nao foi possivel atualizar o status');
      } else {
        onStatusChange?.(newStatus);
      }
    }

    setResolving(false);
  }

  const canSend = !!chatwootUser && !!message.trim() && !sending;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Comentarios / Duvidas
          {comments.length > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-600 text-[10px] font-semibold ml-0.5">
              {comments.length}
            </span>
          )}
        </h3>
        {pendingQuestions.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold border border-amber-200">
            <HelpCircle className="w-3 h-3" />
            {pendingQuestions.length} pendente{pendingQuestions.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="glass-card-static rounded-glass-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-7 text-center px-4">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <MessageSquare className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm text-gray-400">Nenhum comentario ainda.</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
            {comments.map((c) => {
              const isEditing = editState?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 ${
                    c.is_question && !c.is_resolved
                      ? 'bg-amber-50 border border-amber-200'
                      : c.is_question && c.is_resolved
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-700 truncate">
                      {c.author_name ?? 'Usuario'}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.is_question && !c.is_resolved && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold border border-amber-200">
                          <HelpCircle className="w-2.5 h-2.5" />
                          Duvida
                        </span>
                      )}
                      {c.is_question && c.is_resolved && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold border border-green-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Resolvida
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">{formatCommentDate(c.created_at)}</span>
                      {c.edited_at && (
                        <span className="text-[10px] text-gray-400 italic">editado</span>
                      )}
                      {!isEditing && canEdit(c) && (
                        <button
                          onClick={() => startEdit(c)}
                          className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                          title="Editar comentario"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex flex-col gap-2 mt-0.5">
                      <textarea
                        ref={editTextareaRef}
                        value={editState.text}
                        onChange={(e) => setEditState((prev) => prev && { ...prev, text: e.target.value })}
                        rows={3}
                        disabled={editState.saving}
                        className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none transition-all disabled:opacity-60"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          disabled={editState.saving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          Cancelar
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={editState.saving || !editState.text.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-500 text-white hover:bg-primary-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {editState.saving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          {editState.saving ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{c.message}</p>
                  )}

                  {c.is_resolved && c.resolved_by && (
                    <p className="text-[10px] text-green-600 mt-0.5">
                      Resolvida por {c.resolved_by}
                      {c.resolved_at ? ` em ${formatCommentDate(c.resolved_at)}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {pendingQuestions.length > 0 && (
          <div className="px-4 pb-3 pt-1">
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              {resolving ? 'Resolvendo...' : 'Marcar pendencia como resolvida'}
            </button>
          </div>
        )}

        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva um comentario ou duvida..."
            rows={3}
            disabled={!chatwootUser}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none transition-all disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isQuestion}
                onChange={(e) => setIsQuestion(e.target.checked)}
                disabled={!chatwootUser}
                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-600 font-medium">Marcar como duvida</span>
            </label>
            <button
              onClick={handleSend}
              disabled={!canSend}
              title={!chatwootUser ? 'Carregando usuario do Chat Anexus...' : undefined}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
          {!chatwootUser ? (
            <p className="text-[10px] text-amber-600">Carregando usuario do Chat Anexus...</p>
          ) : (
            <p className="text-[10px] text-gray-400">Ctrl+Enter para enviar rapidamente</p>
          )}
        </div>
      </div>
    </section>
  );
}
