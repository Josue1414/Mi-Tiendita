// src/estado/estadoAsistencias.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros } from "../servicios/db";

export interface RegistroAsistencia {
  id: string; // Formato: trabajadorId_YYYY-MM-DD
  trabajadorId: string;
  fecha: string;
  horaEntrada: string;
  horaSalida: string | null;
  desconexiones: number;
}

interface EstadoAsistencias {
  asistencias: RegistroAsistencia[];
  cargarAsistencias: () => Promise<void>;
  registrarEntrada: (trabajadorId: string) => Promise<void>;
  registrarSalida: (trabajadorId: string) => Promise<void>;
}

export const useEstadoAsistencias = create<EstadoAsistencias>((set, get) => ({
  asistencias: [],

  cargarAsistencias: async () => {
    try {
      const data = await obtenerRegistros("asistencias");
      set({ asistencias: data as RegistroAsistencia[] });
    } catch (error) {
      console.error("Error al cargar asistencias:", error);
    }
  },

  registrarEntrada: async (trabajadorId: string) => {
    const hoy = new Date();
    const fechaLocal = hoy.toLocaleDateString("en-CA"); // YYYY-MM-DD local
    const horaLocal = hoy.toLocaleTimeString("en-GB", { hour12: false }); // HH:MM:SS
    const idRegistro = `${trabajadorId}_${fechaLocal}`;

    const { asistencias } = get();
    const registroExistente = asistencias.find((a) => a.id === idRegistro);

    let nuevoRegistro: RegistroAsistencia;

    if (registroExistente) {
      // Ya había entrado hoy. Significa que se desconectó y volvió a entrar.
      nuevoRegistro = { ...registroExistente, horaSalida: null };
    } else {
      // Primera entrada del día
      nuevoRegistro = {
        id: idRegistro,
        trabajadorId,
        fecha: fechaLocal,
        horaEntrada: horaLocal,
        horaSalida: null,
        desconexiones: 0,
      };
    }

    await guardarRegistro("asistencias", nuevoRegistro);
    set((estado) => ({
      asistencias: estado.asistencias.filter((a) => a.id !== idRegistro).concat(nuevoRegistro),
    }));
  },

  registrarSalida: async (trabajadorId: string) => {
    const hoy = new Date();
    const fechaLocal = hoy.toLocaleDateString("en-CA");
    const horaLocal = hoy.toLocaleTimeString("en-GB", { hour12: false });
    const idRegistro = `${trabajadorId}_${fechaLocal}`;

    const { asistencias } = get();
    const registroExistente = asistencias.find((a) => a.id === idRegistro);

    if (registroExistente) {
      // Registra salida e incrementa desconexiones
      const nuevoRegistro = {
        ...registroExistente,
        horaSalida: horaLocal,
        desconexiones: registroExistente.desconexiones + 1,
      };
      await guardarRegistro("asistencias", nuevoRegistro);
      set((estado) => ({
        asistencias: estado.asistencias.filter((a) => a.id !== idRegistro).concat(nuevoRegistro),
      }));
    }
  },
}));