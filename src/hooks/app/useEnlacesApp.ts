import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { androidLan } from "../../servicios/androidLan";
import { obtenerUrlLANDesdeEnlaceAndroid } from "../../utilidades/identificador";
import { useEstadoRed } from "../../estado/estadoRed";

export default function useEnlacesApp() {
  const [deepLinkSearch, setDeepLinkSearch] = useState(() => window.location.search);
  const hostLanEnlace = new URLSearchParams(deepLinkSearch).get("lanHost");
  const esVistaCliente = new URLSearchParams(deepLinkSearch).has("cliente");
  const { esMaestro, ipMaestro, setIpMaestro } = useEstadoRed();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let cancelado = false;
    let listener: Awaited<ReturnType<typeof androidLan.addListener>> | null = null;
    const aplicarEnlace = (url: string) => {
      const enlace = obtenerUrlLANDesdeEnlaceAndroid(url);
      if (!enlace) {
        console.error("Se recibió un enlace LAN no válido en Android.");
        return;
      }
      window.history.replaceState(null, "", `${window.location.pathname}${enlace.search}${enlace.hash}`);
      setDeepLinkSearch(enlace.search);
    };

    void androidLan.getLaunchUrl()
      .then(({ url }) => {
        if (!cancelado && url) aplicarEnlace(url);
      })
      .catch((error: unknown) => {
        console.error("No se pudo leer el enlace LAN de inicio en Android:", error);
      });
    void androidLan.addListener("appUrlOpen", ({ url }) => aplicarEnlace(url))
      .then((suscripcion) => {
        if (cancelado) void suscripcion.remove();
        else listener = suscripcion;
      })
      .catch((error: unknown) => {
        console.error("No se pudo escuchar los enlaces LAN en Android:", error);
      });

    return () => {
      cancelado = true;
      if (listener) void listener.remove();
    };
  }, []);

  useEffect(() => {
    if (!esMaestro && hostLanEnlace && ipMaestro !== hostLanEnlace) {
      setIpMaestro(hostLanEnlace);
    }
    const puertoWeb = Number(new URLSearchParams(deepLinkSearch).get("lanPort"));
    if ([4000, 4001].includes(puertoWeb)) {
      localStorage.setItem("puerto_web_maestro_lan", String(puertoWeb));
    }
  }, [deepLinkSearch, esMaestro, hostLanEnlace, ipMaestro, setIpMaestro]);

  return { deepLinkSearch, hostLanEnlace, esVistaCliente };
}
