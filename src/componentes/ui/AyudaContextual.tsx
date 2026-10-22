import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";

interface PropsAyudaContextual {
  texto: string;
  etiqueta: string;
}

export default function AyudaContextual({ texto, etiqueta }: PropsAyudaContextual) {
  const [abierta, setAbierta] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const ayudaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierta) return;

    const cerrarAlHacerClicFuera = (evento: PointerEvent) => {
      if (
        evento.target instanceof Node
        && !botonRef.current?.contains(evento.target)
        && !ayudaRef.current?.contains(evento.target)
      ) {
        setAbierta(false);
      }
    };
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierta(false);
    };

    document.addEventListener("pointerdown", cerrarAlHacerClicFuera);
    document.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.removeEventListener("pointerdown", cerrarAlHacerClicFuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierta]);

  useLayoutEffect(() => {
      if (!abierta) {
        setPosicion(null);
        return;
      }

      const actualizarPosicion = () => {
        const boton = botonRef.current;
        const ayuda = ayudaRef.current;
        if (!boton || !ayuda) return;

        const rectBoton = boton.getBoundingClientRect();
        const rectAyuda = ayuda.getBoundingClientRect();
        const margen = 12;
        const left = Math.max(
          margen,
          Math.min(rectBoton.left, window.innerWidth - rectAyuda.width - margen),
        );
        const top = rectBoton.bottom + rectAyuda.height + 8 <= window.innerHeight - margen
          ? rectBoton.bottom + 8
          : Math.max(margen, rectBoton.top - rectAyuda.height - 8);

        setPosicion({ top, left });
      };

      actualizarPosicion();
      window.addEventListener("resize", actualizarPosicion);
      window.addEventListener("scroll", actualizarPosicion, true);
      return () => {
        window.removeEventListener("resize", actualizarPosicion);
        window.removeEventListener("scroll", actualizarPosicion, true);
      };
  }, [abierta]);

  return (
      <span className="relative inline-flex shrink-0">
        <button
          ref={botonRef}
          type="button"
          aria-label={`Ayuda: ${etiqueta}`}
          aria-expanded={abierta}
          onClick={() => {
            setPosicion(null);
            setAbierta((valor) => !valor);
          }}
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-emerald-300"
        >
          {abierta ? <X size={16} /> : <CircleHelp size={17} />}
        </button>
        {abierta && (
          createPortal(
            <div
              ref={ayudaRef}
              role="note"
              style={{
                position: "fixed",
                top: posicion?.top ?? 0,
                left: posicion?.left ?? 0,
                visibility: posicion ? "visible" : "hidden",
              }}
              className="z-[200] max-h-[calc(100vh-1.5rem)] w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-600 shadow-xl dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            >
              {texto}
            </div>,
            document.body,
          )
        )}
      </span>
  );
}
