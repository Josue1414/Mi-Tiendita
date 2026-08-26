// src/componentes/ui/ModalPeso.tsx
import { useEffect, useState } from "react";
import { Scale, X, Check, Usb} from "lucide-react";
import { useBascula } from "../../hooks/useBascula";
import type { Producto } from "../../tipos/producto";

interface PropsModalPeso {
  abierto: boolean;
  producto: Producto | null;
  alCerrar: () => void;
  alConfirmar: (peso: number) => void;
}

export default function ModalPeso({ abierto, producto, alCerrar, alConfirmar }: PropsModalPeso) {
  const { pesoActual, basculaConectada, conectarBascula, desconectarBascula } = useBascula();
  const [pesoManual, setPesoManual] = useState<string>("");

  // Desconectar la báscula automáticamente cuando se cierra el modal para liberar el puerto USB
  useEffect(() => {
    if (!abierto) {
      desconectarBascula();
      setPesoManual("");
    }
  }, [abierto, desconectarBascula]);

  if (!abierto || !producto) return null;

  const manejarConfirmacion = () => {
    // Priorizamos el peso de la báscula si está conectada y leyendo. Si no, usamos el manual.
    const pesoFinal = basculaConectada && pesoActual > 0 ? pesoActual : parseFloat(pesoManual);
    
    if (isNaN(pesoFinal) || pesoFinal <= 0) {
      alert("Por favor, registra un peso válido mayor a 0.");
      return;
    }
    
    alConfirmar(pesoFinal);
    alCerrar();
  };

  const precioCalculado = (basculaConectada && pesoActual > 0 ? pesoActual : parseFloat(pesoManual || "0")) * producto.precio;

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in" onClick={alCerrar}>
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 dark:bg-slate-900/90 efecto-cristal p-6 shadow-2xl dark:border-white/10" onClick={(evento) => evento.stopPropagation()} role="dialog" aria-modal="true">
        
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <Scale size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{producto.nombre}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">${producto.precio.toFixed(2)} x {producto.unidad}</p>
            </div>
          </div>
          <button onClick={alCerrar} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Sección de la Báscula USB */}
        <div className="mb-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6 relative overflow-hidden">
          {basculaConectada ? (
            <div className="flex flex-col items-center animate-in zoom-in duration-300">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Báscula Leyendo...
              </span>
              <div className="text-5xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                {pesoActual > 0 ? pesoActual.toFixed(3) : "0.000"}
              </div>
              <span className="text-slate-400 font-medium mt-1 uppercase tracking-widest text-xs">Kilogramos</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center w-full">
              <Usb size={32} className="text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Conecta la báscula por USB para lectura automática.</p>
              <button 
                onClick={conectarBascula}
                className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Usb size={16} />
                Conectar Báscula
              </button>
            </div>
          )}
        </div>

        {/* Entrada Manual (Respaldo) */}
        {!basculaConectada && (
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
              O ingreso manual (Kg)
            </label>
            <input 
              type="number" 
              step="0.001" 
              min="0.001"
              autoFocus
              value={pesoManual} 
              onChange={(e) => setPesoManual(e.target.value)} 
              className="w-full text-center text-2xl font-bold bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 rounded-2xl py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-slate-900 dark:text-slate-100 transition-all" 
              placeholder="0.000" 
            />
          </div>
        )}

        {/* Resumen de cobro */}
        <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-800/30 mb-6">
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Total a cobrar:</span>
          <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">${precioCalculado.toFixed(2)}</span>
        </div>

        <div className="flex gap-3">
          <button onClick={alCerrar} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={manejarConfirmacion} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]">
            <Check size={18} /> 
            Confirmar
          </button>
        </div>

      </div>
    </div>
  );
}