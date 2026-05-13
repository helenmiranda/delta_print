const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDENTE_ORCAMENTO: {
    label: 'Pendente',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  PRONTO_PARA_ENVIAR: {
    label: 'Pronto p/ envio',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  ORCAMENTO_ENVIADO: {
    label: 'Enviado',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  APROVADO_CLIENTE: {
    label: 'Aprovado',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  NAO_APROVADO: {
    label: 'Recusado',
    className: 'bg-red-50 text-red-600 border-red-200',
  },
  OS_GERADA: {
    label: 'OS Gerada',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  AJUSTE_SOLICITADO: {
    label: 'Ajuste solicitado',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  AJUSTE_NECESSARIO: {
    label: 'Ajuste necessario',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  PRONTO_ENVIAR_CLIENTE: {
    label: 'Pronto p/ cliente',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  ORCAMENTO_PENDENTE: {
    label: 'Pendente',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${config.className}`}
      style={{ fontSize: '11px', padding: '2px 8px', lineHeight: '1.4' }}
    >
      {config.label}
    </span>
  );
}
