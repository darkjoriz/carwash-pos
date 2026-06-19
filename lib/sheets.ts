// ============================================================
//  GOOGLE SHEETS BACKEND CLIENT
//  Uses a service account. Each "tab" in the spreadsheet is a
//  table. Row 1 is the header row; we map headers -> objects.
// ============================================================
import { google, sheets_v4 } from "googleapis";
import { TABS, type TabName } from "./tabs";

export { TABS };
export type { TabName };

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];


let _client: sheets_v4.Sheets | null = null;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars."
    );
  }
  // Vercel stores newlines escaped; restore them.
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

export function sheetsClient(): sheets_v4.Sheets {
  if (_client) return _client;
  _client = google.sheets({ version: "v4", auth: getAuth() });
  return _client;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEET_ID env var.");
  return id;
}

/** Read all rows of a tab as objects keyed by the header row. */
export async function readTable<T = Record<string, string>>(
  tab: TabName
): Promise<T[]> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:Z10000`,
  });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] != null ? String(row[i]) : "";
    });
    return obj as T;
  });
}

/** Append a single row built from an object, ordered by the tab header. */
export async function appendRow(
  tab: TabName,
  record: Record<string, string | number>
): Promise<void> {
  const sheets = sheetsClient();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:Z1`,
  });
  const headers = (headerRes.data.values?.[0] ?? []).map((h) => String(h).trim());
  const row = headers.map((h) => {
    const v = record[h];
    return v == null ? "" : String(v);
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

/** Find the 1-based sheet row index for a record by its id column. */
async function findRowIndexById(tab: TabName, id: string): Promise<number> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:A10000`,
  });
  const col = res.data.values ?? [];
  // header is row 1; data starts row 2
  for (let i = 1; i < col.length; i++) {
    if (String(col[i]?.[0]).trim() === id) return i + 1;
  }
  return -1;
}

/** Update an existing row (matched by id in column A). */
export async function updateRowById(
  tab: TabName,
  id: string,
  record: Record<string, string | number>
): Promise<boolean> {
  const sheets = sheetsClient();
  const rowIndex = await findRowIndexById(tab, id);
  if (rowIndex === -1) return false;
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:Z1`,
  });
  const headers = (headerRes.data.values?.[0] ?? []).map((h) => String(h).trim());
  const row = headers.map((h) => {
    const v = record[h];
    return v == null ? "" : String(v);
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
  return true;
}

/** Delete a row by id (clears its contents — simple + safe for this app). */
export async function deleteRowById(tab: TabName, id: string): Promise<boolean> {
  const sheets = sheetsClient();
  const rowIndex = await findRowIndexById(tab, id);
  if (rowIndex === -1) return false;
  // Get the sheetId (gid) for this tab to do a real row delete.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId() });
  const sheet = (meta.data.sheets ?? []).find((s) => s.properties?.title === tab);
  const gid = sheet?.properties?.sheetId;
  if (gid == null) return false;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId: gid, dimension: "ROWS", startIndex: rowIndex - 1, endIndex: rowIndex },
          },
        },
      ],
    },
  });
  return true;
}

/** Settings tab: set a key's value, updating if present else appending. */
export async function setKeyValue(tab: TabName, key: string, value: string): Promise<void> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1:B10000`,
  });
  const rows = res.data.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[0]).trim() === key) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId(),
        range: `${tab}!A${i + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[key, value]] },
      });
      return;
    }
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[key, value]] },
  });
}
