// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apiLocal', {
  guardarDatos: (tabla, datos) => ipcRenderer.invoke('guardar-datos', tabla, datos),
  leerDatos: (tabla) => ipcRenderer.invoke('leer-datos', tabla),
  
  obtenerHardwareId: () => ipcRenderer.invoke('obtener-hardware-id'),
  validarSuscripcionOffline: () => ipcRenderer.invoke('validar-suscripcion-offline'),
  sincronizarReloj: (fechaVencimiento) => ipcRenderer.invoke('sincronizar-reloj', fechaVencimiento),

  escucharPeticionDispositivos: (callback) => {
    ipcRenderer.on('mostrar-lista-dispositivos', (event, datos) => callback(datos));
  },
  confirmarDispositivo: (idDispositivo) => {
    ipcRenderer.invoke('confirmar-dispositivo', idDispositivo);
  },

  // NUEVO: Llama al botón mágico
  repararFirewall: () => ipcRenderer.invoke('reparar-firewall'),

  obtenerIpLocal: () => ipcRenderer.invoke('obtener-ip-local'),
  iniciarServidorLAN: () => ipcRenderer.invoke('iniciar-servidor-lan'),
  emitirAEsclavos: (data) => ipcRenderer.invoke('emitir-a-esclavos', data),
  onAccionDeEsclavo: (callback) => {
    ipcRenderer.removeAllListeners('accion-de-esclavo');
    ipcRenderer.on('accion-de-esclavo', (event, data) => callback(data));
  }
});