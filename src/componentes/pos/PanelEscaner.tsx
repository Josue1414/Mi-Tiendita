// src/componentes/pos/PanelEscaner.tsx
import { PackageSearch, Tag, Layers } from "lucide-react";
import ImagenLocal from "../ui/ImagenLocal";
import { type Producto, precioVenta } from "../../tipos/producto";
import { useEstadoInventario } from "../../estado/estadoInventario";

interface Props {
  producto: Producto | null;
}

export default function PanelEscaner({ producto }: Props) {
  const { categorias } = useEstadoInventario();

  if (!producto) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 gap-4 min-h-[400px]">
        <PackageSearch size={64} className="opacity-50" />
        <div className="text-center">
          <p className="text-lg font-bold text-slate-500 dark:text-slate-300">Modo Escáner Activo</p>
          <p className="text-sm">Escanea un código de barras o selecciona un producto para ver sus detalles aquí.</p>
        </div>
      </div>
    );
  }

  const precio = precioVenta(producto);
  const colorCategoria = categorias.find((c) => c.nombre === producto.categoria)?.color || "#10b981";

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
      <div className="h-48 md:h-64 bg-slate-100 dark:bg-slate-800 relative flex justify-center items-center p-4">
        <ImagenLocal
          nombreArchivo={producto.imagen_url}
          nombreProducto={producto.nombre}
          className="w-full h-full object-contain drop-shadow-xl"
        />
        <div className="absolute top-4 right-4">
          <span 
            className="px-3 py-1 rounded-full text-xs font-bold shadow-sm"
            style={{ backgroundColor: colorCategoria, color: '#fff' }}
          >
            {producto.categoria || "Sin categoría"}
          </span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2 leading-tight">
          {producto.nombre}
        </h2>
        
        <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 my-4">
          ${precio.toFixed(2)} <span className="text-lg text-slate-500 font-medium">/ {producto.unidad}</span>
        </p>

        <div className="mt-auto grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Tag size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Código de Barras</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">{producto.codigo_barras || "N/A"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
              <Layers size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Existencias</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {producto.controla_stock ? `${producto.stock_actual} disponibles` : "No controla stock"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}