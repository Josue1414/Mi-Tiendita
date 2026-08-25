import * as XLSX from "xlsx";
import type { Producto } from "../tipos/producto";
import { generarCodigoEAN13 } from "../utilidades/codigoBarras";

const texto = (valor: unknown) => String(valor ?? "").trim();
const clave = (valor: unknown) => texto(valor)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");
const numero = (valor: unknown, predeterminado: number) => {
  const resultado = typeof valor === "number" ? valor : Number(texto(valor).replace(/[$,%\s]/g, "").replace(",", "."));
  return Number.isFinite(resultado) ? resultado : predeterminado;
};

const equivalencias: Record<string, string[]> = {
  nombre: ["nombre", "nombredelproducto", "producto", "descripcion", "articulo", "articulo"],
  codigo: ["codigobarras", "codigodebarras", "codigo", "barcode", "sku", "clave"],
  precio: ["precio", "precioventa", "preciodeventa", "venta", "preciounitario"],
  costo: ["costo", "costocompra", "preciocosto"],
  categoria: ["categoria", "familia", "rubro", "departamento"],
  stock: ["stock", "stockactual", "existencias", "existencia", "cantidad"],
  minimo: ["stockminimo", "minimo", "minimostock", "alerta"],
  unidad: ["unidad", "tipo", "presentacion"],
};

function buscarIndice(encabezados: string[], campo: keyof typeof equivalencias): number {
  const opciones = equivalencias[campo];
  return encabezados.findIndex((encabezado) => opciones.includes(encabezado) || opciones.some((opcion) => encabezado.includes(opcion)));
}

function extraerFilas(hoja: XLSX.WorkSheet): Record<string, unknown>[] {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "", raw: true });
  const limite = Math.min(matriz.length, 20);
  let filaEncabezados = -1;
  let indices: Record<string, number> = {};

  for (let indice = 0; indice < limite; indice += 1) {
    const encabezados = (matriz[indice] ?? []).map(clave);
    const indiceNombre = buscarIndice(encabezados, "nombre");
    const indicePrecio = buscarIndice(encabezados, "precio");
    if (indiceNombre >= 0 && indicePrecio >= 0) {
      filaEncabezados = indice;
      indices = {
        nombre: indiceNombre,
        codigo: buscarIndice(encabezados, "codigo"),
        precio: indicePrecio,
        costo: buscarIndice(encabezados, "costo"),
        categoria: buscarIndice(encabezados, "categoria"),
        stock: buscarIndice(encabezados, "stock"),
        minimo: buscarIndice(encabezados, "minimo"),
        unidad: buscarIndice(encabezados, "unidad"),
      };
      break;
    }
  }

  if (filaEncabezados < 0) return [];
  return matriz.slice(filaEncabezados + 1).map((fila) => {
    const valores = fila as unknown[];
    const obtener = (campo: string) => indices[campo] >= 0 ? valores[indices[campo]] : "";
    return {
      nombre: obtener("nombre"), codigo: obtener("codigo"), precio: obtener("precio"), costo: obtener("costo"),
      categoria: obtener("categoria"), stock: obtener("stock"), minimo: obtener("minimo"), unidad: obtener("unidad"),
    };
  });
}

export async function leerProductosExcel(archivo: File, existentes: Producto[]): Promise<Producto[]> {
  const contenido = await archivo.arrayBuffer();
  const libro = XLSX.read(contenido, { type: "array" });
  const filas = libro.SheetNames.flatMap((nombreHoja) => extraerFilas(libro.Sheets[nombreHoja]));
  const codigosExistentes = new Set(existentes.map((producto) => producto.codigo_barras.trim()).filter(Boolean));
  const importados: Producto[] = [];

  for (const fila of filas) {
    const nombre = texto(fila.nombre);
    let codigo = texto(fila.codigo);
    if (!nombre) continue;
    if (!codigo) {
      do codigo = generarCodigoEAN13(); while (codigosExistentes.has(codigo));
    }
    if (codigosExistentes.has(codigo)) continue;

    const unidadTexto = texto(fila.unidad).toUpperCase();
    const unidad: Producto["unidad"] = ["PIEZA", "KG", "LITRO", "PAQUETE"].includes(unidadTexto)
      ? unidadTexto as Producto["unidad"]
      : "PIEZA";
    const controlaStock = texto(fila.controla_stock ?? fila.controlaStock).toLowerCase() !== "false";
    const producto: Producto = {
      id: crypto.randomUUID(),
      nombre,
      codigo_barras: codigo,
      descripcion: "",
      categoria: texto(fila.categoria),
      ubicacion: "",
      paquete: "",
      stock_actual: controlaStock ? Math.max(0, numero(fila.stock, 0)) : 0,
      stock_minimo: controlaStock ? Math.max(0, numero(fila.minimo, 0)) : 0,
      controla_stock: controlaStock,
      unidad,
      precio: Math.max(0, numero(fila.precio, 0)),
      costo: Math.max(0, numero(fila.costo, 0)),
      descuento_porcentaje: 0,
      activo: true,
      imagen_url: undefined,
    };
    importados.push(producto);
    codigosExistentes.add(codigo);
  }

  return importados;
}
