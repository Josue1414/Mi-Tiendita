// src/componentes/PanelAutorizaciones.tsx
import { useState } from "react";
import { ChevronLeft, ChevronRight, ShieldCheck, History, Package } from "lucide-react";
import type { Producto } from "../tipos/producto";
import type { Venta } from "../estado/estadoVentas";

const ELEMENTOS_POR_PAGINA = 8;

interface PropsPanelAutorizaciones {
  productos: Producto[];
  ventas: Venta[];
}

export default function PanelAutorizaciones({ productos, ventas }: PropsPanelAutorizaciones) {
  const [paginaProductos, setPaginaProductos] = useState(1);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const productosRestringidos = productos.filter((producto) => producto.requiere_autorizacion);
  const ventasAutorizadas = ventas.flatMap((venta) =>
    venta.articulos
      .filter((articulo) => articulo.autorizacion_confirmada)
      .map((articulo) => ({ venta, articulo }))
  );
  const totalPaginasProductos = Math.max(1, Math.ceil(productosRestringidos.length / ELEMENTOS_POR_PAGINA));
  const paginaProductosActual = Math.min(paginaProductos, totalPaginasProductos);
  const productosRestringidosPagina = productosRestringidos.slice(
    (paginaProductosActual - 1) * ELEMENTOS_POR_PAGINA,
    paginaProductosActual * ELEMENTOS_POR_PAGINA
  );
  const totalPaginasHistorial = Math.max(1, Math.ceil(ventasAutorizadas.length / ELEMENTOS_POR_PAGINA));
  const paginaHistorialActual = Math.min(paginaHistorial, totalPaginasHistorial);
  const ventasAutorizadasPagina = ventasAutorizadas.slice(
    (paginaHistorialActual - 1) * ELEMENTOS_POR_PAGINA,
    paginaHistorialActual * ELEMENTOS_POR_PAGINA
  );

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="efecto-cristal rounded-2xl border border-amber-200/70 p-5 dark:border-amber-900/40">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <ShieldCheck size={19} className="text-amber-600" /> Productos con autorización
        </h2>
        {productosRestringidos.length === 0 ? <p className="text-sm text-slate-500">No hay productos restringidos.</p> : (
          <div className="space-y-2">
            {productosRestringidosPagina.map((producto) => (
              <div key={producto.id} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                <Package size={15} className="shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-800 dark:text-slate-200">{producto.nombre}</p>
                  <p className="break-words text-[10px] text-amber-700 dark:text-amber-300">{producto.mensaje_autorizacion || "Autorización"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPaginasProductos > 1 && (
          <div className="mt-3 flex items-center justify-between border-t border-amber-200/70 pt-3 dark:border-amber-900/40">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {(paginaProductosActual - 1) * ELEMENTOS_POR_PAGINA + 1}-
              {Math.min(paginaProductosActual * ELEMENTOS_POR_PAGINA, productosRestringidos.length)} de {productosRestringidos.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaginaProductos(Math.max(1, paginaProductosActual - 1))}
                disabled={paginaProductosActual === 1}
                aria-label="Página anterior de productos con autorización"
                className="rounded-md p-1.5 text-slate-600 hover:bg-amber-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-amber-900/40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {paginaProductosActual} / {totalPaginasProductos}
              </span>
              <button
                type="button"
                onClick={() => setPaginaProductos(Math.min(totalPaginasProductos, paginaProductosActual + 1))}
                disabled={paginaProductosActual === totalPaginasProductos}
                aria-label="Página siguiente de productos con autorización"
                className="rounded-md p-1.5 text-slate-600 hover:bg-amber-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-amber-900/40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="efecto-cristal rounded-2xl border border-emerald-200/70 p-5 dark:border-emerald-900/40">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <History size={19} className="text-emerald-600" /> Historial de autorizaciones
        </h2>
        {ventasAutorizadas.length === 0 ? <p className="text-sm text-slate-500">Aún no hay ventas autorizadas.</p> : (
          <div className="space-y-2">
            {ventasAutorizadasPagina.map(({ venta, articulo }, indice) => (
              <div key={`${venta.id}-${articulo.id || articulo.producto_id || articulo.nombre}-${indice}`} className="flex items-start justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
                <div className="min-w-0">
                  <p className="break-words font-medium text-slate-800 dark:text-slate-200">{articulo.nombre}</p>
                  <p className="text-[10px] text-slate-500">Vendedor: {venta.trabajador} · {new Date(venta.fecha).toLocaleDateString("es-MX")}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-emerald-600">${articulo.subtotal.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">Cantidad: {articulo.cantidad}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPaginasHistorial > 1 && (
          <div className="mt-3 flex items-center justify-between border-t border-emerald-200/70 pt-3 dark:border-emerald-900/40">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {(paginaHistorialActual - 1) * ELEMENTOS_POR_PAGINA + 1}-
              {Math.min(paginaHistorialActual * ELEMENTOS_POR_PAGINA, ventasAutorizadas.length)} de {ventasAutorizadas.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaginaHistorial(Math.max(1, paginaHistorialActual - 1))}
                disabled={paginaHistorialActual === 1}
                aria-label="Página anterior del historial de autorizaciones"
                className="rounded-md p-1.5 text-slate-600 hover:bg-emerald-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-emerald-900/40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {paginaHistorialActual} / {totalPaginasHistorial}
              </span>
              <button
                type="button"
                onClick={() => setPaginaHistorial(Math.min(totalPaginasHistorial, paginaHistorialActual + 1))}
                disabled={paginaHistorialActual === totalPaginasHistorial}
                aria-label="Página siguiente del historial de autorizaciones"
                className="rounded-md p-1.5 text-slate-600 hover:bg-emerald-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-emerald-900/40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
