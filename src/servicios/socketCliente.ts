// src/servicios/socketCliente.ts
import { io, Socket } from "socket.io-client";
import { useEstadoRed } from "../estado/estadoRed";

let socket: Socket | null = null;

export const conectarLAN = (ip: string, alRecibirAccion: (data: any) => void) => {
  if (socket) socket.disconnect();
  
  socket = io(`http://${ip}:4000`);
  
  socket.on("connect", () => {
    useEstadoRed.getState().setConectadoLAN(true);
  });
  
  socket.on("disconnect", () => {
    useEstadoRed.getState().setConectadoLAN(false);
  });

  socket.on("accion-maestro", (data) => {
    alRecibirAccion(data);
  });
};

export const emitirAccionMaestro = (data: any) => {
  if (socket && socket.connected) {
    socket.emit("accion-esclavo", data);
  } else {
    console.warn("Sin conexión con la PC Maestra");
  }
};