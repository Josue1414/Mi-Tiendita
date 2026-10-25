// src/estado/estadoRed.ts
import { create } from "zustand";
import { esCerebroLocal, esRespaldoLocal } from "../servicios/cerebroTienda";
import { Capacitor } from "@capacitor/core";

const puedeSerCerebroNativo = () =>
  typeof window !== "undefined"
  && (window.apiLocal !== undefined || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"));

interface EstadoRed {
  esMaestro: boolean;
  esRespaldo: boolean;
  ipMaestro: string;
  conectadoLAN: boolean;
  servidorLANActivo: boolean;
  dispositivosLANConectados: number;
  setEsMaestro: (esMaestro: boolean) => void;
  setEsRespaldo: (esRespaldo: boolean) => void;
  setIpMaestro: (ip: string) => void;
  setConectadoLAN: (estado: boolean) => void;
  setEstadoLAN: (activo: boolean, dispositivosConectados: number) => void;
}

export const useEstadoRed = create<EstadoRed>((set) => ({
  esMaestro: puedeSerCerebroNativo() && esCerebroLocal(),
  esRespaldo: puedeSerCerebroNativo() && esRespaldoLocal(),
  ipMaestro: localStorage.getItem("ip_maestro") || "",
  conectadoLAN: false,
  servidorLANActivo: false,
  dispositivosLANConectados: 0,
  setEsMaestro: (esMaestro) => set({ esMaestro, ...(esMaestro ? { esRespaldo: false } : {}) }),
  setEsRespaldo: (esRespaldo) => set({ esRespaldo }),
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