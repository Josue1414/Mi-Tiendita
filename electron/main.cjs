// src/electron/main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SECRETO = 'MiTiendaSegura2026_ClaveMaestraV1';
const ENCRYPTION_KEY = crypto.scryptSync(SECRETO, 'sal', 32); 
const IV_LENGTH = 16;

function encriptar(texto) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encriptado = cipher.update(texto);
  encriptado = Buffer.concat([encriptado, cipher.final()]);
  return iv.toString('hex') + ':' + encriptado.toString('hex');
}

function desencriptar(texto) {
  try {
    const partes = texto.split(':');
    const iv = Buffer.from(partes.shift(), 'hex');
    const textoEncriptado = Buffer.from(partes.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let desencriptado = decipher.update(textoEncriptado);
    desencriptado = Buffer.concat([desencriptado, decipher.final()]);
    return desencriptado.toString();
  } catch (error) {
    console.error("Error al desencriptar:", error);
    return null;
  }
}

// 1. Generador de ID de Máquina Único
function obtenerHardwareIdLocal(userDataPath) {
  const hwidPath = path.join(userDataPath, 'hardware.key');
  if (fs.existsSync(hwidPath)) {
    return fs.readFileSync(hwidPath, 'utf8');
  }
  const newHwid = crypto.randomUUID();
  fs.writeFileSync(hwidPath, newHwid, 'utf8');
  return newHwid;
}

// 2. Validador de Suscripción Offline (Anti-Trampas)
function validarSuscripcionLocal(dbPath) {
  const saasPath = path.join(dbPath, 'saas_state.enc');
  if (!fs.existsSync(saasPath)) return { activo: false, error: 'No hay registro de pago local. Conéctate a internet para validar tu cuenta por primera vez.' };

  const data = desencriptar(fs.readFileSync(saasPath, 'utf8'));
  if (!data) return { activo: false, error: 'Archivo de seguridad corrupto.' };

  const estado = JSON.parse(data);
  const ahora = new Date().getTime();
  const ultimaVez = new Date(estado.ultimaFechaConocida).getTime();
  const vencimiento = new Date(estado.fechaVencimiento).getTime();

  // Si el reloj de la PC es menor a la última vez que se usó, alteraron el reloj de Windows.
  if (ahora < ultimaVez) {
    return { activo: false, error: 'Se detectó una alteración en el reloj de Windows. Conéctate a internet para sincronizar la seguridad.' };
  }

  // Actualizamos la última fecha conocida para evitar que regresen el tiempo
  estado.ultimaFechaConocida = new Date().toISOString();
  fs.writeFileSync(saasPath, encriptar(JSON.stringify(estado)), 'utf8');

  if (ahora > vencimiento) {
    return { activo: false, error: 'Tu suscripción mensual ha vencido. Realiza tu pago y conéctate a internet para renovar el acceso.' };
  }

  return { activo: true };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../public/logo mi tienda.jpeg'), // Ícono de la ventana
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'datos_seguros');

  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  // --- CONFIGURACIÓN DE HARDWARE (BÁSCULAS USB/SERIAL) ---
  app.on('web-contents-created', (event, webContents) => {
    webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
      event.preventDefault();
      if (portList && portList.length > 0) callback(portList[0].portId);
      else callback(''); 
    });
    webContents.session.setPermissionCheckHandler((webContents, permission) => permission === 'serial');
    webContents.session.setDevicePermissionHandler((details) => details.deviceType === 'serial');
  });

  // --- IMPRESIÓN SILENCIOSA ---
  ipcMain.handle('imprimir-silencioso', async (event, htmlContent) => {
    const winPrint = new BrowserWindow({ show: false }); // Ventana invisible
    await winPrint.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    winPrint.webContents.print({ silent: true, printBackground: true }, (success, errorType) => {
      if (!success) console.error("Fallo impresión silenciosa:", errorType);
      winPrint.close();
    });
    return true;
  });

  // --- COMUNICACIÓN DE BASE DE DATOS Y SAAS ---
  ipcMain.handle('guardar-datos', async (event, nombreTabla, datos) => {
    try {
      const archivoRuta = path.join(dbPath, `${nombreTabla}.enc`);
      fs.writeFileSync(archivoRuta, encriptar(JSON.stringify(datos)), 'utf8');
      return { exito: true };
    } catch (error) {
      return { exito: false, error: error.message };
    }
  });

  ipcMain.handle('leer-datos', async (event, nombreTabla) => {
    try {
      const archivoRuta = path.join(dbPath, `${nombreTabla}.enc`);
      if (!fs.existsSync(archivoRuta)) return [];
      const textoJSON = desencriptar(fs.readFileSync(archivoRuta, 'utf8'));
      return textoJSON ? JSON.parse(textoJSON) : [];
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('obtener-hardware-id', () => {
    return obtenerHardwareIdLocal(userDataPath);
  });

  ipcMain.handle('validar-suscripcion-offline', () => {
    return validarSuscripcionLocal(dbPath);
  });

  ipcMain.handle('sincronizar-reloj', (event, fechaVencimientoNube) => {
    try {
      const saasPath = path.join(dbPath, 'saas_state.enc');
      const estado = {
        ultimaFechaConocida: new Date().toISOString(),
        fechaVencimiento: fechaVencimientoNube
      };
      fs.writeFileSync(saasPath, encriptar(JSON.stringify(estado)), 'utf8');
      return { exito: true };
    } catch (error) {
      return { exito: false, error: error.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});