// Sends an email with a PDF attachment via the Gmail REST API on behalf of
// the currently authenticated Google user. The `accessToken` must carry the
// https://www.googleapis.com/auth/gmail.send scope (requested at sign-in in
// LoginPage). Gmail fills in the From / Date / Message-ID headers itself.

function utf8HeaderEncode(value: string): string {
  const b64 = btoa(unescape(encodeURIComponent(value)));
  return `=?UTF-8?B?${b64}?=`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function breakIntoLines(b64: string, width = 76): string {
  const parts: string[] = [];
  for (let i = 0; i < b64.length; i += width) {
    parts.push(b64.slice(i, i + width));
  }
  return parts.join("\r\n");
}

function base64UrlFromString(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendMailViaGmail(args: {
  to: string;
  subject: string;
  body: string;
  pdfBytes: Uint8Array;
  pdfFilename: string;
  accessToken: string;
}): Promise<void> {
  const boundary = `_b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const encodedSubject = utf8HeaderEncode(args.subject);
  const encodedFilename = utf8HeaderEncode(args.pdfFilename);

  const bodyBase64 = breakIntoLines(
    bytesToBase64(new TextEncoder().encode(args.body)),
  );
  const pdfBase64 = breakIntoLines(bytesToBase64(args.pdfBytes));

  const mime =
    `MIME-Version: 1.0\r\n` +
    `To: ${args.to}\r\n` +
    `Subject: ${encodedSubject}\r\n` +
    `Content-Type: multipart/mixed; boundary="${boundary}"\r\n` +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `\r\n` +
    bodyBase64 +
    `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/pdf; name="${encodedFilename}"\r\n` +
    `Content-Disposition: attachment; filename="${encodedFilename}"\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `\r\n` +
    pdfBase64 +
    `\r\n` +
    `--${boundary}--`;

  const raw = base64UrlFromString(mime);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail send failed (${res.status}): ${text}`);
  }
}
