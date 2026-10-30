// src/vistas/pos/CarritoVenta.tsx
import type { ChangeEvent } from "react";
import { CreditCard, History, Minus, Plus, Printer, ShoppingCart, Tag, Trash2 } from "lucide-react";
import type { ItemCarrito, TipoDescuento } from "../../estado/estadoCarrito";
import type { Producto } from "../../tipos/producto";
import { abreviaturaUnidad } from "../../tipos/producto";
import { estadoCaducidad } from "../../utilidades/lotes";
import { cn } from "../../utilidades/utils";
import ImagenLocal from "../../componentes/ui/ImagenLocal";
import type { ItemResaltadoPOS } from "./types";

interface CarritoVentaProps {
  modo?: "lateral" | "camara";
  items: ItemCarrito[];
  productos: Producto[];
  itemResaltado: ItemResaltadoPOS | null;
  subtotal: number;
  descuento: number;
  total: number;
  tipoDescuento: TipoDescuento;
  inputDescuento: string;
  impresionAutomatica: boolean;
  teclaCobro: string;
  hayVentas: boolean;
  alVerDescripcion: (producto: Producto) => void;
  alCancelar: (accion: () => void) => void;
  alActualizarCantidad: (id: string, cantidad: number) => void;
  alAplicarDescuento: (event: ChangeEvent<HTMLInputElement>) => void;
  alCambiarTipoDescuento: (tipo: TipoDescuento) => void;
  alCambiarImpresionAutomatica: (valor: boolean) => void;
  alImprimirUltimo: () => void;
  alLimpiarCarrito: () => void;
  alAbrirCobro: () => void;
}

export default function CarritoVenta({
  modo = "lateral",
  items,
  productos,
  itemResaltado,
  subtotal,
  descuento,
  total,
  tipoDescuento,
  inputDescuento,
  impresionAutomatica,
  teclaCobro,
  hayVentas,
  alVerDescripcion,
  alCancelar,
  alActualizarCantidad,
  alAplicarDescuento,
  alCambiarTipoDescuento,
  alCambiarImpresionAutomatica,
  alImprimirUltimo,
  alLimpiarCarrito,
  alAbrirCobro,
}: CarritoVentaProps) {
  return (
    <div className={modo === "lateral" ? "w-full md:w-[min(35%,380px)] flex flex-col gap-4 shrink-0" : "w-full flex flex-col gap-3 flex-1 min-h-0"}>
      <div className={cn("efecto-cristal rounded-2xl p-4 flex flex-col min-h-[360px] h-full border border-slate-200/50 dark:border-white/10")}>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3 text-slate-900 dark:text-slate-100 shrink-0">
          <ShoppingCart size={20} className="text-emerald-600 dark:text-emerald-400" />
          Ticket de Venta
        </h2>

        <div
          className={cn(
            "flex-1 min-h-[100px] overflow-y-auto pr-1",
            modo === "camara" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start" : "flex flex-col gap-2"
          )}
        >
          {items.length === 0 ? (
            <div className={cn("flex flex-col items-center justify-center text-slate-400 gap-2 h-full min-h-[120px]", modo === "camara" && "col-span-full")}>
              <ShoppingCart size={40} className="opacity-20 mb-1" />
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => {
              const producto = productos.find((actual) => actual.id === item.producto_id);
              const tieneLoteVencido = producto?.lotes?.some(
                (lote) => lote.cantidad > 0 && estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta) === "vencido"
              ) ?? false;

              return (
                <div
                  key={`${item.id}-${itemResaltado?.id === item.id ? itemResaltado.version : 0}`}
                  onDoubleClick={() => {
                    if (producto) alVerDescripcion(producto);
                  }}
                  className={cn(
                    "flex gap-2 p-2 bg-slate-50/80 dark:bg-slate-900/50 rounded-lg border border-slate-200/50 dark:border-white/5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700/50 transition-colors",
                    itemResaltado?.id === item.id && "carrito-item-agregado",
                    modo === "camara" && "h-fit"
                  )}
                  title="Doble clic para ver descripción"
                >
                  <ImagenLocal
                    nombreArchivo={item.imagen_url || item.imagen_archivo}
                    nombreProducto={item.nombre}
                    className="w-12 h-12 rounded-md object-cover border border-slate-200 dark:border-white/10 shrink-0 bg-white"
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-slate-900 dark:text-slate-100 text-xs leading-tight line-clamp-2 pr-2">
                        {item.nombre}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        ${item.subtotal.toFixed(2)}
                      </span>
                    </div>
                    {tieneLoteVencido && (
                      <span className="mt-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                        Valida la fecha de caducidad
                      </span>
                    )}

                    <div className="flex justify-between items-center mt-auto pt-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        ${item.precio.toFixed(2)}/{abreviaturaUnidad(item.unidad)}
                      </span>

                      <div
                        className="flex items-center bg-white dark:bg-slate-800 rounded-md border border-slate-200/50 dark:border-white/10 shadow-sm overflow-hidden"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            const decremento = item.unidad === "KG" || item.unidad === "LITRO" ? 0.05 : 1;
                            const nuevaCantidad = item.cantidad - decremento;
                            if (nuevaCantidad <= 0) {
                              alCancelar(() => alActualizarCantidad(item.id, nuevaCantidad));
                            } else {
                              alActualizarCantidad(item.id, nuevaCantidad);
                            }
                          }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-semibold w-9 text-center text-slate-900 dark:text-slate-100 tabular-nums">
                          {item.unidad === "KG" || item.unidad === "LITRO" ? item.cantidad.toFixed(3) : item.cantidad}
                        </span>
                        <button
                          onClick={() =>
                            alActualizarCantidad(
                              item.id,
                              item.cantidad + (item.unidad === "KG" || item.unidad === "LITRO" ? 0.05 : 1)
                            )
                          }
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/10 flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center px-1">
            <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 font-medium">
              <Tag size={14} /> Descuento
            </span>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-white/10">
                <button
                  onClick={() => alCambiarTipoDescuento("MONTO")}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-md font-bold transition-colors",
                    tipoDescuento === "MONTO"
                      ? "bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  $
                </button>
                <button
                  onClick={() => alCambiarTipoDescuento("PORCENTAJE")}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded-md font-bold transition-colors",
                    tipoDescuento === "PORCENTAJE"
                      ? "bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  %
                </button>
              </div>
              <div className="relative w-20">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                  {tipoDescuento === "MONTO" ? "$" : "%"}
                </span>
                <input
                  type="number"
                  min="0"
                  step={tipoDescuento === "MONTO" ? "1" : "5"}
                  value={inputDescuento}
                  onChange={alAplicarDescuento}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg pl-6 pr-2 py-1.5 text-right outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {descuento > 0 && (
            <div className="flex justify-between items-end px-1 opacity-70">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Subtotal</span>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 line-through">
                ${subtotal.toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-end px-1">
            <span className="text-slate-500 dark:text-slate-400 text-base font-medium">Total</span>
            <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              ${total.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between px-1 mt-1">
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors select-none">
              <input
                type="checkbox"
                checked={impresionAutomatica}
                onChange={(event) => alCambiarImpresionAutomatica(event.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
              />
              <Printer size={13} /> Imprimir automático
            </label>

            {hayVentas && (
              <button
                type="button"
                onClick={alImprimirUltimo}
                className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
              >
                <History size={13} /> Imprimir último
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={alLimpiarCarrito}
              disabled={items.length === 0}
              className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-100 dark:border-red-900/50"
              title="Vaciar Carrito"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={alAbrirCobro}
              disabled={items.length === 0}
              className="flex-1 flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/30 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              <CreditCard size={20} />
              Cobrar ({teclaCobro})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
