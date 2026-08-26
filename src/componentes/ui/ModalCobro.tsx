// src/componentes/ui/ModalCobro.tsx
import { useState, useEffect, useRef } from "react";
import { Check, X, Banknote, CreditCard, ArrowRightLeft } from "lucide-react";
import { cn } from "../../utilidades/utils";

interface PropsModalCobro {
  estaAbierto: boolean;
  alCerrar: () => void;
  subtotal: number;
  descuento: number;
  total: number;
  cantidadArticulos: number;
  alConfirmarVenta: (metodoPago: string) => void;
  teclaCobro: string;
  teclaEfectivo: string;
  teclaTarjeta: string;
  teclaTransferencia: string;
  alCambiarMetodoPago: (metodoPago: MetodoPago) => void;
}

type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";

export default function ModalCobro({ estaAbierto, alCerrar, subtotal, descuento, total, cantidadArticulos, alConfirmarVenta, teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, alCambiarMetodoPago }: PropsModalCobro) {
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [cantidadRecibida, setCantidadRecibida] = useState<string>("");
  const entradaRecibidaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estaAbierto) {
      setMetodoPago("EFECTIVO");
      // Corrección: Forzar exactamente 2 decimales para evitar números largos
      setCantidadRecibida(total.toFixed(2));
      window.setTimeout(() => entradaRecibidaRef.current?.focus(), 0);
    }
  }, [estaAbierto, total]);

  const recibidoNumerico = parseFloat(cantidadRecibida) || 0;
  const cambio = recibidoNumerico - total;
  const esValido = metodoPago !== "EFECTIVO" || recibidoNumerico >= total;

  useEffect(() => {
    if (!estaAbierto) return;
    const manejarTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      const tecla = evento.key.toLowerCase();
      if (tecla === teclaCobro.toLowerCase()) {
        evento.preventDefault();
        if (esValido) {
          alConfirmarVenta(metodoPago);
          alCerrar();
        }
        return;
      }
      if (objetivo?.tagName === "INPUT" || objetivo?.tagName === "TEXTAREA") return;
      if (tecla === teclaEfectivo.toLowerCase()) {
        setMetodoPago("EFECTIVO");
        alCambiarMetodoPago("EFECTIVO");
      }
      if (tecla === teclaTarjeta.toLowerCase()) {
        setMetodoPago("TARJETA");
        alCambiarMetodoPago("TARJETA");
      }
      if (tecla === teclaTransferencia.toLowerCase()) {
        setMetodoPago("TRANSFERENCIA");
        alCambiarMetodoPago("TRANSFERENCIA");
      }
    };
    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [estaAbierto, teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, metodoPago, esValido, alConfirmarVenta, alCambiarMetodoPago]);

  if (!estaAbierto) return null;

  const manejarVenta = () => {
    if (esValido) {
      alConfirmarVenta(metodoPago);
      alCerrar();
    }
  };

  const agregarDigito = (digito: string) => {
    setCantidadRecibida((actual) => {
      if (digito === "C") return "";
      if (digito === "." && actual.includes(".")) return actual;
      return actual === "0" ? digito : `${actual}${digito}`;
    });
  };

  const seleccionarMetodo = (metodo: MetodoPago) => {
    setMetodoPago(metodo);
    alCambiarMetodoPago(metodo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[calc(100vh-32px)] overflow-hidden rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-2">
        
        {/* Encabezado */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirmar Cobro</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {cantidadArticulos} artículo(s)
            </p>
          </div>
          <button onClick={alCerrar} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] gap-3 items-start">
        {/* Desglose y Total */}
        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-white/10">
          
          {descuento > 0 && (
            <>
              <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 font-medium">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Descuento aplicado:</span>
                <span>-${descuento.toFixed(2)}</span>
              </div>
              <div className="h-px w-full bg-slate-200 dark:bg-white/10 my-1"></div>
            </>
          )}

          <div className="text-center mt-1">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total a cobrar</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${total.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
        {/* Selección de Método de Pago */}
          <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => seleccionarMetodo("EFECTIVO")} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all", metodoPago === "EFECTIVO" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")}>
            <Banknote size={20} />
            <span className="text-xs font-semibold">Efectivo ({teclaEfectivo})</span>
          </button>
          <button onClick={() => seleccionarMetodo("TARJETA")} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all", metodoPago === "TARJETA" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")}>
            <CreditCard size={20} />
            <span className="text-xs font-semibold">Tarjeta ({teclaTarjeta})</span>
          </button>
          <button onClick={() => seleccionarMetodo("TRANSFERENCIA")} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all", metodoPago === "TRANSFERENCIA" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")}>
            <ArrowRightLeft size={20} />
            <span className="text-xs font-semibold">Transf. ({teclaTransferencia})</span>
          </button>
        </div>

        {/* Calculadora de Cambio (Solo si es Efectivo) */}
        {metodoPago === "EFECTIVO" && (
          <div className="flex flex-col gap-1 animate-in slide-in-from-top-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Cantidad recibida</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  ref={entradaRecibidaRef}
                  autoFocus
                  value={cantidadRecibida}
                  onChange={(e) => setCantidadRecibida(e.target.value)}
                  className="w-full text-lg font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-4 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {[20, 50, 100, 200, 500].filter(b => b >= total).slice(0, 4).map((billete) => (
                <button
                  key={billete}
                  onClick={() => setCantidadRecibida(billete.toString())}
                  className="py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-bold transition-colors"
                >
                  ${billete}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "C"].map((digito) => (
                <button
                  key={digito}
                  onClick={() => agregarDigito(digito)}
                  className="h-7 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-emerald-950/40"
                >
                  {digito === "C" ? "Limpiar" : digito}
                </button>
              ))}
            </div>

            {cambio >= 0 ? (
              <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Su cambio</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300">${cambio.toFixed(2)}</p>
              </div>
            ) : (
              <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">Falta ${Math.abs(cambio).toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
        </div>
        </div>

        {/* Botón Confirmar */}
        <button 
          onClick={manejarVenta}
          disabled={!esValido}
          className="w-full flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-base transition-all shadow-md shadow-emerald-600/30 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
        >
          <Check size={20} />
          Confirmar Venta ({teclaCobro})
        </button>

      </div>
    </div>
  );
}