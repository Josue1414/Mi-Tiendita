// src/componentes/ui/ModalGestionHistorial.tsx
import { useState } from "react";
import { X, FileSpreadsheet, Trash2, Calendar, AlertTriangle, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useEstadoVentas } from "../../estado/estadoVentas";
import * as XLSX from "xlsx";

interface PropsModalGestion {
  abierto: boolean;
  alCerrar: () => void;
}

// Función auxiliar para formatear fechas correctamente sin problemas de zona horaria
const formatearFechaLocal = (fecha: Date) => {
  const offset = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 10);
};

export default function ModalGestionHistorial({ abierto, alCerrar }: PropsModalGestion) {
  const { ventas, purgarVentasLocales } = useEstadoVentas();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mensaje, setMensaje] = useState<{ texto: string, tipo: 'exito' | 'error' } | null>(null);
  
  // Estados para controlar las vistas y animaciones del modal
  const [vistaConfirmacion, setVistaConfirmacion] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [eliminadoExito, setEliminadoExito] = useState(false);
  
  if (!abierto) return null;

  const fechaActual = new Date();
  const mesAnteriorDate = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1);
  const nombreMesAnterior = mesAnteriorDate.toLocaleDateString('es-MX', { month: 'long' });
  const mesCapitalizado = nombreMesAnterior.charAt(0).toUpperCase() + nombreMesAnterior.slice(1);

  const aplicarFiltroRapido = (tipo: "semana" | "mes" | "año") => {
    const hoy = new Date();
    
    if (tipo === "semana") {
      const fin = new Date(hoy);
      fin.setDate(fin.getDate() - 1);
      const inicio = new Date(fin);
      inicio.setDate(inicio.getDate() - 6);
      
      setFechaInicio(formatearFechaLocal(inicio));
      setFechaFin(formatearFechaLocal(fin));
    } else if (tipo === "mes") {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      
      setFechaInicio(formatearFechaLocal(inicio));
      setFechaFin(formatearFechaLocal(fin));
    } else if (tipo === "año") {
      const añoPasado = hoy.getFullYear() - 1;
      setFechaInicio(`${añoPasado}-01-01`);
      setFechaFin(`${añoPasado}-12-31`);
    }
    setMensaje(null);
  };

  const exportarExcel = () => {
    if (!fechaInicio || !fechaFin) {
      setMensaje({ texto: "Por favor selecciona la fecha de inicio y fin.", tipo: "error" });
      return;
    }

    const ventasRango = ventas.filter(v => {
      const fecha = v.fecha.slice(0, 10);
      return fecha >= fechaInicio && fecha <= fechaFin;
    });

    if (ventasRango.length === 0) {
      setMensaje({ texto: "No hay ventas en este rango de fechas para exportar.", tipo: "error" });
      return;
    }

    const datos = ventasRango.map(v => ({
      "ID Ticket": v.id,
      "Fecha": new Date(v.fecha).toLocaleString('es-MX'),
      "Cajero": v.trabajador,
      "Cant. Artículos": v.articulos.length,
      "Subtotal": v.subtotal,
      "Descuento": v.descuento,
      "Total Cobrado": v.total,
      "Método de Pago": v.metodoPago,
      "Estado": v.cancelada ? "CANCELADA" : "COMPLETADA"
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, `Reporte_Ventas_${fechaInicio}_al_${fechaFin}.xlsx`);
    
    setMensaje({ texto: `Se exportaron ${ventasRango.length} ventas con éxito.`, tipo: "exito" });
  };

  const solicitarEliminacion = () => {
    if (!fechaInicio || !fechaFin) {
      setMensaje({ texto: "Por favor selecciona la fecha de inicio y fin para poder purgar.", tipo: "error" });
      return;
    }
    setVistaConfirmacion(true);
    setMensaje(null);
  };

  const confirmarEliminacion = async () => {
    setEliminando(true);
    await purgarVentasLocales(fechaInicio, fechaFin);
    
    setEliminando(false);
    setEliminadoExito(true);
    setMensaje({ texto: "Historial purgado correctamente del almacenamiento local.", tipo: "exito" });
    
    // Esperamos 2 segundos mostrando el éxito antes de regresar al menú
    setTimeout(() => {
      setEliminadoExito(false);
      setVistaConfirmacion(false);
    }, 2000);
  };

  const cerrarModal = () => {
    setVistaConfirmacion(false);
    setEliminando(false);
    setEliminadoExito(false);
    setMensaje(null);
    alCerrar();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 overflow-hidden relative min-h-[300px] flex flex-col justify-center">
        
        {/* --- VISTA DE CONFIRMACIÓN Y ANIMACIONES --- */}
        {vistaConfirmacion ? (
          eliminando ? (
            // Animación de carga (Borrando)
            <div className="flex flex-col items-center text-center animate-in zoom-in duration-300 py-8">
              <Loader2 size={48} className="text-red-500 animate-spin mb-4" />
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Borrando historial...</h2>
              <p className="text-sm text-slate-500 mt-2">Por favor no cierres la ventana.</p>
            </div>
          ) : eliminadoExito ? (
            // Animación de éxito (Borrado terminado)
            <div className="flex flex-col items-center text-center animate-in zoom-in duration-300 py-8">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={40} className="animate-bounce" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">¡Historial Purgado!</h2>
              <p className="text-sm text-slate-500 mt-2">El espacio ha sido liberado con éxito.</p>
            </div>
          ) : (
            // Vista de advertencia antes de borrar
            <div className="flex flex-col items-center text-center animate-in slide-in-from-right-8 duration-300">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 border-4 border-red-50 dark:border-slate-800">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Purgar Historial Local</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Estás a punto de borrar <strong>definitivamente</strong> las ventas locales desde el <strong className="text-red-600 dark:text-red-400">{fechaInicio}</strong> hasta el <strong className="text-red-600 dark:text-red-400">{fechaFin}</strong>.<br/><br/>
                Esto liberará espacio en el disco duro de este equipo, pero <strong>no podrás recuperar estos tickets</strong>. ¿Estás completamente seguro?
              </p>
              <div className="flex w-full gap-3">
                <button onClick={() => setVistaConfirmacion(false)} className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                  <ArrowLeft size={16} /> Volver
                </button>
                <button onClick={confirmarEliminacion} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
                  Sí, eliminar para siempre
                </button>
              </div>
            </div>
          )
        ) : (
          /* --- VISTA PRINCIPAL (FORMULARIO) --- */
          <div className="animate-in slide-in-from-left-8 duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Calendar size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Gestión Avanzada</h2>
                  <p className="text-xs text-slate-500">Exporta o limpia el almacenamiento de ventas.</p>
                </div>
              </div>
              <button onClick={cerrarModal} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Selección rápida</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => aplicarFiltroRapido('semana')} className="flex-1 min-w-[100px] py-2 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-200/50 dark:border-white/5">Últimos 7 días</button>
                <button onClick={() => aplicarFiltroRapido('mes')} className="flex-1 min-w-[100px] py-2 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-200/50 dark:border-white/5">Último mes ({mesCapitalizado})</button>
                <button onClick={() => aplicarFiltroRapido('año')} className="flex-1 min-w-[100px] py-2 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-200/50 dark:border-white/5">Último año</button>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <label className="flex-1 text-xs font-medium text-slate-500">
                Fecha de Inicio
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 outline-none focus:border-emerald-500" />
              </label>
              <label className="flex-1 text-xs font-medium text-slate-500">
                Fecha Fin
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 outline-none focus:border-emerald-500" />
              </label>
            </div>

            {mensaje && (
              <div className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-xs font-bold ${mensaje.tipo === 'exito' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400'}`}>
                {mensaje.tipo === 'exito' ? <CheckCircle size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                <p>{mensaje.texto}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button onClick={exportarExcel} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/20">
                <FileSpreadsheet size={18} /> Exportar a Excel
              </button>
              
              <button onClick={solicitarEliminacion} className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-900/20 border border-slate-200 dark:border-white/10 dark:text-slate-300 dark:hover:text-red-400 p-3 rounded-xl font-bold transition-all group">
                <Trash2 size={18} className="group-hover:scale-110 transition-transform" /> Purgar Historial Local (Liberar espacio)
              </button>

              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3 mt-1">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-red-600 dark:text-red-400 leading-snug">
                  Nota importante: Al purgar, las ventas se eliminarán sin retorno únicamente de la memoria de este dispositivo para liberar espacio.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}