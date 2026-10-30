// src/vistas/VistaNuevoProducto.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, Lock, PackagePlus, Pencil } from "lucide-react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { precioVenta, type Producto } from "../tipos/producto";
import { generarCodigoCorto, generarCodigoEAN13, generarCodigoNumerico, svgCodigoBarras } from "../utilidades/codigoBarras";
import ModalCategoria from "../componentes/ui/ModalCategoria";
import ModalAviso from "../componentes/ui/ModalAviso";
import { useEscanerCodigoBarras } from "../hooks/useEscanerCodigoBarras";
import ModalEscanerCodigo from "../componentes/ui/ModalEscanerCodigo";
import { ajustarLotes } from "../utilidades/lotes";
import { crearIdentificadorUnico } from "../utilidades/identificador";
import { guardarImagenLocal, obtenerUrlImagenLocal } from "../servicios/baseDatosLocal";
import SeccionInformacionProducto from "./nuevo_producto/SeccionInformacionProducto";
import SeccionInventarioProducto from "./nuevo_producto/SeccionInventarioProducto";
import SeccionImagenProducto from "./nuevo_producto/SeccionImagenProducto";
import SeccionPreciosEtiqueta from "./nuevo_producto/SeccionPreciosEtiqueta";

export default function VistaNuevoProducto() {
  const { productos, categorias, agregarProducto, actualizarProducto, agregarCategoria } = useEstadoInventario();
  const { setSeccionActual, productoEditandoId, abrirLoteCaducidad } = useEstadoNavegacion();
  const { trabajadorActivo } = useEstadoTrabajadores();
  const diasAlertaCaducidad = useEstadoConfiguracion((estado) => estado.diasAlertaCaducidad);

  const productoExistente = productos.find((producto) => producto.id === productoEditandoId);
  const editando = Boolean(productoExistente);
  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  const puedeEditar = esDueño || esSupervisor || trabajadorActivo?.permisos?.editarProductos;
  const puedeAjustarStock = esDueño || esSupervisor || trabajadorActivo?.permisos?.actualizarStockCodigo;
  const puedeEditarPrecio = esDueño
    || (esSupervisor && trabajadorActivo?.permisos?.cambiarPrecios)
    || (trabajadorActivo?.rol === "TRABAJADOR" && trabajadorActivo?.permisos?.editarProductos);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState(() => {
    const codigoPendiente = localStorage.getItem("codigo_producto_pendiente");
    if (codigoPendiente) localStorage.removeItem("codigo_producto_pendiente");
    return codigoPendiente || "";
  });
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [paquete, setPaquete] = useState("");
  const [controlaStock, setControlaStock] = useState(true);
  const [stockActual, setStockActual] = useState(0);
  const [cantidadNuevoLote, setCantidadNuevoLote] = useState(0);
  const [mostrarAyudaLotes, setMostrarAyudaLotes] = useState(false);
  const [fechaCaducidadNuevoLote, setFechaCaducidadNuevoLote] = useState("");
  const [loteCaducidadEditando, setLoteCaducidadEditando] = useState<string | null>(null);
  const [fechaCaducidadEditada, setFechaCaducidadEditada] = useState("");
  const [stockMinimo, setStockMinimo] = useState(5);
  const [unidad, setUnidad] = useState<Producto["unidad"]>("PIEZA");
  const [precio, setPrecio] = useState(0);
  const [costo, setCosto] = useState(0);
  const [descuento, setDescuento] = useState(0);
  const [requiereAutorizacion, setRequiereAutorizacion] = useState(false);
  const [mensajeAutorizacion, setMensajeAutorizacion] = useState("Se requiere receta o autorización para vender este producto.");
  const [permiteFotoAutorizacion, setPermiteFotoAutorizacion] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [previewImagen, setPreviewImagen] = useState<string | null>(null);
  const [imagenEliminada, setImagenEliminada] = useState(false);
  const [avisoGenerico, setAvisoGenerico] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [escanerCamaraAbierto, setEscanerCamaraAbierto] = useState(false);

  const cerrarEscanerCamara = useCallback(() => setEscanerCamaraAbierto(false), []);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const urlImagenTemporalRef = useRef<string | null>(null);
  const esAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  useEffect(() => () => {
    if (urlImagenTemporalRef.current) URL.revokeObjectURL(urlImagenTemporalRef.current);
  }, []);

  useEffect(() => {
    if (!productoExistente) return;
    setNombre(productoExistente.nombre);
    setCodigo(productoExistente.codigo_barras);
    setDescripcion(productoExistente.descripcion || "");
    setCategoria(productoExistente.categoria || "");
    setUbicacion(productoExistente.ubicacion || "");
    setPaquete(productoExistente.paquete || "");
    setControlaStock(productoExistente.controla_stock);
    setStockActual(productoExistente.stock_actual);
    setCantidadNuevoLote(0);
    setStockMinimo(productoExistente.stock_minimo);
    setUnidad(productoExistente.unidad);
    setPrecio(productoExistente.precio);
    setCosto(productoExistente.costo);
    setDescuento(productoExistente.descuento_porcentaje || 0);
    setRequiereAutorizacion(productoExistente.requiere_autorizacion ?? false);
    setMensajeAutorizacion(productoExistente.mensaje_autorizacion || "Se requiere receta o autorización para vender este producto.");
    setPermiteFotoAutorizacion(productoExistente.permite_foto_autorizacion ?? false);
    setArchivoImagen(null);
    setImagenEliminada(false);
    if (productoExistente.imagen_url?.startsWith("data:image/")) {
      setPreviewImagen(productoExistente.imagen_url);
      return;
    }

    let cancelado = false;
    let urlLocal: string | null = null;
    setPreviewImagen(null);
    if (productoExistente.imagen_archivo) {
      void obtenerUrlImagenLocal(productoExistente.imagen_archivo).then((url) => {
        if (cancelado) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        urlLocal = url;
        setPreviewImagen(url);
      }).catch((error: unknown) => {
        console.error("No se pudo cargar la imagen local del producto:", error);
      });
    }

    return () => {
      cancelado = true;
      if (urlLocal) URL.revokeObjectURL(urlLocal);
    };
  }, [productoExistente]);

  const generarCodigo = (formato: "EAN13" | "CORTO" | "NUMERICO") => {
    if (!puedeEditar && !puedeAjustarStock) return;
    const crearCodigo = formato === "CORTO" ? generarCodigoCorto : formato === "NUMERICO" ? generarCodigoNumerico : generarCodigoEAN13;
    let codigoGenerado = crearCodigo();
    while (productos.some((producto) => producto.codigo_barras === codigoGenerado && producto.id !== productoExistente?.id)) {
      codigoGenerado = crearCodigo();
    }
    setCodigo(codigoGenerado);
  };

  const precioFinal = precioVenta({ precio, descuento_porcentaje: descuento });
  const margen = precioFinal > 0 && costo > 0 ? ((precioFinal - costo) / precioFinal) * 100 : 0;
  const previewCodigo = useMemo(() => (codigo ? svgCodigoBarras(codigo) : ""), [codigo]);
  const colorCategoria = categorias.find((item) => item.nombre === categoria)?.color;

  const alEscanearCodigo = useCallback((codigoEscaneado: string) => {
    if (puedeEditar || puedeAjustarStock) setCodigo(codigoEscaneado);
  }, [puedeEditar, puedeAjustarStock]);
  useEscanerCodigoBarras(alEscanearCodigo);

  const manejarSeleccionImagen = (evento: React.ChangeEvent<HTMLInputElement>) => {
    if (!puedeEditar) return;
    const archivo = evento.target.files?.[0];
    if (archivo) {
      if (urlImagenTemporalRef.current) URL.revokeObjectURL(urlImagenTemporalRef.current);
      const preview = URL.createObjectURL(archivo);
      urlImagenTemporalRef.current = preview;
      setArchivoImagen(archivo);
      setPreviewImagen(preview);
      setImagenEliminada(false);
    }
    evento.target.value = "";
  };

  const removerImagen = () => {
    if (!puedeEditar) return;
    if (urlImagenTemporalRef.current) URL.revokeObjectURL(urlImagenTemporalRef.current);
    urlImagenTemporalRef.current = null;
    setArchivoImagen(null);
    setPreviewImagen(null);
    setImagenEliminada(true);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    if (inputCamaraRef.current) inputCamaraRef.current.value = "";
    if (inputGaleriaRef.current) inputGaleriaRef.current.value = "";
  };

  const guardarCaducidadLote = async (loteId: string) => {
    if (!productoExistente || !puedeEditar) return;
    await actualizarProducto({
      ...productoExistente,
      lotes: (productoExistente.lotes ?? []).map((lote) =>
        lote.id === loteId
          ? {
            ...lote,
            fecha_caducidad: fechaCaducidadEditada || undefined,
            editado_por: trabajadorActivo?.nombre ?? "Sistema",
            fecha_edicion: new Date().toISOString(),
          }
          : lote
      ),
    });
    setLoteCaducidadEditando(null);
  };

  const convertirABase64 = (archivo: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(archivo);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const manejarGuardado = async (evento?: React.FormEvent) => {
    evento?.preventDefault();
    if (!puedeEditar && !puedeAjustarStock) return;

    if (!nombre || !codigo || precio <= 0) {
      setAvisoGenerico({
        titulo: "Información Incompleta",
        mensaje: "Asegúrate de completar el nombre, el código de barras y establecer un precio de venta mayor a $0.00."
      });
      return;
    }

    const codigoExistente = productos.find((producto) => producto.codigo_barras.trim() === codigo.trim() && producto.id !== productoExistente?.id);
    if (codigoExistente) {
      setAvisoGenerico({
        titulo: "Código Duplicado",
        mensaje: `El código ${codigo} ya pertenece a "${codigoExistente.nombre}". Usa otro código o edita ese producto para cambiarlo.`
      });
      return;
    }

    const productoId = productoExistente?.id ?? crearIdentificadorUnico();
    let imagenBase64 = productoExistente?.imagen_url;
    let imagenArchivo = productoExistente?.imagen_archivo;
    if (archivoImagen && puedeEditar) {
      try {
        imagenBase64 = await convertirABase64(archivoImagen);
        imagenArchivo = `${productoId}__${archivoImagen.name}`;
        await guardarImagenLocal(imagenArchivo, archivoImagen);
      } catch {
        setAvisoGenerico({
          titulo: "Error de Imagen",
          mensaje: "Hubo un problema procesando la fotografía. Intenta subir un archivo más ligero u otro formato (JPG, PNG)."
        });
        return;
      }
    } else if (imagenEliminada && puedeEditar) {
      imagenBase64 = undefined;
      imagenArchivo = undefined;
    }

    const cantidadAgregada = editando ? cantidadNuevoLote : stockActual;
    const stockFinal = editando
      ? (productoExistente?.stock_actual ?? 0) + cantidadAgregada
      : stockActual;
    const lotes = cantidadAgregada === 0
      ? productoExistente?.lotes ?? []
      : ajustarLotes(productoExistente?.lotes, cantidadAgregada, {
        fechaCaducidad: fechaCaducidadNuevoLote,
        agregadoPor: trabajadorActivo?.nombre ?? "Sistema",
        diasAlerta: diasAlertaCaducidad,
      });

    const producto: Producto = {
      id: productoId,
      nombre: puedeEditar ? nombre : productoExistente?.nombre || "",
      codigo_barras: codigo,
      descripcion: puedeEditar ? descripcion : productoExistente?.descripcion || "",
      categoria: puedeEditar ? categoria : productoExistente?.categoria || "",
      ubicacion: puedeEditar ? ubicacion : productoExistente?.ubicacion || "",
      paquete: puedeEditar ? paquete : productoExistente?.paquete || "",
      controla_stock: puedeEditar ? controlaStock : (productoExistente?.controla_stock ?? true),
      stock_actual: stockFinal,
      lotes,
      stock_minimo: puedeEditar ? stockMinimo : (productoExistente?.stock_minimo ?? 5),
      unidad: puedeEditar ? unidad : (productoExistente?.unidad || "PIEZA"),
      precio: puedeEditarPrecio ? precio : (productoExistente?.precio ?? 0),
      costo: puedeEditarPrecio ? costo : (productoExistente?.costo ?? 0),
      descuento_porcentaje: puedeEditarPrecio ? Math.max(0, Math.min(100, descuento)) : (productoExistente?.descuento_porcentaje ?? 0),
      activo: true,
      imagen_url: imagenBase64,
      imagen_archivo: imagenArchivo,
      requiere_autorizacion: puedeEditar ? requiereAutorizacion : (productoExistente?.requiere_autorizacion ?? false),
      mensaje_autorizacion: puedeEditar ? mensajeAutorizacion.trim() : (productoExistente?.mensaje_autorizacion || ""),
      permite_foto_autorizacion: puedeEditar ? (requiereAutorizacion && permiteFotoAutorizacion) : (productoExistente?.permite_foto_autorizacion ?? false),
    };

    if (editando) await actualizarProducto(producto);
    else await agregarProducto(producto);
    setSeccionActual("inventario");
  };

  const campo = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:cursor-not-allowed transition-colors";
  const lotesRecientes = [...(productoExistente?.lotes ?? [])]
    .sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso))
    .slice(0, 4);

  return (
    <div className="w-full h-full flex flex-col p-5 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso
        abierto={Boolean(avisoGenerico)}
        titulo={avisoGenerico?.titulo ?? "Aviso"}
        mensaje={avisoGenerico?.mensaje ?? ""}
        tipo="advertencia"
        alCerrar={() => setAvisoGenerico(null)}
      />

      <ModalEscanerCodigo
        abierto={escanerCamaraAbierto}
        alCerrar={cerrarEscanerCamara}
        alDetectar={(codigoEscaneado) => {
          if (puedeEditar || puedeAjustarStock) setCodigo(codigoEscaneado);
        }}
      />
      <ModalCategoria
        abierto={modalCategoria}
        coloresUsados={categorias.map((item) => item.color)}
        alCerrar={() => setModalCategoria(false)}
        alGuardar={async (nombreCategoria, color) => {
          const creada = await agregarCategoria(nombreCategoria, color);
          if (creada) setCategoria(creada.nombre);
        }}
      />

      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            {editando ? <Pencil size={16} /> : <PackagePlus size={16} />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {editando ? "Editar Producto" : "Nuevo Producto"}
              {!puedeEditar && puedeAjustarStock && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] uppercase font-bold flex items-center gap-1"><Lock size={10} /> Solo Stock/Código</span>}
            </h1>
            <p className="text-xs text-slate-500">{editando ? "Modifica los datos del producto." : "Captura los datos para el inventario."}</p>
          </div>
        </div>
        <button type="button" onClick={() => setSeccionActual("inventario")} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={14} />
          Volver
        </button>
      </div>

      <form onSubmit={manejarGuardado} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SeccionInformacionProducto
            nombre={nombre}
            setNombre={setNombre}
            codigo={codigo}
            setCodigo={setCodigo}
            descripcion={descripcion}
            setDescripcion={setDescripcion}
            categoria={categoria}
            setCategoria={setCategoria}
            ubicacion={ubicacion}
            setUbicacion={setUbicacion}
            categorias={categorias}
            colorCategoria={colorCategoria}
            puedeEditar={puedeEditar}
            puedeEditarCodigo={puedeEditar || puedeAjustarStock}
            onGenerarCodigo={generarCodigo}
            onAbrirEscaner={() => setEscanerCamaraAbierto(true)}
            onAbrirCategorias={() => setModalCategoria(true)}
            campo={campo}
            requiereAutorizacion={requiereAutorizacion}
            setRequiereAutorizacion={setRequiereAutorizacion}
            mensajeAutorizacion={mensajeAutorizacion}
            setMensajeAutorizacion={setMensajeAutorizacion}
            permiteFotoAutorizacion={permiteFotoAutorizacion}
            setPermiteFotoAutorizacion={setPermiteFotoAutorizacion}
          />
          <SeccionInventarioProducto
            controlaStock={controlaStock}
            setControlaStock={setControlaStock}
            puedeEditar={puedeEditar}
            puedeAjustarStock={puedeAjustarStock}
            editando={editando}
            productoExistente={productoExistente}
            stockActual={stockActual}
            setStockActual={setStockActual}
            stockMinimo={stockMinimo}
            setStockMinimo={setStockMinimo}
            paquete={paquete}
            setPaquete={setPaquete}
            cantidadNuevoLote={cantidadNuevoLote}
            setCantidadNuevoLote={setCantidadNuevoLote}
            mostrarAyudaLotes={mostrarAyudaLotes}
            setMostrarAyudaLotes={setMostrarAyudaLotes}
            fechaCaducidadNuevoLote={fechaCaducidadNuevoLote}
            setFechaCaducidadNuevoLote={setFechaCaducidadNuevoLote}
            unidad={unidad}
            setUnidad={setUnidad}
            lotesRecientes={lotesRecientes}
            loteCaducidadEditando={loteCaducidadEditando}
            setLoteCaducidadEditando={setLoteCaducidadEditando}
            fechaCaducidadEditada={fechaCaducidadEditada}
            setFechaCaducidadEditada={setFechaCaducidadEditada}
            onGuardarCaducidadLote={(loteId) => void guardarCaducidadLote(loteId)}
            onAbrirLoteCaducidad={abrirLoteCaducidad}
            campo={campo}
          />
        </div>

        <div className="space-y-4">
          <SeccionImagenProducto
            puedeEditar={puedeEditar}
            esAndroid={esAndroid}
            previewImagen={previewImagen}
            inputArchivoRef={inputArchivoRef}
            inputCamaraRef={inputCamaraRef}
            inputGaleriaRef={inputGaleriaRef}
            onSeleccionarImagen={manejarSeleccionImagen}
            onRemoverImagen={removerImagen}
          />
          <SeccionPreciosEtiqueta
            puedeEditarPrecio={Boolean(puedeEditarPrecio)}
            precio={precio}
            setPrecio={setPrecio}
            costo={costo}
            setCosto={setCosto}
            descuento={descuento}
            setDescuento={setDescuento}
            precioFinal={precioFinal}
            margen={margen}
            unidad={unidad}
            previewCodigo={previewCodigo}
            nombre={nombre}
            codigo={codigo}
            editando={editando}
            puedeGuardar={Boolean(puedeEditar || puedeAjustarStock)}
            onGuardar={() => void manejarGuardado()}
            campo={campo}
          />
        </div>
      </form>
    </div>
  );
}
