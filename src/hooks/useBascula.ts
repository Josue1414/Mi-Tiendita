// src/hooks/useBascula.ts
import { useState, useCallback, useRef } from 'react';

export function useBascula() {
  const [pesoActual, setPesoActual] = useState<number>(0);
  const [basculaConectada, setBasculaConectada] = useState<boolean>(false);
  
  // Referencias para manejar el ciclo de vida del puerto serial
  const puertoRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const streamClosedRef = useRef<Promise<void> | null>(null);

  const conectarBascula = useCallback(async () => {
    if (!('serial' in navigator)) {
      alert("La lectura de básculas no está soportada en este entorno.");
      return;
    }

    try {
      // Solicita el puerto (Electron seleccionará automáticamente el cable de la báscula)
      const puerto = await (navigator as any).serial.requestPort();
      await puerto.open({ baudRate: 9600 }); 
      
      puertoRef.current = puerto;
      setBasculaConectada(true);

      const textDecoder = new TextDecoderStream();
      // Guardamos la promesa del flujo cerrado para usarla en la desconexión
      streamClosedRef.current = puerto.readable.pipeTo(textDecoder.writable);
      
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      // Bucle infinito para escuchar la báscula todo el tiempo
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        // La báscula envía ráfagas de texto ej: "  1.250 kg\r\n"
        // Extraemos solo los números y el punto decimal
        const coincidencias = value.match(/[\d.]+/);
        if (coincidencias) {
          const peso = parseFloat(coincidencias[0]);
          if (!isNaN(peso)) {
            setPesoActual(peso);
          }
        }
      }
    } catch (error) {
      console.error("Error al leer la báscula:", error);
      setBasculaConectada(false);
    }
  }, []);

  const desconectarBascula = useCallback(async () => {
    try {
      // 1. Cancelar el lector para detener el bucle de lectura
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      
      // 2. Esperar a que el flujo de datos se cierre por completo
      if (streamClosedRef.current) {
        await streamClosedRef.current.catch(() => {});
        streamClosedRef.current = null;
      }
      
      // 3. Cerrar el puerto físico de manera segura
      if (puertoRef.current) {
        await puertoRef.current.close();
        puertoRef.current = null;
      }
    } catch (error) {
      console.error("Error al desconectar la báscula:", error);
    } finally {
      setBasculaConectada(false);
      setPesoActual(0);
    }
  }, []);

  return { pesoActual, basculaConectada, conectarBascula, desconectarBascula };
}