// src/componentes/ui/ModalPrompt.tsx
import { useEffect, useState } from "react";
import { MessageSquare, X } from "lucide-react";

interface PropsModalPrompt {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  placeholder?: string;
  valorInicial?: string;
  alCerrar: () => void;
  alConfirmar: (valor: string) => void;
}

export default function ModalPrompt({ abierto, titulo, mensaje, placeholder = "", valorInicial = "", alCerrar, alConfirmar }: PropsModalPrompt) {
  const [valor, setValor] = useState(valorInicial);

  useEffect(() => {
    if (abierto) setValor(valorInicial);
  }, [abierto, valorInicial]);

  useEffect(() => {
    if (!abierto) return;
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Enter" && valor.trim() !== "") {
        evento.preventDefault();
        alConfirmar(valor.trim());
      }
    };
    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [abierto, valor, alConfirmar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={alCerrar}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
            <MessageSquare size={21} />
          </div>
          <button onClick={alCerrar} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <h2 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">{titulo}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{mensaje}</p>
        <input 
          autoFocus 
          type="text" 
          value={valor} 
          onChange={(e) => setValor(e.target.value)} 
          placeholder={placeholder} 
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white" 
        />
        <div className="mt-5 flex gap-2">
          <button onClick={alCerrar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
          <button onClick={() => alConfirmar(valor.trim())} disabled={!valor.trim()} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">Guardar</button>
        </div>
      </div>
    </div>
  );
}