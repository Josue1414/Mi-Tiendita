// src/vistas/VistaNuevoProducto.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Save, Info, ImagePlus, X, Printer, FolderPlus, Pencil, PackagePlus, ShieldCheck, Camera } from "lucide-react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
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
  const productoExistente = productos.find((p) => p.id === productoEditandoId);
  const editando = Boolean(productoExistente);

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
    setCodigo(codigoEscaneado);
  }, []);

  useEscanerCodigoBarras(alEscanearCodigo);

  const manejarSeleccionImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArchivoImagen(file);
      setPreviewImagen(URL.createObjectURL(file));
    }
  };

  const removerImagen = () => {
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
    if (archivoImagen) {
      try {
        imagenBase64 = await convertirABase64(archivoImagen);
      } catch {
        alert("Hubo un problema procesando la foto.");
        return;
      }
    } else if (!previewImagen) {
      imagenBase64 = undefined;
    }

    const producto: Producto = {
      id: productoExistente?.id ?? crypto.randomUUID(),
      nombre,
      codigo_barras: codigo,
      descripcion,
      categoria,
      ubicacion,
      paquete,
      controla_stock: controlaStock,
      stock_actual: controlaStock ? stockActual : 0,
      stock_minimo: controlaStock ? stockMinimo : 0,
      unidad,
      precio,
      costo,
      descuento_porcentaje: Math.max(0, Math.min(100, descuento)),
      activo: true,
      imagen_url: imagenBase64,
      requiere_autorizacion: requiereAutorizacion,
      mensaje_autorizacion: mensajeAutorizacion.trim(),
      permite_foto_autorizacion: requiereAutorizacion && permiteFotoAutorizacion,
    };

    if (editando) await actualizarProducto(producto);
    else await agregarProducto(producto);
    setSeccionActual("inventario");
  };

  const campo = "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm";

  return (
    <div className="w-full h-full flex flex-col p-5 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso abierto={Boolean(avisoCodigo)} titulo="Código de barras duplicado" mensaje={avisoCodigo ?? ""} tipo="advertencia" alCerrar={() => setAvisoCodigo(null)} />
      <ModalEscanerCodigo abierto={escanerCamaraAbierto} alCerrar={cerrarEscanerCamara} alDetectar={setCodigo} />
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
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editando ? "Editar Producto" : "Nuevo Producto"}</h1>
            <p className="text-xs text-slate-500">{editando ? "Modifica los datos del producto." : "Captura los datos para el inventario."}</p>
          </div>
        </div>
        <button onClick={() => setSeccionActual("inventario")} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
          <ArrowLeft size={14} />
          Volver
        </button>
      </div>

      <form onSubmit={manejarGuardado} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Información General</h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del producto *</label>
              <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej: Pasta blanca" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código de barras *</label>
              <div className="flex gap-2">
                <input type="text" required data-escaner="true" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={cn(campo, "flex-1 font-mono")} placeholder="Escanea o genera un código" />
                <select onChange={(evento) => generarCodigo(evento.target.value as "EAN13" | "CORTO" | "NUMERICO")} defaultValue="" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 sm:flex-none sm:px-2">
                  <option value="" disabled>Generar...</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="CORTO">Corto (5 dígitos)</option>
                  <option value="NUMERICO">Numérico (8 dígitos)</option>
                </select>
                <button type="button" onClick={() => setEscanerCamaraAbierto(true)} title="Escanear con cámara" aria-label="Escanear con cámara" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 dark:border-emerald-900/50 dark:text-emerald-300"><Camera size={14} /></button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={cn(campo, "resize-none")} placeholder="Ej: Pasta dental" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
                <div className="flex gap-2">
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={cn(campo, "flex-1")}>
                    <option value="">Seleccionar</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setModalCategoria(true)} className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0" title="Nueva categoría">
                    <FolderPlus size={14} />
                  </button>
                </div>
                {categoria && colorCategoria && (
                  <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: colorConAlpha(colorCategoria, 0.16), color: colorCategoria }}>
                    {categoria}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación en tienda</label>
                <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={campo} placeholder="Ej: Refrigerador 2" />
                <p className="text-[10px] text-slate-400 mt-1">Estante, pasillo o refrigerador.</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><ShieldCheck size={18} className="text-amber-600" /> Requiere autorización</span>
              <input type="checkbox" checked={requiereAutorizacion} onChange={(evento) => setRequiereAutorizacion(evento.target.checked)} className="h-4 w-4 accent-emerald-600" />
            </label>
            {requiereAutorizacion && (
              <>
                <input value={mensajeAutorizacion} onChange={(evento) => setMensajeAutorizacion(evento.target.value)} className={campo} placeholder="Ej: Requiere receta médica" />
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={permiteFotoAutorizacion} onChange={(evento) => setPermiteFotoAutorizacion(evento.target.checked)} className="h-4 w-4 accent-emerald-600" />
                  Permitir foto de receta o evidencia
                </label>
              </>
            )}
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Detalles de Inventario</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">Controlar stock</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={controlaStock} onChange={() => setControlaStock(!controlaStock)} />
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
                <input type="number" min="0" value={stockActual} onChange={(e) => setStockActual(Number(e.target.value))} className={campo} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Stock mínimo</label>
                <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(Number(e.target.value))} className={campo} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Paquete</label>
                <input type="text" value={paquete} onChange={(e) => setPaquete(e.target.value)} className={campo} placeholder="Ej: 1 kg" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de unidad</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value as Producto["unidad"])} className={campo}>
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
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Imagen</h2>
            <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={inputArchivoRef} onChange={manejarSeleccionImagen} />
            {previewImagen ? (
              <div className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group">
                <img src={previewImagen} alt="Vista previa" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                  <button type="button" onClick={removerImagen} className="p-1.5 bg-red-600 text-white rounded-full">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => inputArchivoRef.current?.click()} className="w-full h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-600 hover:border-emerald-500 text-xs">
                <ImagePlus size={18} />
                Subir foto
              </button>
            )}
          </div>

          <div className="bg-white/80 dark:bg-black/40 p-4 rounded-2xl flex flex-col gap-3 border border-slate-200 dark:border-white/10">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Precios</h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio de venta *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" step="0.01" required min="0.01" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} className={cn(campo, "pl-7 font-semibold")} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descuento (%)</label>
              <div className="relative">
                <input type="number" step="0.5" min="0" max="100" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))} className={cn(campo, "pr-8")} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
              </div>
            </div>
            {descuento > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-2">
                Precio final: <span className="font-bold">${precioFinal.toFixed(2)}</span>{" "}
                <span className="line-through opacity-60">${Number(precio).toFixed(2)}</span>
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Costo</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input type="number" step="0.01" min="0" value={costo} onChange={(e) => setCosto(Number(e.target.value))} className={cn(campo, "pl-7")} />
              </div>
            </div>
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
                  className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <Printer size={14} /> Imprimir etiqueta
                </button>
              </>
            ) : (
              <p className="text-xs text-slate-400">Genera o escribe un código para ver la etiqueta.</p>
            )}
          </div>

          <button type="submit" className="w-full h-10 inline-flex justify-center items-center gap-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-900 text-sm font-semibold">
            <Save size={16} />
            Guardar Producto
          </button>
        </div>
      </form>
    </div>
  );
}
