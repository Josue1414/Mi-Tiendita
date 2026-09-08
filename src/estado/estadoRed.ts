// src/estado/estadoRed.ts
import { create } from "zustand";
import { esCerebroLocal } from "../servicios/cerebroTienda";

interface EstadoRed {
  esMaestro: boolean;
  ipMaestro: string;
  conectadoLAN: boolean;
  setEsMaestro: (esMaestro: boolean) => void;
  setIpMaestro: (ip: string) => void;
  setConectadoLAN: (estado: boolean) => void;
}

export const useEstadoRed = create<EstadoRed>((set) => ({
  esMaestro: typeof window !== 'undefined' && window.apiLocal !== undefined && esCerebroLocal(),
  ipMaestro: localStorage.getItem("ip_maestro") || "",
  conectadoLAN: false,
  setEsMaestro: (esMaestro) => set({ esMaestro }),
  setIpMaestro: (ip) => {
    localStorage.setItem("ip_maestro", ip);
    set({ ipMaestro: ip });
  },
  setConectadoLAN: (estado) => set({ conectadoLAN: estado }),
}));