// src/estado/estadoRed.ts
import { create } from "zustand";
import { esCerebroLocal } from "../servicios/cerebroTienda";
import { Capacitor } from "@capacitor/core";

const puedeSerCerebroNativo = () =>
  typeof window !== "undefined"
  && (window.apiLocal !== undefined || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"));

interface EstadoRed {
  esMaestro: boolean;
  ipMaestro: string;
  conectadoLAN: boolean;
  servidorLANActivo: boolean;
  dispositivosLANConectados: number;
  setEsMaestro: (esMaestro: boolean) => void;
  setIpMaestro: (ip: string) => void;
  setConectadoLAN: (estado: boolean) => void;
  setEstadoLAN: (activo: boolean, dispositivosConectados: number) => void;
}

export const useEstadoRed = create<EstadoRed>((set) => ({
  esMaestro: puedeSerCerebroNativo() && esCerebroLocal(),
  ipMaestro: localStorage.getItem("ip_maestro") || "",
  conectadoLAN: false,
  servidorLANActivo: false,
  dispositivosLANConectados: 0,
  setEsMaestro: (esMaestro) => set({ esMaestro }),
  setIpMaestro: (ip) => {
    localStorage.setItem("ip_maestro", ip);
    set({ ipMaestro: ip });
  },
  setConectadoLAN: (estado) => set({ conectadoLAN: estado }),
  setEstadoLAN: (activo, dispositivosLANConectados) => set({
    servidorLANActivo: activo,
    dispositivosLANConectados
  }),
}));