import { useEffect, useState } from "react";
import { useEstadoNavegacion, type SeccionApp } from "../../estado/estadoNavegacion";
import { useEstadoTrabajadores } from "../../estado/estadoTrabajadores";
import { useEstadoInventario } from "../../estado/estadoInventario";
import { useEstadoVentas } from "../../estado/estadoVentas";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import { useEstadoAsistencias } from "../../estado/estadoAsistencias";
import { useEstadoRed } from "../../estado/estadoRed";
import { useEstadoPlan } from "../../estado/estadoPlan";
import { useSincronizacion } from "../../hooks/useSincronizacion";
import useDescubrimientoCerebro from "../../hooks/app/useDescubrimientoCerebro";
import useEnlacesApp from "../../hooks/app/useEnlacesApp";
import useServidorLAN from "../../hooks/app/useServidorLAN";
import useTemaYEscalaApp from "../../hooks/app/useTemaYEscalaApp";
import { useEstadoConfiguracion as obtenerEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import { claseTemaVisual } from "../../utilidades/temas";
import { estadoCaducidad } from "../../utilidades/lotes";
import { tieneAlertaStock } from "../../utilidades/stock";
import { cn } from "../../utilidades/utils";
import { AlertTriangle, BookUser, History, LayoutDashboard, MonitorPlay, Package, Settings, ShoppingCart, UserCircle, Users, Wallet } from "lucide-react";
import type { ItemMenuApp } from "./tipos";
import { componentesSeccion } from "../../vistas/secciones_app/componentesSeccion";
import ContenidoPrincipal from "./ContenidoPrincipal";
import MenuEscritorio from "./MenuEscritorio";
import MenuMovil from "./MenuMovil";
import ModalCerrarSesion from "./ModalCerrarSesion";
import ModalSeleccionDispositivo from "../ui/ModalSeleccionDispositivo";
import ModalQRCliente from "../ui/ModalQRCliente";
import VistaLogin from "../../vistas/VistaLogin";
import VistaPantallaCliente from "../../vistas/VistaPantallaCliente";

export default function AppPrincipal() {
  const { seccionActual, setSeccionActual } = useEstadoNavegacion();
  const { trabajadorActivo, cargando: cargandoTrabajadores, cargarTrabajadores, cerrarSesion } = useEstadoTrabajadores();
  const { productos, cargarProductos, cargando: cargandoInventario } = useEstadoInventario();
  const { cargarVentas, cargando: cargandoVentas } = useEstadoVentas();
  const { cargarConfiguracion, cargando: cargandoConfiguracion, habilitarFiados, modoAccesoFiados } = useEstadoConfiguracion();
  const { registrarSalida, cargarAsistencias } = useEstadoAsistencias();
  const {
    esMaestro,
    esRespaldo,
    ipMaestro,
    conectadoLAN,
    servidorLANActivo,
    dispositivosLANConectados,
    setIpMaestro,
    setEstadoLAN
  } = useEstadoRed();
  const { estaEnLinea } = useSincronizacion();
  const permiteNube = useEstadoPlan((estado) => estado.permiteNube);

  const { hostLanEnlace, esVistaCliente } = useEnlacesApp();
  useDescubrimientoCerebro({ esVistaCliente, setIpMaestro });
  const temaVisual = useTemaYEscalaApp();
  useServidorLAN({
    esMaestro,
    esVistaCliente,
    hostLanEnlace,
    ipMaestro,
    cargarProductos,
    cargarTrabajadores,
    cargarVentas,
    cargarConfiguracion,
    cargarAsistencias,
    setIpMaestro,
    setEstadoLAN,
  });

  const [menuAbierto, setMenuAbierto] = useState(true);
  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);
  const [modalQRAbierto, setModalQRAbierto] = useState(false);

  useEffect(() => {
    if (esVistaCliente) return;
    cargarProductos();
    cargarVentas();
    cargarTrabajadores();
    cargarConfiguracion();
    cargarAsistencias();
  }, [esVistaCliente, cargarProductos, cargarVentas, cargarTrabajadores, cargarConfiguracion, cargarAsistencias]);

  useEffect(() => {
    if (esVistaCliente) return;
    const usaModoOscuro = temaVisual === "oscuro" || temaVisual === "grafito";
    document.documentElement.classList.toggle("dark", usaModoOscuro);
  }, [esVistaCliente, temaVisual]);

  if (esVistaCliente) return <VistaPantallaCliente />;

  const estaCargandoGlobal = cargandoTrabajadores || cargandoInventario || cargandoVentas || cargandoConfiguracion;
  if (estaCargandoGlobal) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Iniciando sistema...</p>
      </div>
    );
  }

  if (!trabajadorActivo) return <VistaLogin />;

  const puedeAccederFiados = habilitarFiados && (
    trabajadorActivo.rol === "DUENO" ||
    modoAccesoFiados === "TODOS" ||
    trabajadorActivo.permisos?.permisoFiados === true
  );
  const ComponenteActivo = seccionActual === "panel"
    ? componentesSeccion.pos
    : seccionActual === "fiados" && !puedeAccederFiados
    ? componentesSeccion.pos
    : componentesSeccion[seccionActual as Exclude<SeccionApp | "fiados" | "facturacion", "panel">] || componentesSeccion.pos;

  const abrirPantallaCliente = () => {
    const nombreCaja = localStorage.getItem("nombre_dispositivo_local") || "Caja Principal";
    const nombreTienda = obtenerEstadoConfiguracion.getState().nombreTienda;

    const esEscritorio = typeof window !== "undefined" && window.apiLocal !== undefined;
    const esDispositivoMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;

    if (esEscritorio || !esDispositivoMovil) {
      const rutaBase = window.location.href.split("?")[0];
      window.open(`${rutaBase}?cliente=${encodeURIComponent(nombreCaja)}&tienda=${encodeURIComponent(nombreTienda)}`, "PantallaCliente", "width=800,height=900,menubar=no,toolbar=no");
    } else {
      setModalQRAbierto(true);
    }
  };

  const baseMenusOperativos: ItemMenuApp[] = [
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

  const baseMenusMovilesOperativos: ItemMenuApp[] = [
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
  const lotesConCaducidad = productos.flatMap((producto) =>
    (producto.lotes ?? []).filter((lote) => lote.cantidad > 0).map((lote) => lote)
  );
  const alertasCaducadas = lotesConCaducidad.filter(
    (lote) => estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta) === "vencido"
  ).length;
  const alertasCaducidadProxima = lotesConCaducidad.filter(
    (lote) => estadoCaducidad(lote.fecha_caducidad, new Date(), lote.dias_alerta) === "proximo"
  ).length;
  const alertasAgotados = productosConAlerta.filter(p => p.stock_actual === 0).length;
  const alertasPorTerminar = productosConAlerta.filter(p => p.stock_actual > 0).length + alertasCaducidadProxima;
  const menusAdmin = [
    { id: "panel", icono: LayoutDashboard, texto: "Panel Principal" },
    { id: "equipo", icono: Users, texto: "Equipo" },
    { id: "configuracion", icono: Settings, texto: "Configuración" },
  ] as const;
  const esAdmin = trabajadorActivo.rol === "DUENO" || trabajadorActivo.rol === "SUPERVISOR";
  const esVistaMovil = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const menuPantallaCliente = { id: "pantalla-cliente", icono: MonitorPlay, texto: "Pantalla Cliente" };
  const menusMoviles = esVistaMovil
    ? [...baseMenusMovilesOperativos, ...(esAdmin ? menusAdmin : []), menuPantallaCliente]
    : [...baseMenusOperativos, ...(esAdmin ? menusAdmin : [])];
  const puntoEscaneo = Math.ceil(menusMoviles.length / 2);

  const confirmarCerrarSesion = async () => {
    setMostrarModalSalida(false);
    if (trabajadorActivo) await registrarSalida(trabajadorActivo.id);
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
      <ModalCerrarSesion
        abierto={mostrarModalSalida}
        alCancelar={() => setMostrarModalSalida(false)}
        alConfirmar={confirmarCerrarSesion}
      />
      <MenuEscritorio
        alertasPorTerminar={alertasPorTerminar}
        alertasAgotados={alertasAgotados}
        alertasCaducadas={alertasCaducadas}
        menuAbierto={menuAbierto}
        alCambiarMenu={() => setMenuAbierto(!menuAbierto)}
        nombreTrabajador={trabajadorActivo.nombre}
        permiteNube={permiteNube}
        estaEnLinea={estaEnLinea}
        esMaestro={esMaestro}
        esRespaldo={esRespaldo}
        conectadoLAN={conectadoLAN}
        servidorLANActivo={servidorLANActivo}
        dispositivosLANConectados={dispositivosLANConectados}
        menusOperativos={baseMenusOperativos}
        menusAdmin={menusAdmin}
        esAdmin={esAdmin}
        seccionActual={seccionActual}
        setSeccionActual={setSeccionActual}
        abrirPantallaCliente={abrirPantallaCliente}
        cerrarSesion={() => setMostrarModalSalida(true)}
      />
      <MenuMovil
        alertasPorTerminar={alertasPorTerminar}
        alertasAgotados={alertasAgotados}
        alertasCaducadas={alertasCaducadas}
        menus={menusMoviles}
        puntoEscaneo={puntoEscaneo}
        seccionActual={seccionActual}
        setSeccionActual={setSeccionActual}
        abrirPantallaCliente={abrirPantallaCliente}
        cerrarSesion={() => setMostrarModalSalida(true)}
      />
      <ContenidoPrincipal
        seccionActual={seccionActual}
        componenteActivo={ComponenteActivo}
        estaEnLinea={estaEnLinea}
        permiteNube={permiteNube}
        esMaestro={esMaestro}
        servidorLANActivo={servidorLANActivo}
        conectadoLAN={conectadoLAN}
        dispositivosLANConectados={dispositivosLANConectados}
      />
    </div>
  );
}
