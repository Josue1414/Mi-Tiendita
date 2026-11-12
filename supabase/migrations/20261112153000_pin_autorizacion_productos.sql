ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS requiere_pin_autorizacion boolean NOT NULL DEFAULT false;
