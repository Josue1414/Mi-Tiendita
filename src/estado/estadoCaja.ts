// Coordenada: src/estado/estadoCaja.ts
import { create } from "zustand";
import { guardarRegistro, obtenerRegistros, eliminarRegistro, registrarPendienteSync } from "../servicios/db";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { debeSincronizarConNube, enviarAccionLAN } from "../servicios/sincronizacionLAN";

export interface TurnoCaja {
  id: string;
  trabajadorId: string;
  nombreTrabajador: string;
  fechaInicio: string;
  fechaFin: string | null;
  fondoInicial: number;
  fondoDejado: number | null;
  ventasCalculadas: number | null;
  ventasEfectivo: number | null;     // NUEVO: Efectivo del turno
  ventasElectronico: number | null;  // NUEVO: Tarjeta/Transferencia del turno
  notaTrabajador: string;
  notaDueno: string;
  estatus: "ABIERTO" | "CERRADO";
}

interface EstadoCaja {
  fondoBaseActual: number;
  notaGeneralDueno: string;
  turnos: TurnoCaja[];
  controlTurnosHabilitado: boolean;
  forzarRecepcionCaja: boolean; 
  requerirPinCancelacion: boolean;
  cargando: boolean;
  
  cargarCaja: () => Promise<void>;
  actualizarConfiguracion: (nuevoFondo: number, nuevaNota: string, forzarCaja?: boolean, reqPin?: boolean, propagado?: boolean) => Promise<void>;
  abrirTurno: (trabajadorId: string, nombreTrabajador: string, fondo: number, propagado?: boolean, turnoRemoto?: TurnoCaja) => Promise<void>;
  cerrarTurno: (turnoId: string, fondoDejado: number, ventasCalculadas: number, notaTrabajador: string, ventasEfectivo: number, ventasElectronico: number, propagado?: boolean, turnoRemoto?: TurnoCaja) => Promise<void>; // ACTUALIZADO
  obtenerTurnoActivo: (trabajadorId: string) => TurnoCaja | undefined;
  setControlTurnosHabilitado: (valor: boolean, propagado?: boolean) => Promise<void>;
  setForzarRecepcionCaja: (valor: boolean, propagado?: boolean) => Promise<void>; 
  setRequerirPinCancelacion: (valor: boolean, propagado?: boolean) => Promise<void>;
  sincronizarTurno: (payload: any) => Promise<void>;
  sincronizarTienda: (payload: any) => void;
  aplicarAccionLAN: (tipo: string, payload: any) => Promise<void>;
  hidratarEstadoLAN: (snapshot: any) => Promise<void>;
}

const guardarConfigCajaLocal = async (estado: any) => {
  const datosPuros = {
    fondoBaseActual: estado.fondoBaseActual,
    notaGeneralDueno: estado.notaGeneralDueno,
    controlTurnosHabilitado: estado.controlTurnosHabilitado,
    forzarRecepcionCaja: estado.forzarRecepcionCaja,
    requerirPinCancelacion: estado.requerirPinCancelacion
  };
  await guardarRegistro("config_caja", { id: 'config_caja_1', ...datosPuros });
};

const persistirConfiguracionCaja = async (
  estado: any,
  propagado: boolean,
  camposNube?: Record<string, unknown>
) => {
  const configuracion = {
    fondoBaseActual: estado.fondoBaseActual,
    notaGeneralDueno: estado.notaGeneralDueno,
    controlTurnosHabilitado: estado.controlTurnosHabilitado,
    forzarRecepcionCaja: estado.forzarRecepcionCaja,
    requerirPinCancelacion: estado.requerirPinCancelacion
  };
  await guardarConfigCajaLocal(estado);

  if (!propagado) {
    enviarAccionLAN({ tipo: "LAN_CAJA_CONFIGURACION", payload: configuracion });
  }
  if (!debeSincronizarConNube()) return;

  const payload = camposNube ?? {
    fondo_base_actual: configuracion.fondoBaseActual,
    nota_general_dueno: configuracion.notaGeneralDueno,
    forzar_recepcion_caja: configuracion.forzarRecepcionCaja,
    requerir_pin_cancelacion: configuracion.requerirPinCancelacion
  };
  if (navigator.onLine) {
    const tiendaId = await obtenerTiendaIdActual() || localStorage.getItem('tienda_id_cache');
    if (!tiendaId) return;
    const { error } = await supabase
      .from('tiendas')
      .update(payload)
      .eq('id', tiendaId)
      .select('id')
      .single();
    if (error) {
      console.warn("Error al guardar configuración de caja, registrando pendiente:", error);
      await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload });
    }
  } else {
    await registrarPendienteSync({ tabla: 'tiendas', operacion: 'ACTUALIZAR', payload });
  }
};

export const useEstadoCaja = create<EstadoCaja>((set, get) => ({
  fondoBaseActual: 1000,
  notaGeneralDueno: "Recuerden revisar los billetes grandes.",
  turnos: [],
  controlTurnosHabilitado: false,
  forzarRecepcionCaja: false, 
  requerirPinCancelacion: false,
  cargando: true,

  // Coordenada: src/estado/estadoCaja.ts (Reemplazar función cargarCaja)

  cargarCaja: async () => {
    set({ cargando: true });
    try {
      if (debeSincronizarConNube()) await supabase.auth.getSession();
      
      const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;
      let tiendaId = debeSincronizarConNube() ? await obtenerTiendaIdActual() : null;
      
      if (tiendaId) {
        localStorage.setItem('tienda_id_cache', tiendaId);
      } else {
        tiendaId = localStorage.getItem('tienda_id_cache');
      }

      let configNubeExitosa = false;

      if (debeSincronizarConNube() && navigator.onLine && tiendaId) {
        const { data: turnosNube, error: errorTurnos } = await supabase
          .from('turnos_caja')
          .select('*')
          .eq('tienda_id', tiendaId)
          .order('fecha_inicio', { ascending: false });

        const { data: tiendaData, error: errorTienda } = await supabase
          .from('tiendas')
          .select('forzar_recepcion_caja, requerir_pin_cancelacion, fondo_base_actual, nota_general_dueno')
          .eq('id', tiendaId)
          .single();

        if (!errorTienda && tiendaData) {
          const nuevasConfigs = {
            controlTurnosHabilitado: false,
            forzarRecepcionCaja: Boolean(tiendaData.forzar_recepcion_caja),
            requerirPinCancelacion: Boolean(tiendaData.requerir_pin_cancelacion),
            fondoBaseActual: Number(tiendaData.fondo_base_actual ?? get().fondoBaseActual),
            notaGeneralDueno: tiendaData.nota_general_dueno ?? get().notaGeneralDueno
          };
          const configLocalCaja = await obtenerRegistros("config_caja");
          const controlGuardadoLocal = (configLocalCaja[0] as { controlTurnosHabilitado?: boolean } | undefined)?.controlTurnosHabilitado;
          nuevasConfigs.controlTurnosHabilitado = controlGuardadoLocal ?? Boolean(tiendaData.forzar_recepcion_caja);

          let turnosMapeados: TurnoCaja[] = [];
          if (!errorTurnos && turnosNube) {
            turnosMapeados = turnosNube.map((t: any) => ({
              id: t.id,
              trabajadorId: t.trabajador_id,
              nombreTrabajador: t.nombre_trabajador,
              fechaInicio: t.fecha_inicio,
              fechaFin: t.fecha_fin,
              fondoInicial: Number(t.fondo_inicial),
              fondoDejado: t.fondo_dejado !== null ? Number(t.fondo_dejado) : null,
              ventasCalculadas: t.ventas_calculadas !== null ? Number(t.ventas_calculadas) : null,
              ventasEfectivo: t.ventas_efectivo !== null ? Number(t.ventas_efectivo) : null,
              ventasElectronico: t.ventas_electronico !== null ? Number(t.ventas_electronico) : null,
              notaTrabajador: t.nota_trabajador || "",
              notaDueno: t.nota_dueno || "",
              estatus: t.estatus
            }));

            if (esEscritorio) {
              // Si es la PC Cerebro, SOLO GUARDAMOS lo nuevo, NUNCA borramos el historial
              for (const t of turnosMapeados) {
                await guardarRegistro("turnos_caja", t);
              }
              const turnosLocal = await obtenerRegistros("turnos_caja");
              turnosMapeados = (turnosLocal as TurnoCaja[]).sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());
            } else {
              // En celular, actualizamos el local pero respetando lo de la nube
              const turnosLocal = await obtenerRegistros("turnos_caja");
              const idsNube = new Set(turnosMapeados.map(t => t.id));
              if (turnosLocal) {
                for (const tLocal of turnosLocal as any[]) {
                  if (!idsNube.has(tLocal.id)) await eliminarRegistro("turnos_caja", tLocal.id);
                }
              }
              for (const t of turnosMapeados) {
                await guardarRegistro("turnos_caja", t);
              }
            }
          }

          set({ turnos: turnosMapeados, ...nuevasConfigs, cargando: false });
          await guardarConfigCajaLocal(get());
          configNubeExitosa = true;
        }
      }

      if (!configNubeExitosa) {
        let turnosEstado: TurnoCaja[] = [];
        const dataTurnos = await obtenerRegistros("turnos_caja");
        if (dataTurnos) {
           turnosEstado = (dataTurnos as TurnoCaja[]).sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());
        }

        const configLocal = await obtenerRegistros("config_caja");
        if (configLocal && configLocal.length > 0) {
          const conf = configLocal[0] as any;
          set({
            fondoBaseActual: conf.fondoBaseActual ?? 1000,
            notaGeneralDueno: conf.notaGeneralDueno ?? "",
            controlTurnosHabilitado: conf.controlTurnosHabilitado ?? Boolean(conf.forzarRecepcionCaja),
            forzarRecepcionCaja: conf.forzarRecepcionCaja ?? false,
            requerirPinCancelacion: conf.requerirPinCancelacion ?? false,
            turnos: turnosEstado,
            cargando: false
          });
        } else {
          set({ turnos: turnosEstado, cargando: false });
        }
      }
    } catch (error) {
      console.error("Error al cargar caja:", error);
      set({ cargando: false });
    }
  },

  actualizarConfiguracion: async (nuevoFondo, nuevaNota, forzarCaja, reqPin, propagado = false) => {
    const fCaja = forzarCaja ?? get().forzarRecepcionCaja;
    const rPin = reqPin ?? get().requerirPinCancelacion;
    
    set({ 
      fondoBaseActual: nuevoFondo, 
      notaGeneralDueno: nuevaNota,
      forzarRecepcionCaja: fCaja,
      requerirPinCancelacion: rPin
    });

    await persistirConfiguracionCaja(get(), propagado, {
      fondo_base_actual: nuevoFondo,
      nota_general_dueno: nuevaNota,
      forzar_recepcion_caja: fCaja,
      requerir_pin_cancelacion: rPin
    });
  },

  setForzarRecepcionCaja: async (valor, propagado = false) => {
    set({ forzarRecepcionCaja: valor });
    await persistirConfiguracionCaja(get(), propagado, { forzar_recepcion_caja: valor });
  },

  setControlTurnosHabilitado: async (valor, propagado = false) => {
    const forzarRecepcionCaja = valor ? true : false;
    set({ controlTurnosHabilitado: valor, forzarRecepcionCaja });
    await persistirConfiguracionCaja(get(), propagado, { forzar_recepcion_caja: forzarRecepcionCaja });
  },
  
  setRequerirPinCancelacion: async (valor, propagado = false) => {
    set({ requerirPinCancelacion: valor });
    await persistirConfiguracionCaja(get(), propagado, { requerir_pin_cancelacion: valor });
  },

  abrirTurno: async (trabajadorId, nombreTrabajador, fondo, propagado = false, turnoRemoto) => {
    const nuevoTurno: TurnoCaja = turnoRemoto ?? {
      id: crypto.randomUUID(),
      trabajadorId,
      nombreTrabajador,
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      fondoInicial: fondo,
      fondoDejado: null,
      ventasCalculadas: null,
      ventasEfectivo: null,
      ventasElectronico: null,
      notaTrabajador: "",
      notaDueno: "",
      estatus: "ABIERTO",
    };

    await guardarRegistro("turnos_caja", nuevoTurno);
    set((state) => ({
      turnos: state.turnos.some(turno => turno.id === nuevoTurno.id)
        ? state.turnos.map(turno => turno.id === nuevoTurno.id ? nuevoTurno : turno)
        : [nuevoTurno, ...state.turnos]
    }));

    if (!propagado) {
      enviarAccionLAN({ tipo: "LAN_CAJA_ABRIR_TURNO", payload: nuevoTurno });
    }
    if (!debeSincronizarConNube()) return;

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual() || localStorage.getItem('tienda_id_cache');
      if (tiendaId) {
        const { error } = await supabase.from('turnos_caja').insert({
          id: nuevoTurno.id,
          tienda_id: tiendaId,
          trabajador_id: trabajadorId,
          nombre_trabajador: nombreTrabajador,
          fecha_inicio: nuevoTurno.fechaInicio,
          fondo_inicial: fondo,
          estatus: 'ABIERTO'
        });
        if (error) await registrarPendienteSync({ tabla: 'turnos_caja', operacion: 'AGREGAR', payload: nuevoTurno });
      }
    } else {
      await registrarPendienteSync({ tabla: 'turnos_caja', operacion: 'AGREGAR', payload: nuevoTurno });
    }
  },

  // ACTUALIZADO: Acepta los nuevos parámetros y los envía a Supabase
  cerrarTurno: async (turnoId, fondoDejado, ventasCalculadas, notaTrabajador, ventasEfectivo, ventasElectronico, propagado = false, turnoRemoto) => {
    const turnoOriginal = get().turnos.find(turno => turno.id === turnoId);
    const fechaFin = turnoRemoto?.fechaFin ?? new Date().toISOString();
    const turnoActualizado = turnoRemoto ?? (turnoOriginal ? {
      ...turnoOriginal, fechaFin, fondoDejado, ventasCalculadas, ventasEfectivo, ventasElectronico, notaTrabajador, estatus: "CERRADO" as const
    } : undefined);
    if (!turnoActualizado) return;
    set((state) => ({
      turnos: state.turnos.some(t => t.id === turnoId)
        ? state.turnos.map((t) => t.id === turnoId ? turnoActualizado : t)
        : [turnoActualizado, ...state.turnos]
    }));

    await guardarRegistro("turnos_caja", turnoActualizado);
    if (!propagado) {
      enviarAccionLAN({ tipo: "LAN_CAJA_CERRAR_TURNO", payload: turnoActualizado });
    }
    if (!debeSincronizarConNube()) return;

    if (navigator.onLine) {
      const tiendaId = await obtenerTiendaIdActual() || localStorage.getItem('tienda_id_cache');
      if (tiendaId) {
        const { error } = await supabase
          .from('turnos_caja')
          .update({
            fecha_fin: fechaFin,
            fondo_dejado: fondoDejado,
            ventas_calculadas: ventasCalculadas,
            ventas_efectivo: ventasEfectivo,         // NUEVO
            ventas_electronico: ventasElectronico,   // NUEVO
            nota_trabajador: notaTrabajador,
            estatus: 'CERRADO'
          })
          .eq('id', turnoId)
          .eq('tienda_id', tiendaId)
          .select('id')
          .single();
        
        if (error) await registrarPendienteSync({ tabla: 'turnos_caja', operacion: 'ACTUALIZAR', payload: turnoActualizado });
      }
    } else {
      await registrarPendienteSync({ tabla: 'turnos_caja', operacion: 'ACTUALIZAR', payload: turnoActualizado });
    }
  },

  obtenerTurnoActivo: (trabajadorId) => {
    return get().turnos.find((t) => t.trabajadorId === trabajadorId && t.estatus === "ABIERTO");
  },

  sincronizarTurno: async (payload: any) => {
    if (!debeSincronizarConNube()) return;

    const { eventType, new: nuevo, old: viejo } = payload;
    const { turnos } = get();

    if (eventType === 'DELETE') {
      await eliminarRegistro("turnos_caja", viejo.id);
      set({ turnos: turnos.filter(t => t.id !== viejo.id) });
    } else {
      const turnoMapeado: TurnoCaja = {
        id: nuevo.id,
        trabajadorId: nuevo.trabajador_id,
        nombreTrabajador: nuevo.nombre_trabajador,
        fechaInicio: nuevo.fecha_inicio,
        fechaFin: nuevo.fecha_fin,
        fondoInicial: Number(nuevo.fondo_inicial),
        fondoDejado: nuevo.fondo_dejado !== null ? Number(nuevo.fondo_dejado) : null,
        ventasCalculadas: nuevo.ventas_calculadas !== null ? Number(nuevo.ventas_calculadas) : null,
        ventasEfectivo: nuevo.ventas_efectivo !== null ? Number(nuevo.ventas_efectivo) : null,           // NUEVO
        ventasElectronico: nuevo.ventas_electronico !== null ? Number(nuevo.ventas_electronico) : null,  // NUEVO
        notaTrabajador: nuevo.nota_trabajador || "",
        notaDueno: nuevo.nota_dueno || "",
        estatus: nuevo.estatus
      };

      await guardarRegistro("turnos_caja", turnoMapeado);

      if (eventType === 'INSERT') {
        if (!turnos.some(t => t.id === turnoMapeado.id)) {
          set({ turnos: [turnoMapeado, ...turnos] });
        }
      } else if (eventType === 'UPDATE') {
        set({ turnos: turnos.map(t => t.id === turnoMapeado.id ? turnoMapeado : t) });
      }
      enviarAccionLAN({
        tipo: turnoMapeado.estatus === "ABIERTO" ? "LAN_CAJA_ABRIR_TURNO" : "LAN_CAJA_CERRAR_TURNO",
        payload: turnoMapeado
      });
    }
  },

  sincronizarTienda: async (payload: any) => {
    if (!debeSincronizarConNube()) return;

    const { new: nuevo } = payload;
    if (nuevo) {
      set({ 
        forzarRecepcionCaja: Boolean(nuevo.forzar_recepcion_caja), 
        requerirPinCancelacion: Boolean(nuevo.requerir_pin_cancelacion),
        fondoBaseActual: Number(nuevo.fondo_base_actual ?? get().fondoBaseActual),
        notaGeneralDueno: nuevo.nota_general_dueno ?? get().notaGeneralDueno
      });
      await guardarConfigCajaLocal(get());
      const estadoActual = get();
      enviarAccionLAN({
        tipo: "LAN_CAJA_CONFIGURACION",
        payload: {
          fondoBaseActual: estadoActual.fondoBaseActual,
          notaGeneralDueno: estadoActual.notaGeneralDueno,
          controlTurnosHabilitado: estadoActual.controlTurnosHabilitado,
          forzarRecepcionCaja: estadoActual.forzarRecepcionCaja,
          requerirPinCancelacion: estadoActual.requerirPinCancelacion
        }
      });
    }
  },

  aplicarAccionLAN: async (tipo, payload) => {
    if (tipo === "LAN_CAJA_CONFIGURACION") {
      if (!payload || typeof payload !== "object") return;
      const actual = get();
      set({
        fondoBaseActual: Number.isFinite(payload.fondoBaseActual) ? payload.fondoBaseActual : actual.fondoBaseActual,
        notaGeneralDueno: typeof payload.notaGeneralDueno === "string" ? payload.notaGeneralDueno : actual.notaGeneralDueno,
        controlTurnosHabilitado: typeof payload.controlTurnosHabilitado === "boolean" ? payload.controlTurnosHabilitado : actual.controlTurnosHabilitado,
        forzarRecepcionCaja: typeof payload.forzarRecepcionCaja === "boolean" ? payload.forzarRecepcionCaja : actual.forzarRecepcionCaja,
        requerirPinCancelacion: typeof payload.requerirPinCancelacion === "boolean" ? payload.requerirPinCancelacion : actual.requerirPinCancelacion
      });
      await persistirConfiguracionCaja(get(), true);
    } else if (tipo === "LAN_CAJA_ABRIR_TURNO") {
      const turno = payload as TurnoCaja;
      if (turno && typeof turno.id === "string") {
        await get().abrirTurno(turno.trabajadorId, turno.nombreTrabajador, turno.fondoInicial, true, turno);
      }
    } else if (tipo === "LAN_CAJA_CERRAR_TURNO") {
      const turno = payload as TurnoCaja;
      if (turno && typeof turno.id === "string") {
        await get().cerrarTurno(
          turno.id,
          turno.fondoDejado ?? 0,
          turno.ventasCalculadas ?? 0,
          turno.notaTrabajador,
          turno.ventasEfectivo ?? 0,
          turno.ventasElectronico ?? 0,
          true,
          turno
        );
      }
    }
  },

  hidratarEstadoLAN: async (snapshot) => {
    const caja = snapshot?.caja;
    if (!caja || typeof caja !== "object") return;

    const turnosLAN = Array.isArray(caja.turnos)
      ? (caja.turnos as TurnoCaja[]).filter(turno => turno && typeof turno.id === "string")
      : [];
    const registrosLocales = await obtenerRegistros("turnos_caja");
    const turnosLocales = Array.isArray(registrosLocales) ? registrosLocales as TurnoCaja[] : [];
    const idsLAN = new Set(turnosLAN.map(turno => turno.id));
    for (const turno of turnosLocales) {
      if (!idsLAN.has(turno.id)) await eliminarRegistro("turnos_caja", turno.id);
    }
    for (const turno of turnosLAN) {
      await guardarRegistro("turnos_caja", turno);
    }

    const actual = get();
    const siguiente = {
      fondoBaseActual: Number.isFinite(caja.fondoBaseActual) ? caja.fondoBaseActual : actual.fondoBaseActual,
      notaGeneralDueno: typeof caja.notaGeneralDueno === "string" ? caja.notaGeneralDueno : actual.notaGeneralDueno,
      controlTurnosHabilitado: typeof caja.controlTurnosHabilitado === "boolean" ? caja.controlTurnosHabilitado : actual.controlTurnosHabilitado,
      forzarRecepcionCaja: typeof caja.forzarRecepcionCaja === "boolean" ? caja.forzarRecepcionCaja : actual.forzarRecepcionCaja,
      requerirPinCancelacion: typeof caja.requerirPinCancelacion === "boolean" ? caja.requerirPinCancelacion : actual.requerirPinCancelacion,
      turnos: [...turnosLAN].sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()),
      cargando: false
    };
    set(siguiente);
    await guardarConfigCajaLocal(siguiente);
  }
}));