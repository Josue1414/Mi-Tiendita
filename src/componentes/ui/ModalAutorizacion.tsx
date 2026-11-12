import { useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, Check, ImagePlus, X } from "lucide-react";
import type { ChangeEvent } from "react";

interface PropsModalAutorizacion {
  abierto: boolean;
  mensaje: string;
  alCerrar: () => void;
  alConfirmar: (evidencia?: string) => void;
}

export default function ModalAutorizacion({ abierto, mensaje, alCerrar, alConfirmar }: PropsModalAutorizacion) {
  const [evidencia, setEvidencia] = useState<string>();
  const [errorImagen, setErrorImagen] = useState("");
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const esAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  if (!abierto) return null;

  const cerrar = () => {
    setEvidencia(undefined);
    setErrorImagen("");
    alCerrar();
  };

  const seleccionarEvidencia = (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result === "string") {
        setEvidencia(lector.result);
        setErrorImagen("");
      }
    };
    lector.onerror = () => setErrorImagen("No se pudo leer la imagen. Intenta elegir otra.");
    lector.readAsDataURL(archivo);
  };

  const confirmar = () => {
    alConfirmar(evidencia);
    setEvidencia(undefined);
    setErrorImagen("");
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={cerrar}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Autorización requerida</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{mensaje || "Este producto requiere autorización para venderse."}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Verifica la receta o autorización. La foto de evidencia es opcional.</p>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>

        <input ref={inputArchivoRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarEvidencia} className="hidden" />
        {esAndroid && <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" onChange={seleccionarEvidencia} className="hidden" />}
        <input ref={inputGaleriaRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarEvidencia} className="hidden" />

        <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          {evidencia ? (
            <img src={evidencia} alt="Evidencia seleccionada" className="mb-3 h-28 w-full rounded-lg object-cover" />
          ) : (
            <p className="mb-3 text-center text-xs text-amber-800 dark:text-amber-300">Agregar foto de receta o evidencia (opcional)</p>
          )}
          <div className="flex flex-wrap gap-2">
            {esAndroid && (
              <button type="button" onClick={() => inputCamaraRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
                <Camera size={14} /> Tomar foto
              </button>
            )}
            <button type="button" onClick={() => (esAndroid ? inputGaleriaRef.current : inputArchivoRef.current)?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              <ImagePlus size={14} /> {esAndroid ? "Elegir de galería" : evidencia ? "Cambiar imagen" : "Elegir imagen"}
            </button>
            {evidencia && (
              <button type="button" onClick={() => setEvidencia(undefined)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20">
                <X size={14} /> Quitar
              </button>
            )}
          </div>
          {errorImagen && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">{errorImagen}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={cerrar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">Cancelar</button>
          <button type="button" onClick={confirmar} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Check size={16} /> Autorizar venta</button>
        </div>
      </div>
    </div>
  );
}
