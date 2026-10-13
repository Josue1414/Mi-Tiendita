// src/servicios/socketCliente.ts
import { io, Socket } from "socket.io-client";
import { useEstadoRed } from "../estado/estadoRed";

let socket: Socket | null = null;

export const conectarLAN = (
  ip: string,
  alRecibirAccion: (data: any) => void,
  alRecibirEstadoInicial?: (data: any) => void
) => {
  if (socket) socket.disconnect();
  
  socket = io(`http://${ip}:4000`);
  
  socket.on("connect", () => {
    useEstadoRed.getState().setConectadoLAN(true);
    socket?.emit("solicitar-estado-inicial");
  });
  
  socket.on("disconnect", () => {
    useEstadoRed.getState().setConectadoLAN(false);
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