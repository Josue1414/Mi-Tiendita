import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save, Info, ImagePlus, X, Printer, FolderPlus, Pencil, PackagePlus, ShieldCheck, Camera, Lock } from "lucide-react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { precioVenta, type Producto } from "../tipos/producto";
import { cn } from "../utilidades/utils";
import { generarCodigoCorto, generarCodigoEAN13, generarCodigoNumerico, imprimirEtiqueta, svgCodigoBarras } from "../utilidades/codigoBarras";
import { colorConAlpha } from "../utilidades/coloresCategoria";
import ModalCategoria from "../componentes/ui/ModalCategoria";
import ModalAviso from "../componentes/ui/ModalAviso";
import { useEscanerCodigoBarras } from "../hooks/useEscanerCodigoBarras";
import ModalEscanerCodigo from "../componentes/ui/ModalEscanerCodigo";

export default function VistaNuevoProducto() {
  const { productos, categorias, agregarProducto, actualizarProducto, agregarCategoria } = useEstadoInventario();
  const { setSeccionActual, productoEditandoId } = useEstadoNavegacion();
  const { trabajadorActivo } = useEstadoTrabajadores();
  
  const productoExistente = productos.find((p) => p.id === productoEditandoId);
  const editando = Boolean(productoExistente);

  // Permisos
  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  
  const puedeEditar = esDueño || esSupervisor || trabajadorActivo?.permisos?.editarProductos;
  const puedeAjustarStock = esDueño || esSupervisor || trabajadorActivo?.permisos?.actualizarStockCodigo;
  
  // Permiso específico: Si es supervisor, necesita el checkbox de "cambiarPrecios". El Dueño siempre puede.
  const puedeEditarPrecio = esDueño || (esSupervisor && trabajadorActivo?.permisos?.cambiarPrecios) || (trabajadorActivo?.rol === "TRABAJADOR" && trabajadorActivo?.permisos?.editarProductos);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [paquete, setPaquete] = useState("");
  const [controlaStock, setControlaStock] = useState<boolean>(true);
  const [stockActual, setStockActual] = useState<number>(0);
  const [stockMinimo, setStockMinimo] = useState<number>(5);
  const [unidad, setUnidad] = useState<Producto["unidad"]>("PIEZA");
  const [precio, setPrecio] = useState<number>(0);
  const [costo, setCosto] = useState<number>(0);
  const [descuento, setDescuento] = useState<number>(0);
  const [requiereAutorizacion, setRequiereAutorizacion] = useState(false);
  const [mensajeAutorizacion, setMensajeAutorizacion] = useState("Se requiere receta o autorización para vender este producto.");
  const [permiteFotoAutorizacion, setPermiteFotoAutorizacion] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [previewImagen, setPreviewImagen] = useState<string | null>(null);
  const [avisoCodigo, setAvisoCodigo] = useState<string | null>(null);
  const [escanerCamaraAbierto, setEscanerCamaraAbierto] = useState(false);
  
  const cerrarEscanerCamara = useCallback(() => setEscanerCamaraAbierto(false), []);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

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
    setStockMinimo(productoExistente.stock_minimo);
    setUnidad(productoExistente.unidad);
    setPrecio(productoExistente.precio);
    setCosto(productoExistente.costo);
    setDescuento(productoExistente.descuento_porcentaje || 0);
    setRequiereAutorizacion(productoExistente.requiere_autorizacion ?? false);
    setMensajeAutorizacion(productoExistente.mensaje_autorizacion || "Se requiere receta o autorización para vender este producto.");
    setPermiteFotoAutorizacion(productoExistente.permite_foto_autorizacion ?? false);
    setPreviewImagen(productoExistente.imagen_url || null);
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
  const colorCategoria = categorias.find((c) => c.nombre === categoria)?.color;

  const alEscanearCodigo = useCallback((codigoEscaneado: string) => {
    if (puedeEditar || puedeAjustarStock) setCodigo(codigoEscaneado);
  }, [puedeEditar, puedeAjustarStock]);

  useEscanerCodigoBarras(alEscanearCodigo);

  const manejarSeleccionImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!puedeEditar) return;
    const file = e.target.files?.[0];
    if (file) {
      setArchivoImagen(file);
      setPreviewImagen(URL.createObjectURL(file));
    }
  };

  const removerImagen = () => {
    if (!puedeEditar) return;
    setArchivoImagen(null);
    setPreviewImagen(null);
    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  };

  const convertirABase64 = (archivo: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(archivo);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const manejarGuardado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEditar && !puedeAjustarStock) return;

    if (!nombre || !codigo || precio <= 0) {
      alert("Completa el nombre, el código y un precio mayor a 0.");
      return;
    }
    const codigoExistente = productos.find((producto) => producto.codigo_barras.trim() === codigo.trim() && producto.id !== productoExistente?.id);
    if (codigoExistente) {
      setAvisoCodigo(`El código ${codigo} ya pertenece a "${codigoExistente.nombre}". Usa otro código o edita ese producto para cambiarlo.`);
      return;
    }

    let imagenBase64 = productoExistente?.imagen_url;
    if (archivoImagen && puedeEditar) {
      try {
        imagenBase64 = await convertirABase64(archivoImagen);
      } catch {
        alert("Hubo un problema procesando la foto.");
        return;
      }
    } else if (!previewImagen && puedeEditar) {
      imagenBase64 = undefined;
    }

    const producto: Producto = {
      id: productoExistente?.id ?? crypto.randomUUID(),
      nombre: puedeEditar ? nombre : productoExistente?.nombre || "",
      codigo_barras: codigo,
      descripcion: puedeEditar ? descripcion : productoExistente?.descripcion || "",
      categoria: puedeEditar ? categoria : productoExistente?.categoria || "",
      ubicacion: puedeEditar ? ubicacion : productoExistente?.ubicacion || "",
      paquete: puedeEditar ? paquete : productoExistente?.paquete || "",
      controla_stock: puedeEditar ? controlaStock : (productoExistente?.controla_stock ?? true),
      stock_actual: stockActual,
      stock_minimo: puedeEditar ? stockMinimo : (productoExistente?.stock_minimo ?? 5),
      unidad: puedeEditar ? unidad : (productoExistente?.unidad || "PIEZA"),
      precio: puedeEditarPrecio ? precio : (productoExistente?.precio ?? 0),
      costo: puedeEditarPrecio ? costo : (productoExistente?.costo ?? 0),
      descuento_porcentaje: puedeEditarPrecio ? Math.max(0, Math.min(100, descuento)) : (productoExistente?.descuento_porcentaje ?? 0),
      activo: true,
      imagen_url: imagenBase64,
      requiere_autorizacion: puedeEditar ? requiereAutorizacion : (productoExistente?.requiere_autorizacion ?? false),
      mensaje_autorizacion: puedeEditar ? mensajeAutorizacion.trim() : (productoExistente?.mensaje_autorizacion || ""),
      permite_foto_autorizacion: puedeEditar ? (requiereAutorizacion && permiteFotoAutorizacion) : (productoExistente?.permite_foto_autorizacion ?? false),
    };

    if (editando) await actualizarProducto(producto);
    else await agregarProducto(producto);
    setSeccionActual("inventario");
  };

  const campo = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="w-full h-full flex flex-col p-5 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso abierto={Boolean(avisoCodigo)} titulo="Código de barras duplicado" mensaje={avisoCodigo ?? ""} tipo="advertencia" alCerrar={() => setAvisoCodigo(null)} />
      <ModalEscanerCodigo abierto={escanerCamaraAbierto} alCerrar={cerrarEscanerCamara} alDetectar={(cod) => { if(puedeEditar || puedeAjustarStock) setCodigo(cod); }} />
      <ModalCategoria
        abierto={modalCategoria}
        coloresUsados={categorias.map((c) => c.color)}
        alCerrar={() => setModalCategoria(false)}
        alGuardar={async (nombreCat, color) => {
          const creada = await agregarCategoria(nombreCat, color);
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
        <button onClick={() => setSeccionActual("inventario")} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={14} />
          Volver
        </button>
      </div>

      <form onSubmit={manejarGuardado} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex justify-between items-center">
              Información General
              {!puedeEditar && <Lock size={14} className="text-slate-400" />}
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del producto *</label>
              <input type="text" required disabled={!puedeEditar} value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej: Pasta blanca" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código de barras *</label>
              <div className="flex gap-2">
                <input type="text" required disabled={!puedeEditar && !puedeAjustarStock} data-escaner="true" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={cn(campo, "flex-1 font-mono")} placeholder="Escanea o genera un código" />
                <select disabled={!puedeEditar && !puedeAjustarStock} onChange={(evento) => generarCodigo(evento.target.value as "EAN13" | "CORTO" | "NUMERICO")} defaultValue="" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-950 sm:flex-none sm:px-2">
                  <option value="" disabled>Generar...</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="CORTO">Corto (5 dígitos)</option>
                  <option value="NUMERICO">Numérico (8 dígitos)</option>
                </select>
                <button type="button" disabled={!puedeEditar && !puedeAjustarStock} onClick={() => setEscanerCamaraAbierto(true)} title="Escanear con cámara" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"><Camera size={14} /></button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <textarea disabled={!puedeEditar} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={cn(campo, "resize-none")} placeholder="Ej: Pasta dental" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                <div className="flex gap-2">
                  <select disabled={!puedeEditar} value={categoria} onChange={(e) => setCategoria(e.target.value)} className={cn(campo, "flex-1")}>
                    <option value="">Seleccionar</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                  {puedeEditar && (
                    <button type="button" onClick={() => setModalCategoria(true)} className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800" title="Nueva categoría">
                      <FolderPlus size={14} />
                    </button>
                  )}
                </div>
                {categoria && colorCategoria && (
                  <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: colorConAlpha(colorCategoria, 0.16), color: colorCategoria }}>
                    {categoria}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación en tienda</label>
                <input type="text" disabled={!puedeEditar} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={campo} placeholder="Ej: Refrigerador 2" />
                <p className="text-[10px] text-slate-400 mt-1">Estante, pasillo o refrigerador.</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <ShieldCheck size={18} className="text-amber-600" /> Requiere autorización
                {!puedeEditar && <Lock size={14} className="text-slate-400" />}
              </span>
              <input type="checkbox" disabled={!puedeEditar} checked={requiereAutorizacion} onChange={(evento) => setRequiereAutorizacion(evento.target.checked)} className="h-4 w-4 accent-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed" />
            </label>
            {requiereAutorizacion && (
              <>
                <input disabled={!puedeEditar} value={mensajeAutorizacion} onChange={(evento) => setMensajeAutorizacion(evento.target.value)} className={campo} placeholder="Ej: Requiere receta médica" />
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" disabled={!puedeEditar} checked={permiteFotoAutorizacion} onChange={(evento) => setPermiteFotoAutorizacion(evento.target.checked)} className="h-4 w-4 accent-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed" />
                  Permitir foto de receta o evidencia
                </label>
              </>
            )}
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Detalles de Inventario
              </h2>
              <label className={cn("flex items-center gap-2", puedeEditar ? "cursor-pointer" : "cursor-not-allowed opacity-70")}>
                <span className="text-xs text-slate-500">Controlar stock</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only" disabled={!puedeEditar} checked={controlaStock} onChange={() => setControlaStock(!controlaStock)} />
                  <div className={cn("block w-9 h-5 rounded-full", controlaStock ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")} />
                  <div className={cn("absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform", controlaStock ? "translate-x-4" : "")} />
                </div>
              </label>
            </div>

            {!controlaStock && (
              <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs">
                <Info size={14} className="shrink-0 mt-0.5" />
                No descuenta existencias al venderse.
              </div>
            )}

            <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", !controlaStock && "opacity-50 pointer-events-none")}>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad en stock</label>
                <input type="number" min="0" disabled={!puedeEditar && !puedeAjustarStock} placeholder="0" value={stockActual === 0 ? "" : stockActual} onChange={(e) => setStockActual(e.target.value ? Number(e.target.value) : 0)} className={campo} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">Stock mínimo {!puedeEditar && <Lock size={10} className="text-slate-400" />}</label>
                <input type="number" min="0" disabled={!puedeEditar} placeholder="0" value={stockMinimo === 0 ? "" : stockMinimo} onChange={(e) => setStockMinimo(e.target.value ? Number(e.target.value) : 0)} className={campo} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">Paquete {!puedeEditar && <Lock size={10} className="text-slate-400" />}</label>
                <input type="text" disabled={!puedeEditar} value={paquete} onChange={(e) => setPaquete(e.target.value)} className={campo} placeholder="Ej: 1 kg" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex justify-between">Tipo de unidad {!puedeEditar && <Lock size={12} className="text-slate-400" />}</label>
              <select disabled={!puedeEditar} value={unidad} onChange={(e) => setUnidad(e.target.value as Producto["unidad"])} className={campo}>
                <option value="PIEZA">Pieza</option>
                <option value="KG">Kilogramos</option>
                <option value="LITRO">Litros</option>
                <option value="PAQUETE">Paquete</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex justify-between items-center">
              Imagen {!puedeEditar && <Lock size={14} className="text-slate-400" />}
            </h2>
            <input type="file" disabled={!puedeEditar} accept="image/png, image/jpeg, image/webp" className="hidden" ref={inputArchivoRef} onChange={manejarSeleccionImagen} />
            {previewImagen ? (
              <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group">
                <img src={previewImagen} alt="Vista previa" className="w-full h-full object-cover" />
                {puedeEditar && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button type="button" onClick={removerImagen} className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" disabled={!puedeEditar} onClick={() => inputArchivoRef.current?.click()} className="w-full h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-xs transition-colors disabled:hover:bg-transparent disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:hover:text-slate-400 disabled:cursor-not-allowed">
                <ImagePlus size={18} />
                Subir foto
              </button>
            )}
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex justify-between items-center">
              Precios {!puedeEditarPrecio && <Lock size={14} className="text-slate-400" />}
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio de venta *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" disabled={!puedeEditarPrecio} step="0.01" required min="0.01" placeholder="0.00" value={precio === 0 ? "" : precio} onChange={(e) => setPrecio(e.target.value ? Number(e.target.value) : 0)} className={cn(campo, "pl-7 font-semibold")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Costo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" disabled={!puedeEditarPrecio} step="0.01" min="0" placeholder="0.00" value={costo === 0 ? "" : costo} onChange={(e) => setCosto(e.target.value ? Number(e.target.value) : 0)} className={cn(campo, "pl-7")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descuento (%)</label>
              <div className="relative">
                <input type="number" disabled={!puedeEditarPrecio} step="0.5" min="0" max="100" placeholder="0" value={descuento === 0 ? "" : descuento} onChange={(e) => setDescuento(e.target.value ? Number(e.target.value) : 0)} className={cn(campo, "pr-8")} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>
            {descuento > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-2">
                Precio final: <span className="font-bold">${precioFinal.toFixed(2)}</span>{" "}
                <span className="line-through opacity-60">${Number(precio).toFixed(2)}</span>
              </p>
            )}
            
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-500">
              Margen de ganancia: <span className="font-bold text-emerald-600">{margen > 0 ? `${margen.toFixed(1)}%` : "—"}</span>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-2 border border-slate-200 dark:border-white/10">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Vista previa del código</h2>
            {previewCodigo ? (
              <>
                <div className="bg-white rounded-lg p-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: previewCodigo }} />
                <p className="text-[10px] text-center text-slate-400">{unidad} — {unidad.toLowerCase()}(s)</p>
                <button
                  type="button"
                  onClick={() => imprimirEtiqueta({ nombre: nombre || "Producto", codigo, precio: precioFinal })}
                  className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                >
                  <Printer size={14} /> Imprimir etiqueta
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Genera o escribe un código para ver la etiqueta.</p>
            )}
          </div>

          <button type="submit" disabled={!puedeEditar && !puedeAjustarStock} className="w-full h-10 inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Save size={16} />
            {editando ? "Guardar Cambios" : "Guardar Producto"}
          </button>
        </div>
      </form>
    </div>
  );
}