import { useEffect, useState } from "react";
import { CheckCircle2, CloudSun, Heart, Moon, Palette, Sparkles, Sun, Type } from "lucide-react";
import { cn } from "../../utilidades/utils";
import { EVENTO_TEMA, guardarTemaVisual, obtenerTemaVisual, TEMAS_VISUALES, type TemaVisual } from "../../utilidades/temas";
import AyudaContextual from "./AyudaContextual";

const OPCIONES_ESCALA = [
  { id: "chica", nombre: "Chica" },
  { id: "normal", nombre: "Normal" },
  { id: "grande", nombre: "Grande" },
] as const;

export default function PreferenciasVisuales() {
  const [temaVisual, setTemaVisual] = useState<TemaVisual>(() => obtenerTemaVisual());
  const [escalaActual, setEscalaActual] = useState(() => localStorage.getItem("escala_ui") || "normal");

  useEffect(() => {
    const alCambiarTema = (evento: Event) => {
      const tema = (evento as CustomEvent<TemaVisual>).detail;
      if (tema) setTemaVisual(tema);
    };
    const alCambiarEscala = (evento: Event) => {
      const escala = (evento as CustomEvent<string>).detail;
      if (escala) setEscalaActual(escala);
    };

    window.addEventListener(EVENTO_TEMA, alCambiarTema);
    window.addEventListener("CAMBIAR_ESCALA_UI", alCambiarEscala);
    return () => {
      window.removeEventListener(EVENTO_TEMA, alCambiarTema);
      window.removeEventListener("CAMBIAR_ESCALA_UI", alCambiarEscala);
    };
  }, []);

  const cambiarEscala = (escala: string) => {
    setEscalaActual(escala);
    localStorage.setItem("escala_ui", escala);
    window.dispatchEvent(new CustomEvent("CAMBIAR_ESCALA_UI", { detail: escala }));
  };

  const cambiarTema = (tema: TemaVisual) => {
    setTemaVisual(tema);
    guardarTemaVisual(tema);
    document.documentElement.classList.toggle("dark", tema === "oscuro" || tema === "grafito" || tema === "neon");
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <Type size={18} className="text-indigo-600 dark:text-indigo-400" />
              Tamaño de la Interfaz
              <AyudaContextual etiqueta="Tamaño de la interfaz" texto="Cambia el tamaño global del texto y de algunos controles. La preferencia se guarda en este dispositivo y puedes volver a cambiarla cuando quieras." />
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ajusta el tamaño global de las letras y botones en este dispositivo.
            </p>
          </div>
          <div className="grid w-full grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 lg:flex lg:w-fit">
            {OPCIONES_ESCALA.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                aria-pressed={escalaActual === opcion.id}
                onClick={() => cambiarEscala(opcion.id)}
                className={cn(
                  "min-w-0 rounded-lg px-2 py-2 text-center text-xs font-bold transition-all lg:px-3 lg:py-1.5",
                  escalaActual === opcion.id
                    ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                {opcion.nombre}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-400">Preferencia local: no modifica los datos compartidos de la tienda.</p>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <Palette size={18} className="text-emerald-600 dark:text-emerald-400" />
            Apariencia de la aplicación
            <AyudaContextual etiqueta="Apariencia de la aplicación" texto="Elige el tema de colores que se usará en esta aplicación. Puedes cambiarlo en cualquier momento; no modifica los datos de la tienda." />
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Elige el tema de colores para esta aplicación en este dispositivo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEMAS_VISUALES.map((tema) => {
            const seleccionado = temaVisual === tema.id;
            return (
              <button
                key={tema.id}
                type="button"
                aria-pressed={seleccionado}
                onClick={() => cambiarTema(tema.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                  seleccionado
                    ? tema.id === "neon"
                      ? "border-fuchsia-500 bg-fuchsia-50 ring-2 ring-fuchsia-500/20 dark:border-fuchsia-400 dark:bg-fuchsia-900/20"
                      : tema.id === "rosa-kawaii"
                        ? "border-pink-400 bg-pink-50 ring-2 ring-pink-300/40"
                        : "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-900/20"
                    : "border-slate-200 bg-white hover:border-emerald-300 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-emerald-700",
                )}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-inner", tema.muestra)}>
                  {tema.id === "claro" ? <Sun size={16} /> : tema.id === "azul-claro" ? <CloudSun size={16} /> : tema.id === "verde" ? <Palette size={16} /> : tema.id === "neon" ? <Sparkles size={16} /> : tema.id === "rosa-kawaii" ? <Heart size={16} /> : <Moon size={16} />}
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm text-slate-800 dark:text-slate-100">{tema.nombre}</strong>
                  <small className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{tema.descripcion}</small>
                </span>
                {seleccionado && (
                  <CheckCircle2
                    size={16}
                    className={cn(
                      "ml-auto shrink-0",
                      tema.id === "rosa-kawaii"
                        ? "text-pink-500"
                        : tema.id === "neon"
                          ? "text-fuchsia-500 dark:text-fuchsia-400"
                          : "text-emerald-600 dark:text-emerald-400",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
