// src/vistas/nuevo_producto/SeccionInformacionProducto.tsx
import { Camera, FolderPlus, Lock, ShieldCheck } from "lucide-react";
import AyudaContextual from "../../componentes/ui/AyudaContextual";
import { colorConAlpha } from "../../utilidades/coloresCategoria";
import type { Categoria } from "../../tipos/producto";
import { cn } from "../../utilidades/utils";

interface PropsSeccionInformacionProducto {
  nombre: string;
  setNombre: (nombre: string) => void;
  codigo: string;
  setCodigo: (codigo: string) => void;
  descripcion: string;
  setDescripcion: (descripcion: string) => void;
  categoria: string;
  setCategoria: (categoria: string) => void;
  ubicacion: string;
  setUbicacion: (ubicacion: string) => void;
  categorias: Categoria[];
  colorCategoria?: string;
  puedeEditar: boolean | undefined;
  puedeEditarCodigo: boolean | undefined;
  onGenerarCodigo: (formato: "EAN13" | "CORTO" | "NUMERICO") => void;
  onAbrirEscaner: () => void;
  onAbrirCategorias: () => void;
  campo: string;
  requiereAutorizacion: boolean;
  setRequiereAutorizacion: (requiere: boolean) => void;
  mensajeAutorizacion: string;
  setMensajeAutorizacion: (mensaje: string) => void;
  permiteFotoAutorizacion: boolean;
  setPermiteFotoAutorizacion: (permite: boolean) => void;
}

export default function SeccionInformacionProducto({
  nombre,
  setNombre,
  codigo,
  setCodigo,
  descripcion,
  setDescripcion,
  categoria,
  setCategoria,
  ubicacion,
  setUbicacion,
  categorias,
  colorCategoria,
  puedeEditar,
  puedeEditarCodigo,
  onGenerarCodigo,
  onAbrirEscaner,
  onAbrirCategorias,
  campo,
  requiereAutorizacion,
  setRequiereAutorizacion,
  mensajeAutorizacion,
  setMensajeAutorizacion,
  permiteFotoAutorizacion,
  setPermiteFotoAutorizacion,
}: PropsSeccionInformacionProducto) {
  return (
    <>
      <section className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex justify-between items-center">
          Información General
          {!puedeEditar && <Lock size={14} className="text-slate-400" />}
        </h2>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del producto *</label>
          <input type="text" required disabled={!puedeEditar} value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej: Pasta blanca" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Código de barras *</label>
          <div className="flex gap-2">
            <input type="text" required disabled={!puedeEditarCodigo} data-escaner="true" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={cn(campo, "flex-1 font-mono")} placeholder="Escanea o genera un código" />
            <select disabled={!puedeEditarCodigo} onChange={(evento) => onGenerarCodigo(evento.target.value as "EAN13" | "CORTO" | "NUMERICO")} defaultValue="" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950 sm:flex-none sm:px-2">
              <option value="" disabled>Generar...</option>
              <option value="EAN13">EAN-13</option>
              <option value="CORTO">Corto (5 dígitos)</option>
              <option value="NUMERICO">Numérico (8 dígitos)</option>
            </select>
            <button type="button" disabled={!puedeEditarCodigo} onClick={onAbrirEscaner} title="Escanear con cámara" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"><Camera size={14} /></button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
          <textarea disabled={!puedeEditar} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={cn(campo, "resize-none")} placeholder="Ej: Pasta dental" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
            <div className="flex gap-2">
              <select disabled={!puedeEditar} value={categoria} onChange={(e) => setCategoria(e.target.value)} className={cn(campo, "flex-1")}>
                <option value="">Seleccionar</option>
                {categorias.map((item) => <option key={item.id} value={item.nombre}>{item.nombre}</option>)}
              </select>
              {puedeEditar && (
                <button type="button" onClick={onAbrirCategorias} className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800" title="Nueva categoría">
                  <FolderPlus size={14} />
                </button>
              )}
            </div>
            {categoria && colorCategoria && (
              <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: colorConAlpha(colorCategoria, 0.16), color: colorCategoria }}>
                {categoria}
              </span>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación en tienda</label>
            <input type="text" disabled={!puedeEditar} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={campo} placeholder="Ej: Refrigerador 2" />
            <p className="text-[10px] text-slate-400 mt-1">Estante, pasillo o refrigerador.</p>
          </div>
        </div>
      </section>

      <section className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="flex min-w-0 items-center gap-2">
                <ShieldCheck size={18} className="shrink-0 text-amber-600" /> Requiere autorización
                {!puedeEditar && <Lock size={14} className="text-slate-400" />}
              </span>
              <input type="checkbox" disabled={!puedeEditar} checked={requiereAutorizacion} onChange={(evento) => setRequiereAutorizacion(evento.target.checked)} className="h-4 w-4 accent-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed" />
            </label>
            <AyudaContextual
              etiqueta="Requiere autorización"
              texto="Activa esta opción para que, antes de vender el producto, el personal tenga que solicitar autorización de un supervisor o dueño. Puedes indicar el motivo o requisito y permitir que se adjunte una foto como evidencia."
            />
          </div>
        </div>
        {requiereAutorizacion && (
          <>
            <input disabled={!puedeEditar} value={mensajeAutorizacion} onChange={(evento) => setMensajeAutorizacion(evento.target.value)} className={campo} placeholder="Ej: Requiere receta médica" />
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" disabled={!puedeEditar} checked={permiteFotoAutorizacion} onChange={(evento) => setPermiteFotoAutorizacion(evento.target.checked)} className="h-4 w-4 accent-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed" />
              Permitir foto de receta o evidencia
            </label>
          </>
        )}
      </section>
    </>
  );
}
