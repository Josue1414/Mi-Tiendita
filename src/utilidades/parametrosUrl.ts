export function obtenerParametrosUrlActual(): URLSearchParams {
  const parametros = new URLSearchParams(window.location.search);
  const indiceParametrosHash = window.location.hash.indexOf("?");

  if (indiceParametrosHash === -1) return parametros;

  const parametrosHash = new URLSearchParams(window.location.hash.slice(indiceParametrosHash + 1));
  for (const [clave, valor] of parametrosHash) {
    if (!parametros.has(clave)) parametros.append(clave, valor);
  }

  return parametros;
}
