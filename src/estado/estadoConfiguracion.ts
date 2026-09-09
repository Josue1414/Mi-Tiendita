// src/estado/estadoConfiguracion.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

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
  teclaCobro: string;
  teclaEfectivo: string;
  teclaTarjeta: string;
  teclaTransferencia: string;
  bancoTransferencia: string;
  titularTransferencia: string;
  cuentaTransferencia: string;
  mensajePago: string;
  correoDueno: string;
}

interface EstadoConfiguracion extends Configuracion {
  cargando: boolean;
  cargarConfiguracion: () => Promise<void>;
  actualizarDatosTienda: (nombre: string, mensaje: string, direccion: string, logo: string) => Promise<void>;
  setDirectorioImagenes: (nombreCarpeta: string, handle: any) => Promise<void>;
  toggleSincronizacion: () => Promise<void>;
  setTeclaCobro: (tecla: string) => Promise<void>;
  actualizarDatosPago: (datos: Partial<Configuracion>) => Promise<void>;
  setCorreoDueno: (correo: string) => Promise<void>;
  sincronizarConfiguracion: (payload: any) => Promise<void>; // <-- NUEVO: Para tiempo real
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
};

export const useEstadoConfiguracion = create<EstadoConfiguracion>((set, get) => ({
  ...CONFIG_INICIAL,
  cargando: true,

  cargarConfiguracion: async () => {
    set({ cargando: true });
    try {
      const tiendaId = await obtenerTiendaIdActual();

      if (navigator.onLine && tiendaId) {
        const { data: tiendaNube } = await supabase.from('tiendas').select('*').eq('id', tiendaId).single();

        if (tiendaNube) {
          const estadoActualizado = {
            ...CONFIG_INICIAL,
            nombreTienda: tiendaNube.nombre || CONFIG_INICIAL.nombreTienda,
            mensajeTicket: tiendaNube.mensaje_ticket ?? CONFIG_INICIAL.mensajeTicket,
            direccionTienda: tiendaNube.direccion_tienda ?? CONFIG_INICIAL.direccionTienda,
            teclaCobro: tiendaNube.tecla_cobro ?? CONFIG_INICIAL.teclaCobro,
            teclaEfectivo: tiendaNube.tecla_efectivo ?? CONFIG_INICIAL.teclaEfectivo,
            teclaTarjeta: tiendaNube.tecla_tarjeta ?? CONFIG_INICIAL.teclaTarjeta,
            teclaTransferencia: tiendaNube.tecla_transferencia ?? CONFIG_INICIAL.teclaTransferencia,
            mensajePago: tiendaNube.mensaje_pago || CONFIG_INICIAL.mensajePago,
            bancoTransferencia: tiendaNube.banco_transferencia || "",
            titularTransferencia: tiendaNube.titular_transferencia || "",
            cuentaTransferencia: tiendaNube.cuenta_transferencia || "",
            id: CONFIG_ID
          };

          if (esEscritorio) {
            const data = await obtenerRegistros("configuracion");
            if (data.length === 0) {
              await guardarRegistro("configuracion", estadoActualizado);
            } else {
              await guardarRegistro("configuracion", estadoActualizado);
            }
          }

          set({ ...estadoActualizado, cargando: false });
          return;
        }
      }

      let estadoLocal = { ...CONFIG_INICIAL };

      if (esEscritorio) {
        const data = await obtenerRegistros("configuracion");
        if (data.length === 0) {
          await guardarRegistro("configuracion", CONFIG_INICIAL);
        } else {
          estadoLocal = { ...CONFIG_INICIAL, ...(data[0] as Configuracion) };
        }
      }

      set({ ...estadoLocal, cargando: false });
    } catch (error) {
      console.error("Error al cargar configuracion:", error);
      set({ cargando: false });
    }
  },

  actualizarDatosTienda: async (nombre, mensaje, direccion, logo) => {
    try {
      const configBase = get();
      const nuevaConfig = { 
        ...configBase, 
        nombreTienda: nombre, 
        mensajeTicket: mensaje,
        direccionTienda: direccion,
        logoTienda: logo
      };
      
      if (esEscritorio) await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      set({ 
        nombreTienda: nombre, 
        mensajeTicket: mensaje, 
        direccionTienda: direccion, 
        logoTienda: logo 
      });

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('tiendas').update({ nombre, mensaje_ticket: mensaje, direccion_tienda: direccion }).eq('id', tiendaId);
      } else {
        await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { nombre, mensaje_ticket: mensaje, direccion_tienda: direccion } });
      }
    } catch (error) {
      console.error("Error al guardar datos de la tienda:", error);
    }
  },
  
  setDirectorioImagenes: async (nombreCarpeta, handle) => {
    try {
      if (esEscritorio) {
        const nuevaConfig = { ...get(), directorioImagenes: nombreCarpeta, directorioHandle: handle };
        await guardarRegistro("configuracion", nuevaConfig);
      }
      set({ directorioImagenes: nombreCarpeta, directorioHandle: handle });
    } catch (error) {
      console.error("Error al guardar el directorio:", error);
    }
  },
  
  toggleSincronizacion: async () => {
    try {
      const nuevoEstado = !get().sincronizacionNube;
      if (esEscritorio) {
        const nuevaConfig = { ...get(), sincronizacionNube: nuevoEstado };
        await guardarRegistro("configuracion", nuevaConfig);
      }
      set({ sincronizacionNube: nuevoEstado });
    } catch (error) {
      console.error("Error al cambiar la sincronización:", error);
    }
  },

  setTeclaCobro: async (tecla) => {
    const teclaNormalizada = tecla.trim() || CONFIG_INICIAL.teclaCobro;
    try {
      if (esEscritorio) {
        const nuevaConfig = { ...get(), teclaCobro: teclaNormalizada };
        await guardarRegistro("configuracion", nuevaConfig);
      }
      set({ teclaCobro: teclaNormalizada });
      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('tiendas').update({ tecla_cobro: teclaNormalizada }).eq('id', tiendaId);
      } else {
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
      
      if (esEscritorio) await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      set(datos);

      const payloadNube = {
        mensaje_pago: nuevaConfig.mensajePago,
        banco_transferencia: nuevaConfig.bancoTransferencia,
        titular_transferencia: nuevaConfig.titularTransferencia,
        cuenta_transferencia: nuevaConfig.cuentaTransferencia,
        tecla_efectivo: nuevaConfig.teclaEfectivo,
        tecla_tarjeta: nuevaConfig.teclaTarjeta,
        tecla_transferencia: nuevaConfig.teclaTransferencia
      };

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('tiendas').update(payloadNube).eq('id', tiendaId);
        }
      } else {
        await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: payloadNube });
      }
    } catch (error) {
      console.error("Error al guardar datos de pago:", error);
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

  sincronizarConfiguracion: async (payload: any) => {
    const { new: nuevo } = payload;
    if (nuevo) {
      const actualizacion = {
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
      
      set((state) => ({ ...state, ...actualizacion }));
      
      if (esEscritorio) {
        const configBase = get();
        await guardarRegistro("configuracion", { 
          ...configBase, 
          ...actualizacion, 
          directorioHandle: configBase.directorioHandle 
        });
      }
    }
  }
}));