// src/estado/estadoConfiguracion.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros } from "../servicios/db";

export interface Configuracion {
  id: string;
  nombreTienda: string;
  mensajeTicket: string;
  directorioImagenes: string | null;
  directorioHandle: any | null; // Almacena el objeto FileSystemDirectoryHandle real
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
      const data = await obtenerRegistros("configuracion");
      if (data.length === 0) {
        await guardarRegistro("configuracion", CONFIG_INICIAL);
        set({ ...CONFIG_INICIAL, cargando: false });
      } else {
        const configDb = data[0] as Configuracion;
        set({ ...CONFIG_INICIAL, ...configDb, cargando: false });
      }
    } catch (error) {
      console.error("Error al cargar configuracion:", error);
      set({ cargando: false });
    }
  },

  actualizarDatosTienda: async (nombre, mensaje) => {
    try {
      const nuevaConfig = { ...get(), nombreTienda: nombre, mensajeTicket: mensaje };
      await guardarRegistro("configuracion", {
        id: CONFIG_ID,
        nombreTienda: nuevaConfig.nombreTienda,
        mensajeTicket: nuevaConfig.mensajeTicket,
        directorioImagenes: nuevaConfig.directorioImagenes,
        directorioHandle: nuevaConfig.directorioHandle,
        sincronizacionNube: nuevaConfig.sincronizacionNube,
        teclaCobro: nuevaConfig.teclaCobro,
        teclaEfectivo: nuevaConfig.teclaEfectivo,
        teclaTarjeta: nuevaConfig.teclaTarjeta,
        teclaTransferencia: nuevaConfig.teclaTransferencia,
        bancoTransferencia: nuevaConfig.bancoTransferencia,
        titularTransferencia: nuevaConfig.titularTransferencia,
        cuentaTransferencia: nuevaConfig.cuentaTransferencia,
        mensajePago: nuevaConfig.mensajePago,
        correoDueno: nuevaConfig.correoDueno,
      });
      set({ nombreTienda: nombre, mensajeTicket: mensaje });
    } catch (error) {
      console.error("Error al guardar datos de la tienda:", error);
    }
  },
  
  setDirectorioImagenes: async (nombreCarpeta, handle) => {
    try {
      const nuevaConfig = { ...get(), directorioImagenes: nombreCarpeta, directorioHandle: handle };
      await guardarRegistro("configuracion", {
        id: CONFIG_ID,
        nombreTienda: nuevaConfig.nombreTienda,
        mensajeTicket: nuevaConfig.mensajeTicket,
        directorioImagenes: nuevaConfig.directorioImagenes,
        directorioHandle: nuevaConfig.directorioHandle,
        sincronizacionNube: nuevaConfig.sincronizacionNube,
        teclaCobro: nuevaConfig.teclaCobro,
        teclaEfectivo: nuevaConfig.teclaEfectivo,
        teclaTarjeta: nuevaConfig.teclaTarjeta,
        teclaTransferencia: nuevaConfig.teclaTransferencia,
        bancoTransferencia: nuevaConfig.bancoTransferencia,
        titularTransferencia: nuevaConfig.titularTransferencia,
        cuentaTransferencia: nuevaConfig.cuentaTransferencia,
        mensajePago: nuevaConfig.mensajePago,
        correoDueno: nuevaConfig.correoDueno,
      });
      set({ directorioImagenes: nombreCarpeta, directorioHandle: handle });
    } catch (error) {
      console.error("Error al guardar el directorio:", error);
    }
  },
  
  toggleSincronizacion: async () => {
    try {
      const nuevoEstado = !get().sincronizacionNube;
      const nuevaConfig = { ...get(), sincronizacionNube: nuevoEstado };
      await guardarRegistro("configuracion", {
        id: CONFIG_ID,
        nombreTienda: nuevaConfig.nombreTienda,
        mensajeTicket: nuevaConfig.mensajeTicket,
        directorioImagenes: nuevaConfig.directorioImagenes,
        directorioHandle: nuevaConfig.directorioHandle,
        sincronizacionNube: nuevaConfig.sincronizacionNube,
        teclaCobro: nuevaConfig.teclaCobro,
        teclaEfectivo: nuevaConfig.teclaEfectivo,
        teclaTarjeta: nuevaConfig.teclaTarjeta,
        teclaTransferencia: nuevaConfig.teclaTransferencia,
        bancoTransferencia: nuevaConfig.bancoTransferencia,
        titularTransferencia: nuevaConfig.titularTransferencia,
        cuentaTransferencia: nuevaConfig.cuentaTransferencia,
        mensajePago: nuevaConfig.mensajePago,
        correoDueno: nuevaConfig.correoDueno,
      });
      set({ sincronizacionNube: nuevoEstado });
    } catch (error) {
      console.error("Error al cambiar la sincronización:", error);
    }
  },

  setTeclaCobro: async (tecla) => {
    const teclaNormalizada = tecla.trim() || CONFIG_INICIAL.teclaCobro;
    try {
      const nuevaConfig = { ...get(), teclaCobro: teclaNormalizada };
      await guardarRegistro("configuracion", {
        id: CONFIG_ID,
        nombreTienda: nuevaConfig.nombreTienda,
        mensajeTicket: nuevaConfig.mensajeTicket,
        directorioImagenes: nuevaConfig.directorioImagenes,
        directorioHandle: nuevaConfig.directorioHandle,
        sincronizacionNube: nuevaConfig.sincronizacionNube,
        teclaCobro: teclaNormalizada,
        teclaEfectivo: nuevaConfig.teclaEfectivo,
        teclaTarjeta: nuevaConfig.teclaTarjeta,
        teclaTransferencia: nuevaConfig.teclaTransferencia,
        bancoTransferencia: nuevaConfig.bancoTransferencia,
        titularTransferencia: nuevaConfig.titularTransferencia,
        cuentaTransferencia: nuevaConfig.cuentaTransferencia,
        mensajePago: nuevaConfig.mensajePago,
        correoDueno: nuevaConfig.correoDueno,
      });
      set({ teclaCobro: teclaNormalizada });
    } catch (error) {
      console.error("Error al guardar la tecla de cobro:", error);
    }
  },

  actualizarDatosPago: async (datos) => {
    try {
      const nuevaConfig = { ...get(), ...datos };
      await guardarRegistro("configuracion", {
        id: CONFIG_ID,
        nombreTienda: nuevaConfig.nombreTienda,
        mensajeTicket: nuevaConfig.mensajeTicket,
        directorioImagenes: nuevaConfig.directorioImagenes,
        directorioHandle: nuevaConfig.directorioHandle,
        sincronizacionNube: nuevaConfig.sincronizacionNube,
        teclaCobro: nuevaConfig.teclaCobro,
        teclaEfectivo: nuevaConfig.teclaEfectivo,
        teclaTarjeta: nuevaConfig.teclaTarjeta,
        teclaTransferencia: nuevaConfig.teclaTransferencia,
        bancoTransferencia: nuevaConfig.bancoTransferencia,
        titularTransferencia: nuevaConfig.titularTransferencia,
        cuentaTransferencia: nuevaConfig.cuentaTransferencia,
        mensajePago: nuevaConfig.mensajePago,
        correoDueno: nuevaConfig.correoDueno,
      });
      set(datos);
    } catch (error) {
      console.error("Error al guardar datos de pago:", error);
    }
  },

  setCorreoDueno: async (correo) => {
    const correoLimpio = correo.trim().toLowerCase();
    const nuevaConfig = { ...get(), correoDueno: correoLimpio };
    await guardarRegistro("configuracion", {
      id: CONFIG_ID,
      nombreTienda: nuevaConfig.nombreTienda,
      mensajeTicket: nuevaConfig.mensajeTicket,
      directorioImagenes: nuevaConfig.directorioImagenes,
      directorioHandle: nuevaConfig.directorioHandle,
      sincronizacionNube: nuevaConfig.sincronizacionNube,
      teclaCobro: nuevaConfig.teclaCobro,
      teclaEfectivo: nuevaConfig.teclaEfectivo,
      teclaTarjeta: nuevaConfig.teclaTarjeta,
      teclaTransferencia: nuevaConfig.teclaTransferencia,
      bancoTransferencia: nuevaConfig.bancoTransferencia,
      titularTransferencia: nuevaConfig.titularTransferencia,
      cuentaTransferencia: nuevaConfig.cuentaTransferencia,
      mensajePago: nuevaConfig.mensajePago,
      correoDueno: correoLimpio,
    });
    set({ correoDueno: correoLimpio });
  },
}));