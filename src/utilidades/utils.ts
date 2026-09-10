import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind de forma segura, resolviendo conflictos.
 * Fundamental para construir componentes UI reutilizables.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generarIdCompra(): string {
  const ahora = new Date();
  const anio = String(ahora.getFullYear()).slice(-2);
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");

  const alfanumeros = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let sufijo = "";
  for (let i = 0; i < 4; i += 1) {
    sufijo += alfanumeros[Math.floor(Math.random() * alfanumeros.length)];
  }

  return `${anio}A${mes}BB${dia}A${sufijo}`.toUpperCase();
}