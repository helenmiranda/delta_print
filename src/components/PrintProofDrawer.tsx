import { useEffect, useState } from 'react';
import { X, FileText, Loader2, Download, Package, User, Calendar, Printer, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from './StatusBadge';
import Toast from './Toast';

interface PrintProofDetail {
  id: string;
  nome_prova: string;
  tipo_impressao: string;
  cores: string;
  lados: string;
  ajuste: string;
  formato: string;
  papel_tipo: string;
  papel_gramatura: string | null;
  papel_outros: string | null;
  arquivo_prova_url: string;
  arquivo_prova_nome_original: string | null;
  observacoes: string | null;
  status_prova: string;
  created_at: string;
  updated_at: string;
  order: {
    id: number;
    codigo_os: string;
    quote: {
      id: number;
      cliente_nome: string;
      cliente_telefone: string | null;
      codigo_orcamento: string | null;
    } | null;
  } | null;
}

interface PrintProofDrawerProps {
  proofId: string;
  onClose: () => void;
  onUpdated: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2.5 border-b border-gray-100/80 last:border-0">
      <p className="text-[11px] text-gray-400 uppercase tracking-wide leading-none mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

export default function PrintProofDrawer({ proofId, onClose, onUpdated }: PrintProofDrawerProps) {
  const [proof, setProof] = useState<PrintProofDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('print_proofs')
        .select(`
          id,
          nome_prova,
          tipo_impressao,
          cores,
          lados,
          ajuste,
          formato,
          papel_tipo,
          papel_gramatura,
          papel_outros,
          arquivo_prova_url,
          arquivo_prova_nome_original,
          observacoes,
          status_prova,
          created_at,
          updated_at,
          order:orders (
            id,
            codigo_os,
            quote:quotes (
              id,
              cliente_nome,
              cliente_telefone,
              codigo_orcamento
            )
          )
        `)
        .eq('id', proofId)
        .maybeSingle();

      if (!error && data) {
        setProof(data as PrintProofDetail);
      }
      setLoading(false);
    }
    load();
    requestAnimationFrame(() => setOpen(true));
  }, [proofId]);

  function handleClose() {
    setOpen(false);
    setTimeout(onClose, 300);
  }

  async function handleMarkAsDone() {
    if (!proof) return;
    setUpdating(true);

    const { error } = await supabase
      .from('print_proofs')
      .update({
        status_prova: 'FEITO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', proof.id);

    if (!error) {
      setProof({ ...proof, status_prova: 'FEITO' });
      setToast('Prova pronta para retirada');
      onUpdated();
    }

    setUpdating(false);
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[42%] sm:min-w-[380px] sm:max-w-[560px] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col" style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '-8px 0 40px rgba(0, 0, 0, 0.08)',
        }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : !proof ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <p className="text-gray-500">Registro nao encontrado.</p>
              <button onClick={handleClose} className="btn-ghost mt-4 text-sm">Fechar</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/80">
                <div className="flex items-center gap-3 min-w-0">
                  <Printer className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  <h2 className="text-lg font-semibold text-gray-800 truncate">
                    {proof.nome_prova}
                  </h2>
                  <StatusBadge status={proof.status_prova} />
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Informacoes da OS</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm">
                    <InfoRow label="Codigo OS" value={proof.order?.codigo_os || null} />
                    <InfoRow label="Cliente" value={proof.order?.quote?.cliente_nome || null} />
                    <InfoRow label="Telefone" value={proof.order?.quote?.cliente_telefone || null} />
                    <InfoRow label="Codigo Orcamento" value={proof.order?.quote?.codigo_orcamento || null} />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Especificacoes da prova</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm">
                    <InfoRow label="Nome da prova" value={proof.nome_prova} />
                    <InfoRow label="Tipo de impressao" value={proof.tipo_impressao} />
                    <InfoRow label="Cores" value={proof.cores === 'PB' ? 'P&B' : proof.cores} />
                    <InfoRow label="Lados" value={proof.lados.replace('_', ' ')} />
                    <InfoRow label="Ajuste" value={proof.ajuste.replace('_', ' ')} />
                    <InfoRow label="Formato" value={proof.formato.replace('_', ' ')} />
                    <InfoRow label="Tipo de papel" value={proof.papel_tipo} />
                    {proof.papel_gramatura && (
                      <InfoRow label="Gramatura" value={proof.papel_gramatura} />
                    )}
                    {proof.papel_outros && (
                      <InfoRow label="Especificacao do papel" value={proof.papel_outros} />
                    )}
                  </div>
                </section>

                {proof.observacoes && (
                  <section>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observacoes</h3>
                    <div className="glass-card-static p-4 rounded-glass-sm">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{proof.observacoes}</p>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Arquivo da prova</h3>
                  <div className="glass-card-static p-4 rounded-glass-sm">
                    {proof.arquivo_prova_nome_original && (
                      <p className="text-sm text-gray-700 mb-3 truncate" title={proof.arquivo_prova_nome_original}>
                        {proof.arquivo_prova_nome_original}
                      </p>
                    )}
                    <a
                      href={proof.arquivo_prova_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-sm w-full"
                    >
                      <Download className="w-4 h-4" />
                      Baixar arquivo
                    </a>
                  </div>
                </section>

                {proof.status_prova === 'SOLICITADA' && (
                  <section>
                    <button
                      onClick={handleMarkAsDone}
                      disabled={updating}
                      className="btn-primary w-full text-base font-semibold py-3"
                    >
                      {updating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Feito
                        </>
                      )}
                    </button>
                  </section>
                )}

                <div className="text-xs text-gray-400 pt-2 pb-4">
                  Solicitado em {formatDateTime(proof.created_at)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
