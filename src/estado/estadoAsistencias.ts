// src/estado/estadoAsistencias.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

export interface RegistroAsistencia {
  id: string; // Formato: trabajadorId_YYYY-MM-DD
  trabajadorId: string;
  fecha: string;
  horaEntrada: string;
  horaSalida: string | null;
  desconexiones: number;
}

interface EstadoAsistencias {
  asistencias: RegistroAsistencia[];
  cargarAsistencias: () => Promise<void>;
  registrarEntrada: (trabajadorId: string) => Promise<void>;
  registrarSalida: (trabajadorId: string) => Promise<void>;
  sincronizarAsistencia: (payload: any) => Promise<void>;
}

export const useEstadoAsistencias = create<EstadoAsistencias>((set, get) => ({
  asistencias: [],

  cargarAsistencias: async () => {
    try {
      // 1. Carga desde almacenamiento local (Offline-first)
      const dataLocal = await obtenerRegistros("asistencias");
      let asistenciasMapeadas = dataLocal as RegistroAsistencia[];
      set({ asistencias: asistenciasMapeadas });

      // 2. Sincronización con la nube (Diff y Purga)
      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          const { data: nubeData, error } = await supabase
            .from("asistencias")
            .select("*")
            .eq("tienda_id", tiendaId);

          if (!error && nubeData) {
            const asistenciasNube: RegistroAsistencia[] = nubeData.map((a: any) => ({
              id: a.id,
              trabajadorId: a.trabajador_id,
              fecha: a.fecha,
              horaEntrada: a.hora_entrada,
              horaSalida: a.hora_salida,
              desconexiones: a.desconexiones
            }));
            
            // Reconciliación: Borrar locales que ya no existen en la nube
            const idsNube = new Set(asistenciasNube.map(a => a.id));
            for (const asisLocal of asistenciasMapeadas) {
              if (!idsNube.has(asisLocal.id)) {
                await eliminarRegistro("asistencias", asisLocal.id);
              }
            }

            // Actualizar persistencia local con los datos más recientes de la nube
            for (const asis of asistenciasNube) {
              await guardarRegistro("asistencias", asis);
            }

            set({ asistencias: asistenciasNube });
          }
        }
      }
    } catch (error) {
      console.error("Error al cargar asistencias:", error);
    }
  },

  registrarEntrada: async (trabajadorId: string) => {
    const hoy = new Date();
    const fechaLocal = hoy.toLocaleDateString("en-CA"); // YYYY-MM-DD local
    const horaLocal = hoy.toLocaleTimeString("en-GB", { hour12: false }); // HH:MM:SS
    const idRegistro = `${trabajadorId}_${fechaLocal}`;

    const { asistencias } = get();
    const registroExistente = asistencias.find((a) => a.id === idRegistro);

    let nuevoRegistro: RegistroAsistencia;
    let operacionTipo: 'AGREGAR' | 'ACTUALIZAR' = 'AGREGAR';

    if (registroExistente) {
      // Ya había entrado hoy. Significa que se desconectó y volvió a entrar.
      nuevoRegistro = { ...registroExistente, horaSalida: null };
      operacionTipo = 'ACTUALIZAR';
    } else {
      // Primera entrada del día
      nuevoRegistro = {
        id: idRegistro,
        trabajadorId,
        fecha: fechaLocal,
        horaEntrada: horaLocal,
        horaSalida: null,
        desconexiones: 0,
      };
    }

    // Guardado local
    await guardarRegistro("asistencias", nuevoRegistro);
    set((estado) => ({
      asistencias: estado.asistencias.filter((a) => a.id !== idRegistro).concat(nuevoRegistro),
    }));

    // Guardado en la nube o en cola pendiente
    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        await supabase.from("asistencias").upsert({
          id: nuevoRegistro.id,
          tienda_id: tiendaId,
          trabajador_id: nuevoRegistro.trabajadorId,
          fecha: nuevoRegistro.fecha,
          hora_entrada: nuevoRegistro.horaEntrada,
          hora_salida: nuevoRegistro.horaSalida,
          desconexiones: nuevoRegistro.desconexiones
        }, { onConflict: 'id' });
      }
    } else {
      await registrarPendienteSync({ tabla: 'asistencias', operacion: operacionTipo, payload: nuevoRegistro });
    }
  },

  registrarSalida: async (trabajadorId: string) => {
    const hoy = new Date();
    const fechaLocal = hoy.toLocaleDateString("en-CA");
    const horaLocal = hoy.toLocaleTimeString("en-GB", { hour12: false });
    const idRegistro = `${trabajadorId}_${fechaLocal}`;

    const { asistencias } = get();
    const registroExistente = asistencias.find((a) => a.id === idRegistro);

    if (registroExistente) {
      // Registra salida e incrementa desconexiones
      const nuevoRegistro = {
        ...registroExistente,
        horaSalida: horaLocal,
        desconexiones: registroExistente.desconexiones + 1,
      };
      
      // Guardado local
      await guardarRegistro("asistencias", nuevoRegistro);
      set((estado) => ({
        asistencias: estado.asistencias.filter((a) => a.id !== idRegistro).concat(nuevoRegistro),
      }));

      // Guardado en la nube o en cola pendiente
      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from("asistencias").update({
            hora_salida: nuevoRegistro.horaSalida,
            desconexiones: nuevoRegistro.desconexiones
          }).eq("id", nuevoRegistro.id).eq("tienda_id", tiendaId);
        }
      } else {
        await registrarPendienteSync({ tabla: 'asistencias', operacion: 'ACTUALIZAR', payload: nuevoRegistro });
      }
    }
  },

  sincronizarAsistencia: async (payload: any) => {
    const { eventType, new: nuevo, old: viejo } = payload;
    const registroAnterior = viejo as { id?: string } | null;
    const registroNuevo = nuevo as {
      id: string;
      trabajador_id: string;
      fecha: string;
      hora_entrada: string;
      hora_salida: string | null;
      desconexiones: number;
    } | null;

    if (eventType === "DELETE") {
      if (!registroAnterior?.id) return;
      set((estado) => ({ asistencias: estado.asistencias.filter((a) => a.id !== registroAnterior.id) }));
      return;
    }

    if (!registroNuevo) return;
    const asistencia: RegistroAsistencia = {
      id: registroNuevo.id,
      trabajadorId: registroNuevo.trabajador_id,
      fecha: registroNuevo.fecha,
      horaEntrada: registroNuevo.hora_entrada,
      horaSalida: registroNuevo.hora_salida,
      desconexiones: registroNuevo.desconexiones
    };

    await guardarRegistro("asistencias", asistencia);
    set((estado) => ({
      asistencias: estado.asistencias.some((a) => a.id === asistencia.id)
        ? estado.asistencias.map((a) => a.id === asistencia.id ? asistencia : a)
        : [...estado.asistencias, asistencia]
    }));
  },
}));