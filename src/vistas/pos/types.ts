// src/vistas/pos/types.ts
export type ModoVistaPOS = "cuadricula" | "escaner" | "camara";

export interface DatosNuevoDeudor {
  nombre: string;
  celular: string;
  notas: string;
}

export interface ItemResaltadoPOS {
  id: string;
  version: number;
}
