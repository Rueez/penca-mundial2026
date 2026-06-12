import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirmación',
  message
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 text-amber-400 mb-4">
          <AlertTriangle className="h-6 w-6" />
          <h3 className="text-xl font-bold tracking-tight text-slate-100">{title}</h3>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            type="button"
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-lg shadow-amber-400/20"
          >
            Confirmar y Enviar
          </button>
        </div>
      </div>
    </div>
  );
};
export default ConfirmDialog;
