// src/vistas/VistaInventario.tsx
import { useCallback, useMemo, useState } from "react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { Search, Plus, Edit, Trash2, Package, Barcode, FolderPlus, MapPin, ArrowUp, Camera, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../utilidades/utils";
import { precioVenta, type Producto } from "../tipos/producto";
import { colorConAlpha, colorTextoSobre, iconoCategoria } from "../utilidades/coloresCategoria";
import { useEscanerCodigoBarras } from "../hooks/useEscanerCodigoBarras";
import ModalCategoria from "../componentes/ui/ModalCategoria";
import ModalCodigoBarras from "../componentes/ui/ModalCodigoBarras";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import ModalEscanerCodigo from "../componentes/ui/ModalEscanerCodigo";
import ModalConfirmacion from "../componentes/ui/ModalConfirmacion";
import ModalDescripcionProducto from "../componentes/ui/ModalDescripcionProducto";
import ModalPrompt from "../componentes/ui/ModalPrompt";

export default function VistaInventario() {
  const { productos, categorias, eliminarProducto, actualizarProducto, agregarCategoria, eliminarCategoria } = useEstadoInventario();
  const { setSeccionActual } = useEstadoNavegacion();
  const { trabajadorActivo } = useEstadoTrabajadores();

  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(false);
  const [modalCategoria, setModalCategoria] = useState(false);
  const [productoEtiqueta, setProductoEtiqueta] = useState<Producto | null>(null);
  const [escanerCamaraAbierto, setEscanerCamaraAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState<{ abierto: boolean, titulo: string, mensaje: string, accion: () => void }>({ abierto: false, titulo: "", mensaje: "", accion: () => {} });
  
  // Modal estilizado para ajustar stock
  const [promptStock, setPromptStock] = useState<{ abierto: boolean; producto: Producto | null }>({ abierto: false, producto: null });
  
  // Estados para manejar los códigos escaneados
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  
  const cerrarEscanerCamara = useCallback(() => setEscanerCamaraAbierto(false), []);

  const alEscanear = useCallback((codigo: string) => {
    setBusqueda(codigo);
    setCategoriaActiva("todas");
    const encontrado = productos.find((p) => p.codigo_barras.trim() === codigo.trim());
    if (encontrado) {
      setProductoSeleccionado(encontrado);
    } else {
      setCodigoNoEncontrado(codigo);
    }
  }, [productos]);

  const aplicarCodigoCamara = useCallback((codigo: string) => {
    setEscanerCamaraAbierto(false);
    alEscanear(codigo);
  }, [alEscanear]);

  useEscanerCodigoBarras(alEscanear);

  // Permisos
  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  
  const puedeEditar = esDueño || esSupervisor || trabajadorActivo?.permisos?.editarProductos;
  const puedeEliminar = esDueño || esSupervisor || trabajadorActivo?.permisos?.eliminarProductos;
  const puedeAjustarStock = esDueño || esSupervisor || trabajadorActivo?.permisos?.actualizarStockCodigo;

  const conteoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of productos) {
      const clave = p.categoria?.trim();
      if (!clave) continue;
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }
    return mapa;
  }, [productos]);

  const conteoSinCategoria = useMemo(() => {
    return productos.filter(p => !p.categoria || p.categoria.trim() === "").length;
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return productos.filter((p) => {
      const coincideTexto =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.codigo_barras.toLowerCase().includes(q) ||
        (p.descripcion || "").toLowerCase().includes(q) ||
        (p.ubicacion || "").toLowerCase().includes(q);
      
      const coincideCategoria = 
        categoriaActiva === "todas" ? true 
        : categoriaActiva === "Sin categoría" ? (!p.categoria || p.categoria.trim() === "")
        : p.categoria === categoriaActiva;
        
      return coincideTexto && coincideCategoria;
    });
  }, [productos, busqueda, categoriaActiva]);

  const colorDe = (nombre?: string) => categorias.find((c) => c.nombre === nombre)?.color ?? "#64748b";

  const solicitarEliminarProducto = (producto: Producto) => {
    setConfirmacion({
      abierto: true,
      titulo: "Eliminar Producto",
      mensaje: `¿Estás seguro de que deseas eliminar "${producto.nombre}" del inventario de forma permanente?`,
      accion: () => eliminarProducto(producto.id)
    });
  };

  const solicitarEliminarCategoria = (categoria: { id: string; nombre: string }) => {
    setConfirmacion({
      abierto: true,
      titulo: "Eliminar Categoría",
      mensaje: `¿Eliminar la categoría "${categoria.nombre}"? Sus productos conservarán sus datos, pero quedarán sin categoría.`,
      accion: async () => {
        await eliminarCategoria(categoria.id);
        if (categoriaActiva === categoria.nombre) setCategoriaActiva("todas");
      }
    });
  };

  const confirmarAjusteStock = async (entrada: string) => {
    if (!promptStock.producto) return;
    const extra = Number(entrada);
    if (Number.isNaN(extra) || extra === 0) {
      setPromptStock({ abierto: false, producto: null });
      return;
    }
    await actualizarProducto({
      ...promptStock.producto,
      controla_stock: true,
      stock_actual: Math.max(0, promptStock.producto.stock_actual + extra),
    });
    setPromptStock({ abierto: false, producto: null });
  };

  return (
    <div className="w-full h-full flex flex-col p-5 animate-in fade-in duration-300">
      
      <ModalConfirmacion 
        abierto={confirmacion.abierto} 
        titulo={confirmacion.titulo} 
        mensaje={confirmacion.mensaje} 
        alConfirmar={confirmacion.accion} 
        alCerrar={() => setConfirmacion({ ...confirmacion, abierto: false })} 
      />

      {/* Modal estilizado para ajustar stock reemplazando el prompt nativo */}
      <ModalPrompt
        abierto={promptStock.abierto}
        titulo="Ajustar Stock"
        mensaje={promptStock.producto ? `Stock actual de "${promptStock.producto.nombre}": ${promptStock.producto.stock_actual}\nIngresa la cantidad que deseas sumar (puedes usar negativos para restar):` : ""}
        placeholder="Ej: 10"
        alConfirmar={confirmarAjusteStock}
        alCerrar={() => setPromptStock({ abierto: false, producto: null })}
      />

      <ModalCategoria
        abierto={modalCategoria}
        coloresUsados={categorias.map((c) => c.color)}
        alCerrar={() => setModalCategoria(false)}
        alGuardar={(nombre, color) => agregarCategoria(nombre, color)}
      />
      <ModalCodigoBarras producto={productoEtiqueta} alCerrar={() => setProductoEtiqueta(null)} />
      <ModalEscanerCodigo abierto={escanerCamaraAbierto} alCerrar={cerrarEscanerCamara} alDetectar={aplicarCodigoCamara} />
      
      <ModalDescripcionProducto
        abierto={Boolean(productoSeleccionado)}
        producto={productoSeleccionado}
        alCerrar={() => setProductoSeleccionado(null)}
        puedeEditar={puedeEditar}
        puedeEliminar={puedeEliminar}
        puedeAjustarStock={puedeAjustarStock}
        alEditar={() => {
          if (productoSeleccionado) setSeccionActual("nuevo-producto", productoSeleccionado.id);
          setProductoSeleccionado(null);
        }}
        alEliminar={() => {
          if (productoSeleccionado) solicitarEliminarProducto(productoSeleccionado);
          setProductoSeleccionado(null);
        }}
        alAjustarStock={() => {
          if (productoSeleccionado) setPromptStock({ abierto: true, producto: productoSeleccionado });
          setProductoSeleccionado(null);
        }}
        alVerCodigoBarras={() => {
          setProductoEtiqueta(productoSeleccionado);
        }}
      />

      {/* Modal Código No Encontrado */}
      {codigoNoEncontrado && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setCodigoNoEncontrado(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl dark:border-amber-800/40 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Camera size={22} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Código no encontrado</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No tenemos registrado el código <strong>{codigoNoEncontrado}</strong>. ¿Deseas agregarlo como un nuevo producto?</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setCodigoNoEncontrado(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 dark:border-white/10 dark:text-slate-300 transition-colors">Cancelar</button>
              <button type="button" onClick={() => {
                localStorage.setItem("codigo_producto_pendiente", codigoNoEncontrado);
                setCodigoNoEncontrado(null);
                setSeccionActual("nuevo-producto");
              }} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">Crear producto</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Package size={22} className="text-emerald-600" />
            Inventario
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
              {productos.length} Productos en total
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <button
              onClick={() => setModalCategoria(true)}
              className="h-9 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all hover:scale-105"
            >
              <FolderPlus size={16} />
              Categoría
            </button>
          )}
          {(puedeEditar || puedeAjustarStock) && (
            <button
              onClick={() => setSeccionActual("nuevo-producto")}
              className="h-9 px-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold shadow-md transition-all hover:scale-105"
            >
              <Plus size={16} />
              Nuevo Producto
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            data-escaner="true"
            placeholder="Buscar por nombre, código o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 pl-9 pr-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
        <button onClick={() => setEscanerCamaraAbierto(true)} title="Escanear con cámara" aria-label="Escanear con cámara" className="inline-flex w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 sm:w-auto sm:px-4 transition-colors">
          <Camera size={20} />
        </button>
      </div>

      <div className="flex items-start gap-2 mb-2">
        <div className={cn("flex gap-2 pb-2 transition-all flex-1", categoriasExpandidas ? "flex-wrap" : "overflow-x-auto scrollbar-hide")}>
          <button
            onClick={() => setCategoriaActiva("todas")}
            className={cn(
              "h-8 shrink-0 px-4 rounded-full text-xs font-bold border transition-colors shadow-sm",
              categoriaActiva === "todas"
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/15 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            Todas ({productos.length})
          </button>
          
          {conteoSinCategoria > 0 && (
            <button
              onClick={() => setCategoriaActiva("Sin categoría")}
              className={cn(
                "h-8 shrink-0 px-3 rounded-full text-xs font-bold border transition-colors shadow-sm",
                categoriaActiva === "Sin categoría"
                  ? "bg-slate-500 text-white border-slate-500"
                  : "bg-white text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/15 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              Sin categoría ({conteoSinCategoria})
            </button>
          )}

          {categorias.map((categoria) => {
            const activa = categoriaActiva === categoria.nombre;
            const Icono = iconoCategoria(categoria.nombre);
            const count = conteoPorCategoria.get(categoria.nombre) ?? 0;
            return (
              <div key={categoria.id} className="h-8 shrink-0 inline-flex items-center rounded-full border overflow-hidden bg-white dark:bg-slate-900/50 shadow-sm" style={{ borderColor: categoria.color }}>
                <button
                  onClick={() => setCategoriaActiva(categoria.nombre)}
                  className={cn("h-full px-3 text-xs font-bold inline-flex items-center gap-1.5 transition-colors", !puedeEliminar && "pr-4")}
                  style={{
                    backgroundColor: activa ? categoria.color : "transparent",
                    color: activa ? colorTextoSobre(categoria.color) : categoria.color,
                  }}
                >
                  <Icono size={13} />
                  {categoria.nombre} ({count})
                </button>
                {puedeEliminar && (
                  <button
                    onClick={() => solicitarEliminarCategoria(categoria)}
                    title={`Eliminar ${categoria.nombre}`}
                    className="h-full px-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 transition-colors"
                    style={{
                      backgroundColor: activa ? categoria.color : "transparent",
                    }}
                  >
                    <Trash2 size={13} style={{ color: activa ? colorTextoSobre(categoria.color) : undefined }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button 
          onClick={() => setCategoriasExpandidas(!categoriasExpandidas)}
          className="h-8 px-2 shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors"
          title={categoriasExpandidas ? "Contraer lista de categorías" : "Expandir todas las categorías"}
        >
          {categoriasExpandidas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      <div className="efecto-cristal rounded-2xl overflow-hidden flex-1 flex flex-col border border-slate-200/70 dark:border-white/10 shadow-sm">
        <div className="hidden overflow-auto flex-1 md:block">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/40 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3">Precio</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Unidad</th>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3">Ubicación</th>
                <th className="px-3 py-3">Paquete</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500 text-sm">
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((producto) => {
                  const color = colorDe(producto.categoria);
                  const final = precioVenta(producto);
                  const bajo = producto.controla_stock && producto.stock_actual <= producto.stock_minimo;
                  return (
                    <tr key={producto.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-900 dark:text-slate-100 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-9 w-9 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-white/10 bg-white" />
                          <span className="line-clamp-2">{producto.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-slate-500">{producto.codigo_barras}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">${final.toFixed(2)}</span>
                          {(producto.descuento_porcentaje || 0) > 0 && (
                            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-900/30 w-fit px-1.5 rounded">-{producto.descuento_porcentaje}% OFF</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {producto.controla_stock ? (
                          <span className={cn(
                            "inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm border",
                            bajo ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50" : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50"
                          )}>
                            {producto.stock_actual}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {producto.unidad}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {producto.categoria ? (
                          <span
                            className="inline-flex px-2 py-1 rounded-md text-[10px] font-bold tracking-wide"
                            style={{ backgroundColor: colorConAlpha(color, 0.12), color, border: `1px solid ${colorConAlpha(color, 0.3)}` }}
                          >
                            {producto.categoria}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {producto.ubicacion ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-medium">
                            <MapPin size={12} className="text-slate-400" />
                            {producto.ubicacion}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{producto.paquete || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {(puedeEditar || puedeAjustarStock) && (
                            <button title={puedeEditar ? "Editar" : "Ajustar Stock"} onClick={() => setSeccionActual("nuevo-producto", producto.id)} className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:text-slate-400 dark:hover:text-blue-400 transition-colors text-slate-500">
                              <Edit size={16} />
                            </button>
                          )}
                          <button title="Código de barras" onClick={() => setProductoEtiqueta(producto)} className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors text-slate-500">
                            <Barcode size={16} />
                          </button>
                          {(puedeEditar || puedeAjustarStock) && (
                            <button title="Agregar stock" onClick={() => setPromptStock({ abierto: true, producto })} className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors text-emerald-600">
                              <ArrowUp size={16} />
                            </button>
                          )}
                          {puedeEliminar && (
                            <button title="Eliminar" onClick={() => solicitarEliminarProducto(producto)} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:text-slate-400 dark:hover:text-red-400 transition-colors text-red-500">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Vista Móvil */}
        <div className="flex-1 space-y-3 overflow-y-auto p-3 md:hidden">
          {productosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No se encontraron productos.</p>
          ) : productosFiltrados.map((producto) => {
            const bajo = producto.controla_stock && producto.stock_actual <= producto.stock_minimo;
            const color = colorDe(producto.categoria);
            return (
              <article key={producto.id} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm p-4 dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-14 w-14 shrink-0 rounded-xl object-cover text-sm border border-slate-100 dark:border-white/5" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">{producto.nombre}</h2>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">{producto.codigo_barras}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${precioVenta(producto).toFixed(2)}</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{producto.unidad.substring(0,3)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn("rounded-lg px-2.5 py-1 text-[11px] font-black shadow-sm border", bajo ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>{producto.controla_stock ? producto.stock_actual : "∞"}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-white/10">
                  <span className="max-w-[55%] truncate rounded-md px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: colorConAlpha(color, 0.12), color, border: `1px solid ${colorConAlpha(color, 0.3)}` }}>{producto.categoria || "Sin asignar"}</span>
                  <div className="flex gap-1.5 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-100 dark:border-white/5">
                    {(puedeEditar || puedeAjustarStock) && (
                      <button title="Editar" onClick={() => setSeccionActual("nuevo-producto", producto.id)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:shadow-sm dark:hover:bg-slate-800"><Edit size={16} /></button>
                    )}
                    {(puedeEditar || puedeAjustarStock) && (
                      <button title="Agregar stock" onClick={() => setPromptStock({ abierto: true, producto })} className="rounded-lg p-2 text-emerald-600 hover:bg-white hover:shadow-sm dark:hover:bg-slate-800"><ArrowUp size={16} /></button>
                    )}
                    <button title="Código de barras" onClick={() => setProductoEtiqueta(producto)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:shadow-sm dark:hover:bg-slate-800"><Barcode size={16} /></button>
                    {puedeEliminar && (
                      <button title="Eliminar" onClick={() => solicitarEliminarProducto(producto)} className="rounded-lg p-2 text-red-500 hover:bg-white hover:shadow-sm dark:hover:bg-slate-800"><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}