// src/servicios/impresoraEtiquetas.ts
export type PuertoImpresora = "USB" | "Bluetooth" | "Red (TCP/IP)" | "Compartida Windows";
export type TamanioEtiqueta = "58mm" | "80mm" | "100x150mm" | "Personalizado";

export interface ImpresoraModelo {
  id: string;
  modelo: string;
  fabricante: string;
  puerto: PuertoImpresora;
  tamanio: TamanioEtiqueta;
  descripcion: string;
}

export const MODELOS_BASE_IMPRESORA: ImpresoraModelo[] = [
  {
    id: "xprinter-xp-420b",
    modelo: "Xprinter XP-420B",
    fabricante: "Xprinter",
    puerto: "USB",
    tamanio: "100x150mm",
    descripcion: "Impresora térmica directa estándar para guías y códigos."
  },
  {
    id: "zebra-zd421",
    modelo: "Zebra ZD421",
    fabricante: "Zebra",
    puerto: "USB",
    tamanio: "100x150mm",
    descripcion: "Alta fiabilidad industrial y volumen de impresión."
  },
  {
    id: "generica-58mm",
    modelo: "Térmica Genérica 58mm",
    fabricante: "Genérica",
    puerto: "USB",
    tamanio: "58mm",
    descripcion: "Impresora de tickets pequeña usada para mini etiquetas."
  }
];

export const PUERTOS_IMPRESORA: PuertoImpresora[] = ["USB", "Bluetooth", "Red (TCP/IP)", "Compartida Windows"];
export const TAMANIOS_ETIQUETA: TamanioEtiqueta[] = ["58mm", "80mm", "100x150mm", "Personalizado"];

export function obtenerModelosImpresora(): ImpresoraModelo[] {
  try {
    const guardados = localStorage.getItem("modelos_impresora_custom");
    if (guardados) return [...MODELOS_BASE_IMPRESORA, ...JSON.parse(guardados)];
  } catch (error) {
    console.error("Error al leer impresoras personalizadas", error);
  }
  return MODELOS_BASE_IMPRESORA;
}

export function agregarModeloImpresora(nuevoModelo: ImpresoraModelo) {
  const actuales = obtenerModelosImpresora();
  const personalizados = actuales.filter(m => !MODELOS_BASE_IMPRESORA.find(b => b.id === m.id));
  
  if (!personalizados.find(p => p.id === nuevoModelo.id)) {
    personalizados.push(nuevoModelo);
    localStorage.setItem("modelos_impresora_custom", JSON.stringify(personalizados));
  }
}

export function detectarImpresoraDesdeDriver() {
  const usbSoportado = typeof navigator !== "undefined" && "usb" in navigator;
  
  if (usbSoportado) {
    return {
      detectado: true,
      mensaje: "Se detectó soporte USB en el navegador. Asegúrate de tener encendida la impresora."
    };
  }
  return {
    detectado: false,
    mensaje: "Tu navegador no soporta API WebUSB nativa. Dependerás de los drivers del sistema operativo."
  };
}