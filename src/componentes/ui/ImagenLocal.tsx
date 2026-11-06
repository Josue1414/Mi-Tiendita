// src/componentes/ui/ImagenLocal.tsx
import { useEffect, useRef, useState } from "react";
import { Package, ImageDown } from "lucide-react";
import { cn } from "../../utilidades/utils";
import { obtenerUrlImagenLocal } from "../../servicios/baseDatosLocal";
import { enviarAccionLAN } from "../../servicios/sincronizacionLAN";
import { useEstadoRed } from "../../estado/estadoRed";

const EVENTO_SOLICITAR_IMAGEN_P2P = "solicitar-imagen-p2p";
const EVENTO_SOLICITAR_IMAGEN_LAN = "solicitar-imagen-lan-pantalla";

interface Props {
  nombreArchivo?: string;
  nombreProducto: string;
  className?: string;
}

export default function ImagenLocal({ nombreArchivo, nombreProducto, className }: Props) {
  const [imagenResuelta, setImagenResuelta] = useState<{ nombreArchivo: string; url: string | null } | null>(null);
  const [descargando, setDescargando] = useState(false);
  const temporizadorLANRef = useRef<number | null>(null);
  
  const esMaestro = useEstadoRed((estado) => estado.esMaestro);
  const conectadoLAN = useEstadoRed((estado) => estado.conectadoLAN);

  useEffect(() => {
    if (!nombreArchivo || nombreArchivo.startsWith("data:image/")) return;

    if (nombreArchivo.startsWith("http://") || nombreArchivo.startsWith("https://")) {
      setImagenResuelta({ nombreArchivo, url: nombreArchivo });
      setDescargando(false);
      return;
    }

    let cancelado = false;

    // Detectar si estamos en la Pantalla Cliente por LAN
    const params = new URLSearchParams(window.location.search);
    const lanHost = params.get("lanHost");
    const lanPort = params.get("lanPort") || "4000";
    let temporizadorSolicitud: number | undefined;
    let temporizadorSolicitudP2P: number | undefined;

    const cargarImagen = async () => {
      try {
        const url = await obtenerUrlImagenLocal(nombreArchivo);
        if (cancelado) return;

        if (url) {
          setImagenResuelta({ nombreArchivo, url });
          setDescargando(false);
        } else if (lanHost) {
          // Modo Pantalla Cliente LAN: Construir URL HTTP directa al Cerebro
          const urlHttp = `http://${lanHost}:${lanPort}/imagenes_lan/${nombreArchivo}`;
          setImagenResuelta({ nombreArchivo, url: urlHttp });
          setDescargando(false);
        } else if (params.has("peer")) {
          setDescargando(true);
          temporizadorSolicitudP2P = window.setTimeout(() => {
            if (!cancelado) {
              window.dispatchEvent(new CustomEvent(EVENTO_SOLICITAR_IMAGEN_P2P, { detail: nombreArchivo }));
            }
          }, 0);
          if (temporizadorSolicitud) window.clearTimeout(temporizadorSolicitud);
          temporizadorSolicitud = window.setTimeout(() => {
            if (!cancelado) {
              setImagenResuelta({ nombreArchivo, url: null });
              setDescargando(false);
            }
          }, 15000);
        } else if (!esMaestro && conectadoLAN) {
          // Modo Esclavo LAN: Solicitar imagen al Cerebro por WebSockets
          setDescargando(true);
          enviarAccionLAN({ tipo: "LAN_SOLICITAR_IMAGEN", payload: nombreArchivo });
        } else {
          setImagenResuelta({ nombreArchivo, url: null });
        }
      } catch (error) {
        console.error("No se pudo cargar la imagen local del producto:", error);
        if (!cancelado) setImagenResuelta({ nombreArchivo, url: null });
      }
    };

    cargarImagen();

    const alDescargar = (evento: Event) => {
      const archivoDescargado = (evento as CustomEvent<string>).detail;
      if (archivoDescargado === nombreArchivo) {
        if (temporizadorSolicitud) window.clearTimeout(temporizadorSolicitud);
        if (temporizadorLANRef.current !== null) {
          window.clearTimeout(temporizadorLANRef.current);
          temporizadorLANRef.current = null;
        }
        cargarImagen();
      }
    };

    window.addEventListener("imagen-descargada", alDescargar);

    return () => {
      cancelado = true;
      if (temporizadorSolicitud) window.clearTimeout(temporizadorSolicitud);
      if (temporizadorSolicitudP2P) window.clearTimeout(temporizadorSolicitudP2P);
      if (temporizadorLANRef.current !== null) {
        window.clearTimeout(temporizadorLANRef.current);
        temporizadorLANRef.current = null;
      }
      window.removeEventListener("imagen-descargada", alDescargar);
      // ⚠️ PARCHE CRÍTICO: 
      // Eliminamos el `URL.revokeObjectURL(urlTemporal)` que destruía las fotos
      // cuando el carrito se vaciaba después de una compra.
    };
  }, [nombreArchivo, esMaestro, conectadoLAN]);

  const urlImagen = nombreArchivo?.startsWith("data:image/")
    ? nombreArchivo
    : imagenResuelta && imagenResuelta.nombreArchivo === nombreArchivo
      ? imagenResuelta.url
      : null;

  if (descargando) {
    return (
      <div className={cn("bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500", className)}>
        <ImageDown className="animate-pulse mb-1" size={24} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-center px-1">Sincronizando</span>
      </div>
    );
  }

  if (!nombreArchivo || !urlImagen) {
    return (
      <div className={cn("bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold", className)}>
        {nombreProducto ? nombreProducto.charAt(0).toUpperCase() : <Package size={20} />}
      </div>
    );
  }

  return (
    <img
      src={urlImagen}
      alt={nombreProducto}
      className={cn("object-cover", className)}
      onError={() => {
        if (!new URLSearchParams(window.location.search).has("lanHost")) return;
        setImagenResuelta({ nombreArchivo: nombreArchivo || "", url: null });
        setDescargando(true);
        window.dispatchEvent(new CustomEvent(EVENTO_SOLICITAR_IMAGEN_LAN, { detail: nombreArchivo }));
        if (temporizadorLANRef.current !== null) window.clearTimeout(temporizadorLANRef.current);
        temporizadorLANRef.current = window.setTimeout(() => {
          temporizadorLANRef.current = null;
          setDescargando(false);
        }, 15000);
      }}
    />
  );
}