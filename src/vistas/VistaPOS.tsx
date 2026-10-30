import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoCarrito, type TipoDescuento } from "../estado/estadoCarrito";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoCaja } from "../estado/estadoCaja";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEmisorPantallaCliente } from "../hooks/usePantallaCliente";
import { useEstadoFiados } from "../estado/estadoFiados";
import { imprimirTicket } from "../utilidades/impresion";
import { crearIdentificadorUnico } from "../utilidades/identificador";
import { useEscanerCodigoBarras } from "../hooks/useEscanerCodigoBarras";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import type { Producto } from "../tipos/producto";
import EstadoCajaBloqueado from "./pos/EstadoCajaBloqueado";
import CarritoVenta from "./pos/CarritoVenta";
import CatalogoProductosPOS from "./pos/CatalogoProductosPOS";
import ModalFiadoPOS from "./pos/ModalFiadoPOS";
import ModalesPOS from "./pos/ModalesPOS";
import type { DatosNuevoDeudor, ItemResaltadoPOS, ModoVistaPOS } from "./pos/types";

export default function VistaPOS() {
  const { productos, categorias, descontarStock } = useEstadoInventario();
  const {
    items,
    subtotal,
    descuento,
    tipoDescuento,
    total,
    agregarAlCarrito,
    actualizarCantidad,
    limpiarCarrito,
    setDescuento,
  } = useEstadoCarrito();
  const { ventas, agregarVenta } = useEstadoVentas();
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { forzarRecepcionCaja, obtenerTurnoActivo, requerirPinCancelacion } = useEstadoCaja();
  const { setSeccionActual } = useEstadoNavegacion();
  const {
    nombreTienda,
    mensajeTicket,
    direccionTienda,
    logoTienda,
    teclaCobro,
    teclaEfectivo,
    teclaTarjeta,
    teclaTransferencia,
    mensajePago,
    bancoTransferencia,
    titularTransferencia,
    cuentaTransferencia,
    habilitarFiados,
    modoAccesoFiados,
  } = useEstadoConfiguracion();
  const puedeDarFiado =
    habilitarFiados &&
    (trabajadorActivo?.rol === "DUENO" ||
      modoAccesoFiados === "TODOS" ||
      trabajadorActivo?.permisos?.permisoFiados === true);

  const nombreCajaLocal = localStorage.getItem("nombre_dispositivo_local") || "Caja Principal";
  const { enviarMensaje, clientesConectados = 0 } = useEmisorPantallaCliente(nombreCajaLocal);
  const { deudores, cargarDeudores } = useEstadoFiados();

  const [modalFiadoAbierto, setModalFiadoAbierto] = useState(false);
  const [modoFiado, setModoFiado] = useState<"seleccionar" | "nuevo">("seleccionar");
  const [deudorSeleccionado, setDeudorSeleccionado] = useState("");
  const [nuevoDeudor, setNuevoDeudor] = useState<DatosNuevoDeudor>({ nombre: "", celular: "", notas: "" });
  const [busquedaDeudor, setBusquedaDeudor] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [productoParaPesar, setProductoParaPesar] = useState<Producto | null>(null);
  const [modalPesoAbierto, setModalPesoAbierto] = useState(false);
  const [itemResaltado, setItemResaltado] = useState<ItemResaltadoPOS | null>(null);
  const temporizadorResaltadoRef = useRef<number | null>(null);
  const versionResaltadoRef = useRef(0);
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [inputDescuento, setInputDescuento] = useState("");
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [productoAutorizacion, setProductoAutorizacion] = useState<Producto | null>(null);
  const [evidenciaAutorizacion, setEvidenciaAutorizacion] = useState<string>();
  const claveImpresion = `imprimir_ticket_automatico:${localStorage.getItem("tienda_id") || "predeterminada"}`;
  const [esVistaMovil, setEsVistaMovil] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [impresionAutomatica, setImpresionAutomatica] = useState(() => {
    const preferencia = localStorage.getItem(claveImpresion);
    return preferencia === null ? !window.matchMedia("(max-width: 1023px)").matches : preferencia === "true";
  });
  const [modoVista, setModoVista] = useState<ModoVistaPOS>("cuadricula");
  const [productoEnfoque, setProductoEnfoque] = useState<Producto | null>(null);
  const [productoDescripcion, setProductoDescripcion] = useState<Producto | null>(null);
  const [camaraVisible, setCamaraVisible] = useState(true);
  const [modalPinCancelacion, setModalPinCancelacion] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null);

  const resaltarProductoEnCarrito = useCallback((productoId: string) => {
    const item = useEstadoCarrito.getState().items.find((actual) => actual.producto_id === productoId);
    if (!item) return;

    const version = ++versionResaltadoRef.current;
    setItemResaltado({ id: item.id, version });
    if (temporizadorResaltadoRef.current !== null) window.clearTimeout(temporizadorResaltadoRef.current);
    temporizadorResaltadoRef.current = window.setTimeout(() => {
      setItemResaltado((actual) => (actual?.version === version ? null : actual));
      temporizadorResaltadoRef.current = null;
    }, 1200);
  }, []);

  useEffect(() => {
    cargarDeudores();
  }, [cargarDeudores]);

  useEffect(
    () => () => {
      if (temporizadorResaltadoRef.current !== null) window.clearTimeout(temporizadorResaltadoRef.current);
    },
    []
  );

  useEffect(() => {
    enviarMensaje({ tipo: "ACTUALIZAR_CARRITO", items, total, descuento });
  }, [clientesConectados, items, total, descuento, enviarMensaje]);

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 1023px)");
    const actualizarVista = () => setEsVistaMovil(consulta.matches);
    consulta.addEventListener("change", actualizarVista);
    return () => consulta.removeEventListener("change", actualizarVista);
  }, []);

  const turnoActivo = trabajadorActivo ? obtenerTurnoActivo(trabajadorActivo.id) : undefined;
  const bloqueadoPorFondo = Boolean(
    forzarRecepcionCaja &&
      !turnoActivo &&
      trabajadorActivo?.rol !== "DUENO" &&
      trabajadorActivo?.rol !== "SUPERVISOR"
  );

  const turnoExpirado = useMemo(() => {
    if (!trabajadorActivo || !turnoActivo) return false;
    if (trabajadorActivo.rol === "DUENO" || trabajadorActivo.rol === "SUPERVISOR") return false;
    if (!trabajadorActivo.horarioSemanal) return false;

    const hoy = new Date();
    const tiempoAbierto = hoy.getTime() - new Date(turnoActivo.fechaInicio).getTime();
    const horasAbierto = tiempoAbierto / (1000 * 60 * 60);
    if (horasAbierto > 14) return true;

    const jsDay = hoy.getDay();
    const diaSemana = jsDay === 0 ? 7 : jsDay;
    const horario = trabajadorActivo.horarioSemanal;

    let salidaStr = "";
    if (horario.tipo === "ESPECIFICO" && horario.especifico[diaSemana]) {
      salidaStr = horario.especifico[diaSemana].salida;
    } else if (horario.tipo === "GENERAL") {
      salidaStr = horario.general.salida;
    }

    if (!salidaStr) return false;

    const [horas, minutos] = salidaStr.split(":").map(Number);
    const fechaSalida = new Date();
    fechaSalida.setHours(horas, minutos, 0, 0);
    fechaSalida.setHours(fechaSalida.getHours() + 1);
    return hoy.getTime() > fechaSalida.getTime() && horasAbierto > 1;
  }, [trabajadorActivo, turnoActivo]);

  const estaBloqueado = bloqueadoPorFondo || turnoExpirado;
  const mantenerCamaraActiva =
    camaraVisible &&
    !estaBloqueado &&
    !modalPesoAbierto &&
    !modalCobroAbierto &&
    !modalFiadoAbierto &&
    !modalPinCancelacion &&
    !aviso &&
    !productoAutorizacion &&
    !productoDescripcion;

  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      const esCampoTexto =
        objetivo?.tagName === "INPUT" || objetivo?.tagName === "TEXTAREA" || objetivo?.isContentEditable;
      if (!esCampoTexto && !estaBloqueado && evento.key.toLowerCase() === teclaCobro.toLowerCase() && items.length > 0) {
        evento.preventDefault();
        setModalCobroAbierto(true);
      }
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, [items.length, teclaCobro, estaBloqueado]);

  const productosFiltrados = productos.filter((producto) => {
    const consulta = busqueda.toLowerCase().trim();
    const coincideTexto =
      !consulta ||
      producto.nombre.toLowerCase().includes(consulta) ||
      producto.codigo_barras.includes(busqueda);
    const coincideCategoria = categoriaActiva === "todas" || producto.categoria === categoriaActiva;
    return coincideTexto && coincideCategoria;
  });

  const manejarCancelacion = (accion: () => void) => {
    const esAutorizado = trabajadorActivo?.rol === "DUENO" || trabajadorActivo?.rol === "SUPERVISOR";
    if (!requerirPinCancelacion || esAutorizado) {
      accion();
    } else {
      setAccionPendiente(() => accion);
      setModalPinCancelacion(true);
    }
  };

  const continuarAgregado = useCallback((producto: Producto, evidencia?: string) => {
    if (producto.unidad === "KG" || producto.unidad === "LITRO") {
      setEvidenciaAutorizacion(evidencia);
      setProductoParaPesar(producto);
      setModalPesoAbierto(true);
    } else {
      if (producto.controla_stock && producto.stock_actual < 1) {
        setAviso({ titulo: "Producto agotado", mensaje: "Este producto no tiene existencias disponibles para vender." });
        return;
      }
      const cantidadEnCarrito =
        useEstadoCarrito.getState().items.find((item) => item.producto_id === producto.id)?.cantidad ?? 0;
      if (producto.controla_stock && cantidadEnCarrito >= producto.stock_actual) {
        setAviso({
          titulo: "Existencia insuficiente",
          mensaje: `Solo hay ${producto.stock_actual} unidades disponibles de "${producto.nombre}".`,
        });
        return;
      }
      agregarAlCarrito(producto, 1, { evidencia });
      resaltarProductoEnCarrito(producto.id);
    }
  }, [agregarAlCarrito, resaltarProductoEnCarrito]);

  const manejarClickProducto = useCallback((producto: Producto) => {
    setProductoEnfoque(producto);
    if (producto.requiere_autorizacion) {
      setProductoAutorizacion(producto);
      return;
    }
    continuarAgregado(producto);
  }, [continuarAgregado]);

  const alEscanear = useCallback(
    (codigo: string) => {
      if (estaBloqueado) return;
      const producto = productos.find((actual) => actual.codigo_barras === codigo);
      if (!producto) {
        setAviso({
          titulo: "Producto no encontrado",
          mensaje: `El producto con código ${codigo} no está en el inventario.`,
        });
        return;
      }
      setBusqueda("");
      manejarClickProducto(producto);
    },
    [productos, estaBloqueado, manejarClickProducto]
  );

  useEscanerCodigoBarras(alEscanear);

  const procesarVentaFinal = async (
    metodoPago: string,
    deudorId?: string,
    nuevoDeudorDatos?: DatosNuevoDeudor
  ) => {
    if (!trabajadorActivo) return;

    try {
      await descontarStock(items);

      const nuevaVenta = {
        id: crearIdentificadorUnico(),
        fecha: new Date().toISOString(),
        vendedor_id: trabajadorActivo.id,
        trabajador: trabajadorActivo.nombre,
        articulos: items,
        subtotal,
        descuento,
        total,
        metodoPago,
      };

      await agregarVenta(nuevaVenta);

      if (metodoPago === "FIADO") {
        const { agregarDeudor, actualizarDeudor, deudores: deudoresActuales } = useEstadoFiados.getState();
        if (nuevoDeudorDatos && nuevoDeudorDatos.nombre.trim()) {
          await agregarDeudor({
            id: crearIdentificadorUnico(),
            nombre: nuevoDeudorDatos.nombre.trim(),
            celular: nuevoDeudorDatos.celular.trim(),
            notas: nuevoDeudorDatos.notas.trim(),
            tickets: [nuevaVenta.id],
            totalDeuda: total,
            fechaCreacion: new Date().toISOString(),
          });
        } else if (deudorId) {
          const deudorExistente = deudoresActuales.find((deudor) => deudor.id === deudorId);
          if (deudorExistente) {
            await actualizarDeudor({
              ...deudorExistente,
              tickets: [...deudorExistente.tickets, nuevaVenta.id],
              totalDeuda: deudorExistente.totalDeuda + total,
            });
          }
        }
      }

      setModalCobroAbierto(false);
      setModalFiadoAbierto(false);
      setNuevoDeudor({ nombre: "", celular: "", notas: "" });
      setDeudorSeleccionado("");
      setBusquedaDeudor("");
      limpiarCarrito();
      setInputDescuento("");
      setProductoEnfoque(null);

      try {
        enviarMensaje({
          tipo: "COBRO_EXITOSO",
          total,
          metodoPago,
          mensajePago,
          datosTransferencia:
            metodoPago === "TRANSFERENCIA"
              ? { banco: bancoTransferencia, titular: titularTransferencia, cuenta: cuentaTransferencia }
              : undefined,
        });
      } catch (error) {
        console.warn("Mensaje a pantalla cliente ignorado", error);
      }

      if (impresionAutomatica) {
        imprimirTicket(nuevaVenta, nombreTienda, mensajeTicket, direccionTienda, logoTienda);
      }

      setPagoConfirmado(true);
      window.setTimeout(() => setPagoConfirmado(false), 3500);
    } catch (error) {
      console.error("Error al procesar la venta:", error);
      setAviso({ titulo: "Error", mensaje: "Ocurrió un error al procesar el pago. Revisa el historial de ventas." });
      setModalCobroAbierto(false);
      setModalFiadoAbierto(false);
    }
  };

  const confirmarVenta = (metodoPago: string) => {
    if (metodoPago === "FIADO") {
      if (!puedeDarFiado) {
        setAviso({
          titulo: "Sin permiso",
          mensaje: "No tienes permiso para dar fiado. Solicita acceso al dueño de la tienda.",
        });
        return;
      }
      setModalCobroAbierto(false);
      setModalFiadoAbierto(true);
    } else {
      void procesarVentaFinal(metodoPago);
    }
  };

  const aplicarDescuento = (event: React.ChangeEvent<HTMLInputElement>) => {
    const valor = event.target.value;
    setInputDescuento(valor);
    const num = parseFloat(valor);
    if (!isNaN(num)) {
      setDescuento(num, tipoDescuento);
    } else {
      setDescuento(0, tipoDescuento);
    }
  };

  const cambiarTipoDescuento = (nuevoTipo: TipoDescuento) => {
    const num = parseFloat(inputDescuento) || 0;
    setDescuento(num, nuevoTipo);
  };

  const limpiarCarritoConAutorizacion = () => {
    manejarCancelacion(() => {
      limpiarCarrito();
      setInputDescuento("");
      setProductoEnfoque(null);
    });
  };

  const imprimirUltimaVenta = () => {
    const ultimaVenta = [...ventas].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    )[0];
    if (ultimaVenta) imprimirTicket(ultimaVenta, nombreTienda, mensajeTicket, direccionTienda, logoTienda);
  };

  const actualizarPreferenciaImpresion = (valor: boolean) => {
    setImpresionAutomatica(valor);
    localStorage.setItem(claveImpresion, String(valor));
  };

  if (estaBloqueado) {
    return (
      <EstadoCajaBloqueado
        turnoExpirado={turnoExpirado}
        alIrACaja={() => setSeccionActual("caja")}
      />
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-col md:flex-row gap-4 p-4 lg:p-6 overflow-y-auto animate-in fade-in duration-300">
      {pagoConfirmado && (
        <div className="fixed right-6 top-6 z-40 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-xl animate-in slide-in-from-top-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">✓</span>
          Pago registrado correctamente
        </div>
      )}

      <ModalFiadoPOS
        abierto={modalFiadoAbierto}
        deudores={deudores}
        modo={modoFiado}
        deudorSeleccionado={deudorSeleccionado}
        busqueda={busquedaDeudor}
        nuevoDeudor={nuevoDeudor}
        alCerrar={() => {
          setModalFiadoAbierto(false);
          setModalCobroAbierto(true);
        }}
        alCambiarModo={setModoFiado}
        alSeleccionarDeudor={setDeudorSeleccionado}
        alCambiarBusqueda={setBusquedaDeudor}
        alCambiarNuevoDeudor={setNuevoDeudor}
        alConfirmarExistente={() => void procesarVentaFinal("FIADO", deudorSeleccionado)}
        alConfirmarNuevo={() => void procesarVentaFinal("FIADO", undefined, nuevoDeudor)}
      />

      <ModalesPOS
        modalPinCancelacion={modalPinCancelacion}
        modalPesoAbierto={modalPesoAbierto}
        productoParaPesar={productoParaPesar}
        modalCobroAbierto={modalCobroAbierto}
        modalAviso={aviso}
        productoDescripcion={productoDescripcion}
        productoAutorizacion={productoAutorizacion}
        subtotal={subtotal}
        descuento={descuento}
        total={total}
        cantidadArticulos={items.length}
        fiadosPermitidos={puedeDarFiado}
        teclaCobro={teclaCobro}
        teclaEfectivo={teclaEfectivo}
        teclaTarjeta={teclaTarjeta}
        teclaTransferencia={teclaTransferencia}
        enviarMensaje={enviarMensaje}
        alConfirmarPin={() => {
          if (accionPendiente) accionPendiente();
          setModalPinCancelacion(false);
          setAccionPendiente(null);
        }}
        alCerrarPin={() => {
          setModalPinCancelacion(false);
          setAccionPendiente(null);
        }}
        alCerrarPeso={() => setModalPesoAbierto(false)}
        alConfirmarPeso={(peso) => {
          if (!productoParaPesar) return;
          const cantidadEnCarrito =
            useEstadoCarrito.getState().items.find((item) => item.producto_id === productoParaPesar.id)?.cantidad ?? 0;
          if (productoParaPesar.controla_stock && cantidadEnCarrito + peso > productoParaPesar.stock_actual) {
            setAviso({
              titulo: "Existencia insuficiente",
              mensaje: `Solo quedan ${(productoParaPesar.stock_actual - cantidadEnCarrito).toFixed(3)} ${productoParaPesar.unidad.toLowerCase()} disponibles.`,
            });
            return;
          }
          agregarAlCarrito(productoParaPesar, peso, { evidencia: evidenciaAutorizacion });
          resaltarProductoEnCarrito(productoParaPesar.id);
          setEvidenciaAutorizacion(undefined);
        }}
        alCerrarAviso={() => setAviso(null)}
        alCerrarDescripcion={() => setProductoDescripcion(null)}
        alCerrarAutorizacion={() => setProductoAutorizacion(null)}
        alConfirmarAutorizacion={(evidencia) => {
          if (productoAutorizacion) continuarAgregado(productoAutorizacion, evidencia);
          setProductoAutorizacion(null);
        }}
        alCerrarCobro={() => setModalCobroAbierto(false)}
        alConfirmarVenta={confirmarVenta}
        alCambiarMetodoPago={(metodoPago) =>
          enviarMensaje({
            tipo: "ACTUALIZAR_PAGO",
            metodoPago,
            datosTransferencia:
              metodoPago === "TRANSFERENCIA"
                ? { banco: bancoTransferencia, titular: titularTransferencia, cuenta: cuentaTransferencia }
                : undefined,
          })
        }
      />

      <CatalogoProductosPOS
        busqueda={busqueda}
        categoriaActiva={categoriaActiva}
        categorias={categorias}
        productos={productosFiltrados}
        modoVista={modoVista}
        esVistaMovil={esVistaMovil}
        productoEnfoque={productoEnfoque}
        camaraVisible={camaraVisible}
        mantenerCamaraActiva={mantenerCamaraActiva}
        carritoCamara={(
          <CarritoVenta
            modo="camara"
            items={items}
            productos={productos}
            itemResaltado={itemResaltado}
            subtotal={subtotal}
            descuento={descuento}
            total={total}
            tipoDescuento={tipoDescuento}
            inputDescuento={inputDescuento}
            impresionAutomatica={impresionAutomatica}
            teclaCobro={teclaCobro}
            hayVentas={ventas.length > 0}
            alVerDescripcion={setProductoDescripcion}
            alCancelar={manejarCancelacion}
            alActualizarCantidad={actualizarCantidad}
            alAplicarDescuento={aplicarDescuento}
            alCambiarTipoDescuento={cambiarTipoDescuento}
            alCambiarImpresionAutomatica={actualizarPreferenciaImpresion}
            alImprimirUltimo={imprimirUltimaVenta}
            alLimpiarCarrito={limpiarCarritoConAutorizacion}
            alAbrirCobro={() => setModalCobroAbierto(true)}
          />
        )}
        alCambiarBusqueda={setBusqueda}
        alPresionarEnter={(event) => {
          if (event.key === "Enter" && busqueda.trim()) {
            const exacto = productos.find((producto) => producto.codigo_barras === busqueda.trim());
            if (exacto) {
              event.preventDefault();
              setBusqueda("");
              manejarClickProducto(exacto);
            }
          }
        }}
        alCambiarModoVista={setModoVista}
        alCambiarCategoria={setCategoriaActiva}
        alEnfocarProducto={setProductoEnfoque}
        alAgregarProducto={manejarClickProducto}
        alCambiarVisibilidadCamara={() => setCamaraVisible(!camaraVisible)}
        alEscanear={alEscanear}
      />

      {modoVista !== "camara" && (
        <CarritoVenta
          modo="lateral"
          items={items}
          productos={productos}
          itemResaltado={itemResaltado}
          subtotal={subtotal}
          descuento={descuento}
          total={total}
          tipoDescuento={tipoDescuento}
          inputDescuento={inputDescuento}
          impresionAutomatica={impresionAutomatica}
          teclaCobro={teclaCobro}
          hayVentas={ventas.length > 0}
          alVerDescripcion={setProductoDescripcion}
          alCancelar={manejarCancelacion}
          alActualizarCantidad={actualizarCantidad}
          alAplicarDescuento={aplicarDescuento}
          alCambiarTipoDescuento={cambiarTipoDescuento}
          alCambiarImpresionAutomatica={actualizarPreferenciaImpresion}
          alImprimirUltimo={imprimirUltimaVenta}
          alLimpiarCarrito={limpiarCarritoConAutorizacion}
          alAbrirCobro={() => setModalCobroAbierto(true)}
        />
      )}
    </div>
  );
}
