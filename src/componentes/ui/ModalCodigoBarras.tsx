import { useMemo } from "react";
import { Printer, X } from "lucide-react";
import { imprimirEtiqueta, svgCodigoBarras } from "../../utilidades/codigoBarras";
import { precioVenta, type Producto } from "../../tipos/producto";

interface Props {
  producto: Producto | null;
  alCerrar: () => void;
}

export default function ModalCodigoBarras({ producto, alCerrar }: Props) {
  const svg = useMemo(() => (producto?.codigo_barras ? svgCodigoBarras(producto.codigo_barras) : ""), [producto]);

  if (!producto) return null;

  const precio = precioVenta(producto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={alCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm efecto-cristal rounded-2xl p-4 border border-slate-200/70 dark:border-white/10 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Etiqueta de código</h3>
          <button type="button" onClick={alCerrar} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm font-medium text-center text-slate-900 dark:text-slate-100 mb-3">{producto.nombre}</p>
        <div className="bg-white rounded-xl p-3 flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-center text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">${precio.toFixed(2)}</p>
        <button
          type="button"
          onClick={() => imprimirEtiqueta({ nombre: producto.nombre, codigo: producto.codigo_barras, precio })}
          className="mt-4 w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
        >
          <Printer size={15} />
          Imprimir etiqueta
        </button>
      </div>
    </div>
  );
}
