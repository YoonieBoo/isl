import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";

export type ParsedDataset = {
  columns: string[];
  rows: Record<string, string>[];
};

export async function parseDatasetFile(
  file: File,
): Promise<ParsedDataset> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv")) {
    return parseCsv(buffer.toString("utf-8"));
  }
  if (name.endsWith(".xlsx")) {
    return parseXlsx(buffer);
  }
  throw new Error("Unsupported file type — only .csv and .xlsx are accepted.");
}

function parseCsv(text: string): ParsedDataset {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const columns = result.meta.fields ?? [];
  const rows = result.data.filter((row) => row && Object.keys(row).length > 0);

  return { columns, rows };
}

async function parseXlsx(buffer: Buffer): Promise<ParsedDataset> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled .d.ts declares its own local `Buffer` shape that
  // doesn't structurally match @types/node's current `Buffer<ArrayBufferLike>`
  // — same value at runtime, so `any` here just bridges the typings mismatch
  // rather than papering over an actual type error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columns: [], rows: [] };

  const headerRow = worksheet.getRow(1);
  const columns: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    columns.push(String(cell.value ?? "").trim());
  });

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    columns.forEach((col, index) => {
      const cell = row.getCell(index + 1);
      const value = cell.value;
      const stringValue =
        value === null || value === undefined
          ? ""
          : typeof value === "object" && "text" in value
            ? String((value as { text: unknown }).text ?? "")
            : String(value);
      if (stringValue.trim() !== "") hasValue = true;
      record[col] = stringValue;
    });
    if (hasValue) rows.push(record);
  });

  return { columns, rows };
}
