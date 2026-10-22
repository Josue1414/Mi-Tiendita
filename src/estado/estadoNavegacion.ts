// src/estado/estadoNavegacion.ts
import { create } from "zustand";

export type SeccionApp = "pos" | "inventario" | "nuevo-producto" | "panel" | "reportes" | "stock-bajo" | "historial" | "equipo" | "configuracion" | "perfil" | "caja" | "fiados";
interface EstadoNavegacion {
  seccionActual: SeccionApp;
  productoEditandoId: string | null;
  loteCaducidadSeleccionadoId: string | null;
  setSeccionActual: (seccion: SeccionApp, productoEditandoId?: string | null) => void;
  abrirLoteCaducidad: (loteId: string) => void;
  limpiarLoteCaducidad: () => void;
}

export const useEstadoNavegacion = create<EstadoNavegacion>((set) => ({
  seccionActual: "pos",
  productoEditandoId: null,
  loteCaducidadSeleccionadoId: null,
  setSeccionActual: (seccion, productoEditandoId) =>
    set((estado) => ({
      seccionActual: seccion,
      productoEditandoId: seccion === "nuevo-producto" ? productoEditandoId ?? null : null,
      loteCaducidadSeleccionadoId: seccion === "stock-bajo" ? estado.loteCaducidadSeleccionadoId : null,
    })),
  abrirLoteCaducidad: (loteId) => set({ seccionActual: "stock-bajo", productoEditandoId: null, loteCaducidadSeleccionadoId: loteId }),
  limpiarLoteCaducidad: () => set({ loteCaducidadSeleccionadoId: null }),
}));
