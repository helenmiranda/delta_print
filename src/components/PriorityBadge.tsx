interface PriorityBadgeProps {
  priority: string;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    BAIXA: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Baixa' },
    MEDIA: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Média' },
    ALTA: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta' },
    URGENTE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' },
  };

  const style = styles[priority] || styles.MEDIA;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${style.bg} ${style.text}`}
      style={{ fontSize: '11px', padding: '2px 8px', lineHeight: '1.4' }}
    >
      {style.label}
    </span>
  );
}
