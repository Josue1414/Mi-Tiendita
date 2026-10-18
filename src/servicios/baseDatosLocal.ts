// src/servicios/baseDatosLocal.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Producto } from "../tipos/producto";
import type { Fiado } from "../estado/estadoFiados"; // <-- NUEVA IMPORTACIÓN
import type { Venta } from "../estado/estadoVentas";

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
  fiados: { // <-- NUEVO ALMACÉN
    key: string;
    value: Fiado;
  };
  ventasFiado: {
    key: string;
    value: Venta;
  };
}

const dbPromises = new Map<string, Promise<IDBPDatabase<BaseDatosMiTienda>>>();

export function inicializarDB() {
  // En Android, IndexedDB usa el almacenamiento del origen de WebView dentro
  // del espacio privado de datos de la aplicación; no guarda datos en una SD extraíble.
  // Esto aplica a productos, fiados, ventas fiadas e imágenes almacenadas aquí.
  const tiendaId = typeof localStorage === "undefined" ? null : localStorage.getItem("tienda_id");
  const nombreDB = tiendaId ? `MiTiendaLocal_${encodeURIComponent(tiendaId)}` : "MiTiendaLocal_local";
  let dbPromise = dbPromises.get(nombreDB);

  if (!dbPromise) {
    dbPromise = openDB<BaseDatosMiTienda>(nombreDB, 3, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("productos")) {
          const store = db.createObjectStore("productos", { keyPath: "id" });
          store.createIndex("por-codigo", "codigo_barras", { unique: false });
        }
        if (!db.objectStoreNames.contains("imagenes")) {
          db.createObjectStore("imagenes");
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("fiados")) {
          db.createObjectStore("fiados", { keyPath: "id" });
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains("ventasFiado")) {
          db.createObjectStore("ventasFiado", { keyPath: "id" });
        }
      },
    });
    dbPromises.set(nombreDB, dbPromise);
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

// --- UTILIDADES PARA FIADOS (DEUDORES LOCALES) ---

export async function guardarFiadoLocal(fiado: Fiado) {
  const db = await inicializarDB();
  await db.put("fiados", fiado);
}

export async function obtenerTodosLosFiadosLocales(): Promise<Fiado[]> {
  const db = await inicializarDB();
  return await db.getAll("fiados");
}

export async function eliminarFiadoLocal(id: string) {
  const db = await inicializarDB();
  await db.delete("fiados", id);
}

export async function guardarVentaFiadoLocal(venta: Venta) {
  const db = await inicializarDB();
  await db.put("ventasFiado", venta);
}

export async function obtenerVentasFiadoLocales(): Promise<Venta[]> {
  const db = await inicializarDB();
  return await db.getAll("ventasFiado");
}

// --- LIMPIEZA TOTAL ---
export async function limpiarBaseDatosLocal() {
  const db = await inicializarDB();
  await db.clear("productos");
  await db.clear("imagenes");
  await db.clear("fiados"); // Limpiar también los fiados
  await db.clear("ventasFiado");
}