import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

const CATEGORIAS = [
  { value: 'bug', label: 'Bug / Erro' },
  { value: 'melhoria', label: 'Melhoria' },
  { value: 'duvida', label: 'Dúvida' },
  { value: 'outro', label: 'Outro' },
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewTicketModal({ onClose, onCreated }: Props) {
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    categoria: 'bug',
    prioridade: 'media',
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.descricao.trim()) return;

    setSaving(true);
    const { error } = await supabase.from('tickets').insert({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      prioridade: form.prioridade,
      status: 'aberto',
      reportado_por_nome: user.name,
      reportado_por_email: user.email,
    });

    setSaving(false);
    if (!error) {
      onCreated();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card-static w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Abrir Ticket</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
            <input
              className="input-field w-full"
              placeholder="Descreva o problema em poucas palavras"
              value={form.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
              <select
                className="input-field w-full"
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
              <select
                className="input-field w-full"
                value={form.prioridade}
                onChange={(e) => set('prioridade', e.target.value)}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
            <textarea
              className="input-field-textarea w-full"
              rows={5}
              placeholder="Descreva o erro com o máximo de detalhes possível: o que aconteceu, onde, como reproduzir..."
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Abrir Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
