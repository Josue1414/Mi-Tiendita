export function crearIdentificadorUnico(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function crearEnlaceAppAndroid(urlWeb: string): string {
  const url = new URL(urlWeb);
  if (url.protocol !== "http:" || !["4000", "4001"].includes(url.port)) {
    throw new Error("El enlace de la app debe apuntar a un servidor LAN válido.");
  }
  return `mitiendita://lan?url=${encodeURIComponent(url.toString())}`;
}

export function obtenerUrlLANDesdeEnlaceAndroid(enlace: string): URL | null {
  try {
    const recibido = new URL(enlace);
    const urlLAN = recibido.protocol === "mitiendita:"
      ? new URL(recibido.searchParams.get("url") || "")
      : recibido;
    if (urlLAN.protocol !== "http:" || !["4000", "4001"].includes(urlLAN.port)) return null;
    return urlLAN;
  } catch {
    return null;
  }
}
