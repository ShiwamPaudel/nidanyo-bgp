import "server-only";
import { toBuffer } from "bwip-js/node";

/**
 * Generate a Code 128 barcode as a PNG data URL for embedding in printable
 * docs (sample labels). Code 128 is the lab standard for 1D sample-ID barcodes:
 * compact, high-density, and readable by virtually every handheld scanner.
 */
export async function barcodeDataUrl(
  text: string,
  opts?: { height?: number; scale?: number; includetext?: boolean },
): Promise<string> {
  if (!text) return "";
  try {
    const png = await toBuffer({
      bcid: "code128",
      text,
      scale: opts?.scale ?? 3,
      height: opts?.height ?? 12, // millimetres
      includetext: opts?.includetext ?? true,
      textxalign: "center",
      textsize: 8,
      backgroundcolor: "FFFFFF",
    });
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return "";
  }
}
