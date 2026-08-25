// src/estado/estadoVentas.ts
import { create } from "zustand";
import type { ItemCarrito } from "./estadoCarrito";
import { guardarRegistro, obtenerRegistros } from "../servicios/db";

export interface Venta {
  id: string;
  fecha: string;
  trabajador: string;
  articulos: ItemCarrito[];
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: string;
}

interface EstadoVentas {
  ventas: Venta[];
  cargando: boolean;
  cargarVentas: () => Promise<void>;
  agregarVenta: (venta: Venta) => Promise<void>;
}

export const useEstadoVentas = create<EstadoVentas>((set) => ({
  ventas: [],
  cargando: true,

  // Carga el historial ordenado por fecha (el más reciente primero)
  cargarVentas: async () => {
    set({ cargando: true });
    try {
      const data = await obtenerRegistros("ventas");
      const ventasOrdenadas = (data as Venta[]).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      set({ ventas: ventasOrdenadas, cargando: false });
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      set({ cargando: false });
    }
  },

  agregarVenta: async (venta) => {
    try {
      await guardarRegistro("ventas", venta);
      set((estado) => ({ ventas: [venta, ...estado.ventas] }));
    } catch (error) {
      console.error("Error al guardar la venta:", error);
    }
  },
}));