// src/componentes/ui/ModalPeso.tsx
import { useState, useEffect } from "react";
import { Scale, Check, X } from "lucide-react";
import type { Producto } from "../../tipos/producto";

interface PropsModalPeso {
  estaAbierto: boolean;
  alCerrar: () => void;
  producto: Producto | null;
  alConfirmar: (producto: Producto, peso: number) => void;
  alAvisar?: (mensaje: string) => void;
}

export default function ModalPeso({ estaAbierto, alCerrar, producto, alConfirmar, alAvisar }: PropsModalPeso) {
  const [peso, setPeso] = useState<string>("0.500");

  useEffect(() => {
    if (estaAbierto) setPeso("0.500");
  }, [estaAbierto]);

  if (!estaAbierto || !producto) return null;

  const pesoNumerico = parseFloat(peso) || 0;
  const subtotalEstimado = pesoNumerico * producto.precio;

  const manejarConfirmacion = () => {
    // Si el producto controla stock, validamos que no exceda lo disponible
    if (producto.controla_stock) {
      if (pesoNumerico > 0 && pesoNumerico <= producto.stock_actual) {
        alConfirmar(producto, pesoNumerico);
        alCerrar();
      } else {
        alAvisar?.(`El peso indicado es inválido o excede el stock disponible (${producto.stock_actual} ${producto.unidad}).`);
      }
    } else {
      // Si NO controla stock (ej. a demanda), solo validamos que sea mayor a 0
      if (pesoNumerico > 0) {
        alConfirmar(producto, pesoNumerico);
        alCerrar();
      } else {
        alAvisar?.("Por favor ingresa un peso mayor a 0.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-6">
        
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Scale size={24} className="text-emerald-600 dark:text-emerald-400" />
              Ingresar Peso
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {producto.nombre} — ${producto.precio.toFixed(2)} por {producto.unidad.toLowerCase()}
            </p>
          </div>
          <button onClick={alCerrar} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div>
          <div className="relative flex items-center">
            <input
              type="number"
              step="0.050"
              min="0.050"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="w-full text-center text-4xl font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl py-4 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
            />
            <span className="absolute right-6 text-xl font-medium text-slate-400">
              {producto.unidad === "LITRO" ? "L" : "kg"}
            </span>
          </div>
          
          <p className="text-center text-sm text-slate-500 mt-2">
            {producto.controla_stock ? (
              <>Stock disponible: <span className="font-bold text-slate-700 dark:text-slate-300">{producto.stock_actual} {producto.unidad === "LITRO" ? "L" : "kg"}</span></>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium italic">Venta a demanda (Sin límite)</span>
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pesos comunes</p>
          <div className="grid grid-cols-5 gap-2">
            {["0.100", "0.250", "0.500", "0.750", "1.000"].map((cantidad) => (
              <button
                key={cantidad}
                onClick={() => setPeso(cantidad)}
                className="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
              >
                {cantidad}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl flex flex-col gap-4 border border-emerald-100 dark:border-emerald-800/30">
          <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-300">
            <span className="font-medium">Total a cobrar:</span>
            <span className="text-2xl font-bold">${subtotalEstimado.toFixed(2)}</span>
          </div>
          <button 
            onClick={manejarConfirmacion}
            className="w-full flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-lg transition-all shadow-md shadow-emerald-600/20 hover:scale-[1.02]"
          >
            <Check size={20} />
            Agregar al Ticket
          </button>
        </div>

      </div>
    </div>
  );
}