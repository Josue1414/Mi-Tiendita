// src/componentes/ui/ImagenLocal.tsx
import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { cn } from "../../utilidades/utils";
import { obtenerUrlImagenLocal } from "../../servicios/baseDatosLocal";

interface Props {
  nombreArchivo?: string;
  nombreProducto: string;
  className?: string;
}

export default function ImagenLocal({ nombreArchivo, nombreProducto, className }: Props) {
  const [imagenResuelta, setImagenResuelta] = useState<{ nombreArchivo: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!nombreArchivo || nombreArchivo.startsWith("data:image/")) return;

    let urlTemporal: string | null = null;
    let cancelado = false;
    void obtenerUrlImagenLocal(nombreArchivo).then((url) => {
      if (cancelado) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      urlTemporal = url;
      setImagenResuelta({ nombreArchivo, url });
    }).catch((error: unknown) => {
      console.error("No se pudo cargar la imagen local del producto:", error);
      setImagenResuelta({ nombreArchivo, url: null });
    });

    return () => {
      cancelado = true;
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
    };
  }, [nombreArchivo]);

  const urlImagen = nombreArchivo?.startsWith("data:image/")
    ? nombreArchivo
    : imagenResuelta && imagenResuelta.nombreArchivo === nombreArchivo
      ? imagenResuelta.url
      : null;

  if (!nombreArchivo || !urlImagen) {
    return (
      <div className={cn("bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold", className)}>
        {nombreProducto ? nombreProducto.charAt(0).toUpperCase() : <Package size={20} />}
      </div>
    );
  }

  return <img src={urlImagen} alt={nombreProducto} className={cn("object-cover", className)} />;
}