create table if not exists public.tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  mensaje_ticket text not null default '¡Gracias por su preferencia! Vuelva pronto.',
  direccion_tienda text not null default '',
  tecla_cobro text not null default 'F2',
  tecla_efectivo text not null default 'F3',
  tecla_tarjeta text not null default 'F4',
  tecla_transferencia text not null default 'F5',
  fondo_base_actual numeric(12,2) not null default 1000,
  nota_general_dueno text not null default '',
  mensaje_pago text not null default 'Pago realizado. Gracias por su compra, vuelva pronto.',
  banco_transferencia text,
  titular_transferencia text,
  cuenta_transferencia text,
  fecha_vencimiento timestamptz not null default (now() + interval '30 days'),
  max_dispositivos integer not null default 1,
  forzar_recepcion_caja boolean not null default false,
  requerir_pin_cancelacion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS forzar_recepcion_caja boolean not null default false;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS requerir_pin_cancelacion boolean not null default false;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS mensaje_ticket text not null default '¡Gracias por su preferencia! Vuelva pronto.';
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS direccion_tienda text not null default '';
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tecla_cobro text not null default 'F2';
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tecla_efectivo text not null default 'F3';
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tecla_tarjeta text not null default 'F4';
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS tecla_transferencia text not null default 'F5';
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS fondo_base_actual numeric(12,2) not null default 1000;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS nota_general_dueno text not null default '';

create table if not exists public.dispositivos_vinculados (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  hardware_id text not null,
  nombre_dispositivo text not null default 'Caja Principal',
  es_cerebro boolean not null default false,
  ultimo_acceso timestamptz not null default now(),
  unique(tienda_id, hardware_id)
);

alter table public.dispositivos_vinculados
  add column if not exists es_cerebro boolean not null default false;

create table if not exists public.miembros_tienda (
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  usuario_id uuid not null,
  rol public.rol_tienda not null default 'TRABAJADOR',
  nombre text not null,
  pin_hash text,
  activo boolean not null default true,
  horario jsonb, 
  permisos jsonb, 
  dias_descanso smallint[] not null default '{}',
  correo_recuperacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tienda_id, usuario_id)
);

ALTER TABLE public.miembros_tienda DROP CONSTRAINT IF EXISTS miembros_tienda_usuario_id_fkey;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  nombre text not null,
  color varchar(7) not null default '#14b8a6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre)
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  categoria_id uuid references public.categorias(id) on delete set null,
  sku text,
  barcode text not null,
  nombre text not null,
  descripcion text,
  ubicacion text,
  paquete text,
  unidad public.unidad_producto not null default 'PIEZA',
  stock_actual numeric(12,3) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(12,3) not null default 0 check (stock_minimo >= 0),
  controla_stock boolean not null default true,
  precio numeric(12,2) not null check (precio >= 0),
  costo numeric(12,2) not null default 0 check (costo >= 0),
  descuento_porcentaje numeric(5,2) not null default 0 check (descuento_porcentaje between 0 and 100),
  activo boolean not null default true,
  requiere_autorizacion boolean not null default false,
  mensaje_autorizacion text,
  permite_foto_autorizacion boolean not null default false,
  nombre_archivo_local text,
  updated_at timestamptz not null default now(),
  unique (tienda_id, barcode)
);

create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  vendedor_id uuid not null,
  trabajador_nombre text not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  total numeric(12,2) not null check (total >= 0),
  metodo_pago public.metodo_pago not null,
  cancelada boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (tienda_id, vendedor_id) references public.miembros_tienda(tienda_id, usuario_id)
);

ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS cancelada boolean not null default false;

create table if not exists public.venta_detalles (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre_producto text not null,
  cantidad numeric(12,3) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  autorizacion_confirmada boolean not null default false,
  evidencia_nombre_archivo_local text,
  created_at timestamptz not null default now()
);

create table if not exists public.turnos_caja (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  trabajador_id uuid not null,
  nombre_trabajador text not null,
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  fondo_inicial numeric(12,2) not null default 0,
  fondo_dejado numeric(12,2),
  ventas_calculadas numeric(12,2),
  nota_trabajador text,
  nota_dueno text,
  estatus public.estatus_turno not null default 'ABIERTO',
  foreign key (tienda_id, trabajador_id) references public.miembros_tienda(tienda_id, usuario_id) on delete cascade
);

create table if not exists public.asistencias (
  id text primary key,
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  trabajador_id uuid not null,
  fecha date not null,
  hora_entrada time not null,
  hora_salida time,
  desconexiones integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (tienda_id, trabajador_id) references public.miembros_tienda(tienda_id, usuario_id) on delete cascade
);

-- 3. ÍNDICES DE OPTIMIZACIÓN
create index if not exists productos_tienda_updated_idx on public.productos(tienda_id, updated_at);
create index if not exists ventas_tienda_fecha_idx on public.ventas(tienda_id, created_at desc);
create index if not exists turnos_tienda_fecha_idx on public.turnos_caja(tienda_id, fecha_inicio desc);
create index if not exists asistencias_tienda_fecha_idx on public.asistencias(tienda_id, fecha desc);
create unique index if not exists un_dispositivo_cerebro_por_tienda
  on public.dispositivos_vinculados(tienda_id) where es_cerebro;

-- 4. SEGURIDAD Y POLÍTICAS (RLS) MULTI-TENANT
create or replace function public.mis_tiendas()
returns setof uuid language sql stable security definer set search_path = public
as $$ 
  select tienda_id from public.miembros_tienda where usuario_id = auth.uid() and activo = true; 
$$;

create or replace function public.es_dueno(p_tienda_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ 
  select exists (select 1 from public.miembros_tienda where tienda_id = p_tienda_id and usuario_id = auth.uid() and rol = 'DUENO' and activo = true); 
$$;

create or replace function public.es_dueno_o_supervisor(p_tienda_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ 
  select exists (select 1 from public.miembros_tienda where tienda_id = p_tienda_id and usuario_id = auth.uid() and rol in ('DUENO', 'SUPERVISOR') and activo = true); 
$$;

alter table public.tiendas enable row level security;
alter table public.dispositivos_vinculados enable row level security;
alter table public.miembros_tienda enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;
alter table public.turnos_caja enable row level security;
alter table public.asistencias enable row level security;

-- Políticas para Tiendas
drop policy if exists tiendas_miembro_select on public.tiendas;
create policy tiendas_miembro_select on public.tiendas for select using (id in (select public.mis_tiendas()));

drop policy if exists tiendas_dueno_update on public.tiendas;
create policy tiendas_dueno_update on public.tiendas for update using (public.es_dueno(id)) with check (public.es_dueno(id));

-- Políticas para Dispositivos
drop policy if exists disp_select on public.dispositivos_vinculados;
create policy disp_select on public.dispositivos_vinculados for select using (tienda_id in (select public.mis_tiendas()));

drop policy if exists disp_insert on public.dispositivos_vinculados;
create policy disp_insert on public.dispositivos_vinculados for insert with check (tienda_id in (select public.mis_tiendas()));

drop policy if exists disp_update on public.dispositivos_vinculados;
create policy disp_update on public.dispositivos_vinculados for update using (tienda_id in (select public.mis_tiendas()));

drop policy if exists disp_delete on public.dispositivos_vinculados;
create policy disp_delete on public.dispositivos_vinculados for delete using (public.es_dueno(tienda_id));

create or replace function public.configurar_cerebro(
  p_tienda_id uuid,
  p_hardware_id text,
  p_es_cerebro boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_dueno(p_tienda_id) then
    raise exception 'Solo el dueño puede configurar la PC cerebro';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tienda_id::text));

  if p_es_cerebro and exists (
    select 1 from public.dispositivos_vinculados
    where tienda_id = p_tienda_id and es_cerebro and hardware_id <> p_hardware_id
  ) then
    return false;
  end if;

  insert into public.dispositivos_vinculados (tienda_id, hardware_id, es_cerebro, ultimo_acceso)
    values (p_tienda_id, p_hardware_id, p_es_cerebro, now())
  on conflict (tienda_id, hardware_id) do update
    set es_cerebro = excluded.es_cerebro, ultimo_acceso = now();

  return p_es_cerebro;
end;
$$;

-- Políticas para Miembros
drop policy if exists miembros_select on public.miembros_tienda;
create policy miembros_select on public.miembros_tienda for select using (tienda_id in (select public.mis_tiendas()));

drop policy if exists miembros_dueno_insert on public.miembros_tienda;
create policy miembros_dueno_insert on public.miembros_tienda for insert with check (public.es_dueno(tienda_id));

drop policy if exists miembros_dueno_update on public.miembros_tienda;
create policy miembros_dueno_update on public.miembros_tienda for update using (public.es_dueno(tienda_id)) with check (public.es_dueno(tienda_id));

-- (NUEVO) Permitir al dueño eliminar trabajadores
drop policy if exists miembros_dueno_delete on public.miembros_tienda;
create policy miembros_dueno_delete on public.miembros_tienda for delete using (public.es_dueno(tienda_id));

-- Políticas para Categorías
drop policy if exists categorias_miembro_all on public.categorias;
create policy categorias_miembro_all on public.categorias for all using (tienda_id in (select public.mis_tiendas())) with check (tienda_id in (select public.mis_tiendas()));

-- Políticas para Productos
drop policy if exists productos_miembro_select on public.productos;
create policy productos_miembro_select on public.productos for select using (tienda_id in (select public.mis_tiendas()));

drop policy if exists productos_admin_write on public.productos;
create policy productos_admin_write on public.productos for insert with check (public.es_dueno_o_supervisor(tienda_id));

drop policy if exists productos_admin_update on public.productos;
create policy productos_admin_update on public.productos for update using (public.es_dueno_o_supervisor(tienda_id)) with check (public.es_dueno_o_supervisor(tienda_id));

drop policy if exists productos_admin_delete on public.productos;
create policy productos_admin_delete on public.productos for delete using (public.es_dueno_o_supervisor(tienda_id));

-- Políticas para Ventas y Detalles
drop policy if exists ventas_miembro_select on public.ventas;
create policy ventas_miembro_select on public.ventas for select using (tienda_id in (select public.mis_tiendas()));

drop policy if exists ventas_miembro_insert on public.ventas;
create policy ventas_miembro_insert on public.ventas for insert with check (tienda_id in (select public.mis_tiendas()) and vendedor_id = auth.uid());

drop policy if exists ventas_admin_update on public.ventas;
create policy ventas_admin_update on public.ventas for update using (public.es_dueno_o_supervisor(tienda_id));

drop policy if exists detalles_miembro_select on public.venta_detalles;
create policy detalles_miembro_select on public.venta_detalles for select using (exists (select 1 from public.ventas v where v.id = venta_id and v.tienda_id in (select public.mis_tiendas())));

drop policy if exists detalles_miembro_insert on public.venta_detalles;
create policy detalles_miembro_insert on public.venta_detalles for insert with check (exists (select 1 from public.ventas v where v.id = venta_id and v.tienda_id in (select public.mis_tiendas())));

-- Políticas para Turnos
drop policy if exists turnos_miembro_all on public.turnos_caja;
create policy turnos_miembro_all on public.turnos_caja for all using (tienda_id in (select public.mis_tiendas())) with check (tienda_id in (select public.mis_tiendas()));

-- Políticas para Asistencias
drop policy if exists asistencias_miembro_all on public.asistencias;
create policy asistencias_miembro_all on public.asistencias for all using (tienda_id in (select public.mis_tiendas())) with check (tienda_id in (select public.mis_tiendas()));

-- 5. FUNCIÓN DE LIMPIEZA AUTOMÁTICA
create or replace function public.limpiar_ventas_antiguas()
returns void language plpgsql security definer
as $$
begin
  delete from public.ventas where created_at < now() - interval '1 year';
end;
$$;

-- 6. (CORREGIDO) ACTIVAR SUPABASE REALTIME DE FORMA SEGURA
DO $$
DECLARE
    t text;
    tablas text[] := ARRAY['tiendas', 'dispositivos_vinculados', 'miembros_tienda', 'productos', 'categorias', 'asistencias', 'ventas', 'venta_detalles', 'turnos_caja'];
BEGIN
    FOREACH t IN ARRAY tablas LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        END IF;
    END LOOP;
END;
$$;