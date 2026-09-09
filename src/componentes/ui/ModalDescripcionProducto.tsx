// src/componentes/ui/ModalDescripcionProducto.tsx
import { useEffect, useState } from "react";
import { X, Tag, Package, Layers, MonitorUp, MonitorOff } from "lucide-react";
import ImagenLocal from "./ImagenLocal";
import { precioVenta, type Producto } from "../../tipos/producto";
import { useEstadoInventario } from "../../estado/estadoInventario";
import { useEmisorPantallaCliente } from "../../hooks/usePantallaCliente";

interface Props {
  abierto: boolean;
  producto: Producto | null;
  alCerrar: () => void;
}

export default function ModalDescripcionProducto({ abierto, producto, alCerrar }: Props) {
  const { categorias } = useEstadoInventario();
  const { enviarMensaje } = useEmisorPantallaCliente();
  const [mostrandoEnPantallaCliente, setMostrandoEnPantallaCliente] = useState(false);

  useEffect(() => {
    setMostrandoEnPantallaCliente(false);
    enviarMensaje({ tipo: "QUITAR_PRODUCTO_CLIENTE" });
  }, [producto?.id]);

  if (!abierto || !producto) return null;

  const precio = precioVenta(producto);
  const colorCategoria = categorias.find((c) => c.nombre === producto.categoria)?.color || "#10b981";

  const cerrar = () => {
    enviarMensaje({ tipo: "QUITAR_PRODUCTO_CLIENTE" });
    setMostrandoEnPantallaCliente(false);
    alCerrar();
  };

  const alternarPantallaCliente = () => {
    if (mostrandoEnPantallaCliente) {
      enviarMensaje({ tipo: "QUITAR_PRODUCTO_CLIENTE" });
      setMostrandoEnPantallaCliente(false);
      return;
    }

    enviarMensaje({ tipo: "MOSTRAR_PRODUCTO_CLIENTE", producto });
    setMostrandoEnPantallaCliente(true);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={cerrar}>
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Package className="text-emerald-600" size={20} />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Descripción del producto</h2>
          </div>
          <button onClick={cerrar} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[170px,1fr]">
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/50 p-2">
            <ImagenLocal nombreArchivo={producto.imagen_url} nombreProducto={producto.nombre} className="h-36 w-full rounded-xl object-cover" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide" style={{ backgroundColor: colorCategoria, color: "#fff" }}>{producto.categoria || "Sin categoría"}</span>
                <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">{producto.nombre}</h3>
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${precio.toFixed(2)}</span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/50">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                {producto.descripcion || "Sin descripción disponible para este producto."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 px-3 py-2">
                <Tag size={16} className="text-emerald-600" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Código</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 px-3 py-2">
                <Layers size={16} className="text-amber-600" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Stock</span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm dark:border-white/10 dark:text-slate-100">{producto.codigo_barras || "N/A"}</div>
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold dark:border-white/10 dark:text-slate-100">
                {producto.controla_stock ? `${producto.stock_actual} ${producto.unidad}` : "Sin control"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10">
          <button onClick={alternarPantallaCliente} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 transition-colors">
            {mostrandoEnPantallaCliente ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
            {mostrandoEnPantallaCliente ? "Dejar de mostrar en pantalla cliente" : "Mostrar en pantalla cliente"}
          </button>
          <button onClick={cerrar} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
