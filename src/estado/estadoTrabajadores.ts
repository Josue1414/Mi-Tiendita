import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { cifrarPin, descifrarPin } from "../utilidades/seguridad";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { useEstadoPlan } from "./estadoPlan"; // <-- NUEVA IMPORTACIÓN
import { debeSincronizarConNube, enviarAccionLAN } from "../servicios/sincronizacionLAN";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

export type RolTrabajador = "DUENO" | "SUPERVISOR" | "TRABAJADOR";

export interface PermisosTrabajador {
  editarProductos: boolean;
  eliminarProductos: boolean;
  actualizarStockCodigo: boolean;
  cambiarHorarios?: boolean;
  hacerCancelaciones?: boolean;
  cambiarInfoTicket?: boolean;
  cambiarPrecios?: boolean;
  verSalarios?: boolean;
  permisoFiados?: boolean;
}

const obtenerClavePermisosFiados = () =>
  "permisos_fiados_trabajadores";

const leerPermisosFiadosLocales = (): Record<string, boolean> => {
  try {
    const guardados = localStorage.getItem(obtenerClavePermisosFiados());
    return guardados ? JSON.parse(guardados) as Record<string, boolean> : {};
  } catch (error) {
    console.error("Error al leer permisos locales de fiados:", error);
    return {};
  }
};

const guardarPermisoFiadosLocal = (trabajadorId: string, permitido: boolean) => {
  const permisos = leerPermisosFiadosLocales();
  permisos[trabajadorId] = permitido;
  localStorage.setItem(obtenerClavePermisosFiados(), JSON.stringify(permisos));
};

const obtenerPermisoFiadosLocal = (trabajadorId: string) =>
  leerPermisosFiadosLocales()[trabajadorId];

const obtenerPermisosSinFiados = (permisos?: PermisosTrabajador) => {
  if (!permisos) return permisos;
  const permisosNube = { ...permisos };
  delete permisosNube.permisoFiados;
  return permisosNube;
};

export interface HorarioSemanal {
  tipo: "GENERAL" | "ESPECIFICO";
  diasTrabajo: number[]; 
  general: { entrada: string; salida: string };
  especifico: Record<number, { entrada: string; salida: string }>;
}

export interface Trabajador {
  id: string;
  nombre: string;
  rol: RolTrabajador;
  pin: string;
  activo: boolean;
  ventasRealizadas: number;
  ingresosGenerados: number;
  permisos?: PermisosTrabajador;
  fechaIngreso?: string;
  notas?: string;
  salario?: number;
  horarioSemanal?: HorarioSemanal;
}

interface EstadoTrabajadores {
  trabajadores: Trabajador[];
  trabajadorActivo: Trabajador | null;
  cargando: boolean;
  cargarTrabajadores: () => Promise<void>;
  iniciarSesion: (id: string, pin: string) => boolean;
  cerrarSesion: () => void;
  agregarTrabajador: (trabajador: Trabajador, propagado?: boolean) => Promise<void>;
  actualizarTrabajador: (trabajador: Trabajador, propagado?: boolean) => Promise<void>;
  eliminarTrabajador: (id: string, propagado?: boolean) => Promise<void>;
  aplicarAccionLAN: (tipo: string, payload: unknown) => Promise<void>;
  hidratarEstadoLAN: (snapshot: {
    trabajadores: Trabajador[];
    asistencias: unknown[];
    configuracion: object;
  }) => Promise<void>;
  sincronizarTrabajador: (payload: any) => Promise<void>;
}

const TRABAJADORES_INICIALES: Trabajador[] = [
  { 
    id: "00000000-0000-0000-0000-000000000001", nombre: "Carlos Dueño", rol: "DUENO", pin: "DU1234", activo: true, ventasRealizadas: 0, ingresosGenerados: 0,
    fechaIngreso: new Date().toISOString().split("T")[0],
    permisos: { editarProductos: true, eliminarProductos: true, actualizarStockCodigo: true, cambiarHorarios: true, hacerCancelaciones: true, cambiarInfoTicket: true, cambiarPrecios: true, verSalarios: true },
    horarioSemanal: { tipo: "GENERAL", diasTrabajo: [1,2,3,4,5], general: { entrada: "09:00", salida: "18:00" }, especifico: {} }
  },
  { 
    id: "00000000-0000-0000-0000-000000000002", nombre: "María García", rol: "TRABAJADOR", pin: "TR0000", activo: true, ventasRealizadas: 0, ingresosGenerados: 0,
    fechaIngreso: new Date().toISOString().split("T")[0],
    permisos: { editarProductos: false, eliminarProductos: false, actualizarStockCodigo: false, cambiarHorarios: false, hacerCancelaciones: false, cambiarInfoTicket: false, cambiarPrecios: false, verSalarios: false },
    horarioSemanal: { tipo: "GENERAL", diasTrabajo: [1,2,3,4,5], general: { entrada: "09:00", salida: "18:00" }, especifico: {} }
  }
];

export const useEstadoTrabajadores = create<EstadoTrabajadores>((set, get) => ({
  trabajadores: [],
  trabajadorActivo: null,
  cargando: true,

  cargarTrabajadores: async () => {
    set({ cargando: true });
    try {
      let estadoTrabajadores: Trabajador[] = [];

      const permiteSincronizar = debeSincronizarConNube();
      const tiendaId = permiteSincronizar ? await obtenerTiendaIdActual() : null;

      if (permiteSincronizar && navigator.onLine && tiendaId) {
        const { data: miembrosNube } = await supabase.from('miembros_tienda').select('*').eq('tienda_id', tiendaId);

        if (miembrosNube) {
          const trabajadoresNube = miembrosNube.map((m: any) => ({
            id: m.usuario_id,
            nombre: m.nombre,
            rol: m.rol,
            pin: m.pin_hash ? descifrarPin(m.pin_hash) : "DU1234",
            activo: m.activo,
            ventasRealizadas: 0,
            ingresosGenerados: 0,
            permisos: {
              ...(m.permisos || {}),
              permisoFiados: obtenerPermisoFiadosLocal(m.usuario_id) ?? false
            },
            horarioSemanal: m.horario
          }));

          if (esEscritorio) {
            const idsNube = new Set(trabajadoresNube.map((t: Trabajador) => t.id));
            const tLocal = await obtenerRegistros("trabajadores");

            for (const t of tLocal) {
              if (!idsNube.has(t.id)) {
                await eliminarRegistro("trabajadores", t.id);
              }
            }

            for (const t of trabajadoresNube) {
              await guardarRegistro("trabajadores", { ...t, pin: cifrarPin(t.pin) });
            }
          }

          set({ trabajadores: trabajadoresNube, cargando: false });
          return;
        }
      }

      if (esEscritorio) {
        const data = await obtenerRegistros("trabajadores");
        if (data.length === 0) {
          for (const t of TRABAJADORES_INICIALES) {
            const tCifrado = { ...t, pin: cifrarPin(t.pin) };
            await guardarRegistro("trabajadores", tCifrado);
          }
          estadoTrabajadores = TRABAJADORES_INICIALES;
        } else {
          estadoTrabajadores = (data as Trabajador[]).map((t) => ({ ...t, pin: descifrarPin(t.pin) }));
        }
        set({ trabajadores: estadoTrabajadores, cargando: false });
      } else if (!navigator.onLine) {
        set({ cargando: false });
      } else {
        set({ cargando: false });
      }
    } catch (error) {
      console.error("Error al cargar trabajadores:", error);
      set({ cargando: false });
    }
  },

  iniciarSesion: (id, pin) => {
    const usuario = get().trabajadores.find(t => t.id === id && t.pin.toUpperCase() === pin.trim().toUpperCase() && t.activo);
    if (usuario) {
      set({ trabajadorActivo: usuario });
      return true;
    }
    return false;
  },
  
  cerrarSesion: () => set({ trabajadorActivo: null }),
  
  agregarTrabajador: async (trabajador, propagado = false) => {
    try {
      // <-- LÓGICA DINÁMICA DE LÍMITE DE PLAN AQUÍ -->
      const maxUsuarios = useEstadoPlan.getState().maxUsuarios;
      
      if (get().trabajadores.length >= maxUsuarios) {
        throw new Error(`Límite máximo de ${maxUsuarios} usuarios alcanzado para tu plan actual.`);
      }
      
      await guardarRegistro("trabajadores", {
        ...trabajador,
        pin: esEscritorio ? cifrarPin(trabajador.pin) : trabajador.pin
      });
      guardarPermisoFiadosLocal(trabajador.id, trabajador.permisos?.permisoFiados ?? false);
      set((estado) => ({ trabajadores: [...estado.trabajadores, trabajador] }));

      const trabajadorSinPermisoFiados = {
        ...trabajador,
        permisos: obtenerPermisosSinFiados(trabajador.permisos)
      };
      const enviadoLAN = !propagado && enviarAccionLAN({
        tipo: "LAN_TRABAJADOR_AGREGAR",
        payload: trabajadorSinPermisoFiados
      });
      if (enviadoLAN) return;

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('miembros_tienda').insert({
            tienda_id: tiendaId,
            usuario_id: trabajador.id,
            rol: trabajador.rol,
            nombre: trabajador.nombre,
            pin_hash: cifrarPin(trabajador.pin),
            activo: trabajador.activo,
            horario: trabajador.horarioSemanal,
            permisos: obtenerPermisosSinFiados(trabajador.permisos)
          });
        }
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'miembros_tienda', operacion: 'AGREGAR', payload: trabajadorSinPermisoFiados });
      }
    } catch (error) {
      console.error("Error al agregar trabajador:", error);
      throw error; // Lanzamos el error para que la UI (VistaEquipo) pueda capturarlo y mostrarlo
    }
  },

  actualizarTrabajador: async (trabajador, propagado = false) => {
    try {
      guardarPermisoFiadosLocal(trabajador.id, trabajador.permisos?.permisoFiados ?? false);
      await guardarRegistro("trabajadores", {
        ...trabajador,
        pin: esEscritorio ? cifrarPin(trabajador.pin) : trabajador.pin
      });
      
      set((estado) => ({ 
        trabajadores: estado.trabajadores.map((actual) => actual.id === trabajador.id ? trabajador : actual),
        trabajadorActivo: estado.trabajadorActivo?.id === trabajador.id ? trabajador : estado.trabajadorActivo
      }));

      const trabajadorSinPermisoFiados = {
        ...trabajador,
        permisos: obtenerPermisosSinFiados(trabajador.permisos)
      };
      const enviadoLAN = !propagado && enviarAccionLAN({
        tipo: "LAN_TRABAJADOR_ACTUALIZAR",
        payload: trabajadorSinPermisoFiados
      });
      if (enviadoLAN) return;

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('miembros_tienda').update({
            rol: trabajador.rol,
            nombre: trabajador.nombre,
            pin_hash: cifrarPin(trabajador.pin),
            activo: trabajador.activo,
            horario: trabajador.horarioSemanal,
            permisos: obtenerPermisosSinFiados(trabajador.permisos)
          }).eq('tienda_id', tiendaId).eq('usuario_id', trabajador.id);
        }
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'miembros_tienda', operacion: 'ACTUALIZAR', payload: trabajadorSinPermisoFiados });
      }
    } catch (error) {
      console.error("Error al actualizar trabajador:", error);
    }
  },
    
  eliminarTrabajador: async (id, propagado = false) => {
    try {
      await eliminarRegistro("trabajadores", id);
      set((estado) => ({
        trabajadores: estado.trabajadores.filter((t) => t.id !== id),
        trabajadorActivo: estado.trabajadorActivo?.id === id ? null : estado.trabajadorActivo
      }));

      const enviadoLAN = !propagado && enviarAccionLAN({ tipo: "LAN_TRABAJADOR_ELIMINAR", payload: id });
      if (enviadoLAN) return;

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('miembros_tienda').delete().eq('tienda_id', tiendaId).eq('usuario_id', id);
        }
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'miembros_tienda', operacion: 'ELIMINAR', payload: id });
      }
    } catch (error) {
      console.error("Error al eliminar trabajador:", error);
    }
  },

  aplicarAccionLAN: async (tipo, payload) => {
    if (tipo === "LAN_TRABAJADOR_AGREGAR" || tipo === "LAN_TRABAJADOR_ACTUALIZAR") {
      const trabajadorRecibido = payload as Trabajador;
      if (!trabajadorRecibido?.id) return;
      const trabajador: Trabajador = {
        ...trabajadorRecibido,
        permisos: {
          ...(trabajadorRecibido.permisos || {}),
          editarProductos: trabajadorRecibido.permisos?.editarProductos ?? false,
          eliminarProductos: trabajadorRecibido.permisos?.eliminarProductos ?? false,
          actualizarStockCodigo: trabajadorRecibido.permisos?.actualizarStockCodigo ?? false,
          permisoFiados: obtenerPermisoFiadosLocal(trabajadorRecibido.id) ?? false
        }
      };
      if (tipo === "LAN_TRABAJADOR_AGREGAR") {
        if (get().trabajadores.some((actual) => actual.id === trabajador.id)) {
          await get().actualizarTrabajador(trabajador, true);
        } else {
          await get().agregarTrabajador(trabajador, true);
        }
      } else {
        if (get().trabajadores.some((actual) => actual.id === trabajador.id)) {
          await get().actualizarTrabajador(trabajador, true);
        } else {
          await get().agregarTrabajador(trabajador, true);
        }
      }
      return;
    }

    if (tipo === "LAN_TRABAJADOR_ELIMINAR") {
      const id = typeof payload === "string" ? payload : (payload as { id?: string } | null)?.id;
      if (id) await get().eliminarTrabajador(id, true);
    }
  },

  hidratarEstadoLAN: async (snapshot) => {
    const trabajadoresLAN = snapshot.trabajadores.map((trabajador) => ({
      ...trabajador,
      permisos: {
        ...(trabajador.permisos || {}),
        editarProductos: trabajador.permisos?.editarProductos ?? false,
        eliminarProductos: trabajador.permisos?.eliminarProductos ?? false,
        actualizarStockCodigo: trabajador.permisos?.actualizarStockCodigo ?? false,
        permisoFiados: obtenerPermisoFiadosLocal(trabajador.id) ?? false
      }
    }));
    const idsIncluidos = new Set(trabajadoresLAN.map((trabajador) => trabajador.id));

    const locales = await obtenerRegistros("trabajadores");
    for (const trabajador of locales) {
      if (!idsIncluidos.has(trabajador.id)) await eliminarRegistro("trabajadores", trabajador.id);
    }
    for (const trabajador of trabajadoresLAN) {
      await guardarRegistro("trabajadores", {
        ...trabajador,
        pin: esEscritorio ? cifrarPin(trabajador.pin) : trabajador.pin
      });
    }

    const trabajadorActivo = get().trabajadorActivo;
    set({
      trabajadores: trabajadoresLAN,
      cargando: false,
      trabajadorActivo: trabajadorActivo
        ? trabajadoresLAN.find((trabajador) => trabajador.id === trabajadorActivo.id) ?? null
        : null
    });
  },

  sincronizarTrabajador: async (payload: any) => {
    const { eventType, new: nuevo, old: viejo } = payload;
    const { trabajadores, trabajadorActivo } = get();

    if (eventType === 'DELETE') {
      await eliminarRegistro("trabajadores", viejo.usuario_id);
      set({ trabajadores: trabajadores.filter(t => t.id !== viejo.usuario_id) });
      enviarAccionLAN({ tipo: "LAN_TRABAJADOR_ELIMINAR", payload: viejo.usuario_id });
    } else {
      const trabajadorMapeado: Trabajador = {
        id: nuevo.usuario_id,
        nombre: nuevo.nombre,
        rol: nuevo.rol,
        pin: nuevo.pin_hash ? descifrarPin(nuevo.pin_hash) : "DU1234",
        activo: nuevo.activo,
        ventasRealizadas: 0,
        ingresosGenerados: 0,
        permisos: {
          ...(nuevo.permisos || {}),
          permisoFiados: obtenerPermisoFiadosLocal(nuevo.usuario_id) ?? false
        },
        horarioSemanal: nuevo.horario
      };

      await guardarRegistro("trabajadores", {
        ...trabajadorMapeado,
        pin: esEscritorio ? cifrarPin(trabajadorMapeado.pin) : trabajadorMapeado.pin
      });

      if (eventType === 'INSERT') {
        if (!trabajadores.some(t => t.id === trabajadorMapeado.id)) {
          set({ trabajadores: [...trabajadores, trabajadorMapeado] });
        }
      } else if (eventType === 'UPDATE') {
        set({ 
          trabajadores: trabajadores.map(t => t.id === trabajadorMapeado.id ? trabajadorMapeado : t),
          trabajadorActivo: trabajadorActivo?.id === trabajadorMapeado.id ? trabajadorMapeado : trabajadorActivo
        });
      }
      const trabajadorLAN = {
        ...trabajadorMapeado,
        permisos: obtenerPermisosSinFiados(trabajadorMapeado.permisos)
      };
      enviarAccionLAN({
        tipo: eventType === "INSERT" ? "LAN_TRABAJADOR_AGREGAR" : "LAN_TRABAJADOR_ACTUALIZAR",
        payload: trabajadorLAN
      });
    }
  }
}));