// Página principal do Design Kanban — quadro estilo Trello para gestão de artes
import { useState, useCallback, useRef } from 'react';
import { Search, Plus, Clock } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { useDesignColumns } from '../hooks/useDesignColumns';
import { useDesignCards } from '../hooks/useDesignCards';
import { useDesignLabels } from '../hooks/useDesignLabels';
import { useToast } from '../contexts/ToastContext';
import { getAvatarColor, getInitials } from '../components/design-kanban/KanbanCard';
import { supabase } from '../lib/supabase';
import KanbanBoard, { type KanbanBoardRef } from '../components/design-kanban/KanbanBoard';
import CardModal from '../components/design-kanban/CardModal';
import NewCardModal from '../components/design-kanban/NewCardModal';
import SkeletonBoard from '../components/design-kanban/SkeletonBoard';
import HistoryModal from '../components/design-kanban/HistoryModal';
import SearchModal from '../components/design-kanban/SearchModal';
import type { DesignCard } from '../types/design.types';

export default function DesignKanban() {
  const { addToast } = useToast();

  const { user } = useUser();

  const { columns, loading: loadingColumns } = useDesignColumns();
  const { cards, loading: loadingCards, createCard, moveCard, refetch } = useDesignCards();
  const { labels } = useDesignLabels();

  // ID do card aberto no modal de detalhes
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Controle do modal de nova solicitação (botão do header)
  const [showNewCardModal, setShowNewCardModal] = useState(false);

  // Controle do modal de histórico
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Controle do modal de busca
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Ref do board para chamar scrollToCard após seleção no SearchModal
  const boardRef = useRef<KanbanBoardRef>(null);

  const isLoading = loadingColumns || loadingCards;

  function handleCardClick(card: DesignCard) {
    setSelectedCardId(card.id);
  }

  async function handleCreateCard(data: Parameters<typeof createCard>[0]) {
    await createCard(data);
    addToast('Solicitação criada com sucesso', 'success');
  }

  // Finalizar um card — arquiva, cria log e remove do board
  const handleFinalizeCard = useCallback(async (card: DesignCard) => {
    const { error } = await supabase
      .from('design_cards')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', card.id);

    if (error) {
      addToast('Erro ao finalizar trabalho', 'error');
      return;
    }

    await supabase.from('design_activity_log').insert({
      card_id: card.id,
      actor_email: user.email,
      actor_name: user.name,
      action: 'finished',
      details: {
        finished_at: new Date().toISOString(),
        finished_by: user.name,
      },
    });

    addToast('Trabalho finalizado com sucesso!', 'success');
  }, [user, addToast]);

  // Ao selecionar um card no SearchModal: fecha o modal e rola o board até o card
  function handleSearchSelectCard(card: DesignCard) {
    setShowSearchModal(false);
    setTimeout(() => {
      boardRef.current?.scrollToCard(card.id);
    }, 100);
  }

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f0f2f5 0%, #e8ecf1 100%)',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@400;500;600;700&display=swap');
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ── HEADER LINHA ÚNICA ─────────────────────────────────────────────── */}
      <header
        className="flex-shrink-0 flex items-center justify-between"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 999,
          background: '#FFFFFF',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          padding: '0 24px',
          height: '64px',
        }}
      >
        {/* Esquerda: logo + separador + título */}
        <div className="flex items-center" style={{ gap: '16px' }}>
          <img
            src="/asset_1.svg"
            alt="Anexus"
            style={{ height: '40px', width: 'auto', flexShrink: 0 }}
          />
          <div style={{ width: '1px', height: '28px', background: '#e2e8f0', flexShrink: 0 }} />
          <span
            className="select-none"
            style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: '20px', color: '#1e293b' }}
          >
            Design Board
          </span>
        </div>

        {/* Direita: busca + histórico + nova solicitação + ao vivo + avatar */}
        <div className="flex items-center gap-2">
          {/* Botão de busca — parece um input mas é um botão que abre o SearchModal */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-2 rounded-lg border transition-colors"
            style={{
              width: '180px',
              height: '36px',
              padding: '0 12px',
              borderColor: '#e2e8f0',
              background: '#f8fafc',
              color: '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3D4465'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            <Search style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>Buscar...</span>
          </button>

          {/* Botão Histórico */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 transition-colors hover:bg-gray-50"
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0 14px',
              height: '36px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#3D4465',
              whiteSpace: 'nowrap',
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Histórico</span>
          </button>

          {/* Botão Nova Solicitação */}
          {!isLoading && columns.length > 0 && (
            <button
              onClick={() => setShowNewCardModal(true)}
              className="flex items-center gap-1.5 text-white transition-opacity hover:opacity-90"
              style={{
                background: '#3D4465',
                borderRadius: '8px',
                padding: '0 14px',
                height: '36px',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Solicitação</span>
            </button>
          )}

          {/* Separador */}
          <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 4px' }} />

          {/* Indicador realtime "Ao vivo" */}
          <div
            className="flex items-center gap-1.5 cursor-default"
            title={isLoading ? 'Conectando ao Supabase...' : 'Conectado — dados em tempo real'}
          >
            <span className="relative flex h-2 w-2">
              {!isLoading && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#10b981' }} />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: isLoading ? '#e2e8f0' : '#10b981' }} />
            </span>
            <span className={`font-medium ${isLoading ? 'text-gray-400' : 'text-emerald-600'}`} style={{ fontSize: '11px' }}>
              {isLoading ? 'Conectando...' : 'Ao vivo'}
            </span>
          </div>

          {/* Avatar + nome */}
          <div className="flex items-center gap-2" style={{ paddingLeft: '12px', borderLeft: '1px solid #e2e8f0' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
              style={{ background: getAvatarColor(user.email), fontSize: '11px' }}
              title={user.email}
            >
              {getInitials(user.name)}
            </div>
            <span className="text-gray-700 font-medium hidden sm:block" style={{ fontSize: '13px' }}>
              {user.name.split(' ')[0]}
            </span>
          </div>
        </div>
      </header>

      {/* ── ÁREA PRINCIPAL — ocupa exatamente o restante da tela ─────── */}
      <main
        className="flex-1 overflow-hidden"
        style={{ position: 'relative', zIndex: 1, padding: 0 }}
      >
        {isLoading ? (
          <div className="h-full px-4 pt-4">
            <SkeletonBoard />
          </div>
        ) : columns.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 font-medium">Nenhuma coluna configurada</p>
              <p className="text-gray-400 text-sm mt-1">Adicione colunas na tabela design_columns do Supabase.</p>
            </div>
          </div>
        ) : (
          <KanbanBoard
            ref={boardRef}
            columns={columns}
            cards={cards}
            requestedBy={user.email}
            requestedByName={user.name}
            onCardClick={handleCardClick}
            onCreateCard={handleCreateCard}
            onMoveCard={moveCard}
            onFinalizeCard={handleFinalizeCard}
          />
        )}
      </main>

      {/* Modal de busca — encontra e navega até cards */}
      {showSearchModal && (
        <SearchModal
          cards={cards}
          columns={columns}
          labels={labels}
          onClose={() => setShowSearchModal(false)}
          onSelectCard={handleSearchSelectCard}
        />
      )}

      {/* Modal de nova solicitação (aberto pelo botão do header) */}
      {showNewCardModal && (
        <NewCardModal
          columns={columns}
          defaultColumnId={columns[0]?.id}
          requestedBy={user.email}
          requestedByName={user.name}
          onSubmit={handleCreateCard}
          onClose={() => setShowNewCardModal(false)}
        />
      )}

      {/* Modal de detalhes do card */}
      <CardModal
        cardId={selectedCardId}
        columns={columns}
        userEmail={user.email}
        userName={user.name}
        onClose={() => setSelectedCardId(null)}
        onCardUpdated={refetch}
        onCardArchived={() => { setSelectedCardId(null); addToast('Card arquivado', 'info'); }}
        onCardDeleted={() => { setSelectedCardId(null); addToast('Card deletado', 'error'); }}
      />

      {/* Modal de histórico de trabalhos finalizados */}
      {showHistoryModal && (
        <HistoryModal
          columns={columns}
          userEmail={user.email}
          userName={user.name}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
}
