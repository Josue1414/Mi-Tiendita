// src/hooks/usePantallaCliente.ts
import { useEffect, useState, useCallback, useRef } from "react";
import Peer, { type DataConnection } from "peerjs";
import type { ItemCarrito } from "../estado/estadoCarrito";
import type { Producto } from "../tipos/producto";

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

const CANAL_LOCAL = "pantalla_cliente_mi_tienda";

// Creador de ID robusto y estandarizado
const crearIdPeer = (nombreCaja: string) => {
  const tiendaId = localStorage.getItem("tienda_id_cache") || "tienda-demo";
  return `pos-${tiendaId}-${nombreCaja}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

export function useEmisorPantallaCliente(nombreCajaLocal: string = "Caja Principal") {
  const conexionesRef = useRef<DataConnection[]>([]);
  const peerRef = useRef<Peer | null>(null);
  
  // NUEVO: Estado para saber si alguien se acaba de conectar
  const [clientesConectados, setClientesConectados] = useState(0);

  useEffect(() => {
    const idUnico = crearIdPeer(nombreCajaLocal);
    const peer = new Peer(idUnico);
    peerRef.current = peer;

    peer.on("connection", (conexion) => {
      console.log("Pantalla Cliente conectada (P2P).");
      conexionesRef.current.push(conexion);
      
      conexion.on("open", () => {
         // Disparamos la actualización al instante de abrir la conexión
         setClientesConectados(c => c + 1); 
      });
      
      conexion.on("close", () => {
        conexionesRef.current = conexionesRef.current.filter(c => c.peer !== conexion.peer);
        setClientesConectados(c => c - 1);
      });
    });

    return () => {
      peer.destroy();
    };
  }, [nombreCajaLocal]);

  const enviarMensaje = useCallback((mensaje: MensajePantalla) => {
    const bc = new BroadcastChannel(CANAL_LOCAL);
    bc.postMessage({ cajaId: nombreCajaLocal, payload: mensaje });
    bc.close();

    conexionesRef.current.forEach(conexion => {
      if (conexion.open) {
        conexion.send(mensaje);
      }
    });
  }, [nombreCajaLocal]);
  
  // Exponemos la cantidad de clientes
  return { enviarMensaje, clientesConectados };
}

export function useReceptorPantallaCliente() {
  const [datosCarrito, setDatosCarrito] = useState<{items: ItemCarrito[], total: number, descuento: number; metodoPago: string; datosTransferencia?: DatosTransferencia}>({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
  const [mensajeExito, setMensajeExito] = useState<{total: number, cambio?: number; metodoPago: string; mensajePago: string; datosTransferencia?: DatosTransferencia} | null>(null);
  const [productoEnPantalla, setProductoEnPantalla] = useState<Producto | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const peerObjetivo = params.get("peer"); 
    const cajaObjetivo = params.get("cliente");

    const procesarMensaje = (msj: MensajePantalla) => {
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

    const bc = new BroadcastChannel(CANAL_LOCAL);
    bc.onmessage = (event) => {
      const data = event.data;
      if (cajaObjetivo && cajaObjetivo !== data.cajaId && cajaObjetivo !== "true") return;
      if (data.payload) procesarMensaje(data.payload);
    };

    let peerInstance: Peer | null = null;
    if (peerObjetivo) {
      peerInstance = new Peer(); 
      
      peerInstance.on("open", () => {
        const conexion = peerInstance!.connect(peerObjetivo);
        conexion.on("data", (data) => {
          procesarMensaje(data as MensajePantalla);
        });
      });
    }

    return () => {
      bc.close();
      if (peerInstance) peerInstance.destroy();
    };
  }, []);

  return { datosCarrito, mensajeExito, productoEnPantalla };
}