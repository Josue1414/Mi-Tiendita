import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

interface PropsModalAviso {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  tipo?: "info" | "advertencia" | "exito";
  alCerrar: () => void;
}

const iconos = {
  info: Info,
  advertencia: AlertTriangle,
  exito: CheckCircle2,
};

const colores = {
  info: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300",
  advertencia: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
  exito: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function ModalAviso({ abierto, titulo, mensaje, tipo = "info", alCerrar }: PropsModalAviso) {
  if (!abierto) return null;
  const Icono = iconos[tipo];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={alCerrar}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colores[tipo]}`}><Icono size={21} /></div>
          <button onClick={alCerrar} aria-label="Cerrar aviso" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{mensaje}</p>
        <button onClick={alCerrar} className="mt-5 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Entendido</button>
      </div>
    </div>
  );
}
