import type { LoteProducto } from "../tipos/producto";
import { crearIdentificadorUnico } from "./identificador";

export const DIAS_ALERTA_CADUCIDAD = 7;

export function estadoCaducidad(
  fechaCaducidad?: string,
  hoy = new Date(),
  diasAlerta = DIAS_ALERTA_CADUCIDAD,
): "vencido" | "proximo" | null {
  if (!fechaCaducidad || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCaducidad)) return null;
  const fecha = new Date(`${fechaCaducidad}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== fechaCaducidad) return null;

  const fechaHoy = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diasRestantes = Math.floor((fecha.getTime() - fechaHoy) / 86400000);
  if (diasRestantes < 0) return "vencido";
  const umbralAlerta = Number.isFinite(diasAlerta) ? Math.max(0, diasAlerta) : DIAS_ALERTA_CADUCIDAD;
  return diasRestantes <= umbralAlerta ? "proximo" : null;
}

export function ordenarLotesPorCaducidad(lotes: LoteProducto[]): LoteProducto[] {
  return [...lotes].sort((a, b) => {
    if (!a.fecha_caducidad) return b.fecha_caducidad ? 1 : 0;
    if (!b.fecha_caducidad) return -1;
    return a.fecha_caducidad.localeCompare(b.fecha_caducidad);
  });
}

export function descontarDeLotes(lotes: LoteProducto[] = [], cantidad: number): LoteProducto[] {
  let restante = Math.max(0, cantidad);
  return ordenarLotesPorCaducidad(lotes)
    .map((lote) => {
      if (restante <= 0 || lote.cantidad <= 0) return { ...lote };
      const descontado = Math.min(lote.cantidad, restante);
      restante -= descontado;
      return { ...lote, cantidad: lote.cantidad - descontado };
    });
}

export function ajustarLotes(
  lotes: LoteProducto[] = [],
  ajuste: number,
  opciones: { fechaCaducidad?: string; agregadoPor: string; diasAlerta?: number },
): LoteProducto[] {
  if (ajuste > 0) {
    const nuevoLote: LoteProducto = {
      id: crearIdentificadorUnico(),
      cantidad: ajuste,
      fecha_ingreso: new Date().toISOString().slice(0, 10),
      agregado_por: opciones.agregadoPor,
      dias_alerta: opciones.diasAlerta ?? DIAS_ALERTA_CADUCIDAD,
      ...(opciones.fechaCaducidad ? { fecha_caducidad: opciones.fechaCaducidad } : {}),
    };
    return [...lotes, nuevoLote];
  }
  if (ajuste < 0) return descontarDeLotes(lotes, Math.abs(ajuste));
  return [...lotes];
}
