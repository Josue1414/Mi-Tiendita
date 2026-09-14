// src/servicios/escaner.ts
export type DriverEscaner = "USB HID" | "Serial COM" | "Bluetooth" | "TCP/IP" | "Cámara" | "WebUSB";
export type TipoEscaner = "Teclado HID" | "Serial" | "Bluetooth" | "Cámara" | "Red";

export interface EscanerModelo {
  id: string;
  modelo: string;
  fabricante: string;
  driver: DriverEscaner;
  tipo: TipoEscaner;
  puerto: string;
  descripcion: string;
}

// Renombramos la constante para usarla como base
export const MODELOS_BASE: EscanerModelo[] = [
  {
    id: "zebra-ds2208",
    modelo: "Zebra DS2208",
    fabricante: "Zebra",
    driver: "USB HID",
    tipo: "Teclado HID",
    puerto: "USB",
    descripcion: "Escáner 2D de sobremesa muy estable para cajas y inventario."
  },
  {
    id: "honeywell-voyager-1200g",
    modelo: "Honeywell Voyager 1200g",
    fabricante: "Honeywell",
    driver: "USB HID",
    tipo: "Teclado HID",
    puerto: "USB",
    descripcion: "Escáner de mano clásico compatible con modo teclado HID."
  },
  {
    id: "symbol-ls2208",
    modelo: "Motorola/Symbol LS2208",
    fabricante: "Motorola",
    driver: "USB HID",
    tipo: "Teclado HID",
    puerto: "USB",
    descripcion: "Escáner handheld para retail y back-office."
  },
  {
    id: "metrologic-sp550",
    modelo: "Metrologic SP550",
    fabricante: "Metrologic",
    driver: "Serial COM",
    tipo: "Serial",
    puerto: "COM",
    descripcion: "Escáner con salida serial para integraciones locales."
  },
  {
    id: "socket-scan",
    modelo: "Socket Mobile Scan",
    fabricante: "Socket Mobile",
    driver: "Bluetooth",
    tipo: "Bluetooth",
    puerto: "Bluetooth",
    descripcion: "Escáner móvil por Bluetooth para tablets y móviles."
  },
  {
    id: "cognex-dataman",
    modelo: "Cognex DataMan",
    fabricante: "Cognex",
    driver: "USB HID",
    tipo: "Teclado HID",
    puerto: "USB",
    descripcion: "Escáner industrial 1D/2D para líneas y producción."
  }
];

export const DRIVERS_ESCANER: DriverEscaner[] = [
  "USB HID",
  "Serial COM",
  "Bluetooth",
  "TCP/IP",
  "Cámara",
  "WebUSB"
];

export const PUERTOS_ESCANER = ["USB", "COM", "Bluetooth", "TCP/IP", "Cámara"];

export const TIPOS_ESCANER: TipoEscaner[] = [
  "Teclado HID",
  "Serial",
  "Bluetooth",
  "Cámara",
  "Red"
];

// Novedad: Obtiene los modelos base + los que agregues dinámicamente
export function obtenerModelosEscaner(): EscanerModelo[] {
  try {
    const guardados = localStorage.getItem("modelos_escaner_custom");
    if (guardados) {
      return [...MODELOS_BASE, ...JSON.parse(guardados)];
    }
  } catch (error) {
    console.error("Error al leer modelos personalizados", error);
  }
  return MODELOS_BASE;
}

// Novedad: Permite guardar un nuevo modelo descargado o creado
export function agregarModeloEscaner(nuevoModelo: EscanerModelo) {
  const actuales = obtenerModelosEscaner();
  const personalizados = actuales.filter(m => !MODELOS_BASE.find(b => b.id === m.id));
  
  // Evitar duplicados
  if (!personalizados.find(p => p.id === nuevoModelo.id)) {
    personalizados.push(nuevoModelo);
    localStorage.setItem("modelos_escaner_custom", JSON.stringify(personalizados));
  }
}

export interface ResultadoDeteccionEscaner {
  modelo: string;
  fabricante: string;
  driver: DriverEscaner;
  tipo: TipoEscaner;
  puerto: string;
  detectado: boolean;
  mensaje: string;
}

export function detectarEscanerDesdeDriver(): ResultadoDeteccionEscaner {
  const generador = typeof window !== "undefined" && window.navigator ? window.navigator.userAgent : "";
  const serialSoportado = typeof navigator !== "undefined" && "serial" in navigator;
  const usbSoportado = typeof navigator !== "undefined" && "usb" in navigator;

  if (serialSoportado || usbSoportado) {
    return {
      modelo: "Zebra DS2208",
      fabricante: "Zebra",
      driver: "USB HID",
      tipo: "Teclado HID",
      puerto: "USB",
      detectado: true,
      mensaje: "Interfaz compatible detectada. Recuerda: los escáneres USB funcionan solos, solo dispara."
    };
  }

  if (generador.toLowerCase().includes("mobile")) {
    return {
      modelo: "Socket Mobile Scan",
      fabricante: "Socket Mobile",
      driver: "Bluetooth",
      tipo: "Bluetooth",
      puerto: "Bluetooth",
      detectado: true,
      mensaje: "Se detectó un entorno móvil. Utiliza la cámara o conecta por Bluetooth."
    };
  }

  return {
    modelo: "Genérico",
    fabricante: "Desconocido",
    driver: "USB HID",
    tipo: "Teclado HID",
    puerto: "USB",
    detectado: false,
    mensaje: "Si usas un escáner USB físico, no requieres configuración. Simplemente escanea."
  };
}