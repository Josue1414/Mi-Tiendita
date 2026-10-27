import { useEffect, useState } from "react";
import { EVENTO_TEMA, obtenerTemaVisual, type TemaVisual } from "../../utilidades/temas";

export default function useTemaYEscalaApp() {
  const [temaVisual, setTemaVisual] = useState<TemaVisual>(() => obtenerTemaVisual());
  const [escalaUI, setEscalaUI] = useState(() => localStorage.getItem("escala_ui") || "normal");

  useEffect(() => {
    const aplicarCambioEscala = (evento: Event) => {
      const nuevaEscala = (evento as CustomEvent<string>).detail;
      if (nuevaEscala) setEscalaUI(nuevaEscala);
    };
    window.addEventListener("CAMBIAR_ESCALA_UI", aplicarCambioEscala);
    return () => window.removeEventListener("CAMBIAR_ESCALA_UI", aplicarCambioEscala);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (escalaUI === "chica") root.style.fontSize = "14px";
    else if (escalaUI === "grande") root.style.fontSize = "18px";
    else root.style.fontSize = "16px";
  }, [escalaUI]);

  useEffect(() => {
    const aplicarTema = (evento: Event) => {
      const tema = (evento as CustomEvent<TemaVisual>).detail;
      if (tema) setTemaVisual(tema);
    };
    window.addEventListener(EVENTO_TEMA, aplicarTema);
    return () => window.removeEventListener(EVENTO_TEMA, aplicarTema);
  }, []);

  return temaVisual;
}
