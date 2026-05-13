import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfViewerProps {
  url: string;
  onError?: () => void;
}

export default function PdfViewer({ url, onError }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<ReturnType<ReturnType<typeof pdfjsLib.getDocument>['promise']['then']> | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scale] = useState(1.5);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Failed to fetch PDF');
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch {
        if (!cancelled) {
          setError(true);
          onError?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;
      if (!canvas || !pdfDoc) return;

      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderContext = { canvasContext: ctx, viewport };
      const task = page.render(renderContext);
      renderTaskRef.current = task as unknown as null;
      try {
        await task.promise;
      } catch (err: unknown) {
        if (err instanceof Error && err.message !== 'Rendering cancelled') {
          if (!cancelled) setError(true);
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-sm text-gray-500">Carregando PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <iframe
        src={url}
        title="PDF"
        className="w-full h-full border-0"
        style={{ minHeight: '500px' }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center w-full h-full overflow-auto py-4 gap-4">
      <div className="w-full flex justify-center overflow-auto px-4">
        <canvas
          ref={canvasRef}
          className="shadow-lg rounded-lg max-w-full"
          style={{ display: 'block' }}
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm flex-shrink-0">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-600 font-medium tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
