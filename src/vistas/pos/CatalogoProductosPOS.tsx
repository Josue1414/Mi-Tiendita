// src/vistas/pos/CatalogoProductosPOS.tsx
import type { KeyboardEvent, ReactNode } from "react";
import { Camera, ChevronDown, ChevronUp, LayoutGrid, Plus, Scale, ScanBarcode, Search } from "lucide-react";
import type { Categoria, Producto } from "../../tipos/producto";
import { precioVenta } from "../../tipos/producto";
import { colorConAlpha, colorTextoSobre } from "../../utilidades/coloresCategoria";
import { cn } from "../../utilidades/utils";
import ImagenLocal from "../../componentes/ui/ImagenLocal";
import PanelCamaraEscaner from "../../componentes/pos/PanelCamaraEscaner";
import PanelEscaner from "../../componentes/pos/PanelEscaner";
import type { ModoVistaPOS } from "./types";

interface CatalogoProductosPOSProps {
  busqueda: string;
  categoriaActiva: string;
  categorias: Categoria[];
  productos: Producto[];
  modoVista: ModoVistaPOS;
  esVistaMovil: boolean;
  productoEnfoque: Producto | null;
  camaraVisible: boolean;
  mantenerCamaraActiva: boolean;
  carritoCamara: ReactNode;
  alCambiarBusqueda: (busqueda: string) => void;
  alPresionarEnter: (event: KeyboardEvent<HTMLInputElement>) => void;
  alCambiarModoVista: (modo: ModoVistaPOS) => void;
  alCambiarCategoria: (categoria: string) => void;
  alEnfocarProducto: (producto: Producto) => void;
  alAgregarProducto: (producto: Producto) => void;
  alCambiarVisibilidadCamara: () => void;
  alEscanear: (codigo: string) => void;
}

export default function CatalogoProductosPOS({
  busqueda,
  categoriaActiva,
  categorias,
  productos,
  modoVista,
  esVistaMovil,
  productoEnfoque,
  camaraVisible,
  mantenerCamaraActiva,
  carritoCamara,
  alCambiarBusqueda,
  alPresionarEnter,
  alCambiarModoVista,
  alCambiarCategoria,
  alEnfocarProducto,
  alAgregarProducto,
  alCambiarVisibilidadCamara,
  alEscanear,
}: CatalogoProductosPOSProps) {
  return (
    <div className="flex-1 min-w-0 min-h-[420px] flex flex-col gap-3">
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            data-escaner="true"
            placeholder="Buscar o escanear código de barras..."
            value={busqueda}
            onChange={(event) => alCambiarBusqueda(event.target.value)}
            onKeyDown={alPresionarEnter}
            className="w-full efecto-cristal pl-9 pr-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm h-full"
          />
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => alCambiarModoVista("cuadricula")}
            className={cn(
              "p-2 rounded-lg flex items-center justify-center transition-all",
              modoVista === "cuadricula"
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
            title="Vista Cuadrícula"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            onClick={() => alCambiarModoVista("escaner")}
            className={cn(
              "p-2 rounded-lg flex items-center justify-center transition-all",
              modoVista === "escaner"
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
            title="Vista Escáner"
          >
            <ScanBarcode size={20} />
          </button>
          <button
            onClick={() => alCambiarModoVista("camara")}
            className={cn(
              "p-2 rounded-lg flex items-center justify-center transition-all",
              modoVista === "camara"
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
            title="Cámara Escáner"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      {modoVista === "cuadricula" ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-1">
            <button
              onClick={() => alCambiarCategoria("todas")}
              className={cn(
                "h-8 shrink-0 px-3 rounded-full text-xs font-semibold border",
                categoriaActiva === "todas"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                  : "border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300"
              )}
            >
              Todas
            </button>
            {categorias.map((categoria) => {
              const activa = categoriaActiva === categoria.nombre;
              return (
                <button
                  key={categoria.id}
                  onClick={() => alCambiarCategoria(categoria.nombre)}
                  className="h-8 shrink-0 px-3 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: activa ? categoria.color : "transparent",
                    color: activa ? colorTextoSobre(categoria.color) : categoria.color,
                    borderColor: categoria.color,
                  }}
                >
                  {categoria.nombre}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-2 pb-2 min-h-[280px] flex-1">
            {productos.map((producto) => {
              const final = precioVenta(producto);
              const color = categorias.find((categoria) => categoria.nombre === producto.categoria)?.color;
              const seleccionado = esVistaMovil && productoEnfoque?.id === producto.id;
              const esAgotado = producto.controla_stock && producto.stock_actual <= 0;
              const esBajoStock =
                producto.controla_stock && producto.stock_actual <= producto.stock_minimo && producto.stock_actual > 0;

              return (
                <div
                  key={producto.id}
                  onClick={() => {
                    if (esVistaMovil) alEnfocarProducto(producto);
                  }}
                  onDoubleClick={() => {
                    if (!esVistaMovil) alAgregarProducto(producto);
                  }}
                  title={esVistaMovil ? "Toca para mostrar Agregar" : "Doble clic para agregar al carrito"}
                  className={cn(
                    "p-2 rounded-xl flex items-center text-left hover:scale-[1.02] transition-transform border relative overflow-hidden group gap-2 min-h-[105px]",
                    seleccionado && "ring-2 ring-emerald-500",
                    esAgotado
                      ? "bg-red-50/80 border-red-300 dark:bg-red-950/40 dark:border-red-800/60"
                      : esBajoStock
                        ? "bg-amber-50/80 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800/60"
                        : "efecto-cristal border-slate-200/50 dark:border-white/10"
                  )}
                >
                  <ImagenLocal
                    nombreArchivo={producto.imagen_url || producto.imagen_archivo}
                    nombreProducto={producto.nombre}
                    className="w-16 h-16 rounded-lg shrink-0 object-cover"
                  />
                  <div className="flex flex-col flex-1 h-full py-1 overflow-hidden">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-tight">
                      {producto.nombre}
                    </span>
                    {producto.categoria && color && (
                      <span
                        className="self-start mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide"
                        style={{ backgroundColor: colorConAlpha(color, 0.16), color }}
                      >
                        {producto.categoria}
                      </span>
                    )}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-auto text-base flex items-baseline gap-1.5">
                      ${final.toFixed(2)}
                      {(producto.descuento_porcentaje || 0) > 0 && (
                        <span className="text-[10px] line-through text-slate-400 font-normal">
                          ${producto.precio.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </div>
                  {esVistaMovil && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        alAgregarProducto(producto);
                      }}
                      className={cn(
                        "absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-bold text-white shadow-md transition-opacity",
                        seleccionado ? "opacity-100" : "opacity-0 pointer-events-none"
                      )}
                    >
                      {producto.unidad === "KG" || producto.unidad === "LITRO" ? <Scale size={16} /> : <Plus size={16} />}
                      <span className="sr-only">Agregar {producto.nombre}</span>
                      <span className="hidden sm:inline">Agregar</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : modoVista === "escaner" ? (
        <PanelEscaner producto={productoEnfoque} />
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-3">
          <div className="efecto-cristal flex flex-col rounded-2xl border border-slate-200/50 dark:border-white/10 overflow-hidden shrink-0">
            <button
              onClick={alCambiarVisibilidadCamara}
              className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Camera size={16} className="text-emerald-600 dark:text-emerald-400" />
                Lector de Cámara
              </span>
              {camaraVisible ? (
                <ChevronUp size={16} className="text-slate-500" />
              ) : (
                <ChevronDown size={16} className="text-slate-500" />
              )}
            </button>

            {camaraVisible && (
              <div className="p-3 flex justify-center bg-white dark:bg-slate-950 border-t border-slate-200/50 dark:border-white/5 animate-in fade-in slide-in-from-top-2">
                <div className="w-[180px] max-w-[180px] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm">
                  <PanelCamaraEscaner alDetectar={alEscanear} activo={mantenerCamaraActiva} className="w-full" />
                </div>
              </div>
            )}
          </div>

          {carritoCamara}
        </div>
      )}
    </div>
  );
}
