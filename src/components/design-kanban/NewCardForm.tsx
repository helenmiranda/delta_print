// Formulário inline para criação de um novo card dentro de uma coluna
import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import type { CreateCardData } from '../../hooks/useDesignCards';

interface NewCardFormProps {
  columnId: string;
  requestedBy: string;
  requestedByName: string;
  onSubmit: (data: CreateCardData) => Promise<void>;
  onCancel: () => void;
}

// Aplica máscara de telefone brasileiro enquanto o usuário digita
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function NewCardForm({
  columnId,
  requestedBy,
  requestedByName,
  onSubmit,
  onCancel,
}: NewCardFormProps) {
  const [title, setTitle] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !clienteNome.trim()) return;

    setSubmitting(true);

    await onSubmit({
      column_id: columnId,
      title: title.trim(),
      cliente_nome: clienteNome.trim(),
      cliente_telefone: clienteTelefone || undefined,
      // Dados do atendente preenchidos automaticamente via UserContext
      requested_by: requestedBy,
      requested_by_name: requestedByName,
    });

    setSubmitting(false);
    onCancel();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl p-3 shadow-md border border-gray-200 space-y-2.5"
      style={{ transition: 'all 0.2s ease' }}
    >
      {/* Campo: título do pedido */}
      <input
        type="text"
        placeholder="Título do pedido *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        required
        className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
        style={{ fontSize: '13px' }}
      />

      {/* Campo: nome do cliente */}
      <input
        type="text"
        placeholder="Nome do cliente *"
        value={clienteNome}
        onChange={(e) => setClienteNome(e.target.value)}
        required
        className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
        style={{ fontSize: '13px' }}
      />

      {/* Campo: telefone do cliente com máscara brasileira */}
      <input
        type="tel"
        placeholder="Telefone (opcional)"
        value={clienteTelefone}
        onChange={(e) => setClienteTelefone(applyPhoneMask(e.target.value))}
        className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
        style={{ fontSize: '13px' }}
      />

      {/* Ações: criar ou cancelar */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="submit"
          disabled={submitting || !title.trim() || !clienteNome.trim()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ background: '#3D4465', fontSize: '12px' }}
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {submitting ? 'Criando...' : 'Criar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
