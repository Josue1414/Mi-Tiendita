import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "../../utilidades/utils";

interface PartesFecha {
  dia: string;
  mes: string;
  anio: string;
}

interface PropsCampoFecha {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "default" | "large";
  maxYear?: number;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-label"?: string;
}

function fechaValida(dia: string, mes: string, anio: string, maxYear?: number): boolean {
  if (dia.length !== 2 || mes.length !== 2 || anio.length !== 4) return false;
  const diaNumero = Number(dia);
  const mesNumero = Number(mes);
  const anioNumero = Number(anio);
  if (anioNumero < 1 || (maxYear !== undefined && anioNumero > maxYear) || mesNumero < 1 || mesNumero > 12) return false;
  const esBisiesto = anioNumero % 4 === 0 && (anioNumero % 100 !== 0 || anioNumero % 400 === 0);
  const diasPorMes = [31, esBisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const diasDelMes = diasPorMes[mesNumero - 1];
  return diaNumero >= 1 && diaNumero <= diasDelMes;
}

function partesDesdeValor(value: string): PartesFecha {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return coincidencia
    ? { dia: coincidencia[3], mes: coincidencia[2], anio: coincidencia[1] }
    : { dia: "", mes: "", anio: "" };
}

export default function CampoFecha({
  value,
  onChange,
  className,
  size = "default",
  maxYear,
  disabled = false,
  readOnly = false,
  "aria-label": ariaLabel = "Fecha",
}: PropsCampoFecha) {
  const [partes, setPartes] = useState<PartesFecha>(() => partesDesdeValor(value));
  const ultimoValorEmitido = useRef<string | null>(null);
  const inputCalendarioRef = useRef<HTMLInputElement>(null);
  const bloqueado = disabled || readOnly;

  useEffect(() => {
    if (ultimoValorEmitido.current === value) {
      ultimoValorEmitido.current = null;
      return;
    }
    setPartes(partesDesdeValor(value));
  }, [value]);

  const actualizarParte = (parte: keyof PartesFecha, entrada: string) => {
    const maximo = parte === "anio" ? 4 : 2;
    let valorNumerico = entrada.replace(/\D/g, "").slice(0, maximo);
    const limite = parte === "dia" ? 31 : parte === "mes" ? 12 : maxYear;
    if (limite !== undefined && valorNumerico.length === maximo && Number(valorNumerico) > limite) {
      valorNumerico = String(limite).padStart(maximo, "0");
    }
    const nuevasPartes = { ...partes, [parte]: valorNumerico };
    setPartes(nuevasPartes);

    const nuevaFecha = fechaValida(nuevasPartes.dia, nuevasPartes.mes, nuevasPartes.anio, maxYear)
      ? `${nuevasPartes.anio}-${nuevasPartes.mes}-${nuevasPartes.dia}`
      : "";
    ultimoValorEmitido.current = nuevaFecha;
    onChange(nuevaFecha);
  };

  const finalizarParte = (parte: "dia" | "mes") => {
    const valor = partes[parte];
    if (valor.length !== 1) return;
    const nuevasPartes = { ...partes, [parte]: valor.padStart(2, "0") };
    setPartes(nuevasPartes);
    const nuevaFecha = fechaValida(nuevasPartes.dia, nuevasPartes.mes, nuevasPartes.anio, maxYear)
      ? `${nuevasPartes.anio}-${nuevasPartes.mes}-${nuevasPartes.dia}`
      : "";
    ultimoValorEmitido.current = nuevaFecha;
    onChange(nuevaFecha);
  };

  const actualizarDesdeCalendario = (nuevaFecha: string) => {
    const nuevasPartes = partesDesdeValor(nuevaFecha);
    if (nuevaFecha && !fechaValida(nuevasPartes.dia, nuevasPartes.mes, nuevasPartes.anio, maxYear)) return;
    setPartes(nuevasPartes);
    ultimoValorEmitido.current = nuevaFecha;
    onChange(nuevaFecha);
  };

  return (
    <div className={cn(
      "inline-flex min-w-0 items-center border border-slate-200 bg-slate-50 text-slate-800 focus-within:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100",
      size === "large" ? "h-11 gap-2 rounded-xl px-3 text-base" : "h-9 gap-1 rounded-lg px-2 text-sm",
      className,
      bloqueado && "cursor-not-allowed opacity-60"
    )}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        aria-label={`${ariaLabel}, día`}
        placeholder="DD"
        value={partes.dia}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(evento) => actualizarParte("dia", evento.target.value)}
        onBlur={() => finalizarParte("dia")}
        className={cn("shrink-0 bg-transparent text-center outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", size === "large" ? "w-[3ch]" : "w-[2ch]")}
      />
      <span aria-hidden="true" className="text-slate-400">/</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        aria-label={`${ariaLabel}, mes`}
        placeholder="MM"
        value={partes.mes}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(evento) => actualizarParte("mes", evento.target.value)}
        onBlur={() => finalizarParte("mes")}
        className={cn("shrink-0 bg-transparent text-center outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", size === "large" ? "w-[3ch]" : "w-[2ch]")}
      />
      <span aria-hidden="true" className="text-slate-400">/</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        aria-label={`${ariaLabel}, año`}
        placeholder="AAAA"
        value={partes.anio}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(evento) => actualizarParte("anio", evento.target.value)}
        className={cn("shrink-0 bg-transparent text-center outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500", size === "large" ? "w-[5ch]" : "w-[4ch]")}
      />
      <span className={cn(
        "relative ml-1 inline-flex shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-emerald-300",
        size === "large" ? "h-9 w-9" : "h-7 w-7"
      )}>
        <CalendarDays size={size === "large" ? 19 : 16} aria-hidden="true" />
        <input
          ref={inputCalendarioRef}
          type="date"
          value={value}
          onChange={(evento) => actualizarDesdeCalendario(evento.target.value)}
          disabled={bloqueado}
          max={maxYear !== undefined ? `${maxYear}-12-31` : undefined}
          aria-label={`Elegir ${ariaLabel} con el calendario`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
    </div>
  );
}
