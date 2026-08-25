// src/componentes/ui/ImagenLocal.tsx
import { Package } from "lucide-react";
import { cn } from "../../utilidades/utils";

interface Props {
  nombreArchivo?: string;
  nombreProducto: string;
  className?: string;
}

export default function ImagenLocal({ nombreArchivo, nombreProducto, className }: Props) {
  // Si no hay imagen guardada o hubo un error, mostramos el cuadro con la inicial
  if (!nombreArchivo) {
    return (
      <div className={cn("bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold", className)}>
        {nombreProducto ? nombreProducto.charAt(0).toUpperCase() : <Package size={20} />}
      </div>
    );
  }

  // Renderizamos directamente la imagen en formato Base64 recuperada de IndexedDB
  return <img src={nombreArchivo} alt={nombreProducto} className={cn("object-cover", className)} />;
}