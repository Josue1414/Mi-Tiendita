import { create } from 'zustand';

interface EstadoPlan {
  planActivo: string;
  maxUsuarios: number;
  maxDispositivos: number;
  permiteNube: boolean;
  cargarPlan: (planId: string, maxDisp: number, maxUsu: number, nube: boolean) => void;
}

export const useEstadoPlan = create<EstadoPlan>((set) => ({
  planActivo: 'ESTANDAR', // Por defecto para evitar errores antes de cargar
  maxUsuarios: 4,
  maxDispositivos: 5,
  permiteNube: true,
  cargarPlan: (planId, maxDisp, maxUsu, nube) => set({
    planActivo: planId,
    maxDispositivos: maxDisp,
    maxUsuarios: maxUsu,
    permiteNube: nube
  })
}));