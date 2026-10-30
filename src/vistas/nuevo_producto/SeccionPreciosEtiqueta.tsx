// src/vistas/nuevo_producto/SeccionPreciosEtiqueta.tsx
import { Lock, Printer, Save } from "lucide-react";
import { cn } from "../../utilidades/utils";
import { imprimirEtiqueta } from "../../utilidades/codigoBarras";
import type { Producto } from "../../tipos/producto";

interface PropsSeccionPreciosEtiqueta {
  puedeEditarPrecio: boolean;
  precio: number;
  setPrecio: (precio: number) => void;
  costo: number;
  setCosto: (costo: number) => void;
  descuento: number;
  setDescuento: (descuento: number) => void;
  precioFinal: number;
  margen: number;
  unidad: Producto["unidad"];
  previewCodigo: string;
  nombre: string;
  codigo: string;
  editando: boolean;
  puedeGuardar: boolean;
  onGuardar: () => void;
  campo: string;
}

export default function SeccionPreciosEtiqueta({
  puedeEditarPrecio,
  precio,
  setPrecio,
  costo,
  setCosto,
  descuento,
  setDescuento,
  precioFinal,
  margen,
  unidad,
  previewCodigo,
  nombre,
  codigo,
  editando,
  puedeGuardar,
  onGuardar,
  campo,
}: PropsSeccionPreciosEtiqueta) {
  return (
    <>
      <section className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex justify-between items-center">
          Precios {!puedeEditarPrecio && <Lock size={14} className="text-slate-400" />}
        </h2>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Precio de venta *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" disabled={!puedeEditarPrecio} step="0.01" placeholder="0.00" value={precio === 0 ? "" : precio} onChange={(e) => setPrecio(e.target.value ? Number(e.target.value) : 0)} className={cn(campo, "pl-7 font-semibold")} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Costo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input type="number" disabled={!puedeEditarPrecio} step="0.01" min="0" placeholder="0.00" value={costo === 0 ? "" : costo} onChange={(e) => setCosto(e.target.value ? Number(e.target.value) : 0)} className={cn(campo, "pl-7")} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descuento (%)</label>
          <div className="relative">
            <input type="number" disabled={!puedeEditarPrecio} step="0.5" min="0" max="100" placeholder="0" value={descuento === 0 ? "" : descuento} onChange={(e) => setDescuento(e.target.value ? Number(e.target.value) : 0)} className={cn(campo, "pr-8")} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
          </div>
        </div>
        {descuento > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-2">
            Precio final: <span className="font-bold">${precioFinal.toFixed(2)}</span>{" "}
            <span className="line-through opacity-60">${Number(precio).toFixed(2)}</span>
          </p>
        )}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-500">
          Margen de ganancia: <span className="font-bold text-emerald-600">{margen > 0 ? `${margen.toFixed(1)}%` : "—"}</span>
        </div>
      </section>

      <section className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-2 border border-slate-200 dark:border-white/10">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Vista previa del código</h2>
        {previewCodigo ? (
          <>
            <div className="bg-white rounded-lg p-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: previewCodigo }} />
            <p className="text-[10px] text-center text-slate-400">{unidad} — {unidad.toLowerCase()}(s)</p>
            <button
              type="button"
              onClick={() => imprimirEtiqueta({ nombre: nombre || "Producto", codigo, precio: precioFinal })}
              className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <Printer size={14} /> Imprimir etiqueta
            </button>
          </>
        ) : (
          <p className="text-xs text-slate-400">Genera o escribe un código para ver la etiqueta.</p>
        )}
      </section>

      <button type="button" onClick={onGuardar} disabled={!puedeGuardar} className="w-full h-10 inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 text-sm font-semibold transition-all shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed">
        <Save size={16} />
        {editando ? "Guardar Cambios" : "Guardar Producto"}
      </button>
    </>
  );
}
