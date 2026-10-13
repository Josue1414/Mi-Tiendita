// src/estado/estadoFiados.ts
import { create } from "zustand";
import { guardarFiadoLocal, obtenerTodosLosFiadosLocales, eliminarFiadoLocal } from "../servicios/baseDatosLocal";
import { enviarAccionLAN } from "../servicios/sincronizacionLAN";

export interface AbonoFiado {
  id: string;
  fecha: string;
  monto: number;
  cajero: string;
  tipo: "ABONO" | "LIQUIDACION";
}

export interface Fiado {
  id: string;
  nombre: string;
  celular: string;
  notas: string;
  tickets: string[];
  totalDeuda: number;
  fechaCreacion: string;
  limiteCredito?: number;          // <-- NUEVO
  historialAbonos?: AbonoFiado[];  // <-- NUEVO
}

interface EstadoFiados {
  deudores: Fiado[];
  cargando: boolean;
  cargarDeudores: () => Promise<void>;
  agregarDeudor: (deudor: Fiado) => Promise<void>;
  actualizarDeudor: (deudor: Fiado) => Promise<void>;
  eliminarDeudor: (id: string) => Promise<void>;
  aplicarAccionLAN: (tipo: string, payload: unknown) => Promise<void>;
  hidratarEstadoLAN: (snapshot: { fiados: Fiado[] }) => Promise<void>;
}

export const useEstadoFiados = create<EstadoFiados>((set) => ({
  deudores: [],
  cargando: true,

  cargarDeudores: async () => {
    set({ cargando: true });
    try {
      const datos = await obtenerTodosLosFiadosLocales();
      set({ deudores: datos, cargando: false });
    } catch (error) {
      console.error("Error al cargar fiados:", error);
      set({ cargando: false });
    }
  },

  agregarDeudor: async (deudor) => {
    await guardarFiadoLocal(deudor);
    set((estado) => ({
      deudores: estado.deudores.some((actual) => actual.id === deudor.id)
        ? estado.deudores.map((actual) => actual.id === deudor.id ? deudor : actual)
        : [...estado.deudores, deudor]
    }));
    enviarAccionLAN({ tipo: "LAN_FIADO_AGREGAR", payload: deudor });
  },

  actualizarDeudor: async (deudor) => {
    await guardarFiadoLocal(deudor);
    set((estado) => ({
      deudores: estado.deudores.some((actual) => actual.id === deudor.id)
        ? estado.deudores.map((actual) => actual.id === deudor.id ? deudor : actual)
        : [...estado.deudores, deudor]
    }));
    enviarAccionLAN({ tipo: "LAN_FIADO_ACTUALIZAR", payload: deudor });
  },

  eliminarDeudor: async (id) => {
    await eliminarFiadoLocal(id);
    set((estado) => ({
      deudores: estado.deudores.filter((d) => d.id !== id),
    }));
    enviarAccionLAN({ tipo: "LAN_FIADO_ELIMINAR", payload: id });
  },

  aplicarAccionLAN: async (tipo, payload) => {
    if (tipo === "LAN_FIADO_ELIMINAR") {
      const id = typeof payload === "string" ? payload : (payload as { id?: string } | null)?.id;
      if (id) {
        await eliminarFiadoLocal(id);
        set((estado) => ({ deudores: estado.deudores.filter((deudor) => deudor.id !== id) }));
      }
      return;
    }

    if (tipo !== "LAN_FIADO_AGREGAR" && tipo !== "LAN_FIADO_ACTUALIZAR") return;
    const deudor = payload as Fiado;
    if (!deudor?.id) return;
    await guardarFiadoLocal(deudor);
    set((estado) => ({
      deudores: estado.deudores.some((actual) => actual.id === deudor.id)
        ? estado.deudores.map((actual) => actual.id === deudor.id ? deudor : actual)
        : [...estado.deudores, deudor]
    }));
  },

  hidratarEstadoLAN: async ({ fiados }) => {
    const fiadosLAN = Array.isArray(fiados) ? fiados : [];
    const idsLAN = new Set(fiadosLAN.map((fiado) => fiado.id));
    const locales = await obtenerTodosLosFiadosLocales();
    for (const fiado of locales) {
      if (!idsLAN.has(fiado.id)) {
        enviarAccionLAN({ tipo: "LAN_FIADO_AGREGAR", payload: fiado });
      }
    }
    for (const fiado of fiadosLAN) await guardarFiadoLocal(fiado);
    const fiadosCombinados = new Map(fiadosLAN.map((fiado) => [fiado.id, fiado]));
    locales.forEach((fiado) => fiadosCombinados.set(fiado.id, fiado));
    set({ deudores: [...fiadosCombinados.values()], cargando: false });
  },
}));