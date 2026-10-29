// src/componentes/ui/ImagenLocal.tsx
import { useEffect, useState } from "react";
import { Package, ImageDown } from "lucide-react";
import { cn } from "../../utilidades/utils";
import { obtenerUrlImagenLocal } from "../../servicios/baseDatosLocal";
import { enviarAccionLAN } from "../../servicios/sincronizacionLAN";
import { useEstadoRed } from "../../estado/estadoRed";

interface Props {
  nombreArchivo?: string;
  nombreProducto: string;
  className?: string;
}

export default function ImagenLocal({ nombreArchivo, nombreProducto, className }: Props) {
  const [imagenResuelta, setImagenResuelta] = useState<{ nombreArchivo: string; url: string | null } | null>(null);
  const [descargando, setDescargando] = useState(false);
  
  const esMaestro = useEstadoRed((estado) => estado.esMaestro);
  const conectadoLAN = useEstadoRed((estado) => estado.conectadoLAN);

  useEffect(() => {
    if (!nombreArchivo || nombreArchivo.startsWith("data:image/")) return;

    let urlTemporal: string | null = null;
    let cancelado = false;

    // Detectar si estamos en la Pantalla Cliente por LAN
    const params = new URLSearchParams(window.location.search);
    const lanHost = params.get("lanHost");
    const lanPort = params.get("lanPort") || "4000";

    const cargarImagen = async () => {
      try {
        const url = await obtenerUrlImagenLocal(nombreArchivo);
        if (cancelado) {
          if (url) URL.revokeObjectURL(url);
          return;
        }

        if (url) {
          urlTemporal = url;
          setImagenResuelta({ nombreArchivo, url });
          setDescargando(false);
        } else if (lanHost) {
          // Modo Pantalla Cliente LAN: Construir URL HTTP directa al Cerebro
          const urlHttp = `http://${lanHost}:${lanPort}/imagenes_lan/${nombreArchivo}`;
          setImagenResuelta({ nombreArchivo, url: urlHttp });
          setDescargando(false);
        } else if (!esMaestro && conectadoLAN) {
          // Modo Esclavo LAN: Solicitar imagen al Cerebro por WebSockets
          setDescargando(true);
          enviarAccionLAN({ tipo: "LAN_SOLICITAR_IMAGEN", payload: nombreArchivo });
        } else {
          setImagenResuelta({ nombreArchivo, url: null });
        }
      } catch (error) {
        console.error("No se pudo cargar la imagen local del producto:", error);
        setImagenResuelta({ nombreArchivo, url: null });
      }
    };

    cargarImagen();

    // Escuchar cuando el Cerebro responda y la imagen se guarde en baseDatosLocal.ts
    const alDescargar = (evento: Event) => {
      const archivoDescargado = (evento as CustomEvent<string>).detail;
      if (archivoDescargado === nombreArchivo) {
        cargarImagen();
      }
    };

    window.addEventListener("imagen-descargada", alDescargar);

    return () => {
      cancelado = true;
      window.removeEventListener("imagen-descargada", alDescargar);
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
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

  return <img src={urlImagen} alt={nombreProducto} className={cn("object-cover", className)} />;
}