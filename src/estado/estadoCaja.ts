// src/estado/estadoCaja.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;

export interface TurnoCaja {
  id: string;
  trabajadorId: string;
  nombreTrabajador: string;
  fechaInicio: string;
  fechaFin: string | null;
  fondoInicial: number;
  fondoDejado: number | null;
  ventasCalculadas: number | null;
  notaTrabajador: string;
  notaDueno: string;
  estatus: "ABIERTO" | "CERRADO";
}

interface EstadoCaja {
  fondoBaseActual: number;
  notaGeneralDueno: string;
  turnos: TurnoCaja[];
  forzarRecepcionCaja: boolean; 
  requerirPinCancelacion: boolean;
  cargando: boolean;
  
  cargarCaja: () => Promise<void>;
  actualizarConfiguracion: (nuevoFondo: number, nuevaNota: string) => void;
  abrirTurno: (trabajadorId: string, nombreTrabajador: string, fondo: number) => Promise<void>;
  cerrarTurno: (turnoId: string, fondoDejado: number, ventasCalculadas: number, notaTrabajador: string) => Promise<void>;
  obtenerTurnoActivo: (trabajadorId: string) => TurnoCaja | undefined;
  setForzarRecepcionCaja: (valor: boolean) => Promise<void>; 
  setRequerirPinCancelacion: (valor: boolean) => Promise<void>;
  sincronizarTurno: (payload: any) => Promise<void>;
  sincronizarTienda: (payload: any) => Promise<void>;
}

export const useEstadoCaja = create<EstadoCaja>((set, get) => ({
  fondoBaseActual: 1000,
  notaGeneralDueno: "Recuerden revisar los billetes grandes.",
  turnos: [],
  forzarRecepcionCaja: false, 
  requerirPinCancelacion: false,
  cargando: true,

  cargarCaja: async () => {
    set({ cargando: true });
    try {
      const tiendaId = await obtenerTiendaIdActual();

      if (navigator.onLine && tiendaId) {
        const { data: turnosNube } = await supabase
          .from('turnos_caja')
          .select('*')
          .eq('tienda_id', tiendaId)
          .order('fecha_inicio', { ascending: false });

        const { data: tiendaData } = await supabase
          .from('tiendas')
          .select('forzar_recepcion_caja, requerir_pin_cancelacion, fondo_base_actual, nota_general_dueno')
          .eq('id', tiendaId)
          .single();

        if (turnosNube && tiendaData) {
          const turnosMapeados: TurnoCaja[] = turnosNube.map((t: any) => ({
            id: t.id,
            trabajadorId: t.trabajador_id,
            nombreTrabajador: t.nombre_trabajador,
            fechaInicio: t.fecha_inicio,
            fechaFin: t.fecha_fin,
            fondoInicial: t.fondo_inicial,
            fondoDejado: t.fondo_dejado,
            ventasCalculadas: t.ventas_calculadas,
            notaTrabajador: t.nota_trabajador || "",
            notaDueno: t.nota_dueno || "",
            estatus: t.estatus
          }));

          const nuevasConfigs = {
            forzarRecepcionCaja: tiendaData.forzar_recepcion_caja,
            requerirPinCancelacion: tiendaData.requerir_pin_cancelacion,
            fondoBaseActual: Number(tiendaData.fondo_base_actual ?? get().fondoBaseActual),
            notaGeneralDueno: tiendaData.nota_general_dueno ?? get().notaGeneralDueno
          };

          if (esEscritorio) {
            const turnosLocal = await obtenerRegistros("turnos_caja");
            const idsNube = new Set(turnosMapeados.map(t => t.id));
            for (const tLocal of turnosLocal) {
              if (!idsNube.has(tLocal.id)) await eliminarRegistro("turnos_caja", tLocal.id);
            }
            for (const t of turnosMapeados) {
              await guardarRegistro("turnos_caja", t);
            }

            await guardarRegistro("config_caja", { id: 'config_caja_1', ...get(), ...nuevasConfigs });
          }

          set({ turnos: turnosMapeados, ...nuevasConfigs, cargando: false });
          return;
        }
      }

      let turnosEstado: TurnoCaja[] = [];
      const dataTurnos = await obtenerRegistros("turnos_caja");
      turnosEstado = (dataTurnos as TurnoCaja[]).sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());

      const configLocal = await obtenerRegistros("config_caja");
      if (configLocal && configLocal.length > 0) {
        const conf = configLocal[0];
        set({
          fondoBaseActual: conf.fondoBaseActual ?? 1000,
          notaGeneralDueno: conf.notaGeneralDueno ?? "",
          forzarRecepcionCaja: conf.forzarRecepcionCaja ?? false,
          requerirPinCancelacion: conf.requerirPinCancelacion ?? false,
          turnos: turnosEstado,
          cargando: false
        });
      } else {
        set({ turnos: turnosEstado, cargando: false });
      }
    } catch (error) {
      console.error("Error al cargar caja:", error);
      set({ cargando: false });
    }
  },

  actualizarConfiguracion: async (nuevoFondo, nuevaNota) => {
    set({ fondoBaseActual: nuevoFondo, notaGeneralDueno: nuevaNota });
    if (esEscritorio) {
      await guardarRegistro("config_caja", { id: 'config_caja_1', ...get(), fondoBaseActual: nuevoFondo, notaGeneralDueno: nuevaNota });
    }
    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('tiendas').update({ fondo_base_actual: nuevoFondo, nota_general_dueno: nuevaNota }).eq('id', tiendaId);
    } else {
      await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { fondo_base_actual: nuevoFondo, nota_general_dueno: nuevaNota } });
    }
  },

  abrirTurno: async (trabajadorId, nombreTrabajador, fondo) => {
    const nuevoTurno: TurnoCaja = {
      id: crypto.randomUUID(),
      trabajadorId,
      nombreTrabajador,
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      fondoInicial: fondo,
      fondoDejado: null,
      ventasCalculadas: null,
      notaTrabajador: "",
      notaDueno: "",
      estatus: "ABIERTO",
    };

    await guardarRegistro("turnos_caja", nuevoTurno);
    set((state) => ({ turnos: [nuevoTurno, ...state.turnos] }));

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) {
        await supabase.from('turnos_caja').insert({
          id: nuevoTurno.id,
          tienda_id: tiendaId,
          trabajador_id: trabajadorId,
          nombre_trabajador: nombreTrabajador,
          fecha_inicio: nuevoTurno.fechaInicio,
          fondo_inicial: fondo,
          estatus: 'ABIERTO'
        });
      }
    } else {
      await registrarPendienteSync({ tabla: 'turnos_caja', operacion: 'AGREGAR', payload: nuevoTurno });
    }
  },

  cerrarTurno: async (turnoId, fondoDejado, ventasCalculadas, notaTrabajador) => {
    const fechaFin = new Date().toISOString();
    set((state) => ({
      turnos: state.turnos.map((t) =>
        t.id === turnoId ? { ...t, fechaFin, fondoDejado, ventasCalculadas, notaTrabajador, estatus: "CERRADO" } : t
      ),
    }));

    const turnoActualizado = get().turnos.find(t => t.id === turnoId);
    if (turnoActualizado) {
      await guardarRegistro("turnos_caja", turnoActualizado);

      if (navigator.onLine) {
        const tiendaId = await obtenerTiendaIdActual();
        if (tiendaId) {
          await supabase.from('turnos_caja').update({
            fecha_fin: fechaFin,
            fondo_dejado: fondoDejado,
            ventas_calculadas: ventasCalculadas,
            nota_trabajador: notaTrabajador,
            estatus: 'CERRADO'
          }).eq('id', turnoId).eq('tienda_id', tiendaId);
        }
      } else {
        await registrarPendienteSync({ tabla: 'turnos_caja', operacion: 'ACTUALIZAR', payload: turnoActualizado });
      }
    }
  },

  obtenerTurnoActivo: (trabajadorId) => {
    return get().turnos.find((t) => t.trabajadorId === trabajadorId && t.estatus === "ABIERTO");
  },

  setForzarRecepcionCaja: async (valor) => {
    set({ forzarRecepcionCaja: valor });
    if (esEscritorio) await guardarRegistro("config_caja", { id: 'config_caja_1', ...get(), forzarRecepcionCaja: valor });

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('tiendas').update({ forzar_recepcion_caja: valor }).eq('id', tiendaId);
    } else {
      await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { forzar_recepcion_caja: valor } });
    }
  },
  
  setRequerirPinCancelacion: async (valor) => {
    set({ requerirPinCancelacion: valor });
    if (esEscritorio) await guardarRegistro("config_caja", { id: 'config_caja_1', ...get(), requerirPinCancelacion: valor });

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual();
      if (tiendaId) await supabase.from('tiendas').update({ requerir_pin_cancelacion: valor }).eq('id', tiendaId);
    } else {
      await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload: { requerir_pin_cancelacion: valor } });
    }
  },

  // Sincronización silenciosa
  sincronizarTurno: async (payload: any) => {
    const { eventType, new: nuevo, old: viejo } = payload;
    const { turnos } = get();

    if (eventType === 'DELETE') {
      if (esEscritorio) await eliminarRegistro("turnos_caja", viejo.id);
      set({ turnos: turnos.filter(t => t.id !== viejo.id) });
    } else {
      const turnoMapeado: TurnoCaja = {
        id: nuevo.id,
        trabajadorId: nuevo.trabajador_id,
        nombreTrabajador: nuevo.nombre_trabajador,
        fechaInicio: nuevo.fecha_inicio,
        fechaFin: nuevo.fecha_fin,
        fondoInicial: nuevo.fondo_inicial,
        fondoDejado: nuevo.fondo_dejado,
        ventasCalculadas: nuevo.ventas_calculadas,
        notaTrabajador: nuevo.nota_trabajador || "",
        notaDueno: nuevo.nota_dueno || "",
        estatus: nuevo.estatus
      };

      if (esEscritorio) await guardarRegistro("turnos_caja", turnoMapeado);

      if (eventType === 'INSERT') {
        if (!turnos.some(t => t.id === turnoMapeado.id)) {
          set({ turnos: [turnoMapeado, ...turnos] });
        }
      } else if (eventType === 'UPDATE') {
        set({ turnos: turnos.map(t => t.id === turnoMapeado.id ? turnoMapeado : t) });
      }
    }
  },

  sincronizarTienda: async (payload: any) => {
    const { new: nuevo } = payload;
    if (nuevo) {
      const actualizacion = { 
        forzarRecepcionCaja: nuevo.forzar_recepcion_caja, 
        requerirPinCancelacion: nuevo.requerir_pin_cancelacion,
        fondoBaseActual: Number(nuevo.fondo_base_actual ?? get().fondoBaseActual),
        notaGeneralDueno: nuevo.nota_general_dueno ?? get().notaGeneralDueno
      };
      set(actualizacion);
      if (esEscritorio) await guardarRegistro("config_caja", { id: 'config_caja_1', ...get(), ...actualizacion });
    }
  }
}));