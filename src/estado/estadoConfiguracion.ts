import { create } from "zustand";
import { guardarRegistro, obtenerRegistros } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

export interface Configuracion {
  id: string;
  nombreTienda: string;
  mensajeTicket: string;
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
  actualizarDatosTienda: (nombre: string, mensaje: string) => Promise<void>;
  setDirectorioImagenes: (nombreCarpeta: string, handle: any) => Promise<void>;
  toggleSincronizacion: () => Promise<void>;
  setTeclaCobro: (tecla: string) => Promise<void>;
  actualizarDatosPago: (datos: Partial<Configuracion>) => Promise<void>;
  setCorreoDueno: (correo: string) => Promise<void>;
}

const CONFIG_ID = "config_principal";

const CONFIG_INICIAL: Configuracion = {
  id: CONFIG_ID,
  nombreTienda: "Mi Tienda",
  mensajeTicket: "¡Gracias por su preferencia! Vuelva pronto.",
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
      let estadoLocal = { ...CONFIG_INICIAL };

      if (esEscritorio) {
        const data = await obtenerRegistros("configuracion");
        if (data.length === 0) {
          await guardarRegistro("configuracion", CONFIG_INICIAL);
        } else {
          estadoLocal = { ...CONFIG_INICIAL, ...(data[0] as Configuracion) };
        }
        set({ ...estadoLocal, cargando: false });
      }

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          
          if (esEscritorio) {
            await supabase.from('tiendas').update({
              nombre: estadoLocal.nombreTienda,
              mensaje_pago: estadoLocal.mensajePago,
              banco_transferencia: estadoLocal.bancoTransferencia,
              titular_transferencia: estadoLocal.titularTransferencia,
              cuenta_transferencia: estadoLocal.cuentaTransferencia
            }).eq('id', tiendaId);
          }

          const { data: tiendaNube } = await supabase.from('tiendas').select('*').eq('id', tiendaId).single();
          
          if (tiendaNube) {
            const estadoActualizado = {
              ...estadoLocal,
              nombreTienda: tiendaNube.nombre || estadoLocal.nombreTienda,
              mensajePago: tiendaNube.mensaje_pago || estadoLocal.mensajePago,
              bancoTransferencia: tiendaNube.banco_transferencia || "",
              titularTransferencia: tiendaNube.titular_transferencia || "",
              cuentaTransferencia: tiendaNube.cuenta_transferencia || ""
            };
            
            if (esEscritorio) await guardarRegistro("configuracion", estadoActualizado);
            set({ ...estadoActualizado, cargando: false });
          }
        } else if (!esEscritorio) {
          set({ cargando: false });
        }
      } else if (!esEscritorio) {
        set({ cargando: false });
      }
    } catch (error) {
      console.error("Error al cargar configuracion:", error);
      set({ cargando: false });
    }
  },

  actualizarDatosTienda: async (nombre, mensaje) => {
    try {
      const configBase = get();
      const nuevaConfig = { ...configBase, nombreTienda: nombre, mensajeTicket: mensaje };
      
      if (esEscritorio) await guardarRegistro("configuracion", { ...nuevaConfig, directorioHandle: configBase.directorioHandle });
      set({ nombreTienda: nombre, mensajeTicket: mensaje });

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('tiendas').update({ nombre }).eq('id', tiendaId);
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

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('tiendas').update({
            mensaje_pago: nuevaConfig.mensajePago,
            banco_transferencia: nuevaConfig.bancoTransferencia,
            titular_transferencia: nuevaConfig.titularTransferencia,
            cuenta_transferencia: nuevaConfig.cuentaTransferencia
          }).eq('id', tiendaId);
        }
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
}));