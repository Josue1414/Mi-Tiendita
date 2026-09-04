// src/componentes/ui/ModalConfirmacionPin.tsx
import React, { useState, useEffect } from "react";
import { AlertOctagon, Lock, X } from "lucide-react";
import { cn } from "../../utilidades/utils";
import { useEstadoTrabajadores } from "../../estado/estadoTrabajadores";

interface PropsModalConfirmacionPin {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  labelPin?: string; // <-- Nueva propiedad opcional
  alConfirmar: () => void;
  alCerrar: () => void;
}

export default function ModalConfirmacionPin({ abierto, titulo, mensaje, labelPin, alConfirmar, alCerrar }: PropsModalConfirmacionPin) {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (abierto) {
      setPin("");
      setError(false);
    }
  }, [abierto]);

  if (!abierto) return null;

  const manejarConfirmacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.toUpperCase() === trabajadorActivo?.pin.toUpperCase()) {
      alConfirmar();
      alCerrar();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in" onClick={alCerrar}>
      <div className="w-full max-w-sm rounded-3xl border border-red-200/50 bg-white p-6 shadow-2xl dark:border-red-900/30 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
            <AlertOctagon size={24} />
          </div>
          <button onClick={alCerrar} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{titulo}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{mensaje}</p>
        
        <form onSubmit={manejarConfirmacion} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
              {labelPin || "Ingresa tu PIN de Dueño"}
            </label>
            <div className="relative flex items-center justify-center">
              <Lock className="absolute left-4 text-slate-400" size={18} />
              <input
                type="password"
                autoFocus
                required
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/[^a-zA-Z0-9]/g, "")); setError(false); }}
                className={cn(
                  "w-full text-center tracking-[0.5em] text-xl font-mono bg-slate-50 dark:bg-slate-950 border-2 rounded-xl py-3 outline-none focus:ring-4 transition-all text-slate-900 dark:text-slate-100 placeholder:tracking-normal",
                  error ? "border-red-500 focus:ring-red-500/20 text-red-600 animate-in shake bg-red-50/50 dark:bg-red-900/10" : "border-slate-200 dark:border-white/10 focus:border-red-500 focus:ring-red-500/20"
                )}
                placeholder="••••"
                maxLength={6}
              />
            </div>
            {error && <p className="text-red-500 text-xs text-center font-bold mt-2 animate-in fade-in">PIN incorrecto. Acceso denegado.</p>}
          </div>

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={alCerrar} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}