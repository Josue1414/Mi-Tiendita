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
  bancoTransferencia: string;
  titularTransferencia: string;
  cuentaTransferencia: string;
  mensajePago: string;
  correoDueno: string;
  basculaModelo: string;
  basculaPuerto: string;
  basculaBaudRate: string;
  basculaFormato: string;
  basculaUnidad: string;
  escanerModelo: string;
  escanerFabricante: string;
  escanerDriver: string;
  escanerTipo: string;
  escanerPuerto: string;
  escanerDetectado: boolean;
  escanerMensaje: string;
  habilitarFiados: boolean; // <-- NUEVO ESTADO
  modoAccesoFiados: "TODOS" | "MANUAL";
  diasAlertaCaducidad: number;
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
  actualizarDatosBascula: (modelo: string, puerto: string, baudRate: string, formato: string, unidad: string) => Promise<void>;
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
  setHabilitarFiados: (activo: boolean) => Promise<void>; // <-- NUEVA FUNCIÓN
  setModoAccesoFiados: (modo: PreferenciasFiados["modoAccesoFiados"]) => Promise<void>;
  setDiasAlertaCaducidad: (dias: number) => Promise<void>;
  aplicarAccionLAN: (tipo: string, payload: unknown) => Promise<void>;
  hidratarEstadoLAN: (snapshot: {
    trabajadores: unknown[];
    asistencias: unknown[];
    configuracion: Partial<Configuracion>;
  }) => Promise<void>;
  sincronizarConfiguracion: (payload: any) => Promise<void>; 
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
  basculaUnidad: "kg",
  escanerModelo: "Zebra DS2208",
  escanerFabricante: "Zebra",
  escanerDriver: "USB HID",
  escanerTipo: "Teclado HID",
  escanerPuerto: "USB",
  escanerDetectado: false,
  escanerMensaje: "No se detectó un escáner habilitado. Configure el modelo manualmente.",
  habilitarFiados: false, // <-- VALOR INICIAL
  modoAccesoFiados: "TODOS",
  diasAlertaCaducidad: DIAS_ALERTA_CADUCIDAD,
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
    set({ cargando: true });
    try {
      const sincronizacionNubePermitida = debeSincronizarConNube();
      const tiendaId = sincronizacionNubePermitida ? await obtenerTiendaIdActual() : null;
      const permiteNube = useEstadoPlan.getState().permiteNube;

      if (sincronizacionNubePermitida && navigator.onLine && tiendaId) {
        const { data: tiendaNube, error: errorTiendaNube } = await supabase
          .from('tiendas')
          .select('*')
          .eq('id', tiendaId)
          .single();
        if (errorTiendaNube) throw errorTiendaNube;

        if (tiendaNube) {
          const datosLocales = await obtenerRegistros("configuracion");
          const configLocal = datosLocales[0] as Configuracion | undefined;
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
            configuracionNubePendiente: configLocal?.configuracionNubePendiente ?? false
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

      let estadoLocal = { ...CONFIG_INICIAL };

      const data = await obtenerRegistros("configuracion");
      if (data.length === 0) {
        if (esEscritorio) {
          await guardarRegistro("configuracion", CONFIG_INICIAL);
        }
      } else {
        estadoLocal = { ...CONFIG_INICIAL, ...(data[0] as Configuracion) };
        if (esEscritorio && !permiteNube) {
            estadoLocal.sincronizacionNube = false;
            await guardarRegistro("configuracion", estadoLocal);
        }
      }

      const preferenciasFiados = leerPreferenciasFiados();
      estadoLocal = {
        ...estadoLocal,
        habilitarFiados: preferenciasFiados.habilitarFiados ?? estadoLocal.habilitarFiados,
        modoAccesoFiados: preferenciasFiados.modoAccesoFiados ?? estadoLocal.modoAccesoFiados
      };

      set({ ...estadoLocal, cargando: false });
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
        teclaTransferencia: nuevaConfig.teclaTransferencia
      };
      const payloadNube = {
        mensaje_pago: payloadLAN.mensajePago,
        banco_transferencia: payloadLAN.bancoTransferencia,
        titular_transferencia: payloadLAN.titularTransferencia,
        cuenta_transferencia: payloadLAN.cuentaTransferencia,
        tecla_efectivo: payloadLAN.teclaEfectivo,
        tecla_tarjeta: payloadLAN.teclaTarjeta,
        tecla_transferencia: payloadLAN.teclaTransferencia
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

  actualizarDatosBascula: async (modelo, puerto, baudRate, formato, unidad) => {
    try {
      const configBase = get();
      const nuevaConfig = {
        ...configBase,
        basculaModelo: modelo,
        basculaPuerto: puerto,
        basculaBaudRate: baudRate,
        basculaFormato: formato,
        basculaUnidad: unidad
      };

      if (esEscritorio) {
        await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      }

      set({
        basculaModelo: modelo,
        basculaPuerto: puerto,
        basculaBaudRate: baudRate,
        basculaFormato: formato,
        basculaUnidad: unidad
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

  // <-- NUEVA FUNCIÓN PARA ACTIVAR/DESACTIVAR FIADOS LOCALMENTE -->
  setHabilitarFiados: async (activo) => {
    try {
      const configBase = get();
      const nuevaConfig = { ...configBase, habilitarFiados: activo };
      guardarPreferenciasFiados({ habilitarFiados: activo, modoAccesoFiados: configBase.modoAccesoFiados });
      set({ habilitarFiados: activo });
      if (esEscritorio) {
        await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
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
        teclaTransferencia: configuracionLAN.teclaTransferencia
      };
      payloadNube = {
        mensaje_pago: actualizacion.mensajePago,
        banco_transferencia: actualizacion.bancoTransferencia,
        titular_transferencia: actualizacion.titularTransferencia,
        cuenta_transferencia: actualizacion.cuentaTransferencia,
        tecla_efectivo: actualizacion.teclaEfectivo,
        tecla_tarjeta: actualizacion.teclaTarjeta,
        tecla_transferencia: actualizacion.teclaTransferencia
      };
    } else if (tipo === "LAN_CONFIG_TECLA") {
      actualizacion = { teclaCobro: configuracionLAN.teclaCobro };
      payloadNube = { tecla_cobro: actualizacion.teclaCobro };
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
      "bancoTransferencia",
      "titularTransferencia",
      "cuentaTransferencia",
      "mensajePago",
      "diasAlertaCaducidad"
    ];
    const actualizacion: Partial<Configuracion> = {};
    for (const clave of clavesCompartidas) {
      const valor = snapshot.configuracion[clave];
      if (valor !== undefined) Object.assign(actualizacion, { [clave]: valor });
    }

    const configuracionActualizada = { ...get(), ...actualizacion };
    await guardarConfiguracionLocal(configuracionActualizada);
    set({ ...actualizacion, cargando: false });
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
        mensajePago: nuevo.mensaje_pago,
        bancoTransferencia: nuevo.banco_transferencia || "",
        titularTransferencia: nuevo.titular_transferencia || "",
        cuentaTransferencia: nuevo.cuenta_transferencia || ""
      };
      if (Number.isInteger(nuevo.dias_alerta_caducidad) && nuevo.dias_alerta_caducidad >= 1 && nuevo.dias_alerta_caducidad <= 365) {
        actualizacion.diasAlertaCaducidad = nuevo.dias_alerta_caducidad;
      }
      
      set((state) => ({ ...state, ...actualizacion }));
      
      if (esEscritorio) {
        const configBase = get();
        await guardarRegistro("configuracion", { 
          ...configBase, 
          ...actualizacion, 
          directorioHandle: configBase.directorioHandle 
        });
      }
      if (actualizacion.diasAlertaCaducidad !== undefined) {
        await guardarConfiguracionLocal({ ...get(), diasAlertaCaducidad: actualizacion.diasAlertaCaducidad });
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
          teclaTransferencia: actualizacion.teclaTransferencia
        }
      });
      if (actualizacion.diasAlertaCaducidad !== undefined) {
        await guardarConfiguracionLocal({ ...get(), ...actualizacion });
        enviarAccionLAN({
          tipo: "LAN_CONFIG_CADUCIDAD",
          payload: { diasAlertaCaducidad: actualizacion.diasAlertaCaducidad }
        });
      }
    }
  }
}));