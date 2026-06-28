import { readFileSync } from "node:fs";
import { join } from "node:path";

const ASSETS_ROOT = join(import.meta.dir, "../../assets");

const assetCache = new Map<string, string>();

export function loadReportAssetDataUri(
  assetName: string,
  mimeType: string,
): string {
  const cacheKey = `${assetName}:${mimeType}`;
  const cached = assetCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bytes = readFileSync(join(ASSETS_ROOT, assetName));
  const encoded = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${mimeType};base64,${encoded}`;
  assetCache.set(cacheKey, dataUri);
  return dataUri;
}

export function resolveLogoDataUri(assetName = "logo.svg"): string {
  return loadReportAssetDataUri(assetName, "image/svg+xml");
}
