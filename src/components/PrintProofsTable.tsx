import { useEffect, useState } from 'react';
import { Printer, Loader2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from './StatusBadge';
import PrintProofDrawer from './PrintProofDrawer';

interface PrintProofRow {
  id: string;
  nome_prova: string;
  tipo_impressao: string;
  status_prova: string;
  arquivo_prova_url: string;
  arquivo_prova_nome_original: string | null;
  created_at: string;
  order: {
    id: number;
    codigo_os: string;
    quote: {
      id: number;
      cliente_nome: string;
    } | null;
  } | null;
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

function getStatusRowClasses(status: string, isSelected: boolean): string {
  const baseClasses = 'border-b border-gray-50 last:border-0 cursor-pointer transition-colors';

  if (isSelected) {
    return `${baseClasses} bg-primary-50/60`;
  }

  switch (status) {
    case 'SOLICITADA':
      return `${baseClasses} border-l-4 border-l-orange-500 hover:bg-white/50`;
    case 'FEITO':
      return `${baseClasses} border-l-4 border-l-green-500 hover:bg-white/50`;
    default:
      return `${baseClasses} hover:bg-white/50`;
  }
}

interface PrintProofsTableProps {
  filterPeriodo: string;
  refreshTrigger?: number;
}

export default function PrintProofsTable({ filterPeriodo, refreshTrigger }: PrintProofsTableProps) {
  const [proofs, setProofs] = useState<PrintProofRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);

  function getDateFilter(periodo: string): string | null {
    if (periodo === 'todos') return null;

    const now = new Date();
    let dateLimit: Date;

    switch (periodo) {
      case '7dias':
        dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30dias':
        dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90dias':
        dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'mes_atual':
      case 'este_mes':
        dateLimit = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return null;
    }

    return dateLimit.toISOString();
  }

  async function loadProofs() {
    setLoading(true);
    const dateFilter = getDateFilter(filterPeriodo);

    let query = supabase
      .from('print_proofs')
      .select(`
        id,
        nome_prova,
        tipo_impressao,
        status_prova,
        arquivo_prova_url,
        arquivo_prova_nome_original,
        created_at,
        order:orders (
          id,
          codigo_os,
          quote:quotes (
            id,
            cliente_nome
          )
        )
      `);

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setProofs(data as PrintProofRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProofs();
  }, [filterPeriodo, refreshTrigger]);

  return (
    <>
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : proofs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-glass bg-primary-50 flex items-center justify-center mb-4">
              <Printer className="w-7 h-7 text-primary-400" />
            </div>
            <p className="text-gray-600 font-medium">Nenhuma prova encontrada</p>
            <p className="text-body mt-1">
              {filterPeriodo !== 'todos'
                ? 'Tente ajustar o filtro de período para ver mais resultados'
                : 'As provas de impressão solicitadas aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Nome da prova
                  </th>
                  <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Arquivo
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    OS
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Cliente
                  </th>
                  <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Tipo
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="col-iframe-hide text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {proofs.map((proof) => (
                  <tr
                    key={proof.id}
                    onClick={() => setSelectedProofId(proof.id)}
                    className={getStatusRowClasses(proof.status_prova, selectedProofId === proof.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Printer className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900">{proof.nome_prova}</span>
                      </div>
                    </td>
                    <td className="col-iframe-hide px-6 py-4">
                      <a
                        href={proof.arquivo_prova_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline max-w-xs truncate"
                        title={proof.arquivo_prova_nome_original || 'Baixar arquivo'}
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">
                          {proof.arquivo_prova_nome_original || proof.arquivo_prova_url.split('/').pop()}
                        </span>
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-primary-600 font-medium">
                        {proof.order?.codigo_os || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">
                        {proof.order?.quote?.cliente_nome || '—'}
                      </span>
                    </td>
                    <td className="col-iframe-hide px-6 py-4">
                      <span className="text-sm text-gray-700">{proof.tipo_impressao}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={proof.status_prova} />
                    </td>
                    <td className="col-iframe-hide px-6 py-4">
                      <span className="text-sm text-gray-500">{formatDateTime(proof.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedProofId && (
        <PrintProofDrawer
          proofId={selectedProofId}
          onClose={() => setSelectedProofId(null)}
          onUpdated={loadProofs}
        />
      )}
    </>
  );
}
