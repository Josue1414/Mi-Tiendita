// src/servicios/bascula.ts
export type PuertoBascula = "USB" | "Serial COM" | "Bluetooth" | "TCP/IP";
export type BaudRateBascula = "9600" | "19200" | "38400" | "57600";
export type FormatoBascula = "serial" | "text" | "csv" | "scale";
export type UnidadBascula = "kg" | "g" | "lb";

export interface BasculaModeloConfig {
  id: string;
  modelo: string;
  puerto: PuertoBascula;
  baudRate: BaudRateBascula;
  formato: FormatoBascula;
  unidad: UnidadBascula;
}

export const MODELOS_BASE_BASCULA: BasculaModeloConfig[] = [
  { id: "ohaus-valor-2000", modelo: "Ohaus Valor 2000", puerto: "USB", baudRate: "9600", formato: "text", unidad: "kg" },
  { id: "ohaus-scout-pro", modelo: "Ohaus Scout Pro", puerto: "Serial COM", baudRate: "9600", formato: "serial", unidad: "kg" },
  { id: "cas-sw-1", modelo: "CAS SW-1", puerto: "USB", baudRate: "9600", formato: "scale", unidad: "kg" },
  { id: "mettler-toledo", modelo: "Mettler Toledo PB", puerto: "Serial COM", baudRate: "19200", formato: "text", unidad: "kg" }
];

export const PUERTOS_BASCULA: PuertoBascula[] = ["USB", "Serial COM", "Bluetooth", "TCP/IP"];
export const BAUD_RATES_BASCULA: BaudRateBascula[] = ["9600", "19200", "38400", "57600"];
export const FORMATOS_BASCULA: FormatoBascula[] = ["serial", "text", "csv", "scale"];
export const UNIDADES_BASCULA: UnidadBascula[] = ["kg", "g", "lb"];

export function obtenerModelosBascula(): BasculaModeloConfig[] {
  try {
    const guardados = localStorage.getItem("modelos_bascula_custom");
    if (guardados) return [...MODELOS_BASE_BASCULA, ...JSON.parse(guardados)];
  } catch (error) {
    console.error("Error al leer básculas personalizadas", error);
  }
  return MODELOS_BASE_BASCULA;
}

export function agregarModeloBascula(nuevoModelo: BasculaModeloConfig) {
  const actuales = obtenerModelosBascula();
  const personalizados = actuales.filter(m => !MODELOS_BASE_BASCULA.find(b => b.id === m.id));
  
  if (!personalizados.find(p => p.id === nuevoModelo.id)) {
    personalizados.push(nuevoModelo);
    localStorage.setItem("modelos_bascula_custom", JSON.stringify(personalizados));
  }
}

export function detectarBasculaDesdeDriver() {
  const serialSoportado = typeof navigator !== "undefined" && "serial" in navigator;
  
  if (serialSoportado) {
    return {
      detectado: true,
      mensaje: "Se detectó soporte Serial/USB. Asegúrate de configurar los baudios correctos para la lectura."
    };
  }
  return {
    detectado: false,
    mensaje: "Tu navegador no soporta la API Web Serial. Verifica la conexión o usa la app nativa."
  };
}