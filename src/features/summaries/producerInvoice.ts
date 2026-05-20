import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type {
  EventSummaryRow,
  EventWithProducer,
  SummaryTicketRow,
} from "../../db/types";
import { OZEN_SOURCE, VAT_RATE, ozenCommission } from "./summariesRepo";
import { clubTicketShareOf, dealLabel } from "../events/dealCalc";
import invoiceLogoUrl from "../../assets/invoice-logo.png";
import invoiceTemplate from "./invoiceTemplate.html?raw";

const DAY_NAMES_HE = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

function formatDDMYY(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d}.${m}.${String(y).slice(2)}`;
}

function dayOfWeekHe(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  return DAY_NAMES_HE[dt.getDay()] ?? "";
}

function groupByPrice(rows: SummaryTicketRow[]): Array<[number, number]> {
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.price, (m.get(r.price) ?? 0) + r.quantity);
  return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
}

function rowCommission(t: SummaryTicketRow): number {
  return t.source === OZEN_SOURCE
    ? ozenCommission(t.price, t.quantity)
    : t.commission ?? 0;
}

function fmtMoney(n: number): string {
  return `${n.toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₪`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "",
  );
}

let logoDataUrlCache: string | null = null;

async function getLogoDataUrl(): Promise<string | null> {
  if (logoDataUrlCache) return logoDataUrlCache;
  try {
    const res = await fetch(invoiceLogoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error("logo read failed"));
      reader.readAsDataURL(blob);
    });
    if (!dataUrl.startsWith("data:image/")) return null;
    logoDataUrlCache = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

export function computeInvoice(
  event: EventWithProducer,
  summary: EventSummaryRow,
  tickets: SummaryTicketRow[],
) {
  const presale = tickets.filter((t) => t.kind === "presale");
  const boxOffice = tickets.filter((t) => t.kind === "box_office");

  const presaleSources = Array.from(
    new Set(presale.map((t) => t.source).filter((s) => !!s)),
  ).sort((a, b) => {
    if (a === OZEN_SOURCE) return -1;
    if (b === OZEN_SOURCE) return 1;
    return a.localeCompare(b, "he");
  });

  const presaleNetTotal = presale.reduce(
    (s, t) => s + t.price * t.quantity - rowCommission(t),
    0,
  );
  const boxRevenue = boxOffice.reduce((s, t) => s + t.price * t.quantity, 0);
  const ticketBase = presaleNetTotal + boxRevenue;

  const clubShare = clubTicketShareOf(event, ticketBase);
  const producerTicketShare =
    event.deal_type === "fit_price" ? ticketBase : ticketBase - clubShare;

  const campaignAmount = event.campaign_amount ?? 0;
  const clubCampaignPct = event.campaign ?? 0;
  const producerCampaign = campaignAmount * ((100 - clubCampaignPct) / 100);

  const acum = summary.acum ?? 0;
  const stereo = summary.stereo_record ?? 0;
  const channels = summary.channels_record ?? 0;
  const lightman = summary.lightman ?? 0;

  const producerNet =
    producerTicketShare -
    producerCampaign -
    acum -
    stereo -
    channels -
    lightman;
  const producerNetExVat = producerNet / (1 + VAT_RATE);

  return {
    presale,
    boxOffice,
    presaleSources,
    ticketBase,
    boxRevenue,
    clubShare,
    producerTicketShare,
    producerCampaign,
    acum,
    stereo,
    channels,
    lightman,
    producerNet,
    producerNetExVat,
  };
}

function renderPresaleBlocks(
  presale: SummaryTicketRow[],
  sources: string[],
): string {
  return sources
    .map((source) => {
      const sourceTickets = presale.filter((t) => t.source === source);
      if (sourceTickets.length === 0) return "";
      const tiers = groupByPrice(sourceTickets);
      const sourceRevenue = sourceTickets.reduce(
        (s, t) => s + t.price * t.quantity,
        0,
      );
      const sourceCommission = sourceTickets.reduce(
        (s, t) => s + rowCommission(t),
        0,
      );
      const sourceNet = sourceRevenue - sourceCommission;
      const isOzen = source === OZEN_SOURCE;
      const commissionLabel = isOzen
        ? 'עמלת מכירה באתר (6%)'
        : `עמלת ${escapeHtml(source)}`;
      const tierRows = tiers
        .map(
          ([price, qty]) =>
            `<tr>
               <td class="tier-label">${qty} כרטיסים × ${price.toLocaleString("he-IL")} ₪</td>
               <td class="amount">${fmtMoney(price * qty)}</td>
             </tr>`,
        )
        .join("");
      return `
        <div class="source-block">
          <div class="source-title">${escapeHtml(source)}</div>
          <table class="tier-table">
            <tbody>
              ${tierRows}
              <tr class="commission-row">
                <td>${commissionLabel}</td>
                <td class="amount neg">- ${fmtMoney(sourceCommission)}</td>
              </tr>
              <tr class="source-net-row">
                <td>סה"כ הכנסות מ${escapeHtml(source)}</td>
                <td class="amount">${fmtMoney(sourceNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    })
    .filter(Boolean)
    .join("");
}

function renderBoxBlock(
  boxOffice: SummaryTicketRow[],
  boxRevenue: number,
): string {
  const tiers = groupByPrice(boxOffice);
  if (tiers.length === 0) return "";
  return `
    <div class="source-block">
      <div class="source-title">מכירה בקופה</div>
      <table class="tier-table">
        <tbody>
          ${tiers
            .map(
              ([price, qty]) =>
                `<tr>
                   <td class="tier-label">${qty} כרטיסים × ${price.toLocaleString("he-IL")} ₪</td>
                   <td class="amount">${fmtMoney(price * qty)}</td>
                 </tr>`,
            )
            .join("")}
          <tr class="source-net-row">
            <td>סה"כ הכנסות בכניסה</td>
            <td class="amount">${fmtMoney(boxRevenue)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function renderDeductions(
  producerCampaign: number,
  acum: number,
  stereo: number,
  channels: number,
  lightman: number,
): string {
  const rows: Array<[string, number]> = [];
  if (producerCampaign > 0) rows.push(["חלק המפיק מהקמפיין", producerCampaign]);
  if (acum > 0) rows.push(['אקו"ם', acum]);
  if (stereo > 0) rows.push(["הקלטת סטריאו", stereo]);
  if (channels > 0) rows.push(["הקלטת ערוצים", channels]);
  if (lightman > 0) rows.push(["תאורן", lightman]);
  if (rows.length === 0) return "";
  return `
    <table class="totals-table">
      <tbody>
        <tr class="section-header-row">
          <td colspan="2">ניכויים</td>
        </tr>
        ${rows
          .map(
            ([label, amount]) =>
              `<tr>
                 <td>${label}</td>
                 <td class="amount neg">- ${fmtMoney(amount)}</td>
               </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function buildInvoiceHtml(
  event: EventWithProducer,
  summary: EventSummaryRow,
  tickets: SummaryTicketRow[],
  logoSrc: string | null,
): string {
  const i = computeInvoice(event, summary, tickets);

  const presaleBlocks =
    renderPresaleBlocks(i.presale, i.presaleSources) ||
    '<div class="empty">אין מכירה מוקדמת</div>';
  const boxBlock = renderBoxBlock(i.boxOffice, i.boxRevenue);
  const deductionsHtml = renderDeductions(
    i.producerCampaign,
    i.acum,
    i.stereo,
    i.channels,
    i.lightman,
  );

  return fillTemplate(invoiceTemplate, {
    LOGO: logoSrc ? `<img src="${logoSrc}" class="logo" alt="logo" />` : "",
    EVENT_NAME: escapeHtml(event.name ?? ""),
    DAY_OF_WEEK: dayOfWeekHe(event.date),
    DATE: formatDDMYY(event.date),
    PRODUCER_ROW: event.producer_name
      ? `<tr>
           <td class="meta-label">מפיק</td>
           <td class="meta-value" colspan="3">${escapeHtml(event.producer_name)}</td>
         </tr>`
      : "",
    PRESALE_BLOCKS: presaleBlocks,
    BOX_BLOCK: boxBlock,
    TICKET_BASE: fmtMoney(i.ticketBase),
    CLUB_SHARE_ROW:
      event.deal_type === "fit_price"
        ? ""
        : `<tr>
             <td>חלק המועדון (${escapeHtml(dealLabel(event))})</td>
             <td class="amount neg">- ${fmtMoney(i.clubShare)}</td>
           </tr>`,
    PRODUCER_TICKET_SHARE: fmtMoney(i.producerTicketShare),
    DEDUCTIONS_HTML: deductionsHtml,
    PRODUCER_NET: fmtMoney(i.producerNet),
    VAT_PCT: String(Math.round(VAT_RATE * 100)),
    PRODUCER_NET_EX_VAT: fmtMoney(i.producerNetExVat),
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }),
  );
}

export async function generateProducerInvoicePdf(
  event: EventWithProducer,
  summary: EventSummaryRow,
  tickets: SummaryTicketRow[],
): Promise<Uint8Array> {
  const logoSrc = await getLogoDataUrl();
  const html = buildInvoiceHtml(event, summary, tickets, logoSrc);

  const host = document.createElement("div");
  host.style.cssText =
    "position: fixed; inset: auto auto auto -99999px; top: 0; pointer-events: none;";
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const invoiceEl = host.querySelector(".invoice") as HTMLElement;
    if (!invoiceEl) throw new Error("template rendered without .invoice root");
    await waitForImages(invoiceEl);

    const canvas = await html2canvas(invoiceEl, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error(
        `canvas render produced invalid size ${canvas?.width}x${canvas?.height}`,
      );
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const scaledHeight = (canvas.height * pageWidth) / canvas.width;

    if (scaledHeight <= pageHeight) {
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, scaledHeight);
    } else {
      const pageHeightInCanvasPx = (pageHeight * canvas.width) / pageWidth;
      let yOffset = 0;
      let first = true;
      while (yOffset < canvas.height) {
        const sliceHeight = Math.min(
          pageHeightInCanvasPx,
          canvas.height - yOffset,
        );
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) throw new Error("canvas context failed");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, sliceHeight);
        ctx.drawImage(
          canvas,
          0,
          yOffset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );
        const sliceImg = sliceCanvas.toDataURL("image/jpeg", 0.95);
        const sliceHeightPt = (sliceHeight * pageWidth) / canvas.width;
        if (!first) pdf.addPage();
        pdf.addImage(sliceImg, "JPEG", 0, 0, pageWidth, sliceHeightPt);
        first = false;
        yOffset += sliceHeight;
      }
    }

    const buf = pdf.output("arraybuffer");
    return new Uint8Array(buf);
  } finally {
    document.body.removeChild(host);
  }
}

export async function downloadProducerInvoice(
  event: EventWithProducer,
  summary: EventSummaryRow,
  tickets: SummaryTicketRow[],
): Promise<void> {
  const bytes = await generateProducerInvoicePdf(event, summary, tickets);
  const safeName = (event.name ?? "event").replace(/[\\/:*?"<>|]/g, "_");
  const defaultPath = `סיכום_אירוע_${safeName}_${event.date}.pdf`;
  const path = await save({
    defaultPath,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;
  await invoke("write_file_bytes", {
    path,
    bytes: Array.from(bytes),
  });
}
