// src/estado/estadoTrabajadores.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros } from "../servicios/db";

export type RolTrabajador = "DUEÑO" | "TRABAJADOR";

export interface Trabajador {
  id: string;
  nombre: string;
  rol: RolTrabajador;
  pin: string;
  activo: boolean;
  ventasRealizadas: number;
  ingresosGenerados: number;
  horario?: string;
  diasDescanso?: number[];
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
  toggleActivo: (id: string) => Promise<void>;
  actualizarMetricas: (id: string, monto: number) => Promise<void>;
}

const TRABAJADORES_INICIALES: Trabajador[] = [
  { id: "1", nombre: "Carlos Dueño", rol: "DUEÑO", pin: "DU1234", activo: true, ventasRealizadas: 0, ingresosGenerados: 0, horario: "09:00 - 18:00", diasDescanso: [0] },
  { id: "2", nombre: "María García", rol: "TRABAJADOR", pin: "TR0000", activo: true, ventasRealizadas: 0, ingresosGenerados: 0, horario: "09:00 - 18:00", diasDescanso: [0] }
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
          await guardarRegistro("trabajadores", t);
        }
        // Iniciamos con trabajadorActivo en null para forzar el login
        set({ trabajadores: TRABAJADORES_INICIALES, cargando: false, trabajadorActivo: null });
      } else {
        const trabajadores = (data as Trabajador[]).map((trabajador) => ({
          ...trabajador,
          pin: trabajador.id === "1" && trabajador.pin === "1234" ? "DU1234" : trabajador.pin,
        }));
        const duenoLegado = trabajadores.find((trabajador) => trabajador.id === "1" && trabajador.pin === "DU1234");
        const pinOriginalDueno = (data as Trabajador[]).find((trabajador) => trabajador.id === "1")?.pin;
        if (duenoLegado && pinOriginalDueno === "1234") await guardarRegistro("trabajadores", duenoLegado);
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
      await guardarRegistro("trabajadores", trabajador);
      set((estado) => ({ trabajadores: [...estado.trabajadores, trabajador] }));
    } catch (error) {
      console.error("Error al agregar trabajador:", error);
    }
  },

  actualizarTrabajador: async (trabajador) => {
    try {
      await guardarRegistro("trabajadores", trabajador);
      set((estado) => ({ trabajadores: estado.trabajadores.map((actual) => actual.id === trabajador.id ? trabajador : actual) }));
    } catch (error) {
      console.error("Error al actualizar trabajador:", error);
    }
  },
    
  toggleActivo: async (id) => {
    try {
      const trabajador = get().trabajadores.find(t => t.id === id);
      if (trabajador) {
        const actualizado = { ...trabajador, activo: !trabajador.activo };
        await guardarRegistro("trabajadores", actualizado);
        set((estado) => ({
          trabajadores: estado.trabajadores.map(t => t.id === id ? actualizado : t)
        }));
      }
    } catch (error) {
      console.error("Error al cambiar estado del trabajador:", error);
    }
  },

  actualizarMetricas: async (id, monto) => {
    try {
      const trabajador = get().trabajadores.find(t => t.id === id);
      if (trabajador) {
        const actualizado = { 
          ...trabajador, 
          ventasRealizadas: trabajador.ventasRealizadas + 1, 
          ingresosGenerados: trabajador.ingresosGenerados + monto 
        };
        await guardarRegistro("trabajadores", actualizado);
        set((estado) => ({
          trabajadores: estado.trabajadores.map(t => t.id === id ? actualizado : t)
        }));
      }
    } catch (error) {
      console.error("Error al actualizar métricas:", error);
    }
  }
}));