// src/estado/estadoVentas.ts
import { create } from "zustand";
import type { ItemCarrito } from "./estadoCarrito";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { guardarVentaFiadoLocal, obtenerVentasFiadoLocales } from "../servicios/baseDatosLocal";
import { debeSincronizarConNube, enviarAccionLAN } from "../servicios/sincronizacionLAN";
import { useEstadoPlan } from "./estadoPlan";
import { useEstadoRed } from "./estadoRed"; // NUEVO: Para saber si somos Cerebro o Esclavo

interface VentaSupabase {
  id: string;
  created_at: string;
  trabajador_nombre: string;
  vendedor_id: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  metodo_pago: string;
  cancelada: boolean | null;
  venta_detalles: DetalleVentaSupabase[] | null;
}

interface DetalleVentaSupabase {
  producto_id: string | null;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number | null;
  subtotal: number;
  autorizacion_confirmada: boolean | null;
}

type Registro = Record<string, unknown>;

interface EventoVentaSupabase {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Registro;
  old: Registro;
  table: string;
}

const esEscritorio = typeof window !== "undefined" && window.apiLocal !== undefined;

const mapearVentaDesdeSupabase = (v: VentaSupabase): Venta => ({
  id: v.id,
  fecha: v.created_at,
  trabajador: v.trabajador_nombre,
  vendedor_id: v.vendedor_id ?? undefined,
  subtotal: v.subtotal,
  descuento: v.descuento,
  total: v.total,
  metodoPago: v.metodo_pago,
  cancelada: v.cancelada ?? undefined,
  articulos: (v.venta_detalles ?? []).map((d, index) => ({
    id: `${v.id}-${index}`,
    producto_id: d.producto_id ?? "",
    nombre: d.nombre_producto,
    cantidad: d.cantidad,
    precio: d.precio_unitario,
    costo: d.costo_unitario || 0,
    unidad: "PIEZA",
    subtotal: d.subtotal,
    autorizacion_confirmada: d.autorizacion_confirmada ?? undefined
  }))
});

const esRegistro = (valor: unknown): valor is Registro =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

const esVenta = (valor: unknown): valor is Venta => {
  if (!esRegistro(valor)) return false;
  return typeof valor.id === "string"
    && typeof valor.fecha === "string"
    && typeof valor.trabajador === "string"
    && Array.isArray(valor.articulos)
    && typeof valor.subtotal === "number"
    && typeof valor.descuento === "number"
    && typeof valor.total === "number"
    && typeof valor.metodoPago === "string";
};

const esEventoVentaSupabase = (valor: unknown): valor is EventoVentaSupabase => {
  if (!esRegistro(valor)) return false;
  return (valor.eventType === "INSERT" || valor.eventType === "UPDATE" || valor.eventType === "DELETE")
    && typeof valor.table === "string"
    && esRegistro(valor.new)
    && esRegistro(valor.old);
};

const obtenerVentasLocales = async (): Promise<Venta[]> =>
  (await obtenerRegistros("ventas")).filter(esVenta);

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

const obtenerVentasFiadasLocales = async () => {
  const ventasFiadas = new Map((await obtenerVentasFiadoLocales()).map(venta => [venta.id, venta]));
  const ventasEnAlmacenGeneral = await obtenerVentasLocales();

  for (const venta of ventasEnAlmacenGeneral.filter(venta => venta.metodoPago === "FIADO")) {
    if (!ventasFiadas.has(venta.id)) {
      await guardarVentaFiadoLocal(venta);
      ventasFiadas.set(venta.id, venta);
    }
  }

  return [...ventasFiadas.values()];
};

// NUEVO: Función que determina el límite de meses según el plan y si es esclavo
const obtenerFechaCorteEsclavo = (): string | null => {
  const { esMaestro } = useEstadoRed.getState();
  // Si es Cerebro, no hay fecha de corte (lo guarda todo)
  if (esMaestro) return null; 

  const { planActivo } = useEstadoPlan.getState();
  const fecha = new Date();
  
  if (planActivo === "BASICO") {
    fecha.setMonth(fecha.getMonth() - 1); // Básico: 1 mes
  } else if (planActivo === "ESTANDAR") {
    fecha.setMonth(fecha.getMonth() - 3); // Estándar: 3 meses
  } else {
    fecha.setMonth(fecha.getMonth() - 6); // Plus: 6 meses
  }
  
  return fecha.toISOString().slice(0, 10);
};

interface EstadoVentas {
  ventas: Venta[];
  cargando: boolean;
  cargarVentas: () => Promise<void>;
  agregarVenta: (venta: Venta, propagado?: boolean) => Promise<void>;
  cancelarVenta: (id: string, propagado?: boolean) => Promise<void>;
  aplicarAccionLAN: (tipo: string, payload: unknown) => Promise<void>;
  hidratarEstadoLAN: (snapshot: unknown) => Promise<void>;
  sincronizarVenta: (payload: unknown) => Promise<void>;
  purgarVentasLocales: (fechaInicio: string, fechaFin: string) => Promise<void>;
}

export const useEstadoVentas = create<EstadoVentas>((set, get) => ({
  ventas: [],
  cargando: true,

  cargarVentas: async () => {
    set({ cargando: get().ventas.length === 0 });
    try {
      const fechaCorte = obtenerFechaCorteEsclavo();
      let datosLocales = await obtenerVentasLocales();
      
      // NUEVO: Limpieza automática de ventas viejas en esclavos al iniciar
      if (fechaCorte) {
        const aBorrar = datosLocales.filter(v => v.metodoPago !== "FIADO" && v.fecha.slice(0, 10) < fechaCorte);
        for (const v of aBorrar) {
          await eliminarRegistro("ventas", v.id);
        }
        // Actualizamos los datos locales dejando solo lo reciente
        datosLocales = datosLocales.filter(v => v.metodoPago === "FIADO" || v.fecha.slice(0, 10) >= fechaCorte);
      }

      const ventasFiadasLocales = await obtenerVentasFiadasLocales();
      const ventasLocales = [
        ...datosLocales.filter(venta => venta.metodoPago !== "FIADO"),
        ...ventasFiadasLocales
      ];
      set({
        ventas: ventasLocales.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
        cargando: false
      });

      const puedeConsultarNube = useEstadoPlan.getState().permiteNube;
      const tiendaId = puedeConsultarNube ? await obtenerTiendaIdActual() : null;

      if (puedeConsultarNube && navigator.onLine && tiendaId) {
        const { data: ventasNube, error } = await supabase
          .from('ventas')
          .select('*, venta_detalles(*)')
          .eq('tienda_id', tiendaId)
          .neq('metodo_pago', 'FIADO')
          .order('created_at', { ascending: false });

        if (!error && ventasNube) {
          if (!debeSincronizarConNube()) return;
          const ventasMapeadas: Venta[] = ventasNube
            .filter((venta: VentaSupabase) => venta.metodo_pago !== "FIADO")
            .map((venta: VentaSupabase) => mapearVentaDesdeSupabase(venta));

          // NUEVO: Filtrar las ventas que vienen de Supabase antes de guardarlas en el esclavo
          const ventasA_Guardar = fechaCorte
            ? ventasMapeadas.filter(v => v.fecha.slice(0, 10) >= fechaCorte)
            : ventasMapeadas;

          for (const venta of ventasA_Guardar) {
            await guardarRegistro("ventas", venta);
          }

          const ventasLocalActualizadas = await obtenerVentasLocales();
          const ventasCombinadas = new Map(
            ventasLocalActualizadas
              .filter(venta => venta.metodoPago !== "FIADO")
              .map(venta => [venta.id, venta])
          );
          ventasA_Guardar.forEach(venta => ventasCombinadas.set(venta.id, venta));
          ventasFiadasLocales.forEach(venta => ventasCombinadas.set(venta.id, venta));
          
          set({
            ventas: [...ventasCombinadas.values()].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
            cargando: false
          });
          return;
        }

        if (error) console.error("Error al consultar el historial de ventas en Supabase:", error);
      }

      set({ cargando: false });
    } catch (error) {
      console.error("Error al cargar ventas:", error);
      set({ cargando: false });
    }
  },

  agregarVenta: async (venta, propagado = false) => {
    try {
      if (venta.metodoPago === "FIADO") {
        await guardarVentaFiadoLocal(venta);
        set((estado) => ({
          ventas: estado.ventas.some((actual) => actual.id === venta.id)
            ? estado.ventas.map((actual) => actual.id === venta.id ? venta : actual)
            : [venta, ...estado.ventas]
        }));
        if (!propagado) enviarAccionLAN({ tipo: "LAN_VENTA_AGREGAR", payload: venta });
        return;
      }

      await guardarRegistro("ventas", venta);
      set((estado) => ({
        ventas: estado.ventas.some((actual) => actual.id === venta.id)
          ? estado.ventas.map((actual) => actual.id === venta.id ? venta : actual)
          : [venta, ...estado.ventas]
      }));

      if (!propagado) {
        enviarAccionLAN({ tipo: "LAN_VENTA_AGREGAR", payload: venta });
      }

      if (!debeSincronizarConNube()) return;

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
            costo_unitario: art.costo || 0,
            subtotal: art.subtotal,
            autorizacion_confirmada: art.autorizacion_confirmada || false,
            evidencia_nombre_archivo_local: null 
          }));

          const { error: errorDetalles } = await supabase.from('venta_detalles').insert(detalles);
          if (errorDetalles) throw errorDetalles;
        } else {
          await registrarPendienteSync({ tabla: 'ventas', operacion: 'AGREGAR', payload: venta });
        }
      } else {
        await registrarPendienteSync({ tabla: 'ventas', operacion: 'AGREGAR', payload: venta });
      }
    } catch (error) {
      console.error("Error al guardar la venta:", error);
      if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'ventas', operacion: 'AGREGAR', payload: venta });
      }
    }
  },

  cancelarVenta: async (id, propagado = false) => {
    try {
      const ventaEnEstado = get().ventas.find((venta) => venta.id === id);
      const ventaOriginal = ventaEnEstado ?? (await obtenerVentasFiadasLocales()).find(venta => venta.id === id);
      if (ventaOriginal?.metodoPago === "FIADO") {
        const ventaActualizada = { ...ventaOriginal, cancelada: true };
        await guardarVentaFiadoLocal(ventaActualizada);
        set((estado) => ({
          ventas: estado.ventas.map((venta) => venta.id === id ? ventaActualizada : venta)
        }));
        if (!propagado) enviarAccionLAN({ tipo: "LAN_VENTA_CANCELAR", payload: { id } });
        return;
      }

      set((estado) => ({
        ventas: estado.ventas.map((v) => v.id === id ? { ...v, cancelada: true } : v)
      }));

      const ventaActualizada = get().ventas.find(v => v.id === id);
      if (ventaActualizada) {
        await guardarRegistro("ventas", ventaActualizada);
      }

      if (!propagado) {
        enviarAccionLAN({ tipo: "LAN_VENTA_CANCELAR", payload: { id } });
      }

      if (!debeSincronizarConNube()) return;

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          const { error } = await supabase.from('ventas')
            .update({ cancelada: true })
            .eq('id', id)
            .eq('tienda_id', tiendaId);
          if (error) throw error;
        } else await registrarPendienteSync({ tabla: 'ventas', operacion: 'ACTUALIZAR', payload: { id, cancelada: true } });
      } else {
        await registrarPendienteSync({ tabla: 'ventas', operacion: 'ACTUALIZAR', payload: { id, cancelada: true } });
      }
    } catch (error) {
      console.error("Error al cancelar la venta:", error);
      if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'ventas', operacion: 'ACTUALIZAR', payload: { id, cancelada: true } });
      }
    }
  },

  purgarVentasLocales: async (fechaInicio: string, fechaFin: string) => {
    const todasLocales = await obtenerVentasLocales();
    const aBorrar = todasLocales.filter(v => {
      if (v.metodoPago === "FIADO") return false;
      const fechaVenta = v.fecha.slice(0, 10);
      return fechaVenta >= fechaInicio && fechaVenta <= fechaFin;
    });

    for (const v of aBorrar) {
      await eliminarRegistro("ventas", v.id);
    }

    set(state => ({
      ventas: state.ventas.filter(v => {
        if (v.metodoPago === "FIADO") return true;
        const fechaVenta = v.fecha.slice(0, 10);
        return !(fechaVenta >= fechaInicio && fechaVenta <= fechaFin);
      })
    }));
  },

  sincronizarVenta: async (payload: unknown) => {
    if (!debeSincronizarConNube()) return;
    if (!esEventoVentaSupabase(payload)) return;

    const { eventType, new: nuevo, old: viejo, table } = payload;
    const { ventas } = get();

    if (table === 'venta_detalles') {
      const ventaId = eventType === 'DELETE' ? viejo.venta_id : nuevo.venta_id;
      if (typeof ventaId !== "string") return;
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) return;

      try {
        const { data: ventaNube, error } = await supabase
          .from('ventas')
          .select('*, venta_detalles(*)')
          .eq('tienda_id', tiendaId)
          .eq('id', ventaId)
          .neq('metodo_pago', 'FIADO')
          .maybeSingle();

        if (!error && ventaNube) {
          const ventaMapeada = mapearVentaDesdeSupabase(ventaNube);
          if (ventaMapeada.metodoPago === "FIADO") return;
          
          // NUEVO: Verificamos si la venta entra en el límite de tiempo del esclavo
          const fechaCorte = obtenerFechaCorteEsclavo();
          if (fechaCorte && ventaMapeada.fecha.slice(0, 10) < fechaCorte) return;

          if (esEscritorio) await guardarRegistro("ventas", ventaMapeada);
          const yaExiste = ventas.some((v) => v.id === ventaMapeada.id);
          set({ ventas: yaExiste ? ventas.map((v) => v.id === ventaMapeada.id ? ventaMapeada : v) : [ventaMapeada, ...ventas] });
          enviarAccionLAN({ tipo: "LAN_VENTA_AGREGAR", payload: ventaMapeada });
        }
      } catch (error) {
        console.warn('No se pudo reconstruir la venta:', error);
      }
      return;
    }

    if (eventType === 'DELETE') {
      if (viejo.metodo_pago === "FIADO" || (typeof viejo.id === "string" && ventas.some(v => v.id === viejo.id && v.metodoPago === "FIADO"))) return;
      if (!esEscritorio) {
        if (typeof viejo.id === "string") set({ ventas: ventas.filter((v) => v.id !== viejo.id) });
      }
    } else if (eventType === 'UPDATE') {
      if (typeof nuevo.id !== "string") return;
      if (nuevo.metodo_pago === "FIADO" || ventas.some(v => v.id === nuevo.id && v.metodoPago === "FIADO")) return;
      const actualizadas = ventas.map(v =>
        v.id === nuevo.id && typeof nuevo.cancelada === "boolean"
          ? { ...v, cancelada: nuevo.cancelada }
          : v
      );
      if (esEscritorio) {
        const modificada = actualizadas.find(v => v.id === nuevo.id);
        if (modificada) await guardarRegistro("ventas", modificada);
      }
      set({ ventas: actualizadas });
      const ventaActualizada = actualizadas.find((venta) => venta.id === nuevo.id);
      if (ventaActualizada) {
        enviarAccionLAN({
          tipo: ventaActualizada.cancelada ? "LAN_VENTA_CANCELAR" : "LAN_VENTA_AGREGAR",
          payload: ventaActualizada.cancelada ? { id: ventaActualizada.id } : ventaActualizada
        });
      }
    } else if (eventType === 'INSERT') {
      if (typeof nuevo.id !== "string") return;
      try {
        const tiendaId = await obtenerTiendaIdActual();
        const { data: ventaNube, error } = await supabase
          .from('ventas')
          .select('*, venta_detalles(*)')
          .eq('tienda_id', tiendaId)
          .eq('id', nuevo.id)
          .neq('metodo_pago', 'FIADO')
          .maybeSingle();

        if (!error && ventaNube) {
          const ventaMapeada = mapearVentaDesdeSupabase(ventaNube);
          if (ventaMapeada.metodoPago === "FIADO") return;
          
          // NUEVO: Verificamos fecha de corte en sincronización por Push de Supabase
          const fechaCorte = obtenerFechaCorteEsclavo();
          if (fechaCorte && ventaMapeada.fecha.slice(0, 10) < fechaCorte) return;

          if (esEscritorio) await guardarRegistro("ventas", ventaMapeada);
          const yaExiste = ventas.some((v) => v.id === ventaMapeada.id);
          set({ ventas: yaExiste ? ventas.map((v) => v.id === ventaMapeada.id ? ventaMapeada : v) : [ventaMapeada, ...ventas] });
          enviarAccionLAN({ tipo: "LAN_VENTA_AGREGAR", payload: ventaMapeada });
        }
      } catch (error) {
        console.warn('No se pudo sincronizar silenciosamente:', error);
      }
    }
  },

  aplicarAccionLAN: async (tipo, payload) => {
    if (tipo === "LAN_VENTA_AGREGAR") {
      if (esVenta(payload)) {
        // NUEVO: Al recibir una venta por LAN, el esclavo revisa la fecha
        const fechaCorte = obtenerFechaCorteEsclavo();
        if (fechaCorte && payload.fecha.slice(0, 10) < fechaCorte && payload.metodoPago !== "FIADO") {
          return; // Si es muy vieja, el esclavo la descarta
        }
        await get().agregarVenta(payload, true);
      }
    } else if (tipo === "LAN_VENTA_CANCELAR") {
      const id = typeof payload === "string"
        ? payload
        : esRegistro(payload) && typeof payload.id === "string" ? payload.id : null;
      if (id) await get().cancelarVenta(id, true);
    }
  },

  hidratarEstadoLAN: async (snapshot) => {
    if (!esRegistro(snapshot) || !Array.isArray(snapshot.ventas)) return;

    const fechaCorte = obtenerFechaCorteEsclavo();
    const ventasLAN = snapshot.ventas.filter(esVenta);
    
    // NUEVO: Filtramos el snapshot recibido del cerebro por LAN
    const ventasNormalesLAN = ventasLAN.filter(venta => 
      venta.metodoPago !== "FIADO" && 
      (!fechaCorte || venta.fecha.slice(0, 10) >= fechaCorte)
    );
    const ventasFiadasLAN = ventasLAN.filter(venta => venta.metodoPago === "FIADO");
    
    const locales = await obtenerVentasLocales();
    const ventasFiadasLocales = await obtenerVentasFiadasLocales();
    const idsLAN = new Set(ventasNormalesLAN.map(venta => venta.id));

    // Limpia localmente las que el Cerebro no mandó o que ya superaron el límite de tiempo
    for (const local of locales.filter(venta => venta.metodoPago !== "FIADO" && !idsLAN.has(venta.id))) {
      await eliminarRegistro("ventas", local.id);
    }
    for (const venta of ventasNormalesLAN) {
      await guardarRegistro("ventas", venta);
    }

    const idsFiadasLAN = new Set(ventasFiadasLAN.map(venta => venta.id));
    for (const local of ventasFiadasLocales) {
      if (!idsFiadasLAN.has(local.id)) {
        enviarAccionLAN({ tipo: "LAN_VENTA_AGREGAR", payload: local });
      }
    }
    for (const venta of ventasFiadasLAN) await guardarVentaFiadoLocal(venta);
    
    const ventasCombinadas = new Map(ventasNormalesLAN.map(venta => [venta.id, venta]));
    ventasFiadasLAN.forEach(venta => ventasCombinadas.set(venta.id, venta));
    ventasFiadasLocales.forEach(venta => ventasCombinadas.set(venta.id, venta));
    set({
      ventas: [...ventasCombinadas.values()].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
      cargando: false
    });
  }
}));