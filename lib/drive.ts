// ============================================================
//  GOOGLE DRIVE UPLOADS (server-side)
//  Uploads base64 files into a folder owned by the service
//  account and returns a shareable link. The folder is created
//  once and its id cached. Reuses the same JWT auth as Sheets.
// ============================================================
import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error("Missing Google credentials.");
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

function driveClient() {
  return google.drive({ version: "v3", auth: getAuth() });
}

// Folder name in the service account's Drive. Override with env if desired.
const FOLDER_NAME = process.env.DRIVE_FOLDER_NAME || "CarwashPOS Uploads";
let _folderId: string | null = null;

async function ensureFolder(): Promise<string> {
  if (_folderId) return _folderId;
  const drive = driveClient();

  // If an explicit folder id is provided, use it (recommended for shared drives).
  if (process.env.DRIVE_FOLDER_ID) {
    _folderId = process.env.DRIVE_FOLDER_ID;
    return _folderId;
  }

  // Otherwise find or create a folder by name.
  const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
  const found = await drive.files.list({ q, fields: "files(id,name)" });
  if (found.data.files && found.data.files.length > 0) {
    _folderId = found.data.files[0].id!;
    return _folderId;
  }
  const created = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  _folderId = created.data.id!;
  return _folderId;
}

export interface UploadResult {
  id: string;
  link: string;
}

/**
 * Upload a base64 data URL or raw base64 string.
 * Returns a viewable link. Makes the file readable by anyone with the link
 * (needed so the app can display it without per-user Drive auth).
 */
export async function uploadFile(
  filename: string,
  base64: string,
  mimeType: string
): Promise<UploadResult> {
  const drive = driveClient();
  const folderId = await ensureFolder();

  // Strip data URL prefix if present.
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const buffer = Buffer.from(clean, "base64");

  const created = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });
  const id = created.data.id!;

  // Make link-viewable.
  await drive.permissions.create({
    fileId: id,
    requestBody: { role: "reader", type: "anyone" },
  });

  return { id, link: `https://drive.google.com/file/d/${id}/view` };
}
