// src/estado/estadoTrabajadores.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, eliminarRegistro } from "../servicios/db";
import { cifrarPin, descifrarPin } from "../utilidades/seguridad";

export type RolTrabajador = "DUEÑO" | "TRABAJADOR";

export interface PermisosTrabajador {
  editarProductos: boolean;
  eliminarProductos: boolean;
  actualizarStockCodigo: boolean;
}

export interface HorarioSemanal {
  tipo: "GENERAL" | "ESPECIFICO";
  diasTrabajo: number[]; // 0=Dom, 1=Lun, etc.
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
  // Nuevos campos
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
    id: "1", nombre: "Carlos Dueño", rol: "DUEÑO", pin: "DU1234", activo: true, ventasRealizadas: 0, ingresosGenerados: 0,
    fechaIngreso: new Date().toISOString().split("T")[0],
    permisos: { editarProductos: true, eliminarProductos: true, actualizarStockCodigo: true },
    horarioSemanal: { tipo: "GENERAL", diasTrabajo: [1,2,3,4,5], general: { entrada: "09:00", salida: "18:00" }, especifico: {} }
  },
  { 
    id: "2", nombre: "María García", rol: "TRABAJADOR", pin: "TR0000", activo: true, ventasRealizadas: 0, ingresosGenerados: 0,
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
      const data = await obtenerRegistros("trabajadores");
      if (data.length === 0) {
        for (const t of TRABAJADORES_INICIALES) {
          const tCifrado = { ...t, pin: cifrarPin(t.pin) };
          await guardarRegistro("trabajadores", tCifrado);
        }
        set({ trabajadores: TRABAJADORES_INICIALES, cargando: false, trabajadorActivo: null });
      } else {
        const trabajadores = (data as Trabajador[]).map((t) => ({
          ...t,
          pin: descifrarPin(t.pin),
        }));
        set({ trabajadores, cargando: false, trabajadorActivo: null });
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
      const tCifrado = { ...trabajador, pin: cifrarPin(trabajador.pin) };
      await guardarRegistro("trabajadores", tCifrado);
      set((estado) => ({ trabajadores: [...estado.trabajadores, trabajador] }));
    } catch (error) {
      console.error("Error al agregar trabajador:", error);
    }
  },

  actualizarTrabajador: async (trabajador) => {
    try {
      const tCifrado = { ...trabajador, pin: cifrarPin(trabajador.pin) };
      await guardarRegistro("trabajadores", tCifrado);
      set((estado) => ({ 
        trabajadores: estado.trabajadores.map((actual) => actual.id === trabajador.id ? trabajador : actual),
        trabajadorActivo: estado.trabajadorActivo?.id === trabajador.id ? trabajador : estado.trabajadorActivo
      }));
    } catch (error) {
      console.error("Error al actualizar trabajador:", error);
    }
  },
    
  eliminarTrabajador: async (id) => {
    try {
      await eliminarRegistro("trabajadores", id);
      set((estado) => ({
        trabajadores: estado.trabajadores.filter((t) => t.id !== id)
      }));
    } catch (error) {
      console.error("Error al eliminar trabajador:", error);
    }
  }
}));