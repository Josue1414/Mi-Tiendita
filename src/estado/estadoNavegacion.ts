// src/estado/estadoNavegacion.ts
import { create } from "zustand";

export type SeccionApp = "pos" | "inventario" | "nuevo-producto" | "panel" | "reportes" | "stock-bajo" | "historial" | "equipo" | "configuracion" | "perfil" | "caja";

interface EstadoNavegacion {
  seccionActual: SeccionApp;
  productoEditandoId: string | null;
  setSeccionActual: (seccion: SeccionApp, productoEditandoId?: string | null) => void;
}

export const useEstadoNavegacion = create<EstadoNavegacion>((set) => ({
  seccionActual: "pos",
  productoEditandoId: null,
  setSeccionActual: (seccion, productoEditandoId) =>
    set({
      seccionActual: seccion,
      productoEditandoId: seccion === "nuevo-producto" ? productoEditandoId ?? null : null,
    }),
}));
