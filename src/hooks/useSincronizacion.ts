// src/hooks/useSincronizacion.ts
import { useState, useEffect } from "react";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { obtenerPendientesSync, eliminarPendienteSync } from "../servicios/db";
import { cifrarPin } from "../utilidades/seguridad";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoCaja } from "../estado/estadoCaja";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { obtenerRolCerebro } from "../servicios/cerebroTienda";
import { useEstadoRed } from "../estado/estadoRed";
import { useEstadoPlan } from "../estado/estadoPlan";
import { crearIdentificadorUnico } from "../utilidades/identificador";
import { esRespaldoLocal } from "../servicios/cerebroTienda";

export function useSincronizacion() {
  const [estaEnLinea, setEstaEnLinea] = useState(navigator.onLine);
  const { trabajadorActivo } = useEstadoTrabajadores();
  const permiteNube = useEstadoPlan((estado) => estado.permiteNube);
  const { esMaestro, conectadoLAN } = useEstadoRed();

  useEffect(() => {
    const cargarRolCerebro = async () => {
      if (esRespaldoLocal()) {
        useEstadoRed.getState().setEsMaestro(false);
        useEstadoRed.getState().setEsRespaldo(true);
        return;
      }
      if (!estaEnLinea || !permiteNube) return;
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId || !(window as any).apiLocal) return;

      try {
        const esCerebro = await obtenerRolCerebro(tiendaId);
        useEstadoRed.getState().setEsMaestro(esCerebro);
      } catch (error) {
        console.error("No se pudo validar la PC cerebro:", error);
      }
    };

    cargarRolCerebro();
  }, [estaEnLinea, permiteNube]);

  useEffect(() => {
    const handleOnline = () => setEstaEnLinea(true);
    const handleOffline = () => setEstaEnLinea(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let procesamientoEnCurso = false;
    const procesarColaPendientes = async () => {
      if (!estaEnLinea || !navigator.onLine || !permiteNube || (!esMaestro && conectadoLAN) || procesamientoEnCurso) return;
      procesamientoEnCurso = true;

      try {
        const tiendaId = await obtenerTiendaIdActual();
        if (!tiendaId) return;

        const pendientes = await obtenerPendientesSync();
        if (pendientes.length === 0) return;

        console.log(`Procesando ${pendientes.length} acciones pendientes (Sincronización Automática)...`);

        const { categorias } = useEstadoInventario.getState();

        for (const tarea of pendientes) {
          try {
            const { id, tabla, operacion, payload } = tarea;

            if (tabla === 'ventas' && payload?.metodoPago === 'FIADO') {
              await eliminarPendienteSync(id);
              continue;
            }

            if (operacion === 'ELIMINAR') {
              if (tabla === 'miembros_tienda') {
                const { error } = await supabase.from(tabla).delete().eq('tienda_id', tiendaId).eq('usuario_id', payload);
                if (error) throw error;
              } else {
                const { error } = await supabase.from(tabla).delete().eq('tienda_id', tiendaId).eq('id', payload);
                if (error) throw error;
              }
            } else {
              let dataUpsert = null;

              if (tabla === 'productos') {
                const cat = categorias.find((c: any) => c.nombre === payload.categoria);
                dataUpsert = {
                  id: payload.id,
                  tienda_id: tiendaId,
                  categoria_id: cat?.id,
                  barcode: payload.codigo_barras,
                  nombre: payload.nombre,
                  descripcion: payload.descripcion || null,
                  ubicacion: payload.ubicacion || null,
                  paquete: payload.paquete || null,
                  unidad: payload.unidad,
                  stock_actual: payload.stock_actual,
                  stock_minimo: payload.stock_minimo,
                  controla_stock: payload.controla_stock,
                  precio: payload.precio,
                  costo: payload.costo,
                  descuento_porcentaje: payload.descuento_porcentaje,
                  activo: payload.activo,
                  requiere_autorizacion: payload.requiere_autorizacion,
                  mensaje_autorizacion: payload.mensaje_autorizacion || null,
                  permite_foto_autorizacion: payload.permite_foto_autorizacion,
                  lotes: payload.lotes ?? [],
                  nombre_archivo_local: payload.imagen_archivo || null
                };
              } else if (tabla === 'categorias') {
                dataUpsert = { id: payload.id, tienda_id: tiendaId, nombre: payload.nombre, color: payload.color };
              } else if (tabla === 'miembros_tienda') {
                const permisosNube = payload.permisos ? { ...payload.permisos } : payload.permisos;
                if (permisosNube) delete permisosNube.permisoFiados;
                dataUpsert = {
                  tienda_id: tiendaId,
                  usuario_id: payload.id,
                  rol: payload.rol,
                  nombre: payload.nombre,
                  pin_hash: cifrarPin(payload.pin),
                  activo: payload.activo,
                  horario: payload.horarioSemanal,
                  permisos: permisosNube
                };
              } else if (tabla === 'asistencias') {
                dataUpsert = {
                  id: payload.id,
                  tienda_id: tiendaId,
                  trabajador_id: payload.trabajadorId,
                  fecha: payload.fecha,
                  hora_entrada: payload.horaEntrada,
                  hora_salida: payload.horaSalida,
                  desconexiones: payload.desconexiones
                };
              } else if (tabla === 'turnos_caja') {
                dataUpsert = {
                  id: payload.id,
                  tienda_id: tiendaId,
                  trabajador_id: payload.trabajadorId,
                  nombre_trabajador: payload.nombreTrabajador,
                  fecha_inicio: payload.fechaInicio,
                  fecha_fin: payload.fechaFin,
                  fondo_inicial: payload.fondoInicial,
                  fondo_dejado: payload.fondoDejado,
                  ventas_calculadas: payload.ventasCalculadas,
                  nota_trabajador: payload.notaTrabajador,
                  nota_dueno: payload.notaDueno,
                  cerrado_por: payload.cerradoPor,
                  estatus: payload.estatus
                };
              } else if (tabla === 'ventas') {
                if (operacion === 'AGREGAR') {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error("No hay una sesión autenticada para subir la venta pendiente.");
                  const { error } = await supabase.from('ventas').upsert({
                    id: payload.id,
                    tienda_id: tiendaId,
                    vendedor_id: payload.vendedor_id || session.user.id,
                    trabajador_nombre: payload.trabajador,
                    subtotal: payload.subtotal,
                    descuento: payload.descuento,
                    total: payload.total,
                    metodo_pago: payload.metodoPago,
                    cancelada: payload.cancelada || false,
                    created_at: payload.fecha
                  }, { onConflict: 'id' });
                  if (error) throw error;

                  const detalles = payload.articulos.map((art: any) => ({
                    venta_id: payload.id,
                    producto_id: art.producto_id,
                    nombre_producto: art.nombre,
                    cantidad: art.cantidad,
                    precio_unitario: art.precio,
                    costo_unitario: art.costo || 0,
                    subtotal: art.subtotal,
                    autorizacion_confirmada: art.autorizacion_confirmada || false,
                    evidencia_nombre_archivo_local: null
                  }));
                  const { error: errorEliminarDetalles } = await supabase.from('venta_detalles').delete().eq('venta_id', payload.id);
                  if (errorEliminarDetalles) throw errorEliminarDetalles;
                  if (detalles.length > 0) {
                    const { error: errorDetalles } = await supabase.from('venta_detalles').insert(detalles);
                    if (errorDetalles) throw errorDetalles;
                  }
                } else if (operacion === 'ACTUALIZAR') {
                  const { error } = await supabase.from('ventas').update({ cancelada: payload.cancelada }).eq('id', payload.id).eq('tienda_id', tiendaId);
                  if (error) throw error;
                }
                dataUpsert = null;
              } else if (tabla === 'tiendas') {
                const { data, error } = await supabase
                  .from('tiendas')
                  .update(payload)
                  .eq('id', tiendaId)
                  .select('id')
                  .maybeSingle();
                if (error) throw error;
                if (!data) throw new Error("No se encontró la tienda para aplicar la sincronización pendiente.");
                dataUpsert = null;
              }

              if (dataUpsert) {
                const { error } = await supabase.from(tabla).upsert(dataUpsert, {
                  onConflict: tabla === 'miembros_tienda' ? 'tienda_id, usuario_id' : 'id'
                });
                if (error) throw error;
              }
            }

            await eliminarPendienteSync(id);
          } catch (error) {
            console.error(`Error al procesar tarea pendiente ${tarea.id}:`, error);
            break;
          }
        }
      } catch (error) {
        console.error("No se pudo consultar la cola de sincronización pendiente:", error);
      } finally {
        procesamientoEnCurso = false;
      }
    };

    if (!estaEnLinea || !permiteNube || (!esMaestro && conectadoLAN)) return;
    void procesarColaPendientes();
    const intervalo = window.setInterval(() => void procesarColaPendientes(), 30_000);
    return () => window.clearInterval(intervalo);
  }, [estaEnLinea, permiteNube, esMaestro, conectadoLAN]);

  useEffect(() => {
    let canalTiempoReal: any;
    let cancelado = false;

    const suscribirTiempoReal = async () => {
      if (!estaEnLinea || !permiteNube || (!esMaestro && conectadoLAN)) return;
      
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId || cancelado) return;

      canalTiempoReal = supabase.channel(`sincronizacion-tienda-${tiendaId}-${crearIdentificadorUnico()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'miembros_tienda', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoTrabajadores.getState().sincronizarTrabajador(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoInventario.getState().sincronizarProducto(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoInventario.getState().sincronizarCategoria(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoVentas.getState().sincronizarVenta(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'venta_detalles' }, (payload) => {
          useEstadoVentas.getState().sincronizarVenta(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos_caja', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoCaja.getState().sincronizarTurno(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencias', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoAsistencias.getState().sincronizarAsistencia(payload);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tiendas', filter: `id=eq.${tiendaId}` }, (payload) => {
          useEstadoCaja.getState().sincronizarTienda(payload);
          void useEstadoConfiguracion.getState().sincronizarConfiguracion(payload).catch((error: unknown) => {
            console.error("No se pudo sincronizar la configuración recibida desde Supabase:", error);
          });
        })
      if (!cancelado) canalTiempoReal.subscribe();
    };

    suscribirTiempoReal();

    return () => {
      cancelado = true;
      if (canalTiempoReal) supabase.removeChannel(canalTiempoReal);
    };
  }, [estaEnLinea, trabajadorActivo, permiteNube, esMaestro, conectadoLAN]);

  return { estaEnLinea };
}