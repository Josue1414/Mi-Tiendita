import { useEffect } from "react";

export function useEscanerCodigoBarras(
  alEscanear: (codigo: string) => void,
  activo = true
) {
  useEffect(() => {
    if (!activo) return;

    let buffer = "";
    let ultimo = 0;

    const manejarTecla = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      const esCampo = destino && (destino.tagName === "INPUT" || destino.tagName === "TEXTAREA" || destino.tagName === "SELECT" || destino.isContentEditable);
      const esBusqueda = destino instanceof HTMLInputElement && destino.dataset.escaner === "true";

      if (esCampo && !esBusqueda) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const ahora = Date.now();
      if (ahora - ultimo > 80) buffer = "";
      ultimo = ahora;

      if (e.key === "Enter") {
        if (buffer.length >= 4) {
          e.preventDefault();
          alEscanear(buffer);
        }
        buffer = "";
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
  }, [alEscanear, activo]);
}
