// src/tipos/producto.ts
export interface Producto {
  id: string;
  nombre: string;
  codigo_barras: string;
  descripcion: string;
  categoria: string;
  ubicacion?: string;
  paquete?: string;
  stock_actual: number;
  stock_minimo: number;
  controla_stock: boolean;
  unidad: "PIEZA" | "KG" | "LITRO" | "PAQUETE";
  precio: number;
  costo: number;
  descuento_porcentaje: number;
  activo: boolean;
  imagen_url?: string;
  requiere_autorizacion?: boolean;
  mensaje_autorizacion?: string;
  permite_foto_autorizacion?: boolean;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
}

export function precioVenta(producto: Pick<Producto, "precio" | "descuento_porcentaje">): number {
  const descuento = Math.max(0, Math.min(100, producto.descuento_porcentaje || 0));
  return Math.round(producto.precio * (1 - descuento / 100) * 100) / 100;
}
