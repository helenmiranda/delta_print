// Componente de comentários dentro do drawer de detalhes do card
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDesignComments } from '../../hooks/useDesignComments';

interface CardCommentsProps {
  cardId: string;
  userEmail: string;
  userName: string;
}

// Gera uma cor de fundo para o avatar baseada no email do autor
function getAvatarColor(email: string): string {
  const colors = [
    '#3D4465', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Gera as iniciais de um nome para exibir no avatar
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function CardComments({ cardId, userEmail, userName }: CardCommentsProps) {
  const { comments, loading, addComment } = useDesignComments(cardId);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Referência para scroll automático até o último comentário
  const bottomRef = useRef<HTMLDivElement>(null);

  // Rolar até o final ao carregar ou receber novo comentário
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  // Enviar comentário ao pressionar Ctrl+Enter ou clicar em "Enviar"
  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    await addComment(text, userEmail, userName);
    setText('');
    setSending(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col">
      {/* Cabeçalho com contador */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">Comentários</span>
        {comments.length > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ background: '#3D4465' }}
          >
            {comments.length}
          </span>
        )}
      </div>

      {/* Lista de comentários */}
      <div className="space-y-4 mb-4 max-h-80 overflow-y-auto pr-1">
        {loading ? (
          // Skeleton de carregamento
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-2.5 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          // Estado vazio
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        ) : (
          // Lista real de comentários
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              {/* Avatar circular com iniciais coloridas */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{
                  background: getAvatarColor(comment.author_email),
                  fontSize: '11px',
                }}
                title={comment.author_email}
              >
                {getInitials(comment.author_name)}
              </div>

              <div className="flex-1 min-w-0">
                {/* Nome e data */}
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {comment.author_name}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {/* Conteúdo do comentário */}
                <p
                  className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words rounded-lg px-3 py-2"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                >
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        )}
        {/* Âncora para scroll automático */}
        <div ref={bottomRef} />
      </div>

      {/* Campo de novo comentário */}
      <div
        className="flex gap-2.5 items-end pt-3"
        style={{ borderTop: '1px solid #e2e8f0' }}
      >
        {/* Avatar do usuário logado */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 mb-0.5"
          style={{ background: getAvatarColor(userEmail), fontSize: '11px' }}
        >
          {getInitials(userName)}
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
            rows={2}
            disabled={sending}
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none transition-colors resize-none disabled:opacity-50"
            style={{ borderColor: '#e2e8f0', fontSize: '13px' }}
            onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
            onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
          />

          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#3D4465' }}
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
