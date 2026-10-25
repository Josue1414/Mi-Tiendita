// src/tipos/producto.ts
export interface LoteProducto {
  id: string;
  cantidad: number;
  fecha_caducidad?: string;
  dias_alerta?: number;
  fecha_ingreso: string;
  agregado_por: string;
  editado_por?: string;
  fecha_edicion?: string;
}

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
  unidad: "PIEZA" | "KG" | "GRAMO" | "LITRO" | "MILILITRO" | "MILIGRAMO" | "PAQUETE" | "SOBRE" | "DOCENA";
  precio: number;
  costo: number;
  descuento_porcentaje: number;
  activo: boolean;
  imagen_url?: string;
  imagen_archivo?: string;
  requiere_autorizacion?: boolean;
  mensaje_autorizacion?: string;
  permite_foto_autorizacion?: boolean;
  lotes?: LoteProducto[];
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

export function abreviaturaUnidad(unidad: Producto["unidad"]): string {
  const abreviaturas: Record<Producto["unidad"], string> = {
    PIEZA: "pza",
    KG: "kg",
    GRAMO: "g",
    LITRO: "L",
    MILILITRO: "ml",
    MILIGRAMO: "mg",
    PAQUETE: "paq",
    SOBRE: "sob",
    DOCENA: "doc",
  };
  return abreviaturas[unidad];
}
