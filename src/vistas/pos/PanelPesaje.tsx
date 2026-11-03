// src/vistas/pos/PanelPesaje.tsx
import { useEffect, useState, useRef } from "react";
import { Scale, Usb, Edit3, Printer, ArrowLeft } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useBascula } from "../../hooks/useBascula";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import type { Producto } from "../../tipos/producto";
import { abreviaturaUnidad } from "../../tipos/producto";
import { imprimirEtiqueta } from "../../utilidades/codigoBarras";
import ImagenLocal from "../../componentes/ui/ImagenLocal";

interface PanelPesajeProps {
  producto: Producto | null;
  alCerrarPanel: () => void;
}

export default function PanelPesaje({ producto, alCerrarPanel }: PanelPesajeProps) {
  const { basculaModelo, basculaPuerto, basculaBaudRate, basculaFormato } = useEstadoConfiguracion();
  const esAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  
  const esLiquido = producto?.unidad === "LITRO" || producto?.unidad === "MILILITRO";
  const esMasa = producto?.unidad === "KG" || producto?.unidad === "GRAMO" || producto?.unidad === "MILIGRAMO";
  const permiteUsoBascula = esMasa || (esLiquido && producto?.bascula_equivalencia_litros);

  const inputManualRef = useRef<HTMLInputElement>(null);

  const { pesoActual, basculaConectada, conectarBascula, desconectarBascula } = useBascula({
    modelo: basculaModelo,
    puerto: basculaPuerto,
    baudRate: basculaBaudRate,
    formato: basculaFormato,
  });

  const [digitosManuales, setDigitosManuales] = useState<string>("");

  useEffect(() => {
    setDigitosManuales("");
    if (producto && (!basculaConectada || !permiteUsoBascula)) {
      setTimeout(() => inputManualRef.current?.focus(), 100);
    }
  }, [producto, basculaConectada, permiteUsoBascula]);

  useEffect(() => {
    return () => {
      desconectarBascula();
    };
  }, [desconectarBascula]);

  const agregarDigito = (digito: string) => {
    setDigitosManuales((actual) => {
      if (digito === "C") return "";
      if (digito === "." && actual.includes(".")) return actual;
      if (actual === "" && digito === ".") return "0.";
      return actual === "0" && digito !== "." ? digito : `${actual}${digito}`;
    });
  };

  const parsearPesoManual = () => {
    if (!digitosManuales || digitosManuales === ".") return 0;
    return parseFloat(digitosManuales);
  };

  const obtenerCantidadConvertida = (pesoEnKg: number) => {
    if (!producto) return 0;
    switch (producto.unidad) {
        case "GRAMO": return pesoEnKg * 1000;
        case "MILILITRO": return pesoEnKg * 1000;
        case "MILIGRAMO": return pesoEnKg * 1000000;
        default: return pesoEnKg; 
    }
  };

  if (!producto) {
    return (
      <div className="w-full md:w-[min(35%,380px)] flex flex-col gap-4 shrink-0 h-full animate-in fade-in">
        <div className="efecto-cristal rounded-2xl p-4 flex flex-col items-center justify-center min-h-[360px] h-full border border-slate-200/50 dark:border-white/10 text-slate-400">
          <Scale size={48} className="opacity-20 mb-3 text-emerald-600" />
          <p className="text-center font-bold text-slate-500">Estación de Pesaje</p>
          <p className="text-xs text-center mt-1">Selecciona un producto a granel de la cuadrícula para imprimir su etiqueta.</p>
        </div>
      </div>
    );
  }

  const unidadAbreviatura = abreviaturaUnidad(producto.unidad);
  const unidadDisplay = esLiquido ? "LITROS" : producto.unidad.toUpperCase();
  const sugerenciasPeso = [0.25, 0.5, 0.8, 1].map((pesoKg) => {
    const cantidad = obtenerCantidadConvertida(pesoKg);
    return {
      cantidad,
      etiqueta: producto.unidad === "KG"
        ? (pesoKg === 1 ? "1 Kg" : `${pesoKg.toFixed(3).slice(1)} Kg`)
        : `${cantidad.toLocaleString("es-MX")} ${unidadAbreviatura}`,
    };
  });
  
  let cantidadFinal = parsearPesoManual();
  if (basculaConectada && permiteUsoBascula && pesoActual > 0) {
    cantidadFinal = obtenerCantidadConvertida(pesoActual);
  }
  
  const precioCalculado = cantidadFinal * producto.precio;

  const imprimirYLimpiar = () => {
    if (cantidadFinal <= 0) return;
    
    const codigoInteligente = `V~${producto.codigo_barras}~${precioCalculado.toFixed(2)}`;
    const nombreConPeso = `${producto.nombre} (${cantidadFinal.toFixed(3)}${unidadAbreviatura})`;

    imprimirEtiqueta({
      nombre: nombreConPeso,
      codigo: codigoInteligente,
      precio: precioCalculado
    });

    setDigitosManuales("");
    alCerrarPanel();
  };

  // Escuchar teclado físico para ingreso manual cuando la báscula no está en uso
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!producto || (basculaConectada && permiteUsoBascula)) return;
    
    const manejarTecla = (evento: KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      const esCampoActivo = objetivo?.tagName === "INPUT" && objetivo.id !== "input-pesaje-manual";
      if (esCampoActivo || objetivo?.tagName === "TEXTAREA") return;

      if (evento.key === "Enter") {
        evento.preventDefault();
        imprimirYLimpiar();
      } else if (evento.key === "Backspace") {
        evento.preventDefault();
        setDigitosManuales(prev => prev.slice(0, -1));
      } else if (evento.key === "Delete" || evento.key.toLowerCase() === "c") {
        evento.preventDefault();
        setDigitosManuales("");
      } else if (/^[0-9.]$/.test(evento.key)) {
        evento.preventDefault();
        agregarDigito(evento.key);
      }
    };

    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [producto, basculaConectada, permiteUsoBascula, digitosManuales, cantidadFinal]);

  return (
    <div className="w-full md:w-[min(35%,380px)] flex flex-col gap-3 shrink-0 h-full animate-in slide-in-from-right-4">
      <div className="efecto-cristal rounded-2xl p-5 flex flex-col min-h-[360px] h-full border border-emerald-200/60 dark:border-emerald-900/30 shadow-md">
        
        <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-200/50 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <ImagenLocal nombreArchivo={producto.imagen_url || producto.imagen_archivo} nombreProducto={producto.nombre} className="w-10 h-10 rounded-lg object-cover bg-white shrink-0" />
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{producto.nombre}</h2>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">${producto.precio.toFixed(2)} x {unidadAbreviatura}</p>
            </div>
          </div>
          <button onClick={alCerrarPanel} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={16} />
          </button>
        </div>

        {permiteUsoBascula && (
          <div className="mb-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-white/10 p-5 shrink-0">
            {basculaConectada ? (
              <div className="flex flex-col items-center animate-in zoom-in duration-300">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                  Leyendo
                </span>
                <div className="text-4xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                  {pesoActual > 0 ? pesoActual.toFixed(3) : "0.000"}
                </div>
                <span className="text-slate-400 font-medium mt-0.5 text-[10px] uppercase tracking-widest">{unidadDisplay}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center w-full">
                <Usb size={24} className="text-slate-300 mb-2" />
                <button onClick={conectarBascula} className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-lg transition-colors text-xs flex items-center justify-center gap-2">
                  <Usb size={14} /> Conectar Báscula
                </button>
              </div>
            )}
          </div>
        )}

        {(!basculaConectada || !permiteUsoBascula) && (
          <div className="mb-4 flex flex-col flex-1 shrink-0 animate-in fade-in">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              <Edit3 size={12} /> {permiteUsoBascula ? `O Ingreso Manual (${unidadAbreviatura})` : `Ingreso Manual (${unidadAbreviatura})`}
            </label>
            <input 
              id="input-pesaje-manual"
              ref={inputManualRef}
              type="text" 
              inputMode="none"
              readOnly={esAndroid}
              autoFocus
              value={digitosManuales || "0"} 
              onChange={() => {}} // Manejado por eventos del teclado / botones
              className="w-full text-center text-xl font-bold bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 rounded-xl py-2 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-slate-900 dark:text-slate-100 transition-all" 
              placeholder="0.000" 
            />

            <div className="mt-2">
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Peso sugerido</span>
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {sugerenciasPeso.map(({ cantidad, etiqueta }) => (
                  <button
                    key={etiqueta}
                    type="button"
                    onClick={() => setDigitosManuales(String(cantidad))}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 text-[10px] sm:text-xs font-bold text-slate-700 hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "C"].map((digito) => (
                <button 
                  key={digito} 
                  type="button"
                  onClick={() => agregarDigito(digito)} 
                  className="h-10 sm:h-12 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 active:scale-95 transition-transform"
                >
                  {digito === "C" ? "Borrar" : digito}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-end px-2">
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Precio a Etiquetar</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${precioCalculado.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => {
                setDigitosManuales("");
                alCerrarPanel();
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={imprimirYLimpiar} 
              disabled={cantidadFinal <= 0}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              <Printer size={18} /> Imprimir (Enter)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}