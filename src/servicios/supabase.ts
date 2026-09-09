// src/servicios/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Faltan las variables de entorno de Supabase. El sistema funcionará en modo 100% local.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", 
  supabaseAnonKey || "placeholder"
);

// NUEVO: Variable temporal para no saturar la base de datos con peticiones
let tiendaIdCache: string | null = null;

// NUEVO: Función para obtener el ID de la tienda del usuario activo

export const obtenerTiendaIdActual = async () => {
  if (tiendaIdCache) return tiendaIdCache;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data } = await supabase
    .from('miembros_tienda')
    .select('tienda_id')
    .eq('usuario_id', session.user.id)
    .single();

  if (data) {
    tiendaIdCache = data.tienda_id;
    return tiendaIdCache;
  }
  
  return null;
};

const obtenerIdentificadorDispositivo = async () => {
  const apiLocal = (window as Window & { apiLocal?: { obtenerHardwareId: () => Promise<string> } }).apiLocal;
  if (apiLocal) return apiLocal.obtenerHardwareId();

  let identificador = localStorage.getItem('web_hardware_id');
  if (!identificador) {
    identificador = `web-${crypto.randomUUID()}`;
    localStorage.setItem('web_hardware_id', identificador);
  }
  return identificador;
};

const obtenerNombreDispositivoProximo = async (tiendaId: string, hardwareId: string) => {
  const baseNombre = hardwareId.startsWith('web-') ? 'Navegador Web' : 'PC Local';

  const { data: dispositivos, error } = await supabase
    .from('dispositivos_vinculados')
    .select('nombre_dispositivo')
    .eq('tienda_id', tiendaId);

  if (error) throw error;

  const usados = new Set((dispositivos ?? []).map((d: { nombre_dispositivo: string }) => d.nombre_dispositivo));
  let contador = 1;
  let nombre = baseNombre;

  while (usados.has(nombre)) {
    contador += 1;
    nombre = `${baseNombre} ${contador}`;
  }

  return nombre;
};

export const registrarDispositivoActual = async (tienda: { id: string; max_dispositivos: number; nombre?: string }) => {
  const hardwareId = await obtenerIdentificadorDispositivo();
  const { data: existente, error: errorConsulta } = await supabase
    .from('dispositivos_vinculados')
    .select('*')
    .eq('tienda_id', tienda.id)
    .eq('hardware_id', hardwareId)
    .maybeSingle();

  if (errorConsulta) throw errorConsulta;

  if (existente) {
    await supabase.from('dispositivos_vinculados')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('tienda_id', tienda.id)
      .eq('hardware_id', hardwareId);
    localStorage.setItem('nombre_dispositivo_local', existente.nombre_dispositivo);
    return { hardwareId, dispositivo: existente };
  }

  const { count, error: errorConteo } = await supabase
    .from('dispositivos_vinculados')
    .select('id', { count: 'exact', head: true })
    .eq('tienda_id', tienda.id);
  if (errorConteo) throw errorConteo;
  if ((count ?? 0) >= tienda.max_dispositivos) {
    throw new Error(`Límite de ${tienda.max_dispositivos} dispositivo(s) alcanzado en "${tienda.nombre || 'esta tienda'}".`);
  }

  const nombre = await obtenerNombreDispositivoProximo(tienda.id, hardwareId);
  const { data: nuevo, error: errorAlta } = await supabase
    .from('dispositivos_vinculados')
    .insert({ tienda_id: tienda.id, hardware_id: hardwareId, nombre_dispositivo: nombre })
    .select()
    .single();
  if (errorAlta) throw errorAlta;

  localStorage.setItem('nombre_dispositivo_local', nombre);
  return { hardwareId, dispositivo: nuevo };
};