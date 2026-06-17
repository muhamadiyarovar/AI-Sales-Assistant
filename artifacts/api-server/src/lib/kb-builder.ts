/**
 * Parses the RAG xlsx file and builds two KB formats:
 *   matchKb       — multi-entry string for the /api/match route (filter + display)
 *   negotiationKb — Record<programName, detailString> for the /api/negotiate route
 */
import XLSX from "xlsx";

// ── Column indices (0-based) ─────────────────────────────────────
const COL = {
  name:        1,   // Наименование
  keywords:    3,   // Ключевые слова
  description: 4,   // Описание
  hours:       5,   // Трудоемкость
  format:      6,   // Формат программы
  docType:     7,   // Тип программы (УПК, ДПП или сертификат)
  price:       8,   // Стоимость
  audience:    9,   // Целевая аудитория
  prereqs:     10,  // Входной портрет (пререквизиты)
  output:      11,  // Выходной портрет
  utp:         12,  // УТП
  objections:  13,  // Типовые возражения
  objHandling: 14,  // Отработка возражений
  curriculum:  15,  // Учебный план
  status:      16,  // Статус разработки
  features:    17,  // Особенности
  onepager:    18,  // ONE-PAGER
} as const;

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function oneLine(v: unknown): string {
  return str(v).replace(/\n+/g, " ");
}

/** Compute bucketed hours range label from a numeric value */
function hoursRange(raw: unknown): string {
  const n = Number(raw);
  if (!raw || isNaN(n) || n <= 0) return "";
  if (n <= 36)  return "до 36 ч";
  if (n <= 72)  return "от 37 до 72 ч";
  if (n <= 144) return "от 73 до 144 ч";
  if (n <= 254) return "от 145 до 254 ч";
  return "более 255 ч";
}

/** Format price cell → human-readable */
function priceText(raw: unknown): string {
  const n = Number(raw);
  if (!raw || isNaN(n) || n === 0) return "не указана";
  return `${n.toLocaleString("ru")} руб.`;
}

export interface BuiltKb {
  matchKb: string;
  negotiationKb: Record<string, string>;
  programCount: number;
}

export function buildKbFromBuffer(buf: Buffer): BuiltKb {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const matchEntries: string[] = [];
  const negotiationKb: Record<string, string> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const name = str(row[COL.name]);
    const desc = str(row[COL.description]);
    if (!name || !desc) continue; // skip empty/placeholder rows

    const hoursRaw = row[COL.hours];
    const hoursNum = Number(hoursRaw);
    const hoursLabel = isNaN(hoursNum) || hoursNum <= 0 ? "" : `${hoursNum} ч`;
    const range = hoursRange(hoursRaw);
    const price = priceText(row[COL.price]);
    const keywords  = str(row[COL.keywords]);
    const format    = str(row[COL.format]);
    const docType   = str(row[COL.docType]);
    const audience  = str(row[COL.audience]);
    const status    = str(row[COL.status]);
    const onepager  = str(row[COL.onepager]);

    // ── Match KB entry ──────────────────────────────────────────
    matchEntries.push(
      `---\n` +
      `Наименование: ${name}\n` +
      `Ключевые слова: ${keywords}\n` +
      `Описание: ${oneLine(desc)}\n` +
      `Трудоёмкость: ${hoursLabel}\n` +
      `Диапазон трудоёмкости: ${range}\n` +
      `Формат: ${format}\n` +
      `Тип документа: ${docType}\n` +
      `Целевая аудитория: ${oneLine(audience)}\n` +
      `Стоимость: ${price}\n` +
      `Статус: ${status}\n` +
      `ONE-PAGER: ${onepager}`
    );

    // ── Negotiation KB entry ────────────────────────────────────
    const prereqs    = str(row[COL.prereqs]);
    const outputPort = str(row[COL.output]);
    const utp        = str(row[COL.utp]);
    const objections = str(row[COL.objections]);
    const objHandling= str(row[COL.objHandling]);
    const curriculum = str(row[COL.curriculum]);
    const features   = str(row[COL.features]);

    negotiationKb[name] =
      `Наименование: ${name}\n` +
      `Трудоёмкость: ${hoursLabel}\n` +
      `Формат: ${format}\n` +
      `Тип программы: ${docType}\n` +
      `Стоимость: ${price}\n` +
      `Целевая аудитория: ${audience}\n` +
      `Входной портрет: ${prereqs}\n` +
      `Выходной портрет: ${outputPort}\n` +
      `УТП: ${utp}\n` +
      `Типовые возражения: ${objections}\n` +
      `Отработка возражений: ${objHandling}\n` +
      `Учебный план: ${curriculum}\n` +
      `Особенности: ${features}`;
  }

  return {
    matchKb: matchEntries.join("\n"),
    negotiationKb,
    programCount: matchEntries.length,
  };
}
