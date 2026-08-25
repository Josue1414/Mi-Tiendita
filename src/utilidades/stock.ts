import type { Producto } from "../tipos/producto";

export function tieneAlertaStock(producto: Producto): boolean {
  return producto.controla_stock && producto.stock_actual <= producto.stock_minimo;
}
