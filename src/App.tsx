// src/App.tsx
import React, { useState, useEffect } from "react";
import { useEstadoNavegacion, type SeccionApp } from "./estado/estadoNavegacion";
import { useEstadoTrabajadores } from "./estado/estadoTrabajadores";
import { useEstadoInventario } from "./estado/estadoInventario";
import { useEstadoVentas } from "./estado/estadoVentas";
import { useEstadoConfiguracion } from "./estado/estadoConfiguracion";
import { useEstadoAsistencias } from "./estado/estadoAsistencias";
import { useEstadoRed } from "./estado/estadoRed";
import { conectarLAN } from "./servicios/socketCliente";
import { useSincronizacion } from "./hooks/useSincronizacion";
import { cn } from "./utilidades/utils";
import { Sun, Moon, Menu, ShoppingCart, Package, LayoutDashboard, History, ChevronLeft, AlertTriangle, MonitorPlay, Users, Settings, LogOut, UserCircle, Wallet, Wifi, Server, Cloud, CloudOff } from "lucide-react";

import VistaInventario from "./vistas/VistaInventario";
import VistaNuevoProducto from "./vistas/VistaNuevoProducto";
import VistaPOS from "./vistas/VistaPOS";
import VistaPantallaCliente from "./vistas/VistaPantallaCliente";
import VistaHistorialVentas from "./vistas/VistaHistorialVentas";
import VistaPanel from "./vistas/VistaPanel";
import VistaStockBajo from "./vistas/VistaStockBajo";
import VistaEquipo from "./vistas/VistaEquipo";
import VistaConfiguracion from "./vistas/VistaConfiguracion";
import VistaLogin from "./vistas/VistaLogin";
import VistaPerfil from "./vistas/VistaPerfil";
import VistaCorteCaja from "./vistas/VistaCorteCaja";
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
  perfil: VistaPerfil,
  caja: VistaCorteCaja,
};

export default function App() {
  const { seccionActual, setSeccionActual } = useEstadoNavegacion();
  
  const { trabajadorActivo, cargando: cargandoTrabajadores, cargarTrabajadores, cerrarSesion } = useEstadoTrabajadores();
  const { productos, cargarProductos, cargando: cargandoInventario, aplicarSincronizacionRemota } = useEstadoInventario();
  const { cargarVentas, cargando: cargandoVentas } = useEstadoVentas();
  const { cargarConfiguracion, cargando: cargandoConfiguracion } = useEstadoConfiguracion();
  const { registrarSalida, cargarAsistencias } = useEstadoAsistencias();
  
  const { esMaestro, ipMaestro, conectadoLAN } = useEstadoRed();
  const { estaEnLinea } = useSincronizacion();
  
  const [modoOscuro, setModoOscuro] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(true);
  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);

  if (window.location.search.includes('cliente=true')) {
    return <VistaPantallaCliente />;
  }

  // --- LÓGICA DE SINCRONIZACIÓN LAN ---
  useEffect(() => {
    const api = (window as any).apiLocal;
    if (esMaestro && api) {
      api.iniciarServidorLAN();
      api.onAccionDeEsclavo((accion: any) => {
         aplicarSincronizacionRemota(accion);
      });
    } else if (!esMaestro && ipMaestro) {
      conectarLAN(ipMaestro, (accion) => {
         aplicarSincronizacionRemota(accion);
      });
    }
  }, [esMaestro, ipMaestro, aplicarSincronizacionRemota]);

  useEffect(() => {
    cargarProductos();
    cargarVentas();
    cargarTrabajadores();
    cargarConfiguracion();
    cargarAsistencias();
  }, [cargarProductos, cargarVentas, cargarTrabajadores, cargarConfiguracion, cargarAsistencias]);

  useEffect(() => {
    if (modoOscuro) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [modoOscuro]);
  
  const estaCargandoGlobal = cargandoTrabajadores || cargandoInventario || cargandoVentas || cargandoConfiguracion;
  
  if (estaCargandoGlobal) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Iniciando sistema...</p>
      </div>
    );
  }

  if (!trabajadorActivo) {
    return <VistaLogin />;
  }

  const ComponenteActivo = componentesSeccion[seccionActual];

  const abrirPantallaCliente = () => {
    const rutaBase = window.location.href.split('?')[0];
    window.open(`${rutaBase}?cliente=true`, "PantallaCliente", "width=800,height=900,menubar=no,toolbar=no");
  };

  const menusOperativos = [
    { id: "pos", icono: ShoppingCart, texto: "Punto de Venta" },
    { id: "caja", icono: Wallet, texto: "Corte de Caja" },
    { id: "inventario", icono: Package, texto: "Inventario" },
    { id: "historial", icono: History, texto: "Historial de Ventas" },
    { id: "stock-bajo", icono: AlertTriangle, texto: "Stock Bajo" },
    { id: "perfil", icono: UserCircle, texto: "Mi Perfil" },
  ] as const;
  
  const alertasStock = productos.filter(tieneAlertaStock).length;

  const menusAdmin = [
    { id: "panel", icono: LayoutDashboard, texto: "Panel Principal" },
    { id: "equipo", icono: Users, texto: "Equipo" },
    { id: "configuracion", icono: Settings, texto: "Configuración" },
  ] as const;

  const esAdmin = trabajadorActivo?.rol === "DUENO" || trabajadorActivo?.rol === "SUPERVISOR";

  const confirmarCerrarSesion = async () => {
    setMostrarModalSalida(false);
    if (trabajadorActivo) {
      await registrarSalida(trabajadorActivo.id);
    }
    cerrarSesion();
    setSeccionActual("pos"); 
  };

  return (
    <div className="flex h-screen bg-emerald-50/30 dark:bg-slate-950 transition-colors overflow-hidden text-sm relative">
      
      {mostrarModalSalida && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-4">
              <LogOut size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">¿Quieres cerrar sesión?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
              Tendrás que ingresar tu PIN nuevamente para acceder al sistema.
            </p>
            <div className="flex w-full gap-3">
              <button onClick={() => setMostrarModalSalida(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarCerrarSesion} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={cn(
        "efecto-cristal h-full transition-all duration-300 flex flex-col border-r border-slate-200/50 dark:border-white/10 shrink-0 z-20",
        menuAbierto ? "w-64" : "w-16"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-slate-200/50 dark:border-white/10 h-16 shrink-0">
          {menuAbierto && (
            <button onClick={() => setSeccionActual("perfil")} className="flex flex-col overflow-hidden text-left hover:opacity-80 transition-opacity" title="Ver mi perfil">
              <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400 truncate">Mi Tienda</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider hover:text-emerald-600 transition-colors">{trabajadorActivo?.nombre}</span>
            </button>
          )}
          <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-1.5 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors mx-auto">
            {menuAbierto ? <ChevronLeft size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* --- INDICADOR DE RED ACTUALIZADO --- */}
        <div className="px-3 py-2 border-b border-slate-200/50 dark:border-white/10">
          <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold", 
            estaEnLinea ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
            esMaestro ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" :
            conectadoLAN ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : 
            "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {estaEnLinea ? <Cloud size={14} /> : esMaestro ? <Server size={14} /> : conectadoLAN ? <Wifi size={14} /> : <CloudOff size={14} />}
            {menuAbierto && (
              <span>
                {estaEnLinea ? "Sincronizado a Internet" :
                 esMaestro ? "Servidor Local (Sin Internet)" :
                 conectadoLAN ? "LAN Conectado (Sin Internet)" :
                 "Sin Conexión"}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3 scrollbar-hide">
          <div className="mb-2">
            {menuAbierto && <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operaciones</p>}
            {menusOperativos.map((menu) => {
              const Icono = menu.icono;
              const activo = seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto");
              const tieneAlerta = menu.id === "stock-bajo" && alertasStock > 0;

              return (
                <button key={menu.id} onClick={() => setSeccionActual(menu.id as SeccionApp)} title={!menuAbierto ? menu.texto : undefined}
                  className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl transition-all font-medium mb-1",
                    activo ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200",
                    !menuAbierto && "justify-center px-0"
                  )}>
                  
                  <div className="relative flex items-center justify-center shrink-0">
                    <Icono size={18} />
                    {!menuAbierto && tieneAlerta && (
                      <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm border border-emerald-50 dark:border-slate-950">
                        {alertasStock > 99 ? "99+" : alertasStock}
                      </span>
                    )}
                  </div>
                  
                  {menuAbierto && <span className="flex-1 text-left truncate">{menu.texto}</span>}
                  
                  {menuAbierto && tieneAlerta && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                      {alertasStock > 99 ? "99+" : alertasStock}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {esAdmin && (
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

          <button onClick={() => setMostrarModalSalida(true)} title={!menuAbierto ? "Cerrar Sesión Local" : undefined}
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