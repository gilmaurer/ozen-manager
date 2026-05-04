import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { withFreshProviderToken } from "./googleReauth";

// Opens the native file picker. On selection, uploads the file to the shared
// invoice folder on Google Drive using the signed-in user's OAuth access
// token (drive.file scope). Returns the Drive webViewLink, or null if the
// user cancelled the picker. Throws on any error.
//
// If the Drive call fails with 401 (expired Google token), transparently
// refreshes via silent re-auth and retries once.
export async function pickAndUploadInvoice(
  eventName: string,
  eventDate: string,
): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "חשבוניות",
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
  const displayName = `חשבונית_${safe}_${eventDate}.${ext}`;

  return withFreshProviderToken(async (token) => {
    const url: string = await invoke("upload_invoice_to_drive", {
      filePath,
      displayName,
      accessToken: token,
    });
    return url;
  });
}
