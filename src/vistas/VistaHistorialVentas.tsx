// src/vistas/VistaHistorialVentas.tsx
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { Search, History, Calendar, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { imprimirTicket } from "../utilidades/impresion";

export default function VistaHistorialVentas() {
  const { ventas } = useEstadoVentas();
  const { nombreTienda, mensajeTicket } = useEstadoConfiguracion();
  
  const [busqueda, setBusqueda] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<string | null>(null);
  const porPagina = 10;

  const ventasFiltradas = useMemo(() => ventas.filter((v) => {
    const fecha = v.fecha.slice(0, 10);
    const textoCoincide = v.id.toLowerCase().includes(busqueda.toLowerCase()) || v.trabajador.toLowerCase().includes(busqueda.toLowerCase());
    return textoCoincide && (!fechaInicio || fecha >= fechaInicio) && (!fechaFin || fecha <= fechaFin);
  }), [ventas, busqueda, fechaInicio, fechaFin]);
  const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / porPagina));
  const ventasPagina = ventasFiltradas.slice((pagina - 1) * porPagina, pagina * porPagina);

  const ingresosTotales = ventasFiltradas.reduce((acc, v) => acc + v.total, 0);

  return (
    <div className="w-full h-full flex flex-col p-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <History size={20} />
            </div>
            Historial de Ventas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consulta las transacciones realizadas y emite reportes.
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500">Ingresos filtrados</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${ingresosTotales.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          placeholder="Buscar por ID de ticket o trabajador..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 pl-9 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-500">Desde <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setPagina(1); }} className="ml-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-100" /></label>
        <label className="text-xs font-medium text-slate-500">Hasta <input type="date" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); setPagina(1); }} className="ml-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-100" /></label>
        {(fechaInicio || fechaFin) && <button onClick={() => { setFechaInicio(""); setFechaFin(""); setPagina(1); }} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50">Limpiar fechas</button>}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden flex-1 flex flex-col border border-slate-200/50 dark:border-white/10">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm z-10">
              <tr className="border-b border-slate-200/50 dark:border-white/10 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Ticket ID</th>
                <th className="p-3">Trabajador</th>
                <th className="p-3 text-center">Artículos</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">Descuento</th>
                <th className="p-3 text-right text-emerald-600 dark:text-emerald-400">Total</th>
                <th className="p-3 text-center">Método</th>
                <th className="p-3 text-center">Ticket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/10">
              {ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-sm">No hay ventas registradas que coincidan con la búsqueda.</td>
                </tr>
              ) : (
                ventasPagina.map((venta) => (
                  <Fragment key={venta.id}>
                  <tr onClick={() => setVentaSeleccionada((actual) => actual === venta.id ? null : venta.id)} className="cursor-pointer hover:bg-white dark:hover:bg-slate-800/50 transition-colors text-slate-900 dark:text-slate-100">
                    <td className="p-3 flex items-center gap-2 text-xs">
                      <Calendar size={14} className="text-slate-400" />
                      {new Date(venta.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{venta.id.slice(0, 8).toUpperCase()}</td>
                    <td className="p-3 text-xs">{venta.trabajador.replace(/-/g, "").replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "").trim()}</td>
                    <td className="p-3 text-center text-xs">{venta.articulos.length}</td>
                    <td className="p-3 text-right text-xs">${venta.subtotal.toFixed(2)}</td>
                    <td className="p-3 text-right text-xs text-red-500">{venta.descuento > 0 ? `-$${venta.descuento.toFixed(2)}` : "-"}</td>
                    <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">${venta.total.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md text-[10px] font-bold tracking-wide uppercase">
                        {venta.metodoPago}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          imprimirTicket(venta, nombreTienda, mensajeTicket);
                        }}
                        className="p-1.5 mx-auto flex items-center justify-center text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        title="Reimprimir Ticket"
                      >
                        <Printer size={16} />
                      </button>
                    </td>
                  </tr>
                  {ventaSeleccionada === venta.id && (
                    <tr className="bg-emerald-50/60 dark:bg-emerald-950/20">
                      <td colSpan={9} className="px-5 py-3">
                        <div className="flex flex-wrap gap-2">
                          {venta.articulos.map((articulo) => (
                            <span key={articulo.id} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-slate-900">
                              <strong>{articulo.nombre}</strong> · {articulo.cantidad} {articulo.unidad.toLowerCase()} · ${articulo.subtotal.toFixed(2)}
                              {articulo.autorizacion_confirmada && <span className="ml-2 text-amber-600">Autorizado</span>}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200/50 px-3 py-2 text-xs text-slate-500 dark:border-white/10">
          <span>{ventasFiltradas.length} ventas · Página {pagina} de {totalPaginas}</span>
          <div className="flex gap-1">
            <button disabled={pagina === 1} onClick={() => setPagina((actual) => actual - 1)} className="rounded-md p-1.5 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronLeft size={15} /></button>
            <button disabled={pagina === totalPaginas} onClick={() => setPagina((actual) => actual + 1)} className="rounded-md p-1.5 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}