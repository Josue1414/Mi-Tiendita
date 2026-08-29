// src/servicios/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Faltan las variables de entorno de Supabase. El sistema funcionará en modo 100% local.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", 
  supabaseAnonKey || "placeholder"
);

// NUEVO: Variable temporal para no saturar la base de datos con peticiones
let tiendaIdCache: string | null = null;

// NUEVO: Función para obtener el ID de la tienda del usuario activo

export const obtenerTiendaIdActual = async () => {
  if (tiendaIdCache) return tiendaIdCache;
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data } = await supabase
    .from('miembros_tienda')
    .select('tienda_id')
    .eq('usuario_id', session.user.id)
    .single();

  if (data) {
    tiendaIdCache = data.tienda_id;
    return tiendaIdCache;
  }
  
  return null;
};