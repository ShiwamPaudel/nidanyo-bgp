import "server-only";
import QRCode from "qrcode";

/** Generate a QR code as a data URL (PNG) for embedding in printable docs. */
export async function qrDataUrl(text: string, size = 128): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: { dark: "#0E1B14", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}
