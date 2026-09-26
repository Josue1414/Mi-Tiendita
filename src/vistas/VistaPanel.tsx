// Coordenada: src/vistas/VistaPanel.tsx
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { 
  DollarSign, TrendingUp, AlertTriangle, 
  ShoppingCart, Plus, Bell, History, ArrowRight, Calendar, Printer, CreditCard, Banknote, Ban
} from "lucide-react";
import { cn } from "../utilidades/utils";
import { useState } from "react";
import PanelAutorizaciones from "../componentes/PanelAutorizaciones";
import { tieneAlertaStock } from "../utilidades/stock";
import { imprimirTicket } from "../utilidades/impresion";

const obtenerFechaLocal = () => {
  const fecha = new Date();
  const offset = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - offset).toISOString().slice(0, 10);
};

export default function VistaPanel() {
  const { ventas } = useEstadoVentas();
  const { productos } = useEstadoInventario();
  const { setSeccionActual } = useEstadoNavegacion();
  const { nombreTienda } = useEstadoConfiguracion();
  
  const [fechaSeleccionada, setFechaSeleccionada] = useState(obtenerFechaLocal());

  const hoy = new Date(`${fechaSeleccionada}T12:00:00`);
  const esMismoDia = (fechaISO: string) => {
    if (!fechaISO) return false;
    const f = new Date(fechaISO);
    return f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
  };

  // Filtrar ventas de hoy y excluir canceladas
  const ventasHoy = ventas.filter(v => esMismoDia(v.fecha) && !v.cancelada);
  
  const totalIngresosHoy = ventasHoy.reduce((acc, v) => acc + (v.total || 0), 0);
  const totalEfectivoHoy = ventasHoy.filter(v => v.metodoPago === "EFECTIVO").reduce((acc, v) => acc + (v.total || 0), 0);
  const totalElectronicoHoy = ventasHoy.filter(v => v.metodoPago === "TARJETA" || v.metodoPago === "TRANSFERENCIA").reduce((acc, v) => acc + (v.total || 0), 0);

  let costoTotalHoy = 0;
  ventasHoy.forEach(venta => {
    venta.articulos.forEach(item => {
      const productoDb = productos.find(p => p.id === item.producto_id);
      const costoUnidad = productoDb ? productoDb.costo : 0;
      costoTotalHoy += costoUnidad * item.cantidad;
    });
  });
  const gananciaHoy = totalIngresosHoy - costoTotalHoy;

  // NUEVA LÓGICA: Separación de alertas Rojas (Críticas) y Amarillas (Bajas)
  const productosBajos = productos.filter(tieneAlertaStock);
  const alertasRojas = productosBajos.filter(p => p.stock_actual <= 0).length;
  const alertasAmarillas = productosBajos.filter(p => p.stock_actual > 0).length;

  const conteoVentas: Record<string, { nombre: string; cantidad: number }> = {};
  ventas.filter(v => !v.cancelada).forEach(venta => {
    venta.articulos.forEach(item => {
      if (!conteoVentas[item.producto_id]) {
        conteoVentas[item.producto_id] = { nombre: item.nombre, cantidad: 0 };
      }
      conteoVentas[item.producto_id].cantidad += item.cantidad;
    });
  });

  const topProductos = Object.values(conteoVentas)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const maxCantidadTop = topProductos.length > 0 ? topProductos[0].cantidad : 1;

  const ventasRecientes = [...ventas]
    .filter(v => !v.cancelada)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 5);

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      
      {/* Estilos inyectados para la vibración de la campana */}
      <style>{`
        @keyframes vibrarCampana {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          45% { transform: rotate(-10deg); }
          60% { transform: rotate(5deg); }
          75% { transform: rotate(-5deg); }
        }
        .campana-vibrando { 
          animation: vibrarCampana 0.6s ease-in-out infinite; 
          color: #ef4444; 
        }
      `}</style>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Panel Principal</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Resumen de ventas y ganancias del día seleccionado.</p>
        <label className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-black/30 dark:text-slate-300">
          <Calendar size={15} className="text-emerald-600" />
          <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} className="bg-transparent outline-none dark:text-slate-100" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="efecto-cristal p-5 rounded-2xl flex items-center gap-4 border border-slate-200/50 dark:border-white/10">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ventas Totales</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${totalIngresosHoy.toFixed(2)}</p>
          </div>
        </div>

        <div className="efecto-cristal p-5 rounded-2xl flex items-center gap-4 border border-slate-200/50 dark:border-white/10">
          <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
            <Banknote size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Cobrado Efectivo</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${totalEfectivoHoy.toFixed(2)}</p>
          </div>
        </div>

        <div className="efecto-cristal p-5 rounded-2xl flex items-center gap-4 border border-slate-200/50 dark:border-white/10">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <CreditCard size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Cobrado Tarjeta/Transf.</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${totalElectronicoHoy.toFixed(2)}</p>
          </div>
        </div>

        <div className="efecto-cristal p-5 rounded-2xl flex items-center gap-4 border border-slate-200/50 dark:border-white/10">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Ganancia Neta</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">${gananciaHoy.toFixed(2)}</p>
          </div>
        </div>

        <div className="efecto-cristal p-5 rounded-2xl flex items-center gap-4 border border-slate-200/50 dark:border-white/10">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
            <Ban size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Canceladas (Hoy)</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {ventas.filter(v => esMismoDia(v.fecha) && v.cancelada).length}
            </p>
          </div>
        </div>

        {/* Tarjeta de KPI de Alertas (Actualizada con desglose visual) */}
        <div className="efecto-cristal p-5 rounded-2xl flex items-center gap-4 border border-slate-200/50 dark:border-white/10">
          <div className={cn("p-3 rounded-xl", alertasRojas > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
            <AlertTriangle size={24} className={alertasRojas > 0 ? "campana-vibrando" : ""} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Alertas de Stock</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {alertasRojas > 0 && <span className="text-sm font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-md">{alertasRojas} Críticos</span>}
              {alertasAmarillas > 0 && <span className="text-sm font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-md">{alertasAmarillas} Bajos</span>}
              {alertasRojas === 0 && alertasAmarillas === 0 && <span className="text-xl font-bold text-slate-900 dark:text-slate-100">0</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          ⚡ Acciones Rápidas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => setSeccionActual("pos")} className="efecto-cristal p-4 rounded-xl border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400">
            <ShoppingCart size={20} />
            <span className="text-xs font-semibold">Nueva Venta</span>
          </button>
          <button onClick={() => setSeccionActual("nuevo-producto")} className="efecto-cristal p-4 rounded-xl border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400">
            <Plus size={20} />
            <span className="text-xs font-semibold">Agregar Producto</span>
          </button>
          <button onClick={() => setSeccionActual("historial")} className="efecto-cristal p-4 rounded-xl border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400">
            <History size={20} />
            <span className="text-xs font-semibold">Ver Historial</span>
          </button>
          {/* Botón de Ver Alertas con vibración */}
          <button onClick={() => setSeccionActual("stock-bajo")} className="efecto-cristal p-4 rounded-xl border border-slate-200/50 dark:border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400">
            <Bell size={20} className={alertasRojas > 0 ? "campana-vibrando" : ""} />
            <span className="text-xs font-semibold">Ver Alertas</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center justify-between">
            Productos Más Vendidos
            <span className="text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Histórico</span>
          </h2>
          <div className="flex flex-col gap-4 flex-1 justify-center">
            {topProductos.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-4">Aún no hay ventas registradas.</p>
            ) : (
              topProductos.map((prod, index) => (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span className="truncate pr-4">{prod.nombre}</span>
                    <span>{prod.cantidad} unds</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${(prod.cantidad / maxCantidadTop) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="efecto-cristal p-5 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center justify-between">
            Ventas Recientes
            <button onClick={() => setSeccionActual("historial")} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight size={14} />
            </button>
          </h2>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200/50 dark:border-white/10 text-slate-500 dark:text-slate-400 text-xs">
                  <th className="pb-2 font-medium">Hora</th>
                  <th className="pb-2 font-medium">Trabajador</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-center pl-4">Método</th>
                  <th className="pb-2 font-medium text-center">Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50 dark:divide-white/5">
                {ventasRecientes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">No hay ventas recientes.</td>
                  </tr>
                ) : (
                  ventasRecientes.map((venta) => (
                    <tr key={venta.id} className="text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 text-xs">{new Date(venta.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2.5 text-xs">{venta.trabajador.split(" ")[0]}</td>
                      <td className="py-2.5 font-bold text-emerald-600 dark:text-emerald-400 text-right">${venta.total.toFixed(2)}</td>
                      <td className="py-2.5 text-center pl-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase",
                          venta.metodoPago === "EFECTIVO" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          venta.metodoPago === "TARJETA" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        )}>
                          {venta.metodoPago === "TRANSFERENCIA" ? "TRANSF." : venta.metodoPago}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <button 
                          onClick={() => imprimirTicket(venta, nombreTienda)} 
                          className="p-1.5 mx-auto flex items-center justify-center text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" 
                          title="Reimprimir Ticket"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LÓGICA DE SCROLL: Envolver PanelAutorizaciones en un div con max-h y overflow */}
        <div className="mb-6 lg:col-span-2">
          <div className="max-h-[450px] overflow-y-auto pr-2 scrollbar-thin rounded-2xl">
            <PanelAutorizaciones productos={productos} ventas={ventas} />
          </div>
        </div>
      </div>
    </div>
  );
}