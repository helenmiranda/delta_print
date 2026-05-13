// Context global de notificações Toast — provê addToast() para qualquer componente filho
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

// Tipos de toast disponíveis
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

// Ícone correspondente ao tipo de toast
function ToastIcon({ type }: { type: ToastType }) {
  const cls = 'w-4 h-4 flex-shrink-0';
  if (type === 'success') return <CheckCircle className={cls} />;
  if (type === 'error')   return <XCircle className={cls} />;
  if (type === 'warning') return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

// Paleta de cores por tipo
const TOAST_STYLES: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: '#f0fdf4', text: '#166534', icon: '#16a34a' },
  error:   { bg: '#fef2f2', text: '#991b1b', icon: '#dc2626' },
  warning: { bg: '#fffbeb', text: '#92400e', icon: '#d97706' },
  info:    { bg: '#eff6ff', text: '#1e40af', icon: '#2563eb' },
};

// Item de toast com animação de entrada da direita e auto-dismiss
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const s = TOAST_STYLES[toast.type];
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border"
      style={{
        background: s.bg,
        color: s.text,
        borderColor: `${s.icon}33`,
        animation: 'toast-slide-in 0.3s ease-out forwards',
        minWidth: '260px',
        maxWidth: '380px',
      }}
    >
      <span style={{ color: s.icon, marginTop: '1px' }}>
        <ToastIcon type={toast.type} />
      </span>
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: s.text }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `t-${Date.now()}-${Math.random()}`;
    // Máximo de 3 toasts simultâneos — remove o mais antigo se necessário
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
    // Auto-dismiss após 3 segundos
    const timer = setTimeout(() => dismiss(id), 3000);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Animação de slide-in injetada via style inline */}
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Container fixo no canto inferior direito */}
      {toasts.length > 0 && (
        <div className="fixed z-[100] flex flex-col gap-2" style={{ bottom: '24px', right: '24px' }}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// Hook para consumir o sistema de toast em qualquer componente filho
export function useToast() {
  return useContext(ToastContext);
}
