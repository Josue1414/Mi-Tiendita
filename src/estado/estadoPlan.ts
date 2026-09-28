// src/estado/estadoPlan.ts
import { create } from 'zustand';

interface EstadoPlan {
  planActivo: string;
  maxUsuarios: number;
  maxDispositivos: number;
  permiteNube: boolean;
  fechaVencimiento: string | null; // <-- NUEVO ESTADO
  cargarPlan: (planId: string, maxDisp: number, maxUsu: number, nube: boolean, fechaVenc: string | null) => void;
}

export const useEstadoPlan = create<EstadoPlan>((set) => ({
  planActivo: 'ESTANDAR', 
  maxUsuarios: 4,
  maxDispositivos: 5,
  permiteNube: true,
  fechaVencimiento: null, // <-- INICIALIZADO EN NULL
  cargarPlan: (planId, maxDisp, maxUsu, nube, fechaVenc) => set({
    planActivo: planId,
    maxDispositivos: maxDisp,
    maxUsuarios: maxUsu,
    permiteNube: nube,
    fechaVencimiento: fechaVenc // <-- GUARDADO EN EL ESTADO
  })
}));