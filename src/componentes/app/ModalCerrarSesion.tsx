import { LogOut } from "lucide-react";

interface PropsModalCerrarSesion {
  abierto: boolean;
  alCancelar: () => void;
  alConfirmar: () => void;
}

export default function ModalCerrarSesion({ abierto, alCancelar, alConfirmar }: PropsModalCerrarSesion) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-4">
          <LogOut size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">¿Quieres cerrar sesión?</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Tendrás que ingresar tu PIN nuevamente para acceder al sistema.
        </p>
        <div className="flex w-full gap-3">
          <button onClick={alCancelar} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={alConfirmar} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
            Sí, salir
          </button>
        </div>
      </div>
    </div>
  );
}
