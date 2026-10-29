import { NextResponse } from "next/server";

const OFFICIAL_URL = "https://iskiapi.iski.istanbul/api/iski/baraj/sonOnDortGunDoluluk/v2";
const FALLBACK_URL = "https://www.dolulukorani.com/api/v1/provinces/istanbul/history?days=30";

async function readJson(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0", ...headers },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
  return response.json();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export async function GET() {
  try {
    const json = await readJson(OFFICIAL_URL, {
      Origin: "https://grafikgoster.iski.gov.tr",
      Referer: "https://grafikgoster.iski.gov.tr/baraj-doluluk/",
    });
    if (Array.isArray(json?.data) && json.data.length) {
      return NextResponse.json({
        ...json,
        sourceName: "İSKİ",
        sourceUrl: OFFICIAL_URL,
        sonGuncellemeZamani: json.sonGuncellemeZamani ?? json.data[json.data.length - 1]?.tarih ?? null,
      });
    }
    throw new Error("İSKİ yanıtında veri kaydı bulunamadı.");
  } catch (officialError) {
    console.warn("Official ISKI endpoint unavailable; trying public fallback.");
  }

  try {
    const json = await readJson(FALLBACK_URL);
    const records = Array.isArray(json?.data) ? json.data : Array.isArray(json?.history) ? json.history : [];
    const latest = records.length ? records[records.length - 1] : null;
    if (!latest) throw new Error("Alternatif kaynakta kayıt bulunamadı.");

    const rawRate = asNumber(latest.fill_rate ?? latest.fillRate ?? latest.dolulukOrani ?? latest.doluluk_orani ?? latest.value ?? latest.rate);
    if (rawRate === null) throw new Error("Alternatif kaynağın doluluk alanı tanınamadı.");

    const fraction = rawRate > 1 ? rawRate / 100 : rawRate;
    const measuredAt = latest.measured_at ?? latest.measuredAt ?? latest.date ?? latest.tarih ?? latest.timestamp ?? null;
    return NextResponse.json({
      data: [{ dolulukOrani: fraction, tarih: measuredAt }],
      sonGuncellemeZamani: measuredAt,
      sourceName: json?.attribution?.source ?? "dolulukorani.com (resmî kurum verilerinden derlenmiştir)",
      sourceUrl: FALLBACK_URL,
      attribution: typeof json?.attribution === "string" ? json.attribution : "Kaynak: dolulukorani.com (resmî kurum verilerinden derlenmiştir).",
      freshness: latest.freshness ?? "Kaynağın ölçüm tarihine göre değerlendirilmelidir",
    });
  } catch (error) {
    return NextResponse.json({
      error: "Güncel baraj verisi alınamadı",
      detail: error instanceof Error ? error.message : String(error),
      sourceUrl: FALLBACK_URL,
    }, { status: 502 });
  }
}
