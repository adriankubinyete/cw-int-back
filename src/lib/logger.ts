// src/lib/logger.ts
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "../config";

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Formato legível para desenvolvimento
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, context, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? `\n  ${JSON.stringify(meta, null, 2)}`
      : "";
    return `[${timestamp}] [${context ? context : "-"}] ${level}: ${message}${stack ? `\n${stack}` : ""}${metaStr}`;
  })
);

// Formato JSON para produção (ideal para Datadog, Loki, CloudWatch)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.nodeEnv === "development" ? devFormat : prodFormat,
  }),
];

// Em produção, rotaciona arquivos de log por dia
if (config.nodeEnv === "production") {
  transports.push(
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d", // mantém 14 dias
      format: prodFormat,
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      format: prodFormat,
    })
  );
}

export function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export const logger = winston.createLogger({
  level: config.logLevel ?? "info",
  transports,
  // Não encerra o processo em exceções não tratadas
  exitOnError: false,
});