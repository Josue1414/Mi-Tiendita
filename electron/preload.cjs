const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apiLocal', {
  guardarDatos: (tabla, datos) => ipcRenderer.invoke('guardar-datos', tabla, datos),
  leerDatos: (tabla) => ipcRenderer.invoke('leer-datos', tabla),
  
  obtenerHardwareId: () => ipcRenderer.invoke('obtener-hardware-id'),
  validarSuscripcionOffline: () => ipcRenderer.invoke('validar-suscripcion-offline'),
  sincronizarReloj: (fechaVencimiento) => ipcRenderer.invoke('sincronizar-reloj', fechaVencimiento),

  // Funciones de hardware (Báscula, Escáner, Impresora)
  escucharPeticionDispositivos: (callback) => {
    // Escucha el evento emitido desde main.cjs cuando se solicita hardware
    ipcRenderer.on('mostrar-lista-dispositivos', (event, datos) => callback(datos));
  },
  confirmarDispositivo: (idDispositivo) => {
    // Envía la elección de vuelta a main.cjs
    ipcRenderer.invoke('confirmar-dispositivo', idDispositivo);
  },

  // Funciones de sincronización LAN
  obtenerIpLocal: () => ipcRenderer.invoke('obtener-ip-local'),
  iniciarServidorLAN: () => ipcRenderer.invoke('iniciar-servidor-lan'),
  emitirAEsclavos: (data) => ipcRenderer.invoke('emitir-a-esclavos', data),
  onAccionDeEsclavo: (callback) => {
    ipcRenderer.removeAllListeners('accion-de-esclavo'); // Evitar duplicados
    ipcRenderer.on('accion-de-esclavo', (event, data) => callback(data));
  }
});