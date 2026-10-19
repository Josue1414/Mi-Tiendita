// src/App.tsx
import React, { useState, useEffect } from "react";
import { useEstadoNavegacion, type SeccionApp } from "./estado/estadoNavegacion";
import { useEstadoTrabajadores } from "./estado/estadoTrabajadores";
import { useEstadoInventario } from "./estado/estadoInventario";
import { useEstadoVentas } from "./estado/estadoVentas";
import { useEstadoConfiguracion } from "./estado/estadoConfiguracion";
import { useEstadoAsistencias } from "./estado/estadoAsistencias";
import { useEstadoCaja } from "./estado/estadoCaja";
import { useEstadoFiados } from "./estado/estadoFiados";
import { useEstadoRed } from "./estado/estadoRed";
import { useEstadoPlan } from "./estado/estadoPlan";
import { conectarLAN } from "./servicios/socketCliente";
import { useSincronizacion } from "./hooks/useSincronizacion";
import { cn } from "./utilidades/utils";
import { Menu, ShoppingCart, Package, LayoutDashboard, History, ChevronLeft, AlertTriangle, Users, Settings, LogOut, UserCircle, Wallet, Wifi, Server, Cloud, CloudOff, MonitorPlay, BookUser } from "lucide-react";
import { claseTemaVisual, EVENTO_TEMA, obtenerTemaVisual, type TemaVisual } from "./utilidades/temas";

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
import AccionEscaneoInventario from "./componentes/movil/AccionEscaneoInventario";
import ModalSeleccionDispositivo from "./componentes/ui/ModalSeleccionDispositivo";
import ModalQRCliente from "./componentes/ui/ModalQRCliente";
import VistaFiados from "./vistas/VistaFiados";

// Añadimos 'fiados' al mapa (asegúrate de que en estadoNavegacion.ts 'fiados' exista en el type SeccionApp)
const componentesSeccion: Record<SeccionApp | "fiados", React.ComponentType> = {
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
  fiados: VistaFiados, // <-- AGREGADO
};

const crearSnapshotLAN = () => {
  const caja = useEstadoCaja.getState();
  const configuracion = useEstadoConfiguracion.getState();
  return {
    productos: useEstadoInventario.getState().productos,
    categorias: useEstadoInventario.getState().categorias,
    ventas: useEstadoVentas.getState().ventas,
    trabajadores: useEstadoTrabajadores.getState().trabajadores,
    asistencias: useEstadoAsistencias.getState().asistencias,
    fiados: useEstadoFiados.getState().deudores,
    caja: {
      turnos: caja.turnos,
      fondoBaseActual: caja.fondoBaseActual,
      notaGeneralDueno: caja.notaGeneralDueno,
      controlTurnosHabilitado: caja.controlTurnosHabilitado,
      forzarRecepcionCaja: caja.forzarRecepcionCaja,
      requerirPinCancelacion: caja.requerirPinCancelacion
    },
    configuracion: {
      nombreTienda: configuracion.nombreTienda,
      mensajeTicket: configuracion.mensajeTicket,
      direccionTienda: configuracion.direccionTienda,
      logoTienda: configuracion.logoTienda,
      sincronizacionNube: configuracion.sincronizacionNube,
      teclaCobro: configuracion.teclaCobro,
      mensajePago: configuracion.mensajePago,
      bancoTransferencia: configuracion.bancoTransferencia,
      titularTransferencia: configuracion.titularTransferencia,
      cuentaTransferencia: configuracion.cuentaTransferencia,
      teclaEfectivo: configuracion.teclaEfectivo,
      teclaTarjeta: configuracion.teclaTarjeta,
      teclaTransferencia: configuracion.teclaTransferencia
    }
  };
};

const aplicarAccionLANRecibida = (accion: any) => {
  if (typeof accion?.tipo !== "string") return;
  if (accion.tipo === "LAN_VENTA_AGREGAR" || accion.tipo === "LAN_VENTA_CANCELAR") {
    void useEstadoVentas.getState().aplicarAccionLAN(accion.tipo, accion.payload);
  } else if (accion.tipo.startsWith("LAN_FIADO_")) {
    void useEstadoFiados.getState().aplicarAccionLAN(accion.tipo, accion.payload);
  } else if (accion.tipo.startsWith("LAN_CAJA_")) {
    void useEstadoCaja.getState().aplicarAccionLAN(accion.tipo, accion.payload);
  } else if (accion.tipo.startsWith("LAN_TRABAJADOR_")) {
    void useEstadoTrabajadores.getState().aplicarAccionLAN(accion.tipo, accion.payload);
  } else if (accion.tipo === "LAN_ASISTENCIA_UPSERT") {
    void useEstadoAsistencias.getState().aplicarAccionLAN(accion.tipo, accion.payload);
  } else if (accion.tipo.startsWith("LAN_CONFIG_")) {
    void useEstadoConfiguracion.getState().aplicarAccionLAN(accion.tipo, accion.payload);
  } else {
    useEstadoInventario.getState().aplicarSincronizacionRemota(accion);
  }
};

const hidratarDesdeLAN = async (snapshot: ReturnType<typeof crearSnapshotLAN>) => {
  await useEstadoInventario.getState().hidratarEstadoLAN(snapshot);
  await useEstadoVentas.getState().hidratarEstadoLAN(snapshot);
  await useEstadoTrabajadores.getState().hidratarEstadoLAN(snapshot);
  await useEstadoAsistencias.getState().hidratarEstadoLAN(snapshot);
  await useEstadoCaja.getState().hidratarEstadoLAN(snapshot);
  await useEstadoConfiguracion.getState().hidratarEstadoLAN(snapshot);
  await useEstadoFiados.getState().hidratarEstadoLAN(snapshot);
};

export default function App() {
  const { seccionActual, setSeccionActual } = useEstadoNavegacion();
  
  const { trabajadorActivo, cargando: cargandoTrabajadores, cargarTrabajadores, cerrarSesion } = useEstadoTrabajadores();
  const { productos, cargarProductos, cargando: cargandoInventario } = useEstadoInventario();
  const { cargarVentas, cargando: cargandoVentas } = useEstadoVentas();
  // <-- IMPORTAMOS LA VARIABLE habilitarFiados -->
  const { cargarConfiguracion, cargando: cargandoConfiguracion, habilitarFiados, modoAccesoFiados } = useEstadoConfiguracion();
  const { registrarSalida, cargarAsistencias } = useEstadoAsistencias();
  
  const {
    esMaestro,
    ipMaestro,
    conectadoLAN,
    servidorLANActivo,
    dispositivosLANConectados,
    setIpMaestro,
    setEstadoLAN
  } = useEstadoRed();
  const { estaEnLinea } = useSincronizacion();
  const permiteNube = useEstadoPlan((estado) => estado.permiteNube);
  
  const [temaVisual, setTemaVisual] = useState<TemaVisual>(() => obtenerTemaVisual());
  
  const [escalaUI, setEscalaUI] = useState(() => localStorage.getItem("escala_ui") || "normal");
  
  const [menuAbierto, setMenuAbierto] = useState(true);
  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);
  const [modalQRAbierto, setModalQRAbierto] = useState(false);

  useEffect(() => {
    const aplicarCambioEscala = (evento: Event) => {
      const nuevaEscala = (evento as CustomEvent<string>).detail;
      if (nuevaEscala) setEscalaUI(nuevaEscala);
    };
    window.addEventListener("CAMBIAR_ESCALA_UI", aplicarCambioEscala);
    return () => window.removeEventListener("CAMBIAR_ESCALA_UI", aplicarCambioEscala);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (escalaUI === "chica") root.style.fontSize = "14px";
    else if (escalaUI === "grande") root.style.fontSize = "18px";
    else root.style.fontSize = "16px";
  }, [escalaUI]);

  useEffect(() => {
    const aplicarTema = (evento: Event) => {
      const tema = (evento as CustomEvent<TemaVisual>).detail;
      if (tema) setTemaVisual(tema);
    };
    window.addEventListener(EVENTO_TEMA, aplicarTema);
    return () => window.removeEventListener(EVENTO_TEMA, aplicarTema);
  }, []);

  if (window.location.search.includes('cliente=')) {
    return <VistaPantallaCliente />;
  }

  useEffect(() => {
    const api = (window as any).apiLocal;
    if (esMaestro && api) {
      api.iniciarServidorLAN().then((estado: { activo: boolean; dispositivosConectados: number }) => {
        setEstadoLAN(estado.activo, estado.dispositivosConectados);
      }).catch((error: unknown) => {
        console.error("No se pudo iniciar el servidor LAN:", error);
      });
      api.onEstadoLAN((estado: { activo: boolean; dispositivosConectados: number }) => {
        setEstadoLAN(estado.activo, estado.dispositivosConectados);
      });
      api.onSolicitudSnapshotLAN((socketId: string) => {
        void (async () => {
          await useEstadoVentas.getState().cargarVentas();
          await useEstadoFiados.getState().cargarDeudores();
          await api.emitirSnapshotLAN(socketId, crearSnapshotLAN());
        })().catch((error: unknown) => {
          console.error("No se pudo enviar el estado inicial por LAN:", error);
        });
      });
      api.onAccionDeEsclavo(aplicarAccionLANRecibida);
    } else if (!esMaestro && window.location.protocol === "http:" && window.location.port === "4000") {
      const ipServidorLocal = window.location.hostname;
      if (ipMaestro !== ipServidorLocal) setIpMaestro(ipServidorLocal);
      conectarLAN(ipServidorLocal, aplicarAccionLANRecibida, (snapshot) => {
        void hidratarDesdeLAN(snapshot).catch((error: unknown) => {
          console.error("No se pudo cargar el estado local del Cerebro:", error);
        });
      });
    } else if (!esMaestro && ipMaestro) {
      conectarLAN(ipMaestro, aplicarAccionLANRecibida, (snapshot) => {
        void hidratarDesdeLAN(snapshot).catch((error: unknown) => {
          console.error("No se pudo cargar el estado local del Cerebro:", error);
        });
      });
    }
  }, [esMaestro, ipMaestro, setIpMaestro, setEstadoLAN]);

  useEffect(() => {
    cargarProductos();
    cargarVentas();
    cargarTrabajadores();
    cargarConfiguracion();
    cargarAsistencias();
  }, [cargarProductos, cargarVentas, cargarTrabajadores, cargarConfiguracion, cargarAsistencias]);

  useEffect(() => {
    const usaModoOscuro = temaVisual === "oscuro" || temaVisual === "grafito";
    document.documentElement.classList.toggle("dark", usaModoOscuro);
  }, [temaVisual]);
  
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

  const puedeAccederFiados = habilitarFiados && (
    trabajadorActivo.rol === "DUENO" ||
    modoAccesoFiados === "TODOS" ||
    trabajadorActivo.permisos?.permisoFiados === true
  );
  const ComponenteActivo = seccionActual === "fiados" && !puedeAccederFiados
    ? VistaPOS
    : componentesSeccion[seccionActual as SeccionApp | "fiados"] || VistaPOS;

  const abrirPantallaCliente = () => {
    const nombreCaja = localStorage.getItem("nombre_dispositivo_local") || "Caja Principal";
    const nombreTienda = useEstadoConfiguracion.getState().nombreTienda;
    
    const esEscritorio = typeof window !== 'undefined' && (window as any).apiLocal !== undefined;
    const esDispositivoMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;

    if (esEscritorio || !esDispositivoMovil) {
      const rutaBase = window.location.href.split('?')[0];
      window.open(`${rutaBase}?cliente=${encodeURIComponent(nombreCaja)}&tienda=${encodeURIComponent(nombreTienda)}`, "PantallaCliente", "width=800,height=900,menubar=no,toolbar=no");
    } else {
      setModalQRAbierto(true);
    }
  };

  // Construcción dinámica de menús según si Fiados está habilitado
  const baseMenusOperativos = [
    { id: "pos", icono: ShoppingCart, texto: "Punto de Venta" },
    { id: "caja", icono: Wallet, texto: "Corte de Caja" },
    { id: "inventario", icono: Package, texto: "Inventario" },
    { id: "historial", icono: History, texto: "Historial de Ventas" },
    { id: "stock-bajo", icono: AlertTriangle, texto: "Stock Bajo" },
    { id: "perfil", icono: UserCircle, texto: "Mi Perfil" },
    { id: "pantalla-cliente", icono: MonitorPlay, texto: "Pantalla Cliente" },
  ];

  if (puedeAccederFiados) {
    baseMenusOperativos.splice(4, 0, { id: "fiados", icono: BookUser, texto: "Libreta de Fiados" });
  }

  const baseMenusMovilesOperativos = [
    { id: "inventario", icono: Package, texto: "Inventario" },
    { id: "stock-bajo", icono: AlertTriangle, texto: "Stock" },
    { id: "historial", icono: History, texto: "Historial" },
    { id: "caja", icono: Wallet, texto: "Corte de Caja" },
    { id: "pos", icono: ShoppingCart, texto: "Punto de Venta" },
  ];

  if (puedeAccederFiados) {
    baseMenusMovilesOperativos.splice(3, 0, { id: "fiados", icono: BookUser, texto: "Fiados" });
  }

  const productosConAlerta = productos.filter(tieneAlertaStock);
  const alertasAgotados = productosConAlerta.filter(p => p.stock_actual === 0).length;
  const alertasPorTerminar = productosConAlerta.length - alertasAgotados;

  const menusAdmin = [
    { id: "panel", icono: LayoutDashboard, texto: "Panel Principal" },
    { id: "equipo", icono: Users, texto: "Equipo" },
    { id: "configuracion", icono: Settings, texto: "Configuración" },
  ] as const;

  const esAdmin = trabajadorActivo?.rol === "DUENO" || trabajadorActivo?.rol === "SUPERVISOR";
  const esVistaMovil = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  
  const menuPantallaCliente = { id: "pantalla-cliente", icono: MonitorPlay, texto: "Pantalla Cliente" };
  const menusMoviles = esVistaMovil
    ? [...baseMenusMovilesOperativos, ...(esAdmin ? menusAdmin : []), menuPantallaCliente]
    : [...baseMenusOperativos, ...(esAdmin ? menusAdmin : [])];
    
  const puntoEscaneo = Math.ceil(menusMoviles.length / 2);

  const confirmarCerrarSesion = async () => {
    setMostrarModalSalida(false);
    if (trabajadorActivo) {
      await registrarSalida(trabajadorActivo.id);
    }
    cerrarSesion();
    setSeccionActual("pos"); 
  };

  return (
    <div className={cn("flex h-screen transition-colors overflow-hidden text-sm relative", claseTemaVisual(temaVisual))}>
      
      <ModalSeleccionDispositivo />
      
      <ModalQRCliente 
        abierto={modalQRAbierto}
        alCerrar={() => setModalQRAbierto(false)}
        nombreCaja={localStorage.getItem("nombre_dispositivo_local") || "Caja Principal"}
      />

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
        "efecto-cristal hidden lg:flex h-full transition-all duration-300 flex-col border-r border-slate-200/50 dark:border-white/10 shrink-0 z-20",
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

        <div className="px-3 py-2 border-b border-slate-200/50 dark:border-white/10 flex flex-col gap-1.5">
          {permiteNube && (
            <div className={cn(
              "py-2 border-b border-slate-200/50 dark:border-white/10",
              menuAbierto ? "px-3" : "flex justify-center"
            )}>
              <div
                title={!menuAbierto ? (estaEnLinea ? "Internet disponible · nube habilitada" : "Nube sin conexión") : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg text-xs font-bold",
                  menuAbierto ? "px-2 py-1.5" : "justify-center p-1.5",
                  estaEnLinea ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                  "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                {estaEnLinea ? <Cloud size={14} className="shrink-0" /> : <CloudOff size={14} className="shrink-0" />}
                {menuAbierto && (
                  <span>
                    {estaEnLinea ? "Internet disponible · nube habilitada" : "Nube sin conexión"}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold",
            (esMaestro && servidorLANActivo) || conectadoLAN
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          )}>
            {esMaestro ? <Server size={14} /> : <Wifi size={14} />}
            {menuAbierto && (
              <span>
                {esMaestro
                  ? servidorLANActivo
                    ? `LAN activa · ${dispositivosLANConectados} conectado(s)`
                    : "Servidor LAN no activo"
                  : conectadoLAN
                    ? "LAN conectada al Cerebro"
                    : "LAN desconectada"}
              </span>
            )}
          </div>
          {!permiteNube && menuAbierto && (
            <span className="px-2 text-[10px] text-slate-500">Plan local · sin sincronización de nube</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3 scrollbar-hide">
          <div className="mb-2">
            {menuAbierto && <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operaciones</p>}
            {baseMenusOperativos.map((menu) => {
              const Icono = menu.icono;
              const activo = menu.id !== "pantalla-cliente" && (seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto"));
              
              return (
                <button key={menu.id} onClick={() => {
                  if (menu.id === "pantalla-cliente") {
                    abrirPantallaCliente();
                    return;
                  }
                  setSeccionActual(menu.id as SeccionApp);
                }} title={!menuAbierto ? menu.texto : undefined}
                  className={cn("w-full flex items-center gap-3 p-2.5 rounded-xl transition-all font-medium mb-1",
                    activo ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200",
                    !menuAbierto && "justify-center px-0"
                  )}>
                  
                  <div className="relative flex items-center justify-center shrink-0">
                    <Icono size={18} />
                    {!menuAbierto && menu.id === "stock-bajo" && alertasPorTerminar > 0 && (
                      <span className="absolute -top-2 -left-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-sm border border-emerald-50 dark:border-slate-950">
                        {alertasPorTerminar > 99 ? "99+" : alertasPorTerminar}
                      </span>
                    )}
                    {!menuAbierto && menu.id === "stock-bajo" && alertasAgotados > 0 && (
                      <span className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm border border-emerald-50 dark:border-slate-950">
                        {alertasAgotados > 99 ? "99+" : alertasAgotados}
                      </span>
                    )}
                  </div>
                  
                  {menuAbierto && (
                    <div className="flex-1 flex items-center gap-2 truncate text-left">
                      {menu.id === "stock-bajo" && alertasPorTerminar > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm">
                          {alertasPorTerminar > 99 ? "99+" : alertasPorTerminar}
                        </span>
                      )}
                      
                      <span className="truncate">{menu.texto}</span>
                      
                      {menu.id === "stock-bajo" && alertasAgotados > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                          {alertasAgotados > 99 ? "99+" : alertasAgotados}
                        </span>
                      )}
                    </div>
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
          <button onClick={() => setMostrarModalSalida(true)} title={!menuAbierto ? "Cerrar Sesión Local" : undefined}
            className={cn("flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors w-full",
              !menuAbierto && "justify-center px-0"
            )}>
            <LogOut size={18} className="shrink-0" />
            {menuAbierto && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 h-[4.75rem] lg:hidden border-t border-slate-200/70 bg-white/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
        <div className="absolute inset-y-0 left-0 right-1/2 min-w-0 overflow-hidden pr-14">
          <div className="h-full w-full min-w-0 touch-pan-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-1 px-2 py-2">
          {menusMoviles.slice(0, puntoEscaneo).map((menu) => {
          const Icono = menu.icono;
          const activo = menu.id !== "pantalla-cliente" && (seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto"));
          
          return (
            <button key={menu.id} onClick={() => {
              if (menu.id === "pantalla-cliente") {
                abrirPantallaCliente();
                return;
              }
              setSeccionActual(menu.id as SeccionApp);
            }} title={menu.texto} className={cn("relative flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold", activo ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10")}>
              <Icono size={18} />
              <span className="max-w-[4.5rem] truncate">{menu.texto}</span>
              
              {menu.id === "stock-bajo" && alertasPorTerminar > 0 && (
                <span className="absolute left-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {alertasPorTerminar > 99 ? "99+" : alertasPorTerminar}
                </span>
              )}
              {menu.id === "stock-bajo" && alertasAgotados > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {alertasAgotados > 99 ? "99+" : alertasAgotados}
                </span>
              )}
            </button>
          );
          })}
            </div>
          </div>
        </div>
        <AccionEscaneoInventario />
        <div className="absolute inset-y-0 left-1/2 right-0 min-w-0 overflow-hidden pl-14">
          <div className="h-full w-full min-w-0 touch-pan-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-center gap-1 px-2 py-2">
          {menusMoviles.slice(puntoEscaneo).map((menu) => {
          const Icono = menu.icono;
          const activo = menu.id !== "pantalla-cliente" && (seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto"));
          
          return (
            <button key={menu.id} onClick={() => {
              if (menu.id === "pantalla-cliente") {
                abrirPantallaCliente();
                return;
              }
              setSeccionActual(menu.id as SeccionApp);
            }} title={menu.texto} className={cn("relative flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold", activo ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10")}>
              <Icono size={18} />
              <span className="max-w-[4.5rem] truncate">{menu.texto}</span>

              {menu.id === "stock-bajo" && alertasPorTerminar > 0 && (
                <span className="absolute left-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {alertasPorTerminar > 99 ? "99+" : alertasPorTerminar}
                </span>
              )}
              {menu.id === "stock-bajo" && alertasAgotados > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                  {alertasAgotados > 99 ? "99+" : alertasAgotados}
                </span>
              )}
            </button>
          );
          })}
          <button onClick={() => setMostrarModalSalida(true)} title="Cerrar Sesión" className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"><LogOut size={18} /><span>Salir</span></button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 h-full min-w-0 overflow-hidden flex flex-col p-3 pb-24 sm:p-6 sm:pb-24 lg:pb-6 bg-transparent">
        <div className="efecto-cristal w-full h-full rounded-3xl overflow-hidden relative shadow-sm border border-slate-200/50 dark:border-white/10 flex flex-col">
          <ComponenteActivo />
        </div>
      </main>
      
    </div>
  );
}