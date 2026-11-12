// src/estado/estadoInventario.ts
import { create } from "zustand";
import type { Categoria, Producto, UnidadMedida } from "../tipos/producto";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, obtenerPendientesSync, eliminarPendienteSync, registrarPendienteSync } from "../servicios/db";
import { CATEGORIAS_INICIALES, siguienteColor } from "../utilidades/coloresCategoria";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { debeSincronizarConNube, enviarAccionLAN } from "../servicios/sincronizacionLAN";
import { useEstadoRed } from "./estadoRed";
import { descontarDeLotes } from "../utilidades/lotes";
import { crearIdentificadorUnico } from "../utilidades/identificador";
import { normalizarNombreUnidad, UNIDADES_MEDIDA_PREDEFINIDAS } from "../utilidades/unidadesMedida";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

interface EstadoInventario {
  productos: Producto[];
  categorias: Categoria[];
  unidadesMedida: UnidadMedida[];
  cargando: boolean;
  cargarProductos: () => Promise<void>;
  agregarProducto: (producto: Producto, propagado?: boolean) => Promise<void>;
  actualizarProducto: (producto: Producto, propagado?: boolean) => Promise<void>;
  eliminarProducto: (id: string, propagado?: boolean) => Promise<void>;
  agregarCategoria: (nombre: string, color?: string, propagado?: boolean, id?: string) => Promise<Categoria | null>;
  eliminarCategoria: (id: string, propagado?: boolean) => Promise<void>;
  guardarUnidadMedida: (nombre: string, id?: string, propagado?: boolean) => Promise<UnidadMedida>;
  eliminarUnidadMedida: (id: string, propagado?: boolean) => Promise<void>;
  descontarStock: (items: Array<{ producto_id: string; cantidad: number }>, propagado?: boolean) => Promise<void>;
  aplicarSincronizacionRemota: (accion: any) => void;
  hidratarEstadoLAN: (snapshot: { productos: Producto[]; categorias: Categoria[]; unidadesMedida?: UnidadMedida[] }) => Promise<void>;
  sincronizarProducto: (payload: any) => Promise<void>; 
  sincronizarCategoria: (payload: any) => Promise<void>; 
  sincronizarUnidadMedida: (payload: any) => Promise<void>;
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
  requiere_pin_autorizacion: p.requiere_pin_autorizacion ?? false,
  mensaje_autorizacion: p.mensaje_autorizacion || null,
  permite_foto_autorizacion: p.permite_foto_autorizacion,
  lotes: p.lotes ?? [],
  nombre_archivo_local: p.imagen_archivo || null,
  bascula_equivalencia_litros: p.bascula_equivalencia_litros ?? false
});

const sincronizarConCola = async (
  tabla: string,
  operacion: "AGREGAR" | "ACTUALIZAR" | "ELIMINAR",
  payload: unknown,
  enviar: () => PromiseLike<{ error: unknown | null }>,
  actualizaStock = false
) => {
  try {
    const { error } = await enviar();
    if (error) throw error;
  } catch (error) {
    console.error(`No se pudo sincronizar ${tabla} con Supabase; se guardará para reintentar:`, error);
    await registrarPendienteSync({ tabla, operacion, payload, actualizaStock });
  }
};

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
  requiere_pin_autorizacion: Boolean(p.requiere_pin_autorizacion),
  mensaje_autorizacion: p.mensaje_autorizacion || "",
  permite_foto_autorizacion: p.permite_foto_autorizacion,
  lotes: Array.isArray(p.lotes) ? p.lotes : [],
  imagen_archivo: typeof p.nombre_archivo_local === "string" && !p.nombre_archivo_local.startsWith("data:image/")
    ? p.nombre_archivo_local
    : undefined,
  bascula_equivalencia_litros: p.bascula_equivalencia_litros ?? false
});

const quitarImagenEnLinea = (producto: Producto): Producto => ({
  ...producto,
  imagen_url: producto.imagen_url?.startsWith("data:image/") && producto.imagen_archivo
    ? undefined
    : producto.imagen_url
});

const mismoStockYLotes = (a: Producto, b: Producto) =>
  a.stock_actual === b.stock_actual
  && JSON.stringify(a.lotes ?? []) === JSON.stringify(b.lotes ?? []);

interface EventoUnidadMedidaNube {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

const esEventoUnidadMedidaNube = (valor: unknown): valor is EventoUnidadMedidaNube => {
  if (typeof valor !== "object" || valor === null) return false;
  const evento = valor as Record<string, unknown>;
  return typeof evento.eventType === "string"
    && typeof evento.new === "object" && evento.new !== null
    && typeof evento.old === "object" && evento.old !== null;
};

const limpiarPendientesStockConfirmados = async (producto: Producto) => {
  const pendientes = await obtenerPendientesSync();
  const pendientesProducto = pendientes.filter((pendiente) =>
    pendiente.tabla === "productos"
    && pendiente.operacion === "ACTUALIZAR"
    && pendiente.actualizaStock !== false
    && pendiente.payload?.id === producto.id
  );
  const ultimoPendiente = pendientesProducto[pendientesProducto.length - 1];
  if (!ultimoPendiente || !mismoStockYLotes(ultimoPendiente.payload as Producto, producto)) return;

  for (const pendiente of pendientesProducto) {
    await eliminarPendienteSync(pendiente.id);
  }
};

export const useEstadoInventario = create<EstadoInventario>((set, get) => ({
  productos: [],
  categorias: [],
  unidadesMedida: [],
  cargando: true,

  aplicarSincronizacionRemota: (accion) => {
    const { tipo, payload } = accion;
    switch (tipo) {
      case 'AGREGAR_PRODUCTO': get().agregarProducto(payload, true); break;
      case 'ACTUALIZAR_PRODUCTO':
        get().actualizarProducto(payload, true);
        if (payload && typeof payload.id === "string") {
          void limpiarPendientesStockConfirmados(payload as Producto).catch((error: unknown) => {
            console.error("No se pudieron limpiar los cambios de stock confirmados por LAN:", error);
          });
        }
        break;
      case 'ELIMINAR_PRODUCTO': get().eliminarProducto(payload, true); break;
      case 'DESCONTAR_STOCK': get().descontarStock(payload, true); break;
      case 'AGREGAR_CATEGORIA': get().agregarCategoria(payload.nombre, payload.color, true, payload.id); break;
      case 'ACTUALIZAR_CATEGORIA': get().agregarCategoria(payload.nombre, payload.color, true, payload.id); break;
      case 'ELIMINAR_CATEGORIA': get().eliminarCategoria(payload, true); break;
      case 'AGREGAR_UNIDAD_MEDIDA':
      case 'ACTUALIZAR_UNIDAD_MEDIDA':
        void get().guardarUnidadMedida(payload.nombre, payload.id, true).catch((error: unknown) => {
          console.error("No se pudo aplicar la unidad de medida recibida por LAN:", error);
        });
        break;
      case 'ELIMINAR_UNIDAD_MEDIDA':
        void get().eliminarUnidadMedida(payload, true).catch((error: unknown) => {
          console.error("No se pudo eliminar la unidad recibida por LAN:", error);
        });
        break;
    }
  },

  hidratarEstadoLAN: async ({ productos, categorias, unidadesMedida }) => {
    const productosLocales = await obtenerRegistros("productos") as Producto[];
    const categoriasLocales = await obtenerRegistros("categorias") as Categoria[];
    const unidadesLocales = await obtenerRegistros("unidades_medida") as UnidadMedida[];
    const pendientesSync = await obtenerPendientesSync();
    const productosConCambiosPendientes = new Set(
      pendientesSync
        .filter((pendiente) =>
          pendiente.tabla === "productos"
          && pendiente.operacion === "ACTUALIZAR"
          && pendiente.actualizaStock !== false
        )
        .map((pendiente) => pendiente.payload?.id)
        .filter((id): id is string => typeof id === "string")
    );
    const ultimoCambioPendiente = new Map<string, Producto>();
    for (const pendiente of pendientesSync) {
      const producto = pendiente.payload as Producto | undefined;
      if (
        pendiente.tabla === "productos"
        && pendiente.operacion === "ACTUALIZAR"
        && pendiente.actualizaStock !== false
        && typeof producto?.id === "string"
      ) {
        ultimoCambioPendiente.set(producto.id, producto);
      }
    }
    
    const idsProductos = new Set(productos.map((producto) => producto.id));
    const idsCategorias = new Set(categorias.map((categoria) => categoria.id));
    
    // Limpieza de eliminados
    for (const producto of productosLocales) {
      if (!idsProductos.has(producto.id) && !productosConCambiosPendientes.has(producto.id)) {
        await eliminarRegistro("productos", producto.id);
      }
    }
    for (const categoria of categoriasLocales) {
      if (!idsCategorias.has(categoria.id)) await eliminarRegistro("categorias", categoria.id);
    }
    if (unidadesMedida) {
      const idsUnidades = new Set(unidadesMedida.map((unidad) => unidad.id));
      for (const unidad of unidadesLocales) {
        if (!idsUnidades.has(unidad.id)) await eliminarRegistro("unidades_medida", unidad.id);
      }
      for (const unidad of unidadesMedida) await guardarRegistro("unidades_medida", unidad);
    }
    
    for (const categoria of categorias) await guardarRegistro("categorias", categoria);
    
    // Solo conservar el stock local cuando existe una modificación offline pendiente.
    const productosFusionados = productos.map(productoLAN => {
      const prodLocal = productosLocales.find(p => p.id === productoLAN.id);
      const productoLocal = ultimoCambioPendiente.get(productoLAN.id) ?? prodLocal;
      if (
        productoLocal
        && productosConCambiosPendientes.has(productoLAN.id)
        && productoLocal.controla_stock
        && productoLAN.controla_stock
      ) {
        return { ...productoLAN, stock_actual: productoLocal.stock_actual, lotes: productoLocal.lotes };
      }
      return productoLAN;
    });

    const productosFusionadosIds = new Set(productosFusionados.map((producto) => producto.id));
    for (const [id, productoPendiente] of ultimoCambioPendiente) {
      if (!productosFusionadosIds.has(id) && productoPendiente.controla_stock) {
        productosFusionados.push(productoPendiente);
      }
    }

    for (const producto of productosFusionados) {
      await guardarRegistro("productos", producto);
    }
    
    set({
      productos: productosFusionados,
      categorias,
      ...(unidadesMedida ? { unidadesMedida } : {}),
      cargando: false
    });

    for (const [id, productoPendiente] of ultimoCambioPendiente) {
      const productoLAN = productos.find((producto) => producto.id === id);
      if (productoLAN && mismoStockYLotes(productoLAN, productoPendiente)) {
        await limpiarPendientesStockConfirmados(productoLAN);
      } else {
        enviarAccionLAN({ tipo: "ACTUALIZAR_PRODUCTO", payload: productoPendiente });
      }
    }
  },

  cargarProductos: async () => {
    set({ cargando: get().productos.length === 0 && get().categorias.length === 0 });
    try {
      let productosEstado: Producto[] = [];
      let categoriasEstado: Categoria[] = [];
      let unidadesMedidaEstado: UnidadMedida[] = [];

      const datosLocales = await obtenerRegistros("productos");
      productosEstado = (datosLocales as Producto[]).map((producto) => ({
        ...producto,
        descuento_porcentaje: producto.descuento_porcentaje ?? 0,
        lotes: Array.isArray(producto.lotes) ? producto.lotes : [],
      }));
      categoriasEstado = (await obtenerRegistros("categorias")) as Categoria[];
      unidadesMedidaEstado = (await obtenerRegistros("unidades_medida")) as UnidadMedida[];

      if (categoriasEstado.length === 0) {
        categoriasEstado = CATEGORIAS_INICIALES.map((categoria) => ({
          id: crearIdentificadorUnico(),
          nombre: categoria.nombre,
          color: categoria.color
        }));
        for (const categoria of categoriasEstado) await guardarRegistro("categorias", categoria);
      }

      set({ productos: productosEstado, categorias: categoriasEstado, unidadesMedida: unidadesMedidaEstado, cargando: false });

      const tiendaId = await obtenerTiendaIdActual();

      if (navigator.onLine && debeSincronizarConNube() && tiendaId) {
        const [resultadoCategorias, resultadoProductos, resultadoUnidades] = await Promise.all([
          supabase.from('categorias').select('*').eq('tienda_id', tiendaId),
          supabase.from('productos').select('*').eq('tienda_id', tiendaId),
          supabase.from('unidades_medida').select('id, nombre').eq('tienda_id', tiendaId)
        ]);
        if (!debeSincronizarConNube()) return;
        const catSupabase = resultadoCategorias.data;
        const prodSupabase = resultadoProductos.data;
        if (resultadoCategorias.error || resultadoProductos.error) {
          console.warn("No se pudo actualizar el inventario desde Supabase; se conservarán los datos locales.", {
            categorias: resultadoCategorias.error,
            productos: resultadoProductos.error
          });
          return;
        }
        if (resultadoUnidades.error) {
          console.warn("No se pudieron cargar las unidades personalizadas desde Supabase; se conservarán las locales.", resultadoUnidades.error);
        }

        if (catSupabase && prodSupabase) {
          if (prodSupabase.some((producto) =>
            typeof producto.nombre_archivo_local === "string" && producto.nombre_archivo_local.startsWith("data:image/")
          )) {
            const { error } = await supabase
              .from("productos")
              .update({ nombre_archivo_local: null })
              .eq("tienda_id", tiendaId)
              .like("nombre_archivo_local", "data:image/%");
            if (error) console.error("No se pudieron limpiar las imágenes antiguas de Supabase:", error);
          }

          const categoriasNube = catSupabase.map(c => ({ id: c.id, nombre: c.nombre, color: c.color }));
          const unidadesNube = resultadoUnidades.data?.map((unidad) => ({ id: unidad.id, nombre: unidad.nombre }));
          const productosLocales = await obtenerRegistros("productos") as Producto[];
          const productosLocalesPorId = new Map(productosLocales.map((producto) => [producto.id, producto]));
          const productosNube = prodSupabase.map(p => {
            const catAsociada = categoriasNube.find(c => c.id === p.categoria_id);
            const productoNube = mapearProductoDesdeSupabase(p, catAsociada?.nombre || "");
            const productoLocal = productosLocalesPorId.get(productoNube.id);
            return {
              ...productoNube,
              imagen_url: productoLocal?.imagen_url,
              imagen_archivo: productoNube.imagen_archivo || productoLocal?.imagen_archivo
            };
          });

          const idsCategoriasNube = new Set(categoriasNube.map(c => c.id));
          const idsProductosNube = new Set(productosNube.map(p => p.id));
          const categoriasLocales = await obtenerRegistros("categorias");
          const unidadesLocales = await obtenerRegistros("unidades_medida") as UnidadMedida[];

          for (const categoriaLocal of categoriasLocales) {
            if (!idsCategoriasNube.has(categoriaLocal.id)) await eliminarRegistro("categorias", categoriaLocal.id);
          }
          if (unidadesNube) {
            const idsUnidadesNube = new Set(unidadesNube.map((unidad) => unidad.id));
            for (const unidadLocal of unidadesLocales) {
              if (!idsUnidadesNube.has(unidadLocal.id)) await eliminarRegistro("unidades_medida", unidadLocal.id);
            }
            for (const unidad of unidadesNube) await guardarRegistro("unidades_medida", unidad);
          }
          for (const productoLocal of productosLocales) {
            if (!idsProductosNube.has(productoLocal.id)) await eliminarRegistro("productos", productoLocal.id);
          }

          for (const categoria of categoriasNube) await guardarRegistro("categorias", categoria);
          for (const producto of productosNube) await guardarRegistro("productos", producto);

          set({
            productos: productosNube,
            categorias: categoriasNube,
            ...(unidadesNube ? { unidadesMedida: unidadesNube } : {}),
            cargando: false
          });
          return;
        }
      }

      set({ cargando: false });
    } catch (error) {
      console.error("Error al cargar productos locales:", error);
      set({ cargando: false });
    }
  },

  agregarProducto: async (producto, propagado = false) => {
    const productoLocal = quitarImagenEnLinea(producto);
    if (!propagado && enviarAccionLAN({ tipo: 'AGREGAR_PRODUCTO', payload: producto })) {
      await guardarRegistro("productos", productoLocal);
      set((estado) => ({ productos: [...estado.productos, productoLocal] }));
      return;
    }

    await guardarRegistro("productos", productoLocal);
    set((estado) => ({ productos: estado.productos.some(p => p.id === producto.id) ? estado.productos : [...estado.productos, productoLocal] }));
    
    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const payload = mapearProductoASupabase(productoLocal, tiendaId);
        const cat = get().categorias.find(c => c.nombre === productoLocal.categoria);
        if (cat) (payload as any).categoria_id = cat.id;
        await sincronizarConCola("productos", "AGREGAR", productoLocal, () => supabase.from("productos").upsert(payload));
      } else await registrarPendienteSync({ tabla: "productos", operacion: "AGREGAR", payload: productoLocal });
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'AGREGAR', payload: productoLocal });
    }
  },

  actualizarProducto: async (productoActualizado, propagado = false) => {
    if (!propagado && enviarAccionLAN({ tipo: 'ACTUALIZAR_PRODUCTO', payload: productoActualizado })) {
      const productoLocal = quitarImagenEnLinea(productoActualizado);
      await guardarRegistro("productos", productoLocal);
      set((estado) => ({ productos: estado.productos.map((p) => (p.id === productoLocal.id ? productoLocal : p)) }));
      return;
    }

    const productoAnterior = get().productos.find((producto) => producto.id === productoActualizado.id);
    const productoLocal = quitarImagenEnLinea(productoActualizado);
    const actualizaStock = Boolean(
      productoAnterior
      && (
        productoAnterior.stock_actual !== productoLocal.stock_actual
        || JSON.stringify(productoAnterior.lotes ?? []) !== JSON.stringify(productoLocal.lotes ?? [])
      )
    );

    await guardarRegistro("productos", productoLocal);
    set((estado) => ({ productos: estado.productos.map((p) => (p.id === productoLocal.id ? productoLocal : p)) }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const payload = mapearProductoASupabase(productoLocal, tiendaId);
        const cat = get().categorias.find(c => c.nombre === productoLocal.categoria);
        if (cat) (payload as any).categoria_id = cat.id;
        await sincronizarConCola("productos", "ACTUALIZAR", productoLocal, () => supabase.from("productos").upsert(payload), actualizaStock);
      } else await registrarPendienteSync({ tabla: "productos", operacion: "ACTUALIZAR", payload: productoLocal, actualizaStock });
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'productos', operacion: 'ACTUALIZAR', payload: productoLocal, actualizaStock });
    } else if (!propagado && actualizaStock && !useEstadoRed.getState().esMaestro) {
      await registrarPendienteSync({
        tabla: "productos",
        operacion: "ACTUALIZAR",
        payload: productoLocal,
        actualizaStock: true,
        soloLAN: true,
      });
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
      if (tiendaId) {
        await sincronizarConCola("productos", "ELIMINAR", id, () => supabase.from("productos").delete().eq("id", id).eq("tienda_id", tiendaId));
      } else await registrarPendienteSync({ tabla: "productos", operacion: "ELIMINAR", payload: id });
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
          await sincronizarConCola("categorias", "ACTUALIZAR", actualizada, () => supabase.from('categorias').upsert({
            id: actualizada.id,
            tienda_id: tiendaId,
            nombre: actualizada.nombre,
            color: actualizada.color
          }));
        } else await registrarPendienteSync({ tabla: "categorias", operacion: "ACTUALIZAR", payload: actualizada });
      } else if (!navigator.onLine && debeSincronizarConNube()) {
        await registrarPendienteSync({ tabla: 'categorias', operacion: 'ACTUALIZAR', payload: actualizada });
      }
      return actualizada;
    }
    
    const existente = get().categorias.find((c) => c.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (existente) return existente;

    const nueva: Categoria = { 
      id: id || crearIdentificadorUnico(),
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
      if (tiendaId) {
        await sincronizarConCola("categorias", "AGREGAR", nueva, () => supabase.from('categorias').upsert({ id: nueva.id, tienda_id: tiendaId, nombre: nueva.nombre, color: nueva.color }));
      } else await registrarPendienteSync({ tabla: "categorias", operacion: "AGREGAR", payload: nueva });
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
      if (tiendaId) {
        await sincronizarConCola("categorias", "ELIMINAR", id, () => supabase.from('categorias').delete().eq('id', id).eq('tienda_id', tiendaId));
      } else await registrarPendienteSync({ tabla: "categorias", operacion: "ELIMINAR", payload: id });
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: 'categorias', operacion: 'ELIMINAR', payload: id });
    }
  },

  guardarUnidadMedida: async (nombre, id, propagado = false) => {
    const nombreLimpio = nombre.trim().replace(/\s+/g, " ");
    const nombreNormalizado = normalizarNombreUnidad(nombreLimpio);
    if (!nombreNormalizado) throw new Error("Escribe el nombre de la unidad de medida.");
    if (nombreLimpio.length > 40) throw new Error("El nombre no puede tener más de 40 caracteres.");

    const existentes = get().unidadesMedida;
    const existente = id ? existentes.find((unidad) => unidad.id === id) : undefined;
    if (id && !existente) throw new Error("La unidad que quieres editar ya no está disponible.");

    const nombrePredefinido = UNIDADES_MEDIDA_PREDEFINIDAS.some((unidad) =>
      normalizarNombreUnidad(unidad.nombre) === nombreNormalizado
      || normalizarNombreUnidad(unidad.valor) === nombreNormalizado
    );
    if (nombrePredefinido) throw new Error("Ese nombre está reservado para una unidad predefinida.");
    if (existentes.some((unidad) =>
      unidad.id !== id && normalizarNombreUnidad(unidad.nombre) === nombreNormalizado
    )) {
      throw new Error("Ya existe una unidad de medida con ese nombre.");
    }

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const { data, error } = await supabase
          .from("unidades_medida")
          .select("id, nombre")
          .eq("tienda_id", tiendaId);
        if (error) throw new Error(`No se pudieron validar las unidades guardadas en la nube: ${error.message}`);
        if (data.some((unidad) =>
          unidad.id !== id && normalizarNombreUnidad(unidad.nombre) === nombreNormalizado
        )) {
          throw new Error("Ya existe una unidad de medida con ese nombre en la tienda.");
        }
      }
    }

    const guardada: UnidadMedida = existente
      ? { ...existente, nombre: nombreLimpio }
      : { id: crearIdentificadorUnico(), nombre: nombreLimpio };

    if (!propagado && enviarAccionLAN({
      tipo: existente ? "ACTUALIZAR_UNIDAD_MEDIDA" : "AGREGAR_UNIDAD_MEDIDA",
      payload: guardada
    })) {
      await guardarRegistro("unidades_medida", guardada);
      if (existente && existente.nombre !== guardada.nombre) {
        for (const producto of get().productos.filter((item) =>
          normalizarNombreUnidad(item.unidad) === normalizarNombreUnidad(existente.nombre)
        )) {
          await get().actualizarProducto({ ...producto, unidad: guardada.nombre }, true);
        }
      }
      set((estado) => ({
        unidadesMedida: existente
          ? estado.unidadesMedida.map((unidad) => unidad.id === id ? guardada : unidad)
          : [...estado.unidadesMedida, guardada]
      }));
      return guardada;
    }

    if (existente && existente.nombre !== guardada.nombre) {
      for (const producto of get().productos.filter((item) =>
        normalizarNombreUnidad(item.unidad) === normalizarNombreUnidad(existente.nombre)
      )) {
        await get().actualizarProducto({ ...producto, unidad: guardada.nombre }, true);
      }
    }

    await guardarRegistro("unidades_medida", guardada);
    set((estado) => ({
      unidadesMedida: existente
        ? estado.unidadesMedida.map((unidad) => unidad.id === id ? guardada : unidad)
        : [...estado.unidadesMedida, guardada]
    }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        await sincronizarConCola("unidades_medida", existente ? "ACTUALIZAR" : "AGREGAR", guardada, () =>
          supabase.from("unidades_medida").upsert({ id: guardada.id, tienda_id: tiendaId, nombre: guardada.nombre })
        );
      } else {
        await registrarPendienteSync({ tabla: "unidades_medida", operacion: existente ? "ACTUALIZAR" : "AGREGAR", payload: guardada });
      }
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: "unidades_medida", operacion: existente ? "ACTUALIZAR" : "AGREGAR", payload: guardada });
    }
    return guardada;
  },

  eliminarUnidadMedida: async (id, propagado = false) => {
    const unidad = get().unidadesMedida.find((item) => item.id === id);
    if (!unidad) return;
    if (get().productos.some((producto) =>
      normalizarNombreUnidad(producto.unidad) === normalizarNombreUnidad(unidad.nombre)
    )) {
      throw new Error("No se puede eliminar: primero cambia la unidad de los productos que la utilizan.");
    }

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        const { data, error } = await supabase
          .from("productos")
          .select("id")
          .eq("tienda_id", tiendaId)
          .eq("unidad", unidad.nombre)
          .limit(1);
        if (error) throw new Error(`No se pudo comprobar si algún producto utiliza esta unidad: ${error.message}`);
        if (data.length > 0) throw new Error("No se puede eliminar: primero cambia la unidad de los productos que la utilizan.");
      }
    }

    if (!propagado && enviarAccionLAN({ tipo: "ELIMINAR_UNIDAD_MEDIDA", payload: id })) {
      await eliminarRegistro("unidades_medida", id);
      set((estado) => ({ unidadesMedida: estado.unidadesMedida.filter((item) => item.id !== id) }));
      return;
    }

    await eliminarRegistro("unidades_medida", id);
    set((estado) => ({ unidadesMedida: estado.unidadesMedida.filter((item) => item.id !== id) }));

    if (navigator.onLine && debeSincronizarConNube()) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        await sincronizarConCola("unidades_medida", "ELIMINAR", id, () =>
          supabase.from("unidades_medida").delete().eq("id", id).eq("tienda_id", tiendaId)
        );
      } else {
        await registrarPendienteSync({ tabla: "unidades_medida", operacion: "ELIMINAR", payload: id });
      }
    } else if (!navigator.onLine && debeSincronizarConNube()) {
      await registrarPendienteSync({ tabla: "unidades_medida", operacion: "ELIMINAR", payload: id });
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
          stock_actual: Math.max(0, Math.round((producto.stock_actual - cantidadDescontada) * 1000) / 1000),
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
        stock_actual: Math.max(0, Math.round((producto.stock_actual - cantidadDescontada) * 1000) / 1000),
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
  },

  sincronizarUnidadMedida: async (payload: unknown) => {
    if (!esEventoUnidadMedidaNube(payload)) return;
    const { eventType, new: nuevo, old: viejo } = payload;
    if (eventType === "DELETE") {
      const id = viejo?.id;
      if (typeof id !== "string") return;
      const unidad = get().unidadesMedida.find((item) => item.id === id);
      if (!unidad) return;
      if (get().productos.some((producto) =>
        normalizarNombreUnidad(producto.unidad) === normalizarNombreUnidad(unidad.nombre)
      )) {
        console.error(`Supabase eliminó la unidad "${unidad.nombre}" aunque todavía está asignada a productos.`);
        return;
      }
      if (esEscritorio) await eliminarRegistro("unidades_medida", id);
      set((estado) => ({ unidadesMedida: estado.unidadesMedida.filter((item) => item.id !== id) }));
      enviarAccionLAN({ tipo: "ELIMINAR_UNIDAD_MEDIDA", payload: id });
      return;
    }
    if (typeof nuevo?.id !== "string" || typeof nuevo?.nombre !== "string") return;
    const unidadNube: UnidadMedida = { id: nuevo.id, nombre: nuevo.nombre };
    const anterior = get().unidadesMedida.find((item) => item.id === unidadNube.id);
    const productosActualizados = anterior && anterior.nombre !== unidadNube.nombre
      ? get().productos.map((producto) =>
        normalizarNombreUnidad(producto.unidad) === normalizarNombreUnidad(anterior.nombre)
          ? { ...producto, unidad: unidadNube.nombre }
          : producto
      )
      : get().productos;
    if (esEscritorio) {
      await guardarRegistro("unidades_medida", unidadNube);
      for (const producto of productosActualizados) {
        if (get().productos.find((actual) => actual.id === producto.id)?.unidad !== producto.unidad) {
          await guardarRegistro("productos", producto);
        }
      }
    }
    set((estado) => ({
      unidadesMedida: anterior
        ? estado.unidadesMedida.map((item) => item.id === unidadNube.id ? unidadNube : item)
        : [...estado.unidadesMedida, unidadNube],
      productos: productosActualizados
    }));
    enviarAccionLAN({
      tipo: eventType === "INSERT" ? "AGREGAR_UNIDAD_MEDIDA" : "ACTUALIZAR_UNIDAD_MEDIDA",
      payload: unidadNube
    });
  }
}));