import type { ComponentType } from "react";
import type { SeccionApp } from "../../estado/estadoNavegacion";
import VistaInventario from "../VistaInventario";
import VistaNuevoProducto from "../VistaNuevoProducto";
import VistaPOS from "../VistaPOS";
import VistaHistorialVentas from "../VistaHistorialVentas";
import VistaStockBajo from "../VistaStockBajo";
import VistaEquipo from "../VistaEquipo";
import VistaConfiguracion from "../VistaConfiguracion";
import VistaPerfil from "../VistaPerfil";
import VistaCorteCaja from "../VistaCorteCaja";
import VistaFiados from "../VistaFiados";
import VistaFacturacion from "../VistaFacturacion";

export const componentesSeccion: Record<Exclude<SeccionApp | "fiados" | "facturacion", "panel">, ComponentType> = {
  pos: VistaPOS,
  inventario: VistaInventario,
  reportes: () => <div>Reportes</div>,
  "stock-bajo": VistaStockBajo,
  "nuevo-producto": VistaNuevoProducto,
  historial: VistaHistorialVentas,
  equipo: VistaEquipo,
  configuracion: VistaConfiguracion,
  perfil: VistaPerfil,
  caja: VistaCorteCaja,
  fiados: VistaFiados,
  facturacion: VistaFacturacion,
};
