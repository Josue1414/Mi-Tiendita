// src/servicios/db.ts
import { openDB } from "idb";

const DB_NOMBRE = "mitiendita_db";
const DB_VERSION = 2; // Incrementada para soportar nuevas tablas

const puedeGuardarCopiaLocal = () => {
  if (!window.apiLocal) return true;
  const tiendaId = localStorage.getItem("tienda_id");
  return tiendaId !== null && localStorage.getItem(`mi_tienda_es_cerebro:${tiendaId}`) === "true";
};

export interface PendienteSync {
  id: string;
  tabla: string;
  operacion: 'AGREGAR' | 'ACTUALIZAR' | 'ELIMINAR';
  payload: any;
  timestamp: number;
}

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
      if (!db.objectStoreNames.contains("categorias")) {
        db.createObjectStore("categorias", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("ventas")) {
        db.createObjectStore("ventas", { keyPath: "id" });
      }
      // Nueva tabla para operaciones offline
      if (!db.objectStoreNames.contains("pendientes_sync")) {
        db.createObjectStore("pendientes_sync", { keyPath: "id" });
      }
    },
  });
};

export const guardarRegistro = async (tabla: string, dato: any) => {
  if (window.apiLocal) {
    if (!puedeGuardarCopiaLocal()) return;
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

  const db = await initDB();
  await db.put(tabla, dato);
};

export const obtenerRegistros = async (tabla: string) => {
  if (window.apiLocal) {
    if (!puedeGuardarCopiaLocal()) return [];
    const datos = await window.apiLocal.leerDatos(tabla);
    return datos;
  }

  const db = await initDB();
  return db.getAll(tabla);
};

export const eliminarRegistro = async (tabla: string, id: string) => {
  if (window.apiLocal) {
    if (!puedeGuardarCopiaLocal()) return;
    const todosLosRegistros = await obtenerRegistros(tabla);
    const filtrados = todosLosRegistros.filter((r: any) => r.id !== id);
    await window.apiLocal.guardarDatos(tabla, filtrados);
    return;
  }

  const db = await initDB();
  await db.delete(tabla, id);
};

// --- NUEVAS FUNCIONES PARA COLA DE SINCRONIZACIÓN OFFLINE ---

export const registrarPendienteSync = async (pendiente: Omit<PendienteSync, 'id' | 'timestamp'>) => {
  const registroCompleto: PendienteSync = {
    ...pendiente,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  };
  await guardarRegistro("pendientes_sync", registroCompleto);
};

export const obtenerPendientesSync = async (): Promise<PendienteSync[]> => {
  const pendientes = await obtenerRegistros("pendientes_sync");
  // Ordenar del más antiguo al más reciente para procesarlos en orden cronológico
  return pendientes.sort((a: PendienteSync, b: PendienteSync) => a.timestamp - b.timestamp);
};

export const eliminarPendienteSync = async (id: string) => {
  await eliminarRegistro("pendientes_sync", id);
};