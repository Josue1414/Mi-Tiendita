// src/vistas/VistaPerfil.tsx
import { useMemo, useState } from "react";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoRed } from "../estado/estadoRed";
import { UserCircle, Calendar, Activity, ShieldCheck, CalendarDays, Network, Wifi, WifiOff, Server, QrCode, X, Smartphone } from "lucide-react";
import { cn } from "../utilidades/utils";
import PanelCamaraEscaner from "../componentes/pos/PanelCamaraEscaner";

export default function VistaPerfil() {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { asistencias } = useEstadoAsistencias();
  const { ventas } = useEstadoVentas();
  
  const { esMaestro, conectadoLAN, ipMaestro, setIpMaestro } = useEstadoRed();
  const [inputIpConexion, setInputIpConexion] = useState(ipMaestro || "");
  const [escaneandoQR, setEscaneandoQR] = useState(false);

  if (!trabajadorActivo) return null;

  const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const historialAsistencia = useMemo(() => {
    const historial = [];
    const hoy = new Date();
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

  const metricasAutorizadas = useMemo(() => {
    const ventasDelTrabajador = ventas.filter((v) => v.trabajador === trabajadorActivo.nombre);
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();
    const mesPasado = mesActual === 0 ? 11 : mesActual - 1;
    const añoMesPasado = mesActual === 0 ? añoActual - 1 : añoActual;
    let totalMesActual = 0;
    let totalMesPasado = 0;
    let cantidadTotal = 0;

    ventasDelTrabajador.forEach((v) => {
      const fechaVenta = new Date(v.fecha);
      const mesVenta = fechaVenta.getMonth();
      const añoVenta = fechaVenta.getFullYear();
      const articulosAutorizados = v.articulos.filter((a) => a.autorizacion_confirmada);
      
      if (articulosAutorizados.length > 0) {
        cantidadTotal += articulosAutorizados.length;
        const sumaVenta = articulosAutorizados.reduce((acc, curr) => acc + curr.subtotal, 0);

        if (mesVenta === mesActual && añoVenta === añoActual) {
          totalMesActual += sumaVenta;
        } else if (mesVenta === mesPasado && añoVenta === añoMesPasado) {
          totalMesPasado += sumaVenta;
        }
      }
    });

    const nombreMesAct = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(añoActual, mesActual, 1));
    const nombreMesPas = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(añoMesPasado, mesPasado, 1));

    return { 
      cantidad: cantidadTotal, 
      totalMesActual, 
      totalMesPasado,
      nombreMesActual: nombreMesAct.charAt(0).toUpperCase() + nombreMesAct.slice(1),
      nombreMesPasado: nombreMesPas.charAt(0).toUpperCase() + nombreMesPas.slice(1)
    };
  }, [ventas, trabajadorActivo.nombre]);

  const diaHoy = new Date().getDay();
  const trabajaHoy = trabajadorActivo.horarioSemanal?.diasTrabajo.includes(diaHoy);
  const horarioHoy = trabajadorActivo.horarioSemanal?.tipo === "GENERAL"
    ? trabajadorActivo.horarioSemanal.general
    : trabajadorActivo.horarioSemanal?.especifico[diaHoy];

  const manejarEscaneoQR = (codigo: string) => {
    try {
      const url = new URL(codigo);
      const ip = url.searchParams.get("lanHost") || url.hostname;
      if (ip) {
        setIpMaestro(ip);
        setEscaneandoQR(false);
        window.location.reload();
      } else {
        alert("El código escaneado no contiene la IP del Cerebro.");
      }
    } catch {
      alert("Formato de QR no reconocido.");
    }
  };

  return (
    <div className="w-full h-full min-w-0 flex flex-col gap-6 p-4 sm:p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      
      {escaneandoQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><QrCode size={18}/> Escanear QR del Cerebro</h3>
              <button onClick={() => setEscaneandoQR(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={16}/></button>
            </div>
            <PanelCamaraEscaner alDetectar={manejarEscaneoQR} />
            <p className="text-xs text-slate-500 text-center">Apunta la cámara al código QR que muestra la pantalla de Red del Cerebro (Dueño).</p>
          </div>
        </div>
      )}

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

      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="min-w-0 lg:col-span-1 flex flex-col gap-6">
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

          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-emerald-600" /> Rendimiento en Ventas Especiales</h3>
            <div className="flex flex-col gap-3">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                <span className="text-xs text-slate-500">Artículos Autorizados Vendidos</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{metricasAutorizadas.cantidad}</span>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex flex-col gap-3">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 border-b border-emerald-200/60 dark:border-emerald-800/50 pb-2">
                  Total Generado (Autorizaciones)
                </span>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-emerald-700/80 dark:text-emerald-500">Mes pasado ({metricasAutorizadas.nombreMesPasado})</span>
                  <span className="font-bold text-emerald-700/80 dark:text-emerald-500">${metricasAutorizadas.totalMesPasado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">Mes actual ({metricasAutorizadas.nombreMesActual})</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">${metricasAutorizadas.totalMesActual.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="efecto-cristal w-full min-w-0 p-4 sm:p-6 rounded-2xl border border-slate-200/50 dark:border-white/10">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Network size={20} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Sincronización en Red Local (LAN)</span>
            </h3>
            {esMaestro ? (
              <div className="flex min-w-0 items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                <Server className="text-indigo-600 dark:text-indigo-400 shrink-0" size={32} />
                <div className="flex flex-col">
                  <span className="font-bold text-indigo-800 dark:text-indigo-300">Este equipo es el Cerebro</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 leading-tight">Los demás dispositivos se conectan y sincronizan automáticamente con este equipo.</span>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-white/10">
                <div className="w-full min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone size={18} className="text-slate-500" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Conectarse al Cerebro</p>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <input
                      type="text"
                      value={inputIpConexion}
                      onChange={(e) => setInputIpConexion(e.target.value)}
                      placeholder="IP (ej. 192.168.1.75)"
                      className="w-full min-w-0 flex-1 sm:w-auto bg-white dark:bg-slate-950 font-mono border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      onClick={() => setEscaneandoQR(true)}
                      className="shrink-0 px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                      title="Escanear QR del Cerebro"
                    >
                      <QrCode size={18} />
                    </button>
                    <button
                      onClick={() => { setIpMaestro(inputIpConexion); window.location.reload(); }}
                      className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                    >
                      Conectar
                    </button>
                  </div>
                </div>
                <div className="flex w-full min-w-0 items-center justify-center gap-2 border-t border-slate-200 p-3 dark:border-white/10">
                  {conectadoLAN ? (
                    <>
                      <Wifi size={20} className="text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-600">Conectado</span>
                    </>
                  ) : (
                    <>
                      <WifiOff size={20} className="text-red-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-red-600">Desconectado</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 lg:col-span-2 flex flex-col gap-6">
          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex-1">
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