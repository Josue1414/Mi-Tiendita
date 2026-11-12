export const UNIDADES_MEDIDA_PREDEFINIDAS = [
  { valor: "PIEZA", nombre: "Pieza" },
  { valor: "PAQUETE", nombre: "Paquete" },
  { valor: "SOBRE", nombre: "Sobre" },
  { valor: "DOCENA", nombre: "Docena" },
  { valor: "DECENA", nombre: "Decena" },
  { valor: "KG", nombre: "Kilogramos (KG)" },
  { valor: "GRAMO", nombre: "Gramos (G)" },
  { valor: "LITRO", nombre: "Litros (L)" },
  { valor: "MILILITRO", nombre: "Mililitros (ML)" },
  { valor: "MILIGRAMO", nombre: "Miligramos (MG)" },
] as const;

export const UNIDADES_GRANEL = ["KG", "GRAMO", "LITRO", "MILILITRO", "MILIGRAMO"];

export const normalizarNombreUnidad = (nombre: string) =>
  nombre.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
