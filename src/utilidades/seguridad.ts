// src/utilidades/seguridad.ts

// Obtenemos la clave del .env, o usamos un respaldo si no existe.
const CLAVE = import.meta.env.VITE_SECRETO_LOCAL || "clave-respaldo-offline";

export const cifrarPin = (pin: string): string => {
  if (!pin) return "";
  let resultado = "";
  for (let i = 0; i < pin.length; i++) {
    // Operación XOR simple con la clave
    resultado += String.fromCharCode(pin.charCodeAt(i) ^ CLAVE.charCodeAt(i % CLAVE.length));
  }
  // Convertimos a Base64 para que sea seguro de guardar como texto
  return btoa(resultado); 
};

export const descifrarPin = (pinCifrado: string): string => {
  if (!pinCifrado) return "";
  try {
    const decodificado = atob(pinCifrado);
    let resultado = "";
    for (let i = 0; i < decodificado.length; i++) {
      resultado += String.fromCharCode(decodificado.charCodeAt(i) ^ CLAVE.charCodeAt(i % CLAVE.length));
    }
    // Solo retornamos si parece un PIN válido (letras y números), sino asumimos que no estaba cifrado
    if (/^[A-Za-z0-9]+$/.test(resultado)) {
      return resultado;
    }
    return pinCifrado;
  } catch (e) {
    // Si falla el descifrado (ej. era un pin viejo guardado en texto plano), lo devolvemos tal cual
    return pinCifrado; 
  }
};