// src/utilidades/temas.ts
export type TemaVisual = "verde" | "claro" | "azul-claro" | "oscuro" | "grafito" | "neon" | "rosa-kawaii";

export const TEMAS_VISUALES: Array<{ id: TemaVisual; nombre: string; descripcion: string; muestra: string }> = [
  { id: "verde", nombre: "Verde", descripcion: "La identidad actual de Mi Tienda", muestra: "bg-emerald-700" },
  { id: "claro", nombre: "Claro", descripcion: "Superficie luminosa y neutra", muestra: "bg-slate-100" },
  { id: "azul-claro", nombre: "Azul claro", descripcion: "Azul tenue y relajante", muestra: "bg-sky-200" },
  { id: "oscuro", nombre: "Oscuro", descripcion: "Contraste profundo para trabajar", muestra: "bg-black" },
  { id: "grafito", nombre: "Grafito", descripcion: "Oscuro suave con matiz mineral", muestra: "bg-zinc-900" },
  { id: "neon", nombre: "Neón", descripcion: "Noche violeta con acentos eléctricos", muestra: "muestra-neon" },
  { id: "rosa-kawaii", nombre: "Rosa", descripcion: "Rosa pastel dulce y luminoso", muestra: "muestra-rosa-kawaii" },
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
    case "claro": return "tema-claro bg-slate-200 text-slate-900";
    case "azul-claro": return "tema-azul-claro bg-sky-100 text-slate-900";
    case "oscuro": return "bg-black text-white";
    case "grafito": return "bg-zinc-900 text-zinc-100";
    case "neon": return "tema-neon bg-[#09051b] text-violet-50";
    case "rosa-kawaii": return "tema-rosa-kawaii bg-[#fff1f7] text-slate-800";
    default: return "bg-emerald-100 text-slate-900";
  }
};