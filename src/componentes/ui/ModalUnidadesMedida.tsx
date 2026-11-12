import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Producto, UnidadMedida } from "../../tipos/producto";
import { normalizarNombreUnidad, UNIDADES_MEDIDA_PREDEFINIDAS } from "../../utilidades/unidadesMedida";

interface Props {
  abierto: boolean;
  unidades: UnidadMedida[];
  productos: Producto[];
  unidadSeleccionada: string;
  alCerrar: () => void;
  alGuardar: (nombre: string, id?: string) => Promise<UnidadMedida | null>;
  alEliminar: (id: string) => Promise<void>;
  alSeleccionar: (nombre: string) => void;
}

export default function ModalUnidadesMedida({
  abierto,
  unidades,
  productos,
  unidadSeleccionada,
  alCerrar,
  alGuardar,
  alEliminar,
  alSeleccionar,
}: Props) {
  const [nombreNueva, setNombreNueva] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  if (!abierto) return null;

  const guardarNueva = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const unidad = await alGuardar(nombreNueva);
      if (unidad) {
        setNombreNueva("");
        alSeleccionar(unidad.nombre);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar la unidad.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarEdicion = async (id: string) => {
    setError("");
    setGuardando(true);
    try {
      const nombreAnterior = unidades.find((unidad) => unidad.id === id)?.nombre;
      const unidad = await alGuardar(nombreEditado, id);
      if (unidad) {
        if (nombreAnterior && normalizarNombreUnidad(unidadSeleccionada) === normalizarNombreUnidad(nombreAnterior)) {
          alSeleccionar(unidad.nombre);
        }
        setEditandoId(null);
        setNombreEditado("");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo actualizar la unidad.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    setError("");
    setGuardando(true);
    try {
      await alEliminar(id);
      setEliminandoId(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo eliminar la unidad.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={alCerrar}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-unidades-medida"
        onClick={(evento) => evento.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto efecto-cristal rounded-2xl p-4 border border-slate-200/70 dark:border-white/10 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="titulo-unidades-medida" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Unidades de medida</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Las unidades predefinidas están protegidas; puedes administrar las que agregues.</p>
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(evento) => void guardarNueva(evento)} className="mb-4 flex gap-2">
          <input
            value={nombreNueva}
            onChange={(evento) => setNombreNueva(evento.target.value)}
            placeholder="Ej: Caja"
            aria-label="Nombre de la nueva unidad"
            maxLength={40}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          />
          <button type="submit" disabled={guardando || !nombreNueva.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
            <Plus size={14} /> Agregar
          </button>
        </form>

        {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

        <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Predefinidas · no editables</h3>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {UNIDADES_MEDIDA_PREDEFINIDAS.map((unidad) => (
            <div key={unidad.valor} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
              {unidad.nombre}
            </div>
          ))}
        </div>

        <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Personalizadas</h3>
        {unidades.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">Aún no has agregado unidades.</p>
        ) : (
          <ul className="space-y-2">
            {unidades.map((unidad) => {
              const cantidadProductos = productos.filter((producto) =>
                normalizarNombreUnidad(producto.unidad) === normalizarNombreUnidad(unidad.nombre)
              ).length;
              const enEdicion = editandoId === unidad.id;
              const confirmaEliminar = eliminandoId === unidad.id;
              return (
                <li key={unidad.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
                  {enEdicion ? (
                    <>
                      <input
                        autoFocus
                        value={nombreEditado}
                        onChange={(evento) => setNombreEditado(evento.target.value)}
                        maxLength={40}
                        aria-label={`Nuevo nombre para ${unidad.nombre}`}
                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button type="button" disabled={guardando || !nombreEditado.trim()} onClick={() => void guardarEdicion(unidad.id)} aria-label="Guardar nombre" className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/30">
                        <Check size={16} />
                      </button>
                      <button type="button" onClick={() => { setEditandoId(null); setError(""); }} aria-label="Cancelar edición" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X size={16} />
                      </button>
                    </>
                  ) : confirmaEliminar ? (
                    <>
                      <span className="min-w-0 flex-1 text-xs text-slate-700 dark:text-slate-200">¿Eliminar <strong>{unidad.nombre}</strong>?</span>
                      <button type="button" disabled={guardando} onClick={() => void eliminar(unidad.id)} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30">Eliminar</button>
                      <button type="button" onClick={() => setEliminandoId(null)} aria-label="Cancelar eliminación" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{unidad.nombre}</span>
                      <span className="text-[10px] text-slate-400">{cantidadProductos ? `${cantidadProductos} producto(s)` : ""}</span>
                      <button type="button" onClick={() => { setError(""); setEditandoId(unidad.id); setNombreEditado(unidad.nombre); }} aria-label={`Editar ${unidad.nombre}`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <Pencil size={14} />
                      </button>
                      <button type="button" disabled={cantidadProductos > 0} onClick={() => { setError(""); setEliminandoId(unidad.id); }} aria-label={`Eliminar ${unidad.nombre}`} title={cantidadProductos ? "Cambia primero la unidad de los productos que la usan" : "Eliminar unidad"} className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/30">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={alCerrar} className="h-8 rounded-lg px-3 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cerrar</button>
        </div>
      </section>
    </div>
  );
}
