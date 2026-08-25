// src/servicios/db.ts
import { openDB } from "idb";

const DB_NOMBRE = "mitiendita_db";
const DB_VERSION = 1;

// Define la interfaz de nuestro puente de Electron para TypeScript
declare global {
  interface Window {
    apiLocal?: {
      guardarDatos: (tabla: string, datos: any) => Promise<{ exito: boolean; error?: string }>;
      leerDatos: (tabla: string) => Promise<any[]>;
      obtenerHardwareId: () => Promise<string>;
      validarSuscripcionOffline: () => Promise<{ activo: boolean; error?: string }>;
      sincronizarReloj: (fechaVencimiento: string) => Promise<{ exito: boolean; error?: string }>;
    };
  }
}

// Inicializamos IndexedDB como respaldo (para navegador)
const initDB = async () => {
  return openDB(DB_NOMBRE, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("trabajadores")) {
        db.createObjectStore("trabajadores", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("productos")) {
        db.createObjectStore("productos", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ventas")) {
        db.createObjectStore("ventas", { keyPath: "id" });
      }
    },
  });
};

export const guardarRegistro = async (tabla: string, dato: any) => {
  // Si estamos en la App de Windows, delegamos la seguridad a Electron
  if (window.apiLocal) {
    const todosLosRegistros = await obtenerRegistros(tabla);
    const index = todosLosRegistros.findIndex((r: any) => r.id === dato.id);
    
    if (index >= 0) {
      todosLosRegistros[index] = dato;
    } else {
      todosLosRegistros.push(dato);
    }
    
    await window.apiLocal.guardarDatos(tabla, todosLosRegistros);
    return;
  }

  // Respaldo en navegador (IndexedDB)
  const db = await initDB();
  await db.put(tabla, dato);
};

export const obtenerRegistros = async (tabla: string) => {
  // Leer desde la carpeta encriptada en Windows
  if (window.apiLocal) {
    const datos = await window.apiLocal.leerDatos(tabla);
    return datos;
  }

  // Respaldo en navegador
  const db = await initDB();
  return db.getAll(tabla);
};

export const eliminarRegistro = async (tabla: string, id: string) => {
  if (window.apiLocal) {
    const todosLosRegistros = await obtenerRegistros(tabla);
    const filtrados = todosLosRegistros.filter((r: any) => r.id !== id);
    await window.apiLocal.guardarDatos(tabla, filtrados);
    return;
  }

  const db = await initDB();
  await db.delete(tabla, id);
};