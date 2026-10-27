// src/estado/estadoFacturacion.ts
import { create } from "zustand";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

export interface ConfiguracionFiscal {
  proveedor: string;
  facturapi_key: string;
  rfc_emisor: string;
  regimen_fiscal: string;
}

interface EstadoFacturacion {
  configuracion: ConfiguracionFiscal | null;
  cargando: boolean;
  cargarConfiguracion: () => Promise<void>;
  guardarConfiguracion: (config: ConfiguracionFiscal) => Promise<boolean>;
}

export const useEstadoFacturacion = create<EstadoFacturacion>((set) => ({
  configuracion: null,
  cargando: false,

  cargarConfiguracion: async () => {
    set({ cargando: true });
    try {
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) throw new Error("No hay tienda activa");

      const { data, error } = await supabase
        .from('tienda_configuracion_fiscal')
        .select('*')
        .eq('tienda_id', tiendaId)
        .maybeSingle(); // Usamos maybeSingle para que no marque error si es la primera vez (tabla vacía)

      if (error && error.code !== 'PGRST116') throw error;
      
      set({ configuracion: data || null, cargando: false });
    } catch (error) {
      console.error("Error al cargar configuración fiscal:", error);
      set({ cargando: false });
    }
  },

  guardarConfiguracion: async (config) => {
    set({ cargando: true });
    try {
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) throw new Error("No hay tienda activa");

      const { error } = await supabase
        .from('tienda_configuracion_fiscal')
        .upsert({
          tienda_id: tiendaId,
          proveedor: config.proveedor,
          facturapi_key: config.facturapi_key,
          rfc_emisor: config.rfc_emisor,
          regimen_fiscal: config.regimen_fiscal,
          actualizado_en: new Date().toISOString()
        });

      if (error) throw error;

      set({ configuracion: config, cargando: false });
      return true;
    } catch (error) {
      console.error("Error al guardar configuración fiscal:", error);
      set({ cargando: false });
      return false;
    }
  }
}));