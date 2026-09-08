import { supabase } from "./supabase";

const claveRolCerebro = (tiendaId: string) => `mi_tienda_es_cerebro:${tiendaId}`;

const obtenerApiLocal = () => window.apiLocal;

const guardarRolLocal = (tiendaId: string, esCerebro: boolean) => {
  localStorage.setItem(claveRolCerebro(tiendaId), esCerebro ? "true" : "false");
};

export const obtenerRolCerebro = async (tiendaId: string): Promise<boolean> => {
  const apiLocal = obtenerApiLocal();
  if (!apiLocal) return false;

  const hardwareId = await apiLocal.obtenerHardwareId();
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
  const apiLocal = obtenerApiLocal();
  if (!apiLocal) throw new Error("El cerebro solo puede ser una PC de escritorio.");

  const hardwareId = await apiLocal.obtenerHardwareId();
  const { data, error } = await supabase.rpc("configurar_cerebro", {
    p_tienda_id: tiendaId,
    p_hardware_id: hardwareId,
    p_es_cerebro: esCerebro
  });

  if (error) throw error;
  if (esCerebro && data !== true) {
    throw new Error("Esta tienda ya tiene otra PC configurada como cerebro.");
  }

  guardarRolLocal(tiendaId, esCerebro);
  return true;
};

export const esCerebroLocal = () => {
  const tiendaId = localStorage.getItem("tienda_id");
  return tiendaId ? localStorage.getItem(claveRolCerebro(tiendaId)) === "true" : false;
};