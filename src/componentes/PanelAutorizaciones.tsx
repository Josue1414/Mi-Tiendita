import { ShieldCheck, History, Package } from "lucide-react";
import type { Producto } from "../tipos/producto";
import type { Venta } from "../estado/estadoVentas";

interface PropsPanelAutorizaciones {
  productos: Producto[];
  ventas: Venta[];
}

export default function PanelAutorizaciones({ productos, ventas }: PropsPanelAutorizaciones) {
  const productosRestringidos = productos.filter((producto) => producto.requiere_autorizacion);
  const ventasAutorizadas = ventas.flatMap((venta) =>
    venta.articulos
      .filter((articulo) => articulo.autorizacion_confirmada)
      .map((articulo) => ({ venta, articulo }))
  );

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="efecto-cristal rounded-2xl border border-amber-200/70 p-5 dark:border-amber-900/40">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <ShieldCheck size={19} className="text-amber-600" /> Productos con autorización
        </h2>
        {productosRestringidos.length === 0 ? <p className="text-sm text-slate-500">No hay productos restringidos.</p> : (
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {productosRestringidos.map((producto) => (
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
      </div>
      <div className="efecto-cristal rounded-2xl border border-emerald-200/70 p-5 dark:border-emerald-900/40">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <History size={19} className="text-emerald-600" /> Historial de autorizaciones
        </h2>
        {ventasAutorizadas.length === 0 ? <p className="text-sm text-slate-500">Aún no hay ventas autorizadas.</p> : (
          <div className="space-y-2">
            {ventasAutorizadas.map(({ venta, articulo }, indice) => (
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
      </div>
    </section>
  );
}
