import ExcelJS from "exceljs";
import { BILL_TYPE_LABELS, type Expense } from "./types";
import { excelSerial } from "./utils";

export const DATE_FMT = "dd/mm/yyyy";
export const DATETIME_FMT = "dd/mm/yyyy h:mm AM/PM";
export const AMOUNT_FMT = "#,##0.00";

export const SHEET_NAME = "Expenses";

/** Column layout shared by the downloadable workbook and the live OneDrive sync. */
export const SHEET_COLUMNS = [
  { header: "Item Description", key: "item", width: 32 },
  { header: "Vendor Name", key: "vendor", width: 24 },
  { header: "Amount", key: "amount", width: 14 },
  { header: "Bill Type", key: "billType", width: 18 },
  { header: "Invoice Date", key: "invoiceDate", width: 15 },
  { header: "Invoice Number", key: "invoiceNo", width: 20 },
  { header: "Paid By", key: "paidBy", width: 28 },
  { header: "Bill", key: "bill", width: 18 },
  { header: "Status", key: "status", width: 14 },
  { header: "Reimbursed Date", key: "reimbursed", width: 17 },
  { header: "Submitted At", key: "submitted", width: 20 },
] as const;

/** Dates are real Excel dates (serial + explicit Indian format), so they never render US-style. */
export type SheetCell = string | number | { text: string; hyperlink: string } | { serial: number; fmt: string };

const dateCell = (v: string | null | undefined, fmt: string): SheetCell => (v ? { serial: excelSerial(v), fmt } : "");

/** Only approved + reimbursed rows go into the sheet, oldest first, plus a TOTAL row. */
export function sheetRows(expenses: Expense[]): { rows: SheetCell[][]; total: number | null } {
  const visible = expenses.filter((e) => e.status === "approved" || e.status === "reimbursed");
  const rows = visible.map((e): SheetCell[] => [
    e.item_desc,
    e.vendor_name,
    Number(e.amount),
    BILL_TYPE_LABELS[e.bill_type ?? "digital"] ?? "",
    dateCell(e.invoice_date, DATE_FMT),
    e.invoice_number ?? "",
    e.payer_name ? `${e.payer_name} (${e.payer_email ?? e.paid_by})` : e.payer_email ?? e.paid_by,
    e.bill_link ? { text: "Open bill", hyperlink: e.bill_link } : "",
    e.status,
    dateCell(e.reimbursed_at, DATETIME_FMT),
    dateCell(e.created_at, DATETIME_FMT),
  ]);
  return { rows, total: visible.length > 0 ? visible.reduce((s, e) => s + Number(e.amount), 0) : null };
}

export async function buildExpenseWorkbook(eventName: string, expenses: Expense[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CLC Finance";
  wb.title = eventName;
  const ws = wb.addWorksheet(SHEET_NAME);
  ws.columns = SHEET_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const header = ws.getRow(1);
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };

  const { rows, total } = sheetRows(expenses);
  for (const cells of rows) {
    const row = ws.addRow(cells.map((c) => (typeof c !== "object" ? c : "serial" in c ? c.serial : c.text)));
    cells.forEach((c, i) => {
      if (typeof c !== "object") return;
      const cell = row.getCell(i + 1);
      if ("serial" in c) {
        cell.numFmt = c.fmt;
      } else {
        cell.value = { text: c.text, hyperlink: c.hyperlink };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
    });
    row.getCell(3).numFmt = AMOUNT_FMT;
  }
  if (total !== null) {
    const totalRow = ws.addRow(["TOTAL", "", total]);
    totalRow.font = { bold: true };
    totalRow.getCell(3).numFmt = AMOUNT_FMT;
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: { row: 1, column: SHEET_COLUMNS.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
