// src/vistas/VistaFiados.tsx
import { useState, useEffect, useMemo } from "react";
import { BookUser, Search, AlertTriangle, Phone, FileText, ChevronDown, CheckCircle, Trash2, Receipt, HandCoins, ArrowDownToLine, Eraser, ChevronLeft, ChevronRight, CheckCircle2, Pencil, X, Save } from "lucide-react";
import { useEstadoFiados, type Fiado } from "../estado/estadoFiados";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { cn } from "../utilidades/utils";
import ModalConfirmacion from "../componentes/ui/ModalConfirmacion";
import ModalPrompt from "../componentes/ui/ModalPrompt";
import ModalAviso from "../componentes/ui/ModalAviso";

function TarjetaDeudor({ deudor, setAviso }: { deudor: Fiado, setAviso: any }) {
  const { actualizarDeudor, eliminarDeudor } = useEstadoFiados();
  const { ventas } = useEstadoVentas();
  const { trabajadorActivo } = useEstadoTrabajadores();
  
  const [expandido, setExpandido] = useState(false);
  const [ticketExpandido, setTicketExpandido] = useState<string | null>(null);
  
  const [modalLiquidar, setModalLiquidar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalLimpieza, setModalLimpieza] = useState(false);
  const [promptAbono, setPromptAbono] = useState({ abierto: false, sugerido: "" });

  // ESTADOS DE EDICIÓN
  const [editando, setEditando] = useState(false);
  const [formEdicion, setFormEdicion] = useState({
    celular: deudor.celular,
    limiteCredito: deudor.limiteCredito?.toString() || "500",
    notas: deudor.notas
  });

  const [paginaTickets, setPaginaTickets] = useState(1);
  const [paginaAbonos, setPaginaAbonos] = useState(1);
  const elementosPorPagina = 5;

  const cajeroActual = trabajadorActivo?.nombre || "Cajero Desconocido";
  
  const ticketsDetallados = useMemo(() => {
    return deudor.tickets
      .map(ticketId => ventas.find(v => v.id === ticketId))
      .filter(Boolean)
      .sort((a, b) => new Date(a!.fecha).getTime() - new Date(b!.fecha).getTime());
  }, [deudor.tickets, ventas]);

  const historialAbonos = deudor.historialAbonos || [];
  const totalAbonado = historialAbonos.reduce((acc, a) => acc + a.monto, 0);

  const ticketsCalculados = useMemo(() => {
    let montoDisponible = totalAbonado;
    return ticketsDetallados.map(venta => {
      if (!venta) return null;
      let estado: "PAGADO" | "PARCIAL" | "PENDIENTE" = "PENDIENTE";
      let pagadoDeEsteTicket = 0;

      if (montoDisponible >= venta.total) {
        estado = "PAGADO";
        montoDisponible -= venta.total;
        pagadoDeEsteTicket = venta.total;
      } else if (montoDisponible > 0) {
        estado = "PARCIAL";
        pagadoDeEsteTicket = montoDisponible;
        montoDisponible = 0;
      }
      return { ...venta, estadoFiado: estado, pagado: pagadoDeEsteTicket };
    }).filter(Boolean).reverse(); 
  }, [ticketsDetallados, totalAbonado]);

  const totalPaginasTickets = Math.ceil(ticketsCalculados.length / elementosPorPagina) || 1;
  const ticketsMostrados = ticketsCalculados.slice((paginaTickets - 1) * elementosPorPagina, paginaTickets * elementosPorPagina);

  const abonosReversos = historialAbonos.slice().reverse();
  const totalPaginasAbonos = Math.ceil(abonosReversos.length / elementosPorPagina) || 1;
  const abonosMostrados = abonosReversos.slice((paginaAbonos - 1) * elementosPorPagina, paginaAbonos * elementosPorPagina);

  const limite = deudor.limiteCredito || 500;
  const porcentajeDeuda = (deudor.totalDeuda / limite) * 100;
  const estaAlLimite = porcentajeDeuda >= 100;
  const estaCercaLimite = porcentajeDeuda >= 80 && !estaAlLimite;

  const colorDeuda = estaAlLimite 
    ? "text-red-700 bg-red-100 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50" 
    : estaCercaLimite 
    ? "text-amber-700 bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50"
    : "text-emerald-700 bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";

  const guardarEdicion = async () => {
    await actualizarDeudor({
      ...deudor,
      celular: formEdicion.celular,
      limiteCredito: parseFloat(formEdicion.limiteCredito) || 500,
      notas: formEdicion.notas
    });
    setEditando(false);
    setAviso({ titulo: "Datos guardados", mensaje: "La información del cliente fue actualizada." });
  };

  const manejarAbono = async (montoStr: string) => {
    const monto = parseFloat(montoStr);
    if (isNaN(monto) || monto <= 0) {
      setAviso({ titulo: "Monto inválido", mensaje: "Ingresa una cantidad mayor a $0.00." });
      return;
    }
    if (monto > deudor.totalDeuda) {
      setAviso({ titulo: "Monto excedido", mensaje: `El abono ($${monto}) no puede ser mayor a la deuda total ($${deudor.totalDeuda}).` });
      return;
    }

    const nuevoAbono = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      monto,
      cajero: cajeroActual,
      tipo: "ABONO" as const
    };

    await actualizarDeudor({
      ...deudor,
      totalDeuda: deudor.totalDeuda - monto,
      historialAbonos: [...historialAbonos, nuevoAbono]
    });
    setPromptAbono({ abierto: false, sugerido: "" });
    setAviso({ titulo: "Abono registrado", mensaje: `Se abonaron $${monto.toFixed(2)} a la cuenta de ${deudor.nombre}.` });
  };

  const manejarLiquidacion = async () => {
    const nuevoAbono = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      monto: deudor.totalDeuda,
      cajero: cajeroActual,
      tipo: "LIQUIDACION" as const
    };

    await actualizarDeudor({
      ...deudor,
      totalDeuda: 0,
      historialAbonos: [...historialAbonos, nuevoAbono]
    });
    setModalLiquidar(false);
    setAviso({ titulo: "Deuda Liquidada", mensaje: `${deudor.nombre} ha liquidado su deuda por completo.` });
  };

  const limpiarHistorial = async (modo: "TODOS" | "MES_ANTERIOR") => {
    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);

    const ticketsA_Borrar = ticketsCalculados.filter(t => {
      if (!t || t.estadoFiado !== "PAGADO") return false;
      if (modo === "MES_ANTERIOR") return new Date(t.fecha) < haceUnMes;
      return true;
    });

    if (ticketsA_Borrar.length === 0) {
      setAviso({ titulo: "Sin cambios", mensaje: "No hay tickets liquidados que cumplan esta condición." });
      setModalLimpieza(false);
      return;
    }

    const idsABorrar = new Set(ticketsA_Borrar.map(t => t!.id));
    const ticketsMantenidos = ticketsCalculados.filter(t => t && !idsABorrar.has(t.id)).map(t => t!.id);
    const montoALimpiar = ticketsA_Borrar.reduce((acc, t) => acc + t!.total, 0);

    const nuevoAbonoRestante = totalAbonado - montoALimpiar;
    const nuevosAbonos = nuevoAbonoRestante > 0 
      ? [{ id: crypto.randomUUID(), fecha: new Date().toISOString(), monto: nuevoAbonoRestante, cajero: "Sistema (Ajuste por limpieza)", tipo: "ABONO" as const }] 
      : [];

    await actualizarDeudor({ ...deudor, tickets: ticketsMantenidos.reverse(), historialAbonos: nuevosAbonos });
    setAviso({ titulo: "Limpieza completada", mensaje: `Se borraron ${ticketsA_Borrar.length} tickets ya pagados del historial.` });
    setModalLimpieza(false);
    setPaginaTickets(1);
    setPaginaAbonos(1);
  };

  return (
    <div className={cn("efecto-cristal rounded-2xl border overflow-hidden shadow-sm transition-all bg-white/80 dark:bg-slate-900/80 mb-4", estaAlLimite ? "border-red-300 dark:border-red-900/50 ring-2 ring-red-500/20" : "border-slate-200/60 dark:border-white/10")}>
      
      <ModalConfirmacion 
        abierto={modalLiquidar}
        titulo="Liquidar Deuda"
        mensaje={`¿Confirmas que recibiste $${deudor.totalDeuda.toFixed(2)} en caja? La cuenta de ${deudor.nombre} quedará en ceros, pero mantendrá su historial de cliente.`}
        textoBoton="Sí, Liquidar"
        alConfirmar={manejarLiquidacion}
        alCerrar={() => setModalLiquidar(false)}
      />

      <ModalConfirmacion 
        abierto={modalEliminar}
        titulo="Eliminar Cliente"
        mensaje={deudor.totalDeuda > 0 
          ? `¡Atención! Este cliente aún debe $${deudor.totalDeuda.toFixed(2)}. Al eliminarlo, confirmas que recibiste el dinero o asumes la pérdida. Su registro desaparecerá por completo. ¿Estás seguro?`
          : `¿Estás seguro de eliminar a ${deudor.nombre} por completo? Se borrará todo su registro y no se podrá recuperar.`}
        textoBoton="Eliminar Definitivamente"
        alConfirmar={() => eliminarDeudor(deudor.id)}
        alCerrar={() => setModalEliminar(false)}
      />

      {modalLimpieza && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setModalLimpieza(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Eraser size={24} className="text-red-500" /> Limpiar Historial
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">¿Qué tickets liquidados deseas eliminar del registro visual para despejar la lista?</p>
            <div className="flex flex-col gap-2 mt-2">
              <button onClick={() => limpiarHistorial("TODOS")} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-xl font-bold text-sm transition-colors border border-red-200 dark:border-red-800/30">
                Borrar todos los ya pagados
              </button>
              <button onClick={() => limpiarHistorial("MES_ANTERIOR")} className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded-xl font-bold text-sm transition-colors border border-amber-200 dark:border-amber-800/30">
                Borrar solo si tienen +1 mes
              </button>
              <button onClick={() => setModalLimpieza(false)} className="w-full py-3 mt-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalPrompt
        abierto={promptAbono.abierto}
        titulo="Registrar Abono"
        mensaje={`Deuda actual: $${deudor.totalDeuda.toFixed(2)}. Ingresa el monto a abonar en caja:`}
        valorInicial={promptAbono.sugerido}
        placeholder="Ej: 150.50"
        alConfirmar={manejarAbono}
        alCerrar={() => setPromptAbono({ abierto: false, sugerido: "" })}
      />

      <div role="button" onClick={() => setExpandido(!expandido)} className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-4 flex-1 pr-3">
          <div className={cn("w-12 h-12 rounded-xl text-white flex shrink-0 items-center justify-center font-bold text-lg shadow-inner", estaAlLimite ? "bg-red-500" : "bg-slate-800 dark:bg-slate-700")}>
            {deudor.nombre.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg truncate leading-tight mb-1">{deudor.nombre}</h3>
            <div className="flex items-center gap-2">
              <span className={cn("px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide border", colorDeuda)}>
                ${deudor.totalDeuda.toFixed(2)}
              </span>
              {estaAlLimite && (
                <span title="Límite de crédito alcanzado" className="flex items-center cursor-help">
                  <AlertTriangle size={16} className="text-red-500 animate-pulse" />
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronDown size={22} className={cn("text-slate-400 transition-transform duration-300", expandido && "rotate-180")} />
      </div>

      {expandido && (
        <div className="border-t border-slate-200/50 dark:border-white/10 p-5 bg-white/40 dark:bg-black/20 animate-in fade-in slide-in-from-top-2">
          
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 dark:text-slate-300">Información del Cliente</h4>
            <button 
              onClick={() => {
                if(editando) {
                  setFormEdicion({celular: deudor.celular, limiteCredito: deudor.limiteCredito?.toString() || "500", notas: deudor.notas});
                }
                setEditando(!editando);
              }} 
              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
            >
              {editando ? <X size={16} /> : <Pencil size={16} />}
            </button>
          </div>

          {editando ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/50 dark:border-white/5 shadow-inner">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Celular</label>
                <input type="tel" value={formEdicion.celular} onChange={e => setFormEdicion({...formEdicion, celular: e.target.value.replace(/\D/g, '')})} maxLength={10} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Límite de Crédito Permitido</label>
                <input type="number" value={formEdicion.limiteCredito} onChange={e => setFormEdicion({...formEdicion, limiteCredito: e.target.value})} min="0" className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Notas</label>
                <textarea value={formEdicion.notas} onChange={e => setFormEdicion({...formEdicion, notas: e.target.value})} rows={2} className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none dark:text-white" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                <button onClick={() => setEditando(false)} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">Cancelar</button>
                <button onClick={guardarEdicion} className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-1.5"><Save size={14}/> Guardar Cambios</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{deudor.celular || "Sin celular"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                <AlertTriangle size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">Límite: ${limite}</span>
              </div>
              <div className="col-span-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                <FileText size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="italic line-clamp-3">{deudor.notas || "Sin notas adicionales."}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6">
            <button onClick={() => setModalEliminar(true)} className="flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors">
              <Trash2 size={16} /> Eliminar
            </button>
            <button onClick={() => setPromptAbono({ abierto: true, sugerido: "" })} disabled={deudor.totalDeuda <= 0} className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
              <HandCoins size={16} /> Abonar
            </button>
            <button onClick={() => setModalLiquidar(true)} disabled={deudor.totalDeuda <= 0} className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
              <CheckCircle size={16} /> Liquidar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* HISTORIAL TICKETS */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Receipt size={16} /> Tickets
                </h4>
                {ticketsCalculados.some(t => t?.estadoFiado === "PAGADO") && (
                  <button onClick={() => setModalLimpieza(true)} className="text-[11px] flex items-center gap-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold transition-colors bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-md">
                    <Eraser size={14} /> Limpiar pagados
                  </button>
                )}
              </div>
              
              <div className="min-h-[200px] max-h-[400px] overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-thin">
                {ticketsMostrados.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Sin tickets</p> : 
                  ticketsMostrados.map((venta) => {
                  if (!venta) return null;
                  const expandirItems = ticketExpandido === venta.id;
                  const esPagado = venta.estadoFiado === "PAGADO";
                  const faltante = venta.total - venta.pagado;
                  
                  return (
                    <div key={venta.id} className={cn("border rounded-xl overflow-hidden transition-colors", esPagado ? "border-l-4 border-l-red-500 border-y-red-200 border-r-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20 opacity-80" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950 shadow-sm")}>
                      <button onClick={() => setTicketExpandido(expandirItems ? null : venta.id)} className="w-full flex justify-between items-center p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <div className="flex flex-col items-start gap-1">
                          <span className={cn("font-bold text-sm flex items-center gap-1.5", esPagado ? "text-red-700 dark:text-red-400 line-through" : "text-slate-800 dark:text-slate-200")}>
                            {new Date(venta.fecha).toLocaleDateString("es-MX")}
                            {esPagado && <CheckCircle2 size={14} className="text-red-500" />}
                          </span>
                          {!esPagado && venta.estadoFiado === "PARCIAL" && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">Falta ${faltante.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("font-bold text-sm", esPagado ? "text-red-700 dark:text-red-400 line-through" : "text-amber-600 dark:text-amber-400")}>
                            ${venta.total.toFixed(2)}
                          </span>
                          <ChevronDown size={16} className={cn("text-slate-400 transition-transform", expandirItems && "rotate-180")} />
                        </div>
                      </button>

                      {expandirItems && (
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-3 border-t border-slate-100 dark:border-white/5 flex flex-col gap-2">
                          {venta.articulos.map((art, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                              <span className={cn("truncate pr-2", esPagado && "line-through opacity-70")}>{art.cantidad}x {art.nombre}</span>
                              <span className={cn("font-medium", esPagado && "line-through opacity-70")}>${art.subtotal.toFixed(2)}</span>
                            </div>
                          ))}
                          {!esPagado && (
                            <button onClick={() => setPromptAbono({ abierto: true, sugerido: faltante.toFixed(2) })} className="mt-3 w-full py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg text-xs font-bold transition-colors">
                              Abonar y liquidar compra (${faltante.toFixed(2)})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-between items-center mt-2 px-1 text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg py-1">
                <button onClick={() => setPaginaTickets(p => Math.max(1, p - 1))} disabled={paginaTickets === 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-colors"><ChevronLeft size={16}/></button>
                <span className="text-[11px] font-bold">Pág {paginaTickets} de {totalPaginasTickets}</span>
                <button onClick={() => setPaginaTickets(p => Math.min(totalPaginasTickets, p + 1))} disabled={paginaTickets === totalPaginasTickets} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-colors"><ChevronRight size={16}/></button>
              </div>
            </div>

            {/* HISTORIAL ABONOS */}
            <div className="flex flex-col gap-2">
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                <ArrowDownToLine size={16} /> Pagos e Historial
              </h4>
              <div className="flex flex-col gap-2.5 min-h-[200px] max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                {abonosMostrados.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Sin pagos registrados</p> : 
                  abonosMostrados.map((abono) => (
                    <div key={abono.id} className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl flex justify-between items-center shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          {abono.tipo === "LIQUIDACION" ? "Liquidación Total" : "Abono"}
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5">
                          {new Date(abono.fecha).toLocaleDateString("es-MX")} • C: {abono.cajero.split(" ")[0]}
                        </span>
                      </div>
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        +${abono.monto.toFixed(2)}
                      </span>
                    </div>
                  ))
                }
              </div>
              
              <div className="flex justify-between items-center mt-2 px-1 text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-lg py-1">
                <button onClick={() => setPaginaAbonos(p => Math.max(1, p - 1))} disabled={paginaAbonos === 1} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-colors"><ChevronLeft size={16}/></button>
                <span className="text-[11px] font-bold">Pág {paginaAbonos} de {totalPaginasAbonos}</span>
                <button onClick={() => setPaginaAbonos(p => Math.min(totalPaginasAbonos, p + 1))} disabled={paginaAbonos === totalPaginasAbonos} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md disabled:opacity-30 transition-colors"><ChevronRight size={16}/></button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function ModalNuevoDeudor({ abierto, alCerrar, alGuardar }: { abierto: boolean, alCerrar: () => void, alGuardar: (d: any) => Promise<boolean> }) {
  const [formulario, setFormulario] = useState({ nombre: "", celular: "", notas: "", limiteCredito: "500" });

  useEffect(() => {
    if (abierto) {
      setFormulario({ nombre: "", celular: "", notas: "", limiteCredito: "500" });
    }
  }, [abierto]);

  if (!abierto) return null;

  const procesarGuardado = async () => {
    const exito = await alGuardar(formulario);
    if (exito) alCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in" onClick={alCerrar}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <BookUser size={20} className="text-amber-500" /> Nuevo Cliente
        </h2>
        
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nombre Completo *</label>
            <input type="text" value={formulario.nombre} onChange={e => setFormulario({...formulario, nombre: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Celular (10 dígitos)</label>
            <input type="tel" maxLength={10} value={formulario.celular} onChange={e => setFormulario({...formulario, celular: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" placeholder="Ej: 5512345678" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Límite de Crédito Permitido ($)</label>
            <input type="number" min="0" value={formulario.limiteCredito} onChange={e => setFormulario({...formulario, limiteCredito: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Notas (Opcional)</label>
            <textarea value={formulario.notas} onChange={e => setFormulario({...formulario, notas: e.target.value})} rows={2} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button onClick={alCerrar} className="flex-1 py-2.5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
          <button onClick={procesarGuardado} disabled={!formulario.nombre.trim()} className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-colors disabled:opacity-50">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function VistaFiados() {
  const { deudores, agregarDeudor } = useEstadoFiados();
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 5;

  const deudoresFiltrados = deudores.filter(d => 
    d.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    d.celular.includes(busqueda)
  );

  useEffect(() => { setPaginaActual(1); }, [busqueda]);

  const totalPaginas = Math.ceil(deudoresFiltrados.length / elementosPorPagina) || 1;
  const deudoresPaginados = deudoresFiltrados.slice((paginaActual - 1) * elementosPorPagina, paginaActual * elementosPorPagina);

  const deudaTotalGlobal = deudores.reduce((acc, curr) => acc + curr.totalDeuda, 0);

  const manejarNuevoDeudor = async (datos: any) => {
    if (deudores.some(d => d.nombre.trim().toLowerCase() === datos.nombre.trim().toLowerCase())) {
      setAviso({ titulo: "Nombre duplicado", mensaje: "Ya existe un cliente registrado con este nombre." });
      return false;
    }
    if (datos.celular && datos.celular.length !== 10) {
      setAviso({ titulo: "Celular inválido", mensaje: "El número de celular debe tener exactamente 10 dígitos." });
      return false;
    }

    await agregarDeudor({
      id: crypto.randomUUID(),
      nombre: datos.nombre.trim(),
      celular: datos.celular.trim(),
      notas: datos.notas.trim(),
      tickets: [],
      totalDeuda: 0,
      limiteCredito: parseFloat(datos.limiteCredito) || 500,
      fechaCreacion: new Date().toISOString(),
      historialAbonos: []
    });
    setAviso({ titulo: "Cliente Registrado", mensaje: `${datos.nombre} agregado correctamente a la libreta.` });
    return true;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso abierto={Boolean(aviso)} titulo={aviso?.titulo ?? ""} mensaje={aviso?.mensaje ?? ""} tipo="info" alCerrar={() => setAviso(null)} />
      <ModalNuevoDeudor abierto={modalNuevoAbierto} alCerrar={() => setModalNuevoAbierto(false)} alGuardar={manejarNuevoDeudor} />

      <div className="mb-5 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-2xl border border-blue-200 dark:border-blue-800/30 shadow-sm">
        <AlertTriangle size={24} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="flex flex-col">
          <strong className="text-sm font-bold">Información Estrictamente Local</strong>
          <p className="text-xs mt-1 leading-relaxed opacity-90">
            Esta libreta se guarda <strong>únicamente en este equipo o navegador</strong>. No se sincroniza en la nube por privacidad de tus clientes.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400">
              <BookUser size={24} />
            </div>
            Libreta de Fiados
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Administra los créditos locales y abonos de tus clientes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setModalNuevoAbierto(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-md">
            <BookUser size={18} /> Nuevo Cliente
          </button>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-2.5 shadow-sm text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Deuda Global</span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">${deudaTotalGlobal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nombre o celular..." 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-slate-100 shadow-sm"
        />
      </div>

      <div className="flex flex-col gap-4 max-w-4xl pb-4">
        {deudoresFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-white/50 dark:bg-slate-900/30 rounded-3xl border border-slate-200/50 dark:border-white/5">
            <BookUser size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No hay deudores registrados.</p>
          </div>
        ) : (
          deudoresPaginados.map((deudor) => (
            <TarjetaDeudor key={deudor.id} deudor={deudor} setAviso={setAviso} />
          ))
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="max-w-4xl flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl mt-2 pb-6">
          <button 
            onClick={() => setPaginaActual(p => Math.max(1, p - 1))} 
            disabled={paginaActual === 1}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
            Página {paginaActual} de {totalPaginas}
          </span>
          <button 
            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} 
            disabled={paginaActual === totalPaginas}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

    </div>
  );
}