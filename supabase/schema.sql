-- Mi Tienda: esquema inicial Supabase
-- Las imagenes no se almacenan aqui. Solo se guarda nombre_archivo_local.
create extension if not exists pgcrypto;

create type public.rol_tienda as enum ('DUENO', 'TRABAJADOR');
create type public.unidad_producto as enum ('PIEZA', 'KG', 'LITRO', 'PAQUETE');
create type public.metodo_pago as enum ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

create table public.tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  mensaje_pago text not null default 'Pago realizado. Gracias por su compra, vuelva pronto.',
  banco_transferencia text,
  titular_transferencia text,
  cuenta_transferencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.miembros_tienda (
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol public.rol_tienda not null default 'TRABAJADOR',
  nombre text not null,
  pin_hash text,
  activo boolean not null default true,
  horario text,
  dias_descanso smallint[] not null default '{}',
  correo_recuperacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tienda_id, usuario_id)
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  nombre text not null,
  color varchar(7) not null default '#14b8a6',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tienda_id, nombre)
);

create table public.productos (
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

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references public.tiendas(id) on delete cascade,
  vendedor_id uuid not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  total numeric(12,2) not null check (total >= 0),
  metodo_pago public.metodo_pago not null,
  created_at timestamptz not null default now(),
  foreign key (tienda_id, vendedor_id) references public.miembros_tienda(tienda_id, usuario_id)
);

create table public.venta_detalles (
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

create index productos_tienda_updated_idx on public.productos(tienda_id, updated_at);
create index productos_tienda_stock_idx on public.productos(tienda_id, controla_stock, stock_actual, stock_minimo);
create index ventas_tienda_fecha_idx on public.ventas(tienda_id, created_at desc);
create index detalles_producto_idx on public.venta_detalles(producto_id);
create index detalles_autorizacion_idx on public.venta_detalles(autorizacion_confirmada) where autorizacion_confirmada;

create or replace function public.es_miembro(p_tienda_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.miembros_tienda where tienda_id = p_tienda_id and usuario_id = auth.uid() and activo); $$;

create or replace function public.es_dueno(p_tienda_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.miembros_tienda where tienda_id = p_tienda_id and usuario_id = auth.uid() and rol = 'DUENO' and activo); $$;

alter table public.tiendas enable row level security;
alter table public.miembros_tienda enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;

create policy tiendas_miembro_select on public.tiendas for select using (public.es_miembro(id));
create policy tiendas_dueno_update on public.tiendas for update using (public.es_dueno(id)) with check (public.es_dueno(id));

create policy miembros_select on public.miembros_tienda for select using (public.es_miembro(tienda_id));
create policy miembros_dueno_insert on public.miembros_tienda for insert with check (public.es_dueno(tienda_id));
create policy miembros_dueno_update on public.miembros_tienda for update using (public.es_dueno(tienda_id)) with check (public.es_dueno(tienda_id));

create policy categorias_miembro_all on public.categorias for all using (public.es_miembro(tienda_id)) with check (public.es_miembro(tienda_id));
create policy productos_miembro_select on public.productos for select using (public.es_miembro(tienda_id));
create policy productos_dueno_write on public.productos for insert with check (public.es_dueno(tienda_id));
create policy productos_dueno_update on public.productos for update using (public.es_dueno(tienda_id)) with check (public.es_dueno(tienda_id));
create policy productos_dueno_delete on public.productos for delete using (public.es_dueno(tienda_id));

create policy ventas_miembro_select on public.ventas for select using (public.es_miembro(tienda_id));
create policy ventas_miembro_insert on public.ventas for insert with check (public.es_miembro(tienda_id) and vendedor_id = auth.uid());
create policy detalles_miembro_select on public.venta_detalles for select using (exists (select 1 from public.ventas v where v.id = venta_id and public.es_miembro(v.tienda_id)));
create policy detalles_miembro_insert on public.venta_detalles for insert with check (exists (select 1 from public.ventas v where v.id = venta_id and public.es_miembro(v.tienda_id)));

-- Sincronizacion diferencial sugerida:
-- select * from productos where tienda_id = :tienda and updated_at > :ultima_sincronizacion;
-- Las imagenes permanecen en IndexedDB/File System API del dispositivo.
