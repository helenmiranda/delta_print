import { useState } from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DeleteQuoteModalProps {
  quoteId: number;
  quoteCode: string;
  quoteStatus: string;
  onClose: () => void;
  onDeleted: () => void;
  onToast: (msg: string) => void;
}

export default function DeleteQuoteModal({
  quoteId,
  quoteCode,
  quoteStatus,
  onClose,
  onDeleted,
  onToast,
}: DeleteQuoteModalProps) {
  const [motivo, setMotivo] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const isOsGerada = quoteStatus === 'OS_GERADA';
  const motivoValid = motivo.trim().length >= 10;
  const confirmValid = confirmText === 'EXCLUIR';
  const canSubmit = !isOsGerada && motivoValid && confirmValid;

  async function handleDelete() {
    if (!canSubmit) return;
    setLoading(true);
    const { error } = await supabase
      .from('quotes')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: motivo.trim(),
      })
      .eq('id', quoteId);

    if (error) {
      onToast('Erro ao excluir orçamento. Tente novamente.');
      setLoading(false);
      return;
    }

    onToast('Orçamento excluído.');
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Excluir orçamento</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{quoteCode}</span> será marcado como excluído e removido da listagem.
            </p>
          </div>
        </div>

        {isOsGerada ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-5">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Orçamentos com OS gerada não podem ser excluídos.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Motivo da exclusão <span className="text-red-500">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da exclusão..."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all resize-none"
              />
              {motivo.trim().length > 0 && !motivoValid && (
                <p className="text-xs text-red-500 mt-1">Mínimo de 10 caracteres.</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Digite <span className="font-semibold text-gray-900">EXCLUIR</span> para confirmar{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-all"
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleDelete(); }}
              />
              {confirmText.length > 0 && !confirmValid && (
                <p className="text-xs text-red-500 mt-1">Digite exatamente EXCLUIR (maiúsculas).</p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          {!isOsGerada && (
            <button
              onClick={handleDelete}
              disabled={!canSubmit || loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {loading ? 'Excluindo...' : 'Excluir definitivamente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
