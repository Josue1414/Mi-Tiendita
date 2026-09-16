// src/estado/estadoVentas.ts
import { create } from "zustand";
import type { ItemCarrito } from "./estadoCarrito";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

const mapearVentaDesdeSupabase = (v: any): Venta => ({
  id: v.id,
  fecha: v.created_at,
  trabajador: v.trabajador_nombre,
  vendedor_id: v.vendedor_id,
  subtotal: v.subtotal,
  descuento: v.descuento,
  total: v.total,
  metodoPago: v.metodo_pago,
  cancelada: v.cancelada,
  articulos: (v.venta_detalles ?? []).map((d: any) => ({
    producto_id: d.producto_id,
    nombre: d.nombre_producto,
    cantidad: d.cantidad,
    precio: d.precio_unitario,
    subtotal: d.subtotal,
    autorizacion_confirmada: d.autorizacion_confirmada
  }))
});

export interface Venta {
  id: string;
  fecha: string;
  trabajador: string;
  vendedor_id?: string;
  articulos: ItemCarrito[];
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: string;
  cancelada?: boolean;
}

interface EstadoVentas {
  ventas: Venta[];
  cargando: boolean;
  cargarVentas: () => Promise<void>;
  agregarVenta: (venta: Venta) => Promise<void>;
  cancelarVenta: (id: string) => Promise<void>;
  sincronizarVenta: (payload: any) => Promise<void>;
  purgarVentasLocales: (fechaInicio: string, fechaFin: string) => Promise<void>; // NUEVA FUNCIÓN
}

export const useEstadoVentas = create<EstadoVentas>((set, get) => ({
  ventas: [],
  cargando: true,

  cargarVentas: async () => {
    set({ cargando: true });
    try {
      const tiendaId = await obtenerTiendaIdActual();

      if (navigator.onLine && tiendaId) {
        const { data: ventasNube, error } = await supabase
          .from('ventas')
          .select('*, venta_detalles(*)')
          .eq('tienda_id', tiendaId)
          .order('created_at', { ascending: false });

        if (!error && ventasNube) {
          const ventasMapeadas: Venta[] = ventasNube.map(mapearVentaDesdeSupabase);

          if (esEscritorio) {
            // Solo GUARDAMOS lo nuevo, YA NO ELIMINAMOS lo que falta en la nube.
            // Así protegemos el historial histórico de la PC cerebro.
            for (const v of ventasMapeadas) {
              await guardarRegistro("ventas", v);
            }

            // Cargamos absolutamente TODO el historial local para mostrarlo
            const dataLocal = await obtenerRegistros("ventas");
            const estadoVentas = (dataLocal as Venta[]).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            set({ ventas: estadoVentas, cargando: false });
          } else {
            // Si es web pura, solo mostramos las últimas 15h de la nube
            set({ ventas: ventasMapeadas, cargando: false });
          }
          return;
        }
      }

      // Fallback offline o LAN
      const dataLocal = await obtenerRegistros("ventas");
      const estadoVentas = (dataLocal as Venta[]).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      set({ ventas: estadoVentas, cargando: !navigator.onLine && !esEscritorio });

      if (!navigator.onLine) set({ cargando: false });
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      set({ cargando: false });
    }
  },

  agregarVenta: async (venta) => {
    try {
      await guardarRegistro("ventas", venta);
      set((estado) => ({ ventas: [venta, ...estado.ventas] }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (tiendaId && session) {
          venta.vendedor_id = session.user.id;
          const { error: errorVenta } = await supabase.from('ventas').insert({
            id: venta.id,
            tienda_id: tiendaId,
            vendedor_id: session.user.id,
            trabajador_nombre: venta.trabajador,
            subtotal: venta.subtotal,
            descuento: venta.descuento,
            total: venta.total,
            metodo_pago: venta.metodoPago,
            cancelada: false,
            created_at: venta.fecha
          });
          if (errorVenta) throw errorVenta;

          const detalles = venta.articulos.map(art => ({
            venta_id: venta.id,
            producto_id: art.producto_id,
            nombre_producto: art.nombre,
            cantidad: art.cantidad,
            precio_unitario: art.precio,
            subtotal: art.subtotal,
            autorizacion_confirmada: art.autorizacion_confirmada || false,
            evidencia_nombre_archivo_local: null 
          }));

          const { error: errorDetalles } = await supabase.from('venta_detalles').insert(detalles);
          if (errorDetalles) throw errorDetalles;
        }
      } else {
        await registrarPendienteSync({ tabla: 'ventas', operacion: 'AGREGAR', payload: venta });
      }
    } catch (error) {
      console.error("Error al guardar la venta:", error);
    }
  },

  cancelarVenta: async (id) => {
    try {
      set((estado) => ({
        ventas: estado.ventas.map((v) => v.id === id ? { ...v, cancelada: true } : v)
      }));

      const ventaActualizada = get().ventas.find(v => v.id === id);
      if (ventaActualizada) {
        await guardarRegistro("ventas", ventaActualizada);
      }

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('ventas')
            .update({ cancelada: true })
            .eq('id', id)
            .eq('tienda_id', tiendaId);
        }
      } else {
        await registrarPendienteSync({ tabla: 'ventas', operacion: 'ACTUALIZAR', payload: { id, cancelada: true } });
      }
    } catch (error) {
      console.error("Error al cancelar la venta:", error);
    }
  },

  purgarVentasLocales: async (fechaInicio: string, fechaFin: string) => {
    // Se eliminó el bloqueo 'if (!esEscritorio) return;' para permitir borrar en la caché web
    
    const todasLocales = await obtenerRegistros("ventas");
    const aBorrar = (todasLocales as Venta[]).filter(v => {
      const fechaVenta = v.fecha.slice(0, 10);
      return fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
    });

    for (const v of aBorrar) {
      await eliminarRegistro("ventas", v.id);
    }

    set(state => ({
      ventas: state.ventas.filter(v => {
        const fechaVenta = v.fecha.slice(0, 10);
        return !(fechaVenta >= fechaInicio && fechaVenta <= fechaFin);
      })
    }));
  },

  sincronizarVenta: async (payload: any) => {
    const { eventType, new: nuevo, old: viejo, table } = payload;
    const { ventas } = get();

    if (table === 'venta_detalles') {
      const ventaId = eventType === 'DELETE' ? viejo.venta_id : nuevo.venta_id;
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) return;

      try {
        const { data: ventaNube, error } = await supabase
          .from('ventas')
          .select('*, venta_detalles(*)')
          .eq('tienda_id', tiendaId)
          .eq('id', ventaId)
          .maybeSingle();

        if (!error && ventaNube) {
          const ventaMapeada = mapearVentaDesdeSupabase(ventaNube);
          if (esEscritorio) await guardarRegistro("ventas", ventaMapeada);
          const yaExiste = ventas.some((v) => v.id === ventaMapeada.id);
          set({ ventas: yaExiste ? ventas.map((v) => v.id === ventaMapeada.id ? ventaMapeada : v) : [ventaMapeada, ...ventas] });
        }
      } catch (error) {
        console.warn('No se pudo reconstruir la venta:', error);
      }
      return;
    }

    if (eventType === 'DELETE') {
      // PROTECCIÓN CLAVE: Si es escritorio (Cerebro), NO borramos la venta al llegar la orden de purga de Supabase.
      if (!esEscritorio) {
        set({ ventas: ventas.filter((v) => v.id !== viejo.id) });
      }
    } else if (eventType === 'UPDATE') {
      const actualizadas = ventas.map(v => v.id === nuevo.id ? { ...v, cancelada: nuevo.cancelada } : v);
      if (esEscritorio) {
        const modificada = actualizadas.find(v => v.id === nuevo.id);
        if (modificada) await guardarRegistro("ventas", modificada);
      }
      set({ ventas: actualizadas });
    } else if (eventType === 'INSERT') {
      try {
        const tiendaId = await obtenerTiendaIdActual();
        const { data: ventaNube, error } = await supabase
          .from('ventas')
          .select('*, venta_detalles(*)')
          .eq('tienda_id', tiendaId)
          .eq('id', nuevo.id)
          .maybeSingle();

        if (!error && ventaNube) {
          const ventaMapeada = mapearVentaDesdeSupabase(ventaNube);
          if (esEscritorio) await guardarRegistro("ventas", ventaMapeada);
          const yaExiste = ventas.some((v) => v.id === ventaMapeada.id);
          set({ ventas: yaExiste ? ventas.map((v) => v.id === ventaMapeada.id ? ventaMapeada : v) : [ventaMapeada, ...ventas] });
        }
      } catch (error) {
        console.warn('No se pudo sincronizar silenciosamente:', error);
      }
    }
  }
}));