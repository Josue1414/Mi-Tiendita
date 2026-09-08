// src/estado/estadoInventario.ts
import { create } from "zustand";
import type { Categoria, Producto } from "../tipos/producto";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { CATEGORIAS_INICIALES, siguienteColor } from "../utilidades/coloresCategoria";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { useEstadoRed } from "./estadoRed";
import { emitirAccionMaestro } from "../servicios/socketCliente";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

interface EstadoInventario {
  productos: Producto[];
  categorias: Categoria[];
  cargando: boolean;
  cargarProductos: () => Promise<void>;
  agregarProducto: (producto: Producto, propagado?: boolean) => Promise<void>;
  actualizarProducto: (producto: Producto, propagado?: boolean) => Promise<void>;
  eliminarProducto: (id: string, propagado?: boolean) => Promise<void>;
  agregarCategoria: (nombre: string, color?: string, propagado?: boolean) => Promise<Categoria | null>;
  eliminarCategoria: (id: string, propagado?: boolean) => Promise<void>;
  descontarStock: (items: Array<{ producto_id: string; cantidad: number }>, propagado?: boolean) => Promise<void>;
  aplicarSincronizacionRemota: (accion: any) => void;
}

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

  aplicarSincronizacionRemota: (accion) => {
    const { tipo, payload } = accion;
    switch (tipo) {
      case 'AGREGAR_PRODUCTO': get().agregarProducto(payload, true); break;
      case 'ACTUALIZAR_PRODUCTO': get().actualizarProducto(payload, true); break;
      case 'ELIMINAR_PRODUCTO': get().eliminarProducto(payload, true); break;
      case 'DESCONTAR_STOCK': get().descontarStock(payload, true); break;
      case 'AGREGAR_CATEGORIA': get().agregarCategoria(payload.nombre, payload.color, true); break;
      case 'ELIMINAR_CATEGORIA': get().eliminarCategoria(payload, true); break;
    }
  },

  cargarProductos: async () => {
    set({ cargando: true });
    try {
      let productosEstado: Producto[] = [];
      let categoriasEstado: Categoria[] = [];

      // 1. Carga inicial rápida desde caché local (Offline-first)
      if (esEscritorio) {
        const dataLocal = await obtenerRegistros("productos");
        productosEstado = (dataLocal as Producto[]).map((p) => ({ ...p, descuento_porcentaje: p.descuento_porcentaje ?? 0 }));
        categoriasEstado = (await obtenerRegistros("categorias")) as Categoria[];

        if (categoriasEstado.length === 0) {
          categoriasEstado = CATEGORIAS_INICIALES.map((c) => ({ id: crypto.randomUUID(), nombre: c.nombre, color: c.color }));
          for (const cat of categoriasEstado) await guardarRegistro("categorias", cat);
        }
        set({ productos: productosEstado, categorias: categoriasEstado, cargando: false });
      }

      // 2. Sincronización inteligente con la nube (Diff y Purga)
      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          // A) Leer de Supabase primero
          const { data: catSupabase } = await supabase.from('categorias').select('*').eq('tienda_id', tiendaId);
          const { data: prodSupabase } = await supabase.from('productos').select('*').eq('tienda_id', tiendaId);

          if (catSupabase && prodSupabase) {
            const categoriasNube = catSupabase.map(c => ({ id: c.id, nombre: c.nombre, color: c.color }));
            const productosNube = prodSupabase.map(p => {
              const catAsociada = categoriasNube.find(c => c.id === p.categoria_id);
              return mapearProductoDesdeSupabase(p, catAsociada?.nombre || "");
            });

            // B) Reconciliación: Borrar locales que ya no existen en la nube
            if (esEscritorio) {
              const idsCategoriasNube = new Set(categoriasNube.map(c => c.id));
              const idsProductosNube = new Set(productosNube.map(p => p.id));

              for (const catLocal of categoriasEstado) {
                if (!idsCategoriasNube.has(catLocal.id)) await eliminarRegistro("categorias", catLocal.id);
              }
              for (const prodLocal of productosEstado) {
                if (!idsProductosNube.has(prodLocal.id)) await eliminarRegistro("productos", prodLocal.id);
              }

              // C) Guardar/Actualizar registros válidos en local
              for (const cat of categoriasNube) await guardarRegistro("categorias", cat);
              for (const prod of productosNube) await guardarRegistro("productos", prod);
            }

            set({ productos: productosNube, categorias: categoriasNube, cargando: false });
          }
        } else {
          if (!esEscritorio) set({ cargando: false });
        }
      } else if (!esEscritorio) {
        set({ cargando: false });
      }
    } catch (error) {
      set({ cargando: false });
    }
  },

  agregarProducto: async (producto, propagado = false) => {
    const { esMaestro } = useEstadoRed.getState();
    if (!esMaestro && !propagado) {
      emitirAccionMaestro({ tipo: 'AGREGAR_PRODUCTO', payload: producto });
      set((estado) => ({ productos: [...estado.productos, producto] })); 
      return;
    }

    if (esEscritorio) await guardarRegistro("productos", producto);
    set((estado) => ({ productos: estado.productos.some(p => p.id === producto.id) ? estado.productos : [...estado.productos, producto] }));
    
    if (esMaestro && !propagado) (window as any).apiLocal.emitirAEsclavos({ tipo: 'AGREGAR_PRODUCTO', payload: producto });
    
    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const payload = mapearProductoASupabase(producto, tiendaId);
        const cat = get().categorias.find(c => c.nombre === producto.categoria);
        if (cat) (payload as any).categoria_id = cat.id;
        await supabase.from('productos').upsert(payload);
      }
    } else if (esMaestro) {
      // Registrar operación pendiente si estamos offline
      await registrarPendienteSync({ tabla: 'productos', operacion: 'AGREGAR', payload: producto });
    }
  },

  actualizarProducto: async (productoActualizado, propagado = false) => {
    const { esMaestro } = useEstadoRed.getState();
    if (!esMaestro && !propagado) {
      emitirAccionMaestro({ tipo: 'ACTUALIZAR_PRODUCTO', payload: productoActualizado });
      set((estado) => ({ productos: estado.productos.map((p) => (p.id === productoActualizado.id ? productoActualizado : p)) }));
      return;
    }

    if (esEscritorio) await guardarRegistro("productos", productoActualizado);
    set((estado) => ({ productos: estado.productos.map((p) => (p.id === productoActualizado.id ? productoActualizado : p)) }));

    if (esMaestro && !propagado) (window as any).apiLocal.emitirAEsclavos({ tipo: 'ACTUALIZAR_PRODUCTO', payload: productoActualizado });

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const payload = mapearProductoASupabase(productoActualizado, tiendaId);
        const cat = get().categorias.find(c => c.nombre === productoActualizado.categoria);
        if (cat) (payload as any).categoria_id = cat.id;
        await supabase.from('productos').upsert(payload);
      }
    } else if (esMaestro) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'ACTUALIZAR', payload: productoActualizado });
    }
  },

  eliminarProducto: async (id, propagado = false) => {
    const { esMaestro } = useEstadoRed.getState();
    if (!esMaestro && !propagado) {
      emitirAccionMaestro({ tipo: 'ELIMINAR_PRODUCTO', payload: id });
      set((estado) => ({ productos: estado.productos.filter((p) => p.id !== id) }));
      return;
    }

    if (esEscritorio) await eliminarRegistro("productos", id);
    set((estado) => ({ productos: estado.productos.filter((p) => p.id !== id) }));

    if (esMaestro && !propagado) (window as any).apiLocal.emitirAEsclavos({ tipo: 'ELIMINAR_PRODUCTO', payload: id });

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('productos').delete().eq('id', id).eq('tienda_id', tiendaId);
    } else if (esMaestro) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'ELIMINAR', payload: id });
    }
  },

  agregarCategoria: async (nombre, color, propagado = false) => {
    const { esMaestro } = useEstadoRed.getState();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return null;
    
    const existente = get().categorias.find((c) => c.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (existente) return existente;

    const nueva: Categoria = { 
      id: crypto.randomUUID(), 
      nombre: nombreLimpio, 
      color: color || siguienteColor(get().categorias.map((c) => c.color)) 
    };

    if (!esMaestro && !propagado) {
      emitirAccionMaestro({ tipo: 'AGREGAR_CATEGORIA', payload: { nombre: nueva.nombre, color: nueva.color } });
      set((estado) => ({ categorias: [...estado.categorias, nueva] }));
      return nueva;
    }

    if (esEscritorio) await guardarRegistro("categorias", nueva);
    set((estado) => ({ categorias: [...estado.categorias, nueva] }));

    if (esMaestro && !propagado) {
      (window as any).apiLocal.emitirAEsclavos({ tipo: 'AGREGAR_CATEGORIA', payload: { nombre: nueva.nombre, color: nueva.color } });
    }

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('categorias').upsert({ id: nueva.id, tienda_id: tiendaId, nombre: nueva.nombre, color: nueva.color });
    } else if (esMaestro) {
      await registrarPendienteSync({ tabla: 'categorias', operacion: 'AGREGAR', payload: nueva });
    }
    return nueva;
  },

  eliminarCategoria: async (id, propagado = false) => {
    const { esMaestro } = useEstadoRed.getState();
    const categoria = get().categorias.find((c) => c.id === id);
    if (!categoria) return;

    if (!esMaestro && !propagado) {
      emitirAccionMaestro({ tipo: 'ELIMINAR_CATEGORIA', payload: id });
      const productosActualizados = get().productos.map((producto) => 
        producto.categoria.trim().toLocaleLowerCase() === categoria.nombre.trim().toLocaleLowerCase() ? { ...producto, categoria: "" } : producto
      );
      set((estado) => ({ productos: productosActualizados, categorias: estado.categorias.filter((c) => c.id !== id) }));
      return;
    }

    const productosActualizados = get().productos.map((producto) => 
      producto.categoria.trim().toLocaleLowerCase() === categoria.nombre.trim().toLocaleLowerCase() ? { ...producto, categoria: "" } : producto
    );
    
    for (const producto of productosActualizados) {
      const productoAnterior = get().productos.find((p) => p.id === producto.id);
      if (productoAnterior?.categoria !== producto.categoria) {
        await get().actualizarProducto(producto, true); 
      }
    }
    
    if (esEscritorio) await eliminarRegistro("categorias", id);
    set((estado) => ({ productos: productosActualizados, categorias: estado.categorias.filter((c) => c.id !== id) }));

    if (esMaestro && !propagado) {
      (window as any).apiLocal.emitirAEsclavos({ tipo: 'ELIMINAR_CATEGORIA', payload: id });
    }

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('categorias').delete().eq('id', id).eq('tienda_id', tiendaId);
    } else if (esMaestro) {
      await registrarPendienteSync({ tabla: 'categorias', operacion: 'ELIMINAR', payload: id });
    }
  },

  descontarStock: async (items, propagado = false) => {
    const { esMaestro } = useEstadoRed.getState();
    
    if (!esMaestro && !propagado) {
      emitirAccionMaestro({ tipo: 'DESCONTAR_STOCK', payload: items });
      const productosActualizados = get().productos.map((producto) => {
        const item = items.find((entrada) => entrada.producto_id === producto.id);
        if (!item || !producto.controla_stock) return producto;
        return { ...producto, stock_actual: Math.max(0, producto.stock_actual - item.cantidad) };
      });
      set({ productos: productosActualizados });
      return;
    }

    const productosActualizados = get().productos.map((producto) => {
      const item = items.find((entrada) => entrada.producto_id === producto.id);
      if (!item || !producto.controla_stock) return producto;
      return { ...producto, stock_actual: Math.max(0, producto.stock_actual - item.cantidad) };
    });
    
    for (const producto of productosActualizados) {
      const productoAnterior = get().productos.find((p) => p.id === producto.id);
      if (productoAnterior?.stock_actual !== producto.stock_actual) {
        // Al usar actualizarProducto, si estamos offline, se registrará la operación pendiente automáticamente
        await get().actualizarProducto(producto, true); 
      }
    }
    set({ productos: productosActualizados });

    if (esMaestro && !propagado) (window as any).apiLocal.emitirAEsclavos({ tipo: 'DESCONTAR_STOCK', payload: items });
  },
}));