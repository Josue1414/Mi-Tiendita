import { ChevronLeft, Cloud, CloudOff, LogOut, Menu, Server, Wifi } from "lucide-react";
import type { SeccionApp } from "../../estado/estadoNavegacion";
import { cn } from "../../utilidades/utils";
import type { ItemMenuApp, PropsAlertasMenu } from "./tipos";

interface PropsMenuEscritorio extends PropsAlertasMenu {
  menuAbierto: boolean;
  alCambiarMenu: () => void;
  nombreTrabajador: string;
  permiteNube: boolean;
  estaEnLinea: boolean;
  esMaestro: boolean;
  esRespaldo: boolean;
  conectadoLAN: boolean;
  servidorLANActivo: boolean;
  dispositivosLANConectados: number;
  menusOperativos: ItemMenuApp[];
  menusAdmin: readonly ItemMenuApp[];
  esAdmin: boolean;
  seccionActual: SeccionApp;
  setSeccionActual: (seccion: SeccionApp) => void;
  abrirPantallaCliente: () => void;
  cerrarSesion: () => void;
}

export default function MenuEscritorio({
  alertasPorTerminar,
  alertasAgotados,
  alertasCaducadas,
  menuAbierto,
  alCambiarMenu,
  nombreTrabajador,
  permiteNube,
  estaEnLinea,
  esMaestro,
  esRespaldo,
  conectadoLAN,
  servidorLANActivo,
  dispositivosLANConectados,
  menusOperativos,
  menusAdmin,
  esAdmin,
  seccionActual,
  setSeccionActual,
  abrirPantallaCliente,
  cerrarSesion,
}: PropsMenuEscritorio) {
  return (
    <aside className={cn(
      "efecto-cristal hidden lg:flex h-full transition-all duration-300 flex-col border-r border-slate-200/50 dark:border-white/10 shrink-0 z-20",
      menuAbierto ? "w-64" : "w-16"
    )}>
      <div className="p-4 flex items-center justify-between border-b border-slate-200/50 dark:border-white/10 h-16 shrink-0">
        {menuAbierto && (
          <button onClick={() => setSeccionActual("perfil")} className="flex flex-col overflow-hidden text-left hover:opacity-80 transition-opacity" title="Ver mi perfil">
            <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400 truncate">Mi Tienda</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider hover:text-emerald-600 transition-colors">{nombreTrabajador}</span>
          </button>
        )}
        <button onClick={alCambiarMenu} className="p-1.5 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors mx-auto">
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
                : esRespaldo && conectadoLAN
                  ? "Respaldo sincronizado con el Cerebro"
                  : esRespaldo
                    ? "Respaldo sin conexión al Cerebro"
                    : conectadoLAN
                  ? "Conectado al Cerebro por LAN"
                  : "Sin conexión LAN con el Cerebro · usa su QR"}
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
          {menusOperativos.map((menu) => {
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
                  {!menuAbierto && menu.id === "stock-bajo" && alertasCaducadas > 0 && (
                    <span className="absolute -bottom-2 left-1/2 flex h-4 min-w-4 -translate-x-1/2 items-center justify-center rounded-full bg-purple-600 px-1 text-[9px] font-bold text-white shadow-sm border border-emerald-50 dark:border-slate-950">
                      {alertasCaducadas > 99 ? "99+" : alertasCaducadas}
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
                    {menu.id === "stock-bajo" && alertasCaducadas > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white shadow-sm">
                        {alertasCaducadas > 99 ? "99+" : alertasCaducadas}
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
        <button onClick={cerrarSesion} title={!menuAbierto ? "Cerrar Sesión Local" : undefined}
          className={cn("flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors w-full",
            !menuAbierto && "justify-center px-0"
          )}>
          <LogOut size={18} className="shrink-0" />
          {menuAbierto && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
