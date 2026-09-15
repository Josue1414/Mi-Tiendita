import { useState } from "react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { AlertTriangle, PackageOpen, ArrowRight, Layers } from "lucide-react";
import { cn } from "../utilidades/utils";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import { tieneAlertaStock } from "../utilidades/stock";

export default function VistaStockBajo() {
  const { productos } = useEstadoInventario();
  const { setSeccionActual } = useEstadoNavegacion();
  const { trabajadorActivo } = useEstadoTrabajadores();

  // Estado para controlar qué filtro está activo
  const [filtro, setFiltro] = useState<"todas" | "por-terminar" | "agotados">("todas");

  // Permisos
  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  
  const puedeEditar = esDueño || esSupervisor || trabajadorActivo?.permisos?.editarProductos;
  const puedeAjustarStock = esDueño || esSupervisor || trabajadorActivo?.permisos?.actualizarStockCodigo;

  // Clasificación de productos
  const productosBajos = productos.filter(tieneAlertaStock);
  const criticos = productosBajos.filter(p => p.stock_actual === 0);
  const porTerminar = productosBajos.filter(p => p.stock_actual > 0);

  // Aplicar el filtro seleccionado
  const productosFiltrados = 
    filtro === "todas" ? productosBajos : 
    filtro === "por-terminar" ? porTerminar : 
    criticos;

  return (
    <div className="w-full h-full flex flex-col p-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400">
              <AlertTriangle size={24} />
            </div>
            Alertas de Stock
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Productos que requieren reabastecimiento inmediato.
          </p>
        </div>

        {/* Botones de Filtro Interactivos */}
        <div className="flex flex-wrap w-full xl:w-auto gap-3">
          <button 
            type="button"
            onClick={() => setFiltro("todas")}
            className={cn(
              "flex flex-1 xl:flex-none flex-col items-end px-4 py-2.5 rounded-xl border transition-all duration-200",
              filtro === "todas" 
                ? "bg-slate-800 border-slate-900 text-white dark:bg-slate-100 dark:border-white dark:text-slate-900 shadow-lg scale-[1.02]" 
                : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span className={cn("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1", filtro === "todas" ? "opacity-80" : "text-slate-500")}>
              <Layers size={12}/> Todas las Alertas
            </span>
            <span className={cn("text-2xl font-black mt-0.5", filtro === "todas" ? "" : "text-slate-700 dark:text-slate-300")}>
              {productosBajos.length}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setFiltro("por-terminar")}
            className={cn(
              "flex flex-1 xl:flex-none flex-col items-end px-4 py-2.5 rounded-xl border transition-all duration-200",
              filtro === "por-terminar" 
                ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20 scale-[1.02]" 
                : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/60"
            )}
          >
            <span className={cn("text-[11px] font-bold uppercase tracking-wider", filtro === "por-terminar" ? "text-amber-100" : "text-amber-700 dark:text-amber-400")}>
              Por Terminar
            </span>
            <span className={cn("text-2xl font-black mt-0.5", filtro === "por-terminar" ? "text-white" : "text-amber-800 dark:text-amber-500")}>
              {porTerminar.length}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setFiltro("agotados")}
            className={cn(
              "flex flex-1 xl:flex-none flex-col items-end px-4 py-2.5 rounded-xl border transition-all duration-200",
              filtro === "agotados" 
                ? "bg-red-600 border-red-700 text-white shadow-lg shadow-red-600/20 scale-[1.02]" 
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60"
            )}
          >
            <span className={cn("text-[11px] font-bold uppercase tracking-wider", filtro === "agotados" ? "text-red-200" : "text-red-700 dark:text-red-400")}>
              Agotados (Críticos)
            </span>
            <span className={cn("text-2xl font-black mt-0.5", filtro === "agotados" ? "text-white" : "text-red-800 dark:text-red-500")}>
              {criticos.length}
            </span>
          </button>
        </div>
      </div>

      <div className="efecto-cristal rounded-2xl overflow-hidden flex-1 flex flex-col border border-slate-200/50 dark:border-white/10">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="p-4">Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Nivel Actual</th>
                <th className="p-4">Mínimo Requerido</th>
                <th className="p-4 text-center">Estado</th>
                {(puedeEditar || puedeAjustarStock) && <th className="p-4 text-center">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/10">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <PackageOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">Todo en orden</p>
                    <p className="text-sm mt-1">No hay productos en esta categoría de alerta.</p>
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((producto) => {
                  const esCritico = producto.stock_actual === 0;
                  return (
                    <tr key={producto.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors text-slate-900 dark:text-slate-100">
                      <td className="p-4 font-medium">
                        <div className="flex items-center gap-3 text-left">
                          <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-10 w-10 shrink-0 rounded-lg object-cover text-sm" />
                          <span>{producto.nombre}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 text-sm">{producto.categoria || "Sin categoría"}</td>
                      <td className="p-4 font-bold text-lg">{producto.stock_actual} <span className="text-xs font-normal text-slate-400">{producto.unidad.toLowerCase()}</span></td>
                      <td className="p-4 text-slate-500">{producto.stock_minimo}</td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase",
                          esCritico 
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {esCritico ? "Agotado" : "Bajo"}
                        </span>
                      </td>
                      {(puedeEditar || puedeAjustarStock) && (
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setSeccionActual("nuevo-producto", producto.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            Actualizar <ArrowRight size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}