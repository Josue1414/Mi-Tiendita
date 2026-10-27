// src/hooks/usePantallaClienteLAN.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Peer, { type DataConnection } from "peerjs";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useEstadoRed } from "../estado/estadoRed";
import type { ItemCarrito } from "../estado/estadoCarrito";
import type { Producto } from "../tipos/producto";
import { androidLan } from "../servicios/androidLan";

export type MensajePantalla = 
  | { tipo: "ACTUALIZAR_CARRITO"; items: ItemCarrito[]; total: number; descuento: number }
  | { tipo: "ACTUALIZAR_PAGO"; metodoPago: string; datosTransferencia?: DatosTransferencia }
  | { tipo: "COBRO_EXITOSO"; total: number; cambio?: number; metodoPago: string; mensajePago: string; datosTransferencia?: DatosTransferencia }
  | { tipo: "MOSTRAR_PRODUCTO_CLIENTE"; producto: Producto }
  | { tipo: "QUITAR_PRODUCTO_CLIENTE" }
  | { tipo: "LIMPIAR" };

export interface DatosTransferencia {
  banco: string;
  titular: string;
  cuenta: string;
}

const CANAL = "pantalla_cliente_mi_tienda";

const crearIdPeer = (nombreCaja: string) => {
  const tiendaId = localStorage.getItem("tienda_id_cache") || "tienda-demo";
  return `pos-${tiendaId}-${nombreCaja}`.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
};

export function useEmisorPantallaCliente(
  nombreCajaLocal: string = localStorage.getItem("nombre_dispositivo_local") || "Caja Principal",
) {
  const esAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const esMaestro = useEstadoRed((estado) => estado.esMaestro);
  const ipMaestro = useEstadoRed((estado) => estado.ipMaestro);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const conexionesPeerRef = useRef<DataConnection[]>([]);
  const mensajePendienteRef = useRef<MensajePantalla | null>(null);
  const mensajePendienteSocketRef = useRef<MensajePantalla | null>(null);
  const [clientesConectados, setClientesConectados] = useState(0);

  useEffect(() => {
    let socket: Socket | null = null;
    let listenerClienteAndroid: PluginListenerHandle | null = null;
    let cancelado = false;

    // 1. INICIALIZAR PEERJS (P2P QR) SIEMPRE, EN TODAS LAS PLATAFORMAS (Corrige tu error de conexión)
    const peer = new Peer(crearIdPeer(nombreCajaLocal));
    peerRef.current = peer;
    peer.on("error", (error) => {
      console.error("Error en la conexión P2P de pantalla cliente:", error);
    });
    peer.on("connection", (conexion) => {
      conexionesPeerRef.current.push(conexion);
      conexion.on("open", () => {
        setClientesConectados((actual) => actual + 1);
        const mensajePendiente = mensajePendienteRef.current;
        if (mensajePendiente) {
          conexion.send(mensajePendiente);
          mensajePendienteRef.current = null;
        }
      });
      conexion.on("close", () => {
        conexionesPeerRef.current = conexionesPeerRef.current.filter((actual) => actual !== conexion);
        setClientesConectados((actual) => Math.max(0, actual - 1));
      });
    });

    // 2. LISTENER DE LAN EXCLUSIVO PARA ANDROID
    if (esAndroid) {
      androidLan.addListener("customerDisplayConnected", (data) => {
        if (data.cajaId === nombreCajaLocal) setClientesConectados((actual) => actual + 1);
      }).then((listener) => {
        if (cancelado) void listener.remove();
        else listenerClienteAndroid = listener;
      }).catch((error: unknown) => {
        console.error("No se pudo escuchar las conexiones LAN de pantalla cliente:", error);
      });
    }

    // 3. CONEXIÓN SOCKET.IO (LAN LOCAL)
    const hostMaestro = esMaestro ? "localhost" : ipMaestro || "localhost";
    socket = io(`http://${hostMaestro}:4000`, {
      reconnection: true,
      reconnectionAttempts: 5, // <-- Soluciona el "spam" de errores rojos en consola web
      reconnectionDelay: 2000,
      timeout: 10000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      const mensajePendiente = mensajePendienteSocketRef.current;
      if (mensajePendiente) {
        socket?.emit("sync-pantalla-cliente", { cajaId: nombreCajaLocal, payload: mensajePendiente });
        mensajePendienteSocketRef.current = null;
      }
    });

    return () => {
      cancelado = true;
      socket?.disconnect();
      socketRef.current = null;
      if (listenerClienteAndroid) void listenerClienteAndroid.remove();
      conexionesPeerRef.current = [];
      peerRef.current?.destroy();
      peerRef.current = null;
    };
  }, [esAndroid, esMaestro, ipMaestro, nombreCajaLocal]);

  const enviarMensaje = useCallback((mensaje: MensajePantalla) => {
    // 1. Misma PC (Electron/Ventanas locales)
    const bc = new BroadcastChannel(CANAL);
    bc.postMessage({ cajaId: nombreCajaLocal, payload: mensaje });
    bc.close();

    // 2. P2P QR (Internet) - AHORA SE ENVÍA SIEMPRE Y NO SOLO EN ANDROID
    const conexionesAbiertas = conexionesPeerRef.current.filter((conexion) => conexion.open);
    conexionesAbiertas.forEach((conexion) => conexion.send(mensaje));
    mensajePendienteRef.current = conexionesAbiertas.length > 0 ? null : mensaje;

    // 3. LAN (Socket.io)
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("sync-pantalla-cliente", { cajaId: nombreCajaLocal, payload: mensaje });
      mensajePendienteSocketRef.current = null;
    } else {
      mensajePendienteSocketRef.current = mensaje;
    }
  }, [nombreCajaLocal]);
  
  return { enviarMensaje, clientesConectados };
}

export function useReceptorPantallaCliente() {
  const [datosCarrito, setDatosCarrito] = useState<{items: ItemCarrito[], total: number, descuento: number; metodoPago: string; datosTransferencia?: DatosTransferencia}>({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
  const [mensajeExito, setMensajeExito] = useState<{total: number, cambio?: number; metodoPago: string; mensajePago: string; datosTransferencia?: DatosTransferencia} | null>(null);
  const [productoEnPantalla, setProductoEnPantalla] = useState<Producto | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cajaObjetivo = params.get("cliente"); 

    const procesarMensaje = (cajaId: string, msj: MensajePantalla) => {
      if (cajaObjetivo && cajaObjetivo !== "true" && cajaObjetivo !== cajaId) return;
      
      if (msj.tipo === "ACTUALIZAR_CARRITO") {
        setDatosCarrito((actual) => ({ ...actual, items: msj.items, total: msj.total, descuento: msj.descuento }));
        if (msj.items.length > 0) setMensajeExito(null);
      } else if (msj.tipo === "ACTUALIZAR_PAGO") {
        setDatosCarrito((actual) => ({ ...actual, metodoPago: msj.metodoPago, datosTransferencia: msj.datosTransferencia }));
      } else if (msj.tipo === "MOSTRAR_PRODUCTO_CLIENTE") {
        setProductoEnPantalla(msj.producto);
      } else if (msj.tipo === "QUITAR_PRODUCTO_CLIENTE") {
        setProductoEnPantalla(null);
      } else if (msj.tipo === "COBRO_EXITOSO") {
        setMensajeExito({ total: msj.total, cambio: msj.cambio, metodoPago: msj.metodoPago || "EFECTIVO", mensajePago: msj.mensajePago || "Pago realizado. Gracias.", datosTransferencia: msj.datosTransferencia });
        setProductoEnPantalla(null);
        setTimeout(() => {
          setMensajeExito(null);
          setDatosCarrito({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
        }, 3000);
      } else if (msj.tipo === "LIMPIAR") {
        setDatosCarrito({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
        setProductoEnPantalla(null);
        setMensajeExito(null);
      }
    };

    // 1. Escuchar Local (misma PC)
    const bc = new BroadcastChannel(CANAL);
    bc.onmessage = (event) => {
      const data = event.data;
      if (data.payload) procesarMensaje(data.cajaId, data.payload);
      else procesarMensaje("Local", data); 
    };

    const peerObjetivo = params.get("peer");
    const hostRelay = params.get("lanHost");
    const usaConexionLAN = Boolean(hostRelay)
      || params.has("lanPort")
      || window.location.port === "4000"
      || window.location.port === "4001";
      
    let peerCliente: Peer | null = null;
    if (peerObjetivo && !usaConexionLAN) {
      peerCliente = new Peer();
      peerCliente.on("error", (error) => {
        console.error("Error al conectar la pantalla cliente con el POS:", error);
      });
      peerCliente.on("open", () => {
        const conexion = peerCliente?.connect(peerObjetivo);
        conexion?.on("data", (mensaje) => procesarMensaje(cajaObjetivo || "", mensaje as MensajePantalla));
        conexion?.on("error", (error) => {
          console.error("Error en el canal P2P de pantalla cliente:", error);
        });
      });
    }

    // 2. Escuchar LAN (Tableta externa)
    let socket: Socket | null = null;
    if (!peerObjetivo || usaConexionLAN) {
      const host = hostRelay
        || useEstadoRed.getState().ipMaestro
        || window.location.hostname
        || "localhost";
      socket = io(`http://${host}:4000`, {
        reconnection: true,
        reconnectionAttempts: 5, // <-- Evita el spam infinito en consola
        reconnectionDelay: 2000,
        timeout: 10000,
      });

      socket.on("connect", () => {
        if (cajaObjetivo) socket?.emit("registrar-pantalla-cliente", { cajaId: cajaObjetivo });
      });
      socket.on("update-pantalla-cliente", (data) => {
        if (data && data.payload && data.cajaId) procesarMensaje(data.cajaId, data.payload);
      });
    }

    return () => {
      bc.close();
      socket?.removeAllListeners();
      socket?.disconnect();
      peerCliente?.destroy();
    };
  }, []);

  return { datosCarrito, mensajeExito, productoEnPantalla };
}