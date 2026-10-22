// src/estado/estadoInventario.ts
import { create } from "zustand";
import type { Categoria, Producto } from "../tipos/producto";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { CATEGORIAS_INICIALES, siguienteColor } from "../utilidades/coloresCategoria";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { debeSincronizarConNube, enviarAccionLAN } from "../servicios/sincronizacionLAN";
import { descontarDeLotes } from "../utilidades/lotes";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

interface EstadoInventario {
  productos: Producto[];
  categorias: Categoria[];
  cargando: boolean;
  cargarProductos: () => Promise<void>;
  agregarProducto: (producto: Producto, propagado?: boolean) => Promise<void>;
  actualizarProducto: (producto: Producto, propagado?: boolean) => Promise<void>;
  eliminarProducto: (id: string, propagado?: boolean) => Promise<void>;
  agregarCategoria: (nombre: string, color?: string, propagado?: boolean, id?: string) => Promise<Categoria | null>;
  eliminarCategoria: (id: string, propagado?: boolean) => Promise<void>;
  descontarStock: (items: Array<{ producto_id: string; cantidad: number }>, propagado?: boolean) => Promise<void>;
  aplicarSincronizacionRemota: (accion: any) => void;
  hidratarEstadoLAN: (snapshot: { productos: Producto[]; categorias: Categoria[] }) => Promise<void>;
  sincronizarProducto: (payload: any) => Promise<void>; 
  sincronizarCategoria: (payload: any) => Promise<void>; 
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
  lotes: p.lotes ?? [],
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
  lotes: Array.isArray(p.lotes) ? p.lotes : [],
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
      case 'AGREGAR_CATEGORIA': get().agregarCategoria(payload.nombre, payload.color, true, payload.id); break;
      case 'ACTUALIZAR_CATEGORIA': get().agregarCategoria(payload.nombre, payload.color, true, payload.id); break;
      case 'ELIMINAR_CATEGORIA': get().eliminarCategoria(payload, true); break;
    }
  },

  hidratarEstadoLAN: async ({ productos, categorias }) => {
    const productosLocales = await obtenerRegistros("productos");
    const categoriasLocales = await obtenerRegistros("categorias");
    const idsProductos = new Set(productos.map((producto) => producto.id));
    const idsCategorias = new Set(categorias.map((categoria) => categoria.id));
    for (const producto of productosLocales as Producto[]) {
      if (!idsProductos.has(producto.id)) await eliminarRegistro("productos", producto.id);
    }
    for (const categoria of categoriasLocales as Categoria[]) {
      if (!idsCategorias.has(categoria.id)) await eliminarRegistro("categorias", categoria.id);
    }
    for (const categoria of categorias) await guardarRegistro("categorias", categoria);
    for (const producto of productos) await guardarRegistro("productos", producto);
    set({ productos, categorias, cargando: false });
  },

  cargarProductos: async () => {
    set({ cargando: true });
    try {
      let productosEstado: Producto[] = [];
      let categoriasEstado: Categoria[] = [];

      const tiendaId = await obtenerTiendaIdActual();

      if (navigator.onLine && debeSincronizarConNube() && tiendaId) {
        const { data: catSupabase } = await supabase.from('categorias').select('*').eq('tienda_id', tiendaId);
        const { data: prodSupabase } = await supabase.from('productos').select('*').eq('tienda_id', tiendaId);

        if (catSupabase && prodSupabase) {
          const categoriasNube = catSupabase.map(c => ({ id: c.id, nombre: c.nombre, color: c.color }));
          const productosNube = prodSupabase.map(p => {
            const catAsociada = categoriasNube.find(c => c.id === p.categoria_id);
            return mapearProductoDesdeSupabase(p, catAsociada?.nombre || "");
          });

          if (esEscritorio) {
            const idsCategoriasNube = new Set(categoriasNube.map(c => c.id));
            const idsProductosNube = new Set(productosNube.map(p => p.id));

            const categoriasLocal = await obtenerRegistros("categorias");
            const productosLocal = await obtenerRegistros("productos");

            for (const catLocal of categoriasLocal) {
              if (!idsCategoriasNube.has(catLocal.id)) await eliminarRegistro("categorias", catLocal.id);
            }
            for (const prodLocal of productosLocal) {
              if (!idsProductosNube.has(prodLocal.id)) await eliminarRegistro("productos", prodLocal.id);
            }

            for (const cat of categoriasNube) await guardarRegistro("categorias", cat);
            for (const prod of productosNube) await guardarRegistro("productos", prod);
          }

          set({ productos: productosNube, categorias: categoriasNube, cargando: false });
          return;
        }
      }

      if (esEscritorio) {
        const dataLocal = await obtenerRegistros("productos");
        productosEstado = (dataLocal as Producto[]).map((p) => ({
          ...p,
          descuento_porcentaje: p.descuento_porcentaje ?? 0,
          lotes: Array.isArray(p.lotes) ? p.lotes : [],
        }));
        categoriasEstado = (await obtenerRegistros("categorias")) as Categoria[];

        if (categoriasEstado.length === 0) {
          categoriasEstado = CATEGORIAS_INICIALES.map((c) => ({ id: crypto.randomUUID(), nombre: c.nombre, color: c.color }));
          for (const cat of categoriasEstado) await guardarRegistro("categorias", cat);
        }
        set({ productos: productosEstado, categorias: categoriasEstado, cargando: false });
      } else if (!navigator.onLine) {
        set({ cargando: false });
      } else {
        set({ cargando: false });
      }
    } catch (error) {
      set({ cargando: false });
    }
  },

  agregarProducto: async (producto, propagado = false) => {
    if (!propagado && enviarAccionLAN({ tipo: 'AGREGAR_PRODUCTO', payload: producto })) {
      await guardarRegistro("productos", producto);
      set((estado) => ({ productos: [...estado.productos, producto] })); 
      return;
    }

    await guardarRegistro("productos", producto);
    set((estado) => ({ productos: estado.productos.some(p => p.id === producto.id) ? estado.productos : [...estado.productos, producto] }));
    
    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const payload = mapearProductoASupabase(producto, tiendaId);
        const cat = get().categorias.find(c => c.nombre === producto.categoria);
        if (cat) (payload as any).categoria_id = cat.id;
        await supabase.from('productos').upsert(payload);
      }
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'AGREGAR', payload: producto });
    }
  },

  actualizarProducto: async (productoActualizado, propagado = false) => {
    if (!propagado && enviarAccionLAN({ tipo: 'ACTUALIZAR_PRODUCTO', payload: productoActualizado })) {
      await guardarRegistro("productos", productoActualizado);
      set((estado) => ({ productos: estado.productos.map((p) => (p.id === productoActualizado.id ? productoActualizado : p)) }));
      return;
    }

    await guardarRegistro("productos", productoActualizado);
    set((estado) => ({ productos: estado.productos.map((p) => (p.id === productoActualizado.id ? productoActualizado : p)) }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const payload = mapearProductoASupabase(productoActualizado, tiendaId);
        const cat = get().categorias.find(c => c.nombre === productoActualizado.categoria);
        if (cat) (payload as any).categoria_id = cat.id;
        await supabase.from('productos').upsert(payload);
      }
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'ACTUALIZAR', payload: productoActualizado });
    }
  },

  eliminarProducto: async (id, propagado = false) => {
    if (!propagado && enviarAccionLAN({ tipo: 'ELIMINAR_PRODUCTO', payload: id })) {
      await eliminarRegistro("productos", id);
      set((estado) => ({ productos: estado.productos.filter((p) => p.id !== id) }));
      return;
    }

    await eliminarRegistro("productos", id);
    set((estado) => ({ productos: estado.productos.filter((p) => p.id !== id) }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('productos').delete().eq('id', id).eq('tienda_id', tiendaId);
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'ELIMINAR', payload: id });
    }
  },

  agregarCategoria: async (nombre, color, propagado = false, id) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return null;

    const existentePorId = id ? get().categorias.find((categoria) => categoria.id === id) : undefined;
    if (existentePorId) {
      const actualizada = { ...existentePorId, nombre: nombreLimpio, color: color || existentePorId.color };
      await guardarRegistro("categorias", actualizada);
      set((estado) => ({
        categorias: estado.categorias.map((categoria) => categoria.id === id ? actualizada : categoria),
        productos: estado.productos.map((producto) => producto.categoria === existentePorId.nombre
          ? { ...producto, categoria: nombreLimpio }
          : producto)
      }));
      if (navigator.onLine && debeSincronizarConNube()) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('categorias').upsert({
            id: actualizada.id,
            tienda_id: tiendaId,
            nombre: actualizada.nombre,
            color: actualizada.color
          });
        }
      } else if (!navigator.onLine && debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'categorias', operacion: 'ACTUALIZAR', payload: actualizada });
      }
      return actualizada;
    }
    
    const existente = get().categorias.find((c) => c.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (existente) return existente;

    const nueva: Categoria = { 
      id: id || crypto.randomUUID(), 
      nombre: nombreLimpio, 
      color: color || siguienteColor(get().categorias.map((c) => c.color)) 
    };

    if (!propagado && enviarAccionLAN({ tipo: 'AGREGAR_CATEGORIA', payload: nueva })) {
      await guardarRegistro("categorias", nueva);
      set((estado) => ({ categorias: [...estado.categorias, nueva] }));
      return nueva;
    }

    await guardarRegistro("categorias", nueva);
    set((estado) => ({ categorias: [...estado.categorias, nueva] }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('categorias').upsert({ id: nueva.id, tienda_id: tiendaId, nombre: nueva.nombre, color: nueva.color });
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'categorias', operacion: 'AGREGAR', payload: nueva });
    }
    return nueva;
  },

  eliminarCategoria: async (id, propagado = false) => {
    const categoria = get().categorias.find((c) => c.id === id);
    if (!categoria) return;

    if (!propagado && enviarAccionLAN({ tipo: 'ELIMINAR_CATEGORIA', payload: id })) {
      const productosActualizados = get().productos.map((producto) =>
        producto.categoria.trim().toLocaleLowerCase() === categoria.nombre.trim().toLocaleLowerCase() ? { ...producto, categoria: "" } : producto
      );
      for (const producto of productosActualizados) {
        const productoAnterior = get().productos.find((p) => p.id === producto.id);
        if (productoAnterior?.categoria !== producto.categoria) await guardarRegistro("productos", producto);
      }
      await eliminarRegistro("categorias", id);
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
    
    await eliminarRegistro("categorias", id);
    set((estado) => ({ productos: productosActualizados, categorias: estado.categorias.filter((c) => c.id !== id) }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('categorias').delete().eq('id', id).eq('tienda_id', tiendaId);
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'categorias', operacion: 'ELIMINAR', payload: id });
    }
  },

  descontarStock: async (items, propagado = false) => {
    const cantidadesPorProducto = new Map<string, number>();
    for (const item of items) {
      cantidadesPorProducto.set(
        item.producto_id,
        (cantidadesPorProducto.get(item.producto_id) ?? 0) + Math.max(0, item.cantidad),
      );
    }

    if (!propagado && enviarAccionLAN({ tipo: 'DESCONTAR_STOCK', payload: items })) {
      const productosActualizados = get().productos.map((producto) => {
        const cantidadSolicitada = cantidadesPorProducto.get(producto.id);
        if (cantidadSolicitada === undefined || !producto.controla_stock) return producto;
        const cantidadDescontada = Math.min(Math.max(0, producto.stock_actual), cantidadSolicitada);
        return {
          ...producto,
          stock_actual: Math.max(0, producto.stock_actual - cantidadDescontada),
          lotes: descontarDeLotes(producto.lotes, cantidadDescontada),
        };
      });
      for (const producto of productosActualizados) {
        const anterior = get().productos.find((actual) => actual.id === producto.id);
        if (anterior?.stock_actual !== producto.stock_actual) await guardarRegistro("productos", producto);
      }
      set({ productos: productosActualizados });
      return;
    }

    const productosActualizados = get().productos.map((producto) => {
      const cantidadSolicitada = cantidadesPorProducto.get(producto.id);
      if (cantidadSolicitada === undefined || !producto.controla_stock) return producto;
      const cantidadDescontada = Math.min(Math.max(0, producto.stock_actual), cantidadSolicitada);
      return {
        ...producto,
        stock_actual: Math.max(0, producto.stock_actual - cantidadDescontada),
        lotes: descontarDeLotes(producto.lotes, cantidadDescontada),
      };
    });

    for (const producto of productosActualizados) {
      const productoAnterior = get().productos.find((p) => p.id === producto.id);
      if (productoAnterior?.stock_actual !== producto.stock_actual) {
        await get().actualizarProducto(producto, true);
      }
    }
    set({ productos: productosActualizados });

  },

  // Sincronizaciones silenciosas desde la nube
  sincronizarProducto: async (payload: any) => {
    const { eventType, new: nuevo, old: viejo } = payload;
    const { productos, categorias } = get();

    if (eventType === 'DELETE') {
      if (esEscritorio) await eliminarRegistro("productos", viejo.id);
      set({ productos: productos.filter((p) => p.id !== viejo.id) });
      enviarAccionLAN({ tipo: 'ELIMINAR_PRODUCTO', payload: viejo.id });
    } else {
      const catAsociada = categorias.find((c) => c.id === nuevo.categoria_id);
      const prodMapeado = mapearProductoDesdeSupabase(nuevo, catAsociada?.nombre || "");

      if (esEscritorio) await guardarRegistro("productos", prodMapeado);

      if (eventType === 'INSERT') {
        if (!productos.some(p => p.id === prodMapeado.id)) {
          set({ productos: [...productos, prodMapeado] });
        }
      } else if (eventType === 'UPDATE') {
        set({ productos: productos.map((p) => (p.id === prodMapeado.id ? prodMapeado : p)) });
      }
      enviarAccionLAN({
        tipo: eventType === 'INSERT' ? 'AGREGAR_PRODUCTO' : 'ACTUALIZAR_PRODUCTO',
        payload: prodMapeado
      });
    }
  },

  sincronizarCategoria: async (payload: any) => {
    const { eventType, new: nuevo, old: viejo } = payload;
    const { categorias, productos } = get();

    if (eventType === 'DELETE') {
      if (esEscritorio) await eliminarRegistro("categorias", viejo.id);
      
      const productosActualizados = productos.map((p) => {
        const cat = categorias.find(c => c.id === viejo.id);
        if (cat && p.categoria.trim().toLowerCase() === cat.nombre.trim().toLowerCase()) {
          return { ...p, categoria: "" };
        }
        return p;
      });
      
      for (const p of productosActualizados) {
         const pAnterior = productos.find(x => x.id === p.id);
         if (pAnterior?.categoria !== p.categoria) {
            await get().actualizarProducto(p, true); 
         }
      }

      set({ categorias: categorias.filter((c) => c.id !== viejo.id), productos: productosActualizados });
      enviarAccionLAN({ tipo: 'ELIMINAR_CATEGORIA', payload: viejo.id });
    } else {
      const catMapeada: Categoria = { id: nuevo.id, nombre: nuevo.nombre, color: nuevo.color };
      if (esEscritorio) await guardarRegistro("categorias", catMapeada);

      if (eventType === 'INSERT') {
        if (!categorias.some(c => c.id === catMapeada.id)) {
          set({ categorias: [...categorias, catMapeada] });
        }
      } else if (eventType === 'UPDATE') {
        const oldCat = categorias.find(c => c.id === catMapeada.id);
        let nuevosProductos = productos;
        if (oldCat && oldCat.nombre !== catMapeada.nombre) {
          nuevosProductos = productos.map((p) => p.categoria === oldCat.nombre ? { ...p, categoria: catMapeada.nombre } : p);
          for (const p of nuevosProductos) {
             const pAnterior = productos.find(x => x.id === p.id);
             if (pAnterior?.categoria !== p.categoria) {
                await get().actualizarProducto(p, true); 
             }
          }
        }
        set({ 
          categorias: categorias.map((c) => c.id === catMapeada.id ? catMapeada : c),
          productos: nuevosProductos
        });
      }
      enviarAccionLAN({
        tipo: eventType === 'INSERT' ? 'AGREGAR_CATEGORIA' : 'ACTUALIZAR_CATEGORIA',
        payload: catMapeada
      });
    }
  }
}));