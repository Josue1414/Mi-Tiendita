// src/vistas/VistaHistorialVentas.tsx
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoCaja } from "../estado/estadoCaja";
import { useEstadoPlan } from "../estado/estadoPlan";
import { Search, History, Calendar, ChevronLeft, ChevronRight, Printer, Ban, Settings, Cloud } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { imprimirTicket } from "../utilidades/impresion";
import ModalConfirmacion from "../componentes/ui/ModalConfirmacion";
import ModalConfirmacionPin from "../componentes/ui/ModalConfirmacionPin";
import ModalGestionHistorial from "../componentes/ui/ModalGestionHistorial";
import { cn } from "../utilidades/utils";
import CampoFecha from "../componentes/ui/CampoFecha";
import { abreviaturaUnidad } from "../tipos/producto";
import type { Venta } from "../estado/estadoVentas";

const obtenerFechaLocal = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

function TicketVentaExpandido({
  venta,
  nombreTienda,
  mensajeTicket,
  direccionTienda,
  logoTienda,
}: {
  venta: Venta;
  nombreTienda: string;
  mensajeTicket: string;
  direccionTienda: string;
  logoTienda: string;
}) {
  const trabajador = (venta.trabajador || "Cajero")
    .replace(/-/g, "")
    .replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "")
    .trim() || "Cajero";

  return (
    <div className="mx-auto w-full max-w-xl whitespace-normal rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
      {logoTienda && (
        <img src={logoTienda} alt={`Logo de ${nombreTienda}`} className="mx-auto mb-3 max-h-16 max-w-36 object-contain" />
      )}
      <header className="text-center">
        <h3 className="text-base font-black uppercase">{nombreTienda || "Mi Tienda"}</h3>
        {direccionTienda && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">{direccionTienda}</p>}
        <p className="mt-2 text-xs font-semibold">Comprobante de Venta</p>
      </header>

      <div className="mt-3 space-y-1 border-y border-dashed border-slate-300 py-3 text-xs dark:border-slate-700">
        <p><strong>Ticket:</strong> {venta.id}</p>
        <p><strong>Fecha:</strong> {new Date(venta.fecha).toLocaleString("es-MX")}</p>
        <p><strong>Cajero:</strong> {trabajador}</p>
        {venta.cancelada && <p className="font-bold uppercase text-red-600">Venta cancelada</p>}
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-slate-200 pb-2 text-[10px] font-bold uppercase dark:border-slate-700">
          <span>Cant.</span><span>Descripción</span><span className="text-right">Total</span>
        </div>
        {(venta.articulos || []).length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-500">Esta venta no tiene artículos registrados.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {venta.articulos.map((articulo, index) => {
              const esFraccion = ["KG", "LITRO", "GRAMO", "MILILITRO", "MILIGRAMO"].includes(articulo.unidad);
              const cantidad = esFraccion ? articulo.cantidad.toFixed(3) : articulo.cantidad.toString();
              const unidad = abreviaturaUnidad(articulo.unidad || "PIEZA");
              return (
                <div key={articulo.id || `${venta.id}-${articulo.producto_id}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 py-2 text-xs">
                  <span>{cantidad} {unidad}</span>
                  <span className="min-w-0 break-words">
                    {articulo.nombre}
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">${(articulo.precio || 0).toFixed(2)} x {unidad}</span>
                    {articulo.autorizacion_confirmada && <span className="block text-[10px] font-semibold text-amber-600">Autorizado</span>}
                  </span>
                  <span className="text-right">${(articulo.subtotal || 0).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1 border-t border-dashed border-slate-300 pt-3 text-xs dark:border-slate-700">
        <div className="flex justify-between"><span>Subtotal:</span><span>${(venta.subtotal || 0).toFixed(2)}</span></div>
        {(venta.descuento || 0) > 0 && (
          <div className="flex justify-between"><span>Descuento:</span><span>-${venta.descuento.toFixed(2)}</span></div>
        )}
        <div className="flex justify-between pt-1 text-base font-black"><span>TOTAL:</span><span>${(venta.total || 0).toFixed(2)}</span></div>
        <p className="pt-1">Pago: {venta.metodoPago || "EFECTIVO"}</p>
      </div>
      <footer className="mt-3 border-t border-dashed border-slate-300 pt-3 text-center text-xs font-semibold dark:border-slate-700">
        {mensajeTicket || "¡Gracias por su preferencia!"}
      </footer>
    </div>
  );
}

export default function VistaHistorialVentas() {
  const { ventas, cancelarVenta } = useEstadoVentas();
  const { nombreTienda, mensajeTicket, direccionTienda, logoTienda } = useEstadoConfiguracion();
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { requerirPinCancelacion } = useEstadoCaja();
  const { permiteNube } = useEstadoPlan(); 

  const [busqueda, setBusqueda] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [periodoIngresos, setPeriodoIngresos] = useState<"dia" | "semana" | "mes">("dia");
  const [pagina, setPagina] = useState(1);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const listaMovilRef = useRef<HTMLDivElement>(null);
  const listaEscritorioRef = useRef<HTMLDivElement>(null);
  const paginaAnteriorRef = useRef(pagina);
  
  const [confirmarCancelacion, setConfirmarCancelacion] = useState<{abierto: boolean, id: string}>({ abierto: false, id: "" });
  const [modalPinCancelacion, setModalPinCancelacion] = useState(false);
  const [modalGestionAbierto, setModalGestionAbierto] = useState(false);
  const [ventaPendienteCancelacion, setVentaPendienteCancelacion] = useState<string | null>(null);
  
  const porPagina = 10;
  const esEscritorio = typeof window !== 'undefined' && window.apiLocal !== undefined;

  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  const puedeCancelar = esDueño || (esSupervisor && trabajadorActivo?.permisos?.hacerCancelaciones);

  const ventasFiltradas = useMemo(() => ventas.filter((v) => {
    const fecha = obtenerFechaLocal(new Date(v.fecha));
    const textoCoincide = (v.id || "").toLowerCase().includes(busqueda.toLowerCase()) || 
                          (v.trabajador || "").toLowerCase().includes(busqueda.toLowerCase());
    return textoCoincide && (!fechaInicio || fecha >= fechaInicio) && (!fechaFin || fecha <= fechaFin);
  }), [ventas, busqueda, fechaInicio, fechaFin]);
  
  const totalPaginas = Math.max(1, Math.ceil(ventasFiltradas.length / porPagina));
  const ventasPagina = ventasFiltradas.slice((pagina - 1) * porPagina, pagina * porPagina);

  useEffect(() => {
    if (paginaAnteriorRef.current === pagina) return;
    paginaAnteriorRef.current = pagina;
    listaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    listaMovilRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    listaEscritorioRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagina]);

  const ingresosTotales = useMemo(() => {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let fin: Date;

    if (periodoIngresos === "semana") {
      inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
      fin = new Date(inicio);
      fin.setDate(fin.getDate() + 7);
    } else if (periodoIngresos === "mes") {
      inicio.setDate(1);
      fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    } else {
      fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
    }

    const fechaInicioPeriodo = obtenerFechaLocal(inicio);
    const fechaFinPeriodo = obtenerFechaLocal(fin);
    return ventasFiltradas.reduce((total, venta) => {
      const fecha = obtenerFechaLocal(new Date(venta.fecha));
      return venta.cancelada || fecha < fechaInicioPeriodo || fecha >= fechaFinPeriodo
        ? total
        : total + (venta.total || 0);
    }, 0);
  }, [ventasFiltradas, periodoIngresos]);

  const manejarCancelacion = () => {
    if(confirmarCancelacion.id) {
      cancelarVenta(confirmarCancelacion.id);
    }
    setConfirmarCancelacion({ abierto: false, id: "" });
  };

  const iniciarCancelacionConValidacion = (id: string) => {
    const esAutorizado = esDueño || esSupervisor;
    if (!requerirPinCancelacion || esAutorizado) {
      cancelarVenta(id);
      return;
    }
    setVentaPendienteCancelacion(id);
    setModalPinCancelacion(true);
  };

  const confirmarCancelacionConPin = () => {
    if (ventaPendienteCancelacion) cancelarVenta(ventaPendienteCancelacion);
    setModalPinCancelacion(false);
    setVentaPendienteCancelacion(null);
  };

  const hace15Horas = Date.now() - 15 * 60 * 60 * 1000;

  return (
    <div className="flex h-full w-full flex-col p-3 animate-in fade-in duration-300 sm:p-6">
      
      <ModalGestionHistorial abierto={modalGestionAbierto} alCerrar={() => setModalGestionAbierto(false)} />

      <ModalConfirmacionPin
        abierto={modalPinCancelacion}
        titulo="Autorización Requerida"
        mensaje="Ingresa el PIN de un Dueño o Supervisor para autorizar esta cancelación de venta."
        labelPin="PIN de Autorización"
        validarAutorizacion={true}
        alConfirmar={confirmarCancelacionConPin}
        alCerrar={() => {
          setModalPinCancelacion(false);
          setVentaPendienteCancelacion(null);
        }}
      />

      <ModalConfirmacion
        abierto={confirmarCancelacion.abierto}
        titulo="Cancelar Venta / Devolución"
        mensaje="¿Estás seguro de cancelar esta venta? Los artículos quedarán marcados como cancelados y el total se restará de los ingresos."
        alConfirmar={manejarCancelacion}
        alCerrar={() => setConfirmarCancelacion({ abierto: false, id: "" })}
      />

      <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:mb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl dark:text-slate-100">
            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <History size={20} />
            </div>
            Historial de Ventas
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {(!esEscritorio && permiteNube) && <Cloud size={14} className="text-emerald-500" fill="currentColor" />}
            {!esEscritorio 
              ? "Modo Web: Visualizando ventas sincronizadas (últimas 15 horas)." 
              : "Modo Cerebro: Visualizando historial local completo."}
          </p>
        </div>
        
        {esDueño && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:gap-4">
            <button 
              onClick={() => setModalGestionAbierto(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings size={14} /> Gestionar Historial
            </button>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <select
                value={periodoIngresos}
                onChange={(e) => {
                  const periodo = e.target.value;
                  if (periodo === "dia" || periodo === "semana" || periodo === "mes") {
                    setPeriodoIngresos(periodo);
                  }
                }}
                aria-label="Periodo de ingresos"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </select>
              <div className="flex min-w-0 flex-col items-end">
                <span className="text-right text-[11px] text-slate-500 sm:text-xs">Ingresos del {periodoIngresos === "dia" ? "día" : periodoIngresos === "semana" ? "semana" : "mes"}</span>
                <span className="text-base font-bold text-emerald-600 sm:text-lg dark:text-emerald-400">${ingresosTotales.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative mb-3 flex min-w-0 gap-2 sm:mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por ID de ticket o trabajador..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition-shadow focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100 sm:pr-4"
          />
        </div>
        {esDueño && (
          <button 
            onClick={() => setModalGestionAbierto(true)}
            className="sm:hidden flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Settings size={20} />
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
        <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">Desde <CampoFecha value={fechaInicio} onChange={(fecha) => { setFechaInicio(fecha); setPagina(1); }} className="h-8 min-w-0 text-xs" aria-label="Fecha inicial" /></label>
        <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">Hasta <CampoFecha value={fechaFin} onChange={(fecha) => { setFechaFin(fecha); setPagina(1); }} className="h-8 min-w-0 text-xs" aria-label="Fecha final" /></label>
        {(fechaInicio || fechaFin) && <button onClick={() => { setFechaInicio(""); setFechaFin(""); setPagina(1); }} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">Limpiar fechas</button>}
      </div>

      <div ref={listaRef} className="scroll-mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-slate-50 dark:border-white/10 dark:bg-slate-900/50">
        <div ref={listaMovilRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 md:hidden">
          {ventasFiltradas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No hay ventas registradas que coincidan con la búsqueda.</div>
          ) : (
            ventasPagina.map((venta) => {
              const estaSincronizada = venta.sincronizado ?? (new Date(venta.fecha).getTime() > hace15Horas);
              const estaEnNube = permiteNube && estaSincronizada;
              const trabajador = (venta.trabajador || "Cajero").replace(/-/g, "").replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "").trim();
              const estaExpandida = ventaSeleccionada === venta.id;

              return (
                <article key={venta.id} className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900", venta.cancelada && "border-red-200 dark:border-red-900/50")}>
                  <button
                    type="button"
                    aria-expanded={estaExpandida}
                    onClick={() => setVentaSeleccionada((actual) => actual === venta.id ? null : venta.id)}
                    className="block min-h-11 w-full p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className={cn("flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-100", venta.cancelada && "line-through text-slate-400")}>
                          {estaEnNube && <Cloud size={14} className="shrink-0 text-emerald-500" fill="currentColor" />}
                          {venta.id.substring(0, 8)}...
                        </span>
                        <span className={cn("mt-1 block text-xs text-slate-500 dark:text-slate-400", venta.cancelada && "line-through")}>
                          {new Date(venta.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      {venta.cancelada ? (
                        <span className="shrink-0 rounded-md bg-red-100 px-2 py-1 text-[10px] font-bold uppercase text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelada</span>
                      ) : (
                        <span className="max-w-[45%] truncate rounded-md bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide dark:bg-slate-700">{venta.metodoPago || "EFECTIVO"}</span>
                      )}
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">{trabajador || "Cajero"}</span>
                      <span className={cn("shrink-0 text-lg font-bold", venta.cancelada ? "text-red-500/70 line-through" : "text-emerald-600 dark:text-emerald-400")}>${(venta.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-[11px] dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400">Artículos <strong className="text-slate-700 dark:text-slate-200">{venta.articulos?.length || 0}</strong></span>
                      <span className="text-right text-slate-500 dark:text-slate-400">Subtotal <strong className={cn("text-slate-700 dark:text-slate-200", venta.cancelada && "line-through text-slate-400")}>${(venta.subtotal || 0).toFixed(2)}</strong></span>
                      <span className="text-right text-slate-500 dark:text-slate-400">Desc. <strong className="text-red-500">{(venta.descuento || 0) > 0 ? `-$${venta.descuento.toFixed(2)}` : "-"}</strong></span>
                    </div>
                    <span className="mt-2 block text-center text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                      {estaExpandida ? "Ocultar artículos" : "Toca para ver artículos"}
                    </span>
                  </button>
                  {estaExpandida && (
                    <div className="border-t border-slate-100 bg-emerald-50/60 p-3 dark:border-white/10 dark:bg-emerald-950/20">
                      <TicketVentaExpandido
                        venta={venta}
                        nombreTienda={nombreTienda}
                        mensajeTicket={mensajeTicket}
                        direccionTienda={direccionTienda}
                        logoTienda={logoTienda}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1 border-t border-slate-100 p-2 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => imprimirTicket(venta, nombreTienda, mensajeTicket, direccionTienda, logoTienda)}
                      aria-label="Reimprimir Ticket"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                    >
                      <Printer size={18} />
                    </button>
                    {!venta.cancelada && puedeCancelar && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!requerirPinCancelacion || esDueño || esSupervisor) {
                            setConfirmarCancelacion({ abierto: true, id: venta.id });
                          } else {
                            iniciarCancelacionConValidacion(venta.id);
                          }
                        }}
                        aria-label="Cancelar Venta / Devolución"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                      >
                        <Ban size={18} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div ref={listaEscritorioRef} className="hidden min-h-0 flex-1 overflow-auto md:block">
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
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/10">
              {ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-sm">No hay ventas registradas que coincidan con la búsqueda.</td>
                </tr>
              ) : (
                ventasPagina.map((venta) => {
                  const estaSincronizada = venta.sincronizado ?? (new Date(venta.fecha).getTime() > hace15Horas);
                  const estaEnNube = permiteNube && estaSincronizada;
                  
                  return (
                    <Fragment key={venta.id}>
                    <tr onClick={() => setVentaSeleccionada((actual) => actual === venta.id ? null : venta.id)} className={cn("cursor-pointer hover:bg-white dark:hover:bg-slate-800/50 transition-colors text-slate-900 dark:text-slate-100", venta.cancelada && "opacity-75 bg-red-50/30 dark:bg-red-900/10")}>
                      
                      <td className="p-3 text-xs">
                        <div className={cn("flex items-center gap-2", venta.cancelada && "line-through text-slate-400")}>
                          <Calendar size={14} className={venta.cancelada ? "text-red-400" : "text-slate-400"} />
                          {new Date(venta.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </td>
                      
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        <div className={cn("flex items-center gap-1", venta.cancelada && "line-through")}>
                          {estaEnNube && (
                            <span title="Sincronizada en línea">
                              <Cloud size={14} className="text-emerald-500" fill="currentColor" />
                            </span>
                          )}
                          {venta.id.substring(0, 8)}...
                        </div>
                      </td>
                      
                      <td className="p-3 text-xs">{(venta.trabajador || "Cajero").replace(/-/g, "").replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "").trim()}</td>
                      <td className="p-3 text-center text-xs">{venta.articulos?.length || 0}</td>
                      <td className={cn("p-3 text-right text-xs", venta.cancelada && "line-through text-slate-400")}>${(venta.subtotal || 0).toFixed(2)}</td>
                      <td className="p-3 text-right text-xs text-red-500">{(venta.descuento || 0) > 0 ? `-$${venta.descuento.toFixed(2)}` : "-"}</td>
                      <td className={cn("p-3 text-right font-bold text-sm", venta.cancelada ? "text-red-500/70 line-through" : "text-emerald-600 dark:text-emerald-400")}>${(venta.total || 0).toFixed(2)}</td>
                      <td className="p-3 text-center">
                        {venta.cancelada ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-md text-[10px] font-bold uppercase">Cancelada</span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-md text-[10px] font-bold tracking-wide uppercase">{venta.metodoPago || "EFECTIVO"}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              imprimirTicket(venta, nombreTienda, mensajeTicket, direccionTienda, logoTienda);
                            }}
                            className="p-1.5 flex items-center justify-center text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Reimprimir Ticket"
                          >
                            <Printer size={16} />
                          </button>
                          
                          {!venta.cancelada && puedeCancelar && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!requerirPinCancelacion || esDueño || esSupervisor) {
                                  setConfirmarCancelacion({ abierto: true, id: venta.id });
                                } else {
                                  iniciarCancelacionConValidacion(venta.id);
                                }
                              }}
                              className="p-1.5 flex items-center justify-center text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              title="Cancelar Venta / Devolución"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {ventaSeleccionada === venta.id && (
                      <tr className="bg-emerald-50/60 dark:bg-emerald-950/20">
                        <td colSpan={9} className="px-5 py-3">
                          <TicketVentaExpandido
                            venta={venta}
                            nombreTienda={nombreTienda}
                            mensajeTicket={mensajeTicket}
                            direccionTienda={direccionTienda}
                            logoTienda={logoTienda}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/50 px-3 py-2 text-xs text-slate-500 dark:border-white/10">
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