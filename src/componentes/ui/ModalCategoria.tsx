import { useState } from "react";
import { X } from "lucide-react";
import { PALETA_CATEGORIAS, colorTextoSobre, siguienteColor } from "../../utilidades/coloresCategoria";
import { cn } from "../../utilidades/utils";

interface Props {
  abierto: boolean;
  coloresUsados?: string[];
  alCerrar: () => void;
  alGuardar: (nombre: string, color: string) => void;
}

export default function ModalCategoria({ abierto, coloresUsados = [], alCerrar, alGuardar }: Props) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(siguienteColor(coloresUsados));

  if (!abierto) return null;

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    alGuardar(nombre.trim(), color);
    setNombre("");
    setColor(siguienteColor([...coloresUsados, color]));
    alCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={alCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={guardar}
        className="w-full max-w-sm efecto-cristal rounded-2xl p-4 border border-slate-200/70 dark:border-white/10 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nueva categoría</h3>
          <button type="button" onClick={alCerrar} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X size={16} />
          </button>
        </div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre</label>
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Farmacia"
          className="w-full mb-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100"
        />
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Color</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PALETA_CATEGORIAS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn("w-7 h-7 rounded-full border-2 transition-transform", color === c ? "scale-110 border-slate-900 dark:border-white" : "border-transparent")}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        <div
          className="mb-4 rounded-lg px-3 py-1.5 text-xs font-semibold text-center"
          style={{ backgroundColor: color, color: colorTextoSobre(color) }}
        >
          {nombre.trim() || "Vista previa"}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={alCerrar} className="h-8 px-3 text-xs rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button type="submit" className="h-8 px-3 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
            Crear
          </button>
        </div>
      </form>
    </div>
  );
}
