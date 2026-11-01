// src/vistas/nuevo_producto/SeccionInventarioProducto.tsx
import { CalendarDays, Check, CircleHelp, Info, Lock, Pencil, X } from "lucide-react";
import CampoFecha from "../../componentes/ui/CampoFecha";
import type { LoteProducto, Producto } from "../../tipos/producto";
import { cn } from "../../utilidades/utils";
import { estadoCaducidad } from "../../utilidades/lotes";

interface PropsSeccionInventarioProducto {
  modoVenta: "PIEZA" | "GRANEL";
  onCambiarModoVenta: (nuevoModo: "PIEZA" | "GRANEL") => void;
  equivalenciaLitros: boolean;
  setEquivalenciaLitros: (equiv: boolean) => void;
  controlaStock: boolean;
  setControlaStock: (controla: boolean) => void;
  puedeEditar: boolean | undefined;
  puedeAjustarStock: boolean | undefined;
  editando: boolean;
  productoExistente?: Producto;
  stockActual: number;
  setStockActual: (stock: number) => void;
  stockMinimo: number;
  setStockMinimo: (stock: number) => void;
  paquete: string;
  setPaquete: (paquete: string) => void;
  cantidadNuevoLote: number;
  setCantidadNuevoLote: (cantidad: number) => void;
  mostrarAyudaLotes: boolean;
  setMostrarAyudaLotes: (mostrar: boolean) => void;
  fechaCaducidadNuevoLote: string;
  setFechaCaducidadNuevoLote: (fecha: string) => void;
  unidad: Producto["unidad"];
  setUnidad: (unidad: Producto["unidad"]) => void;
  lotesRecientes: LoteProducto[];
  loteCaducidadEditando: string | null;
  setLoteCaducidadEditando: (loteId: string | null) => void;
  fechaCaducidadEditada: string;
  setFechaCaducidadEditada: (fecha: string) => void;
  onGuardarCaducidadLote: (loteId: string) => void;
  onAbrirLoteCaducidad: (loteId: string) => void;
  campo: string;
}

export default function SeccionInventarioProducto({
  modoVenta,
  onCambiarModoVenta,
  equivalenciaLitros,
  setEquivalenciaLitros,
  controlaStock,
  setControlaStock,
  puedeEditar,
  puedeAjustarStock,
  editando,
  productoExistente,
  stockActual,
  setStockActual,
  stockMinimo,
  setStockMinimo,
  paquete,
  setPaquete,
  cantidadNuevoLote,
  setCantidadNuevoLote,
  mostrarAyudaLotes,
  setMostrarAyudaLotes,
  fechaCaducidadNuevoLote,
  setFechaCaducidadNuevoLote,
  unidad,
  setUnidad,
  lotesRecientes,
  loteCaducidadEditando,
  setLoteCaducidadEditando,
  fechaCaducidadEditada,
  setFechaCaducidadEditada,
  onGuardarCaducidadLote,
  onAbrirLoteCaducidad,
  campo,
}: PropsSeccionInventarioProducto) {
  return (
    <section className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">Detalles de Inventario</h2>
        <label className={cn("flex items-center gap-2", puedeEditar ? "cursor-pointer" : "cursor-not-allowed opacity-70")}>
          <span className="text-xs text-slate-500">Controlar stock</span>
          <div className="relative">
            <input type="checkbox" className="sr-only" disabled={!puedeEditar} checked={controlaStock} onChange={() => setControlaStock(!controlaStock)} />
            <div className={cn("block w-9 h-5 rounded-full", controlaStock ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")} />
            <div className={cn("absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform", controlaStock ? "translate-x-4" : "")} />
          </div>
        </label>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl mb-1 border border-slate-200 dark:border-white/5">
        <button
          type="button"
          disabled={!puedeEditar}
          onClick={() => onCambiarModoVenta("PIEZA")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
            modoVenta === "PIEZA" ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-white/10" : "text-slate-500"
          )}
        >
          Por Pieza / Entero
        </button>
        <button
          type="button"
          disabled={!puedeEditar}
          onClick={() => onCambiarModoVenta("GRANEL")}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
            modoVenta === "GRANEL" ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-white/10" : "text-slate-500"
          )}
        >
          A Granel / Báscula
        </button>
      </div>

      <div className="mb-2 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
        <label className="block text-xs font-medium text-slate-600 mb-2">Unidad de medida {!puedeEditar && <Lock size={10} className="inline text-slate-400" />}</label>
        <select disabled={!puedeEditar} value={unidad} onChange={(e) => setUnidad(e.target.value as Producto["unidad"])} className={campo}>
          {modoVenta === "PIEZA" ? (
            <>
              <option value="PIEZA">Pieza</option>
              <option value="PAQUETE">Paquete</option>
              <option value="SOBRE">Sobre</option>
              <option value="DOCENA">Docena</option>
            </>
          ) : (
            <>
              <option value="KG">Kilogramos (KG)</option>
              <option value="GRAMO">Gramos (G)</option>
              <option value="LITRO">Litros (L)</option>
              <option value="MILILITRO">Mililitros (ML)</option>
            </>
          )}
        </select>

        {modoVenta === "GRANEL" && (unidad === "LITRO" || unidad === "MILILITRO") && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-top-2">
            <p className="text-[11px] text-blue-700 dark:text-blue-300 font-bold mb-2">Las básculas leen peso físico, no volumen. ¿Cómo deseas vender este líquido?</p>
            <label className="flex items-center gap-2 text-xs font-semibold text-blue-800 dark:text-blue-200 cursor-pointer">
              <input type="radio" name="litros_equiv" disabled={!puedeEditar} checked={equivalenciaLitros} onChange={() => setEquivalenciaLitros(true)} className="accent-blue-600" />
              Asumir que 1 Kg = 1 Litro (Habilita la lectura en báscula)
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-blue-800 dark:text-blue-200 cursor-pointer mt-2">
              <input type="radio" name="litros_equiv" disabled={!puedeEditar} checked={!equivalenciaLitros} onChange={() => setEquivalenciaLitros(false)} className="accent-blue-600" />
              Ingresar cantidad manual (Apaga la báscula para este producto)
            </label>
          </div>
        )}
      </div>

      {!controlaStock && (
        <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs">
          <Info size={14} className="shrink-0 mt-0.5" />
          No descuenta existencias al venderse.
        </div>
      )}

      <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", !controlaStock && "opacity-50 pointer-events-none")}>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{editando ? "Cantidad actual" : "Cantidad inicial"}</label>
          {editando ? (
            <div className={cn(campo, "font-bold")}>{productoExistente?.stock_actual ?? 0}</div>
          ) : (
            <input type="number" min="0" disabled={!puedeEditar && !puedeAjustarStock} placeholder="0" value={stockActual === 0 ? "" : stockActual} onChange={(e) => setStockActual(e.target.value ? Number(e.target.value) : 0)} className={campo} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">Stock mínimo {!puedeEditar && <Lock size={10} className="text-slate-400" />}</label>
          <input type="number" min="0" disabled={!puedeEditar} placeholder="0" value={stockMinimo === 0 ? "" : stockMinimo} onChange={(e) => setStockMinimo(e.target.value ? Number(e.target.value) : 0)} className={campo} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">Contiene: {!puedeEditar && <Lock size={10} className="text-slate-400" />}</label>
          <input type="text" disabled={!puedeEditar} value={paquete} onChange={(e) => setPaquete(e.target.value)} className={campo} placeholder="Ej: 1 kg" />
        </div>
      </div>

      {controlaStock && puedeAjustarStock && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 mt-2">
          {editando && (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Agregar nueva cantidad o lote</label>
              <button
                type="button"
                onClick={() => setMostrarAyudaLotes(!mostrarAyudaLotes)}
                aria-label="Ayuda sobre agregar lotes"
                className="rounded-full text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900/30"
              >
                <CircleHelp size={16} />
              </button>
              {mostrarAyudaLotes && (
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Añade unidades a la cantidad actual como un lote nuevo. La fecha de caducidad es opcional.
                </span>
              )}
            </div>
          )}
          {editando && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Cantidad que agregas</label>
              <input
                type="number"
                min="0"
                value={cantidadNuevoLote || ""}
                onChange={(evento) => setCantidadNuevoLote(Math.max(0, Number(evento.target.value) || 0))}
                className={campo}
                placeholder="0"
              />
            </div>
          )}
          {(!editando || cantidadNuevoLote > 0) && (
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <CalendarDays size={13} /> Caducidad del stock agregado (opcional)
              </label>
              <CampoFecha value={fechaCaducidadNuevoLote} onChange={setFechaCaducidadNuevoLote} className={campo} aria-label="Fecha de caducidad" />
            </div>
          )}
          {editando && <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">El stock actual no cambia; la cantidad agregada se registra por separado.</p>}
        </div>
      )}

      {editando && lotesRecientes.length > 0 && (
        <div className="border-t border-slate-200 pt-3 dark:border-white/10 mt-2">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Últimas fechas de caducidad</h3>
          <div className="flex flex-wrap gap-2">
            {lotesRecientes.map((lote) => {
              const estado = estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta);
              const claseFecha = lote.cantidad <= 0 ? "bg-slate-100 text-slate-500 opacity-60" : estado === "vencido" ? "bg-purple-100 text-purple-800" : estado === "proximo" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
              return (
                <button key={lote.id} type="button" onClick={() => onAbrirLoteCaducidad(lote.id)} className={cn("rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors hover:ring-2 hover:ring-emerald-500", claseFecha)}>
                  <span className="block">{lote.fecha_caducidad || "Sin fecha"}</span>
                  <span className="mt-0.5 block text-[10px] font-normal">Ingreso {lote.fecha_ingreso} · {lote.cantidad} {unidad.toLowerCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {editando && (productoExistente?.lotes?.length ?? 0) > 0 && (
        <div className="border-t border-slate-200 pt-3 dark:border-white/10 mt-2">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            <CalendarDays size={14} /> Lotes registrados
          </h3>
          <div className="space-y-2">
            {productoExistente?.lotes?.map((lote) => (
              <div key={lote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{lote.cantidad} {unidad.toLowerCase()}</span>
                  <span className="ml-2 text-slate-500">Ingresó {lote.fecha_ingreso} · {lote.agregado_por}</span>
                  {lote.editado_por && <span className="ml-2 text-purple-700 dark:text-purple-300">Editó {lote.editado_por}</span>}
                </div>
                {loteCaducidadEditando === lote.id ? (
                  <div className="flex items-center gap-1.5">
                    <CampoFecha aria-label="Corregir fecha de caducidad" value={fechaCaducidadEditada} onChange={setFechaCaducidadEditada} className={cn(campo, "w-auto")} />
                    <button type="button" onClick={() => onGuardarCaducidadLote(lote.id)} aria-label="Guardar fecha" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"><Check size={15} /></button>
                    <button type="button" onClick={() => setLoteCaducidadEditando(null)} aria-label="Cancelar edición" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"><X size={15} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{lote.fecha_caducidad || "Sin fecha de caducidad"}</span>
                    {puedeEditar && (
                      <button type="button" onClick={() => {
                        setLoteCaducidadEditando(lote.id);
                        setFechaCaducidadEditada(lote.fecha_caducidad ?? "");
                      }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30">
                        <Pencil size={12} /> Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}