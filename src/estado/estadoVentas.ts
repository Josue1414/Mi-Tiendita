// src/estado/estadoVentas.ts
import { create } from "zustand";
import type { ItemCarrito } from "./estadoCarrito";
import { guardarRegistro, obtenerRegistros } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

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
      // 1. Guardar en disco duro local
      await guardarRegistro("ventas", venta);
      set((estado) => ({ ventas: [venta, ...estado.ventas] }));

      // 2. Sincronizar con Supabase
      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (tiendaId && session) {
          // Insertar encabezado de la venta
          await supabase.from('ventas').insert({
            id: venta.id,
            tienda_id: tiendaId,
            vendedor_id: session.user.id,
            trabajador_nombre: venta.trabajador,
            subtotal: venta.subtotal,
            descuento: venta.descuento,
            total: venta.total,
            metodo_pago: venta.metodoPago,
            created_at: venta.fecha
          });

          // Insertar el detalle de los productos vendidos
          const detalles = venta.articulos.map(art => ({
            venta_id: venta.id,
            producto_id: art.producto_id,
            nombre_producto: art.nombre,
            cantidad: art.cantidad,
            precio_unitario: art.precio,
            subtotal: art.subtotal,
            autorizacion_confirmada: art.autorizacion_confirmada || false,
            evidencia_nombre_archivo_local: null // Modificado: No requerimos enviar evidencia a la nube
          }));

          await supabase.from('venta_detalles').insert(detalles);
        }
      }
    } catch (error) {
      console.error("Error al guardar la venta:", error);
    }
  },
}));