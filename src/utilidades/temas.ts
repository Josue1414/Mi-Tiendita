export type TemaVisual = "verde" | "claro" | "oscuro" | "grafito";

export const TEMAS_VISUALES: Array<{ id: TemaVisual; nombre: string; descripcion: string; muestra: string }> = [
  { id: "verde", nombre: "Verde", descripcion: "La identidad actual de Mi Tienda", muestra: "bg-emerald-700" },
  { id: "claro", nombre: "Claro", descripcion: "Superficie luminosa y neutra", muestra: "bg-slate-100" },
  { id: "oscuro", nombre: "Oscuro", descripcion: "Contraste profundo para trabajar", muestra: "bg-black" },
  { id: "grafito", nombre: "Grafito", descripcion: "Oscuro suave con matiz mineral", muestra: "bg-zinc-900" },
];

const CLAVE_TEMA = "mi_tienda_tema_visual";
export const EVENTO_TEMA = "mi-tienda-tema-cambiado";

export const obtenerTemaVisual = (): TemaVisual => {
  const tema = localStorage.getItem(CLAVE_TEMA);
  return TEMAS_VISUALES.some((opcion) => opcion.id === tema) ? tema as TemaVisual : "verde";
};

export const guardarTemaVisual = (tema: TemaVisual) => {
  localStorage.setItem(CLAVE_TEMA, tema);
  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: tema }));
};

export const claseTemaVisual = (tema: TemaVisual) => {
  switch (tema) {
    case "claro": return "bg-slate-100 text-slate-900";
    case "oscuro": return "bg-black text-white";
    case "grafito": return "bg-zinc-900 text-zinc-100";
    default: return "bg-emerald-100 text-slate-900";
  }
};