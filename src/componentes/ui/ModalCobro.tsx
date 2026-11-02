// src/componentes/ui/ModalCobro.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { Check, X, Banknote, CreditCard, ArrowRightLeft, BookUser, Loader2, QrCode, Smartphone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { cn } from "../../utilidades/utils";

interface PropsModalCobro {
  estaAbierto: boolean;
  alCerrar: () => void;
  subtotal: number;
  descuento: number;
  total: number;
  cantidadArticulos: number;
  fiadosPermitidos: boolean;
  alConfirmarVenta: (metodoPago: string) => Promise<void> | void; 
  teclaCobro: string;
  teclaEfectivo: string;
  teclaTarjeta: string;
  teclaTransferencia: string;
  teclaCodi: string;
  teclaMercadoPago: string;
  teclaFiado: string;
  alCambiarMetodoPago: (metodoPago: MetodoPago) => void;
}

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "FIADO" | "CODI" | "MERCADO_PAGO";

export default function ModalCobro({ estaAbierto, alCerrar, subtotal, descuento, total, cantidadArticulos, fiadosPermitidos, alConfirmarVenta, teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, teclaCodi, teclaMercadoPago, teclaFiado, alCambiarMetodoPago }: PropsModalCobro) {
  const esAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("EFECTIVO");
  const [cantidadRecibida, setCantidadRecibida] = useState(() => total.toFixed(2));
  const [procesando, setProcesando] = useState(false); 
  const entradaRecibidaRef = useRef<HTMLInputElement>(null);

  const seleccionarMetodo = useCallback((metodo: MetodoPago) => {
    setMetodoPago(metodo);
    alCambiarMetodoPago(metodo);
  }, [alCambiarMetodoPago]);

  useEffect(() => {
    if (!estaAbierto) {
      setProcesando(false); 
      return;
    }
    const temporizador = window.setTimeout(() => entradaRecibidaRef.current?.focus(), 0);
    return () => window.clearTimeout(temporizador);
  }, [estaAbierto]);

  const recibidoNumerico = parseFloat(cantidadRecibida) || 0;
  const cambio = recibidoNumerico - total;
  
  const esValido = (metodoPago !== "EFECTIVO" || recibidoNumerico >= total) && !procesando;

  const manejarVenta = async () => {
    if (!esValido) return;
    setProcesando(true); 
    try {
      await alConfirmarVenta(metodoPago);
      alCerrar();
    } catch (error) {
      console.error("Error al procesar la venta", error);
      setProcesando(false); 
    }
  };

  useEffect(() => {
    if (!estaAbierto || procesando) return; 
    const manejarTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      const tecla = evento.key.toLowerCase();

      if (tecla === "delete") {
        evento.preventDefault();
        setCantidadRecibida("");
        return;
      }
      if (tecla === teclaCobro.toLowerCase()) {
        evento.preventDefault();
        manejarVenta();
        return;
      }
      if (tecla === teclaEfectivo.toLowerCase()) {
        evento.preventDefault();
        seleccionarMetodo("EFECTIVO");
        return;
      }
      if (tecla === teclaTarjeta.toLowerCase()) {
        evento.preventDefault();
        seleccionarMetodo("TARJETA");
        return;
      }
      if (tecla === teclaTransferencia.toLowerCase()) {
        evento.preventDefault();
        seleccionarMetodo("TRANSFERENCIA");
        return;
      }
      if (tecla === teclaCodi.toLowerCase()) {
        evento.preventDefault();
        seleccionarMetodo("CODI");
        return;
      }
      if (tecla === teclaMercadoPago.toLowerCase()) {
        evento.preventDefault();
        seleccionarMetodo("MERCADO_PAGO");
        return;
      }
      if (fiadosPermitidos && tecla === teclaFiado.toLowerCase()) {
        evento.preventDefault();
        seleccionarMetodo("FIADO");
        return;
      }
      if (objetivo?.tagName === "INPUT" || objetivo?.tagName === "TEXTAREA") return;
    };
    
    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [estaAbierto, procesando, teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, teclaCodi, teclaMercadoPago, teclaFiado, fiadosPermitidos, metodoPago, esValido, seleccionarMetodo]);

  if (!estaAbierto) return null;

  const agregarDigito = (digito: string) => {
    setCantidadRecibida((actual) => {
      if (digito === "C") return "";
      if (digito === "." && actual.includes(".")) return actual;
      return actual === "0" ? digito : `${actual}${digito}`;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[calc(100vh-32px)] overflow-y-auto rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-2">
        
        {/* Encabezado */}
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-xl">Confirmar Cobro</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{cantidadArticulos} artículo(s)</p>
          </div>
          <button
            onClick={manejarVenta}
            disabled={!esValido}
            className={cn(
              "shrink-0 items-center justify-center gap-1 justify-self-center rounded-lg px-2 py-1.5 text-xs font-bold leading-none text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-50",
              esAndroid ? "flex" : "hidden",
              metodoPago === "FIADO" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
            )}
          >
            {procesando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {procesando ? "Procesando..." : "Cobrar"}
          </button>
          <button onClick={alCerrar} disabled={procesando} className="shrink-0 justify-self-end p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-3 items-start mt-2">
          {/* Desglose y Total */}
          <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-white/10">
            {descuento > 0 && (
              <>
                <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 font-medium">
                  <span>Subtotal:</span><span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Descuento aplicado:</span><span>-${descuento.toFixed(2)}</span>
                </div>
                <div className="h-px w-full bg-slate-200 dark:bg-white/10 my-1"></div>
              </>
            )}
            <div className="text-center mt-1">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total a cobrar</p>
              <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">${total.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Selección de Método de Pago Ampliada */}
            <div className="grid grid-cols-3 gap-2">
              <button disabled={procesando} onClick={() => seleccionarMetodo("EFECTIVO")} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all disabled:opacity-50", metodoPago === "EFECTIVO" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 text-slate-500")}>
                <Banknote size={20} />
                <span className="text-[11px] font-semibold">Efectivo <span className="text-[9px] opacity-70">({teclaEfectivo})</span></span>
              </button>
              <button disabled={procesando} onClick={() => seleccionarMetodo("TARJETA")} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all disabled:opacity-50", metodoPago === "TARJETA" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 text-slate-500")}>
                <CreditCard size={20} />
                <span className="text-[11px] font-semibold">Tarjeta <span className="text-[9px] opacity-70">({teclaTarjeta})</span></span>
              </button>
              <button disabled={procesando} onClick={() => seleccionarMetodo("TRANSFERENCIA")} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all disabled:opacity-50", metodoPago === "TRANSFERENCIA" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 text-slate-500")}>
                <ArrowRightLeft size={20} />
                <span className="text-[11px] font-semibold">Transf. <span className="text-[9px] opacity-70">({teclaTransferencia})</span></span>
              </button>
              <button disabled={procesando} onClick={() => seleccionarMetodo("CODI")} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all disabled:opacity-50", metodoPago === "CODI" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 text-slate-500")}>
                <QrCode size={20} />
                <span className="text-[11px] font-semibold">QR CoDi <span className="text-[9px] opacity-70">({teclaCodi})</span></span>
              </button>
              <button disabled={procesando} onClick={() => seleccionarMetodo("MERCADO_PAGO")} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all disabled:opacity-50", metodoPago === "MERCADO_PAGO" ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-400" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 text-slate-500")}>
                <Smartphone size={20} />
                <span className="text-[11px] font-semibold">Mercado Pago <span className="text-[9px] opacity-70">({teclaMercadoPago})</span></span>
              </button>
              {fiadosPermitidos && (
                <button disabled={procesando} onClick={() => seleccionarMetodo("FIADO")} className={cn("flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all disabled:opacity-50", metodoPago === "FIADO" ? "bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-700 dark:text-amber-400" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 text-slate-500")}>
                  <BookUser size={20} />
                  <span className="text-[11px] font-semibold">Fiado <span className="text-[9px] opacity-70">({teclaFiado})</span></span>
                </button>
              )}
            </div>

            {/* Calculadora de Efectivo */}
            {metodoPago === "EFECTIVO" && (
              <div className="flex flex-col gap-1 animate-in fade-in">
                <div>
                  <label className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <span>Cantidad recibida</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-medium">$</span>
                    <input type="number" inputMode={esAndroid ? "none" : "decimal"} step="0.01" min="0" ref={entradaRecibidaRef} disabled={procesando} value={cantidadRecibida} onChange={(e) => setCantidadRecibida(e.target.value)} className="w-full text-lg font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "C"].map((digito) => (
                    <button key={digito} disabled={procesando} onClick={() => agregarDigito(digito)} className="h-9 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50">{digito === "C" ? "Borrar" : digito}</button>
                  ))}
                </div>
                {cambio >= 0 ? (
                  <div className="text-center p-3 mt-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 rounded-xl">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Su cambio</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300">${cambio.toFixed(2)}</p>
                  </div>
                ) : (
                  <div className="text-center p-3 mt-1 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded-xl">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">Falta ${Math.abs(cambio).toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Mensajes para los Nuevos Métodos */}
            {metodoPago === "CODI" && (
              <div className="flex flex-col items-center justify-center p-5 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 dark:border-emerald-600 rounded-xl animate-in fade-in text-center mt-2 shadow-sm w-full">
                <QrCode size={44} className="text-emerald-600 dark:text-emerald-400 mb-2 animate-pulse" />
                <p className="text-xl font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  Proyectando Código QR ´´CoDi´´ en Pantalla Cliente
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                  Instrucciones para Cliente: Escanea el código QR con la app de tu banco para realizar el pago.
                </p>
                <div className="mt-3 bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-xl shadow-inner w-full">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    ⚠️ <span className="underline decoration-emerald-400">IMPORTANTE:</span> Verifica en el celular del cliente que el pago sea exitoso y por la cantidad exacta de <span className="text-lg font-black bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md mx-1">${total.toFixed(2)}</span> antes de pulsar Confirmar Venta.
                  </p>
                </div>
              </div>
            )}

            {metodoPago === "MERCADO_PAGO" && (
              <div className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl animate-in fade-in text-center mt-2">
                <Smartphone size={32} className="text-blue-500 mb-2" />
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Mercado Pago / Point Activo</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">El cobro se ha enviado a tu terminal Point o Pantalla Cliente.</p>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={manejarVenta}
          disabled={!esValido}
          className={cn(
            "w-full mt-3 justify-center items-center gap-2 text-white py-3.5 rounded-xl font-bold text-base transition-all shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed",
            esAndroid ? "hidden" : "flex",
            metodoPago === "MERCADO_PAGO" ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30" : 
            metodoPago === "FIADO" ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
          )}
        >
          {procesando ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          {procesando ? "Procesando Venta..." : "Confirmar Venta"} ({teclaCobro})
        </button>

      </div>
    </div>
  );
}