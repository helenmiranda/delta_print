import { useState } from 'react';
import { X, Loader2, Upload, FileImage } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileToR2, R2UploadError } from '../lib/r2Upload';
import { validateUploadFile, ACCEPT_ATTR } from '../lib/uploadValidation';
import type { PrintJob } from './PrintJobDrawer';

interface NewPrintJobModalProps {
  onClose: () => void;
  onCreated: (job: PrintJob) => void;
}

export default function NewPrintJobModal({ onClose, onCreated }: NewPrintJobModalProps) {
  const [osCode, setOsCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [status, setStatus] = useState('SOLICITADO');
  const [notes, setNotes] = useState('');
  const [artFile, setArtFile] = useState<File | null>(null);
  const [uploadingArt, setUploadingArt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) { setError('Nome do cliente e obrigatorio'); return; }

    setSaving(true);
    setError(null);

    let finalArtUrl: string | null = null;

    if (artFile) {
      setUploadingArt(true);
      try {
        const { publicUrl } = await uploadFileToR2({
          folder: 'impressao',
          quoteId: null,
          tipo: 'ARTE_FINAL',
          file: artFile,
        });
        finalArtUrl = publicUrl;
      } catch (err) {
        const msg = err instanceof R2UploadError ? err.message : 'Erro ao enviar arquivo de arte';
        setError(msg);
        setSaving(false);
        setUploadingArt(false);
        return;
      }
      setUploadingArt(false);
    }

    let osId: number | null = null;
    let builtNotes: string | null = notes.trim() || null;

    if (osCode.trim()) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, quote_id, observacoes_pre_impressao')
        .eq('codigo_os', osCode.trim())
        .maybeSingle();

      if (orderData) {
        osId = orderData.id;

        const [quoteResult, paymentResult] = await Promise.all([
          supabase
            .from('quotes')
            .select('descricao_pedido, observacoes, aprovado_descricao')
            .eq('id', orderData.quote_id)
            .maybeSingle(),
          supabase
            .from('quote_payments')
            .select('observacoes_financeiro')
            .eq('quote_id', orderData.quote_id)
            .maybeSingle(),
        ]);

        const q = quoteResult.data;
        const p = paymentResult.data;
        const o = orderData as any;

        const lines = [
          `DESCRIÇÃO DO PEDIDO: ${q?.descricao_pedido || '-'}`,
          `OBS ORÇAMENTO: ${q?.observacoes || '-'}`,
          `OBS FINANCEIRO: ${(p as any)?.observacoes_financeiro || '-'}`,
          `OBS PRÉ-IMPRESSÃO: ${o?.observacoes_pre_impressao || '-'}`,
          `ITENS APROVADOS: ${q?.aprovado_descricao || '-'}`,
        ];

        const extra = notes.trim();
        if (extra) lines.push(`\nOBS IMPRESSÃO: ${extra}`);

        builtNotes = lines.join('\n');
      }
    }

    const { data, error: insertError } = await supabase
      .from('print_jobs')
      .insert({
        setor: 'GRAFICA_EXPRESSA',
        os_id: osId,
        os_code: osCode.trim() || null,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        status,
        final_art_url: finalArtUrl,
        notes: builtNotes,
      })
      .select()
      .maybeSingle();

    if (insertError || !data) {
      setError('Erro ao criar registro de impressao');
    } else {
      onCreated(data as PrintJob);
    }

    setSaving(false);
  }

  function handleFileSelect(file: File) {
    const result = validateUploadFile(file);
    if (!result.ok) {
      setError(result.errorMessage!);
      return;
    }
    setArtFile(file);
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Solicitar nova impressao</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Numero da OS <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={osCode}
              onChange={(e) => setOsCode(e.target.value)}
              placeholder="Ex: OS-0001"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nome do cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do cliente"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Telefone <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status inicial</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="SOLICITADO">Solicitado</option>
              <option value="PRONTO">Pronto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Arte final <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            {artFile ? (
              <div className="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                {uploadingArt ? (
                  <Loader2 className="w-5 h-5 text-emerald-500 flex-shrink-0 animate-spin" />
                ) : (
                  <FileImage className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                )}
                <span className="text-sm text-emerald-700 flex-1 truncate">
                  {uploadingArt ? `Enviando ${artFile.name}...` : artFile.name}
                </span>
                {!uploadingArt && (
                  <button
                    type="button"
                    onClick={() => setArtFile(null)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                className={`border-2 border-dashed rounded-lg transition-all ${dragOver ? 'border-primary-500 bg-primary-50/50' : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50/20'}`}
              >
                <label className="flex flex-col items-center justify-center gap-2 p-4 cursor-pointer">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Arraste ou clique para selecionar</span>
                  <span className="text-xs text-gray-400">PDF, JPG, PNG, ZIP, CDR, AI, PSD... — máx. 350MB</span>
                  <input
                    type="file"
                    accept={ACCEPT_ATTR}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Observacoes <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observacoes sobre a impressao..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploadingArt}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(saving || uploadingArt) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {uploadingArt ? 'Enviando arte...' : saving ? 'Salvando...' : 'Solicitar impressao'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
