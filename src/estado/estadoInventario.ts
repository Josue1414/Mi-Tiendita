// src/estado/estadoInventario.ts
import { create } from "zustand";
import type { Categoria, Producto } from "../tipos/producto";
import { guardarRegistro, obtenerRegistros, eliminarRegistro } from "../servicios/db";
import { CATEGORIAS_INICIALES, siguienteColor } from "../utilidades/coloresCategoria";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

// Detección de entorno: Verifica si estamos en la app de escritorio (.exe) o en el navegador web
const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

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

// Mapeo: Frontend -> Supabase
const mapearProductoASupabase = (p: Producto, tiendaId: string) => ({
  id: p.id,
  tienda_id: tiendaId,
  barcode: p.codigo_barras,
  nombre: p.nombre,
  descripcion: p.descripcion || null,
  ubicacion: p.ubicacion || null,
  paquete: p.paquete || null,
  unidad: p.unidad,
  stock_actual: p.stock_actual,
  stock_minimo: p.stock_minimo,
  controla_stock: p.controla_stock,
  precio: p.precio,
  costo: p.costo,
  descuento_porcentaje: p.descuento_porcentaje,
  activo: p.activo,
  requiere_autorizacion: p.requiere_autorizacion,
  mensaje_autorizacion: p.mensaje_autorizacion || null,
  permite_foto_autorizacion: p.permite_foto_autorizacion,
  nombre_archivo_local: p.imagen_url || null
});

// Mapeo: Supabase -> Frontend
const mapearProductoDesdeSupabase = (p: any, categoriaNombre: string = ""): Producto => ({
  id: p.id,
  codigo_barras: p.barcode,
  nombre: p.nombre,
  descripcion: p.descripcion || "",
  ubicacion: p.ubicacion || "",
  paquete: p.paquete || "",
  categoria: categoriaNombre, 
  unidad: p.unidad,
  stock_actual: Number(p.stock_actual),
  stock_minimo: Number(p.stock_minimo),
  controla_stock: p.controla_stock,
  precio: Number(p.precio),
  costo: Number(p.costo),
  descuento_porcentaje: Number(p.descuento_porcentaje),
  activo: p.activo,
  requiere_autorizacion: p.requiere_autorizacion,
  mensaje_autorizacion: p.mensaje_autorizacion || "",
  permite_foto_autorizacion: p.permite_foto_autorizacion,
  imagen_url: p.nombre_archivo_local || undefined
});

export const useEstadoInventario = create<EstadoInventario>((set, get) => ({
  productos: [],
  categorias: [],
  cargando: true,

  cargarProductos: async () => {
    set({ cargando: true });
    try {
      let productosEstado: Producto[] = [];
      let categoriasEstado: Categoria[] = [];

      // 1. CARGA LOCAL (.exe únicamente)
      if (esEscritorio) {
        const dataLocal = await obtenerRegistros("productos");
        productosEstado = (dataLocal as Producto[]).map((p) => ({
          ...p, descuento_porcentaje: p.descuento_porcentaje ?? 0,
        }));
        categoriasEstado = (await obtenerRegistros("categorias")) as Categoria[];

        if (categoriasEstado.length === 0) {
          categoriasEstado = CATEGORIAS_INICIALES.map((c) => ({
            id: crypto.randomUUID(), nombre: c.nombre, color: c.color,
          }));
          for (const cat of categoriasEstado) await guardarRegistro("categorias", cat);
        }
        
        // Renderizado inmediato para evitar pantallas de carga largas en PC
        set({ productos: productosEstado, categorias: categoriasEstado, cargando: false });
      }

      // 2. SINCRONIZACIÓN EN LA NUBE (Obligatorio en Web, Actualizador en .exe)
      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          
          // --- A. Subir datos del .exe a la Nube ---
          if (esEscritorio) {
            if (categoriasEstado.length > 0) {
              const catPayload = categoriasEstado.map(c => ({
                id: c.id, tienda_id: tiendaId, nombre: c.nombre, color: c.color
              }));
              await supabase.from('categorias').upsert(catPayload, { onConflict: 'id' });
            }
            if (productosEstado.length > 0) {
              const prodPayload = productosEstado.map(p => {
                const mapped = mapearProductoASupabase(p, tiendaId);
                const cat = categoriasEstado.find(c => c.nombre === p.categoria);
                if (cat) (mapped as any).categoria_id = cat.id;
                return mapped;
              });
              // Loteado para no saturar Supabase si tienes miles de productos
              for (let i = 0; i < prodPayload.length; i += 500) {
                await supabase.from('productos').upsert(prodPayload.slice(i, i + 500), { onConflict: 'id' });
              }
            }
          }

          // --- B. Descargar la Verdad Absoluta desde la Nube ---
          const { data: catSupabase } = await supabase.from('categorias').select('*').eq('tienda_id', tiendaId);
          const { data: prodSupabase } = await supabase.from('productos').select('*').eq('tienda_id', tiendaId);

          if (catSupabase) {
            categoriasEstado = catSupabase.map(c => ({ id: c.id, nombre: c.nombre, color: c.color }));
            if (esEscritorio) {
              for (const cat of categoriasEstado) await guardarRegistro("categorias", cat);
            }
          }

          if (prodSupabase) {
            productosEstado = prodSupabase.map(p => {
              const catAsociada = categoriasEstado.find(c => c.id === p.categoria_id);
              return mapearProductoDesdeSupabase(p, catAsociada?.nombre || "");
            });
            if (esEscritorio) {
              for (const prod of productosEstado) await guardarRegistro("productos", prod);
            }
          }

          // Actualiza el estado web (o refresca el estado del .exe)
          set({ productos: productosEstado, categorias: categoriasEstado, cargando: false });
        } else {
          console.warn("Sincronización omitida: No se obtuvo el tienda_id.");
          if (!esEscritorio) set({ cargando: false });
        }
      } else if (!esEscritorio) {
        set({ cargando: false });
        console.warn("Modo web sin internet. Los datos no se pudieron cargar.");
      }
    } catch (error) {
      console.error("Error al sincronizar inventario:", error);
      set({ cargando: false });
    }
  },

  agregarProducto: async (producto) => {
    try {
      if (esEscritorio) await guardarRegistro("productos", producto);
      
      set((estado) => ({ productos: [...estado.productos, producto] }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          const payload = mapearProductoASupabase(producto, tiendaId);
          const cat = get().categorias.find(c => c.nombre === producto.categoria);
          if (cat) (payload as any).categoria_id = cat.id;

          await supabase.from('productos').upsert(payload);
        }
      }
    } catch (error) {
      console.error("Error al guardar producto:", error);
    }
  },

  actualizarProducto: async (productoActualizado) => {
    try {
      if (esEscritorio) await guardarRegistro("productos", productoActualizado);
      
      set((estado) => ({
        productos: estado.productos.map((p) => (p.id === productoActualizado.id ? productoActualizado : p)),
      }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          const payload = mapearProductoASupabase(productoActualizado, tiendaId);
          const cat = get().categorias.find(c => c.nombre === productoActualizado.categoria);
          if (cat) (payload as any).categoria_id = cat.id;

          await supabase.from('productos').upsert(payload);
        }
      }
    } catch (error) {
      console.error("Error al actualizar producto:", error);
    }
  },

  eliminarProducto: async (id) => {
    try {
      if (esEscritorio) await eliminarRegistro("productos", id);
      
      set((estado) => ({ productos: estado.productos.filter((p) => p.id !== id) }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('productos').delete().eq('id', id).eq('tienda_id', tiendaId);
      }
    } catch (error) {
      console.error("Error al eliminar producto:", error);
    }
  },

  agregarCategoria: async (nombre, color) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return null;

    const existente = get().categorias.find((c) => c.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (existente) return existente;

    const nueva: Categoria = {
      id: crypto.randomUUID(),
      nombre: nombreLimpio,
      color: color || siguienteColor(get().categorias.map((c) => c.color)),
    };

    try {
      if (esEscritorio) await guardarRegistro("categorias", nueva);
      
      set((estado) => ({ categorias: [...estado.categorias, nueva] }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('categorias').upsert({ id: nueva.id, tienda_id: tiendaId, nombre: nueva.nombre, color: nueva.color });
      }
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
          ? { ...producto, categoria: "" } : producto
      );
      
      for (const producto of productosActualizados) {
        const productoAnterior = get().productos.find((p) => p.id === producto.id);
        if (productoAnterior?.categoria !== producto.categoria) {
          await get().actualizarProducto(producto); 
        }
      }
      
      if (esEscritorio) await eliminarRegistro("categorias", id);
      
      set((estado) => ({
        productos: productosActualizados,
        categorias: estado.categorias.filter((c) => c.id !== id),
      }));

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) await supabase.from('categorias').delete().eq('id', id).eq('tienda_id', tiendaId);
      }
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
        if (productoAnterior?.stock_actual !== producto.stock_actual) {
           await get().actualizarProducto(producto); 
        }
      }
      set({ productos: productosActualizados });
    } catch (error) {
      console.error("Error al descontar stock:", error);
      throw error;
    }
  },
}));