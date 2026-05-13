import { useState } from 'react';
import { X, ExternalLink, Download, FileText, Image, Loader2 } from 'lucide-react';
import PdfViewer from './PdfViewer';
import SvgViewer from './SvgViewer';
import { resolveArteUrl } from '../lib/utils';

interface FileViewerModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

function getFileType(url: string): 'image' | 'pdf' | 'svg' | 'other' {
  const lower = url.toLowerCase();
  const path = lower.split('?')[0];
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.svg')) return 'svg';
  if (/\.(jpe?g|png|gif|webp)$/.test(path)) return 'image';
  if (lower.includes('content-type=image%2Fsvg') || lower.includes('content-type=image/svg')) return 'svg';
  if (lower.includes('.svg?') || lower.includes('/svg/') || lower.includes('%2Fsvg')) return 'svg';
  return 'other';
}

function getFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    return decodeURIComponent(parts[parts.length - 1]) || 'arquivo';
  } catch {
    return 'arquivo';
  }
}

async function downloadBlob(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('download failed');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export default function FileViewerModal({ url, title, onClose }: FileViewerModalProps) {
  const safeUrl = resolveArteUrl(url) ?? url;
  const fileType = getFileType(safeUrl);
  const fileName = getFileName(safeUrl);
  const [pdfError, setPdfError] = useState(false);
  const [svgError, setSvgError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadBlob(safeUrl, fileName);
    } catch {
      window.open(safeUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  }

  const isImage = fileType === 'image';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: (isImage || fileType === 'svg') ? 'auto' : 'min(960px, calc(100vw - 48px))',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {(isImage || fileType === 'svg') ? (
              <Image className="w-4 h-4 text-primary-500 flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-primary-500 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5 font-medium">{title}</p>
              <p className="text-sm font-medium text-gray-800 truncate max-w-[320px]">{fileName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir em nova aba
            </a>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {downloading ? 'Baixando...' : 'Baixar'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 min-h-0" style={{ height: 'calc(100vh - 160px)', minHeight: '500px' }}>
          {isImage && (
            <div className="p-6 flex items-center justify-center">
              <img
                src={safeUrl}
                alt={title}
                className="object-contain rounded-lg"
                style={{
                  maxWidth: 'min(880px, calc(100vw - 96px))',
                  maxHeight: 'calc(100vh - 180px)',
                }}
              />
            </div>
          )}

          {fileType === 'svg' && !svgError && (
            <SvgViewer url={safeUrl} title={title} onError={() => setSvgError(true)} />
          )}

          {fileType === 'svg' && svgError && (
            <div className="p-6 flex items-center justify-center w-full h-full overflow-auto">
              <img
                src={safeUrl}
                alt={title}
                className="max-w-full max-h-full object-contain"
                style={{ maxWidth: 'min(880px, calc(100vw - 96px))', maxHeight: 'calc(100vh - 180px)' }}
              />
            </div>
          )}

          {fileType === 'pdf' && !pdfError && (
            <PdfViewer url={safeUrl} onError={() => setPdfError(true)} />
          )}

          {fileType === 'pdf' && pdfError && (
            <iframe
              src={safeUrl}
              title={title}
              className="w-full border-0"
              style={{ height: 'calc(100vh - 160px)', minHeight: '500px' }}
            />
          )}

          {fileType === 'other' && (
            <div className="p-10 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Previa nao disponivel</p>
              <p className="text-xs text-gray-500 mb-4">Este tipo de arquivo nao pode ser visualizado diretamente.</p>
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir arquivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
