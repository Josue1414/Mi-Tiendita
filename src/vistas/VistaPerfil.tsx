// src/vistas/VistaPerfil.tsx
import { useMemo } from "react";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { useEstadoVentas } from "../estado/estadoVentas";
import { UserCircle, Calendar, Activity, ShieldCheck, CalendarDays } from "lucide-react";
import { cn } from "../utilidades/utils";

export default function VistaPerfil() {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { asistencias } = useEstadoAsistencias();
  const { ventas } = useEstadoVentas();

  if (!trabajadorActivo) return null;

  const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  // Generar el historial de los últimos 14 días calculando Faltas, Retardos y Descansos
  const historialAsistencia = useMemo(() => {
    const historial = [];
    const hoy = new Date();
    // Ajustar a medianoche para evitar problemas con la hora al comparar
    hoy.setHours(0, 0, 0, 0); 

    for (let i = 0; i < 14; i++) {
      const fecha = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
      const fechaStr = fecha.toISOString().split("T")[0]; 
      const diaIndex = fecha.getDay();

      const registro = asistencias.find((a) => a.trabajadorId === trabajadorActivo.id && a.fecha === fechaStr);
      const labora = trabajadorActivo.horarioSemanal?.diasTrabajo.includes(diaIndex);
      
      let estatus = "";
      let colorEstatus = "";

      if (registro) {
        const hEntradaEsperada = trabajadorActivo.horarioSemanal?.tipo === "GENERAL"
          ? trabajadorActivo.horarioSemanal.general.entrada
          : (trabajadorActivo.horarioSemanal?.especifico[diaIndex]?.entrada || "00:00");

        if (!labora) {
          estatus = "Extra";
          colorEstatus = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
        } else if (registro.horaEntrada > hEntradaEsperada) {
          estatus = "Retardo";
          colorEstatus = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
        } else {
          estatus = "A tiempo";
          colorEstatus = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
        }
      } else {
        if (!labora) {
          estatus = "Descanso";
          colorEstatus = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
        } else if (fecha < hoy) {
          estatus = "Falta";
          colorEstatus = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
        } else {
          estatus = "Pendiente";
          colorEstatus = "bg-slate-50 text-slate-400 dark:bg-slate-900/50";
        }
      }

      historial.push({
        id: registro?.id || `vacio-${fechaStr}`,
        fecha: fechaStr,
        dia: diasSemana[diaIndex],
        entrada: registro?.horaEntrada || "---",
        salida: registro?.horaSalida || (registro ? "Activo" : "---"),
        desconexiones: registro?.desconexiones || 0,
        estatus,
        colorEstatus
      });
    }
    return historial;
  }, [asistencias, trabajadorActivo]);

  // Calculamos las ventas de productos que requerían autorización
  const metricasAutorizadas = useMemo(() => {
    const ventasDelTrabajador = ventas.filter((v) => v.trabajador === trabajadorActivo.nombre);
    const articulosAutorizados = ventasDelTrabajador.flatMap((v) => 
      v.articulos.filter((a) => a.autorizacion_confirmada)
    );
    
    const totalGenerado = articulosAutorizados.reduce((acc, curr) => acc + curr.subtotal, 0);
    return { cantidad: articulosAutorizados.length, total: totalGenerado };
  }, [ventas, trabajadorActivo.nombre]);

  const diaHoy = new Date().getDay();
  const trabajaHoy = trabajadorActivo.horarioSemanal?.diasTrabajo.includes(diaHoy);
  const horarioHoy = trabajadorActivo.horarioSemanal?.tipo === "GENERAL"
    ? trabajadorActivo.horarioSemanal.general
    : trabajadorActivo.horarioSemanal?.especifico[diaHoy];

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
            <UserCircle size={24} />
          </div>
          Mi Perfil
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulta tu información personal, horarios y métricas de desempeño.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Info Personal y Horarios */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10">
            <div className="flex flex-col items-center text-center border-b border-slate-200/50 dark:border-white/10 pb-6 mb-6">
              <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4">
                {trabajadorActivo.nombre.substring(0, 2).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{trabajadorActivo.nombre}</h2>
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg mt-2">
                {trabajadorActivo.rol}
              </span>
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1"><Calendar size={14} /> Fecha de Ingreso</span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{trabajadorActivo.fechaIngreso || "No registrada"}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2"><CalendarDays size={14} /> Horario Semanal</span>
                
                {/* Resaltar el horario de hoy */}
                <div className={cn("p-3 rounded-xl mb-3 border", trabajaHoy ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/30" : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-white/5")}>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Horario de Hoy ({diasSemana[diaHoy]})</p>
                  {trabajaHoy ? (
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono tracking-tight">
                      {horarioHoy?.entrada} - {horarioHoy?.salida}
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Día de descanso</p>
                  )}
                </div>

                {/* Lista de todos los días */}
                <div className="flex flex-col gap-1.5">
                  {diasSemana.map((dia, index) => {
                    const labora = trabajadorActivo.horarioSemanal?.diasTrabajo.includes(index);
                    const hrs = trabajadorActivo.horarioSemanal?.tipo === "GENERAL" 
                      ? trabajadorActivo.horarioSemanal.general 
                      : trabajadorActivo.horarioSemanal?.especifico[index];

                    if (!labora) return null;
                    return (
                      <div key={dia} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-100 dark:border-white/5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{dia}</span>
                        <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">{hrs?.entrada} - {hrs?.salida}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen de Autorizaciones */}
          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-emerald-600" /> Rendimiento en Ventas Especiales</h3>
            <div className="flex flex-col gap-3">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                <span className="text-xs text-slate-500">Artículos Autorizados Vendidos</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{metricasAutorizadas.cantidad}</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center">
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Total Generado (Autorizaciones)</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">${metricasAutorizadas.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Asistencias (Calendario/Historial) */}
        <div className="lg:col-span-2">
          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 h-full">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Activity size={20} className="text-emerald-600" /> Calendario de Asistencia (Últimos 14 días)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-white/10">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs">
                  <tr>
                    <th className="p-4 font-semibold">Fecha</th>
                    <th className="p-4 font-semibold text-center">Estatus</th>
                    <th className="p-4 font-semibold text-center">Entrada</th>
                    <th className="p-4 font-semibold text-center">Salida</th>
                    <th className="p-4 font-semibold text-center">Desconexiones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {historialAsistencia.map((dia) => (
                    <tr key={dia.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-slate-700 dark:text-slate-300">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{dia.dia}</span>
                          <span className="text-xs text-slate-500">{dia.fecha}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={cn("px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider", dia.colorEstatus)}>
                          {dia.estatus}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono font-medium">{dia.entrada}</td>
                      <td className="p-4 text-center font-mono text-slate-500">{dia.salida}</td>
                      <td className="p-4 text-center">
                        {dia.desconexiones > 0 ? (
                          <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md text-xs font-bold">{dia.desconexiones}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}