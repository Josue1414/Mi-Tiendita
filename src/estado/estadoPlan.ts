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
  planActivo: typeof localStorage !== "undefined" ? localStorage.getItem("plan_activo") || "ESTANDAR" : "ESTANDAR",
  maxUsuarios: typeof localStorage !== "undefined" ? Number(localStorage.getItem("plan_max_usuarios")) || 4 : 4,
  maxDispositivos: typeof localStorage !== "undefined" ? Number(localStorage.getItem("plan_max_dispositivos")) || 5 : 5,
  permiteNube: typeof localStorage !== "undefined" && localStorage.getItem("plan_permite_nube") === "true",
  fechaVencimiento: null, // <-- INICIALIZADO EN NULL
  cargarPlan: (planId, maxDisp, maxUsu, nube, fechaVenc) => {
    localStorage.setItem("plan_permite_nube", nube ? "true" : "false");
    localStorage.setItem("plan_activo", planId);
    localStorage.setItem("plan_max_dispositivos", String(maxDisp));
    localStorage.setItem("plan_max_usuarios", String(maxUsu));
    set({
      planActivo: planId,
      maxDispositivos: maxDisp,
      maxUsuarios: maxUsu,
      permiteNube: nube,
      fechaVencimiento: fechaVenc
    });
  }
}));

export const restaurarPlanCacheado = (fechaVencimiento: string | null) => {
  useEstadoPlan.getState().cargarPlan(
    localStorage.getItem("plan_activo") || "ESTANDAR",
    Number(localStorage.getItem("plan_max_dispositivos")) || 5,
    Number(localStorage.getItem("plan_max_usuarios")) || 4,
    localStorage.getItem("plan_permite_nube") === "true",
    fechaVencimiento
  );
};