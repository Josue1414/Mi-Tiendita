// src/vistas/nuevo_producto/SeccionImagenProducto.tsx
import type { ChangeEventHandler, RefObject } from "react";
import { Camera, ImagePlus, Lock, X } from "lucide-react";

interface PropsSeccionImagenProducto {
  puedeEditar: boolean | undefined;
  esAndroid: boolean;
  previewImagen: string | null;
  inputArchivoRef: RefObject<HTMLInputElement | null>;
  inputCamaraRef: RefObject<HTMLInputElement | null>;
  inputGaleriaRef: RefObject<HTMLInputElement | null>;
  onSeleccionarImagen: ChangeEventHandler<HTMLInputElement>;
  onRemoverImagen: () => void;
}

export default function SeccionImagenProducto({
  puedeEditar,
  esAndroid,
  previewImagen,
  inputArchivoRef,
  inputCamaraRef,
  inputGaleriaRef,
  onSeleccionarImagen,
  onRemoverImagen,
}: PropsSeccionImagenProducto) {
  return (
    <section className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
      <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex justify-between items-center">
        Imagen {!puedeEditar && <Lock size={14} className="text-slate-400" />}
      </h2>
      <input type="file" disabled={!puedeEditar} accept="image/png, image/jpeg, image/webp" className="hidden" ref={inputArchivoRef} onChange={onSeleccionarImagen} />
      {esAndroid && <input type="file" disabled={!puedeEditar} accept="image/*" capture="environment" className="hidden" ref={inputCamaraRef} onChange={onSeleccionarImagen} />}
      <input type="file" disabled={!puedeEditar} accept="image/png, image/jpeg, image/webp" className="hidden" ref={inputGaleriaRef} onChange={onSeleccionarImagen} />
      {previewImagen ? (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
          <img src={previewImagen} alt="Vista previa" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-400 text-xs">
          <ImagePlus size={18} />
          Agrega una foto del producto
        </div>
      )}
      {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          {esAndroid && (
            <button type="button" onClick={() => inputCamaraRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
              <Camera size={14} /> Tomar foto
            </button>
          )}
          <button type="button" onClick={() => (esAndroid ? inputGaleriaRef.current : inputArchivoRef.current)?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
            <ImagePlus size={14} /> {esAndroid ? "Elegir de galería" : previewImagen ? "Cambiar imagen" : "Elegir imagen"}
          </button>
          {previewImagen && (
            <button type="button" onClick={onRemoverImagen} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20">
              <X size={14} /> Quitar
            </button>
          )}
        </div>
      )}
    </section>
  );
}
