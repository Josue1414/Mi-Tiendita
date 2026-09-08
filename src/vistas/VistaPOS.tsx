// src/vistas/VistaPOS.tsx
import { useCallback, useEffect, useState } from "react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoCarrito, type TipoDescuento } from "../estado/estadoCarrito";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoCaja } from "../estado/estadoCaja";
import { useEstadoNavegacion } from "../estado/estadoNavegacion"; 
import { useEmisorPantallaCliente } from "../hooks/usePantallaCliente";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Scale, Tag, Printer, History, ScanBarcode, LayoutGrid, Lock, Wallet } from "lucide-react";
import { precioVenta, type Producto } from "../tipos/producto";
import ModalPeso from "../componentes/ui/ModalPeso";
import ModalCobro from "../componentes/ui/ModalCobro";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import { cn } from "../utilidades/utils";
import { useEscanerCodigoBarras } from "../hooks/useEscanerCodigoBarras";
import { colorConAlpha, colorTextoSobre } from "../utilidades/coloresCategoria";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import ModalAviso from "../componentes/ui/ModalAviso";
import ModalAutorizacion from "../componentes/ui/ModalAutorizacion";
import ModalConfirmacionPin from "../componentes/ui/ModalConfirmacionPin";
import { imprimirTicket } from "../utilidades/impresion";
import PanelEscaner from "../componentes/pos/PanelEscaner";

export default function VistaPOS() {
  const { productos, categorias, descontarStock } = useEstadoInventario();
  const { 
    items, subtotal, descuento, tipoDescuento, total, 
    agregarAlCarrito, actualizarCantidad, limpiarCarrito, setDescuento 
  } = useEstadoCarrito();
  const { ventas, agregarVenta } = useEstadoVentas();
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { forzarRecepcionCaja, obtenerTurnoActivo, requerirPinCancelacion } = useEstadoCaja();
  const { setSeccionActual } = useEstadoNavegacion();
  
  const { nombreTienda, mensajeTicket, direccionTienda, logoTienda, teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, mensajePago, bancoTransferencia, titularTransferencia, cuentaTransferencia } = useEstadoConfiguracion();
  const { enviarMensaje } = useEmisorPantallaCliente();
  
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [productoParaPesar, setProductoParaPesar] = useState<Producto | null>(null);
  const [modalPesoAbierto, setModalPesoAbierto] = useState(false);
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [inputDescuento, setInputDescuento] = useState("");
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [productoAutorizacion, setProductoAutorizacion] = useState<Producto | null>(null);
  const [evidenciaAutorizacion, setEvidenciaAutorizacion] = useState<string>();
  const claveImpresion = `imprimir_ticket_automatico:${localStorage.getItem("tienda_id") || "predeterminada"}`;
  const [impresionAutomatica, setImpresionAutomatica] = useState(() => localStorage.getItem(claveImpresion) !== "false");
  const [modoVista, setModoVista] = useState<"cuadricula" | "escaner">("cuadricula");
  const [productoEnfoque, setProductoEnfoque] = useState<Producto | null>(null);

  // Estados para la restricción de cancelación
  const [modalPinCancelacion, setModalPinCancelacion] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null);

  const turnoActivo = trabajadorActivo ? obtenerTurnoActivo(trabajadorActivo.id) : undefined;
  
  // EXCEPCIÓN APLICADA: Ni el DUEÑO ni el SUPERVISOR se bloquean por falta de fondo
  const bloqueadoPorFondo = forzarRecepcionCaja && !turnoActivo && trabajadorActivo?.rol !== "DUENO" && trabajadorActivo?.rol !== "SUPERVISOR";

  useEffect(() => {
    enviarMensaje({ tipo: "ACTUALIZAR_CARRITO", items, total, descuento });
  }, [items, total, descuento, enviarMensaje]);

  useEffect(() => {
    const alPresionarTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      const esCampoTexto = objetivo?.tagName === "INPUT" || objetivo?.tagName === "TEXTAREA" || objetivo?.isContentEditable;
      if (!esCampoTexto && !bloqueadoPorFondo && evento.key.toLowerCase() === teclaCobro.toLowerCase() && items.length > 0) {
        evento.preventDefault();
        setModalCobroAbierto(true);
      }
    };
    window.addEventListener("keydown", alPresionarTecla);
    return () => window.removeEventListener("keydown", alPresionarTecla);
  }, [items.length, teclaCobro, bloqueadoPorFondo]);

  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    const coincideTexto = !q || p.nombre.toLowerCase().includes(q) || p.codigo_barras.includes(busqueda);
    const coincideCategoria = categoriaActiva === "todas" || p.categoria === categoriaActiva;
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

  const manejarClickProducto = (producto: Producto) => {
    setProductoEnfoque(producto); 
    if (producto.requiere_autorizacion) {
      setProductoAutorizacion(producto);
      return;
    }
    continuarAgregado(producto);
  };

  const manejarDobleClicCarrito = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId);
    if (producto) {
      setProductoEnfoque(producto);
      setModoVista("escaner");
    }
  };

  const continuarAgregado = (producto: Producto, evidencia?: string) => {
    if (producto.unidad === "KG" || producto.unidad === "LITRO") {
      setEvidenciaAutorizacion(evidencia);
      setProductoParaPesar(producto);
      setModalPesoAbierto(true);
    } else {
      if (producto.controla_stock && producto.stock_actual < 1) {
        setAviso({ titulo: "Producto agotado", mensaje: "Este producto no tiene existencias disponibles para vender." });
        return;
      }
      const cantidadEnCarrito = useEstadoCarrito.getState().items.find((item) => item.producto_id === producto.id)?.cantidad ?? 0;
      if (producto.controla_stock && cantidadEnCarrito >= producto.stock_actual) {
        setAviso({ titulo: "Existencia insuficiente", mensaje: `Solo hay ${producto.stock_actual} unidades disponibles de "${producto.nombre}".` });
        return;
      }
      agregarAlCarrito(producto, 1, { evidencia });
    }
  };

  const alEscanear = useCallback((codigo: string) => {
    if (bloqueadoPorFondo) return;
    const producto = productos.find((p) => p.codigo_barras === codigo);
    if (!producto) {
      setAviso({ titulo: "Código no encontrado", mensaje: `No existe un producto registrado con el código ${codigo}.` });
      return;
    }
    setBusqueda("");
    manejarClickProducto(producto);
  }, [productos, bloqueadoPorFondo]);

  useEscanerCodigoBarras(alEscanear);

  const generarIdTicket = () => {
    const ahora = new Date();
    const yy = ahora.getFullYear().toString().slice(-2);
    const mm = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dd = ahora.getDate().toString().padStart(2, '0');

    const letraRandom = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const alfanumRandom = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return chars.charAt(Math.floor(Math.random() * chars.length));
    };

    const l1 = letraRandom();
    const l2 = letraRandom() + letraRandom();
    
    let resto = "";
    for(let i=0; i<5; i++) {
      resto += alfanumRandom();
    }
    return `${yy}${l1}${mm}${l2}${dd}${resto}`;
  };

  const confirmarVenta = async (metodoPago: string) => {
    if (!trabajadorActivo) return;

    try {
      await descontarStock(items);
      
      const nuevaVenta = {
        id: generarIdTicket(),
        fecha: new Date().toISOString(),
        trabajador: trabajadorActivo.nombre, 
        articulos: items,
        subtotal,
        descuento,
        total,
        metodoPago
      };

      await agregarVenta(nuevaVenta);

      setModalCobroAbierto(false);
      limpiarCarrito();
      setInputDescuento("");
      setProductoEnfoque(null); 

      try {
        enviarMensaje({ 
          tipo: "COBRO_EXITOSO", 
          total, 
          metodoPago, 
          mensajePago, 
          datosTransferencia: metodoPago === "TRANSFERENCIA" ? { banco: bancoTransferencia, titular: titularTransferencia, cuenta: cuentaTransferencia } : undefined 
        });
      } catch (e) {
        console.warn("Mensaje a pantalla cliente ignorado", e);
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
    }
  };

  const aplicarDescuento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
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

  if (bloqueadoPorFondo) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="efecto-cristal p-10 rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 flex flex-col items-center text-center max-w-md shadow-xl animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 relative">
            <Wallet size={36} />
            <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-900 rounded-full p-1">
              <Lock size={20} className="text-amber-500" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Confirma tu fondo de caja</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            El administrador ha configurado que debes confirmar la recepción del dinero en caja antes de poder realizar ventas o escanear productos.
          </p>
          
          <button 
            onClick={() => setSeccionActual("caja")} 
            className="w-full py-4 rounded-xl font-bold flex justify-center items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
          >
            Ir a Corte de Caja
          </button>
        </div>
      </div>
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
      
      <ModalConfirmacionPin
        abierto={modalPinCancelacion}
        titulo="Autorización Requerida"
        mensaje="Ingresa el PIN de un Dueño o Supervisor para autorizar esta cancelación."
        labelPin="PIN de Autorización"
        validarAutorizacion={true}
        alConfirmar={() => {
          if (accionPendiente) accionPendiente();
          setModalPinCancelacion(false);
          setAccionPendiente(null);
        }}
        alCerrar={() => {
          setModalPinCancelacion(false);
          setAccionPendiente(null);
        }}
      />

      <ModalPeso 
        abierto={modalPesoAbierto} 
        alCerrar={() => setModalPesoAbierto(false)} 
        producto={productoParaPesar} 
        alConfirmar={(peso: number) => {
          if (!productoParaPesar) return;
          const cantidadEnCarrito = useEstadoCarrito.getState().items.find((item) => item.producto_id === productoParaPesar.id)?.cantidad ?? 0;
          if (productoParaPesar.controla_stock && cantidadEnCarrito + peso > productoParaPesar.stock_actual) {
            setAviso({ titulo: "Existencia insuficiente", mensaje: `Solo quedan ${(productoParaPesar.stock_actual - cantidadEnCarrito).toFixed(3)} ${productoParaPesar.unidad.toLowerCase()} disponibles.` });
            return;
          }
          agregarAlCarrito(productoParaPesar, peso, { evidencia: evidenciaAutorizacion });
          setEvidenciaAutorizacion(undefined);
        }} 
      />
      
      <ModalAviso abierto={Boolean(aviso)} titulo={aviso?.titulo ?? "Aviso"} mensaje={aviso?.mensaje ?? ""} tipo="advertencia" alCerrar={() => setAviso(null)} />
      
      <ModalAutorizacion
        abierto={Boolean(productoAutorizacion)}
        mensaje={productoAutorizacion?.mensaje_autorizacion ?? "Este producto requiere autorización para venderse."}
        permiteFoto={Boolean(productoAutorizacion?.permite_foto_autorizacion)}
        alCerrar={() => setProductoAutorizacion(null)}
        alConfirmar={(evidencia) => {
          if (productoAutorizacion) continuarAgregado(productoAutorizacion, evidencia);
          setProductoAutorizacion(null);
        }}
      />
      
      <ModalCobro 
        estaAbierto={modalCobroAbierto} 
        alCerrar={() => setModalCobroAbierto(false)} 
        subtotal={subtotal}
        descuento={descuento}
        total={total} 
        cantidadArticulos={items.length}
        alConfirmarVenta={confirmarVenta}
        teclaCobro={teclaCobro}
        teclaEfectivo={teclaEfectivo}
        teclaTarjeta={teclaTarjeta}
        teclaTransferencia={teclaTransferencia}
        alCambiarMetodoPago={(metodoPago) => enviarMensaje({ tipo: "ACTUALIZAR_PAGO", metodoPago, datosTransferencia: metodoPago === "TRANSFERENCIA" ? { banco: bancoTransferencia, titular: titularTransferencia, cuenta: cuentaTransferencia } : undefined })}
      />

      <div className="flex-1 min-w-0 min-h-[420px] flex flex-col gap-3">
        <div className="flex gap-2 relative">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              data-escaner="true"
              placeholder="Buscar o escanear código de barras..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && busqueda.trim()) {
                  const exacto = productos.find((p) => p.codigo_barras === busqueda.trim());
                  if (exacto) {
                    e.preventDefault();
                    setBusqueda("");
                    manejarClickProducto(exacto);
                  }
                }
              }}
              className="w-full efecto-cristal pl-9 pr-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm h-full"
            />
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setModoVista("cuadricula")}
              className={cn("p-2 rounded-lg flex items-center justify-center transition-all", modoVista === "cuadricula" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
              title="Vista Cuadrícula"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setModoVista("escaner")}
              className={cn("p-2 rounded-lg flex items-center justify-center transition-all", modoVista === "escaner" ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
              title="Vista Escáner"
            >
              <ScanBarcode size={20} />
            </button>
          </div>
        </div>

        {modoVista === "cuadricula" ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mt-1">
              <button
                onClick={() => setCategoriaActiva("todas")}
                className={cn(
                  "h-8 shrink-0 px-3 rounded-full text-xs font-semibold border",
                  categoriaActiva === "todas"
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                    : "border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300"
                )}
              >
                Todas
              </button>
              {categorias.map((categoria) => {
                const activa = categoriaActiva === categoria.nombre;
                return (
                  <button
                    key={categoria.id}
                    onClick={() => setCategoriaActiva(categoria.nombre)}
                    className="h-8 shrink-0 px-3 rounded-full text-xs font-semibold border"
                    style={{
                      backgroundColor: activa ? categoria.color : "transparent",
                      color: activa ? colorTextoSobre(categoria.color) : categoria.color,
                      borderColor: categoria.color,
                    }}
                  >
                    {categoria.nombre}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-2 pb-2 min-h-[280px] flex-1">
              {productosFiltrados.map((producto) => {
                const final = precioVenta(producto);
                const color = categorias.find((c) => c.nombre === producto.categoria)?.color;
                return (
                <button
                  key={producto.id}
                  // MODIFICACIÓN: Cambiado de onClick a onDoubleClick para prevenir errores de dedo
                  onDoubleClick={() => manejarClickProducto(producto)}
                  title="Doble clic para agregar"
                  className="efecto-cristal p-2 rounded-xl flex items-center text-left hover:scale-[1.02] transition-transform focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200/50 dark:border-white/10 relative overflow-hidden group gap-2 min-h-[105px]"
                >
                  <ImagenLocal 
                    nombreArchivo={producto.imagen_url} 
                    nombreProducto={producto.nombre} 
                    className="w-16 h-16 rounded-lg shrink-0 object-cover" 
                  />
                  <div className="flex flex-col flex-1 h-full py-1 overflow-hidden">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2 leading-tight">
                      {producto.nombre}
                    </span>
                    {producto.categoria && color && (
                      <span className="self-start mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide" style={{ backgroundColor: colorConAlpha(color, 0.16), color }}>
                        {producto.categoria}
                      </span>
                    )}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold mt-auto text-base flex items-baseline gap-1.5">
                      ${final.toFixed(2)}
                      {(producto.descuento_porcentaje || 0) > 0 && (
                        <span className="text-[10px] line-through text-slate-400 font-normal">${producto.precio.toFixed(2)}</span>
                      )}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(producto.unidad === "KG" || producto.unidad === "LITRO") ? <Scale size={16}/> : <Plus size={16}/>}
                  </div>
                </button>
                );
              })}
            </div>
          </>
        ) : (
          <PanelEscaner producto={productoEnfoque} />
        )}
      </div>

      <div className="w-full md:w-[min(35%,380px)] flex flex-col gap-4 shrink-0">
        <div className="efecto-cristal rounded-2xl p-4 flex flex-col min-h-[360px] md:h-full border border-slate-200/50 dark:border-white/10">
          
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3 text-slate-900 dark:text-slate-100">
            <ShoppingCart size={20} className="text-emerald-600 dark:text-emerald-400" />
            Ticket de Venta
          </h2>

          <div className="flex-1 min-h-[100px] overflow-y-auto flex flex-col gap-2 pr-1">
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                <ShoppingCart size={40} className="opacity-20 mb-1" />
                <p className="text-sm">El carrito está vacío</p>
              </div>
            ) : (
              items.map((item) => (
                <div 
                  key={item.id} 
                  onDoubleClick={() => manejarDobleClicCarrito(item.producto_id)}
                  className="flex gap-2 p-2 bg-slate-50/80 dark:bg-slate-900/50 rounded-lg border border-slate-200/50 dark:border-white/5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700/50 transition-colors"
                  title="Doble clic para ver en escáner"
                >
                  <ImagenLocal 
                    nombreArchivo={item.imagen_url} 
                    nombreProducto={item.nombre} 
                    className="w-12 h-12 rounded-md object-cover border border-slate-200 dark:border-white/10 shrink-0 bg-white" 
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-slate-900 dark:text-slate-100 text-xs leading-tight line-clamp-2 pr-2">
                        {item.nombre}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        ${item.subtotal.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-auto pt-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        ${item.precio.toFixed(2)}/{item.unidad.toLowerCase().charAt(0)}
                      </span>
                      
                      <div className="flex items-center bg-white dark:bg-slate-800 rounded-md border border-slate-200/50 dark:border-white/10 shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            const decremento = (item.unidad === "KG" || item.unidad === "LITRO") ? 0.050 : 1;
                            const nuevaCantidad = item.cantidad - decremento;
                            if (nuevaCantidad <= 0) {
                              manejarCancelacion(() => actualizarCantidad(item.id, nuevaCantidad));
                            } else {
                              actualizarCantidad(item.id, nuevaCantidad);
                            }
                          }} 
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-semibold w-9 text-center text-slate-900 dark:text-slate-100 tabular-nums">
                          {(item.unidad === "KG" || item.unidad === "LITRO") ? item.cantidad.toFixed(3) : item.cantidad}
                        </span>
                        <button 
                          onClick={() => actualizarCantidad(item.id, item.cantidad + ((item.unidad === "KG" || item.unidad === "LITRO") ? 0.050 : 1))} 
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-white/10 flex flex-col gap-3">
            
            <div className="flex justify-between items-center px-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 font-medium">
                <Tag size={14} /> Descuento
              </span>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-white/10">
                  <button onClick={() => cambiarTipoDescuento("MONTO")} className={cn("px-2 py-0.5 text-xs rounded-md font-bold transition-colors", tipoDescuento === "MONTO" ? "bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400")}>$</button>
                  <button onClick={() => cambiarTipoDescuento("PORCENTAJE")} className={cn("px-2 py-0.5 text-xs rounded-md font-bold transition-colors", tipoDescuento === "PORCENTAJE" ? "bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 dark:text-slate-400")}>%</button>
                </div>
                <div className="relative w-20">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                    {tipoDescuento === "MONTO" ? "$" : "%"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step={tipoDescuento === "MONTO" ? "1" : "5"}
                    value={inputDescuento}
                    onChange={aplicarDescuento}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg pl-6 pr-2 py-1.5 text-right outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm font-medium"
                  />
                </div>
              </div>
            </div>

            {descuento > 0 && (
              <div className="flex justify-between items-end px-1 opacity-70">
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">Subtotal</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 line-through">
                  ${subtotal.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between items-end px-1">
              <span className="text-slate-500 dark:text-slate-400 text-base font-medium">Total</span>
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                ${total.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between px-1 mt-1">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-emerald-600 transition-colors select-none">
                <input 
                  type="checkbox" 
                  checked={impresionAutomatica} 
                  onChange={e => {
                    const valor = e.target.checked;
                    setImpresionAutomatica(valor);
                    localStorage.setItem(claveImpresion, String(valor));
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer" 
                />
                <Printer size={13} /> Imprimir automático
              </label>

              {ventas.length > 0 && (
                <button 
                  type="button"
                  onClick={() => {
                    const ultimaVenta = [...ventas].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
                    imprimirTicket(ultimaVenta, nombreTienda, mensajeTicket, direccionTienda, logoTienda);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1"
                >
                  <History size={13} /> Imprimir último
                </button>
              )}
            </div>

            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => manejarCancelacion(() => { limpiarCarrito(); setInputDescuento(""); setProductoEnfoque(null); })}
                disabled={items.length === 0}
                className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-100 dark:border-red-900/50"
                title="Vaciar Carrito"
              >
                <Trash2 size={20} />
              </button>
              <button 
                onClick={() => setModalCobroAbierto(true)}
                disabled={items.length === 0}
                className="flex-1 flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/30 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                <CreditCard size={20} />
                Cobrar ({teclaCobro})
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}