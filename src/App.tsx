// src/App.tsx
import React, { useState, useEffect } from "react";
import { useEstadoNavegacion, type SeccionApp } from "./estado/estadoNavegacion";
import { useEstadoTrabajadores } from "./estado/estadoTrabajadores";
import { useEstadoInventario } from "./estado/estadoInventario";
import { useEstadoVentas } from "./estado/estadoVentas";
import { useEstadoConfiguracion } from "./estado/estadoConfiguracion";
import { cn } from "./utilidades/utils";
import { Sun, Moon, Menu, ShoppingCart, Package, LayoutDashboard, History, ChevronLeft, AlertTriangle, MonitorPlay, Users, Settings, LogOut } from "lucide-react";

import VistaInventario from "./vistas/VistaInventario";
import VistaNuevoProducto from "./vistas/VistaNuevoProducto";
import VistaPOS from "./vistas/VistaPOS";
import VistaPantallaCliente from "./vistas/VistaPantallaCliente";
import VistaHistorialVentas from "./vistas/VistaHistorialVentas";
import VistaPanel from "./vistas/VistaPanel";
import VistaStockBajo from "./vistas/VistaStockBajo";
import VistaEquipo from "./vistas/VistaEquipo";
import VistaConfiguracion from "./vistas/VistaConfiguracion";
import VistaLogin from "./vistas/VistaLogin"; // <-- Importamos la nueva vista
import { tieneAlertaStock } from "./utilidades/stock";

const componentesSeccion: Record<SeccionApp, React.ComponentType> = {
  pos: VistaPOS,
  inventario: VistaInventario,
  panel: VistaPanel,
  reportes: () => <div>Reportes</div>,
  "stock-bajo": VistaStockBajo,
  "nuevo-producto": VistaNuevoProducto,
  historial: VistaHistorialVentas,
  equipo: VistaEquipo,
  configuracion: VistaConfiguracion,
};

export default function App() {
  const { seccionActual, setSeccionActual } = useEstadoNavegacion();
  
  // Extraemos trabajadorActivo, el estado de carga y cerrarSesion
  const { trabajadorActivo, cargando: cargandoTrabajadores, cargarTrabajadores, cerrarSesion } = useEstadoTrabajadores();
  
  const { productos, cargarProductos, cargando: cargandoInventario } = useEstadoInventario();
  const { cargarVentas, cargando: cargandoVentas } = useEstadoVentas();
  const { cargarConfiguracion, cargando: cargandoConfiguracion } = useEstadoConfiguracion();
  
  const [modoOscuro, setModoOscuro] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(true);

  if (window.location.search.includes('cliente=true')) {
    return <VistaPantallaCliente />;
  }

  useEffect(() => {
    cargarProductos();
    cargarVentas();
    cargarTrabajadores();
    cargarConfiguracion();
  }, [cargarProductos, cargarVentas, cargarTrabajadores, cargarConfiguracion]);

  useEffect(() => {
    if (modoOscuro) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [modoOscuro]);
  
  // Pantalla de carga mientras lee la base de datos local
  const estaCargandoGlobal = cargandoTrabajadores || cargandoInventario || cargandoVentas || cargandoConfiguracion;
  
  if (estaCargandoGlobal) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Iniciando sistema...</p>
      </div>
    );
  }

  // Si los datos ya cargaron pero no hay nadie logueado, mostramos el Login
  if (!trabajadorActivo) {
    return <VistaLogin />;
  }

  const ComponenteActivo = componentesSeccion[seccionActual];

  const abrirPantallaCliente = () => {
    window.open("/?cliente=true", "PantallaCliente", "width=800,height=900,menubar=no,toolbar=no");
  };

  const menusOperativos = [
    { id: "pos", icono: ShoppingCart, texto: "Punto de Venta" },
    { id: "inventario", icono: Package, texto: "Inventario" },
    { id: "historial", icono: History, texto: "Historial de Ventas" },
    { id: "stock-bajo", icono: AlertTriangle, texto: "Stock Bajo" },
  ] as const;
  const alertasStock = productos.filter(tieneAlertaStock).length;

  const menusAdmin = [
    { id: "panel", icono: LayoutDashboard, texto: "Panel Principal" },
    { id: "equipo", icono: Users, texto: "Equipo" },
    { id: "configuracion", icono: Settings, texto: "Configuración" },
  ] as const;

  const esDueño = trabajadorActivo?.rol === "DUEÑO";

  const manejarCerrarSesion = () => {
    cerrarSesion();
    setSeccionActual("pos"); // Reseteamos la vista para el próximo ingreso
  };

  return (
    <div className="flex h-screen bg-emerald-50/30 dark:bg-slate-950 transition-colors overflow-hidden text-sm">
      
      <aside className={cn(
        "efecto-cristal h-full transition-all duration-300 flex flex-col border-r border-slate-200/50 dark:border-white/10 shrink-0 z-20",
        menuAbierto ? "w-64" : "w-16"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-slate-200/50 dark:border-white/10 h-16 shrink-0">
          {menuAbierto && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400 truncate">Mi Tienda</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{trabajadorActivo?.nombre}</span>
            </div>
          )}
          <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-1.5 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors mx-auto">
            {menuAbierto ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3 scrollbar-hide">
          <div className="mb-2">
            {menuAbierto && <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operaciones</p>}
            {menusOperativos.map((menu) => {
              const Icono = menu.icono;
              const activo = seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto");
              return (
                <button key={menu.id} onClick={() => setSeccionActual(menu.id as SeccionApp)} title={!menuAbierto ? menu.texto : undefined}
                  className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl transition-all font-medium whitespace-nowrap overflow-visible mb-1",
                    activo ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200",
                    !menuAbierto && "justify-center px-0"
                  )}>
                  <Icono size={18} className="shrink-0" />
                  {menuAbierto && <span className="flex-1 text-left">{menu.texto}</span>}
                  {menu.id === "stock-bajo" && alertasStock > 0 && (
                    <span className={cn("flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm", !menuAbierto && "absolute right-0 top-0 -translate-y-1/2 translate-x-1/2")} aria-label={`${alertasStock} alertas de stock`} title={`${alertasStock} alertas de stock`}>
                      {alertasStock > 99 ? "99+" : alertasStock}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {esDueño && (
            <div className="mt-4 mb-2">
              {menuAbierto && <p className="px-2 text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider mb-2">Administración</p>}
              {menusAdmin.map((menu) => {
                const Icono = menu.icono;
                const activo = seccionActual === menu.id;
                return (
                  <button key={menu.id} onClick={() => setSeccionActual(menu.id as SeccionApp)} title={!menuAbierto ? menu.texto : undefined}
                    className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl transition-all font-medium whitespace-nowrap overflow-hidden mb-1",
                      activo ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200",
                      !menuAbierto && "justify-center px-0"
                    )}>
                    <Icono size={18} className="shrink-0" />
                    {menuAbierto && <span>{menu.texto}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-slate-200/50 dark:border-white/10 flex flex-col gap-2 shrink-0">
          <button onClick={abrirPantallaCliente} title={!menuAbierto ? "Pantalla Cliente" : undefined}
            className={cn("flex items-center gap-3 p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors w-full font-medium shadow-md",
              !menuAbierto && "justify-center px-0"
            )}>
            <MonitorPlay size={18} className="shrink-0" />
            {menuAbierto && <span>Pantalla Cliente</span>}
          </button>
          
          <button onClick={() => setModoOscuro(!modoOscuro)} title={!menuAbierto ? "Tema" : undefined}
            className={cn("flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors w-full",
              !menuAbierto && "justify-center px-0"
            )}>
            {modoOscuro ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {menuAbierto && <span>{modoOscuro ? "Modo Claro" : "Modo Oscuro"}</span>}
          </button>

          {/* Botón de Cerrar Sesión */}
          <button onClick={manejarCerrarSesion} title={!menuAbierto ? "Cerrar Sesión" : undefined}
            className={cn("flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors w-full",
              !menuAbierto && "justify-center px-0"
            )}>
            <LogOut size={18} className="shrink-0" />
            {menuAbierto && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-hidden flex flex-col p-4 sm:p-6 bg-transparent">
        <div className="efecto-cristal w-full h-full rounded-3xl overflow-hidden relative shadow-sm border border-slate-200/50 dark:border-white/10 flex flex-col">
          <ComponenteActivo />
        </div>
      </main>
      
    </div>
  );
}