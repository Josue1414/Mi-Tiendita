// src/vistas/pos/ModalFiadoPOS.tsx
import { ArrowLeft, BookUser, Search, UserCheck } from "lucide-react";
import type { Fiado } from "../../estado/estadoFiados";
import { cn } from "../../utilidades/utils";
import type { DatosNuevoDeudor } from "./types";

interface ModalFiadoPOSProps {
  abierto: boolean;
  deudores: Fiado[];
  modo: "seleccionar" | "nuevo";
  deudorSeleccionado: string;
  busqueda: string;
  nuevoDeudor: DatosNuevoDeudor;
  alCerrar: () => void;
  alCambiarModo: (modo: "seleccionar" | "nuevo") => void;
  alSeleccionarDeudor: (id: string) => void;
  alCambiarBusqueda: (busqueda: string) => void;
  alCambiarNuevoDeudor: (datos: DatosNuevoDeudor) => void;
  alConfirmarExistente: () => void;
  alConfirmarNuevo: () => void;
}

export default function ModalFiadoPOS({
  abierto,
  deudores,
  modo,
  deudorSeleccionado,
  busqueda,
  nuevoDeudor,
  alCerrar,
  alCambiarModo,
  alSeleccionarDeudor,
  alCambiarBusqueda,
  alCambiarNuevoDeudor,
  alConfirmarExistente,
  alConfirmarNuevo,
}: ModalFiadoPOSProps) {
  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2 text-amber-700 dark:text-amber-500">
            <BookUser size={24} /> Asignar a Cliente
          </h2>
          <button
            onClick={alCerrar}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => alCambiarModo("seleccionar")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
              modo === "seleccionar"
                ? "bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Cliente Existente
          </button>
          <button
            onClick={() => alCambiarModo("nuevo")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all",
              modo === "nuevo"
                ? "bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            Nuevo Cliente
          </button>
        </div>

        {modo === "seleccionar" ? (
          <div className="flex flex-col gap-3 min-h-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={busqueda}
                onChange={(event) => alCambiarBusqueda(event.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-900 p-1 max-h-[200px]">
              {deudores
                .filter((deudor) => deudor.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                .map((deudor) => (
                  <button
                    key={deudor.id}
                    onClick={() => alSeleccionarDeudor(deudor.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg flex items-center justify-between transition-colors",
                      deudorSeleccionado === deudor.id
                        ? "bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700"
                        : "hover:bg-white dark:hover:bg-slate-800 border border-transparent"
                    )}
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{deudor.nombre}</p>
                      <p className="text-xs text-slate-500">{deudor.celular || "Sin teléfono"}</p>
                    </div>
                    {deudorSeleccionado === deudor.id && <UserCheck size={18} className="text-amber-600" />}
                  </button>
                ))}
              {deudores.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4">No hay clientes registrados.</p>
              )}
            </div>
            <button
              onClick={alConfirmarExistente}
              disabled={!deudorSeleccionado}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              Confirmar Fiado
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-h-[250px]">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nombre Completo *</label>
              <input
                type="text"
                value={nuevoDeudor.nombre}
                onChange={(event) => alCambiarNuevoDeudor({ ...nuevoDeudor, nombre: event.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                placeholder="Ej: María López"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Celular</label>
              <input
                type="tel"
                value={nuevoDeudor.celular}
                onChange={(event) => alCambiarNuevoDeudor({ ...nuevoDeudor, celular: event.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                placeholder="Ej: 5512345678"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Notas (Opcional)</label>
              <textarea
                value={nuevoDeudor.notas}
                onChange={(event) => alCambiarNuevoDeudor({ ...nuevoDeudor, notas: event.target.value })}
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:text-white resize-none"
                placeholder="Dirección, referencias, etc."
              />
            </div>
            <button
              onClick={alConfirmarNuevo}
              disabled={!nuevoDeudor.nombre.trim()}
              className="w-full mt-auto py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              Registrar y Confirmar Fiado
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
