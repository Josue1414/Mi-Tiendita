import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { useEstadoCaja } from "../estado/estadoCaja";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { useEstadoFiados } from "../estado/estadoFiados";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoVentas } from "../estado/estadoVentas";

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

export const aplicarAccionLANRecibida = (accion: unknown) => {
  if (typeof accion !== "object" || accion === null || !("tipo" in accion) || typeof accion.tipo !== "string") return;
  const payload = "payload" in accion ? accion.payload : undefined;
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
  await useEstadoInventario.getState().hidratarEstadoLAN(snapshot);
  await useEstadoVentas.getState().hidratarEstadoLAN(snapshot);
  await useEstadoTrabajadores.getState().hidratarEstadoLAN(snapshot);
  await useEstadoAsistencias.getState().hidratarEstadoLAN(snapshot);
  await useEstadoCaja.getState().hidratarEstadoLAN(snapshot);
  await useEstadoConfiguracion.getState().hidratarEstadoLAN(snapshot);
  await useEstadoFiados.getState().hidratarEstadoLAN(snapshot);
};
