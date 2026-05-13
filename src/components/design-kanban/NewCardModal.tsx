// Modal centralizado de criação de nova solicitação de design
import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import type { DesignColumn, DesignCardPriority } from '../../types/design.types';
import type { CreateCardData } from '../../hooks/useDesignCards';

interface NewCardModalProps {
  columns: DesignColumn[];
  defaultColumnId?: string;
  requestedBy: string;
  requestedByName: string;
  onSubmit: (data: CreateCardData) => Promise<void>;
  onClose: () => void;
}

// Máscara de telefone brasileiro: (11) 91234-5678
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const PRIORITY_OPTIONS: { value: DesignCardPriority; label: string; color: string }[] = [
  { value: 'baixa',   label: 'Baixa',   color: '#9ca3af' },
  { value: 'media',   label: 'Média',   color: '#3b82f6' },
  { value: 'alta',    label: 'Alta',    color: '#f97316' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
];

export default function NewCardModal({
  columns,
  defaultColumnId,
  requestedBy,
  requestedByName,
  onSubmit,
  onClose,
}: NewCardModalProps) {
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId ?? columns[0]?.id ?? '');
  const [priority, setPriority] = useState<DesignCardPriority>('media');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (defaultColumnId) setColumnId(defaultColumnId);
  }, [defaultColumnId]);

  useEffect(() => {
    if (visible) setTimeout(() => titleRef.current?.focus(), 150);
  }, [visible]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !clienteNome.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit({
      column_id: columnId,
      title: title.trim(),
      cliente_nome: clienteNome.trim(),
      cliente_telefone: clienteTelefone || undefined,
      requested_by: requestedBy,
      requested_by_name: requestedByName,
      priority,
      due_date: dueDate || null,
      description: description.trim() || undefined,
    });
    setSubmitting(false);
    handleClose();
  }

  const selectedPriorityColor = PRIORITY_OPTIONS.find((p) => p.value === priority)?.color ?? '#3b82f6';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${visible ? 0.45 : 0})`,
        transition: 'background 0.2s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: '520px',
          maxHeight: '90vh',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#3D4465' }}
            >
              <Plus className="w-4 h-4 text-white" />
            </div>
            <h2
              className="font-bold text-gray-800"
              style={{ fontSize: '16px', fontFamily: "'Outfit', sans-serif" }}
            >
              Nova Solicitação
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Título do pedido <span className="text-red-400">*</span>
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Arte para banner da campanha de verão"
              required
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
              style={{ borderColor: '#e2e8f0' }}
              onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Nome do cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Nome do cliente <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              placeholder="Nome completo do cliente"
              required
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
              style={{ borderColor: '#e2e8f0' }}
              onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Telefone do cliente
            </label>
            <input
              type="tel"
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(applyPhoneMask(e.target.value))}
              placeholder="(11) 91234-5678"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
              style={{ borderColor: '#e2e8f0' }}
              onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Etapa + Prioridade em 2 colunas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Etapa inicial
              </label>
              <div className="relative">
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white pr-8"
                  style={{ borderColor: '#e2e8f0', fontSize: '13px' }}
                  onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
                  onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" style={{ fontSize: '10px' }}>▼</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Prioridade
              </label>
              <div className="relative">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as DesignCardPriority)}
                  className="w-full appearance-none px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors bg-white pr-8 font-medium"
                  style={{ borderColor: '#e2e8f0', fontSize: '13px', color: selectedPriorityColor }}
                  onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
                  onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value} style={{ color: p.color }}>{p.label}</option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" style={{ fontSize: '10px' }}>▼</span>
              </div>
            </div>
          </div>

          {/* Data de entrega */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Data de entrega
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors"
              style={{ borderColor: '#e2e8f0', color: '#374151' }}
              onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes sobre o pedido, referências, observações..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none leading-relaxed"
              style={{ borderColor: '#e2e8f0', fontSize: '13px' }}
              onFocus={(e) => (e.target.style.borderColor = '#3D4465')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>
        </form>

        {/* Rodapé com botões */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #e2e8f0', background: '#fafafa' }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl border text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#e2e8f0' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !clienteNome.trim() || submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#3D4465' }}
          >
            {submitting ? 'Criando...' : 'Criar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  );
}
