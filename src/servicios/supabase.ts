// src/servicios/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Faltan las variables de entorno de Supabase. El sistema funcionará en modo 100% local.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", 
  supabaseAnonKey || "placeholder"
);

let tiendaIdCache: string | null = null;

// CORREGIDO: Prioriza la tienda seleccionada localmente para cuentas con múltiples sucursales
export const obtenerTiendaIdActual = async () => {
  const localTiendaId = localStorage.getItem("tienda_id");
  if (localTiendaId) {
    tiendaIdCache = localTiendaId;
    return tiendaIdCache;
  }
  if (tiendaIdCache) return tiendaIdCache;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data } = await supabase
    .from('miembros_tienda')
    .select('tienda_id')
    .eq('usuario_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (data) {
    tiendaIdCache = data.tienda_id;
    return tiendaIdCache;
  }
  
  return null;
};

export const establecerTiendaIdActual = (tiendaId: string) => {
  tiendaIdCache = tiendaId;
  localStorage.setItem("tienda_id", tiendaId);
};

export const obtenerIdentificadorDispositivo = async () => {
  const apiLocal = (window as Window & { apiLocal?: { obtenerHardwareId: () => Promise<string> } }).apiLocal;
  if (apiLocal) return apiLocal.obtenerHardwareId();

  if (Capacitor.getPlatform() === 'android') {
    let identificador = localStorage.getItem('android_hardware_id');
    if (!identificador) {
      const idWebAnterior = localStorage.getItem('web_hardware_id');
      const sufijo = idWebAnterior?.startsWith('web-') ? idWebAnterior.slice(4) : crypto.randomUUID();
      identificador = `android-${sufijo}`;
      localStorage.setItem('android_hardware_id', identificador);
    }
    return identificador;
  }

  let identificador = localStorage.getItem('web_hardware_id');
  if (!identificador) {
    identificador = `web-${crypto.randomUUID()}`;
    localStorage.setItem('web_hardware_id', identificador);
  }
  return identificador;
};

const obtenerNombreDispositivoProximo = async (tiendaId: string, hardwareId: string) => {
  const baseNombre = hardwareId.startsWith('android-')
    ? 'Android'
    : hardwareId.startsWith('web-')
      ? 'Navegador Web'
      : 'PC Local';

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

  if (!existente && Capacitor.getPlatform() === 'android') {
    const idWebAnterior = localStorage.getItem('web_hardware_id');
    if (idWebAnterior?.startsWith('web-')) {
      const { data: dispositivoWebAnterior, error: errorMigracionConsulta } = await supabase
        .from('dispositivos_vinculados')
        .select('*')
        .eq('tienda_id', tienda.id)
        .eq('hardware_id', idWebAnterior)
        .maybeSingle();
      if (errorMigracionConsulta) throw errorMigracionConsulta;

      if (dispositivoWebAnterior) {
        const { data: dispositivoMigrado, error: errorMigracion } = await supabase
          .from('dispositivos_vinculados')
          .update({ hardware_id: hardwareId, ultimo_acceso: new Date().toISOString() })
          .eq('id', dispositivoWebAnterior.id)
          .select()
          .single();
        if (errorMigracion) throw errorMigracion;
        localStorage.setItem('nombre_dispositivo_local', dispositivoMigrado.nombre_dispositivo);
        return { hardwareId, dispositivo: dispositivoMigrado };
      }
    }
  }

  if (existente) {
    const { error: errorActualizacion } = await supabase.from('dispositivos_vinculados')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('tienda_id', tienda.id)
      .eq('hardware_id', hardwareId);
    if (errorActualizacion) throw errorActualizacion;
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