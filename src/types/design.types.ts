// Tipos TypeScript para o módulo de Design Kanban

// Coluna do Kanban (ex: Solicita, Desenvolve, Aprovação, Pré-Impressão, Produção)
export interface DesignColumn {
  id: string;
  title: string;
  slug: string;
  color: string;
  position: number;
  is_active: boolean;
}

// Prioridades disponíveis para um card
export type DesignCardPriority = 'baixa' | 'media' | 'alta' | 'urgente';

// Card do Kanban — representa um pedido de arte
export interface DesignCard {
  id: string;
  column_id: string;
  cliente_id: string | null;
  title: string;
  description: string | null;
  position: number;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  priority: DesignCardPriority;
  due_date: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  cover_image_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Dados agregados vindos do banco
  comments_count?: number;
  attachments_count?: number;
  labels?: DesignLabel[];
  checklist_total?: number;
  checklist_done?: number;
}

// Etiqueta de cor para classificar cards
export interface DesignLabel {
  id: string;
  name: string;
  color: string;
}

// Comentário em um card
export interface DesignComment {
  id: string;
  card_id: string;
  author_email: string;
  author_name: string;
  content: string;
  is_edited: boolean;
  created_at: string;
}

// Anexo em um card
export interface DesignAttachment {
  id: string;
  card_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

// Registro de atividade/histórico de um card
export interface DesignActivityLog {
  id: string;
  card_id: string;
  actor_email: string;
  actor_name: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// Item de checklist dentro de um card
export interface DesignChecklistItem {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  completed_at: string | null;
  completed_by: string | null;
}
