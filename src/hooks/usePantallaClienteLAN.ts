// src/hooks/usePantallaClienteLAN.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Peer, { type DataConnection } from "peerjs";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useEstadoRed } from "../estado/estadoRed";
import type { ItemCarrito } from "../estado/estadoCarrito";
import type { Producto } from "../tipos/producto";
import { androidLan } from "../servicios/androidLan";
import { crearIdentificadorUnico } from "../utilidades/identificador";
import { base64ABlob, blobABase64, guardarImagenLocal, obtenerImagenLocalBruta } from "../servicios/baseDatosLocal";

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
  qrBase64?: string;
}

const CANAL = "pantalla_cliente_mi_tienda";
const EVENTO_SOLICITAR_IMAGEN_P2P = "solicitar-imagen-p2p";
const EVENTO_SOLICITAR_IMAGEN_LAN = "solicitar-imagen-lan-pantalla";

type EstadoPantallaPersistente = {
  carrito: Extract<MensajePantalla, { tipo: "ACTUALIZAR_CARRITO" }> | null;
  pago: Extract<MensajePantalla, { tipo: "ACTUALIZAR_PAGO" }> | null;
  producto: Extract<MensajePantalla, { tipo: "MOSTRAR_PRODUCTO_CLIENTE" }> | null;
};

type SolicitudImagenP2P = { tipo: "SOLICITAR_IMAGEN"; archivo: string };
type RespuestaImagenP2P = { tipo: "IMAGEN"; archivo: string; base64: string };

async function convertirImagenParaPantalla(blob: Blob): Promise<string> {
  if (typeof createImageBitmap !== "function") return blobABase64(blob);

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const escala = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("No se pudo preparar el lienzo para la imagen.");
    contexto.fillStyle = "#fff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const imagenOptimizada = canvas.toDataURL("image/jpeg", 0.8);
    if (imagenOptimizada.length > "data:,".length) return imagenOptimizada;
  } catch (error) {
    console.warn("No se pudo optimizar la imagen para la pantalla cliente; se enviará en su formato original:", error);
  } finally {
    bitmap?.close();
  }
  return blobABase64(blob);
}

type ImagenConDatos = {
  imagen_url?: string;
  imagen_archivo?: string;
};

async function agregarImagenAlMensaje<T extends ImagenConDatos>(
  entidad: T,
  obtenerImagen: (archivo: string) => Promise<string | null>,
): Promise<T> {
  if (entidad.imagen_url?.startsWith("data:image/")) return entidad;
  if (entidad.imagen_url?.startsWith("http://") || entidad.imagen_url?.startsWith("https://")) return entidad;

  let urlLimpia = entidad.imagen_url;
  // No enviar blob URLs locales por red, ya que no sirven en otros dispositivos
  if (urlLimpia?.startsWith("blob:")) {
    urlLimpia = undefined;
  }

  for (const archivo of [entidad.imagen_archivo, urlLimpia]) {
    if (!archivo) continue;
    const imagen = await obtenerImagen(archivo);
    if (imagen) return { ...entidad, imagen_url: imagen };
  }
  return { ...entidad, imagen_url: urlLimpia };
}

async function agregarImagenesAlMensaje(
  mensaje: MensajePantalla,
  obtenerImagen: (archivo: string) => Promise<string | null>,
): Promise<MensajePantalla> {
  if (mensaje.tipo === "ACTUALIZAR_CARRITO") {
    return {
      ...mensaje,
      items: await Promise.all(mensaje.items.map((item) => agregarImagenAlMensaje(item, obtenerImagen))),
    };
  }
  if (mensaje.tipo === "MOSTRAR_PRODUCTO_CLIENTE") {
    return {
      ...mensaje,
      producto: await agregarImagenAlMensaje(mensaje.producto, obtenerImagen),
    };
  }
  return mensaje;
}

function esSolicitudImagenP2P(mensaje: unknown): mensaje is SolicitudImagenP2P {
  return typeof mensaje === "object" && mensaje !== null
    && "tipo" in mensaje && mensaje.tipo === "SOLICITAR_IMAGEN"
    && "archivo" in mensaje && typeof mensaje.archivo === "string";
}

function esRespuestaImagenP2P(mensaje: unknown): mensaje is RespuestaImagenP2P {
  return typeof mensaje === "object" && mensaje !== null
    && "tipo" in mensaje && mensaje.tipo === "IMAGEN"
    && "archivo" in mensaje && typeof mensaje.archivo === "string"
    && "base64" in mensaje && typeof mensaje.base64 === "string";
}

export const crearIdPeer = (nombreCaja: string) => {
  const tiendaId = localStorage.getItem("tienda_id_cache")
    || localStorage.getItem("tienda_id")
    || "tienda-demo";
  const clavePeer = `peer_id_pantalla_cliente:${tiendaId}`;
  let idDispositivo = localStorage.getItem(clavePeer);
  if (!idDispositivo) {
    idDispositivo = crearIdentificadorUnico().replace(/-/g, "");
    localStorage.setItem(clavePeer, idDispositivo);
  }
  return `pos-${tiendaId}-${idDispositivo}-${nombreCaja}`
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 120);
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
  const estadoPersistenteRef = useRef<EstadoPantallaPersistente>({
    carrito: null,
    pago: null,
    producto: null,
  });
  const imagenesEnCacheRef = useRef(new Map<string, Promise<string | null>>());
  const revisionCarritoRef = useRef(0);
  const revisionProductoRef = useRef(0);
  const mensajePendienteSocketRef = useRef<MensajePantalla | null>(null);
  const [clientesConectados, setClientesConectados] = useState(0);

  useEffect(() => {
    let socket: Socket | null = null;
    let listenerClienteAndroid: PluginListenerHandle | null = null;
    let cancelado = false;

    // 1. INICIALIZAR PEERJS (P2P QR)
    const peer = new Peer(crearIdPeer(nombreCajaLocal));
    peerRef.current = peer;
    peer.on("error", (error) => {
      console.error("Error en la conexión P2P de pantalla cliente:", error);
    });
    peer.on("connection", (conexion) => {
      conexionesPeerRef.current.push(conexion);
      conexion.on("open", () => {
        setClientesConectados((actual) => actual + 1);
        const { carrito, pago, producto } = estadoPersistenteRef.current;
        [carrito, pago, producto].forEach((mensaje) => {
          if (mensaje) conexion.send(mensaje);
        });
      });
      conexion.on("data", (mensaje) => {
        if (!esSolicitudImagenP2P(mensaje)) return;
        void (async () => {
          try {
            const blob = await obtenerImagenLocalBruta(mensaje.archivo);
            if (!blob || !conexion.open) return;
            const base64 = await blobABase64(blob);
            conexion.send({ tipo: "IMAGEN", archivo: mensaje.archivo, base64 } satisfies RespuestaImagenP2P);
          } catch (error) {
            console.error("No se pudo enviar la imagen a la pantalla cliente P2P:", error);
          }
        })();
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

    // 3. CONEXIÓN SOCKET.IO (LAN LOCAL FORZANDO WEBSOCKETS)
    const sirvePaginaDesdeLAN = window.location.protocol === "http:"
      && [4000, 4001].includes(Number(window.location.port));
    const hostMaestro = esMaestro
      ? "localhost"
      : ipMaestro || (sirvePaginaDesdeLAN ? window.location.hostname : "localhost");
    
    socket = io(`http://${hostMaestro}:4000`, {
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
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
    const transmitirMensaje = (mensajeListo: MensajePantalla) => {
      // 1. Misma PC (Electron/Ventanas locales)
      const bc = new BroadcastChannel(CANAL);
      bc.postMessage({ cajaId: nombreCajaLocal, payload: mensajeListo });
      bc.close();

      // 2. P2P QR (Internet)
      const conexionesAbiertas = conexionesPeerRef.current.filter((conexion) => conexion.open);
      conexionesAbiertas.forEach((conexion) => conexion.send(mensajeListo));

      // 3. LAN (Socket.io)
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit("sync-pantalla-cliente", { cajaId: nombreCajaLocal, payload: mensajeListo });
        mensajePendienteSocketRef.current = null;
      } else {
        mensajePendienteSocketRef.current = mensajeListo;
      }
    };

    const revision = mensaje.tipo === "ACTUALIZAR_CARRITO"
      ? ++revisionCarritoRef.current
      : mensaje.tipo === "MOSTRAR_PRODUCTO_CLIENTE" || mensaje.tipo === "QUITAR_PRODUCTO_CLIENTE"
        ? ++revisionProductoRef.current
        : null;

    if (mensaje.tipo === "QUITAR_PRODUCTO_CLIENTE") {
      estadoPersistenteRef.current.producto = null;
      transmitirMensaje(mensaje);
      return;
    }

    if (mensaje.tipo !== "ACTUALIZAR_CARRITO" && mensaje.tipo !== "MOSTRAR_PRODUCTO_CLIENTE") {
      transmitirMensaje(mensaje);
    } else {
      const mensajeOriginal = mensaje;
      const obtenerImagen = (archivo: string) => {
        const cache = imagenesEnCacheRef.current;
        const enCache = cache.get(archivo);
        if (enCache) return enCache;

        const solicitud = obtenerImagenLocalBruta(archivo)
          .then((blob) => blob ? convertirImagenParaPantalla(blob) : null)
          .then((imagen) => {
            if (!imagen) cache.delete(archivo);
            return imagen;
          })
          .catch((error: unknown) => {
            cache.delete(archivo);
            console.error(`No se pudo preparar la imagen "${archivo}" para la pantalla cliente:`, error);
            return null;
          });
        cache.set(archivo, solicitud);
        if (cache.size > 50) {
          const archivoMasAntiguo = cache.keys().next().value;
          if (archivoMasAntiguo) cache.delete(archivoMasAntiguo);
        }
        return solicitud;
      };

      void agregarImagenesAlMensaje(mensajeOriginal, obtenerImagen)
        .then((mensajeListo) => {
          if (
            (mensajeOriginal.tipo === "ACTUALIZAR_CARRITO" && revision !== revisionCarritoRef.current)
            || (mensajeOriginal.tipo === "MOSTRAR_PRODUCTO_CLIENTE" && revision !== revisionProductoRef.current)
          ) return;

          if (mensajeListo.tipo === "ACTUALIZAR_CARRITO") {
            estadoPersistenteRef.current.carrito = mensajeListo;
          } else if (mensajeListo.tipo === "MOSTRAR_PRODUCTO_CLIENTE") {
            estadoPersistenteRef.current.producto = mensajeListo;
          }
          transmitirMensaje(mensajeListo);
        })
        .catch((error: unknown) => {
          console.error("No se pudo preparar la imagen para la pantalla cliente:", error);
        });
      return;
    }

    // Keep the latest state for a display that connects after the message was sent.
    const estadoPersistente = estadoPersistenteRef.current;
    if (mensaje.tipo === "ACTUALIZAR_PAGO") estadoPersistente.pago = mensaje;
    if (mensaje.tipo === "COBRO_EXITOSO" || mensaje.tipo === "LIMPIAR") {
      estadoPersistente.pago = null;
      estadoPersistente.producto = null;
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
    let cancelado = false;

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
    let conexionPeerCliente: DataConnection | null = null;
    let temporizadorReconexion: number | null = null;
    let reconectarAlVolver: (() => void) | null = null;
    let demoraReconexion = 1000;
    const imagenesPendientes = new Set<string>();

    const solicitarImagen = (archivo: string) => {
      if (imagenesPendientes.has(archivo)) return;
      imagenesPendientes.add(archivo);
      if (conexionPeerCliente?.open) {
        conexionPeerCliente.send({ tipo: "SOLICITAR_IMAGEN", archivo } satisfies SolicitudImagenP2P);
      }
    };

    const manejarSolicitudImagen = (evento: Event) => {
      const archivo = (evento as CustomEvent<string>).detail;
      if (typeof archivo === "string" && archivo) solicitarImagen(archivo);
    };
    window.addEventListener(EVENTO_SOLICITAR_IMAGEN_P2P, manejarSolicitudImagen);

    let socket: Socket | null = null;
    const imagenesLANPendientes = new Set<string>();
    const solicitarImagenLAN = (archivo: string) => {
      if (imagenesLANPendientes.has(archivo)) return;
      imagenesLANPendientes.add(archivo);
      if (socket?.connected) {
        socket.emit("accion-esclavo", { tipo: "LAN_SOLICITAR_IMAGEN", payload: archivo });
      }
    };
    const manejarSolicitudImagenLAN = (evento: Event) => {
      const archivo = (evento as CustomEvent<string>).detail;
      if (typeof archivo === "string" && archivo) solicitarImagenLAN(archivo);
    };
    window.addEventListener(EVENTO_SOLICITAR_IMAGEN_LAN, manejarSolicitudImagenLAN);

    if (peerObjetivo && !usaConexionLAN) {
      const peerIdObjetivo = peerObjetivo;
      peerCliente = new Peer();
      peerCliente.on("error", (error) => {
        console.error("Error al conectar la pantalla cliente con el POS:", error);
        if (!cancelado && !temporizadorReconexion) {
          temporizadorReconexion = window.setTimeout(() => {
            temporizadorReconexion = null;
            conectarPeer();
          }, demoraReconexion);
          demoraReconexion = Math.min(demoraReconexion * 2, 10000);
        }
      });
      peerCliente.on("open", conectarPeer);
      peerCliente.on("disconnected", () => {
        peerCliente?.reconnect();
      });

      function conectarPeer() {
        if (cancelado || !peerCliente?.open || conexionPeerCliente) return;
        const conexion = peerCliente.connect(peerIdObjetivo);
        conexionPeerCliente = conexion;
        conexion.on("open", () => {
          demoraReconexion = 1000;
          imagenesPendientes.forEach((archivo) => {
            conexion.send({ tipo: "SOLICITAR_IMAGEN", archivo } satisfies SolicitudImagenP2P);
          });
        });
        conexion.on("data", (mensaje) => {
          if (esRespuestaImagenP2P(mensaje)) {
            imagenesPendientes.delete(mensaje.archivo);
            void (async () => {
              try {
                await guardarImagenLocal(mensaje.archivo, await base64ABlob(mensaje.base64));
                window.dispatchEvent(new CustomEvent("imagen-descargada", { detail: mensaje.archivo }));
              } catch (error) {
                console.error("No se pudo guardar la imagen recibida por P2P:", error);
              }
            })();
            return;
          }
          procesarMensaje(cajaObjetivo || "", mensaje as MensajePantalla);
        });
        conexion.on("close", () => {
          if (conexionPeerCliente === conexion) conexionPeerCliente = null;
          programarReconexion();
        });
        conexion.on("error", (error) => {
          console.error("Error en el canal P2P de pantalla cliente:", error);
          if (conexionPeerCliente === conexion) conexionPeerCliente = null;
          programarReconexion();
        });
      }

      function programarReconexion() {
        if (cancelado || temporizadorReconexion) return;
        temporizadorReconexion = window.setTimeout(() => {
          temporizadorReconexion = null;
          conectarPeer();
        }, demoraReconexion);
        demoraReconexion = Math.min(demoraReconexion * 2, 10000);
      }

      reconectarAlVolver = () => {
        if (!peerCliente?.open) peerCliente?.reconnect();
        else conectarPeer();
      };
      window.addEventListener("online", reconectarAlVolver);
      window.addEventListener("focus", reconectarAlVolver);
      window.addEventListener("pageshow", reconectarAlVolver);
    }

    // 2. Escuchar LAN (Tableta externa forzando WebSockets)
    if (!peerObjetivo || usaConexionLAN) {
      const host = hostRelay
        || useEstadoRed.getState().ipMaestro
        || window.location.hostname
        || "localhost";
        
      socket = io(`http://${host}:4000`, {
        transports: ["websocket"],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 5000,
      });

      socket.on("connect", () => {
        if (cajaObjetivo) socket?.emit("registrar-pantalla-cliente", { cajaId: cajaObjetivo });
        imagenesLANPendientes.forEach((archivo) => {
          socket?.emit("accion-esclavo", { tipo: "LAN_SOLICITAR_IMAGEN", payload: archivo });
        });
      });
      socket.on("update-pantalla-cliente", (data) => {
        if (data && data.payload && data.cajaId) procesarMensaje(data.cajaId, data.payload);
      });
      socket.on("accion-maestro", (data: unknown) => {
        if (
          typeof data !== "object" || data === null
          || !("tipo" in data) || data.tipo !== "LAN_ENVIAR_IMAGEN"
          || !("payload" in data) || typeof data.payload !== "object" || data.payload === null
          || !("archivo" in data.payload) || typeof data.payload.archivo !== "string"
          || !("base64" in data.payload) || typeof data.payload.base64 !== "string"
        ) return;
        const { archivo, base64 } = data.payload;
        imagenesLANPendientes.delete(archivo);
        void (async () => {
          try {
            await guardarImagenLocal(archivo, await base64ABlob(base64));
            window.dispatchEvent(new CustomEvent("imagen-descargada", { detail: archivo }));
          } catch (error) {
            console.error("No se pudo guardar la imagen recibida por LAN:", error);
          }
        })();
      });
    }

    return () => {
      cancelado = true;
      bc.close();
      window.removeEventListener(EVENTO_SOLICITAR_IMAGEN_P2P, manejarSolicitudImagen);
      window.removeEventListener(EVENTO_SOLICITAR_IMAGEN_LAN, manejarSolicitudImagenLAN);
      if (reconectarAlVolver) {
        window.removeEventListener("online", reconectarAlVolver);
        window.removeEventListener("focus", reconectarAlVolver);
        window.removeEventListener("pageshow", reconectarAlVolver);
      }
      socket?.removeAllListeners();
      socket?.disconnect();
      if (temporizadorReconexion) window.clearTimeout(temporizadorReconexion);
      peerCliente?.destroy();
    };
  }, []);

  return { datosCarrito, mensajeExito, productoEnPantalla };
}