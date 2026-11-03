// src/estado/estadoConfiguracion.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { useEstadoPlan } from "./estadoPlan"; 
import { useEstadoRed } from "./estadoRed";
import { debeSincronizarConNube, enviarAccionLAN } from "../servicios/sincronizacionLAN";
import { DIAS_ALERTA_CADUCIDAD } from "../utilidades/lotes";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

export interface Configuracion {
  id: string;
  nombreTienda: string;
  mensajeTicket: string;
  direccionTienda: string; 
  logoTienda: string;      
  directorioImagenes: string | null;
  directorioHandle: any | null; 
  sincronizacionNube: boolean;
  configuracionNubePendiente?: boolean;
  teclaCobro: string;
  teclaEfectivo: string;
  teclaTarjeta: string;
  teclaTransferencia: string;
  teclaCodi: string;
  teclaMercadoPago: string;
  teclaFiado: string;
  bancoTransferencia: string;
  titularTransferencia: string;
  cuentaTransferencia: string;
  mensajePago: string;
  correoDueno: string;
  basculaModelo: string;
  basculaPuerto: string;
  basculaBaudRate: string;
  basculaFormato: string;
  escanerModelo: string;
  escanerFabricante: string;
  escanerDriver: string;
  escanerTipo: string;
  escanerPuerto: string;
  escanerDetectado: boolean;
  escanerMensaje: string;
  habilitarFiados: boolean;
  modoAccesoFiados: "TODOS" | "MANUAL";
  diasAlertaCaducidad: number;
  mp_access_token: string;
  mp_pos_id: string;
  codi_imagen: string;
  codi_clabe: string;
}

type PreferenciasFiados = Pick<Configuracion, "habilitarFiados" | "modoAccesoFiados">;

const obtenerClavePreferenciasFiados = () =>
  "preferencias_fiados";

const leerPreferenciasFiados = (): Partial<PreferenciasFiados> => {
  try {
    const guardadas = localStorage.getItem(obtenerClavePreferenciasFiados());
    if (!guardadas) return {};
    const preferencias: Partial<PreferenciasFiados> = JSON.parse(guardadas);
    return {
      ...(typeof preferencias.habilitarFiados === "boolean" ? { habilitarFiados: preferencias.habilitarFiados } : {}),
      ...(preferencias.modoAccesoFiados === "TODOS" || preferencias.modoAccesoFiados === "MANUAL"
        ? { modoAccesoFiados: preferencias.modoAccesoFiados }
        : {})
    };
  } catch (error) {
    console.error("Error al leer las preferencias locales de fiados:", error);
    return {};
  }
};

const guardarPreferenciasFiados = (preferencias: PreferenciasFiados) => {
  localStorage.setItem(obtenerClavePreferenciasFiados(), JSON.stringify(preferencias));
};

interface EstadoConfiguracion extends Configuracion {
  cargando: boolean;
  cargarConfiguracion: () => Promise<void>;
  actualizarDatosTienda: (
    nombre: string,
    mensaje: string,
    direccion: string,
    logo: string,
  ) => Promise<{ sincronizacionPendiente: boolean; errorNube?: string }>;
  setDirectorioImagenes: (nombreCarpeta: string, handle: any) => Promise<void>;
  toggleSincronizacion: () => Promise<void>;
  setTeclaCobro: (tecla: string) => Promise<void>;
  actualizarDatosPago: (datos: Partial<Configuracion>) => Promise<void>;
  actualizarDatosBascula: (modelo: string, puerto: string, baudRate: string, formato: string) => Promise<void>;
  actualizarDatosEscaner: (
    modelo: string,
    fabricante: string,
    driver: string,
    tipo: string,
    puerto: string,
    detectado: boolean,
    mensaje: string,
  ) => Promise<void>;
  setCorreoDueno: (correo: string) => Promise<void>;
  setHabilitarFiados: (activo: boolean) => Promise<void>;
  setModoAccesoFiados: (modo: PreferenciasFiados["modoAccesoFiados"]) => Promise<void>;
  setDiasAlertaCaducidad: (dias: number) => Promise<void>;
  aplicarAccionLAN: (tipo: string, payload: unknown) => Promise<void>;
  hidratarEstadoLAN: (snapshot: {
    trabajadores: unknown[];
    asistencias: unknown[];
    configuracion: Partial<Configuracion>;
  }) => Promise<void>;
  sincronizarConfiguracion: (payload: any) => Promise<void>;
  setCredencialesMP: (token: string, posId: string) => Promise<void>;
  setConfiguracionCodi: (imagen: string, clabe: string) => Promise<void>;
}

const CONFIG_ID = "config_principal";

const CONFIG_INICIAL: Configuracion = {
  id: CONFIG_ID,
  nombreTienda: "Mi Tienda",
  mensajeTicket: "¡Gracias por su preferencia! Vuelva pronto.",
  direccionTienda: "", 
  logoTienda: "",      
  directorioImagenes: null,
  directorioHandle: null,
  sincronizacionNube: false,
  teclaCobro: "F2",
  teclaEfectivo: "F3",
  teclaTarjeta: "F4",
  teclaTransferencia: "F5",
  teclaCodi: "F6",
  teclaMercadoPago: "F7",
  teclaFiado: "F8",
  bancoTransferencia: "",
  titularTransferencia: "",
  cuentaTransferencia: "",
  mensajePago: "Pago realizado. Gracias por su compra, vuelva pronto.",
  correoDueno: "",
  configuracionNubePendiente: false,
  basculaModelo: "Ohaus Valor 2000",
  basculaPuerto: "USB",
  basculaBaudRate: "9600",
  basculaFormato: "serial",
  escanerModelo: "Zebra DS2208",
  escanerFabricante: "Zebra",
  escanerDriver: "USB HID",
  escanerTipo: "Teclado HID",
  escanerPuerto: "USB",
  escanerDetectado: false,
  escanerMensaje: "No se detectó un escáner habilitado. Configure el modelo manualmente.",
  habilitarFiados: false,
  modoAccesoFiados: "TODOS",
  diasAlertaCaducidad: DIAS_ALERTA_CADUCIDAD,
  mp_access_token: "",
  mp_pos_id: "",
  codi_imagen: "",
  codi_clabe: "",
};

const obtenerConfiguracionPersistible = (configuracion: Configuracion): Configuracion =>
  Object.fromEntries(
    (Object.keys(CONFIG_INICIAL) as (keyof Configuracion)[]).map((clave) => [
      clave,
      configuracion[clave]
    ])
  ) as Configuracion;

const guardarConfiguracionLocal = async (configuracion: Configuracion) => {
  const configuracionPersistible = obtenerConfiguracionPersistible(configuracion);

  if (esEscritorio) {
    await guardarRegistro("configuracion", {
      ...configuracionPersistible,
      directorioHandle: configuracion.directorioHandle
    });
    return;
  }

  const configuracionWeb = { ...configuracionPersistible };
  delete configuracionWeb.directorioHandle;
  await guardarRegistro("configuracion", configuracionWeb);
};

const sincronizarDiasAlertaNube = async (dias: number) => {
  if (navigator.onLine) {
    const tiendaId = await obtenerTiendaIdActual();
    if (!tiendaId) throw new Error("No se encontró la tienda para sincronizar los días de alerta.");
    const { data, error } = await supabase
      .from("tiendas")
      .update({ dias_alerta_caducidad: dias })
      .eq("id", tiendaId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se encontró la tienda para guardar los días de alerta en Supabase.");
    return;
  }

  await registrarPendienteSync({
    tabla: "tiendas",
    operacion: "ACTUALIZAR",
    payload: { dias_alerta_caducidad: dias }
  });
};

export const useEstadoConfiguracion = create<EstadoConfiguracion>((set, get) => ({
  ...CONFIG_INICIAL,
  cargando: true,

  cargarConfiguracion: async () => {
    try {
      const permiteNube = useEstadoPlan.getState().permiteNube;
      const datosLocales = await obtenerRegistros("configuracion");
      const configLocal = datosLocales[0] as Configuracion | undefined;
      let estadoLocal = { ...CONFIG_INICIAL, ...(configLocal ?? {}) };
      if (datosLocales.length === 0 && esEscritorio) {
        await guardarRegistro("configuracion", CONFIG_INICIAL);
      }
      if (esEscritorio && !permiteNube) {
        estadoLocal.sincronizacionNube = false;
        await guardarRegistro("configuracion", estadoLocal);
      }
      const preferenciasFiados = leerPreferenciasFiados();
      estadoLocal = {
        ...estadoLocal,
        habilitarFiados: preferenciasFiados.habilitarFiados ?? estadoLocal.habilitarFiados,
        modoAccesoFiados: preferenciasFiados.modoAccesoFiados ?? estadoLocal.modoAccesoFiados
      };
      set({ ...estadoLocal, cargando: false });

      const sincronizacionNubePermitida = debeSincronizarConNube();
      const tiendaId = sincronizacionNubePermitida ? await obtenerTiendaIdActual() : null;

      if (sincronizacionNubePermitida && navigator.onLine && tiendaId) {
        const { data: tiendaNube, error: errorTiendaNube } = await supabase
          .from('tiendas')
          .select('*')
          .eq('id', tiendaId)
          .single();
        if (!debeSincronizarConNube()) return;
        if (errorTiendaNube) throw errorTiendaNube;

        if (tiendaNube) {
          const estadoActualizado: Configuracion = {
            ...CONFIG_INICIAL,
            nombreTienda: tiendaNube.nombre || CONFIG_INICIAL.nombreTienda,
            mensajeTicket: tiendaNube.mensaje_ticket ?? CONFIG_INICIAL.mensajeTicket,
            direccionTienda: tiendaNube.direccion_tienda ?? CONFIG_INICIAL.direccionTienda,
            logoTienda: configLocal?.logoTienda ?? CONFIG_INICIAL.logoTienda,
            directorioImagenes: configLocal?.directorioImagenes ?? CONFIG_INICIAL.directorioImagenes,
            teclaCobro: tiendaNube.tecla_cobro ?? CONFIG_INICIAL.teclaCobro,
            teclaEfectivo: tiendaNube.tecla_efectivo ?? CONFIG_INICIAL.teclaEfectivo,
            teclaTarjeta: tiendaNube.tecla_tarjeta ?? CONFIG_INICIAL.teclaTarjeta,
            teclaTransferencia: tiendaNube.tecla_transferencia ?? CONFIG_INICIAL.teclaTransferencia,
            teclaCodi: tiendaNube.tecla_codi ?? CONFIG_INICIAL.teclaCodi,
            teclaMercadoPago: tiendaNube.tecla_mercado_pago ?? CONFIG_INICIAL.teclaMercadoPago,
            teclaFiado: tiendaNube.tecla_fiado ?? CONFIG_INICIAL.teclaFiado,
            mensajePago: tiendaNube.mensaje_pago || CONFIG_INICIAL.mensajePago,
            bancoTransferencia: tiendaNube.banco_transferencia || "",
            titularTransferencia: tiendaNube.titular_transferencia || "",
            cuentaTransferencia: tiendaNube.cuenta_transferencia || "",
            diasAlertaCaducidad: Number.isInteger(tiendaNube.dias_alerta_caducidad)
              && tiendaNube.dias_alerta_caducidad >= 1
              && tiendaNube.dias_alerta_caducidad <= 365
              ? tiendaNube.dias_alerta_caducidad
              : configLocal?.diasAlertaCaducidad ?? CONFIG_INICIAL.diasAlertaCaducidad,
            id: CONFIG_ID,
            sincronizacionNube: permiteNube ? configLocal?.sincronizacionNube ?? get().sincronizacionNube : false,
            configuracionNubePendiente: configLocal?.configuracionNubePendiente ?? false,
            basculaModelo: configLocal?.basculaModelo ?? CONFIG_INICIAL.basculaModelo,
            basculaPuerto: configLocal?.basculaPuerto ?? CONFIG_INICIAL.basculaPuerto,
            basculaBaudRate: configLocal?.basculaBaudRate ?? CONFIG_INICIAL.basculaBaudRate,
            basculaFormato: configLocal?.basculaFormato ?? CONFIG_INICIAL.basculaFormato,
            escanerModelo: configLocal?.escanerModelo ?? CONFIG_INICIAL.escanerModelo,
            escanerFabricante: configLocal?.escanerFabricante ?? CONFIG_INICIAL.escanerFabricante,
            escanerDriver: configLocal?.escanerDriver ?? CONFIG_INICIAL.escanerDriver,
            escanerTipo: configLocal?.escanerTipo ?? CONFIG_INICIAL.escanerTipo,
            escanerPuerto: configLocal?.escanerPuerto ?? CONFIG_INICIAL.escanerPuerto,
            escanerDetectado: configLocal?.escanerDetectado ?? CONFIG_INICIAL.escanerDetectado,
            escanerMensaje: configLocal?.escanerMensaje ?? CONFIG_INICIAL.escanerMensaje,
            mp_access_token: configLocal?.mp_access_token ?? CONFIG_INICIAL.mp_access_token,
            mp_pos_id: configLocal?.mp_pos_id ?? CONFIG_INICIAL.mp_pos_id,
            codi_imagen: configLocal?.codi_imagen ?? CONFIG_INICIAL.codi_imagen,
            codi_clabe: configLocal?.codi_clabe ?? CONFIG_INICIAL.codi_clabe,
          };

          const preferenciasFiados = leerPreferenciasFiados();
          estadoActualizado.habilitarFiados = preferenciasFiados.habilitarFiados ?? configLocal?.habilitarFiados ?? false;
          estadoActualizado.modoAccesoFiados = preferenciasFiados.modoAccesoFiados ?? configLocal?.modoAccesoFiados ?? "TODOS";

          if (esEscritorio) {
            if (configLocal) {
               estadoActualizado.sincronizacionNube = permiteNube ? configLocal.sincronizacionNube : false;
            }
          }

          if (configLocal?.configuracionNubePendiente) {
            estadoActualizado.nombreTienda = configLocal.nombreTienda;
            estadoActualizado.mensajeTicket = configLocal.mensajeTicket;
            estadoActualizado.direccionTienda = configLocal.direccionTienda;

            if (navigator.onLine) {
              try {
                const { data, error } = await supabase
                  .from("tiendas")
                  .update({
                    nombre: configLocal.nombreTienda,
                    mensaje_ticket: configLocal.mensajeTicket,
                    direccion_tienda: configLocal.direccionTienda
                  })
                  .eq("id", tiendaId)
                  .select("id")
                  .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error("No se encontró la tienda para sincronizar su configuración.");
                estadoActualizado.configuracionNubePendiente = false;
              } catch (error) {
                console.error("No se pudo sincronizar la configuración pendiente con la nube:", error);
              }
            }
          }

          await guardarConfiguracionLocal(estadoActualizado);
          set({ ...estadoActualizado, cargando: false });
          return;
        }
      }

      set({ cargando: false });
    } catch (error) {
      console.error("Error al cargar configuracion:", error);
      set({ cargando: false });
    }
  },

  actualizarDatosTienda: async (nombre, mensaje, direccion, logo) => {
    const sincronizaNube = debeSincronizarConNube();
    const nuevaConfig: Configuracion = {
      ...get(),
      nombreTienda: nombre,
      mensajeTicket: mensaje,
      direccionTienda: direccion,
      logoTienda: logo,
      configuracionNubePendiente: sincronizaNube
    };

    try {
      await guardarConfiguracionLocal(nuevaConfig);
      set({
        nombreTienda: nombre, 
        mensajeTicket: mensaje, 
        direccionTienda: direccion, 
        logoTienda: logo,
        configuracionNubePendiente: nuevaConfig.configuracionNubePendiente
      });
    } catch (error) {
      console.error("Error al guardar localmente los datos de la tienda:", error);
      throw error;
    }

    const payloadLAN = { nombreTienda: nombre, mensajeTicket: mensaje, direccionTienda: direccion, logoTienda: logo };
    if (enviarAccionLAN({ tipo: "LAN_CONFIG_TIENDA", payload: payloadLAN })) {
      return { sincronizacionPendiente: false };
    }

    if (!sincronizaNube) return { sincronizacionPendiente: false };

    const payloadNube = { nombre, mensaje_ticket: mensaje, direccion_tienda: direccion };
    if (!navigator.onLine) {
      try {
        await registrarPendienteSync({ tabla: "tiendas", operacion: "ACTUALIZAR", payload: payloadNube });
        return { sincronizacionPendiente: true };
      } catch (error) {
        console.error("La configuración se guardó localmente, pero no se pudo registrar su sincronización pendiente:", error);
        return {
          sincronizacionPendiente: true,
          errorNube: error instanceof Error ? error.message : "No se pudo registrar la sincronización pendiente."
        };
      }
    }

    try {
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) throw new Error("No se encontró la tienda vinculada para sincronizar.");

      const { data, error } = await supabase
        .from("tiendas")
        .update(payloadNube)
        .eq("id", tiendaId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No se encontró la tienda para sincronizar su configuración.");

      const configSincronizada = { ...nuevaConfig, configuracionNubePendiente: false };
      await guardarConfiguracionLocal(configSincronizada);
      set({ configuracionNubePendiente: false });
      return { sincronizacionPendiente: false };
    } catch (error) {
      console.error("Los datos se guardaron localmente, pero no se pudieron sincronizar con la nube:", error);
      return {
        sincronizacionPendiente: true,
        errorNube: error instanceof Error ? error.message : "Error desconocido al sincronizar con la nube."
      };
    }
  },
  
  setDirectorioImagenes: async (nombreCarpeta, handle) => {
    try {
      const nuevaConfig = { ...get(), directorioImagenes: nombreCarpeta, directorioHandle: handle };
      await guardarConfiguracionLocal(nuevaConfig);
      set({ directorioImagenes: nombreCarpeta, directorioHandle: handle });
    } catch (error) {
      console.error("Error al guardar el directorio:", error);
    }
  },
  
  toggleSincronizacion: async () => {
    try {
      const permiteNube = useEstadoPlan.getState().permiteNube;
      if (!permiteNube) {
        throw new Error("Tu plan actual no permite la sincronización en la nube.");
      }

      const nuevoEstado = !get().sincronizacionNube;
      if (esEscritorio) {
        const nuevaConfig = { ...get(), sincronizacionNube: nuevoEstado };
        await guardarRegistro("configuracion", nuevaConfig);
      }
      set({ sincronizacionNube: nuevoEstado });
    } catch (error) {
      console.error("Error al cambiar la sincronización:", error);
      throw error; 
    }
  },

  setTeclaCobro: async (tecla) => {
    const teclaNormalizada = tecla.trim() || CONFIG_INICIAL.teclaCobro;
    try {
      await guardarConfiguracionLocal({ ...get(), teclaCobro: teclaNormalizada });
      set({ teclaCobro: teclaNormalizada });
      const payloadLAN = { teclaCobro: teclaNormalizada };
      if (enviarAccionLAN({ tipo: "LAN_CONFIG_TECLA", payload: payloadLAN })) return;

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('tiendas').update({ tecla_cobro: teclaNormalizada }).eq('id', tiendaId);
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { tecla_cobro: teclaNormalizada } });
      }
    } catch (error) {
      console.error("Error al guardar la tecla de cobro:", error);
    }
  },

  actualizarDatosPago: async (datos) => {
    try {
      const configBase = get();
      const nuevaConfig = { ...configBase, ...datos };
      
      await guardarConfiguracionLocal(nuevaConfig);
      set(datos);

      const payloadLAN = {
        mensajePago: nuevaConfig.mensajePago,
        bancoTransferencia: nuevaConfig.bancoTransferencia,
        titularTransferencia: nuevaConfig.titularTransferencia,
        cuentaTransferencia: nuevaConfig.cuentaTransferencia,
        teclaEfectivo: nuevaConfig.teclaEfectivo,
        teclaTarjeta: nuevaConfig.teclaTarjeta,
        teclaTransferencia: nuevaConfig.teclaTransferencia,
        teclaCodi: nuevaConfig.teclaCodi,
        teclaMercadoPago: nuevaConfig.teclaMercadoPago,
        teclaFiado: nuevaConfig.teclaFiado,
        codi_imagen: nuevaConfig.codi_imagen,
        codi_clabe: nuevaConfig.codi_clabe
      };
      const payloadNube = {
        mensaje_pago: payloadLAN.mensajePago,
        banco_transferencia: payloadLAN.bancoTransferencia,
        titular_transferencia: payloadLAN.titularTransferencia,
        cuenta_transferencia: payloadLAN.cuentaTransferencia,
        tecla_efectivo: payloadLAN.teclaEfectivo,
        tecla_tarjeta: payloadLAN.teclaTarjeta,
        tecla_transferencia: payloadLAN.teclaTransferencia,
        tecla_codi: payloadLAN.teclaCodi,
        tecla_mercado_pago: payloadLAN.teclaMercadoPago,
        tecla_fiado: payloadLAN.teclaFiado
      };

      if (enviarAccionLAN({ tipo: "LAN_CONFIG_PAGO", payload: payloadLAN })) return;

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('tiendas').update(payloadNube).eq('id', tiendaId);
        }
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: payloadNube });
      }
    } catch (error) {
      console.error("Error al guardar datos de pago:", error);
    }
  },

  actualizarDatosBascula: async (modelo, puerto, baudRate, formato) => {
    try {
      const configBase = get();
      const nuevaConfig = {
        ...configBase,
        basculaModelo: modelo,
        basculaPuerto: puerto,
        basculaBaudRate: baudRate,
        basculaFormato: formato
      };

      if (esEscritorio) {
        await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      } else {
        await guardarConfiguracionLocal(nuevaConfig);
      }

      set({
        basculaModelo: modelo,
        basculaPuerto: puerto,
        basculaBaudRate: baudRate,
        basculaFormato: formato
      });
    } catch (error) {
      console.error("Error al guardar la configuración de la báscula:", error);
    }
  },

  actualizarDatosEscaner: async (modelo, fabricante, driver, tipo, puerto, detectado, mensaje) => {
    try {
      const configBase = get();
      const nuevaConfig = {
        ...configBase,
        escanerModelo: modelo,
        escanerFabricante: fabricante,
        escanerDriver: driver,
        escanerTipo: tipo,
        escanerPuerto: puerto,
        escanerDetectado: detectado,
        escanerMensaje: mensaje
      };

      if (esEscritorio) {
        await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      } else {
        await guardarConfiguracionLocal(nuevaConfig);
      }

      set({
        escanerModelo: modelo,
        escanerFabricante: fabricante,
        escanerDriver: driver,
        escanerTipo: tipo,
        escanerPuerto: puerto,
        escanerDetectado: detectado,
        escanerMensaje: mensaje
      });
    } catch (error) {
      console.error("Error al guardar la configuración del escáner:", error);
    }
  },

  setCorreoDueno: async (correo) => {
    const correoLimpio = correo.trim().toLowerCase();
    const configBase = get();
    if (esEscritorio) {
      const nuevaConfig = { ...configBase, correoDueno: correoLimpio };
      await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
    }
    set({ correoDueno: correoLimpio });
  },

  setHabilitarFiados: async (activo) => {
    try {
      const configBase = get();
      const nuevaConfig = { ...configBase, habilitarFiados: activo };
      guardarPreferenciasFiados({ habilitarFiados: activo, modoAccesoFiados: configBase.modoAccesoFiados });
      set({ habilitarFiados: activo });
      
      if (esEscritorio) {
        await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      } else {
         await guardarConfiguracionLocal(nuevaConfig);
      }

      enviarAccionLAN({
        tipo: "LAN_CONFIG_FIADOS",
        payload: { habilitarFiados: activo, modoAccesoFiados: configBase.modoAccesoFiados }
      });

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('tiendas').update({ habilitar_fiados: activo }).eq('id', tiendaId);
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { habilitar_fiados: activo } });
      }
    } catch (error) {
      console.error("Error al guardar configuración de fiados:", error);
    }
  },

  setModoAccesoFiados: async (modo) => {
    try {
      const configBase = get();
      const nuevaConfig = { ...configBase, modoAccesoFiados: modo };
      guardarPreferenciasFiados({ habilitarFiados: configBase.habilitarFiados, modoAccesoFiados: modo });
      set({ modoAccesoFiados: modo });
      
      if (esEscritorio) {
        await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      } else {
         await guardarConfiguracionLocal(nuevaConfig);
      }

      enviarAccionLAN({
        tipo: "LAN_CONFIG_FIADOS",
        payload: { habilitarFiados: configBase.habilitarFiados, modoAccesoFiados: modo }
      });

      if (debeSincronizarConNube() && navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('tiendas').update({ modo_acceso_fiados: modo }).eq('id', tiendaId);
      } else if (debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { modo_acceso_fiados: modo } });
      }
    } catch (error) {
      console.error("Error al guardar el modo de acceso a fiados:", error);
    }
  },

  setDiasAlertaCaducidad: async (dias) => {
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      throw new Error("Los días de alerta deben ser un número entero entre 1 y 365.");
    }
    const configuracionActualizada = { ...get(), diasAlertaCaducidad: dias };
    await guardarConfiguracionLocal(configuracionActualizada);
    set({ diasAlertaCaducidad: dias });
    enviarAccionLAN({
      tipo: "LAN_CONFIG_CADUCIDAD",
      payload: { diasAlertaCaducidad: dias }
    });
    if (debeSincronizarConNube()) {
      await sincronizarDiasAlertaNube(dias);
    }
  },

  setCredencialesMP: async (token, posId) => {
    const nuevaConfig = { ...get(), mp_access_token: token, mp_pos_id: posId };
    await guardarConfiguracionLocal(nuevaConfig);
    set({ mp_access_token: token, mp_pos_id: posId });
  },

  setConfiguracionCodi: async (imagen, clabe) => {
    const nuevaConfig = { ...get(), codi_imagen: imagen, codi_clabe: clabe };
    await guardarConfiguracionLocal(nuevaConfig);
    set({ codi_imagen: imagen, codi_clabe: clabe });
    
    enviarAccionLAN({
      tipo: "LAN_CONFIG_PAGO",
      payload: {
        ...get(),
        codi_imagen: imagen,
        codi_clabe: clabe
      }
    });
  },

  aplicarAccionLAN: async (tipo, payload) => {
    const configuracionLAN = (payload || {}) as Partial<Configuracion>;
    let actualizacion: Partial<Configuracion>;
    let payloadNube: Record<string, unknown>;

    if (tipo === "LAN_CONFIG_TIENDA") {
      actualizacion = {
        nombreTienda: configuracionLAN.nombreTienda,
        mensajeTicket: configuracionLAN.mensajeTicket,
        direccionTienda: configuracionLAN.direccionTienda,
        logoTienda: configuracionLAN.logoTienda
      };
      payloadNube = {
        nombre: actualizacion.nombreTienda,
        mensaje_ticket: actualizacion.mensajeTicket,
        direccion_tienda: actualizacion.direccionTienda
      };
    } else if (tipo === "LAN_CONFIG_PAGO") {
      actualizacion = {
        mensajePago: configuracionLAN.mensajePago,
        bancoTransferencia: configuracionLAN.bancoTransferencia,
        titularTransferencia: configuracionLAN.titularTransferencia,
        cuentaTransferencia: configuracionLAN.cuentaTransferencia,
        teclaEfectivo: configuracionLAN.teclaEfectivo,
        teclaTarjeta: configuracionLAN.teclaTarjeta,
        teclaTransferencia: configuracionLAN.teclaTransferencia,
        teclaCodi: configuracionLAN.teclaCodi,
        teclaMercadoPago: configuracionLAN.teclaMercadoPago,
        teclaFiado: configuracionLAN.teclaFiado,
        codi_imagen: configuracionLAN.codi_imagen,
        codi_clabe: configuracionLAN.codi_clabe
      };
      payloadNube = {
        mensaje_pago: actualizacion.mensajePago,
        banco_transferencia: actualizacion.bancoTransferencia,
        titular_transferencia: actualizacion.titularTransferencia,
        cuenta_transferencia: actualizacion.cuentaTransferencia,
        tecla_efectivo: actualizacion.teclaEfectivo,
        tecla_tarjeta: actualizacion.teclaTarjeta,
        tecla_transferencia: actualizacion.teclaTransferencia,
        tecla_codi: actualizacion.teclaCodi,
        tecla_mercado_pago: actualizacion.teclaMercadoPago,
        tecla_fiado: actualizacion.teclaFiado
      };
    } else if (tipo === "LAN_CONFIG_TECLA") {
      actualizacion = { teclaCobro: configuracionLAN.teclaCobro };
      payloadNube = { tecla_cobro: actualizacion.teclaCobro };

    } else if (tipo === "LAN_CONFIG_FIADOS") {
      const activo = configuracionLAN.habilitarFiados ?? false;
      const modo = configuracionLAN.modoAccesoFiados ?? "TODOS";
      
      guardarPreferenciasFiados({
        habilitarFiados: activo,
        modoAccesoFiados: modo
      });
      
      set({ habilitarFiados: activo, modoAccesoFiados: modo });
      
      actualizacion = {
        habilitarFiados: activo,
        modoAccesoFiados: modo
      };
      payloadNube = {
        habilitar_fiados: activo,
        modo_acceso_fiados: modo
      };
      
    } else if (tipo === "LAN_CONFIG_CADUCIDAD") {
      const dias = configuracionLAN.diasAlertaCaducidad;
      if (typeof dias !== "number" || !Number.isInteger(dias) || dias < 1 || dias > 365) return;
      const configuracionActualizada = { ...get(), diasAlertaCaducidad: dias };
      await guardarConfiguracionLocal(configuracionActualizada);
      set({ diasAlertaCaducidad: dias });
      if (useEstadoRed.getState().esMaestro) {
        enviarAccionLAN({ tipo: "LAN_CONFIG_CADUCIDAD", payload: { diasAlertaCaducidad: dias } });
      }
      if (debeSincronizarConNube()) {
        await sincronizarDiasAlertaNube(dias);
      }
      return;
    } else {
      return;
    }

    const nuevaConfiguracion = { ...get(), ...actualizacion };
    await guardarConfiguracionLocal(nuevaConfiguracion);
    set(actualizacion);

    if (debeSincronizarConNube() && navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from("tiendas").update(payloadNube).eq("id", tiendaId);
    } else if (debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: "tiendas", operacion: "ACTUALIZAR", payload: payloadNube });
    }
  },

  hidratarEstadoLAN: async (snapshot) => {
    const clavesCompartidas: (keyof Configuracion)[] = [
      "nombreTienda",
      "mensajeTicket",
      "direccionTienda",
      "logoTienda",
      "teclaCobro",
      "teclaEfectivo",
      "teclaTarjeta",
      "teclaTransferencia",
      "teclaCodi",
      "teclaMercadoPago",
      "teclaFiado",
      "bancoTransferencia",
      "titularTransferencia",
      "cuentaTransferencia",
      "mensajePago",
      "diasAlertaCaducidad",
      "codi_imagen", 
      "codi_clabe",
      "habilitarFiados",
      "modoAccesoFiados"
    ];
    const actualizacion: Partial<Configuracion> = {};
    for (const clave of clavesCompartidas) {
      const valor = snapshot.configuracion[clave];
      if (valor !== undefined) Object.assign(actualizacion, { [clave]: valor });
    }

    const configuracionActualizada = { ...get(), ...actualizacion };
    await guardarConfiguracionLocal(configuracionActualizada);
    
    if (actualizacion.habilitarFiados !== undefined || actualizacion.modoAccesoFiados !== undefined) {
      guardarPreferenciasFiados({
        habilitarFiados: actualizacion.habilitarFiados ?? get().habilitarFiados,
        modoAccesoFiados: actualizacion.modoAccesoFiados ?? get().modoAccesoFiados
      });
    }
    
    set((estado) => ({ ...estado, ...actualizacion, cargando: false }));
  },

  sincronizarConfiguracion: async (payload: any) => {
    const { new: nuevo } = payload;
    if (nuevo) {
      const actualizacion: Partial<Configuracion> = {
        nombreTienda: nuevo.nombre,
        mensajeTicket: nuevo.mensaje_ticket ?? get().mensajeTicket,
        direccionTienda: nuevo.direccion_tienda ?? get().direccionTienda,
        teclaCobro: nuevo.tecla_cobro || get().teclaCobro,
        teclaEfectivo: nuevo.tecla_efectivo || get().teclaEfectivo,
        teclaTarjeta: nuevo.tecla_tarjeta || get().teclaTarjeta,
        teclaTransferencia: nuevo.tecla_transferencia || get().teclaTransferencia,
        teclaCodi: nuevo.tecla_codi || get().teclaCodi,
        teclaMercadoPago: nuevo.tecla_mercado_pago || get().teclaMercadoPago,
        teclaFiado: nuevo.tecla_fiado || get().teclaFiado,
        mensajePago: nuevo.mensaje_pago,
        bancoTransferencia: nuevo.banco_transferencia || "",
        titularTransferencia: nuevo.titular_transferencia || "",
        cuentaTransferencia: nuevo.cuenta_transferencia || "",
        habilitarFiados: nuevo.habilitar_fiados ?? get().habilitarFiados,
        modoAccesoFiados: nuevo.modo_acceso_fiados ?? get().modoAccesoFiados
      };
      
      if (Number.isInteger(nuevo.dias_alerta_caducidad) && nuevo.dias_alerta_caducidad >= 1 && nuevo.dias_alerta_caducidad <= 365) {
        actualizacion.diasAlertaCaducidad = nuevo.dias_alerta_caducidad;
      }
      
      guardarPreferenciasFiados({
        habilitarFiados: actualizacion.habilitarFiados!,
        modoAccesoFiados: actualizacion.modoAccesoFiados!
      });
      
      set((state) => ({ ...state, ...actualizacion }));
      
      if (esEscritorio) {
        const configBase = get();
        await guardarRegistro("configuracion", { 
          ...configBase, 
          ...actualizacion, 
          directorioHandle: configBase.directorioHandle 
        });
      } else {
        await guardarConfiguracionLocal({ ...get(), ...actualizacion });
      }

      if (actualizacion.diasAlertaCaducidad !== undefined) {
        enviarAccionLAN({
          tipo: "LAN_CONFIG_CADUCIDAD",
          payload: { diasAlertaCaducidad: actualizacion.diasAlertaCaducidad }
        });
      }

      enviarAccionLAN({
        tipo: "LAN_CONFIG_TIENDA",
        payload: {
          nombreTienda: actualizacion.nombreTienda,
          mensajeTicket: actualizacion.mensajeTicket,
          direccionTienda: actualizacion.direccionTienda,
          logoTienda: get().logoTienda
        }
      });
      enviarAccionLAN({
        tipo: "LAN_CONFIG_TECLA",
        payload: { teclaCobro: actualizacion.teclaCobro }
      });
      enviarAccionLAN({
        tipo: "LAN_CONFIG_PAGO",
        payload: {
          mensajePago: actualizacion.mensajePago,
          bancoTransferencia: actualizacion.bancoTransferencia,
          titularTransferencia: actualizacion.titularTransferencia,
          cuentaTransferencia: actualizacion.cuentaTransferencia,
          teclaEfectivo: actualizacion.teclaEfectivo,
          teclaTarjeta: actualizacion.teclaTarjeta,
          teclaTransferencia: actualizacion.teclaTransferencia,
          teclaCodi: actualizacion.teclaCodi,
          teclaMercadoPago: actualizacion.teclaMercadoPago,
          teclaFiado: actualizacion.teclaFiado,
          codi_imagen: get().codi_imagen,
          codi_clabe: get().codi_clabe
        }
      });
      
      enviarAccionLAN({
        tipo: "LAN_CONFIG_FIADOS",
        payload: {
          habilitarFiados: actualizacion.habilitarFiados,
          modoAccesoFiados: actualizacion.modoAccesoFiados
        }
      });
    }
  }
}));