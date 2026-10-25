// Coordenada: src/vistas/VistaCorteCaja.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoCaja, type TurnoCaja } from "../estado/estadoCaja";
import { Wallet, CheckCircle, FileText, DollarSign, Save, Clock, Lock, MessageSquare, PlusCircle, TrendingUp, AlertTriangle, KeyRound, Loader2, CreditCard, Banknote, HelpCircle, Ban, Calendar, HandCoins, Power, X } from "lucide-react";
import { cn } from "../utilidades/utils";
import ModalConfirmacionPin from "../componentes/ui/ModalConfirmacionPin";
import AyudaContextual from "../componentes/ui/AyudaContextual";
import CampoFecha from "../componentes/ui/CampoFecha";

// Helper para obtener la fecha local correctamente
const obtenerFechaLocal = () => {
  const fecha = new Date();
  const offset = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 10);
};

export default function VistaCorteCaja() {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { ventas } = useEstadoVentas();
  
  const { 
    fondoBaseActual, notaGeneralDueno, turnos, controlTurnosHabilitado, forzarRecepcionCaja, requerirPinCancelacion, cargando,
    cargarCaja, actualizarConfiguracion, setControlTurnosHabilitado, abrirTurno, cerrarTurno, obtenerTurnoActivo 
  } = useEstadoCaja();

  const [inputFondo, setInputFondo] = useState<number | "">(fondoBaseActual);
  const [inputNotaGeneral, setInputNotaGeneral] = useState<string>(notaGeneralDueno);
  const [inputForzar, setInputForzar] = useState<boolean>(forzarRecepcionCaja);
  const [inputRequerir, setInputRequerir] = useState<boolean>(requerirPinCancelacion);
  const [ajustesGuardados, setAjustesGuardados] = useState(false);

  const [fondoDejado, setFondoDejado] = useState<number | "">("");
  const [notaCierre, setNotaCierre] = useState<string>("");
  const [modoCierre, setModoCierre] = useState(false);
  const [doblarTurno, setDoblarTurno] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);
  const [turnoParaCerrar, setTurnoParaCerrar] = useState<TurnoCaja | null>(null);
  const [fondoCierreAdmin, setFondoCierreAdmin] = useState<number | "">("");
  const [notaCierreAdmin, setNotaCierreAdmin] = useState("");
  const [errorCierreAdmin, setErrorCierreAdmin] = useState("");
  const [cerrandoTurnoAdmin, setCerrandoTurnoAdmin] = useState(false);
  
  // NUEVO: Estado para el filtro del calendario (inicia en hoy)
  const [fechaFiltro, setFechaFiltro] = useState(obtenerFechaLocal());

  useEffect(() => {
    cargarCaja();
  }, [cargarCaja]);

  useEffect(() => {
    setInputFondo(fondoBaseActual);
    setInputNotaGeneral(notaGeneralDueno);
    setInputForzar(forzarRecepcionCaja);
    setInputRequerir(requerirPinCancelacion);
  }, [fondoBaseActual, notaGeneralDueno, forzarRecepcionCaja, requerirPinCancelacion]);

  const esDueñoOSupervisor = trabajadorActivo?.rol === "DUENO" || trabajadorActivo?.rol === "SUPERVISOR";
  const turnoActivo = trabajadorActivo ? obtenerTurnoActivo(trabajadorActivo.id) : undefined;
  
  const esMismoDia = (fechaISO: string) => {
    if (!fechaISO) return false;
    const f = new Date(fechaISO);
    const hoy = new Date();
    return f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
  };

  // NUEVO FILTRO: Muestra los turnos basados en la fecha seleccionada en el calendario
  const turnosFiltrados = useMemo(() => {
    return turnos.filter(t => {
      const fechaInicioISO = t.fechaInicio.slice(0, 10);
      const fechaFinISO = t.fechaFin ? t.fechaFin.slice(0, 10) : null;
      
      if (fechaFiltro === obtenerFechaLocal()) {
         return t.estatus === "ABIERTO" || fechaInicioISO === fechaFiltro || fechaFinISO === fechaFiltro;
      }
      return fechaInicioISO === fechaFiltro || fechaFinISO === fechaFiltro;
    });
  }, [turnos, fechaFiltro]);

  const turnoCerradoHoy = useMemo(() => {
    return turnos.find(t => t.trabajadorId === trabajadorActivo?.id && t.estatus === "CERRADO" && esMismoDia(t.fechaFin || ""));
  }, [turnos, trabajadorActivo]);

  const manejarGuardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    await actualizarConfiguracion(Number(inputFondo), inputNotaGeneral, inputForzar, inputRequerir);
    setAjustesGuardados(true);
    setTimeout(() => setAjustesGuardados(false), 2000);
  };

  const manejarToggleControlTurnos = async () => {
    const nuevoEstado = !controlTurnosHabilitado;
    setInputForzar(nuevoEstado);
    await setControlTurnosHabilitado(nuevoEstado);
  };

  const calcularMetricasDeVentas = (nombreTrabajador: string, fechaInicio: string, fechaFin?: string | null) => {
    const ventasDelTurno = ventas.filter(v => 
      v.trabajador === nombreTrabajador && 
      v.fecha >= fechaInicio && 
      (!fechaFin || v.fecha <= fechaFin)
    );

    const ventasValidas = ventasDelTurno.filter(v => !v.cancelada);
    const ventasCanceladas = ventasDelTurno.filter(v => v.cancelada);

    const totalVendido = ventasValidas.reduce((acc, v) => acc + (v.total || 0), 0);
    const totalEfectivo = ventasValidas.filter(v => v.metodoPago === "EFECTIVO").reduce((acc, v) => acc + (v.total || 0), 0);
    const totalElectronico = ventasValidas.filter(v => v.metodoPago === "TARJETA" || v.metodoPago === "TRANSFERENCIA").reduce((acc, v) => acc + (v.total || 0), 0);
    const totalFiado = ventasValidas.filter(v => v.metodoPago === "FIADO").reduce((acc, v) => acc + (v.total || 0), 0);

    const articulosAutorizados = ventasValidas.flatMap(v => (v.articulos || []).filter(a => a.autorizacion_confirmada));
    const totalAutorizado = articulosAutorizados.reduce((acc, a) => acc + (a.subtotal || 0), 0);

    return { 
      totalVendido, totalEfectivo, totalElectronico, totalFiado,
      cantAutorizaciones: articulosAutorizados.length, totalAutorizado,
      cantCancelaciones: ventasCanceladas.length,
      totalCancelado: ventasCanceladas.reduce((acc, v) => acc + (v.total || 0), 0)
    };
  };

  const ventasTotalesHoy = useMemo(() => {
    // Calculamos las ventas totales en base a la FECHA SELECCIONADA en el calendario
    const ventasDiaValidas = ventas.filter(v => v.fecha.slice(0, 10) === fechaFiltro && !v.cancelada);
    const total = ventasDiaValidas.reduce((acc, v) => acc + (v.total || 0), 0);
    const efectivo = ventasDiaValidas.filter(v => v.metodoPago === "EFECTIVO").reduce((acc, v) => acc + (v.total || 0), 0);
    const electronico = ventasDiaValidas.filter(v => v.metodoPago === "TARJETA" || v.metodoPago === "TRANSFERENCIA").reduce((acc, v) => acc + (v.total || 0), 0);
    const fiado = ventasDiaValidas.filter(v => v.metodoPago === "FIADO").reduce((acc, v) => acc + (v.total || 0), 0);
    return { total, efectivo, electronico, fiado };
  }, [ventas, fechaFiltro]);

  const manejarAbrirTurno = async () => {
    if (!trabajadorActivo) return;
    await abrirTurno(trabajadorActivo.id, trabajadorActivo.nombre, fondoBaseActual);
    setDoblarTurno(false);
  };

  const metricasTurnoActivo = useMemo(() => {
    if (!turnoActivo) return { totalVendido: 0, totalEfectivo: 0, totalElectronico: 0, totalFiado: 0, cantAutorizaciones: 0, totalAutorizado: 0, cantCancelaciones: 0, totalCancelado: 0 };
    return calcularMetricasDeVentas(turnoActivo.nombreTrabajador, turnoActivo.fechaInicio, turnoActivo.fechaFin);
  }, [turnoActivo, ventas]);

  const manejarCerrarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trabajadorActivo || !turnoActivo || fondoDejado === "") return;
    
    await cerrarTurno(
      turnoActivo.id, 
      Number(fondoDejado), 
      metricasTurnoActivo.totalVendido, 
      notaCierre,
      metricasTurnoActivo.totalEfectivo, 
      metricasTurnoActivo.totalElectronico,
      false,
      undefined,
      trabajadorActivo.nombre
    );
    
    setModoCierre(false);
    setFondoDejado("");
    setNotaCierre("");
  };

  const abrirCierreAdministrativo = (turno: TurnoCaja) => {
    setTurnoParaCerrar(turno);
    setFondoCierreAdmin("");
    setNotaCierreAdmin("");
    setErrorCierreAdmin("");
  };

  const manejarCerrarTurnoAdministrativamente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esDueñoOSupervisor || !trabajadorActivo || !turnoParaCerrar || fondoCierreAdmin === "") return;
    if (!turnos.some((turno) => turno.id === turnoParaCerrar.id && turno.estatus === "ABIERTO")) {
      setErrorCierreAdmin("Este turno ya fue cerrado. Actualiza el historial antes de continuar.");
      return;
    }

    const nombreCerrador = trabajadorActivo.nombre;
    setCerrandoTurnoAdmin(true);
    setErrorCierreAdmin("");
    const metricas = calcularMetricasDeVentas(turnoParaCerrar.nombreTrabajador, turnoParaCerrar.fechaInicio, turnoParaCerrar.fechaFin);
    try {
      await cerrarTurno(
        turnoParaCerrar.id,
        Number(fondoCierreAdmin),
        metricas.totalVendido,
        notaCierreAdmin,
        metricas.totalEfectivo,
        metricas.totalElectronico,
        false,
        undefined,
        nombreCerrador
      );
      setTurnoParaCerrar(null);
      setFondoCierreAdmin("");
      setNotaCierreAdmin("");
    } catch (error: unknown) {
      console.error("No se pudo cerrar el turno desde administración:", error);
      setErrorCierreAdmin(error instanceof Error ? error.message : "No se pudo registrar el cierre. Inténtalo de nuevo.");
    } finally {
      setCerrandoTurnoAdmin(false);
    }
  };

  if (!trabajadorActivo) return null;

  if (cargando) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
        <p className="font-bold text-slate-500 dark:text-slate-400">Cargando información de caja...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 p-4 lg:p-6 overflow-y-auto animate-in fade-in duration-300">
      <ModalConfirmacionPin
        abierto={modalPinAbierto}
        titulo="Confirma tu Fondo"
        mensaje={`Por favor, ingresa tu PIN para confirmar que estás recibiendo la cantidad de $${fondoBaseActual.toFixed(2)} en tu caja para iniciar el turno.`}
        labelPin="Ingresa tu PIN de acceso"
        alConfirmar={() => {
          manejarAbrirTurno();
          setModalPinAbierto(false);
        }}
        alCerrar={() => setModalPinAbierto(false)}
      />

      {turnoParaCerrar && esDueñoOSupervisor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cierre-administrativo"
            className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
              <div>
                <h2 id="titulo-cierre-administrativo" className="text-xl font-bold text-slate-900 dark:text-white">
                  Cerrar turno de {turnoParaCerrar.nombreTrabajador}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  El cierre quedará registrado a nombre de {trabajadorActivo.nombre}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTurnoParaCerrar(null)}
                aria-label="Cancelar cierre"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={manejarCerrarTurnoAdministrativamente} className="flex flex-col gap-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                Cuenta el efectivo físico de la caja. El esperado incluye el fondo inicial y las ventas en efectivo del turno.
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
                  <span className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Efectivo esperado</span>
                  <strong className="mt-1 block text-xl text-slate-900 dark:text-white">
                    ${(turnoParaCerrar.fondoInicial + calcularMetricasDeVentas(turnoParaCerrar.nombreTrabajador, turnoParaCerrar.fechaInicio, turnoParaCerrar.fechaFin).totalEfectivo).toFixed(2)}
                  </strong>
                </div>
                <div>
                  <label htmlFor="fondo-cierre-admin" className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                    Efectivo contado / dejado *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input
                      id="fondo-cierre-admin"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      autoFocus
                      value={fondoCierreAdmin}
                      onChange={(e) => setFondoCierreAdmin(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-8 pr-3 font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="nota-cierre-admin" className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                  Notas para el dueño
                </label>
                <textarea
                  id="nota-cierre-admin"
                  value={notaCierreAdmin}
                  onChange={(e) => setNotaCierreAdmin(e.target.value)}
                  placeholder="Diferencias de efectivo, retiros u observaciones del cierre..."
                  className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
                />
              </div>
              {errorCierreAdmin && (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  {errorCierreAdmin}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-white/10 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setTurnoParaCerrar(null)}
                  disabled={cerrandoTurnoAdmin}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={fondoCierreAdmin === "" || cerrandoTurnoAdmin}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  {cerrandoTurnoAdmin ? "Registrando..." : "Confirmar cierre"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className="mb-2 border-b border-slate-200/50 dark:border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Wallet size={24} />
              </div>
              Corte de Caja y Turnos
            </h1>
            <AyudaContextual etiqueta="Corte de caja y turnos" texto="Consulta las ventas y métodos de pago, configura el fondo base y administra los turnos. El personal abre su caja al iniciar y registra su declaración de cierre al terminar; dueños y supervisores pueden revisar los cortes y notas." />
          </div>
          {esDueñoOSupervisor && (
            <button
              type="button"
              onClick={manejarToggleControlTurnos}
              aria-pressed={controlTurnosHabilitado}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors",
                controlTurnosHabilitado
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              <Power size={16} />
              {controlTurnosHabilitado ? "Deshabilitar control de turnos" : "Habilitar control de turnos"}
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {esDueñoOSupervisor ? "Audita los cortes, configura el fondo de caja y revisa las notas de tus trabajadores." : "Abre tu caja, revisa tus métricas y declara el cierre al finalizar tu horario."}
        </p>
        <div className={cn(
          "mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wide",
          controlTurnosHabilitado
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400"
            : "border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
        )}>
          <span className={cn("h-2 w-2 rounded-full", controlTurnosHabilitado ? "bg-emerald-500" : "bg-slate-400")} />
          {controlTurnosHabilitado ? "Sección de turnos habilitada" : "Sección de turnos deshabilitada"}
        </div>
      </div>

      {esDueñoOSupervisor ? (
        <div className="flex flex-col gap-6 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="efecto-cristal p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-4 bg-emerald-50/30 dark:bg-emerald-900/10">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><TrendingUp size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Ventas Globales ({fechaFiltro === obtenerFechaLocal() ? "Hoy" : "Día Seleccionado"})</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">${ventasTotalesHoy.total.toFixed(2)}</p>
              </div>
            </div>
            <div className="efecto-cristal p-5 rounded-2xl border border-green-200 dark:border-green-900/30 flex items-center gap-4 bg-green-50/30 dark:bg-green-900/10">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400"><Banknote size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Total Efectivo</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">${ventasTotalesHoy.efectivo.toFixed(2)}</p>
              </div>
            </div>
            <div className="efecto-cristal p-5 rounded-2xl border border-blue-200 dark:border-blue-900/30 flex items-center gap-4 bg-blue-50/30 dark:bg-blue-900/10">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400"><CreditCard size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Total Tarj/Trans</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">${ventasTotalesHoy.electronico.toFixed(2)}</p>
              </div>
            </div>
            <div className="efecto-cristal p-5 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex items-center gap-4 bg-amber-50/30 dark:bg-amber-900/10">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400"><HandCoins size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Total Fiado</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">${ventasTotalesHoy.fiado.toFixed(2)}</p>
              </div>
            </div>
            <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400"><DollarSign size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Fondo Base Activo</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">${fondoBaseActual.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
            <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <Lock size={18} className="text-slate-400" /> Configuración de Turnos
              </h2>
              
              <form onSubmit={manejarGuardarConfiguracion} className="flex flex-col gap-4">
                <fieldset disabled={!controlTurnosHabilitado} className={cn("flex flex-col gap-4 transition-opacity", !controlTurnosHabilitado && "opacity-40")}>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Fondo Base Actual</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" min="0" step="1" required value={inputFondo} onChange={(e) => setInputFondo(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 font-bold" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Aviso para trabajadores</label>
                  <textarea value={inputNotaGeneral} onChange={(e) => setInputNotaGeneral(e.target.value)} rows={3} placeholder="Aviso visible al abrir turno..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none" />
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-white/5">
                    <input type="checkbox" checked={inputForzar} onChange={(e) => setInputForzar(e.target.checked)} className="w-5 h-5 accent-emerald-600 rounded" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Exigir confirmación para cobrar</span>
                      <span className="text-[10px] text-slate-500">Bloquea el POS hasta que confirmen el fondo.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-white/5">
                    <input type="checkbox" checked={inputRequerir} onChange={(e) => setInputRequerir(e.target.checked)} className="w-5 h-5 accent-emerald-600 rounded" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Restringir Cancelaciones</span>
                      <span className="text-[10px] text-slate-500">Solicitar PIN de Dueño para eliminar productos.</span>
                    </div>
                  </label>
                </div>
                <button type="submit" className="mt-2 self-end inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/20">
                  {ajustesGuardados ? <CheckCircle size={16} /> : <Save size={16} />}
                  {ajustesGuardados ? "Actualizado" : "Guardar Cambios"}
                </button>
                </fieldset>
              </form>
            </div>

            <div className="efecto-cristal p-4 sm:p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col h-full max-h-[600px]">
              <div className="border-b border-slate-200 dark:border-white/10 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" /> Historial de Turnos
                </h2>
                
                {/* CALENDARIO AGREGADO AQUÍ */}
                <label className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-black/30 dark:text-slate-300 shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-black/50 transition-colors">
                  <Calendar size={15} className="text-emerald-600" />
                  <CampoFecha value={fechaFiltro} onChange={setFechaFiltro} className="h-8 border-0 bg-transparent px-1 dark:bg-transparent" aria-label="Fecha del corte de caja" />
                </label>
              </div>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                {turnosFiltrados.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay turnos para la fecha seleccionada.</p>
                ) : (
                  turnosFiltrados.map((turno) => {
                    const mets = calcularMetricasDeVentas(turno.nombreTrabajador, turno.fechaInicio, turno.fechaFin);
                    
                    return (
                    <div key={turno.id} className="flex flex-col p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{turno.nombreTrabajador}</span>
                          <div className="text-xs text-slate-500 mt-0.5 font-medium flex flex-col sm:flex-row sm:flex-wrap gap-x-2">
                            <span>Inició: {new Date(turno.fechaInicio).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {turno.estatus === "CERRADO" && turno.fechaFin && (
                              <span><span className="hidden sm:inline">• </span>Cerró: {new Date(turno.fechaFin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className={cn("text-[10px] px-2 py-1 rounded-md font-bold uppercase", turno.estatus === "ABIERTO" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                            {turno.estatus}
                          </span>
                          {turno.estatus === "ABIERTO" && (
                            <button
                              type="button"
                              onClick={() => abrirCierreAdministrativo(turno)}
                              className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
                            >
                              Cerrar turno
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
                        <div className="min-w-0 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5">Fondo Inicial:</span> 
                          <strong className="text-slate-700 dark:text-slate-300 text-sm">${turno.fondoInicial.toFixed(2)}</strong>
                        </div>
                        <div className="min-w-0 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5 text-[10px]">Ventas Efectivo:</span> 
                          <strong className="text-green-600 dark:text-green-400 text-sm">${mets.totalEfectivo.toFixed(2)}</strong>
                        </div>
                        <div className="min-w-0 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5 text-[10px]">Tarj/Trans:</span> 
                          <strong className="text-blue-600 dark:text-blue-400 text-sm">${mets.totalElectronico.toFixed(2)}</strong>
                        </div>
                        <div className="min-w-0 bg-white dark:bg-slate-950 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
                          <span className="text-amber-600 dark:text-amber-400 block mb-0.5 text-[10px]">Fiados:</span>
                          <strong className="text-amber-700 dark:text-amber-300 text-sm">${mets.totalFiado.toFixed(2)}</strong>
                        </div>
                        <div className="min-w-0 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5 text-[10px]">Canceladas:</span> 
                          <strong className="text-red-500 dark:text-red-400 text-sm">{mets.cantCancelaciones}</strong>
                        </div>
                        <div className="min-w-0 bg-white dark:bg-slate-950 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                          <span className="text-emerald-700 dark:text-emerald-400 block mb-0.5 font-bold">Total Sistema:</span> 
                          <strong className="text-emerald-600 dark:text-emerald-400 text-sm">${turno.ventasCalculadas?.toFixed(2) || mets.totalVendido.toFixed(2)}</strong>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mt-1 px-1">
                          {turno.cerradoPor && (
                            <span className="text-xs text-slate-500 font-medium">
                              Cerrado por: <strong className="text-slate-700 dark:text-slate-300">{turno.cerradoPor}</strong>
                            </span>
                          )}
                          <span className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-1">
                            <HelpCircle size={12} /> Efectivo Esperado en Caja: 
                            <span className="font-bold text-slate-700 dark:text-slate-300">${(turno.fondoInicial + mets.totalEfectivo).toFixed(2)}</span>
                          </span>
                          <span className="text-xs text-slate-500 font-medium">Fondo Dejado Físicamente: <strong className="text-slate-900 dark:text-white">${turno.fondoDejado?.toFixed(2) || "---"}</strong></span>
                      </div>

                      {turno.notaTrabajador && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex gap-2 items-start border border-amber-100 dark:border-amber-800/30">
                          <MessageSquare size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Notas para el dueño:</span>
                            <p className="leading-relaxed">{turno.notaTrabajador}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )})
                )}
              </div>
            </div>
          </div>
        </div>

      ) : (
        <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
          {!turnoActivo && turnoCerradoHoy && !doblarTurno ? (
            <div className="efecto-cristal p-8 rounded-3xl border border-slate-200 dark:border-white/10 flex flex-col items-center text-center gap-4 bg-white dark:bg-slate-900 mx-auto max-w-lg mt-8 shadow-sm animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Turno Finalizado</h2>
              <p className="text-slate-600 dark:text-slate-400">Gracias por tu trabajo hoy. Tu corte de caja ha sido registrado exitosamente y está listo para la revisión del administrador.</p>
              
              <button onClick={() => setDoblarTurno(true)} className="mt-6 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10 text-xs">
                <PlusCircle size={16} /> Doblar Turno (Abrir nueva caja)
              </button>
            </div>
          ) : !turnoActivo ? (
             <div className="efecto-cristal p-8 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col items-center text-center gap-4 bg-emerald-50/50 dark:bg-emerald-950/20 mx-auto max-w-lg mt-8 animate-in fade-in">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                <Wallet size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¡Bienvenido a tu turno!</h2>
              <p className="text-slate-600 dark:text-slate-300">Para comenzar a cobrar, debes abrir tu caja recibiendo el fondo asignado por administración.</p>
              
              <div className="w-full bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 my-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fondo a recibir en caja</p>
                <p className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">${fondoBaseActual.toFixed(2)}</p>
              </div>

              <button onClick={() => setModalPinAbierto(true)} className="w-full mt-2 py-4 rounded-2xl font-bold flex justify-center items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/30 hover:scale-[1.02] transition-all text-lg">
                <KeyRound size={24} /> Aceptar Fondo con PIN
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={14}/> Turno Activo</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">Iniciado: {new Date(turnoActivo.fechaInicio).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!modoCierre && (
                  <button onClick={() => setModoCierre(true)} className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl font-bold text-sm transition-colors border border-red-100 dark:border-red-900/30">
                    Cerrar Turno
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                <div className="efecto-cristal p-4 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Wallet size={16} /> <h3 className="text-xs font-bold">Fondo Recibido</h3>
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-auto">${turnoActivo.fondoInicial.toFixed(2)}</p>
                </div>

                <div className="efecto-cristal p-4 rounded-2xl border border-green-200 dark:border-green-900/30 flex flex-col gap-2 bg-green-50/30 dark:bg-green-900/10">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-500">
                    <Banknote size={16} /> <h3 className="text-xs font-bold">Ventas Efectivo</h3>
                  </div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-auto">${metricasTurnoActivo.totalEfectivo.toFixed(2)}</p>
                </div>

                <div className="efecto-cristal p-4 rounded-2xl border border-blue-200 dark:border-blue-900/30 flex flex-col gap-2 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-500">
                    <CreditCard size={16} /> <h3 className="text-xs font-bold">Tarj/Transf.</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-auto">${metricasTurnoActivo.totalElectronico.toFixed(2)}</p>
                </div>

                <div className="efecto-cristal p-4 rounded-2xl border border-amber-200 dark:border-amber-900/30 flex flex-col gap-2 bg-amber-50/30 dark:bg-amber-900/10">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <HandCoins size={16} /> <h3 className="text-xs font-bold">Fiados</h3>
                  </div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-auto">${metricasTurnoActivo.totalFiado.toFixed(2)}</p>
                </div>

                <div className="efecto-cristal p-4 rounded-2xl border border-red-200 dark:border-red-900/30 flex flex-col gap-2 bg-red-50/30 dark:bg-red-900/10">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-500">
                    <Ban size={16} /> <h3 className="text-xs font-bold">Cancelaciones</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metricasTurnoActivo.cantCancelaciones}</p>
                    <p className="text-[10px] text-red-700/60 dark:text-red-400/60 leading-tight">Valor: ${metricasTurnoActivo.totalCancelado.toFixed(2)}</p>
                  </div>
                </div>

                <div className="lg:col-span-2 efecto-cristal p-4 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 flex flex-col gap-2 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                    <DollarSign size={16} /> <h3 className="text-xs font-bold">Efectivo Esperado en Caja</h3>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-auto">${(turnoActivo.fondoInicial + metricasTurnoActivo.totalEfectivo).toFixed(2)}</p>
                  <span className="text-[10px] text-emerald-700/60 dark:text-emerald-400/60 leading-tight">Fondo + ventas en efectivo; no incluye ventas fiadas</span>
                </div>
              </div>

              {modoCierre && (
                <div className="efecto-cristal p-8 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col gap-6 bg-white dark:bg-slate-900 mt-4 shadow-xl animate-in slide-in-from-bottom-4">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-4">Declaración de Cierre</h2>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-4 rounded-xl flex gap-3 text-amber-800 dark:text-amber-300 text-sm mb-2">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p>Cuenta el dinero físico en tu caja. En el campo de abajo, escribe <strong>únicamente</strong> el dinero que estás dejando físicamente (esto incluye tu fondo + tus ventas en efectivo, menos retiros si los hubo).</p>
                  </div>

                  <form onSubmit={manejarCerrarTurno} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Dinero físico (Efectivo) en caja *</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
                        <input type="number" step="0.01" min="0" required autoFocus value={fondoDejado} onChange={(e) => setFondoDejado(e.target.value ? Number(e.target.value) : "")} className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-white/10 rounded-2xl pl-10 pr-4 py-4 outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-slate-100 font-bold text-2xl" placeholder="0.00" />
                      </div>
                    </div>

                    <div className="flex flex-col h-full">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                        Notas Adicionales
                        <span className="text-xs font-normal text-slate-400 flex items-center gap-1"><Lock size={12}/> Confidencial (Dueño)</span>
                      </label>
                      <textarea value={notaCierre} onChange={(e) => setNotaCierre(e.target.value)} placeholder="Justificación de sobrantes/faltantes, pagos a proveedores..." className="w-full h-full min-h-[100px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none" />
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                      <button type="button" onClick={() => setModoCierre(false)} className="px-6 py-3 rounded-xl border border-slate-200 dark:border-white/10 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        Cancelar
                      </button>
                      <button type="submit" disabled={fondoDejado === ""} className="px-8 py-3 rounded-xl font-bold flex justify-center items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={18} /> Confirmar Cierre
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}