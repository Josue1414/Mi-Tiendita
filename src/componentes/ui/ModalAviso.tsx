// src/componentes/ui/ModalAviso.tsx
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X, Lock, Frown, CalendarClock } from "lucide-react";
import { cn } from "../../utilidades/utils";

interface PropsModalAviso {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  tipo?: "info" | "advertencia" | "exito" | "bloqueo" | "recordatorio";
  alCerrar: () => void;
}

const iconos = {
  info: Info,
  advertencia: AlertTriangle,
  exito: CheckCircle2,
  bloqueo: Lock,
  recordatorio: CalendarClock
};

const colores = {
  info: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
  advertencia: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  exito: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  bloqueo: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  recordatorio: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
};

export default function ModalAviso({ abierto, titulo, mensaje, tipo = "info", alCerrar }: PropsModalAviso) {
  useEffect(() => {
    if (!abierto) return;
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Enter") alCerrar();
    };
    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [abierto, alCerrar]);

  if (!abierto) return null;
  
  const esBloqueo = tipo === "bloqueo";
  const esRecordatorio = tipo === "recordatorio";
  const esGrande = esBloqueo || esRecordatorio;
  const Icono = iconos[tipo];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md" onClick={alCerrar}>
      <div 
        className={cn(
          "w-full rounded-3xl bg-white shadow-2xl dark:bg-slate-900 flex flex-col border",
          esGrande ? "max-w-lg p-8 sm:p-10 items-center text-center" : "max-w-sm border-slate-200 dark:border-white/10 p-5",
          esBloqueo ? "border-amber-500/30 dark:border-amber-500/20" : "",
          esRecordatorio ? "border-blue-500/30 dark:border-blue-500/20" : ""
        )} 
        onClick={(evento) => evento.stopPropagation()} 
        role="alertdialog" 
        aria-modal="true"
      >
        {esGrande ? (
          <>
            {esBloqueo && (
              <div className="mb-6 relative flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 w-24 h-24 rounded-full border-4 border-amber-100 dark:border-amber-800/30 shadow-inner">
                <Lock size={40} className="text-amber-500" />
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full border-2 border-white dark:border-slate-900 p-1.5 shadow-sm">
                  <Frown size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            )}
            {esRecordatorio && (
              <div className="mb-6 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 w-24 h-24 rounded-full border-4 border-blue-100 dark:border-blue-800/30 shadow-inner">
                <CalendarClock size={40} className="text-blue-500" />
              </div>
            )}
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">{titulo}</h2>
            
            {/* Se agrega whitespace-pre-line para respetar los saltos de línea del mensaje */}
            <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400 mb-8 px-2 whitespace-pre-line">{mensaje}</p>
            
            <button onClick={alCerrar} className={cn(
              "w-full sm:w-auto min-w-[200px] rounded-2xl py-3.5 text-lg font-bold text-white shadow-lg hover:scale-105 transition-all",
              esBloqueo ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30" : "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30"
            )}>
              Entendido
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colores[tipo]}`}>
                <Icono size={21} />
              </div>
              <button onClick={alCerrar} aria-label="Cerrar aviso" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={18} />
              </button>
            </div>
            <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{mensaje}</p>
            <button onClick={alCerrar} className="mt-5 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm transition-colors">
              Entendido
            </button>
          </>
        )}
      </div>
    </div>
  );
}