// src/hooks/usePantallaCliente.ts
import { useEffect, useState, useCallback } from "react";
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

export function useEmisorPantallaCliente() {
  const enviarMensaje = useCallback((mensaje: MensajePantalla) => {
    const bc = new BroadcastChannel(CANAL);
    bc.postMessage(mensaje);
    bc.close();
  }, []);
  
  return { enviarMensaje };
}

export function useReceptorPantallaCliente() {
  const [datosCarrito, setDatosCarrito] = useState<{items: ItemCarrito[], total: number, descuento: number; metodoPago: string; datosTransferencia?: DatosTransferencia}>({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
  const [mensajeExito, setMensajeExito] = useState<{total: number, cambio?: number; metodoPago: string; mensajePago: string; datosTransferencia?: DatosTransferencia} | null>(null);
  const [productoEnPantalla, setProductoEnPantalla] = useState<Producto | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel(CANAL);
    
    bc.onmessage = (event) => {
      const msj = event.data as MensajePantalla;
      
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
        setMensajeExito({ total: msj.total, cambio: msj.cambio, metodoPago: msj.metodoPago || "EFECTIVO", mensajePago: msj.mensajePago || "Pago realizado. Gracias por su compra, vuelva pronto.", datosTransferencia: msj.datosTransferencia });
        setProductoEnPantalla(null);
        // Mantener la confirmación visible unos segundos antes de volver al inicio.
        setTimeout(() => {
          setMensajeExito(null);
          setDatosCarrito({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
        }, 2500);
      } else if (msj.tipo === "LIMPIAR") {
        setDatosCarrito({ items: [], total: 0, descuento: 0, metodoPago: "EFECTIVO" });
        setProductoEnPantalla(null);
        setMensajeExito(null);
      }
    };

    return () => bc.close();
  }, []);

  return { datosCarrito, mensajeExito, productoEnPantalla };
}