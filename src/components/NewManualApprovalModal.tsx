import { useState } from 'react';
import { X, Loader2, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SetorType } from '../pages/QuotesPage';

interface Props {
  setor: SetorType;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewManualApprovalModal({ setor, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    vendedor_nome: '',
    prioridade: 'MEDIA',
    descricao_pedido: '',
    observacoes: '',
    aprovado_descricao: '',
    aprovado_valor_total: '',
    prazo_pagamento: '',
    forma_pagamento: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const valor = parseFloat(form.aprovado_valor_total.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor aprovado válido.');
      return;
    }

    setLoading(true);

    const agora = new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from('quotes')
      .insert({
        cliente_nome: form.cliente_nome,
        cliente_telefone: form.cliente_telefone || null,
        vendedor_nome: form.vendedor_nome,
        prioridade: form.prioridade,
        descricao_pedido: form.descricao_pedido,
        observacoes: form.observacoes || null,
        aprovado_descricao: form.aprovado_descricao,
        aprovado_valor_total: valor,
        aprovado_em: agora,
        status: 'APROVADO_CLIENTE',
        setor,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      alert('Erro ao registrar aprovação: ' + (error?.message ?? 'erro desconhecido'));
      setLoading(false);
      return;
    }

    if (form.prazo_pagamento || form.forma_pagamento) {
      await supabase.from('quote_payments').insert({
        quote_id: inserted.id,
        prazo_pagamento: form.prazo_pagamento || null,
        forma_pagamento: form.forma_pagamento || null,
      });
    }

    setLoading(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="glass-card-static relative w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="section-title text-base leading-tight">Aprovação manual</h2>
              <p className="text-[11px] text-gray-400 leading-tight">Registro direto sem PDF de orçamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Cliente
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  name="cliente_nome"
                  value={form.cliente_nome}
                  onChange={handleChange}
                  required
                  className="input-field w-full"
                  placeholder="Nome completo do cliente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  name="cliente_telefone"
                  value={form.cliente_telefone}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          {/* Vendedor e Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendedor <span className="text-red-500">*</span>
              </label>
              <input
                name="vendedor_nome"
                value={form.vendedor_nome}
                onChange={handleChange}
                required
                className="input-field w-full"
                placeholder="Nome do vendedor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                name="prioridade"
                value={form.prioridade}
                onChange={handleChange}
                className="input-field w-full"
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
          </div>

          {/* Pedido */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição do pedido <span className="text-red-500">*</span>
            </label>
            <textarea
              name="descricao_pedido"
              value={form.descricao_pedido}
              onChange={handleChange}
              required
              rows={2}
              className="input-field-textarea w-full resize-none"
              placeholder="O que o cliente pediu..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              name="observacoes"
              value={form.observacoes}
              onChange={handleChange}
              rows={2}
              className="input-field-textarea w-full resize-none"
              placeholder="Informações adicionais..."
            />
          </div>

          {/* Aprovação */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Aprovação
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  O que foi aprovado <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="aprovado_descricao"
                  value={form.aprovado_descricao}
                  onChange={handleChange}
                  required
                  rows={2}
                  className="input-field-textarea w-full resize-none"
                  placeholder="Descreva os itens e serviços aprovados pelo cliente..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor aprovado (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  name="aprovado_valor_total"
                  value={form.aprovado_valor_total}
                  onChange={handleChange}
                  required
                  className="input-field w-full"
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Pagamento <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                <input
                  name="prazo_pagamento"
                  value={form.prazo_pagamento}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="Ex: 30/60/90 dias"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Forma</label>
                <input
                  name="forma_pagamento"
                  value={form.forma_pagamento}
                  onChange={handleChange}
                  className="input-field w-full"
                  placeholder="Ex: PIX, boleto"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
              {loading ? 'Salvando...' : 'Registrar aprovação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
