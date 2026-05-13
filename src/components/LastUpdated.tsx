import { useEffect, useState } from 'react';

interface LastUpdatedProps {
  timestamp: Date | null;
}

export default function LastUpdated({ timestamp }: LastUpdatedProps) {
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    if (!timestamp) return;

    function compute() {
      if (!timestamp) return;
      const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
      if (seconds < 5) {
        setLabel('Atualizado agora');
      } else if (seconds < 60) {
        setLabel(`Atualizado há ${seconds}s`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setLabel(`Atualizado há ${minutes}min`);
      }
    }

    compute();
    const interval = setInterval(compute, 5000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (!label) return null;

  return (
    <span className="text-xs text-gray-400 font-normal tabular-nums">
      {label}
    </span>
  );
}
