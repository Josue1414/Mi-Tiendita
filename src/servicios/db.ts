// src/servicios/db.ts
import { openDB } from 'idb';

const DB_NAME = 'MiTiendaDB';
const DB_VERSION = 2;

// Inicializa y crea la estructura de la base de datos local
export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('productos')) {
        db.createObjectStore('productos', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('ventas')) {
        db.createObjectStore('ventas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trabajadores')) {
        db.createObjectStore('trabajadores', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('configuracion')) {
        db.createObjectStore('configuracion', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categorias')) {
        db.createObjectStore('categorias', { keyPath: 'id' });
      }
    },
  });
};

// Funciones genéricas reutilizables para cualquier "tabla" (store)
export const guardarRegistro = async (storeName: string, data: any) => {
  const db = await initDB();
  return db.put(storeName, data);
};

export const obtenerRegistros = async (storeName: string) => {
  const db = await initDB();
  return db.getAll(storeName);
};

export const eliminarRegistro = async (storeName: string, id: string) => {
  const db = await initDB();
  return db.delete(storeName, id);
};