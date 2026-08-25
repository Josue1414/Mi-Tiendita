const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apiLocal', {
  guardarDatos: (tabla, datos) => ipcRenderer.invoke('guardar-datos', tabla, datos),
  leerDatos: (tabla) => ipcRenderer.invoke('leer-datos', tabla),
  
  // Nuevas funciones para el SaaS
  obtenerHardwareId: () => ipcRenderer.invoke('obtener-hardware-id'),
  validarSuscripcionOffline: () => ipcRenderer.invoke('validar-suscripcion-offline'),
  sincronizarReloj: (fechaVencimiento) => ipcRenderer.invoke('sincronizar-reloj', fechaVencimiento)
});