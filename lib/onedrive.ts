import { AMOUNT_FMT, buildExpenseWorkbook, SHEET_COLUMNS, SHEET_NAME, sheetRows, type SheetCell } from "./excel";
import type { Expense } from "./types";

const GRAPH = "https://graph.microsoft.com/v1.0";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function isOneDriveConfigured(): boolean {
  if (process.env.MOCK_ONEDRIVE === "true") return false;
  return Boolean(
    env("AZURE_CLIENT_ID") &&
      env("AZURE_CLIENT_SECRET") &&
      env("AZURE_TENANT_ID") &&
      env("ONEDRIVE_REFRESH_TOKEN")
  );
}

let cachedToken: { token: string; exp: number } | null = null;

export async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const tenant = env("AZURE_TENANT_ID")!;
  const params = new URLSearchParams({
    client_id: env("AZURE_CLIENT_ID")!,
    client_secret: env("AZURE_CLIENT_SECRET")!,
    refresh_token: env("ONEDRIVE_REFRESH_TOKEN")!,
    grant_type: "refresh_token",
    scope: "Files.ReadWrite offline_access",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph token refresh failed: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function gfetch(path: string, init?: RequestInit) {
  const token = await getGraphToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const t = await res.text();
    throw Object.assign(new Error(`Graph ${path} failed (${res.status}): ${t.slice(0, 300)}`), { status: res.status });
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json") || res.status !== 204) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, "-").trim().slice(0, 80) || "Event";
}

export interface EventDrive {
  folderId: string;
  billsFolderId: string;
  sheetItemId: string | null;
  sheetWebUrl: string | null;
}

export async function createEventDrive(eventName: string): Promise<EventDrive> {
  // Event folders live directly in "My files" (drive root), named after the event —
  // e.g. "Diwali 2025". Set ONEDRIVE_ROOT_FOLDER only to nest them inside a folder.
  const root = env("ONEDRIVE_ROOT_FOLDER")?.replace(/^\/+|\/+$/g, "");
  const parent = root ? `/me/drive/root:/${root.split("/").map(encodeURIComponent).join("/")}:` : "/me/drive/root";
  if (root) {
    // Create the parent folder if needed; 409 = already exists, which is fine.
    await gfetch(`/me/drive/root/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: root, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
    }).catch(() => null);
  }
  // "rename" never touches an existing folder with the same name: OneDrive adds " 1".
  const rootChildren = await gfetch(`${parent}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: safeName(eventName),
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });
  const folderId: string = rootChildren.id;

  const bills = await gfetch(`/me/drive/items/${folderId}/children`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "bills", folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
  }).catch(async () => {
    // bills folder may already exist; look it up
    const existing = await gfetch(
      `/me/drive/items/${folderId}/children?$filter=name eq 'bills'`
    );
    return existing?.value?.[0];
  });

  // Create an empty workbook; rows are synced by full re-upload on every approval.
  const empty = await buildExpenseWorkbook(eventName, []);
  const uploaded = await uploadBuffer(folderId, "ExpenseSheet.xlsx", empty, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  return {
    folderId,
    billsFolderId: bills.id,
    sheetItemId: uploaded.id,
    sheetWebUrl: uploaded.webUrl ?? null,
  };
}

export async function uploadBuffer(
  folderId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ id: string; webUrl: string | null }> {
  const token = await getGraphToken();
  const res = await fetch(
    `${GRAPH}/me/drive/items/${folderId}:/${encodeURIComponent(filename)}:/content`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType }, body: buffer as unknown as BodyInit }
  );
  if (!res.ok) {
    const t = await res.text();
    throw Object.assign(new Error(`Graph upload failed (${res.status}): ${t.slice(0, 300)}`), { status: res.status });
  }
  const data = await res.json();
  return { id: data.id, webUrl: data.webUrl ?? null };
}

export async function createViewLink(driveItemId: string): Promise<string | null> {
  const data = await gfetch(`/me/drive/items/${driveItemId}/createLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "view", scope: "organization" }),
  }).catch(() => null);
  return data?.link?.webUrl ?? null;
}

export async function uploadBill(
  billsFolderId: string,
  expenseId: string,
  originalName: string,
  buffer: Buffer,
  contentType: string
): Promise<{ itemId: string; link: string | null }> {
  const clean = originalName.replace(/[\\/:*?"<>|#%&{}$!'@+=`~]/g, "-").slice(0, 100) || "bill";
  const filename = `${expenseId}_${clean}`;
  const up = await uploadBuffer(billsFolderId, filename, buffer, contentType);
  const link = await createViewLink(up.id);
  return { itemId: up.id, link: link ?? up.webUrl };
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function colLetter(n: number): string {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Cell → Excel API "formulas" entry. User text can't start a formula (no =, +, -, @ injection). */
function toFormula(c: SheetCell): string | number {
  if (typeof c === "number") return c;
  if (typeof c === "object" && "serial" in c) return c.serial;
  if (typeof c === "object") return `=HYPERLINK("${c.hyperlink.replace(/"/g, '""')}","${c.text.replace(/"/g, '""')}")`;
  return /^[=+\-@]/.test(c) ? `'${c}` : c;
}

/**
 * Rewrite the sheet's rows in place through the Excel API. Unlike re-uploading the
 * file, this works while someone has ExpenseSheet.xlsx open in Excel Online
 * (a full upload gets 423 Locked then — which silently broke syncing).
 */
async function writeSheetInPlace(sheetItemId: string, expenses: Expense[]): Promise<void> {
  const base = `/me/drive/items/${sheetItemId}/workbook`;
  const session = await gfetch(`${base}/createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persistChanges: true }),
  });
  const h = { "Content-Type": "application/json", "workbook-session-id": session.id as string };
  const ws = `${base}/worksheets('${SHEET_NAME}')`;
  const lastCol = colLetter(SHEET_COLUMNS.length);
  try {
    const used = await gfetch(`${ws}/usedRange(valuesOnly=false)?$select=rowCount,columnCount`, { headers: h });
    const usedRows = Math.max(Number(used?.rowCount ?? 1), 1);
    const usedCols = Math.max(Number(used?.columnCount ?? 1), SHEET_COLUMNS.length);
    if (usedRows > 1) {
      await gfetch(`${ws}/range(address='A2:${colLetter(usedCols)}${usedRows}')/clear`, {
        method: "POST", headers: h, body: JSON.stringify({ applyTo: "All" }),
      });
    }

    // Header (also upgrades older sheets that don't have newer columns yet).
    await gfetch(`${ws}/range(address='A1:${lastCol}1')`, {
      method: "PATCH", headers: h,
      body: JSON.stringify({ values: [SHEET_COLUMNS.map((c) => c.header)] }),
    });
    await gfetch(`${ws}/range(address='A1:${lastCol}1')/format/font`, {
      method: "PATCH", headers: h, body: JSON.stringify({ bold: true, color: "#FFFFFF" }),
    });
    await gfetch(`${ws}/range(address='A1:${lastCol}1')/format/fill`, {
      method: "PATCH", headers: h, body: JSON.stringify({ color: "#1F2937" }),
    });

    const { rows, total } = sheetRows(expenses);
    const all = rows.map((r) => r.map(toFormula));
    // Per-cell formats: amounts, Indian-format dates, everything else General.
    const fmts = rows.map((r) => r.map((c, i) => (i === 2 ? AMOUNT_FMT : typeof c === "object" && "serial" in c ? c.fmt : "General")));
    if (total !== null) {
      all.push(["TOTAL", "", total, ...Array(SHEET_COLUMNS.length - 3).fill("")]);
      fmts.push(SHEET_COLUMNS.map((_, i) => (i === 2 ? AMOUNT_FMT : "General")));
    }
    if (all.length > 0) {
      const end = all.length + 1;
      await gfetch(`${ws}/range(address='A2:${lastCol}${end}')`, {
        method: "PATCH", headers: h, body: JSON.stringify({ formulas: all }),
      });
      await gfetch(`${ws}/range(address='A2:${lastCol}${end}')`, {
        method: "PATCH", headers: h, body: JSON.stringify({ numberFormat: fmts }),
      });
      if (total !== null) {
        await gfetch(`${ws}/range(address='A${end}:${lastCol}${end}')/format/font`, {
          method: "PATCH", headers: h, body: JSON.stringify({ bold: true }),
        });
      }
    }
  } finally {
    await gfetch(`${base}/closeSession`, { method: "POST", headers: h }).catch(() => null);
  }
}

/**
 * Bring the event's live sheet up to date. Edits the existing workbook in place;
 * falls back to uploading a fresh file only if there's no sheet yet or it was deleted.
 */
export async function syncSheetToOneDrive(
  folderId: string,
  sheetItemId: string | null,
  eventName: string,
  expenses: Expense[]
): Promise<{ sheetItemId: string | null; sheetWebUrl: string | null }> {
  if (sheetItemId) {
    try {
      await writeSheetInPlace(sheetItemId, expenses);
      const item = await gfetch(`/me/drive/items/${sheetItemId}?$select=id,webUrl`);
      return { sheetItemId: item.id, sheetWebUrl: item.webUrl ?? null };
    } catch (e) {
      // 404 = the sheet was deleted/moved → recreate below. Anything else is a real failure.
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
  const up = await uploadBuffer(folderId, "ExpenseSheet.xlsx", await buildExpenseWorkbook(eventName, expenses), XLSX);
  return { sheetItemId: up.id, sheetWebUrl: up.webUrl };
}

export async function deleteDriveItem(itemId: string): Promise<void> {
  const token = await getGraphToken();
  await fetch(`${GRAPH}/me/drive/items/${itemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
}
