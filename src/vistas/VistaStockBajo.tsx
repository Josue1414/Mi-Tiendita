// src/vistas/VistaStockBajo.tsx
import { useEffect, useState } from "react";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { AlertTriangle, PackageOpen, ArrowUp, Layers, CalendarDays, Trash2, Clock3, Search, X, ChevronLeft, ChevronRight, ChevronDown, Pencil, Check } from "lucide-react";
import { cn } from "../utilidades/utils";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import { tieneAlertaStock } from "../utilidades/stock";
import ModalAjusteStock from "../componentes/ui/ModalAjusteStock";
import type { Producto } from "../tipos/producto";
import { ajustarLotes, DIAS_ALERTA_CADUCIDAD, estadoCaducidad } from "../utilidades/lotes";
import { useEstadoNavegacion } from "../estado/estadoNavegacion";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";

export default function VistaStockBajo() {
  const { productos, actualizarProducto } = useEstadoInventario();
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { loteCaducidadSeleccionadoId, limpiarLoteCaducidad } = useEstadoNavegacion();
  const { diasAlertaCaducidad, setDiasAlertaCaducidad } = useEstadoConfiguracion();

  const [pestana, setPestana] = useState<"stock" | "caducidad">("stock");
  const [busquedaCaducidad, setBusquedaCaducidad] = useState("");
  const [paginaCaducidad, setPaginaCaducidad] = useState(1);
  const [loteEditando, setLoteEditando] = useState<{ loteId: string; fecha: string } | null>(null);
  const [umbralEditando, setUmbralEditando] = useState<{ loteId: string; dias: string } | null>(null);
  const [umbralPredeterminadoEditando, setUmbralPredeterminadoEditando] = useState(false);
  const [umbralPredeterminadoInput, setUmbralPredeterminadoInput] = useState(String(diasAlertaCaducidad));
  const [guardandoUmbralPredeterminado, setGuardandoUmbralPredeterminado] = useState(false);
  const [errorUmbralPredeterminado, setErrorUmbralPredeterminado] = useState("");
  const [lotesExpandidos, setLotesExpandidos] = useState<Set<string>>(() => new Set());
  const [lotesColapsados, setLotesColapsados] = useState<Set<string>>(() => new Set());
  // Estado para controlar qué filtro está activo
  const [filtro, setFiltro] = useState<"todas" | "por-terminar" | "agotados">("todas");
  
  // Estado para el modal de ajustar stock
  const [promptStock, setPromptStock] = useState<{ abierto: boolean; producto: Producto | null }>({ abierto: false, producto: null });

  // Permisos
  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  
  const puedeEditar = esDueño || esSupervisor || trabajadorActivo?.permisos?.editarProductos;
  const puedeAjustarStock = esDueño || esSupervisor || trabajadorActivo?.permisos?.actualizarStockCodigo;
  const diasUmbralPredeterminado = Number(umbralPredeterminadoInput);

  // Clasificación de productos
  const productosBajos = productos.filter(tieneAlertaStock);
  const criticos = productosBajos.filter(p => p.stock_actual === 0);
  const porTerminar = productosBajos.filter(p => p.stock_actual > 0);

  // Aplicar el filtro seleccionado
  const productosFiltrados = 
    filtro === "todas" ? productosBajos : 
    filtro === "por-terminar" ? porTerminar : 
    criticos;

  // Lógica para procesar la entrada de ajuste de stock
  const confirmarAjusteStock = async (ajuste: number, fechaCaducidad?: string) => {
    if (!promptStock.producto) return;
    const producto = promptStock.producto;
    const ajusteAplicado = ajuste < 0 ? Math.max(ajuste, -producto.stock_actual) : ajuste;
    await actualizarProducto({
      ...producto,
      controla_stock: true,
      stock_actual: Math.max(0, producto.stock_actual + ajusteAplicado),
      lotes: ajustarLotes(producto.lotes, ajusteAplicado, {
        fechaCaducidad,
        agregadoPor: trabajadorActivo?.nombre ?? "Sistema",
        diasAlerta: diasAlertaCaducidad,
      }),
    });
    setPromptStock({ abierto: false, producto: null });
  };

  const lotesInventario = productos
    .flatMap((producto) => (producto.lotes ?? []).map((lote) => ({ producto, lote })))
    .sort((a, b) => {
      if (!a.lote.fecha_caducidad) return b.lote.fecha_caducidad ? 1 : 0;
      if (!b.lote.fecha_caducidad) return -1;
      return a.lote.fecha_caducidad.localeCompare(b.lote.fecha_caducidad);
    });

  const lotesConAlerta = lotesInventario.filter(
    ({ lote }) => lote.cantidad > 0 && estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta ?? DIAS_ALERTA_CADUCIDAD) !== null
  );
  const lotesProximos = lotesConAlerta.filter(
    ({ lote }) => estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta ?? DIAS_ALERTA_CADUCIDAD) === "proximo"
  );
  const lotesVencidos = lotesConAlerta.filter(
    ({ lote }) => estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta ?? DIAS_ALERTA_CADUCIDAD) === "vencido"
  );
  const busquedaEfectiva = loteCaducidadSeleccionadoId ?? busquedaCaducidad;
  const busquedaNormalizada = busquedaEfectiva.trim().toLocaleLowerCase();
  const lotesVisibles = busquedaNormalizada
    ? lotesInventario.filter(({ producto, lote }) =>
      [
        producto.nombre,
        producto.codigo_barras,
        lote.id,
        lote.fecha_caducidad,
        lote.fecha_ingreso,
        lote.agregado_por,
        lote.editado_por,
      ].some((valor) => valor?.toLocaleLowerCase().includes(busquedaNormalizada))
    )
    : lotesConAlerta;
  const totalPaginasCaducidad = Math.max(1, Math.ceil(lotesVisibles.length / 12));
  const paginaActualCaducidad = loteCaducidadSeleccionadoId ? 1 : paginaCaducidad;
  const pestanaActual = loteCaducidadSeleccionadoId ? "caducidad" : pestana;
  const lotesPagina = lotesVisibles.slice((paginaActualCaducidad - 1) * 12, paginaActualCaducidad * 12);

  useEffect(() => {
    if (pestanaActual !== "caducidad" || !loteCaducidadSeleccionadoId) return;
    document.getElementById(`lote-caducidad-${loteCaducidadSeleccionadoId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pestanaActual, busquedaEfectiva, paginaActualCaducidad, loteCaducidadSeleccionadoId]);

  const guardarUmbralPredeterminado = async () => {
    if (!Number.isInteger(diasUmbralPredeterminado) || diasUmbralPredeterminado < 1 || diasUmbralPredeterminado > 365) {
      setErrorUmbralPredeterminado("Ingresa un número entero entre 1 y 365 días.");
      return;
    }
    setGuardandoUmbralPredeterminado(true);
    setErrorUmbralPredeterminado("");
    try {
      await setDiasAlertaCaducidad(diasUmbralPredeterminado);
      setUmbralPredeterminadoEditando(false);
    } catch (error) {
      console.error("No se pudo guardar el umbral predeterminado de caducidad:", error);
      setErrorUmbralPredeterminado("No se pudo guardar el valor. Inténtalo de nuevo.");
    } finally {
      setGuardandoUmbralPredeterminado(false);
    }
  };

  const guardarCaducidadLote = async (producto: Producto, loteId: string, fecha: string) => {
    if (!puedeEditar) return;
    await actualizarProducto({
      ...producto,
      lotes: (producto.lotes ?? []).map((lote) =>
        lote.id === loteId
          ? { ...lote, fecha_caducidad: fecha || undefined, editado_por: trabajadorActivo?.nombre ?? "Sistema", fecha_edicion: new Date().toISOString() }
          : lote
      ),
    });
    setLoteEditando(null);
  };

  const guardarUmbralAlertaLote = async (producto: Producto, loteId: string, dias: string) => {
    if (!puedeEditar) return;
    const diasAlerta = Number(dias);
    if (!Number.isInteger(diasAlerta) || diasAlerta < 1 || diasAlerta > 365) return;
    await actualizarProducto({
      ...producto,
      lotes: (producto.lotes ?? []).map((lote) =>
        lote.id === loteId ? { ...lote, dias_alerta: diasAlerta } : lote
      ),
    });
    setUmbralEditando(null);
  };

  const retirarMerma = async (producto: Producto, loteId: string) => {
    if (!puedeAjustarStock) return;
    const lote = producto.lotes?.find((actual) => actual.id === loteId);
    if (!lote) return;
    await actualizarProducto({
      ...producto,
      stock_actual: Math.max(0, producto.stock_actual - lote.cantidad),
      lotes: (producto.lotes ?? []).filter((actual) => actual.id !== loteId),
    });
  };

  return (
    <div className="w-full h-full flex flex-col p-6 animate-in fade-in duration-300">
      {promptStock.abierto && promptStock.producto && (
        <ModalAjusteStock
          key={promptStock.producto.id}
          producto={promptStock.producto}
          alConfirmar={confirmarAjusteStock}
          alCerrar={() => setPromptStock({ abierto: false, producto: null })}
        />
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400">
              <AlertTriangle size={24} />
            </div>
            Alertas de Stock
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Productos que requieren reabastecimiento inmediato.
          </p>
        </div>

        <div role="tablist" aria-label="Monitoreo de inventario" className="flex w-full xl:w-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-900">
          <button 
            type="button"
            role="tab"
            aria-selected={pestanaActual === "stock"}
            onClick={() => {
              limpiarLoteCaducidad();
              setPestana("stock");
            }}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors xl:flex-none", pestanaActual === "stock" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}
          >
            <Layers size={16} /> Vista de Stock
            <span className="flex items-center gap-1" aria-label={`${criticos.length} alertas agotadas y ${porTerminar.length} alertas de stock bajo`}>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">{criticos.length > 99 ? "99+" : criticos.length}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm">{porTerminar.length > 99 ? "99+" : porTerminar.length}</span>
            </span>
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={pestanaActual === "caducidad"}
            onClick={() => setPestana("caducidad")}
            className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors xl:flex-none", pestanaActual === "caducidad" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}
          >
            <CalendarDays size={16} /> Fechas de Caducidad
            <span className="flex items-center gap-1" aria-label={`${lotesVencidos.length} alertas vencidas y ${lotesProximos.length} alertas próximas a vencer`}>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white shadow-sm">{lotesVencidos.length > 99 ? "99+" : lotesVencidos.length}</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm">{lotesProximos.length > 99 ? "99+" : lotesProximos.length}</span>
            </span>
          </button>
        </div>
      </div>

      {pestanaActual === "stock" ? (
      <>
      <div className="mb-4 flex flex-wrap gap-3">
        {([
          ["todas", "Todas las Alertas", productosBajos.length],
          ["por-terminar", "Por Terminar", porTerminar.length],
          ["agotados", "Agotados (Críticos)", criticos.length],
        ] as const).map(([valor, texto, total]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={cn(
              "flex min-w-28 flex-1 flex-col items-end rounded-xl border px-4 py-2.5 transition-all xl:flex-none",
              filtro === valor
                ? valor === "agotados" ? "border-red-700 bg-red-600 text-white shadow-lg" : valor === "por-terminar" ? "border-amber-600 bg-amber-500 text-white shadow-lg" : "border-slate-900 bg-slate-800 text-white shadow-lg dark:border-white dark:bg-slate-100 dark:text-slate-900"
                : valor === "agotados" ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20" : valor === "por-terminar" ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20" : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900/30"
            )}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider">{texto}</span>
            <span className="mt-0.5 text-2xl font-black">{total}</span>
          </button>
        ))}
      </div>
      <div className="efecto-cristal rounded-2xl overflow-hidden flex-1 flex flex-col border border-slate-200/50 dark:border-white/10">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/50 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="p-4">Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Nivel Actual</th>
                <th className="p-4">Mínimo Requerido</th>
                <th className="p-4 text-center">Estado</th>
                {(puedeEditar || puedeAjustarStock) && <th className="p-4 text-center">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50 dark:divide-white/10">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <PackageOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium">Todo en orden</p>
                    <p className="text-sm mt-1">No hay productos en esta categoría de alerta.</p>
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((producto) => {
                  const esCritico = producto.stock_actual === 0;
                  return (
                    <tr key={producto.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors text-slate-900 dark:text-slate-100">
                      <td className="p-4 font-medium">
                        <div className="flex items-center gap-3 text-left">
                          <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-10 w-10 shrink-0 rounded-lg object-cover text-sm" />
                          <span>{producto.nombre}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 text-sm">{producto.categoria || "Sin categoría"}</td>
                      <td className="p-4 font-bold text-lg">{producto.stock_actual} <span className="text-xs font-normal text-slate-400">{producto.unidad.toLowerCase()}</span></td>
                      <td className="p-4 text-slate-500">{producto.stock_minimo}</td>
                      <td className="p-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase",
                          esCritico 
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {esCritico ? "Agotado" : "Bajo"}
                        </span>
                      </td>
                      {(puedeEditar || puedeAjustarStock) && (
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setPromptStock({ abierto: true, producto })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold transition-colors"
                          >
                            <ArrowUp size={14} /> Ajustar Stock
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : (
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/50 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/30">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex min-w-36 items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <span className="text-xs font-bold uppercase">Próximos</span>
                <span className="text-xl font-black">{lotesProximos.length}</span>
              </div>
              <div className="flex min-w-36 items-center justify-between gap-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-purple-800 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-200">
                <span className="text-xs font-bold uppercase">Vencidos</span>
                <span className="text-xl font-black">{lotesVencidos.length}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  value={busquedaEfectiva}
                  onChange={(evento) => {
                    limpiarLoteCaducidad();
                    setBusquedaCaducidad(evento.target.value);
                    setPaginaCaducidad(1);
                  }}
                  placeholder="Buscar cualquier lote por producto, código o fecha..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  aria-label="Buscar lote de producto"
                />
                {busquedaCaducidad && (
                  <button
                    type="button"
                    onClick={() => {
                      limpiarLoteCaducidad();
                      setBusquedaCaducidad("");
                      setPaginaCaducidad(1);
                    }}
                    aria-label="Limpiar búsqueda de lotes"
                    className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <div className="flex flex-wrap items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Clock3 size={15} className="mt-0.5 shrink-0" />
                {umbralPredeterminadoEditando ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Alerta amarilla por defecto desde</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      value={umbralPredeterminadoInput}
                      onChange={(evento) => setUmbralPredeterminadoInput(evento.target.value)}
                      onKeyDown={(evento) => {
                        if (evento.key === "Enter") {
                          evento.preventDefault();
                          void guardarUmbralPredeterminado();
                        }
                      }}
                      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                      aria-label="Días antes para la alerta amarilla predeterminada"
                    />
                    <span>días antes; cada lote puede configurarse.</span>
                    <button
                      type="button"
                      disabled={guardandoUmbralPredeterminado || !Number.isInteger(diasUmbralPredeterminado) || diasUmbralPredeterminado < 1 || diasUmbralPredeterminado > 365}
                      onClick={() => void guardarUmbralPredeterminado()}
                      aria-label="Guardar días predeterminados de alerta amarilla"
                      className="rounded-md p-2.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUmbralPredeterminadoInput(String(diasAlertaCaducidad));
                        setUmbralPredeterminadoEditando(false);
                        setErrorUmbralPredeterminado("");
                      }}
                      aria-label="Cancelar edición de días predeterminados"
                      className="rounded-md p-2.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span>
                    Alerta amarilla desde {diasAlertaCaducidad} días antes por defecto; cada lote puede configurarse.
                    {puedeEditar && (
                      <button
                        type="button"
                        onClick={() => {
                          setUmbralPredeterminadoInput(String(diasAlertaCaducidad));
                          setErrorUmbralPredeterminado("");
                          setUmbralPredeterminadoEditando(true);
                        }}
                        aria-label="Configurar días predeterminados de alerta amarilla"
                        className="ml-1 inline-flex rounded-md p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </span>
                )}
                {errorUmbralPredeterminado && <span className="basis-full text-red-600 dark:text-red-400">{errorUmbralPredeterminado}</span>}
              </div>
            </div>
          </div>
          {lotesVisibles.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <PackageOpen size={44} className="mx-auto mb-3 opacity-25" />
              <p className="font-semibold">{busquedaNormalizada ? "No se encontraron lotes" : "No hay lotes con alertas de caducidad"}</p>
              <p className="mt-1 text-sm">{busquedaNormalizada ? "Prueba con otro nombre, código o fecha." : "Al agregar stock podrás registrar su fecha de caducidad."}</p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {lotesPagina.map(({ producto, lote }) => {
                const estado = estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta ?? DIAS_ALERTA_CADUCIDAD);
                const claveTarjeta = `${producto.id}-${lote.id}`;
                const estaExpandido = lotesExpandidos.has(claveTarjeta)
                  || (loteCaducidadSeleccionadoId === lote.id && !lotesColapsados.has(claveTarjeta));
                const estilo = estado === "vencido"
                  ? "border-purple-300 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/20"
                  : estado === "proximo"
                    ? "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
                return (
                  <article
                    id={`lote-caducidad-${lote.id}`}
                    key={`${producto.id}-${lote.id}`}
                    className={cn(
                      "rounded-xl border p-3 shadow-sm transition-shadow",
                      estilo,
                      lote.cantidad <= 0 && "opacity-60 grayscale",
                      loteCaducidadSeleccionadoId === lote.id && "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-950"
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={estaExpandido}
                      onClick={() => {
                        if (estaExpandido) {
                          setLotesExpandidos((actuales) => {
                            const siguientes = new Set(actuales);
                              siguientes.delete(claveTarjeta);
                            return siguientes;
                          });
                          if (loteCaducidadSeleccionadoId === lote.id) {
                              setLotesColapsados((actuales) => new Set(actuales).add(claveTarjeta));
                          }
                        } else {
                          setLotesColapsados((actuales) => {
                            const siguientes = new Set(actuales);
                              siguientes.delete(claveTarjeta);
                            return siguientes;
                          });
                            setLotesExpandidos((actuales) => new Set(actuales).add(claveTarjeta));
                        }
                      }}
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-slate-900 dark:text-slate-100">{producto.nombre}</span>
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{lote.cantidad} {producto.unidad.toLowerCase()} restantes · {lote.fecha_caducidad || "Sin fecha de caducidad"}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                          lote.cantidad <= 0 ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : estado === "vencido" ? "bg-purple-200 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200"
                            : estado === "proximo" ? "bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        )}>
                          {lote.cantidad <= 0 ? "Agotado" : estado === "vencido" ? "Vencido" : estado === "proximo" ? "Próximo a vencer" : "Vigente"}
                        </span>
                        <ChevronDown size={16} className={cn("shrink-0 transition-transform", estaExpandido && "rotate-180")} />
                      </span>
                    </button>
                    {estaExpandido && (
                    <>
                    <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200/70 pt-3 text-xs dark:border-white/10">
                      <div><dt className="text-slate-500">Fecha de ingreso</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{lote.fecha_ingreso}</dd></div>
                      <div>
                        <dt className="text-slate-500">Caducidad</dt>
                        {loteEditando?.loteId === lote.id ? (
                          <div className="mt-1 flex items-center gap-1">
                            <input type="date" value={loteEditando.fecha} onChange={(evento) => setLoteEditando({ ...loteEditando, fecha: evento.target.value })} className="min-w-0 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-white/10 dark:bg-slate-900" aria-label="Editar fecha de caducidad del lote" />
                            <button type="button" onClick={() => void guardarCaducidadLote(producto, lote.id, loteEditando.fecha)} aria-label="Guardar fecha de caducidad" className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"><Check size={14} /></button>
                            <button type="button" onClick={() => setLoteEditando(null)} aria-label="Cancelar edición de caducidad" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"><X size={14} /></button>
                          </div>
                        ) : (
                          <dd className="mt-0.5 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                            {lote.fecha_caducidad || "Sin fecha"}
                            {puedeEditar && (
                              <button type="button" onClick={() => setLoteEditando({ loteId: lote.id, fecha: lote.fecha_caducidad ?? "" })} aria-label="Editar fecha de caducidad" className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30">
                                <Pencil size={13} />
                              </button>
                            )}
                          </dd>
                        )}
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-500">Iniciar alerta amarilla</dt>
                        {umbralEditando?.loteId === lote.id ? (
                          <div className="mt-1 flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                              Avisar faltando
                              <input
                                type="number"
                                min="1"
                                max="365"
                                step="1"
                                value={umbralEditando.dias}
                                onChange={(evento) => setUmbralEditando({ ...umbralEditando, dias: evento.target.value })}
                                className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900"
                                aria-label="Días antes para iniciar alerta amarilla"
                              />
                              días
                            </label>
                            <button
                              type="button"
                              disabled={!Number.isInteger(Number(umbralEditando.dias)) || Number(umbralEditando.dias) < 1 || Number(umbralEditando.dias) > 365}
                              onClick={() => void guardarUmbralAlertaLote(producto, lote.id, umbralEditando.dias)}
                              aria-label="Guardar días de alerta amarilla"
                              className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setUmbralEditando(null)}
                              aria-label="Cancelar días de alerta amarilla"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <dd className="mt-0.5 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                            {lote.dias_alerta ?? DIAS_ALERTA_CADUCIDAD} días antes
                            {puedeEditar && (
                              <button
                                type="button"
                                onClick={() => setUmbralEditando({ loteId: lote.id, dias: String(lote.dias_alerta ?? DIAS_ALERTA_CADUCIDAD) })}
                                aria-label="Editar días de alerta amarilla"
                                className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                          </dd>
                        )}
                      </div>
                      <div className="col-span-2"><dt className="text-slate-500">Agregado por</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{lote.agregado_por}</dd></div>
                      <div className="col-span-2"><dt className="text-slate-500">Editado por</dt><dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-200">{lote.editado_por || "Sin correcciones"}</dd></div>
                    </dl>
                    {lote.cantidad > 0 && estado === "vencido" && puedeAjustarStock && (
                      <button
                        type="button"
                        onClick={() => void retirarMerma(producto, lote.id)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                      >
                        <Trash2 size={14} /> Retirar Merma
                      </button>
                    )}
                    </>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Página {paginaActualCaducidad} de {totalPaginasCaducidad} · {lotesVisibles.length} lotes</span>
              <div className="flex gap-2">
                <button type="button" disabled={paginaActualCaducidad <= 1} onClick={() => setPaginaCaducidad((pagina) => Math.max(1, pagina - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40 dark:border-white/10">
                  <ChevronLeft size={15} /> Anterior
                </button>
                <button type="button" disabled={paginaActualCaducidad >= totalPaginasCaducidad} onClick={() => setPaginaCaducidad((pagina) => Math.min(totalPaginasCaducidad, pagina + 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40 dark:border-white/10">
                  Siguiente <ChevronRight size={15} />
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}