// src/vistas/pos/ModalesPOS.tsx
import type { ComponentProps } from "react";
import ModalAviso from "../../componentes/ui/ModalAviso";
import ModalAutorizacion from "../../componentes/ui/ModalAutorizacion";
import ModalCobro from "../../componentes/ui/ModalCobro";
import ModalConfirmacionPin from "../../componentes/ui/ModalConfirmacionPin";
import ModalDescripcionProducto from "../../componentes/ui/ModalDescripcionProducto";
import ModalPeso from "../../componentes/ui/ModalPeso";
import type { Producto } from "../../tipos/producto";

type EnviarMensajePantalla = ComponentProps<typeof ModalDescripcionProducto>["enviarMensaje"];

interface ModalesPOSProps {
  modalPinCancelacion: boolean;
  modalPesoAbierto: boolean;
  productoParaPesar: Producto | null;
  modalCobroAbierto: boolean;
  modalAviso: { titulo: string; mensaje: string } | null;
  productoDescripcion: Producto | null;
  productoAutorizacion: Producto | null;
  subtotal: number;
  descuento: number;
  total: number;
  cantidadArticulos: number;
  fiadosPermitidos: boolean;
  teclaCobro: string;
  teclaEfectivo: string;
  teclaTarjeta: string;
  teclaTransferencia: string;
  enviarMensaje: EnviarMensajePantalla;
  alConfirmarPin: () => void;
  alCerrarPin: () => void;
  alCerrarPeso: () => void;
  alConfirmarPeso: (peso: number) => void;
  alCerrarAviso: () => void;
  alCerrarDescripcion: () => void;
  alCerrarAutorizacion: () => void;
  alConfirmarAutorizacion: (evidencia?: string) => void;
  alCerrarCobro: () => void;
  alConfirmarVenta: (metodoPago: string) => void;
  alCambiarMetodoPago: (metodoPago: string) => void;
}

export default function ModalesPOS({
  modalPinCancelacion,
  modalPesoAbierto,
  productoParaPesar,
  modalCobroAbierto,
  modalAviso,
  productoDescripcion,
  productoAutorizacion,
  subtotal,
  descuento,
  total,
  cantidadArticulos,
  fiadosPermitidos,
  teclaCobro,
  teclaEfectivo,
  teclaTarjeta,
  teclaTransferencia,
  enviarMensaje,
  alConfirmarPin,
  alCerrarPin,
  alCerrarPeso,
  alConfirmarPeso,
  alCerrarAviso,
  alCerrarDescripcion,
  alCerrarAutorizacion,
  alConfirmarAutorizacion,
  alCerrarCobro,
  alConfirmarVenta,
  alCambiarMetodoPago,
}: ModalesPOSProps) {
  return (
    <>
      <ModalConfirmacionPin
        abierto={modalPinCancelacion}
        titulo="Autorización Requerida"
        mensaje="Ingresa el PIN de un Dueño o Supervisor para autorizar esta cancelación."
        labelPin="PIN de Autorización"
        validarAutorizacion={true}
        alConfirmar={alConfirmarPin}
        alCerrar={alCerrarPin}
      />

      <ModalPeso
        abierto={modalPesoAbierto}
        alCerrar={alCerrarPeso}
        producto={productoParaPesar}
        alConfirmar={alConfirmarPeso}
      />

      <ModalAviso
        abierto={Boolean(modalAviso)}
        titulo={modalAviso?.titulo ?? "Aviso"}
        mensaje={modalAviso?.mensaje ?? ""}
        tipo="advertencia"
        alCerrar={alCerrarAviso}
      />
      <ModalDescripcionProducto
        abierto={Boolean(productoDescripcion)}
        producto={productoDescripcion}
        alCerrar={alCerrarDescripcion}
        enviarMensaje={enviarMensaje}
      />

      <ModalAutorizacion
        abierto={Boolean(productoAutorizacion)}
        mensaje={productoAutorizacion?.mensaje_autorizacion ?? "Este producto requiere autorización para venderse."}
        permiteFoto={Boolean(productoAutorizacion?.permite_foto_autorizacion)}
        alCerrar={alCerrarAutorizacion}
        alConfirmar={alConfirmarAutorizacion}
      />

      {modalCobroAbierto && (
        <ModalCobro
          estaAbierto={modalCobroAbierto}
          alCerrar={alCerrarCobro}
          subtotal={subtotal}
          descuento={descuento}
          total={total}
          cantidadArticulos={cantidadArticulos}
          fiadosPermitidos={fiadosPermitidos}
          alConfirmarVenta={alConfirmarVenta}
          teclaCobro={teclaCobro}
          teclaEfectivo={teclaEfectivo}
          teclaTarjeta={teclaTarjeta}
          teclaTransferencia={teclaTransferencia}
          alCambiarMetodoPago={alCambiarMetodoPago}
        />
      )}
    </>
  );
}
