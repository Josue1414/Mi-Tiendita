import { useState } from "react";
import { Camera, Check, X } from "lucide-react";
import type { ChangeEvent } from "react";

interface PropsModalAutorizacion {
  abierto: boolean;
  mensaje: string;
  permiteFoto: boolean;
  alCerrar: () => void;
  alConfirmar: (evidencia?: string) => void;
}

export default function ModalAutorizacion({ abierto, mensaje, permiteFoto, alCerrar, alConfirmar }: PropsModalAutorizacion) {
  const [evidencia, setEvidencia] = useState<string>();

  if (!abierto) return null;

  const seleccionarEvidencia = (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setEvidencia(lector.result as string);
    lector.readAsDataURL(archivo);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={alCerrar}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Autorización requerida</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{mensaje || "Este producto requiere autorización para venderse."}</p>
          </div>
          <button onClick={alCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        {permiteFoto && (
          <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            {evidencia ? <img src={evidencia} alt="Evidencia seleccionada" className="h-24 w-full rounded-lg object-cover" /> : <Camera size={24} />}
            <span>{evidencia ? "Cambiar evidencia" : "Tomar o adjuntar foto"}</span>
            <input type="file" accept="image/*" capture="environment" onChange={seleccionarEvidencia} className="hidden" />
          </label>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={alCerrar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">Cancelar</button>
          <button onClick={() => alConfirmar(evidencia)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Check size={16} /> Autorizar venta</button>
        </div>
      </div>
    </div>
  );
}
