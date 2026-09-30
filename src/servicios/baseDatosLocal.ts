// src/servicios/baseDatosLocal.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Producto } from "../tipos/producto";

// Estructura de nuestra base de datos local
interface BaseDatosMiTienda extends DBSchema {
  productos: {
    key: string; 
    value: Producto;
    indexes: { "por-codigo": string }; 
  };
  imagenes: {
    key: string;
    value: Blob; 
  };
}

let dbPromise: Promise<IDBPDatabase<BaseDatosMiTienda>>;

export function inicializarDB() {
  if (!dbPromise) {
    dbPromise = openDB<BaseDatosMiTienda>("MiTiendaLocal", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("productos")) {
          const store = db.createObjectStore("productos", { keyPath: "id" });
          store.createIndex("por-codigo", "codigo_barras", { unique: false });
        }
        if (!db.objectStoreNames.contains("imagenes")) {
          db.createObjectStore("imagenes");
        }
      },
    });
  }
  return dbPromise;
}

// --- UTILIDADES PARA PRODUCTOS ---

export async function guardarProductoLocal(producto: Producto) {
  const db = await inicializarDB();
  await db.put("productos", producto);
}

export async function obtenerTodosLosProductosLocales(): Promise<Producto[]> {
  const db = await inicializarDB();
  return await db.getAll("productos");
}

export async function buscarProductoPorCodigoLocal(codigo: string): Promise<Producto | undefined> {
  const db = await inicializarDB();
  return await db.getFromIndex("productos", "por-codigo", codigo);
}

// --- UTILIDADES PARA IMÁGENES ---

export async function guardarImagenLocal(id: string, archivo: Blob) {
  const db = await inicializarDB();
  await db.put("imagenes", archivo, id);
}

export async function obtenerUrlImagenLocal(id: string): Promise<string | null> {
  const db = await inicializarDB();
  const blob = await db.get("imagenes", id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// --- NUEVA FUNCIÓN: LIMPIEZA TOTAL ---
export async function limpiarBaseDatosLocal() {
  const db = await inicializarDB();
  await db.clear("productos");
  await db.clear("imagenes");
}