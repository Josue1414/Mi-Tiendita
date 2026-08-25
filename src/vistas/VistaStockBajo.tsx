// src/vistas/VistaStockBajo.tsx
import { useEstadoInventario } from "../estado/estadoInventario";
import { AlertTriangle, PackageOpen, ArrowRight } from "lucide-react";
import { cn } from "../utilidades/utils";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import { tieneAlertaStock } from "../utilidades/stock";

export default function VistaStockBajo() {
  const { productos } = useEstadoInventario();
  const { setSeccionActual } = useEstadoNavegacion();

  // Filtramos SOLO los que controlan stock y están en o por debajo del mínimo
  const productosBajos = productos.filter(tieneAlertaStock);
  const criticos = productosBajos.filter(p => p.stock_actual === 0);

  return (
    <div className="w-full h-full flex flex-col p-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
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

        <div className="flex gap-4">
          <div className="flex flex-col items-end px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
            <span className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Sin Stock (Críticos)</span>
            <span className="text-2xl font-bold text-red-700 dark:text-red-500">{criticos.length}</span>
          </div>
        </div>
      </div>

      <div className="efecto-cristal rounded-2xl overflow-hidden flex-1 flex flex-col border border-slate-200/50 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="p-4">Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Nivel Actual</th>
                <th className="p-4">Mínimo Requerido</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/10">
              {productosBajos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <PackageOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">Todo en orden</p>
                    <p className="text-sm mt-1">No hay productos con stock bajo en este momento.</p>
                  </td>
                </tr>
              ) : (
                productosBajos.map((producto) => {
                  const esCritico = producto.stock_actual === 0;
                  return (
                    <tr key={producto.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors text-slate-900 dark:text-slate-100">
                      <td className="p-4 font-medium">
                        <button onClick={() => setSeccionActual("nuevo-producto", producto.id)} className="flex items-center gap-3 text-left hover:text-emerald-600">
                          <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-10 w-10 shrink-0 rounded-lg object-cover text-sm" />
                          <span>{producto.nombre}</span>
                        </button>
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
                          {esCritico ? "Crítico" : "Bajo"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => setSeccionActual("nuevo-producto", producto.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          Actualizar <ArrowRight size={14} />
                        </button>
                      </td>
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