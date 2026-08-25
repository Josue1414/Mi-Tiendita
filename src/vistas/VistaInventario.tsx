import { useCallback, useMemo, useState } from "react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { Search, Plus, Edit, Trash2, Package, Barcode, FolderPlus, MapPin, ArrowUp, Camera } from "lucide-react";
import { cn } from "../utilidades/utils";
import { precioVenta, type Producto } from "../tipos/producto";
import { colorConAlpha, colorTextoSobre, iconoCategoria } from "../utilidades/coloresCategoria";
import { useEscanerCodigoBarras } from "../hooks/useEscanerCodigoBarras";
import ModalCategoria from "../componentes/ui/ModalCategoria";
import ModalCodigoBarras from "../componentes/ui/ModalCodigoBarras";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import ModalEscanerCodigo from "../componentes/ui/ModalEscanerCodigo";
import ModalConfirmacion from "../componentes/ui/ModalConfirmacion";

export default function VistaInventario() {
  const { productos, categorias, eliminarProducto, actualizarProducto, agregarCategoria, eliminarCategoria } = useEstadoInventario();
  const { setSeccionActual } = useEstadoNavegacion();
  const { trabajadorActivo } = useEstadoTrabajadores();

  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [modalCategoria, setModalCategoria] = useState(false);
  const [productoEtiqueta, setProductoEtiqueta] = useState<Producto | null>(null);
  const [escanerCamaraAbierto, setEscanerCamaraAbierto] = useState(false);
  const [confirmacion, setConfirmacion] = useState<{ abierto: boolean, titulo: string, mensaje: string, accion: () => void }>({ abierto: false, titulo: "", mensaje: "", accion: () => {} });
  
  const cerrarEscanerCamara = useCallback(() => setEscanerCamaraAbierto(false), []);
  const aplicarCodigoCamara = useCallback((codigo: string) => { setBusqueda(codigo); setCategoriaActiva("todas"); }, []);

  const alEscanear = useCallback((codigo: string) => {
    setBusqueda(codigo);
    setCategoriaActiva("todas");
  }, []);

  useEscanerCodigoBarras(alEscanear);

  // Permisos
  const esDueño = trabajadorActivo?.rol === "DUEÑO";
  const puedeEditar = esDueño || trabajadorActivo?.permisos?.editarProductos;
  const puedeEliminar = esDueño || trabajadorActivo?.permisos?.eliminarProductos;
  const puedeAjustarStock = esDueño || trabajadorActivo?.permisos?.actualizarStockCodigo;

  const conteoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const p of productos) {
      const clave = p.categoria?.trim();
      if (!clave) continue;
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }
    return mapa;
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
      const coincideCategoria = categoriaActiva === "todas" || p.categoria === categoriaActiva;
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

  const ajustarStock = async (producto: Producto) => {
    const entrada = prompt(`Stock actual de "${producto.nombre}": ${producto.stock_actual}\n¿Cuántas unidades agregar?`, "1");
    if (entrada == null) return;
    const extra = Number(entrada);
    if (Number.isNaN(extra) || extra === 0) return;
    await actualizarProducto({
      ...producto,
      controla_stock: true,
      stock_actual: Math.max(0, producto.stock_actual + extra),
    });
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

      <ModalCategoria
        abierto={modalCategoria}
        coloresUsados={categorias.map((c) => c.color)}
        alCerrar={() => setModalCategoria(false)}
        alGuardar={(nombre, color) => agregarCategoria(nombre, color)}
      />
      <ModalCodigoBarras producto={productoEtiqueta} alCerrar={() => setProductoEtiqueta(null)} />
      <ModalEscanerCodigo abierto={escanerCamaraAbierto} alCerrar={cerrarEscanerCamara} alDetectar={aplicarCodigoCamara} />

      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Package size={22} className="text-emerald-600" />
            Inventario
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{productos.length} productos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <button
              onClick={() => setModalCategoria(true)}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <FolderPlus size={14} />
              Categoría
            </button>
          )}
          {(puedeEditar || puedeAjustarStock) && (
            <button
              onClick={() => setSeccionActual("nuevo-producto")}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold"
            >
              <Plus size={14} />
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
            className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 pl-9 pr-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
        <button onClick={() => setEscanerCamaraAbierto(true)} title="Escanear con cámara" aria-label="Escanear con cámara" className="inline-flex w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 sm:w-auto sm:px-3">
          <Camera size={18} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-1 scrollbar-hide">
        <button
          onClick={() => setCategoriaActiva("todas")}
          className={cn(
            "h-8 shrink-0 px-3 rounded-full text-xs font-semibold border",
            categoriaActiva === "todas"
              ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
              : "bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/15"
          )}
        >
          Todas
        </button>
        {categorias.map((categoria) => {
          const activa = categoriaActiva === categoria.nombre;
          const Icono = iconoCategoria(categoria.nombre);
          const count = conteoPorCategoria.get(categoria.nombre) ?? 0;
          return (
            <div key={categoria.id} className="h-8 shrink-0 inline-flex items-center rounded-full border overflow-hidden" style={{ borderColor: categoria.color }}>
              <button
                onClick={() => setCategoriaActiva(categoria.nombre)}
                className={cn("h-full px-3 text-xs font-semibold inline-flex items-center gap-1.5", !puedeEliminar && "pr-4")}
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
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="efecto-cristal rounded-2xl overflow-hidden flex-1 flex flex-col border border-slate-200/70 dark:border-white/10">
        <div className="hidden overflow-auto flex-1 md:block">
          <table className="w-full text-left border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/40 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Producto</th>
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Precio</th>
                <th className="px-3 py-2.5">Stock</th>
                <th className="px-3 py-2.5">Unidad</th>
                <th className="px-3 py-2.5">Categoría</th>
                <th className="px-3 py-2.5">Ubicación</th>
                <th className="px-3 py-2.5">Paquete</th>
                <th className="px-3 py-2.5 text-center">Acciones</th>
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
                    <tr key={producto.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 text-slate-900 dark:text-slate-100">
                      <td className="px-3 py-2.5 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-8 w-8 shrink-0 rounded-md object-cover text-xs" />
                          <span>{producto.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{producto.codigo_barras}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">${final.toFixed(2)}</span>
                          {(producto.descuento_porcentaje || 0) > 0 && (
                            <span className="text-[10px] text-amber-600 font-semibold">-{producto.descuento_porcentaje}%</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {producto.controla_stock ? (
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold",
                            bajo ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}>
                            {producto.stock_actual}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {producto.unidad}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {producto.categoria ? (
                          <span
                            className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ backgroundColor: colorConAlpha(color, 0.16), color }}
                          >
                            {producto.categoria}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {producto.ubicacion ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            {producto.ubicacion}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{producto.paquete || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-0.5">
                          {(puedeEditar || puedeAjustarStock) && (
                            <button title={puedeEditar ? "Editar" : "Ajustar Stock"} onClick={() => setSeccionActual("nuevo-producto", producto.id)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                              <Edit size={14} />
                            </button>
                          )}
                          <button title="Código de barras" onClick={() => setProductoEtiqueta(producto)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                            <Barcode size={14} />
                          </button>
                          {(puedeEditar || puedeAjustarStock) && (
                            <button title="Agregar stock" onClick={() => ajustarStock(producto)} className="p-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600">
                              <ArrowUp size={14} />
                            </button>
                          )}
                          {puedeEliminar && (
                            <button title="Eliminar" onClick={() => solicitarEliminarProducto(producto)} className="p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500">
                              <Trash2 size={14} />
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
        <div className="flex-1 space-y-2 overflow-y-auto p-3 md:hidden">
          {productosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No se encontraron productos.</p>
          ) : productosFiltrados.map((producto) => {
            const bajo = producto.controla_stock && producto.stock_actual <= producto.stock_minimo;
            const color = colorDe(producto.categoria);
            return (
              <article key={producto.id} className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-12 w-12 shrink-0 rounded-lg object-cover text-sm" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{producto.nombre}</h2>
                    <p className="truncate font-mono text-[10px] text-slate-500">{producto.codigo_barras}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-600">${precioVenta(producto).toFixed(2)} · {producto.unidad.toLowerCase()}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", bajo ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>{producto.controla_stock ? producto.stock_actual : "∞"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="max-w-[55%] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: colorConAlpha(color, 0.16), color }}>{producto.categoria || "Sin categoría"}</span>
                  <div className="flex gap-1">
                    {(puedeEditar || puedeAjustarStock) && (
                      <button title="Editar" onClick={() => setSeccionActual("nuevo-producto", producto.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit size={14} /></button>
                    )}
                    {(puedeEditar || puedeAjustarStock) && (
                      <button title="Agregar stock" onClick={() => ajustarStock(producto)} className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"><ArrowUp size={14} /></button>
                    )}
                    <button title="Código de barras" onClick={() => setProductoEtiqueta(producto)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Barcode size={14} /></button>
                    {puedeEliminar && (
                      <button title="Eliminar" onClick={() => solicitarEliminarProducto(producto)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 size={14} /></button>
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