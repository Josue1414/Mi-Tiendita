// src/servicios/socketCliente.ts
import { io, Socket } from "socket.io-client";
import { useEstadoRed } from "../estado/estadoRed";

let socket: Socket | null = null;

export const desconectarLAN = () => {
  socket?.disconnect();
  socket = null;
  useEstadoRed.getState().setConectadoLAN(false);
};

export const conectarLAN = (
  ip: string,
  alRecibirAccion: (data: any) => void,
  alRecibirEstadoInicial?: (data: any) => void
) => {
  desconectarLAN();
  
  socket = io(`http://${ip}:4000`, {
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    timeout: 10000,
  });
  
  socket.on("connect", () => {
    useEstadoRed.getState().setConectadoLAN(true);
    socket?.emit("registrar-dispositivo-lan");
    socket?.emit("solicitar-estado-inicial");
  });
  
  socket.on("disconnect", () => {
    useEstadoRed.getState().setConectadoLAN(false);
  });

  socket.on("connect_error", (error) => {
    useEstadoRed.getState().setConectadoLAN(false);
    console.error("No se pudo conectar con el Cerebro por LAN:", error);
  });

  socket.on("accion-maestro", (data) => {
    alRecibirAccion(data);
  });

  socket.on("estado-inicial-lan", (data) => {
    alRecibirEstadoInicial?.(data);
  });
};

export const emitirAccionMaestro = (data: any): boolean => {
  if (socket && socket.connected) {
    socket.emit("accion-esclavo", data);
    return true;
  } else {
    useEstadoRed.getState().setConectadoLAN(false);
    console.warn("Sin conexión con la PC Maestra");
    return false;
  }
};