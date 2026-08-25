const EAN_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const EAN_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const EAN_R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];
const EAN_PARIDAD = [
  "LLLLLL", "LLGLGG", "LGGLLG", "LGGLGL", "GLLGGL",
  "GGLLGL", "GGLGLL", "GLGLGL", "GLGLLG", "GLLGLG",
];

const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

export function digitoControlEAN13(doceDigitos: string): string {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(doceDigitos[i]);
    suma += i % 2 === 0 ? n : n * 3;
  }
  return String((10 - (suma % 10)) % 10);
}

export function generarCodigoEAN13(): string {
  const cuerpo = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
  const doce = `2${cuerpo}`;
  return doce + digitoControlEAN13(doce);
}

export function generarCodigoCorto(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function generarCodigoNumerico(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function esEAN13(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  return digitoControlEAN13(codigo.slice(0, 12)) === codigo[12];
}

function bitsEAN13(codigo: string): string {
  const primero = Number(codigo[0]);
  const paridad = EAN_PARIDAD[primero];
  let bits = "101";
  for (let i = 0; i < 6; i++) {
    const d = Number(codigo[i + 1]);
    bits += paridad[i] === "L" ? EAN_L[d] : EAN_G[d];
  }
  bits += "01010";
  for (let i = 7; i < 13; i++) {
    bits += EAN_R[Number(codigo[i])];
  }
  bits += "101";
  return bits;
}

function svgDesdeBits(bits: string, texto: string): string {
  const modulo = 2;
  const quiet = 10;
  const alto = 70;
  const ancho = (bits.length + quiet * 2) * modulo;
  const rects: string[] = [];
  let x = quiet * modulo;
  for (const bit of bits) {
    if (bit === "1") {
      rects.push(`<rect x="${x}" y="0" width="${modulo}" height="${alto}" fill="#0f172a"/>`);
    }
    x += modulo;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto + 22}" viewBox="0 0 ${ancho} ${alto + 22}" role="img" aria-label="${texto}">
    ${rects.join("")}
    <text x="${ancho / 2}" y="${alto + 16}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" fill="#0f172a">${texto}</text>
  </svg>`;
}

function svgCode128(texto: string): string {
  const valores = [104];
  for (const char of texto) {
    const valor = char.charCodeAt(0) - 32;
    if (valor < 0 || valor > 94) {
      throw new Error("Carácter no soportado en Code 128");
    }
    valores.push(valor);
  }
  let checksum = 104;
  valores.slice(1).forEach((valor, i) => {
    checksum += valor * (i + 1);
  });
  valores.push(checksum % 103);
  valores.push(106);

  const modulo = 2;
  const quiet = 10;
  const alto = 70;
  let x = quiet * modulo;
  const rects: string[] = [];
  let totalModulos = quiet * 2;

  for (const valor of valores) {
    const patron = CODE128[valor];
    let negro = true;
    for (const anchoChar of patron) {
      const w = Number(anchoChar) * modulo;
      if (negro) {
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${alto}" fill="#0f172a"/>`);
      }
      x += w;
      totalModulos += Number(anchoChar);
      negro = !negro;
    }
  }

  const ancho = (totalModulos) * modulo;
  const seguro = texto.replace(/[<>&"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto + 22}" viewBox="0 0 ${ancho} ${alto + 22}" role="img" aria-label="${seguro}">
    ${rects.join("")}
    <text x="${ancho / 2}" y="${alto + 16}" text-anchor="middle" font-family="ui-monospace, monospace" font-size="12" fill="#0f172a">${seguro}</text>
  </svg>`;
}

export function svgCodigoBarras(codigo: string): string {
  const limpio = codigo.trim();
  if (!limpio) return "";
  if (esEAN13(limpio)) return svgDesdeBits(bitsEAN13(limpio), limpio);
  try {
    return svgCode128(limpio);
  } catch {
    const ascii = limpio.replace(/[^\x20-\x7E]/g, "");
    return ascii ? svgCode128(ascii) : "";
  }
}

export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function imprimirEtiqueta(opciones: {
  nombre: string;
  codigo: string;
  precio: number;
}): void {
  const svg = svgCodigoBarras(opciones.codigo);
  if (!svg) {
    alert("No se pudo generar el código de barras. Revisa el código del producto.");
    return;
  }

  const ventana = window.open("", "_blank", "width=420,height=520");
  if (!ventana) {
    alert("Permite ventanas emergentes para imprimir la etiqueta.");
    return;
  }

  ventana.document.write(`<!doctype html>
<html>
  <head>
    <title>Etiqueta ${escapeHtml(opciones.codigo)}</title>
    <style>
      @page { margin: 8mm; size: auto; }
      body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
      .etiqueta { width: 280px; margin: 0 auto; text-align: center; border: 1px dashed #cbd5e1; padding: 12px; }
      h1 { font-size: 14px; margin: 0 0 8px; line-height: 1.3; }
      .precio { font-size: 18px; font-weight: 700; margin: 8px 0 0; }
      svg { max-width: 100%; height: auto; }
      @media print { .etiqueta { border: none; } }
    </style>
  </head>
  <body>
    <div class="etiqueta">
      <h1>${escapeHtml(opciones.nombre)}</h1>
      ${svg}
      <p class="precio">$${opciones.precio.toFixed(2)}</p>
    </div>
    <script>window.onload = () => { window.focus(); window.print(); };</script>
  </body>
</html>`);
  ventana.document.close();
}
