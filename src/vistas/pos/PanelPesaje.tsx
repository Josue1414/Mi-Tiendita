// src/vistas/pos/PanelPesaje.tsx
import { useEffect, useState, useRef, type KeyboardEvent } from "react";
import { Scale, Usb, Edit3, Printer, ArrowLeft } from "lucide-react";
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
    // Autoenfocar el input cuando se seleccione un producto y la báscula no esté activa
    if (producto && (!basculaConectada || !permiteUsoBascula)) {
      setTimeout(() => inputManualRef.current?.focus(), 100);
    }
  }, [producto, basculaConectada, permiteUsoBascula]);

  useEffect(() => {
    return () => {
      desconectarBascula();
    };
  }, [desconectarBascula]);

  const parsearPesoManual = () => {
    if (!digitosManuales) return 0;
    return parseInt(digitosManuales, 10) / 1000;
  };

  const manejarCambioManual = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorLimpio = e.target.value.replace(/\D/g, "");
    setDigitosManuales(valorLimpio);
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
  
  let cantidadFinal = parsearPesoManual();
  if (basculaConectada && permiteUsoBascula && pesoActual > 0) {
    cantidadFinal = obtenerCantidadConvertida(pesoActual);
  }
  
  const precioCalculado = cantidadFinal * producto.precio;
  const valorInputMostrar = parsearPesoManual().toFixed(3);

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
    alCerrarPanel(); // Cierra el producto para evitar errores humanos en el siguiente pesaje
  };

  const manejarTeclaAbajo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      imprimirYLimpiar();
    }
  };

  return (
    <div className="w-full md:w-[min(35%,380px)] flex flex-col gap-3 shrink-0 h-full animate-in slide-in-from-right-4">
      <div className="efecto-cristal rounded-2xl p-5 flex flex-col min-h-[360px] h-full border border-emerald-200/60 dark:border-emerald-900/30 shadow-md">
        
        <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-200/50 dark:border-white/10">
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
          <div className="mb-4 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-white/10 p-5">
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
          <div className="mb-4 flex-1">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              <Edit3 size={12} /> {permiteUsoBascula ? "O Ingreso Manual" : "Ingreso Manual"}
            </label>
            <input 
              ref={inputManualRef}
              type="text" 
              inputMode="numeric"
              autoFocus
              value={valorInputMostrar} 
              onChange={manejarCambioManual} 
              onKeyDown={manejarTeclaAbajo}
              className="w-full text-center text-xl font-bold bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 rounded-xl py-2 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-slate-900 dark:text-slate-100 transition-all" 
              placeholder="0.000" 
            />
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
              Limpiar
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