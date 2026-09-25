// src/hooks/usePantallaClienteLAN.ts
import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useEstadoRed } from "../estado/estadoRed";
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

const CANAL = "pantalla_cliente_mi_tienda";

export function useEmisorPantallaCliente(nombreCajaLocal: string = "Caja Principal") {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Conectar al servidor LAN local de manera silenciosa
    const ipMaestro = useEstadoRed.getState().ipMaestro || "localhost";
    socketRef.current = io(`http://${ipMaestro}:4000`);
    return () => { socketRef.current?.disconnect(); };
  }, []);

  const enviarMensaje = useCallback((mensaje: MensajePantalla) => {
    // 1. Emisión Local (Para ventanas abiertas en la misma PC)
    const bc = new BroadcastChannel(CANAL);
    bc.postMessage({ cajaId: nombreCajaLocal, payload: mensaje });
    bc.close();

    // 2. Emisión LAN (Para la tableta externa)
    if (socketRef.current?.connected) {
      socketRef.current.emit("sync-pantalla-cliente", { cajaId: nombreCajaLocal, payload: mensaje });
    }
  }, [nombreCajaLocal]);
  
  return { enviarMensaje };
}

export function useReceptorPantallaCliente() {
  const [datosCarrito, setDatosCarrito] = useState<{items: ItemCarrito[], total: number, descuento: number; metodoPago: string; datosTransferencia?: DatosTransferencia}>({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
  const [mensajeExito, setMensajeExito] = useState<{total: number, cambio?: number; metodoPago: string; mensajePago: string; datosTransferencia?: DatosTransferencia} | null>(null);
  const [productoEnPantalla, setProductoEnPantalla] = useState<Producto | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cajaObjetivo = params.get("cliente"); // Obtiene el nombre de la caja desde la URL

    const procesarMensaje = (cajaId: string, msj: MensajePantalla) => {
      // Filtrado único: Si la URL tiene un nombre específico y no coincide con el emisor, ignorar.
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
      else procesarMensaje("Local", data); // Retrocompatibilidad
    };

    // 2. Escuchar LAN (Tableta externa)
    const ipMaestro = useEstadoRed.getState().ipMaestro || window.location.hostname;
    const socket = io(`http://${ipMaestro}:4000`);

    socket.on("update-pantalla-cliente", (data) => {
      if (data && data.payload && data.cajaId) {
        procesarMensaje(data.cajaId, data.payload);
      }
    });

    return () => {
      bc.close();
      socket.disconnect();
    };
  }, []);

  return { datosCarrito, mensajeExito, productoEnPantalla };
}