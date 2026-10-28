// src/servicios/baseDatosLocal.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Producto } from "../tipos/producto";
import type { Fiado } from "../estado/estadoFiados";
import type { Venta } from "../estado/estadoVentas";

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
  fiados: { 
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
  const nombreArchivo = id.includes("__") ? id.slice(id.indexOf("__") + 2) : id;
  const blob = await db.get("imagenes", id) ?? await db.get("imagenes", nombreArchivo);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// NUEVO: Funciones para compartir imágenes por LAN
export async function obtenerImagenLocalBruta(id: string): Promise<Blob | undefined> {
  const db = await inicializarDB();
  const nombreArchivo = id.includes("__") ? id.slice(id.indexOf("__") + 2) : id;
  return (await db.get("imagenes", id)) ?? (await db.get("imagenes", nombreArchivo));
}

export async function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function base64ABlob(base64: string): Promise<Blob> {
  const respuesta = await fetch(base64);
  return await respuesta.blob();
}

// --- UTILIDADES PARA FIADOS ---

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

export async function limpiarBaseDatosLocal() {
  const db = await inicializarDB();
  await db.clear("productos");
  await db.clear("imagenes");
  await db.clear("fiados"); 
  await db.clear("ventasFiado");
}

export async function limpiarCacheImagenesLocales() {
  const db = await inicializarDB();
  await db.clear("imagenes");
  console.log("Caché de imágenes liberado con éxito.");
}