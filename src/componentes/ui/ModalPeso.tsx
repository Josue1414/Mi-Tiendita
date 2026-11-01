// src/componentes/ui/ModalPeso.tsx
import { useEffect, useState, type KeyboardEvent } from "react";
import { Scale, X, Check, Usb, Edit3 } from "lucide-react";
import { useBascula } from "../../hooks/useBascula";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import type { Producto } from "../../tipos/producto";
import { abreviaturaUnidad } from "../../tipos/producto";

interface PropsModalPeso {
  abierto: boolean;
  producto: Producto | null;
  alCerrar: () => void;
  alConfirmar: (peso: number) => void;
}

export default function ModalPeso({ abierto, producto, alCerrar, alConfirmar }: PropsModalPeso) {
  const { basculaModelo, basculaPuerto, basculaBaudRate, basculaFormato } = useEstadoConfiguracion();
  
  const esLiquido = producto?.unidad === "LITRO" || producto?.unidad === "MILILITRO";
  const esMasa = producto?.unidad === "KG" || producto?.unidad === "GRAMO" || producto?.unidad === "MILIGRAMO";
  const permiteUsoBascula = esMasa || (esLiquido && producto?.bascula_equivalencia_litros);

  const { pesoActual, basculaConectada, conectarBascula, desconectarBascula } = useBascula({
    modelo: basculaModelo,
    puerto: basculaPuerto,
    baudRate: basculaBaudRate,
    formato: basculaFormato,
  });
  
  // Guardamos el valor como un string de dígitos puros para facilitar la edición
  const [digitosManuales, setDigitosManuales] = useState<string>("");

  useEffect(() => {
    if (!abierto) {
      desconectarBascula();
      setDigitosManuales("");
    }
  }, [abierto, desconectarBascula]);

  if (!abierto || !producto) return null;

  // Convierte los dígitos acumulados a formato numérico dividiendo por 1000
  // Ej: "5" -> 0.005 | "500" -> 0.500 | "1250" -> 1.250
  const parsearPesoManual = () => {
    if (!digitosManuales) return 0;
    return parseInt(digitosManuales, 10) / 1000;
  };

  const manejarCambioManual = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitimos números, ignorando cualquier otro carácter (como puntos)
    const valorLimpio = e.target.value.replace(/\D/g, "");
    setDigitosManuales(valorLimpio);
  };

  const obtenerCantidadConvertida = (pesoEnKg: number) => {
    switch (producto.unidad) {
        case "GRAMO": return pesoEnKg * 1000;
        case "MILILITRO": return pesoEnKg * 1000;
        case "MILIGRAMO": return pesoEnKg * 1000000;
        default: return pesoEnKg; // KG o LITRO
    }
  };

  const manejarConfirmacion = () => {
    let cantidadFinal = 0;
    if (basculaConectada && permiteUsoBascula && pesoActual > 0) {
      cantidadFinal = obtenerCantidadConvertida(pesoActual);
    } else {
      cantidadFinal = parsearPesoManual();
    }
    
    if (isNaN(cantidadFinal) || cantidadFinal <= 0) {
      alert("Por favor, registra un valor válido mayor a 0.");
      return;
    }
    
    alConfirmar(cantidadFinal);
    alCerrar();
  };

  // Capturar el Enter para confirmar
  const manejarTeclaAbajo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      manejarConfirmacion();
    }
  };

  const unidadAbreviatura = abreviaturaUnidad(producto.unidad);
  
  let cantidadParaCalculo = parsearPesoManual();
  if (basculaConectada && permiteUsoBascula && pesoActual > 0) {
    cantidadParaCalculo = obtenerCantidadConvertida(pesoActual);
  }
  const precioCalculado = cantidadParaCalculo * producto.precio;
  
  // Valor que se mostrará visualmente en el input (ej. 0.500)
  const valorInputMostrar = parsearPesoManual().toFixed(3);

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
              <p className="text-sm text-slate-500 dark:text-slate-400">${producto.precio.toFixed(2)} x {unidadAbreviatura}</p>
            </div>
          </div>
          <button onClick={alCerrar} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Sección de la Báscula USB */}
        {permiteUsoBascula && (
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
                <span className="text-slate-400 font-medium mt-1 uppercase tracking-widest text-xs">
                  KILOGRAMOS {producto.bascula_equivalencia_litros && esLiquido && "(1 Kg = 1 L)"}
                </span>
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
        )}

        {/* Entrada Manual */}
        {(!basculaConectada || !permiteUsoBascula) && (
          <div className="mb-6 animate-in slide-in-from-top-2">
             <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
              <Edit3 size={14} /> 
              {permiteUsoBascula ? `O ingreso manual (${unidadAbreviatura})` : `Ingreso manual de cantidad (${unidadAbreviatura})`}
            </label>
            <input 
              type="text" 
              inputMode="numeric"
              autoFocus
              value={valorInputMostrar} 
              onChange={manejarCambioManual} 
              onKeyDown={manejarTeclaAbajo}
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