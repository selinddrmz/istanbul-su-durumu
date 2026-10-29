import { NextResponse } from "next/server";

const OFFICIAL_URL =
  "https://iskiapi.iski.istanbul/api/iski/baraj/sonOnDortGunDoluluk/v2";
const FALLBACK_URL =
  "https://www.dolulukorani.com/api/v1/provinces/istanbul";

async function readJson(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json", ...headers },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return response.json();
}

export async function GET() {
  // Try the official ISKI API first; use the documented public fallback if unreachable.
  try {
    const json = await readJson(OFFICIAL_URL, {
      Origin: "https://grafikgoster.iski.gov.tr",
      Referer: "https://grafikgoster.iski.gov.tr/baraj-doluluk/",
    });
    if (Array.isArray(json?.data) && json.data.length) {
      return NextResponse.json({
        ...json,
        sourceUrl: OFFICIAL_URL,
        sourceName: "İSKİ",
        sonGuncellemeZamani: json.sonGuncellemeZamani ?? json.data[json.data.length - 1]?.tarih ?? null,
      });
    }
  } catch (error) {
    console.warn("Official ISKI API unavailable; trying public fallback.", error);
  }

  try {
    const json = await readJson(FALLBACK_URL);
    const record = Array.isArray(json?.data)
      ? json.data.find((item: any) => item?.slug === "istanbul") ?? json.data[0]
      : json?.data ?? json;
    const rawRate = Number(record?.fill_rate);
    if (!Number.isFinite(rawRate)) {
      throw new Error("Fallback response did not contain a numeric fill_rate.");
    }
    return NextResponse.json({
      data: [{
        dolulukOrani: rawRate / 100,
        tarih: record?.measured_at ?? record?.date ?? null,
      }],
      sonGuncellemeZamani: record?.measured_at ?? null,
      sourceName: "dolulukorani.com (resmî kurum verilerinden derlenmiştir)",
      sourceUrl: FALLBACK_URL,
      attribution: json?.attribution ?? "Kaynak: dolulukorani.com (resmî kurum verilerinden derlenmiştir)",
      freshness: record?.freshness ?? "unknown",
    });
  } catch (error) {
    return NextResponse.json({
      error: "Güncel baraj verisi alınamadı",
      detail: error instanceof Error ? error.message : String(error),
      sourceUrl: FALLBACK_URL,
    }, { status: 502 });
  }
}
