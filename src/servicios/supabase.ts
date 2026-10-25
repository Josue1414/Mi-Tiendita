// src/servicios/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { crearIdentificadorUnico } from '../utilidades/identificador';

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

export interface DispositivoVinculado {
  id: string;
  hardware_id: string;
  nombre_dispositivo: string;
  ultimo_acceso: string;
  tienda_id: string;
  es_cerebro?: boolean;
}

type CambioDispositivoPendienteEntrada =
  | { tipo: "actualizar"; id: string; cambios: Partial<DispositivoVinculado> }
  | { tipo: "eliminar"; id: string };

type CambioDispositivoPendiente = CambioDispositivoPendienteEntrada & { idCambio: string };

const claveCacheDispositivos = (tiendaId: string) => `dispositivos_vinculados_cache:${tiendaId}`;
const clavePendientesDispositivos = (tiendaId: string) => `dispositivos_vinculados_pendientes:${tiendaId}`;
const sincronizacionesDispositivosEnCurso = new Map<string, Promise<void>>();

export const obtenerDispositivosVinculadosCache = (tiendaId: string): DispositivoVinculado[] => {
  try {
    const guardados = localStorage.getItem(claveCacheDispositivos(tiendaId));
    if (!guardados) return [];
    const datos: unknown = JSON.parse(guardados);
    if (!Array.isArray(datos)) throw new Error("El listado local de dispositivos no tiene un formato válido.");
    return datos.filter((dispositivo): dispositivo is DispositivoVinculado =>
      typeof dispositivo?.id === "string"
      && typeof dispositivo.hardware_id === "string"
      && typeof dispositivo.nombre_dispositivo === "string"
      && dispositivo.tienda_id === tiendaId
    );
  } catch (error) {
    console.error("No se pudo leer el listado local de dispositivos vinculados:", error);
    return [];
  }
};

export const guardarDispositivosVinculadosCache = (tiendaId: string, dispositivos: DispositivoVinculado[]) => {
  localStorage.setItem(claveCacheDispositivos(tiendaId), JSON.stringify(dispositivos));
};

const agregarDispositivoAlCache = (dispositivo: DispositivoVinculado) => {
  const actuales = obtenerDispositivosVinculadosCache(dispositivo.tienda_id);
  const listado = actuales.some((actual) => actual.id === dispositivo.id)
    ? actuales.map((actual) => actual.id === dispositivo.id ? { ...actual, ...dispositivo } : actual)
    : [...actuales, dispositivo];
  guardarDispositivosVinculadosCache(dispositivo.tienda_id, listado);
};

export const obtenerDispositivosVinculadosDeNube = async (tiendaId: string) => {
  const { data, error } = await supabase
    .from("dispositivos_vinculados")
    .select("*")
    .eq("tienda_id", tiendaId);
  if (error) throw error;
  const dispositivos = (data ?? []) as DispositivoVinculado[];
  guardarDispositivosVinculadosCache(tiendaId, dispositivos);
  return dispositivos;
};

export const guardarCambioDispositivoPendiente = (
  tiendaId: string,
  cambio: CambioDispositivoPendienteEntrada,
) => {
  const clave = clavePendientesDispositivos(tiendaId);
  const guardados = localStorage.getItem(clave);
  const pendientes: CambioDispositivoPendiente[] = guardados ? JSON.parse(guardados) : [];
  pendientes.push({ ...cambio, idCambio: crearIdentificadorUnico() });
  localStorage.setItem(clave, JSON.stringify(pendientes));
};

export const sincronizarCambiosDispositivosPendientes = (tiendaId: string): Promise<void> => {
  const sincronizacionEnCurso = sincronizacionesDispositivosEnCurso.get(tiendaId);
  if (sincronizacionEnCurso) return sincronizacionEnCurso;
  const tarea = (async () => {
    if (!navigator.onLine) return;
    const clave = clavePendientesDispositivos(tiendaId);
    while (true) {
      const guardados = localStorage.getItem(clave);
      if (!guardados) return;
      const pendientes: CambioDispositivoPendiente[] = JSON.parse(guardados);
      const cambio = pendientes[0];
      if (!cambio) return;
      const consulta = supabase.from("dispositivos_vinculados");
      const resultado = cambio.tipo === "actualizar"
        ? await consulta.update(cambio.cambios).eq("id", cambio.id).eq("tienda_id", tiendaId)
        : await consulta.delete().eq("id", cambio.id).eq("tienda_id", tiendaId);
      if (resultado.error) {
        throw resultado.error;
      }
      const cambiosActuales: CambioDispositivoPendiente[] = JSON.parse(localStorage.getItem(clave) || "[]");
      const indice = cambiosActuales.findIndex((pendiente) => pendiente.idCambio === cambio.idCambio);
      if (indice >= 0) cambiosActuales.splice(indice, 1);
      else cambiosActuales.shift();
      if (cambiosActuales.length > 0) localStorage.setItem(clave, JSON.stringify(cambiosActuales));
      else localStorage.removeItem(clave);
    }
  })().finally(() => {
    sincronizacionesDispositivosEnCurso.delete(tiendaId);
  });
  sincronizacionesDispositivosEnCurso.set(tiendaId, tarea);
  return tarea;
};

const procesarCambiosDispositivosPendientes = () => {
  if (!navigator.onLine || localStorage.getItem("plan_permite_nube") !== "true") return;
  void obtenerTiendaIdActual()
    .then(async (tiendaId) => {
      if (tiendaId) await sincronizarCambiosDispositivosPendientes(tiendaId);
    })
    .catch((error: unknown) => {
      console.warn("No se pudieron sincronizar los cambios pendientes de equipos vinculados:", error);
    });
};

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

if (typeof window !== "undefined") {
  window.addEventListener("online", procesarCambiosDispositivosPendientes);
  window.addEventListener("focus", procesarCambiosDispositivosPendientes);
  procesarCambiosDispositivosPendientes();
}

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
      const sufijo = idWebAnterior?.startsWith('web-') ? idWebAnterior.slice(4) : crearIdentificadorUnico();
      identificador = `android-${sufijo}`;
      localStorage.setItem('android_hardware_id', identificador);
    }
    return identificador;
  }

  let identificador = localStorage.getItem('web_hardware_id');
  if (!identificador) {
    identificador = `web-${crearIdentificadorUnico()}`;
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
        agregarDispositivoAlCache(dispositivoMigrado as DispositivoVinculado);
        void obtenerDispositivosVinculadosDeNube(tienda.id).catch((error: unknown) => {
          console.warn("No se pudo refrescar el listado de equipos para uso sin conexión:", error);
        });
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
    agregarDispositivoAlCache({
      ...existente,
      ultimo_acceso: new Date().toISOString()
    } as DispositivoVinculado);
    void obtenerDispositivosVinculadosDeNube(tienda.id).catch((error: unknown) => {
      console.warn("No se pudo refrescar el listado de equipos para uso sin conexión:", error);
    });
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
  agregarDispositivoAlCache(nuevo as DispositivoVinculado);
  void obtenerDispositivosVinculadosDeNube(tienda.id).catch((error: unknown) => {
    console.warn("No se pudo refrescar el listado de equipos para uso sin conexión:", error);
  });
  return { hardwareId, dispositivo: nuevo };
};