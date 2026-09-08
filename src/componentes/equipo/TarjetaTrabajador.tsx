// src/componentes/equipo/TarjetaTrabajador.tsx
import React, { useState, useMemo, useEffect } from "react";
import { useEstadoTrabajadores, type Trabajador, type PermisosTrabajador, type HorarioSemanal } from "../../estado/estadoTrabajadores";
import { useEstadoAsistencias } from "../../estado/estadoAsistencias";
import { useEstadoVentas } from "../../estado/estadoVentas";
// Se agregó el ícono "Save" a la importación
import { Shield, Briefcase, ChevronDown, CalendarDays, Power, Trash2, ShieldCheck, Eye, Clock, FileText, Save } from "lucide-react";
import { cn } from "../../utilidades/utils";
import ModalConfirmacionPin from "../ui/ModalConfirmacionPin";

export default function TarjetaTrabajador({ trabajador }: { trabajador: Trabajador }) {
  const { actualizarTrabajador, trabajadorActivo, eliminarTrabajador } = useEstadoTrabajadores();
  const { ventas } = useEstadoVentas();
  const { asistencias } = useEstadoAsistencias();

  const [expandido, setExpandido] = useState(false);
  const [pestaña, setPestaña] = useState<"PERFIL" | "HORARIO" | "ASISTENCIA" | "AUTORIZACIONES">("PERFIL");
  const [mostrarSalario, setMostrarSalario] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);

  // --- NUEVO: Estado local para el formulario de Perfil ---
  const [formLocal, setFormLocal] = useState<Trabajador>(trabajador);
  const [hayCambios, setHayCambios] = useState(false);

  // Sincronizar si el trabajador cambia externamente y no estamos editando
  useEffect(() => {
    if (!hayCambios) {
      setFormLocal(trabajador);
    }
  }, [trabajador, hayCambios]);

  const manejarCambio = (campo: keyof Trabajador, valor: any) => {
    setFormLocal(prev => ({ ...prev, [campo]: valor }));
    setHayCambios(true);
  };

  const manejarPermiso = (permiso: keyof PermisosTrabajador, valor: boolean) => {
    setFormLocal(prev => ({
      ...prev,
      permisos: { ...(prev.permisos || {}), [permiso]: valor } as PermisosTrabajador
    }));
    setHayCambios(true);
  };

  const guardarCambiosPerfil = () => {
    actualizarTrabajador(formLocal);
    setHayCambios(false);
  };
  // --------------------------------------------------------

  // Lógica de Permisos Estrictos
  const esDueñoEnSesion = trabajadorActivo?.rol === "DUENO";
  const esSupervisorEnSesion = trabajadorActivo?.rol === "SUPERVISOR";
  const esElMismo = trabajadorActivo?.id === trabajador.id;
  
  const puedeEditarInfoGeneral = esDueñoEnSesion || esSupervisorEnSesion;
  
  // Regla: Solo el dueño edita salarios. El supervisor puede verlo SI tiene permiso.
  const puedeVerSalario = esDueñoEnSesion || (esSupervisorEnSesion && trabajadorActivo?.permisos?.verSalarios);
  const puedeEditarSalario = esDueñoEnSesion;

  // Regla: Supervisor puede editar horarios (si tiene el check), pero NUNCA su propio horario.
  const puedeEditarHorarios = esDueñoEnSesion || (esSupervisorEnSesion && trabajadorActivo?.permisos?.cambiarHorarios && !esElMismo);

  // Lógica de Notas usando el estado local
  const contarPalabras = (texto: string) => texto.trim().split(/\s+/).filter(w => w.length > 0).length;
  const manejarNotas = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const texto = e.target.value;
    if (contarPalabras(texto) <= 200) {
      manejarCambio("notas", texto);
    }
  };

  const horario: HorarioSemanal = trabajador.horarioSemanal || {
    tipo: "GENERAL", diasTrabajo: [1,2,3,4,5], general: { entrada: "09:00", salida: "18:00" }, especifico: {}
  };

  const toggleDia = (diaIndex: number) => {
    const nuevosDias = horario.diasTrabajo.includes(diaIndex)
      ? horario.diasTrabajo.filter(d => d !== diaIndex)
      : [...horario.diasTrabajo, diaIndex].sort();
    actualizarTrabajador({ ...trabajador, horarioSemanal: { ...horario, diasTrabajo: nuevosDias } });
  };

  const ventasAutorizadas = useMemo(() => {
    return ventas.flatMap(v => v.articulos
      .filter(a => a.autorizacion_confirmada && v.trabajador === trabajador.nombre)
      .map(a => ({ ...a, fecha: v.fecha }))
    );
  }, [ventas, trabajador.nombre]);

  // --- CORRECCIÓN: Filtro robusto para las asistencias ---
  const asistenciasRecientes = useMemo(() => {
    if (!asistencias) return [];
    return asistencias
      .filter(a => String(a.trabajadorId).trim() === String(trabajador.id).trim())
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 7);
  }, [asistencias, trabajador.id]);
  // -------------------------------------------------------

  const calculoAutorizaciones = useMemo(() => {
    const hoy = new Date();
    const hace1Semana = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace1Mes = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace6Meses = new Date(hoy.getTime() - 180 * 24 * 60 * 60 * 1000);

    let [sem, mes, meses6] = [0, 0, 0];
    ventasAutorizadas.forEach(v => {
      const f = new Date(v.fecha);
      if (f >= hace1Semana) sem += v.subtotal;
      if (f >= hace1Mes) mes += v.subtotal;
      if (f >= hace6Meses) meses6 += v.subtotal;
    });
    return { sem, mes, meses6 };
  }, [ventasAutorizadas]);

  const validarRetardo = (fecha: string, entradaReal: string) => {
    const date = new Date(`${fecha}T12:00:00`); 
    const diaIndex = date.getDay();
    if (!horario.diasTrabajo.includes(diaIndex)) return "Día Libre (Extra)";
    
    const hEntradaEsperada = horario.tipo === "GENERAL" 
      ? horario.general.entrada 
      : (horario.especifico[diaIndex]?.entrada || "00:00");
    
    return entradaReal > hEntradaEsperada ? "Retardo" : "A tiempo";
  };

  const cssInput = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-900 transition-all disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className={cn(
      "efecto-cristal rounded-2xl flex flex-col border transition-all overflow-hidden bg-white/70 dark:bg-slate-900/60 shadow-sm",
      trabajador.activo ? "border-slate-200/50 dark:border-white/10" : "opacity-75 border-slate-200 dark:border-slate-800 grayscale-[0.3]"
    )}>
      <ModalConfirmacionPin 
        abierto={modalEliminar} 
        titulo="Eliminar Trabajador" 
        mensaje={`¿Estás seguro de que deseas eliminar permanentemente a ${trabajador.nombre} y todos sus registros de acceso? Esta acción no se puede deshacer.`} 
        alConfirmar={() => eliminarTrabajador(trabajador.id)} 
        alCerrar={() => setModalEliminar(false)} 
      />

      {/* HEADER DE LA TARJETA */}
      <div role="button" tabIndex={0} onClick={() => setExpandido(!expandido)} onKeyDown={(e) => { if (e.key === "Enter") setExpandido(!expandido); }} className="flex w-full cursor-pointer justify-between items-center p-5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
          <div className={cn("w-12 h-12 rounded-xl flex shrink-0 items-center justify-center font-bold text-white text-lg shadow-inner", 
            trabajador.rol === "DUENO" ? "bg-purple-500" : 
            trabajador.rol === "SUPERVISOR" ? "bg-indigo-500" : "bg-blue-500"
          )}>
            {trabajador.nombre.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-none truncate">{trabajador.nombre}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 font-medium">
              <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {trabajador.rol === "DUENO" ? <Shield size={12} className="text-purple-500" /> : 
                 trabajador.rol === "SUPERVISOR" ? <ShieldCheck size={12} className="text-indigo-500" /> : 
                 <Briefcase size={12} className="text-blue-500" />}
                {trabajador.rol}
              </span>
              {!trabajador.activo && <span className="text-red-500 font-bold px-2 py-0.5 bg-red-50 dark:bg-red-900/20 rounded-md">INACTIVO</span>}
            </div>
          </div>
        </div>
        <ChevronDown size={20} className={cn("text-slate-400 transition-transform duration-300", expandido && "rotate-180")} />
      </div>

      {/* CUERPO ACORDEÓN */}
      {expandido && (
        <div className="border-t border-slate-200/50 dark:border-white/10 flex flex-col bg-white/40 dark:bg-black/20">
          
          <div className="flex overflow-x-auto border-b border-slate-200/50 dark:border-white/10 scrollbar-hide px-2">
            {(["PERFIL", "HORARIO", "ASISTENCIA", "AUTORIZACIONES"] as const).map(tab => (
              <button 
                key={tab} onClick={() => setPestaña(tab)} 
                className={cn("px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all", pestaña === tab ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
              >
                {tab === "PERFIL" ? "Perfil General" : tab === "HORARIO" ? "Horario" : tab === "ASISTENCIA" ? "Asistencia" : "Ventas Esp."}
              </button>
            ))}
          </div>

          <div className="p-5">
            
            {/* --- TAB: PERFIL --- */}
            {pestaña === "PERFIL" && (
              <div className="space-y-5 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Nombre Completo</label>
                    <input type="text" readOnly={!puedeEditarInfoGeneral} value={formLocal.nombre} onChange={(e) => manejarCambio("nombre", e.target.value)} className={cssInput} disabled={!puedeEditarInfoGeneral} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Fecha de Ingreso</label>
                    <input type="date" readOnly={!puedeEditarInfoGeneral} value={formLocal.fechaIngreso || ""} onChange={(e) => manejarCambio("fechaIngreso", e.target.value)} className={cssInput} disabled={!puedeEditarInfoGeneral} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex justify-between">
                      PIN de Acceso
                      {!esDueñoEnSesion && <span className="text-[10px] text-slate-400 font-normal">(Solo Dueño)</span>}
                    </label>
                    <input type="text" readOnly={!esDueñoEnSesion} disabled={!esDueñoEnSesion} value={esDueñoEnSesion ? formLocal.pin : "••••••"} onChange={(e) => manejarCambio("pin", e.target.value.toUpperCase())} maxLength={6} className={cn(cssInput, "font-mono font-bold tracking-widest")} />
                  </div>
                  
                  {puedeVerSalario && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex justify-between">
                        Salario Mensual
                        <button onClick={() => setMostrarSalario(!mostrarSalario)} className="text-slate-400 hover:text-emerald-500"><Eye size={14} /></button>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input type={mostrarSalario ? "number" : "password"} readOnly={!puedeEditarSalario} disabled={!puedeEditarSalario} value={formLocal.salario || ""} onChange={(e) => manejarCambio("salario", Number(e.target.value))} className={cn(cssInput, "pl-7")} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                    Notas y Observaciones <span className="font-normal text-slate-400">{contarPalabras(formLocal.notas || "")} / 200 palabras</span>
                  </label>
                  <textarea readOnly={!puedeEditarInfoGeneral} disabled={!puedeEditarInfoGeneral} value={formLocal.notas || ""} onChange={manejarNotas} rows={3} className={cn(cssInput, "resize-none")} placeholder="Información relevante, faltas, acuerdos..." />
                </div>

                {trabajador.rol === "TRABAJADOR" && puedeEditarInfoGeneral && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-3">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-600" /> Permisos del Trabajador</p>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.editarProductos || false} onChange={(e) => manejarPermiso("editarProductos", e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" /> Permitir editar productos/categorías
                    </label>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.eliminarProductos || false} onChange={(e) => manejarPermiso("eliminarProductos", e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" /> Permitir eliminar productos
                    </label>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.actualizarStockCodigo || false} onChange={(e) => manejarPermiso("actualizarStockCodigo", e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4" /> Permitir ajustar stock y códigos de barras
                    </label>
                  </div>
                )}

                {trabajador.rol === "SUPERVISOR" && esDueñoEnSesion && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30 space-y-3 mt-4">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                      <ShieldCheck size={16} /> Permisos de Supervisor
                    </p>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.cambiarHorarios || false} onChange={(e) => manejarPermiso("cambiarHorarios", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" /> Cambiar horarios y días de trabajadores
                    </label>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.hacerCancelaciones ?? true} onChange={(e) => manejarPermiso("hacerCancelaciones", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" /> Autorizar cancelaciones de ventas o preventas
                    </label>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.cambiarInfoTicket || false} onChange={(e) => manejarPermiso("cambiarInfoTicket", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" /> Cambiar información editable del ticket
                    </label>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={formLocal.permisos?.cambiarPrecios || false} onChange={(e) => manejarPermiso("cambiarPrecios", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" /> Cambiar precios de los productos
                    </label>
                    <label className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 cursor-pointer border-t border-indigo-200 dark:border-indigo-800/50 pt-2 mt-2">
                      <input type="checkbox" checked={formLocal.permisos?.verSalarios || false} onChange={(e) => manejarPermiso("verSalarios", e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" /> Permitir VISUALIZAR el salario de los trabajadores
                    </label>
                  </div>
                )}

                {/* BOTÓN DE GUARDAR CAMBIOS */}
                {hayCambios && puedeEditarInfoGeneral && (
                  <div className="flex justify-end pt-4 mt-2">
                    <button
                      onClick={guardarCambiosPerfil}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/30"
                    >
                      <Save size={18} />
                      Guardar Cambios
                    </button>
                  </div>
                )}

                {esDueñoEnSesion && !esElMismo && (
                  <div className="flex gap-3 pt-4 border-t border-slate-200/50 dark:border-white/10">
                    <button onClick={() => actualizarTrabajador({...trabajador, activo: !trabajador.activo})} className={cn("flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors", trabajador.activo ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400")}>
                      <Power size={16} /> {trabajador.activo ? "Desactivar Acceso" : "Reactivar Acceso"}
                    </button>
                    <button onClick={() => setModalEliminar(true)} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-colors">
                      <Trash2 size={16} /> Eliminar Trabajador
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* --- TAB: HORARIO --- */}
            {pestaña === "HORARIO" && (
              <div className="space-y-6 animate-in fade-in">
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2"><CalendarDays size={16} /> Días Laborales</p>
                  <div className="flex flex-wrap gap-2">
                    {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dia, i) => {
                      const labora = horario.diasTrabajo.includes(i);
                      return (
                        <button key={i} disabled={!puedeEditarHorarios} onClick={() => toggleDia(i)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-colors border", labora ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800/50 dark:text-emerald-400 shadow-sm" : "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-white/5 opacity-60 disabled:opacity-30", !puedeEditarHorarios && "cursor-not-allowed")}>
                          {dia}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-white/5">
                  <div className="flex justify-between items-center mb-5">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Configuración de Horas</p>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      Mismo horario toda la semana
                      <input type="checkbox" disabled={!puedeEditarHorarios} checked={horario.tipo === "GENERAL"} onChange={(e) => actualizarTrabajador({...trabajador, horarioSemanal: {...horario, tipo: e.target.checked ? "GENERAL" : "ESPECIFICO"}})} className="w-4 h-4 accent-emerald-600 rounded disabled:opacity-50" />
                    </label>
                  </div>

                  {horario.tipo === "GENERAL" ? (
                    <div className="flex items-center gap-4">
                      <div className="flex-1"><label className="block text-xs text-slate-500 mb-1">Hora Entrada</label><input type="time" disabled={!puedeEditarHorarios} value={horario.general.entrada} onChange={(e) => actualizarTrabajador({...trabajador, horarioSemanal: {...horario, general: {...horario.general, entrada: e.target.value}}})} className={cssInput} /></div>
                      <div className="flex-1"><label className="block text-xs text-slate-500 mb-1">Hora Salida</label><input type="time" disabled={!puedeEditarHorarios} value={horario.general.salida} onChange={(e) => actualizarTrabajador({...trabajador, horarioSemanal: {...horario, general: {...horario.general, salida: e.target.value}}})} className={cssInput} /></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {horario.diasTrabajo.map(diaIndex => {
                        const config = horario.especifico[diaIndex] || { entrada: "09:00", salida: "18:00" };
                        const nombreDia = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][diaIndex];
                        return (
                          <div key={diaIndex} className="flex items-center gap-4 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="w-24 text-xs font-bold text-slate-700 dark:text-slate-300">{nombreDia}</span>
                            <input type="time" disabled={!puedeEditarHorarios} value={config.entrada} onChange={(e) => actualizarTrabajador({...trabajador, horarioSemanal: {...horario, especifico: {...horario.especifico, [diaIndex]: {...config, entrada: e.target.value}}}})} className={cn(cssInput, "py-1.5")} />
                            <span className="text-slate-400 text-xs">a</span>
                            <input type="time" disabled={!puedeEditarHorarios} value={config.salida} onChange={(e) => actualizarTrabajador({...trabajador, horarioSemanal: {...horario, especifico: {...horario.especifico, [diaIndex]: {...config, salida: e.target.value}}}})} className={cn(cssInput, "py-1.5")} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB: ASISTENCIA --- */}
            {pestaña === "ASISTENCIA" && (
              <div className="animate-in fade-in">
                <div className="flex justify-between items-end mb-4">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><Clock size={18} className="text-emerald-600" /> Monitoreo de Asistencia</p>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Últimos 7 días</span>
                </div>
                
                <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-white/10">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                      <tr>
                        <th className="p-3 font-semibold">Fecha</th>
                        <th className="p-3 font-semibold text-center">Entrada</th>
                        <th className="p-3 font-semibold text-center">Salida</th>
                        <th className="p-3 font-semibold text-center">Estatus</th>
                        <th className="p-3 font-semibold text-center" title="Veces que cerró sesión durante el turno">Desc.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {asistenciasRecientes.length === 0 ? (
                        <tr><td colSpan={5} className="p-6 text-center text-slate-400">No hay registros recientes de asistencia.</td></tr>
                      ) : (
                        asistenciasRecientes.map(a => {
                          const estatus = validarRetardo(a.fecha, a.horaEntrada);
                          return (
                            <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-slate-700 dark:text-slate-300">
                              <td className="p-3 font-medium">{a.fecha}</td>
                              <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{a.horaEntrada}</td>
                              <td className="p-3 text-center font-mono text-slate-500">{a.horaSalida || "---"}</td>
                              <td className="p-3 text-center">
                                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase", estatus === "Retardo" ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30")}>
                                  {estatus}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {a.desconexiones > 0 ? <span className="text-amber-500 font-bold">{a.desconexiones}</span> : <span className="text-slate-300">-</span>}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB: AUTORIZACIONES --- */}
            {pestaña === "AUTORIZACIONES" && (
              <div className="animate-in fade-in">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600/70 dark:text-emerald-400/70 mb-1">Últimos 7 Días</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">${calculoAutorizaciones.sem.toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600/70 dark:text-emerald-400/70 mb-1">Último Mes</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">${calculoAutorizaciones.mes.toFixed(2)}</span>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-600/70 dark:text-emerald-400/70 mb-1">Últimos 6 Meses</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">${calculoAutorizaciones.meses6.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2"><FileText size={16} className="text-slate-400" /> Historial de Productos Especiales Vendidos</p>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                  {ventasAutorizadas.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4">No ha vendido productos con autorización.</p>
                  ) : (
                    ventasAutorizadas.slice().reverse().map((a, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{a.nombre}</span>
                          <span className="text-[10px] text-slate-500">{new Date(a.fecha).toLocaleDateString('es-MX')} - Cant: {a.cantidad}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${a.subtotal.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}