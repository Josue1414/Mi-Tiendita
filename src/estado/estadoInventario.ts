// src/estado/estadoInventario.ts
import { create } from "zustand";
import type { Categoria, Producto } from "../tipos/producto";
import { guardarRegistro, obtenerRegistros, eliminarRegistro } from "../servicios/db";
import { CATEGORIAS_INICIALES, siguienteColor } from "../utilidades/coloresCategoria";

interface EstadoInventario {
  productos: Producto[];
  categorias: Categoria[];
  cargando: boolean;
  cargarProductos: () => Promise<void>;
  agregarProducto: (producto: Producto) => Promise<void>;
  actualizarProducto: (producto: Producto) => Promise<void>;
  eliminarProducto: (id: string) => Promise<void>;
  agregarCategoria: (nombre: string, color?: string) => Promise<Categoria | null>;
  eliminarCategoria: (id: string) => Promise<void>;
  descontarStock: (items: Array<{ producto_id: string; cantidad: number }>) => Promise<void>;
}

export const useEstadoInventario = create<EstadoInventario>((set, get) => ({
  productos: [],
  categorias: [],
  cargando: true,

  cargarProductos: async () => {
    set({ cargando: true });
    try {
      const data = await obtenerRegistros("productos");
      const productos = (data as Producto[]).map((p) => ({
        ...p,
        descuento_porcentaje: p.descuento_porcentaje ?? 0,
      }));

      const categoriasGuardadas = (await obtenerRegistros("categorias")) as Categoria[];
      const categoriasUnicas = new Map<string, Categoria>();
      for (const categoria of categoriasGuardadas) {
        const clave = categoria.nombre.trim().toLocaleLowerCase();
        if (clave && !categoriasUnicas.has(clave)) categoriasUnicas.set(clave, { ...categoria, nombre: categoria.nombre.trim() });
      }
      const categorias = [...categoriasUnicas.values()];
      if (categorias.length === 0) {
        const categoriasIniciales = CATEGORIAS_INICIALES.map((c) => ({
          id: crypto.randomUUID(),
          nombre: c.nombre,
          color: c.color,
        }));
        for (const categoria of categoriasIniciales) {
          await guardarRegistro("categorias", categoria);
        }
        set({ productos, categorias: categoriasIniciales, cargando: false });
        return;
      }

      set({ productos, categorias, cargando: false });
    } catch (error) {
      console.error("Error al cargar productos desde la base de datos:", error);
      set({ cargando: false });
    }
  },

  agregarProducto: async (producto) => {
    try {
      await guardarRegistro("productos", producto);
      set((estado) => ({ productos: [...estado.productos, producto] }));
    } catch (error) {
      console.error("Error al guardar producto:", error);
    }
  },

  actualizarProducto: async (productoActualizado) => {
    try {
      await guardarRegistro("productos", productoActualizado);
      set((estado) => ({
        productos: estado.productos.map((p) => (p.id === productoActualizado.id ? productoActualizado : p)),
      }));
    } catch (error) {
      console.error("Error al actualizar producto:", error);
    }
  },

  eliminarProducto: async (id) => {
    try {
      await eliminarRegistro("productos", id);
      set((estado) => ({
        productos: estado.productos.filter((p) => p.id !== id),
      }));
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  },

  agregarCategoria: async (nombre, color) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return null;

    const existente = get().categorias.find(
      (c) => c.nombre.toLowerCase() === nombreLimpio.toLowerCase()
    );
    if (existente) return existente;

    const nueva: Categoria = {
      id: crypto.randomUUID(),
      nombre: nombreLimpio,
      color: color || siguienteColor(get().categorias.map((c) => c.color)),
    };

    try {
      await guardarRegistro("categorias", nueva);
      set((estado) => ({ categorias: [...estado.categorias, nueva] }));
      return nueva;
    } catch (error) {
      console.error("Error al guardar categoría:", error);
      return null;
    }
  },

  eliminarCategoria: async (id) => {
    try {
      const categoria = get().categorias.find((c) => c.id === id);
      if (!categoria) return;
      const productosActualizados = get().productos.map((producto) =>
        producto.categoria.trim().toLocaleLowerCase() === categoria.nombre.trim().toLocaleLowerCase()
          ? { ...producto, categoria: "" }
          : producto
      );
      for (const producto of productosActualizados) {
        const productoAnterior = get().productos.find((p) => p.id === producto.id);
        if (productoAnterior?.categoria !== producto.categoria) await guardarRegistro("productos", producto);
      }
      await eliminarRegistro("categorias", id);
      set((estado) => ({
        productos: productosActualizados,
        categorias: estado.categorias.filter((c) => c.id !== id),
      }));
    } catch (error) {
      console.error("Error al eliminar categoría:", error);
    }
  },

  descontarStock: async (items) => {
    try {
      const productosActualizados = get().productos.map((producto) => {
        const item = items.find((entrada) => entrada.producto_id === producto.id);
        if (!item || !producto.controla_stock) return producto;
        return {
          ...producto,
          stock_actual: Math.max(0, producto.stock_actual - item.cantidad),
        };
      });
      for (const producto of productosActualizados) {
        const productoAnterior = get().productos.find((p) => p.id === producto.id);
        if (productoAnterior?.stock_actual !== producto.stock_actual) await guardarRegistro("productos", producto);
      }
      set({ productos: productosActualizados });
    } catch (error) {
      console.error("Error al descontar stock:", error);
      throw error;
    }
  },
}));
