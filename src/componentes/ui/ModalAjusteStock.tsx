import { useState, type FormEvent } from "react";
import { CalendarDays, X } from "lucide-react";
import type { Producto } from "../../tipos/producto";
import CampoFecha from "./CampoFecha";

interface PropsModalAjusteStock {
  producto: Producto | null;
  alCerrar: () => void;
  alConfirmar: (ajuste: number, fechaCaducidad?: string) => Promise<void>;
}

export default function ModalAjusteStock({ producto, alCerrar, alConfirmar }: PropsModalAjusteStock) {
  const [cantidad, setCantidad] = useState("");
  const [fechaCaducidad, setFechaCaducidad] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  if (!producto) return null;

  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const ajuste = Number(cantidad);
    if (!Number.isFinite(ajuste) || ajuste === 0) {
      setError("Ingresa una cantidad distinta de cero.");
      return;
    }
    setGuardando(true);
    try {
      await alConfirmar(ajuste, ajuste > 0 ? fechaCaducidad || undefined : undefined);
      alCerrar();
    } catch (errorGuardado) {
      setError(errorGuardado instanceof Error ? errorGuardado.message : "No se pudo guardar el ajuste de stock.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={alCerrar}>
      <form
        onSubmit={guardar}
        onClick={(evento) => evento.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Ajustar stock</h2>
            <p className="mt-1 text-sm text-slate-500">{producto.nombre} · Actual: {producto.stock_actual}</p>
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Cantidad a sumar o restar</label>
        <input
          type="number"
          step="any"
          autoFocus
          value={cantidad}
          onChange={(evento) => setCantidad(evento.target.value)}
          placeholder="Ej: 10 o -2"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
        {Number(cantidad) > 0 && (
          <div className="mt-3">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <CalendarDays size={14} /> Caducidad del nuevo lote (opcional)
            </label>
            <CampoFecha
              value={fechaCaducidad}
              onChange={setFechaCaducidad}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              aria-label="Fecha de caducidad del nuevo lote"
            />
          </div>
        )}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={alCerrar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">Cancelar</button>
          <button type="submit" disabled={guardando} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{guardando ? "Guardando..." : "Guardar ajuste"}</button>
        </div>
      </form>
    </div>
  );
}
