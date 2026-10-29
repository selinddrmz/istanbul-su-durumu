
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://iskiapi.iski.istanbul/api/iski/baraj/sonOnDortGunDoluluk/v2",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Origin: "https://grafikgoster.iski.gov.tr",
          Referer: "https://grafikgoster.iski.gov.tr/baraj-doluluk/",
        },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "İSKİ verisi alınamadı",
          status: response.status,
          detail: text.slice(0, 300),
        },
        { status: 502 }
      );
    }

    return new NextResponse(text, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "İSKİ sunucusuna bağlanılamadı",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
