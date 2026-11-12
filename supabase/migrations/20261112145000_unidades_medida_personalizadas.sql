ALTER TABLE public.productos
  ALTER COLUMN unidad DROP DEFAULT;

ALTER TABLE public.productos
  ALTER COLUMN unidad TYPE text USING unidad::text;

ALTER TABLE public.productos
  ALTER COLUMN unidad SET DEFAULT 'PIEZA';

CREATE TABLE IF NOT EXISTS public.unidades_medida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id uuid NOT NULL REFERENCES public.tiendas(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unidades_medida_tienda_nombre_idx
  ON public.unidades_medida (tienda_id, lower(btrim(nombre)));

CREATE OR REPLACE FUNCTION public.validar_unidad_medida_producto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.productos p
      WHERE p.tienda_id = OLD.tienda_id
        AND lower(btrim(p.unidad)) = lower(btrim(OLD.nombre))
    ) THEN
      RAISE EXCEPTION 'No se puede eliminar una unidad utilizada por productos.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.nombre IS DISTINCT FROM NEW.nombre THEN
    UPDATE public.productos
      SET unidad = NEW.nombre
      WHERE tienda_id = NEW.tienda_id
        AND lower(btrim(unidad)) = lower(btrim(OLD.nombre));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_unidad_medida_producto ON public.unidades_medida;
CREATE TRIGGER validar_unidad_medida_producto
BEFORE UPDATE OR DELETE ON public.unidades_medida
FOR EACH ROW EXECUTE FUNCTION public.validar_unidad_medida_producto();

ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unidades_medida_admin_all ON public.unidades_medida;
DROP POLICY IF EXISTS unidades_medida_miembro_select ON public.unidades_medida;
DROP POLICY IF EXISTS unidades_medida_miembro_all ON public.unidades_medida;
CREATE POLICY unidades_medida_miembro_all
  ON public.unidades_medida
  FOR ALL
  USING (tienda_id IN (SELECT public.mis_tiendas()))
  WITH CHECK (tienda_id IN (SELECT public.mis_tiendas()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'unidades_medida'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.unidades_medida';
  END IF;
END;
$$;
