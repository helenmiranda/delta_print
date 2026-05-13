import { useState } from 'react';
import { XCircle, X, Loader2 } from 'lucide-react';

interface RejectQuoteModalProps {
  onCancel: () => void;
  onConfirm: (justificativa: string) => Promise<void>;
}

export default function RejectQuoteModal({ onCancel, onConfirm }: RejectQuoteModalProps) {
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = justificativa.trim().length >= 10;

  async function handleConfirm() {
    if (!isValid) return;
    setLoading(true);
    await onConfirm(justificativa.trim());
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onCancel} />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Recusar orcamento</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            Informe o motivo da recusa para registrar e solicitar os ajustes necessarios ao vendedor.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Justificativa <span className="text-red-500">*</span>
            </label>
            <textarea
              autoFocus
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              placeholder="Descreva o motivo da recusa (minimo 10 caracteres)..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none transition-all"
            />
            <p className={`text-xs mt-1 ${justificativa.trim().length > 0 && !isValid ? 'text-red-400' : 'text-gray-400'}`}>
              {justificativa.trim().length}/10 caracteres minimos
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {loading ? 'Confirmando...' : 'Confirmar recusa'}
          </button>
        </div>
      </div>
    </div>
  );
}
