// src/hooks/useSincronizacion.ts
import { useState, useEffect } from "react";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { obtenerPendientesSync, eliminarPendienteSync } from "../servicios/db";
import { cifrarPin } from "../utilidades/seguridad";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";

export function useSincronizacion() {
  const [estaEnLinea, setEstaEnLinea] = useState(navigator.onLine);
  const { trabajadorActivo } = useEstadoTrabajadores();

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
    const procesarColaPendientes = async () => {
      if (!estaEnLinea) return;
      
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) return;

      const pendientes = await obtenerPendientesSync();
      if (pendientes.length === 0) return;

      const { categorias } = useEstadoInventario.getState();

      for (const tarea of pendientes) {
        try {
          const { id, tabla, operacion, payload } = tarea;

          if (operacion === 'ELIMINAR') {
            if (tabla === 'miembros_tienda') {
              await supabase.from(tabla).delete().eq('tienda_id', tiendaId).eq('usuario_id', payload);
            } else {
              await supabase.from(tabla).delete().eq('tienda_id', tiendaId).eq('id', payload);
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
                nombre_archivo_local: payload.imagen_url || null
              };
            } else if (tabla === 'categorias') {
              dataUpsert = { id: payload.id, tienda_id: tiendaId, nombre: payload.nombre, color: payload.color };
            } else if (tabla === 'miembros_tienda') {
              dataUpsert = {
                tienda_id: tiendaId,
                usuario_id: payload.id,
                rol: payload.rol,
                nombre: payload.nombre,
                pin_hash: cifrarPin(payload.pin),
                activo: payload.activo,
                horario: payload.horarioSemanal,
                permisos: payload.permisos
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
            }

            if (dataUpsert) {
              await supabase.from(tabla).upsert(dataUpsert, { 
                onConflict: tabla === 'miembros_tienda' ? 'tienda_id, usuario_id' : 'id' 
              });
            }
          }

          await eliminarPendienteSync(id);
        } catch (error) {
          console.error(`Error al procesar tarea pendiente ${tarea.id}:`, error);
          break; 
        }
      }
    };

    if (estaEnLinea) {
      procesarColaPendientes();
    }
  }, [estaEnLinea]);

  useEffect(() => {
    let canalTiempoReal: any;

    const suscribirTiempoReal = async () => {
      if (!estaEnLinea || !trabajadorActivo) return;
      
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) return;

      // Inyección silenciosa del estado en memoria
      canalTiempoReal = supabase.channel('sincronizacion-tienda')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'miembros_tienda', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoTrabajadores.getState().sincronizarTrabajador(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoInventario.getState().sincronizarProducto(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categorias', filter: `tienda_id=eq.${tiendaId}` }, (payload) => {
          useEstadoInventario.getState().sincronizarCategoria(payload);
        })
        .subscribe();
    };

    suscribirTiempoReal();

    return () => {
      if (canalTiempoReal) supabase.removeChannel(canalTiempoReal);
    };
  }, [estaEnLinea, trabajadorActivo]);

  return { estaEnLinea };
}