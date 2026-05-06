import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { withFreshProviderToken } from "./googleReauth";

// Opens the native file picker. On selection, uploads the file to the shared
// Drive folder using the signed-in user's OAuth access token (drive.file
// scope). Returns the Drive webViewLink, or null if the user cancelled.
// Throws on any error. Silently refreshes an expired Google token and
// retries once.
async function pickAndUploadToDrive(
  filenamePrefix: string,
  eventName: string,
  eventDate: string,
): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "קבצים",
        extensions: [
          "pdf",
          "png",
          "jpg",
          "jpeg",
          "heic",
          "webp",
          "doc",
          "docx",
          "xls",
          "xlsx",
        ],
      },
      { name: "כל הקבצים", extensions: ["*"] },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;

  const filePath = selected as string;
  const ext = (filePath.split(".").pop() ?? "bin").toLowerCase();
  const safe = (eventName || "event").replace(/[\\/:*?"<>|]/g, "_");
  const displayName = `${filenamePrefix}_${safe}_${eventDate}.${ext}`;

  return withFreshProviderToken(async (token) => {
    const url: string = await invoke("upload_invoice_to_drive", {
      filePath,
      displayName,
      accessToken: token,
    });
    return url;
  });
}

export function pickAndUploadInvoice(
  eventName: string,
  eventDate: string,
): Promise<string | null> {
  return pickAndUploadToDrive("חשבונית", eventName, eventDate);
}

export function pickAndUploadPaymentProof(
  eventName: string,
  eventDate: string,
): Promise<string | null> {
  return pickAndUploadToDrive("אישור_תשלום", eventName, eventDate);
}
