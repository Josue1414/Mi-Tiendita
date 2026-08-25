// src/estado/estadoCarrito.ts
import { create } from "zustand";
import { precioVenta, type Producto } from "../tipos/producto";

export interface ItemCarrito {
  id: string;
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  unidad: Producto["unidad"];
  subtotal: number;
  imagen_url?: string;
  stock_disponible?: number;
  autorizacion_confirmada?: boolean;
  evidencia_autorizacion?: string;
}

export type TipoDescuento = "MONTO" | "PORCENTAJE";

interface EstadoCarrito {
  items: ItemCarrito[];
  subtotal: number;
  descuento: number; // Monto real en dinero descontado
  valorDescuento: number; // Lo que el usuario escribió (ej. 10)
  tipoDescuento: TipoDescuento; // "MONTO" o "PORCENTAJE"
  total: number;
  agregarAlCarrito: (producto: Producto, cantidad: number, autorizacion?: { evidencia?: string }) => void;
  actualizarCantidad: (id: string, nuevaCantidad: number) => void;
  removerDelCarrito: (id: string) => void;
  setDescuento: (valor: number, tipo: TipoDescuento) => void;
  limpiarCarrito: () => void;
}

const calcularTotales = (items: ItemCarrito[], valorDescuento: number, tipoDescuento: TipoDescuento) => {
  const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
  let descuentoCalculado = 0;

  if (tipoDescuento === "PORCENTAJE") {
    // Aseguramos que el porcentaje esté entre 0 y 100
    const porcentajeSeguro = Math.max(0, Math.min(100, valorDescuento));
    descuentoCalculado = subtotal * (porcentajeSeguro / 100);
  } else {
    // Aseguramos que el descuento en monto no sea mayor al subtotal
    descuentoCalculado = Math.min(Math.max(0, valorDescuento), subtotal);
  }

  const total = subtotal - descuentoCalculado;
  
  return { subtotal, descuento: descuentoCalculado, total };
};

export const useEstadoCarrito = create<EstadoCarrito>((set) => ({
  items: [],
  subtotal: 0,
  descuento: 0,
  valorDescuento: 0,
  tipoDescuento: "MONTO",
  total: 0,

  agregarAlCarrito: (producto, cantidad, autorizacion) =>
    set((estado) => {
      const itemExistente = estado.items.find((i) => i.producto_id === producto.id);
      const precio = precioVenta(producto);
      const maximo = producto.controla_stock ? producto.stock_actual : Number.POSITIVE_INFINITY;
      const cantidadSolicitada = Math.min(cantidad, maximo);
      if (cantidadSolicitada <= 0) return estado;
      let nuevosItems;

      if (itemExistente) {
        const nuevaCantidad = Math.min(itemExistente.cantidad + cantidadSolicitada, maximo);
        if (nuevaCantidad === itemExistente.cantidad) return estado;
        nuevosItems = estado.items.map((i) =>
          i.producto_id === producto.id
            ? { ...i, cantidad: nuevaCantidad, subtotal: nuevaCantidad * i.precio, stock_disponible: producto.controla_stock ? producto.stock_actual : undefined }
            : i
        );
      } else {
        nuevosItems = [
          ...estado.items,
          {
            id: crypto.randomUUID(),
            producto_id: producto.id,
            nombre: producto.nombre,
            precio,
            cantidad: cantidadSolicitada,
            unidad: producto.unidad,
            subtotal: cantidadSolicitada * precio,
            imagen_url: producto.imagen_url,
            stock_disponible: producto.controla_stock ? producto.stock_actual : undefined,
            autorizacion_confirmada: Boolean(producto.requiere_autorizacion),
            evidencia_autorizacion: autorizacion?.evidencia,
          },
        ];
      }

      const totales = calcularTotales(nuevosItems, estado.valorDescuento, estado.tipoDescuento);
      return { items: nuevosItems, ...totales };
    }),

  actualizarCantidad: (id, nuevaCantidad) =>
    set((estado) => {
      if (nuevaCantidad <= 0) {
        const itemsFiltrados = estado.items.filter((i) => i.id !== id);
        const totales = calcularTotales(itemsFiltrados, estado.valorDescuento, estado.tipoDescuento);
        return { items: itemsFiltrados, ...totales };
      }

      const item = estado.items.find((i) => i.id === id);
      const cantidadLimitada = item?.stock_disponible === undefined
        ? nuevaCantidad
        : Math.min(nuevaCantidad, item.stock_disponible);
      const nuevosItems = estado.items.map((i) =>
        i.id === id ? { ...i, cantidad: cantidadLimitada, subtotal: cantidadLimitada * i.precio } : i
      );
      
      const totales = calcularTotales(nuevosItems, estado.valorDescuento, estado.tipoDescuento);
      return { items: nuevosItems, ...totales };
    }),

  removerDelCarrito: (id) =>
    set((estado) => {
      const nuevosItems = estado.items.filter((i) => i.id !== id);
      const totales = calcularTotales(nuevosItems, estado.valorDescuento, estado.tipoDescuento);
      return { items: nuevosItems, ...totales };
    }),

  setDescuento: (valor, tipo) =>
    set((estado) => {
      const valorValido = Math.max(0, valor);
      const totales = calcularTotales(estado.items, valorValido, tipo);
      return { valorDescuento: valorValido, tipoDescuento: tipo, ...totales };
    }),

  limpiarCarrito: () => set({ items: [], subtotal: 0, descuento: 0, valorDescuento: 0, total: 0 }),
}));