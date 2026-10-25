// src/servicios/cerebroTienda.ts
import { obtenerIdentificadorDispositivo, supabase } from "./supabase";
import { Capacitor } from "@capacitor/core";

const claveRolCerebro = (tiendaId: string) => `mi_tienda_es_cerebro:${tiendaId}`;
const claveRolLAN = (tiendaId: string) => `mi_tienda_rol_lan:${tiendaId}`;

const puedeSerCerebro = () =>
  (typeof window !== "undefined" && window.apiLocal !== undefined)
  || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android");

const guardarRolLocal = (tiendaId: string, esCerebro: boolean) => {
  localStorage.setItem(claveRolCerebro(tiendaId), esCerebro ? "true" : "false");
};

export const obtenerRolCerebro = async (tiendaId: string): Promise<boolean> => {
  if (!puedeSerCerebro()) return false;
  const rolLocal = localStorage.getItem(claveRolLAN(tiendaId));
  if (rolLocal) return rolLocal === "cerebro";
  const hardwareId = await obtenerIdentificadorDispositivo();
  const { data, error } = await supabase
    .from("dispositivos_vinculados")
    .select("es_cerebro")
    .eq("tienda_id", tiendaId)
    .eq("hardware_id", hardwareId)
    .maybeSingle();

  if (error) throw error;
  const esCerebro = data?.es_cerebro === true;
  guardarRolLocal(tiendaId, esCerebro);
  return esCerebro;
};

export const establecerRolCerebro = async (tiendaId: string, esCerebro: boolean) => {
  if (!puedeSerCerebro()) throw new Error("El Cerebro solo puede ser la aplicación de escritorio o una APK Android.");
  const hardwareId = await obtenerIdentificadorDispositivo();
  const { data, error } = await supabase.rpc("configurar_cerebro", {
    p_tienda_id: tiendaId,
    p_hardware_id: hardwareId,
    p_es_cerebro: esCerebro
  });

  if (error) throw error;
  if (esCerebro && data !== true) {
    throw new Error("Esta tienda ya tiene otro dispositivo configurado como Cerebro.");
  }

  localStorage.removeItem(claveRolLAN(tiendaId));
  guardarRolLocal(tiendaId, esCerebro);
  return true;
};

export const esCerebroLocal = () => {
  const tiendaId = localStorage.getItem("tienda_id");
  if (!tiendaId) return false;
  const rolLocal = localStorage.getItem(claveRolLAN(tiendaId));
  return rolLocal ? rolLocal === "cerebro" : localStorage.getItem(claveRolCerebro(tiendaId)) === "true";
};

export const esRespaldoLocal = () => {
  const tiendaId = localStorage.getItem("tienda_id");
  return tiendaId ? localStorage.getItem(claveRolLAN(tiendaId)) === "respaldo" : false;
};

export const marcarRespaldoLocal = (tiendaId: string) => {
  localStorage.setItem(claveRolLAN(tiendaId), "respaldo");
};

export const promoverCerebroLocal = (tiendaId: string) => {
  localStorage.setItem(claveRolLAN(tiendaId), "cerebro");
};