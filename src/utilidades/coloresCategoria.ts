import {
  ShoppingCart,
  CupSoda,
  Wrench,
  Sparkles,
  Milk,
  Pill,
  Beef,
  Tag,
  type LucideIcon,
} from "lucide-react";

export const PALETA_CATEGORIAS = [
  "#f97316",
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#38bdf8",
  "#a855f7",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#84cc16",
  "#14b8a6",
  "#e11d48",
];

export const CATEGORIAS_INICIALES: { nombre: string; color: string }[] = [
  { nombre: "Abarrotes", color: "#f97316" },
  { nombre: "Bebidas", color: "#3b82f6" },
  { nombre: "Ferretería", color: "#ef4444" },
  { nombre: "Limpieza", color: "#22c55e" },
  { nombre: "Lácteos", color: "#38bdf8" },
  { nombre: "Farmacia", color: "#a855f7" },
];

const ICONOS: Record<string, LucideIcon> = {
  abarrotes: ShoppingCart,
  bebidas: CupSoda,
  ferretería: Wrench,
  ferreteria: Wrench,
  limpieza: Sparkles,
  lácteos: Milk,
  lacteos: Milk,
  farmacia: Pill,
  carnes: Beef,
};

export function iconoCategoria(nombre: string): LucideIcon {
  return ICONOS[nombre.toLowerCase()] ?? Tag;
}

export function siguienteColor(usados: string[]): string {
  const encontrado = PALETA_CATEGORIAS.find(
    (color) => !usados.some((u) => u.toLowerCase() === color.toLowerCase())
  );
  return encontrado ?? PALETA_CATEGORIAS[usados.length % PALETA_CATEGORIAS.length];
}

export function colorTextoSobre(hex: string): string {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  return luma > 165 ? "#0f172a" : "#ffffff";
}

export function colorConAlpha(hex: string, alpha: number): string {
  const limpio = hex.replace("#", "");
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
