import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, eliminarRegistro } from "../servicios/db";
import { cifrarPin, descifrarPin } from "../utilidades/seguridad";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

export type RolTrabajador = "DUENO" | "TRABAJADOR";

export interface PermisosTrabajador {
  editarProductos: boolean;
  eliminarProductos: boolean;
  actualizarStockCodigo: boolean;
}

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
  agregarTrabajador: (trabajador: Trabajador) => Promise<void>;
  actualizarTrabajador: (trabajador: Trabajador) => Promise<void>;
  eliminarTrabajador: (id: string) => Promise<void>;
}

const TRABAJADORES_INICIALES: Trabajador[] = [
  { 
    id: "00000000-0000-0000-0000-000000000001", nombre: "Carlos Dueño", rol: "DUENO", pin: "DU1234", activo: true, ventasRealizadas: 0, ingresosGenerados: 0,
    fechaIngreso: new Date().toISOString().split("T")[0],
    permisos: { editarProductos: true, eliminarProductos: true, actualizarStockCodigo: true },
    horarioSemanal: { tipo: "GENERAL", diasTrabajo: [1,2,3,4,5], general: { entrada: "09:00", salida: "18:00" }, especifico: {} }
  },
  { 
    id: "00000000-0000-0000-0000-000000000002", nombre: "María García", rol: "TRABAJADOR", pin: "TR0000", activo: true, ventasRealizadas: 0, ingresosGenerados: 0,
    fechaIngreso: new Date().toISOString().split("T")[0],
    permisos: { editarProductos: false, eliminarProductos: false, actualizarStockCodigo: false },
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
      }

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          if (esEscritorio && estadoTrabajadores.length > 0) {
            // Se omiten los trabajadores con IDs antiguos ("1", "2") para que Supabase no rechace la petición
            const trabajadoresValidos = estadoTrabajadores.filter(t => t.id.length > 10);
            
            if (trabajadoresValidos.length > 0) {
              const payload = trabajadoresValidos.map(t => ({
                tienda_id: tiendaId,
                usuario_id: t.id,
                rol: t.rol,
                nombre: t.nombre,
                pin_hash: cifrarPin(t.pin),
                activo: t.activo,
                horario: t.horarioSemanal || null,
                permisos: t.permisos || null
              }));
              await supabase.from('miembros_tienda').upsert(payload, { onConflict: 'tienda_id, usuario_id' });
            }
          }

          const { data: miembrosNube } = await supabase.from('miembros_tienda').select('*').eq('tienda_id', tiendaId);
          if (miembrosNube) {
            estadoTrabajadores = miembrosNube.map((m: any) => ({
              id: m.usuario_id,
              nombre: m.nombre,
              rol: m.rol,
              // Respaldo crítico: si el SQL inyectó un PIN vacío, fuerza DU1234
              pin: m.pin_hash ? descifrarPin(m.pin_hash) : "DU1234", 
              activo: m.activo,
              ventasRealizadas: 0, 
              ingresosGenerados: 0,
              permisos: m.permisos,
              horarioSemanal: m.horario
            }));
            
            if (esEscritorio) {
              for (const t of estadoTrabajadores) {
                await guardarRegistro("trabajadores", { ...t, pin: cifrarPin(t.pin) });
              }
            }
            set({ trabajadores: estadoTrabajadores, cargando: false });
          }
        } else if (!esEscritorio) {
          set({ cargando: false });
        }
      } else if (!esEscritorio) {
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
  
  agregarTrabajador: async (trabajador) => {
    try {
      if (get().trabajadores.length >= 4) throw new Error("Límite máximo de 4 trabajadores alcanzado.");
      
      if (esEscritorio) {
        const tCifrado = { ...trabajador, pin: cifrarPin(trabajador.pin) };
        await guardarRegistro("trabajadores", tCifrado);
      }
      set((estado) => ({ trabajadores: [...estado.trabajadores, trabajador] }));

      if (navigator.onLine) {
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
            permisos: trabajador.permisos
          });
        }
      }
    } catch (error) {
      console.error("Error al agregar trabajador:", error);
    }
  },

  actualizarTrabajador: async (trabajador) => {
    try {
      if (esEscritorio) {
        const tCifrado = { ...trabajador, pin: cifrarPin(trabajador.pin) };
        await guardarRegistro("trabajadores", tCifrado);
      }
      
      set((estado) => ({ 
        trabajadores: estado.trabajadores.map((actual) => actual.id === trabajador.id ? trabajador : actual),
        trabajadorActivo: estado.trabajadorActivo?.id === trabajador.id ? trabajador : estado.trabajadorActivo
      }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('miembros_tienda').update({
            rol: trabajador.rol,
            nombre: trabajador.nombre,
            pin_hash: cifrarPin(trabajador.pin),
            activo: trabajador.activo,
            horario: trabajador.horarioSemanal,
            permisos: trabajador.permisos
          }).eq('tienda_id', tiendaId).eq('usuario_id', trabajador.id);
        }
      }
    } catch (error) {
      console.error("Error al actualizar trabajador:", error);
    }
  },
    
  eliminarTrabajador: async (id) => {
    try {
      if (esEscritorio) await eliminarRegistro("trabajadores", id);
      set((estado) => ({ trabajadores: estado.trabajadores.filter((t) => t.id !== id) }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('miembros_tienda').delete().eq('tienda_id', tiendaId).eq('usuario_id', id);
        }
      }
    } catch (error) {
      console.error("Error al eliminar trabajador:", error);
    }
  }
}));