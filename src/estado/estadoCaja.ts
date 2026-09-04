// src/estado/estadoCaja.ts
import { create } from "zustand";

export interface TurnoCaja {
  id: string;
  trabajadorId: string;
  nombreTrabajador: string;
  fechaInicio: string;
  fechaFin: string | null;
  fondoInicial: number;
  fondoDejado: number | null;
  ventasCalculadas: number | null;
  notaTrabajador: string;
  notaDueno: string;
  estatus: "ABIERTO" | "CERRADO";
}

interface EstadoCaja {
  fondoBaseActual: number;
  notaGeneralDueno: string;
  turnos: TurnoCaja[];
  forzarRecepcionCaja: boolean; // <-- Nuevo estado para el bloqueo
  
  actualizarConfiguracion: (nuevoFondo: number, nuevaNota: string) => void;
  abrirTurno: (trabajadorId: string, nombreTrabajador: string, fondo: number) => void;
  cerrarTurno: (turnoId: string, fondoDejado: number, ventasCalculadas: number, notaTrabajador: string) => void;
  obtenerTurnoActivo: (trabajadorId: string) => TurnoCaja | undefined;
  setForzarRecepcionCaja: (valor: boolean) => void; // <-- Nueva acción
}

// Datos iniciales de prueba
const turnosIniciales: TurnoCaja[] = [];

export const useEstadoCaja = create<EstadoCaja>((set, get) => ({
  fondoBaseActual: 1000,
  notaGeneralDueno: "Recuerden revisar los billetes grandes.",
  turnos: turnosIniciales,
  forzarRecepcionCaja: false, // <-- Valor inicial desactivado

  actualizarConfiguracion: (nuevoFondo, nuevaNota) => {
    set({ fondoBaseActual: nuevoFondo, notaGeneralDueno: nuevaNota });
  },

  abrirTurno: (trabajadorId, nombreTrabajador, fondo) => {
    const nuevoTurno: TurnoCaja = {
      id: crypto.randomUUID(),
      trabajadorId,
      nombreTrabajador,
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      fondoInicial: fondo,
      fondoDejado: null,
      ventasCalculadas: null,
      notaTrabajador: "",
      notaDueno: "",
      estatus: "ABIERTO",
    };
    set((state) => ({ turnos: [nuevoTurno, ...state.turnos] }));
  },

  cerrarTurno: (turnoId, fondoDejado, ventasCalculadas, notaTrabajador) => {
    set((state) => ({
      turnos: state.turnos.map((t) =>
        t.id === turnoId
          ? {
              ...t,
              fechaFin: new Date().toISOString(),
              fondoDejado,
              ventasCalculadas,
              notaTrabajador,
              estatus: "CERRADO",
            }
          : t
      ),
    }));
  },

  obtenerTurnoActivo: (trabajadorId) => {
    return get().turnos.find((t) => t.trabajadorId === trabajadorId && t.estatus === "ABIERTO");
  },

  setForzarRecepcionCaja: (valor) => {
    set({ forzarRecepcionCaja: valor });
  },
}));