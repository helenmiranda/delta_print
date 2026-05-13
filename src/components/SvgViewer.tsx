import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface SvgViewerProps {
  url: string;
  title: string;
  onError: () => void;
}

export default function SvgViewer({ url, title, onError }: SvgViewerProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSvgContent(null);
    setUseFallback(false);

    fetch(url, { mode: 'cors' })
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch failed');
        const text = await res.text();
        if (cancelled) return;
        if (!text.trim().includes('<svg') && !text.trim().includes('<?xml')) {
          throw new Error('not svg');
        }
        setSvgContent(text);
      })
      .catch(() => {
        if (!cancelled) setUseFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (useFallback) {
    return (
      <div
        className="p-6 flex items-center justify-center w-full h-full overflow-auto"
        style={{ maxWidth: 'min(880px, calc(100vw - 96px))', maxHeight: 'calc(100vh - 180px)' }}
      >
        <img
          src={url}
          alt={title}
          className="max-w-full max-h-full object-contain"
          onError={onError}
        />
      </div>
    );
  }

  if (!svgContent) {
    return null;
  }

  return (
    <div
      className="p-6 flex items-center justify-center w-full h-full overflow-auto"
      style={{ maxWidth: 'min(880px, calc(100vw - 96px))', maxHeight: 'calc(100vh - 180px)' }}
    >
      <div
        aria-label={title}
        className="max-w-full max-h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
