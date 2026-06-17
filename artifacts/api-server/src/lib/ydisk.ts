/**
 * Yandex Disk public-link file downloader.
 * No OAuth required — works with any publicly shared folder/file.
 */

const PUBLIC_KEY =
  process.env["YANDEX_DISK_PUBLIC_URL"] ??
  "https://disk.360.yandex.ru/d/SggBxadcoJIJ8g";

const FILE_NAME =
  process.env["YANDEX_DISK_KB_FILE"] ??
  "RAG по продуктам ТЕКУЩИЕ.xlsx";

const API_BASE = "https://cloud-api.yandex.net/v1/disk/public/resources/download";

/**
 * Download the KB xlsx file from the Yandex Disk public folder.
 * Returns a Buffer ready to be parsed by the kb-builder.
 */
export async function downloadKbFile(): Promise<Buffer> {
  const params = new URLSearchParams({
    public_key: PUBLIC_KEY,
    path: `/${FILE_NAME}`,
  });

  // Step 1: resolve the temporary download URL
  const metaResp = await fetch(`${API_BASE}?${params.toString()}`);
  if (!metaResp.ok) {
    const body = await metaResp.text();
    throw new Error(
      `Yandex Disk API error ${metaResp.status}: ${body.slice(0, 200)}`
    );
  }
  const { href } = (await metaResp.json()) as { href?: string };
  if (!href) throw new Error("Yandex Disk API returned no download href");

  // Step 2: download the actual file bytes
  const fileResp = await fetch(href);
  if (!fileResp.ok) {
    throw new Error(`File download error ${fileResp.status}: ${fileResp.statusText}`);
  }
  const arrayBuffer = await fileResp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
