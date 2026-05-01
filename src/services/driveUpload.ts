import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { supabase } from "../db/supabase";

// Opens the native file picker. On selection, uploads the file to the shared
// invoice folder on Google Drive using the signed-in user's OAuth access
// token (drive.file scope). Returns the Drive webViewLink, or null if the
// user cancelled the picker. Throws on any error.
export async function pickAndUploadInvoice(
  eventName: string,
  eventDate: string,
): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.provider_token ?? "";
  if (!token) {
    throw new Error(
      "אין הרשאת גישה ל-Google Drive. התנתק והתחבר מחדש כדי לאשר את ההרשאה החדשה.",
    );
  }

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

  const url: string = await invoke("upload_invoice_to_drive", {
    filePath,
    displayName,
    accessToken: token,
  });
  return url;
}
