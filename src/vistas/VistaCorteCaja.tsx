// src/vistas/VistaCorteCaja.tsx
import React, { useMemo, useState } from "react";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoCaja } from "../estado/estadoCaja";
import { Wallet, CheckCircle, ShieldCheck, Ban, FileText, DollarSign, Save, Clock, Lock, MessageSquare, PlusCircle, TrendingUp, AlertTriangle, KeyRound } from "lucide-react";
import { cn } from "../utilidades/utils";
import ModalConfirmacionPin from "../componentes/ui/ModalConfirmacionPin";

export default function VistaCorteCaja() {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { ventas } = useEstadoVentas();
  const { 
    fondoBaseActual, notaGeneralDueno, turnos, forzarRecepcionCaja, // <-- Estado nuevo
    actualizarConfiguracion, abrirTurno, cerrarTurno, obtenerTurnoActivo, setForzarRecepcionCaja // <-- Action nueva
  } = useEstadoCaja();

  // Estados Dueño
  const [inputFondo, setInputFondo] = useState<number>(fondoBaseActual);
  const [inputNotaGeneral, setInputNotaGeneral] = useState<string>(notaGeneralDueno);
  const [ajustesGuardados, setAjustesGuardados] = useState(false);

  // Estados Trabajador
  const [fondoDejado, setFondoDejado] = useState<number | "">("");
  const [notaCierre, setNotaCierre] = useState<string>("");
  const [modoCierre, setModoCierre] = useState(false);
  const [doblarTurno, setDoblarTurno] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);

  const esDueño = trabajadorActivo?.rol === "DUENO";
  const turnoActivo = trabajadorActivo ? obtenerTurnoActivo(trabajadorActivo.id) : undefined;
  const hoyStr = new Date().toISOString().slice(0, 10);
  const turnosDeHoy = useMemo(() => turnos.filter(t => t.fechaInicio.startsWith(hoyStr)), [turnos, hoyStr]);

  const turnoCerradoHoy = useMemo(() => {
    return turnosDeHoy.find(t => t.trabajadorId === trabajadorActivo?.id && t.estatus === "CERRADO");
  }, [turnosDeHoy, trabajadorActivo]);

  const manejarGuardarConfiguracion = (e: React.FormEvent) => {
    e.preventDefault();
    actualizarConfiguracion(inputFondo, inputNotaGeneral);
    setAjustesGuardados(true);
    setTimeout(() => setAjustesGuardados(false), 2000);
  };

  const ventasTotalesHoy = useMemo(() => {
    return ventas.filter(v => v.fecha.startsWith(hoyStr)).reduce((acc, v) => acc + v.total, 0);
  }, [ventas, hoyStr]);

  const manejarAbrirTurno = () => {
    if (!trabajadorActivo) return;
    abrirTurno(trabajadorActivo.id, trabajadorActivo.nombre, fondoBaseActual);
    setDoblarTurno(false);
  };

  const metricasTurno = useMemo(() => {
    if (!turnoActivo) return { totalVendido: 0, cantAutorizaciones: 0, totalAutorizado: 0 };
    
    const ventasDelTurno = ventas.filter(v => 
      v.trabajador === turnoActivo.nombreTrabajador && 
      v.fecha >= turnoActivo.fechaInicio && 
      (!turnoActivo.fechaFin || v.fecha <= turnoActivo.fechaFin)
    );

    const totalVendido = ventasDelTurno.reduce((acc, v) => acc + v.total, 0);
    const articulosAutorizados = ventasDelTurno.flatMap(v => v.articulos.filter(a => a.autorizacion_confirmada));
    const totalAutorizado = articulosAutorizados.reduce((acc, a) => acc + a.subtotal, 0);

    return { totalVendido, cantAutorizaciones: articulosAutorizados.length, totalAutorizado };
  }, [turnoActivo, ventas]);

  const manejarCerrarTurno = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoActivo || fondoDejado === "") return;
    cerrarTurno(turnoActivo.id, Number(fondoDejado), metricasTurno.totalVendido, notaCierre);
    setModoCierre(false);
    setFondoDejado("");
    setNotaCierre("");
  };

  if (!trabajadorActivo) return null;

  return (
    <div className="w-full h-full flex flex-col gap-6 p-4 lg:p-6 overflow-y-auto animate-in fade-in duration-300">
      
      {/* Modal para que el trabajador confirme apertura con PIN */}
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

      <div className="mb-2 border-b border-slate-200/50 dark:border-white/10 pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Wallet size={24} />
          </div>
          Corte de Caja y Turnos
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {esDueño ? "Audita los cortes, configura el fondo de caja y revisa las notas de tus trabajadores." : "Abre tu caja, revisa tus métricas y declara el cierre al finalizar tu horario."}
        </p>
      </div>

      {esDueño ? (
        /* ================= VISTA DUEÑO ================= */
        <div className="flex flex-col gap-6 w-full">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="efecto-cristal p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-4 bg-emerald-50/30 dark:bg-emerald-900/10">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><TrendingUp size={24}/></div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Ventas Globales (Hoy)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">${ventasTotalesHoy.toFixed(2)}</p>
              </div>
            </div>
            <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400"><Clock size={24}/></div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Turnos Hoy</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{turnosDeHoy.length} <span className="text-sm font-medium text-slate-400">registrados</span></p>
              </div>
            </div>
            <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400"><DollarSign size={24}/></div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Fondo Base Activo</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">${fondoBaseActual.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
            <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <Lock size={18} className="text-slate-400" /> Configuración de Turnos
              </h2>
              
              <form onSubmit={manejarGuardarConfiguracion} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Fondo Base Actual</label>
                  <p className="text-[10px] text-slate-500 mb-2">Este es el dinero que recibirá el trabajador que abra el SIGUIENTE turno.</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" min="0" step="1" required value={inputFondo} onChange={(e) => setInputFondo(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 font-bold" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Aviso para trabajadores</label>
                  <textarea value={inputNotaGeneral} onChange={(e) => setInputNotaGeneral(e.target.value)} rows={3} placeholder="Aviso visible al abrir turno..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none" />
                </div>

                {/* Nuevo Toggle para forzar recepción */}
                <label className="flex items-center gap-3 cursor-pointer mt-1 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-white/5">
                  <input type="checkbox" checked={forzarRecepcionCaja} onChange={(e) => setForzarRecepcionCaja(e.target.checked)} className="w-5 h-5 accent-emerald-600 rounded" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Exigir confirmación para cobrar</span>
                    <span className="text-[10px] text-slate-500">Bloquea el POS hasta que confirmen el fondo.</span>
                  </div>
                </label>

                <button type="submit" className="mt-2 self-end inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/20">
                  {ajustesGuardados ? <CheckCircle size={16} /> : <Save size={16} />}
                  {ajustesGuardados ? "Actualizado" : "Guardar Cambios"}
                </button>
              </form>
            </div>

            {/* (Historial de turnos sin cambios...) */}
            <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col h-full max-h-[600px]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2 mb-4">
                <FileText size={18} className="text-blue-600" /> Historial de Turnos (Hoy)
              </h2>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
                {turnosDeHoy.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No se han registrado turnos hoy.</p>
                ) : (
                  turnosDeHoy.map((turno) => (
                    <div key={turno.id} className="flex flex-col p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{turno.nombreTrabajador}</span>
                          <div className="text-xs text-slate-500 mt-0.5 font-medium">
                            {new Date(turno.fechaInicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} - {turno.estatus === "CERRADO" && turno.fechaFin ? new Date(turno.fechaFin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : "Activo"}
                          </div>
                        </div>
                        <span className={cn("text-[10px] px-2 py-1 rounded-md font-bold uppercase", turno.estatus === "ABIERTO" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                          {turno.estatus}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
                        <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5">Fondo Asignado:</span> 
                          <strong className="text-slate-700 dark:text-slate-300 text-sm">${turno.fondoInicial.toFixed(2)}</strong>
                        </div>
                        <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5">Ventas Sistema:</span> 
                          <strong className="text-emerald-600 dark:text-emerald-400 text-sm">${turno.ventasCalculadas?.toFixed(2) || "---"}</strong>
                        </div>
                        <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                          <span className="text-slate-400 block mb-0.5">Fondo Dejado:</span> 
                          <strong className="text-slate-700 dark:text-slate-300 text-sm">${turno.fondoDejado?.toFixed(2) || "---"}</strong>
                        </div>
                      </div>
                      
                      {turno.notaTrabajador && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex gap-2 items-start border border-amber-100 dark:border-amber-800/30">
                          <MessageSquare size={14} className="shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">Nota del trabajador:</span>
                            <p className="leading-relaxed">{turno.notaTrabajador}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* ================= VISTA TRABAJADOR ================= */
        <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
          
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

              {notaGeneralDueno && (
                <div className="w-full p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl text-left flex gap-3 items-start">
                  <FileText size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-1">Nota de Administración</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">{notaGeneralDueno}</p>
                  </div>
                </div>
              )}

              {/* Botón ahora abre el modal del PIN */}
              <button onClick={() => setModalPinAbierto(true)} className="w-full mt-2 py-4 rounded-2xl font-bold flex justify-center items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/30 hover:scale-[1.02] transition-all text-lg">
                <KeyRound size={24} /> Aceptar Fondo con PIN
              </button>
            </div>

          ) : (
            <>
              {/* Turno activo y cierre (Sin modificaciones) */}
              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={14}/> Turno Activo</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">Iniciado a las {new Date(turnoActivo.fechaInicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!modoCierre && (
                  <button onClick={() => setModoCierre(true)} className="px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl font-bold text-sm transition-colors border border-red-100 dark:border-red-900/30">
                    Cerrar Turno
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Wallet size={18} /> <h3 className="text-sm font-bold">Fondo Inicial Recibido</h3>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-auto">${turnoActivo.fondoInicial.toFixed(2)}</p>
                </div>

                <div className="efecto-cristal p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/30 flex flex-col gap-2 bg-emerald-50/30 dark:bg-emerald-900/10">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-500">
                    <DollarSign size={18} /> <h3 className="text-sm font-bold">Tus Ventas del Turno</h3>
                  </div>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-auto">${metricasTurno.totalVendido.toFixed(2)}</p>
                </div>

                <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <ShieldCheck size={18} /> <h3 className="text-sm font-bold">Autorizaciones</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metricasTurno.cantAutorizaciones} prods</p>
                    <p className="text-xs text-slate-500 mt-1">${metricasTurno.totalAutorizado.toFixed(2)} acumulados</p>
                  </div>
                </div>

                <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-900/30 opacity-70">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Ban size={18} /> <h3 className="text-sm font-bold">Cancelaciones</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-2xl font-bold text-slate-400">0</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Próximamente</p>
                  </div>
                </div>
              </div>

              {modoCierre && (
                <div className="efecto-cristal p-8 rounded-3xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col gap-6 bg-white dark:bg-slate-900 mt-4 shadow-xl animate-in slide-in-from-bottom-4">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/5 pb-4">Declaración de Cierre</h2>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-4 rounded-xl flex gap-3 text-amber-800 dark:text-amber-300 text-sm mb-2">
                    <AlertTriangle size={20} className="shrink-0" />
                    <p>Separa el dinero de tus ventas para entregarlo o depositarlo. En el campo de abajo, escribe <strong>únicamente</strong> el fondo de dinero que dejarás en el cajón para el siguiente turno.</p>
                  </div>

                  <form onSubmit={manejarCerrarTurno} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fondo que dejas en caja *</label>
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
                      <textarea value={notaCierre} onChange={(e) => setNotaCierre(e.target.value)} placeholder="Pagos a proveedores, faltantes, sobrantes..." className="w-full h-full min-h-[100px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none" />
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