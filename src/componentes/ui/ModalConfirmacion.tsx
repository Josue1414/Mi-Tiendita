import { AlertTriangle, X } from "lucide-react";

interface PropsModalConfirmacion {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  textoBoton?: string;
  alConfirmar: () => void;
  alCerrar: () => void;
}

export default function ModalConfirmacion({ abierto, titulo, mensaje, textoBoton = "Eliminar", alConfirmar, alCerrar }: PropsModalConfirmacion) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in" onClick={alCerrar}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
            <AlertTriangle size={24} />
          </div>
          <button onClick={alCerrar} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{titulo}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{mensaje}</p>
        
        <div className="flex gap-3">
          <button onClick={alCerrar} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={() => { alConfirmar(); alCerrar(); }} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
            {textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}