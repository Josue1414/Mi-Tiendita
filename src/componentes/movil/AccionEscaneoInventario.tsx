// src/hooks/useEscanerCodigoBarras.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, CalendarDays, ExternalLink, Minus, Package, Plus, Save, X } from "lucide-react";
import type { Producto } from "../../tipos/producto";
import { useEstadoInventario } from "../../estado/estadoInventario";
import { useEstadoNavegacion } from "../../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../../estado/estadoTrabajadores";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import ModalEscanerCodigo from "../ui/ModalEscanerCodigo";
import { ajustarLotes } from "../../utilidades/lotes";
import CampoFecha from "../ui/CampoFecha";

const CLAVE_CODIGO_NUEVO = "codigo_producto_pendiente";

export default function AccionEscaneoInventario() {
  const { productos, actualizarProducto } = useEstadoInventario();
  const trabajadorActivo = useEstadoTrabajadores((estado) => estado.trabajadorActivo);
  const diasAlertaCaducidad = useEstadoConfiguracion((estado) => estado.diasAlertaCaducidad);
  const { seccionActual, setSeccionActual } = useEstadoNavegacion();
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cantidadAgregar, setCantidadAgregar] = useState(0);
  const [fechaCaducidad, setFechaCaducidad] = useState("");
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const seccionAlAbrir = useRef(seccionActual);
  const cerrarEscaner = useCallback(() => setEscanerAbierto(false), []);

  useEffect(() => {
    if (escanerAbierto && seccionActual !== seccionAlAbrir.current) {
      setEscanerAbierto(false);
    }
    seccionAlAbrir.current = seccionActual;
  }, [escanerAbierto, seccionActual]);

  const abrirEscaner = () => {
    seccionAlAbrir.current = seccionActual;
    setProducto(null);
    setCodigoNoEncontrado(null);
    setCantidadAgregar(0);
    setFechaCaducidad("");
    setEscanerAbierto(true);
  };

  const alDetectar = useCallback((codigo: string) => {
    const encontrado = productos.find((item) => item.codigo_barras.trim() === codigo.trim());
    setEscanerAbierto(false);
    if (!encontrado) {
      setCodigoNoEncontrado(codigo);
      return;
    }
    setProducto(encontrado);
    setCantidadAgregar(0);
    setFechaCaducidad("");
  }, [productos]);

  const guardarStock = async () => {
    if (!producto || !Number.isFinite(cantidadAgregar) || cantidadAgregar <= 0) return;
    const ajuste = Math.round(cantidadAgregar * 1000) / 1000;
    const stockNuevo = Math.round((producto.stock_actual + ajuste) * 1000) / 1000;
    setGuardando(true);
    try {
      const actualizado = {
        ...producto,
        stock_actual: stockNuevo,
        lotes: ajustarLotes(producto.lotes, ajuste, {
          fechaCaducidad,
          agregadoPor: trabajadorActivo?.nombre ?? "Sistema",
          diasAlerta: diasAlertaCaducidad,
        }),
      };
      await actualizarProducto(actualizado);
      setProducto(actualizado);
      setCantidadAgregar(0);
      setFechaCaducidad("");
    } finally {
      setGuardando(false);
    }
  };

  const irAProducto = () => {
    if (!producto) return;
    setSeccionActual("nuevo-producto", producto.id);
    setProducto(null);
  };

  const crearProducto = () => {
    if (codigoNoEncontrado) localStorage.setItem(CLAVE_CODIGO_NUEVO, codigoNoEncontrado);
    setCodigoNoEncontrado(null);
    setSeccionActual("nuevo-producto");
  };

  return (
    <>
      <button
        type="button"
        onClick={abrirEscaner}
        title="Escanear inventario"
        className="absolute left-1/2 top-1/2 z-40 flex min-w-[5.25rem] -translate-x-1/2 -translate-y-[58%] flex-col items-center gap-1 rounded-2xl border-4 border-white bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white shadow-lg shadow-emerald-600/35 transition-transform hover:scale-105 dark:border-zinc-950"
      >
        <Camera size={24} strokeWidth={2.5} />
        <span>Escanear</span>
      </button>

      {escanerAbierto && createPortal(<ModalEscanerCodigo abierto={true} alCerrar={cerrarEscaner} alDetectar={alDetectar} />, document.body)}

      {producto && createPortal((
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setProducto(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><Package size={22} /></div><div className="min-w-0"><h2 className="truncate font-bold text-slate-900 dark:text-slate-100">{producto.nombre}</h2><p className="text-xs text-slate-500">Código: {producto.codigo_barras}</p></div></div>
              <button type="button" onClick={() => setProducto(null)} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Stock actual</span>
              <p className="mt-1 text-center text-2xl font-bold text-slate-700 dark:text-slate-200">
                {producto.stock_actual} <span className="text-sm font-medium text-slate-500">{producto.unidad.toLowerCase()}</span>
              </p>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Cantidad a agregar (nuevo lote)</label>
            <div className="mt-2 flex items-center justify-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
              <button type="button" onClick={() => setCantidadAgregar((valor) => Math.max(0, Math.round((valor - 1) * 1000) / 1000))} aria-label="Restar una unidad" className="rounded-lg bg-white p-2 text-slate-600 shadow-sm hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-300"><Minus size={18} /></button>
              <input type="number" min="0" step="0.001" value={cantidadAgregar} onChange={(evento) => {
                const valor = Number(evento.target.value);
                setCantidadAgregar(Number.isFinite(valor) ? Math.max(0, valor) : 0);
              }} className="w-28 bg-transparent text-center text-3xl font-bold text-slate-900 outline-none dark:text-white" aria-label="Cantidad a agregar al inventario" />
              <button type="button" onClick={() => setCantidadAgregar((valor) => Math.round((valor + 1) * 1000) / 1000)} aria-label="Agregar una unidad" className="rounded-lg bg-white p-2 text-slate-600 shadow-sm hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-300"><Plus size={18} /></button>
            </div>
            {cantidadAgregar > 0 && (
              <div className="mt-3">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <CalendarDays size={14} /> Caducidad del nuevo lote (opcional)
                </label>
                <CampoFecha
                  value={fechaCaducidad}
                  onChange={setFechaCaducidad}
                  size="large"
                  maxYear={2100}
                  className="w-full rounded-xl"
                  aria-label="Fecha de caducidad del nuevo lote"
                />
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={irAProducto} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"><ExternalLink size={15} /> Ver información</button><button type="button" onClick={guardarStock} disabled={guardando || cantidadAgregar <= 0} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"><Save size={15} /> {guardando ? "Guardando" : "Agregar lote"}</button></div>
          </div>
        </div>
      ), document.body)}

      {codigoNoEncontrado && createPortal((
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setCodigoNoEncontrado(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-800/40 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><Camera size={22} /></div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Código no existe</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No encontramos <strong>{codigoNoEncontrado}</strong>. ¿Quieres crear un nuevo producto?</p>
            <div className="mt-5 flex gap-2"><button type="button" onClick={() => setCodigoNoEncontrado(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">Cancelar</button><button type="button" onClick={crearProducto} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Crear producto</button></div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}