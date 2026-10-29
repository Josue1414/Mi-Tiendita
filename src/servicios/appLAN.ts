// src/servicios/appLAN.ts
import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { useEstadoCaja } from "../estado/estadoCaja";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { useEstadoFiados } from "../estado/estadoFiados";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoRed } from "../estado/estadoRed";
import { enviarAccionLAN } from "./sincronizacionLAN";
import { obtenerImagenLocalBruta, guardarImagenLocal, blobABase64, base64ABlob } from "./baseDatosLocal";

export const crearSnapshotLAN = () => {
  const caja = useEstadoCaja.getState();
  const configuracion = useEstadoConfiguracion.getState();
  return {
    productos: useEstadoInventario.getState().productos,
    categorias: useEstadoInventario.getState().categorias,
    ventas: useEstadoVentas.getState().ventas,
    trabajadores: useEstadoTrabajadores.getState().trabajadores,
    asistencias: useEstadoAsistencias.getState().asistencias,
    fiados: useEstadoFiados.getState().deudores,
    caja: {
      turnos: caja.turnos,
      fondoBaseActual: caja.fondoBaseActual,
      notaGeneralDueno: caja.notaGeneralDueno,
      controlTurnosHabilitado: caja.controlTurnosHabilitado,
      forzarRecepcionCaja: caja.forzarRecepcionCaja,
      requerirPinCancelacion: caja.requerirPinCancelacion
    },
    configuracion: {
      nombreTienda: configuracion.nombreTienda,
      mensajeTicket: configuracion.mensajeTicket,
      direccionTienda: configuracion.direccionTienda,
      logoTienda: configuracion.logoTienda,
      sincronizacionNube: configuracion.sincronizacionNube,
      teclaCobro: configuracion.teclaCobro,
      mensajePago: configuracion.mensajePago,
      diasAlertaCaducidad: configuracion.diasAlertaCaducidad,
      bancoTransferencia: configuracion.bancoTransferencia,
      titularTransferencia: configuracion.titularTransferencia,
      cuentaTransferencia: configuracion.cuentaTransferencia,
      teclaEfectivo: configuracion.teclaEfectivo,
      teclaTarjeta: configuracion.teclaTarjeta,
      teclaTransferencia: configuracion.teclaTransferencia
    }
  };
};

export const aplicarAccionLANRecibida = async (accion: unknown) => {
  if (typeof accion !== "object" || accion === null || !("tipo" in accion) || typeof accion.tipo !== "string") return;
  const payload = "payload" in accion ? (accion as any).payload : undefined;
  const { esMaestro } = useEstadoRed.getState();

  // 1. Cambio de Cerebro en tiempo real
  if (accion.tipo === "LAN_NUEVO_CEREBRO") {
    const tiendaId = localStorage.getItem("tienda_id");
    // Si yo era el maestro y alguien más dice serlo, me rindo y reinicio
    if (esMaestro && tiendaId) {
      console.log("Otro dispositivo reclamó ser el Cerebro. Cediendo el control...");
      localStorage.setItem(`mi_tienda_es_cerebro:${tiendaId}`, "false");
      useEstadoRed.getState().setEsMaestro(false);
      window.location.reload(); 
    }
    return;
  }

  // 2. EL CEREBRO RECIBE SOLICITUD DE IMAGEN Y LA ENVÍA
  if (accion.tipo === "LAN_SOLICITAR_IMAGEN") {
    if (esMaestro && typeof payload === "string") {
      const blob = await obtenerImagenLocalBruta(payload);
      if (blob) {
        const base64 = await blobABase64(blob);
        enviarAccionLAN({ tipo: "LAN_ENVIAR_IMAGEN", payload: { archivo: payload, base64 } });
      }
    }
    return;
  }

  // 3. EL ESCLAVO RECIBE LA IMAGEN Y LA GUARDA
  if (accion.tipo === "LAN_ENVIAR_IMAGEN") {
    if (!esMaestro && payload?.archivo && payload?.base64) {
      const blob = await base64ABlob(payload.base64);
      await guardarImagenLocal(payload.archivo, blob);
      window.dispatchEvent(new CustomEvent("imagen-descargada", { detail: payload.archivo }));
    }
    return;
  }

  // 4. NUEVO: EL CEREBRO RECIBE VENTAS PENDIENTES DE UN ESCLAVO RECONECTADO
  if (accion.tipo === "LAN_SYNC_VENTAS_ESCLAVO") {
    if (esMaestro && Array.isArray(payload)) {
      console.log("Recibiendo sincronización de ventas retrasadas de un esclavo...");
      const { ventas, agregarVenta } = useEstadoVentas.getState();
      const idsConocidos = new Set(ventas.map(v => v.id));
      
      for (const ventaEsclavo of payload) {
        if (!idsConocidos.has(ventaEsclavo.id)) {
          // Guardamos la venta en el Cerebro de forma silenciosa para la red
          await agregarVenta(ventaEsclavo, true);
        }
      }
    }
    return;
  }

  // 5. RESTO DE SINCRONIZACIONES
  if (accion.tipo === "LAN_VENTA_AGREGAR" || accion.tipo === "LAN_VENTA_CANCELAR") {
    void useEstadoVentas.getState().aplicarAccionLAN(accion.tipo, payload);
  } else if (accion.tipo.startsWith("LAN_FIADO_")) {
    void useEstadoFiados.getState().aplicarAccionLAN(accion.tipo, payload);
  } else if (accion.tipo.startsWith("LAN_CAJA_")) {
    void useEstadoCaja.getState().aplicarAccionLAN(accion.tipo, payload);
  } else if (accion.tipo.startsWith("LAN_TRABAJADOR_")) {
    void useEstadoTrabajadores.getState().aplicarAccionLAN(accion.tipo, payload);
  } else if (accion.tipo === "LAN_ASISTENCIA_UPSERT") {
    void useEstadoAsistencias.getState().aplicarAccionLAN(accion.tipo, payload);
  } else if (accion.tipo.startsWith("LAN_CONFIG_")) {
    void useEstadoConfiguracion.getState().aplicarAccionLAN(accion.tipo, payload).catch((error: unknown) => {
      console.error("No se pudo aplicar la configuración recibida por LAN:", error);
    });
  } else {
    useEstadoInventario.getState().aplicarSincronizacionRemota(accion);
  }
};

export const hidratarDesdeLAN = async (snapshot: ReturnType<typeof crearSnapshotLAN>) => {
  await Promise.all([
    useEstadoInventario.getState().hidratarEstadoLAN(snapshot),
    useEstadoVentas.getState().hidratarEstadoLAN(snapshot),
    useEstadoTrabajadores.getState().hidratarEstadoLAN(snapshot),
    useEstadoAsistencias.getState().hidratarEstadoLAN(snapshot),
    useEstadoCaja.getState().hidratarEstadoLAN(snapshot),
    useEstadoConfiguracion.getState().hidratarEstadoLAN(snapshot),
    useEstadoFiados.getState().hidratarEstadoLAN(snapshot)
  ]);
};