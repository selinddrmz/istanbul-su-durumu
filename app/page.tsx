"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const DeferredChartView = dynamic(() => import("./ChartView"), {
  ssr: false,
  loading: () => <div className="h-full min-h-56 animate-pulse rounded-lg bg-stone-100" aria-label="Grafik yükleniyor" />,
});

type RowData = { _id?: number; Tarih: string; [key: string]: string | number | undefined };
const reservoirs = ["Omerli","Darlik","Elmali","Terkos","Alibey","Buyukcekmece","Sazlidere","Kazandere","Pabucdere","Istrancalar"];
const names: Record<string,string> = {
  Omerli:"Ömerli", Darlik:"Darlık", Elmali:"Elmalı", Terkos:"Terkos", Alibey:"Alibey",
  Buyukcekmece:"Büyükçekmece", Sazlidere:"Sazlıdere", Kazandere:"Kazandere",
  Pabucdere:"Pabuçdere", Istrancalar:"Istrancalar"
};
const sourceUrl = "https://data.ibb.gov.tr/dataset/istanbul-barajlari-gunluk-doluluk-oranlari";
const pct = (n:number) => `${(n*100).toLocaleString("tr-TR",{maximumFractionDigits:1})}%`;
const dateText = (s:string) => { const d=new Date(s); return Number.isNaN(+d)?s:d.toLocaleDateString("tr-TR"); };
const mean = (xs:number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
const sd = (xs:number[]) => xs.length>1 ? Math.sqrt(xs.reduce((a,x)=>a+(x-mean(xs))**2,0)/(xs.length-1)) : .05;

export default function Home() {
  const [rows,setRows] = useState<RowData[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [reservoir,setReservoir] = useState("Omerli");
  const [startYear,setStartYear] = useState("2000");
  const [endYear,setEndYear] = useState("2024");
  const [search,setSearch] = useState("");
  const [tableSearch,setTableSearch] = useState("");
  const [minRate,setMinRate] = useState("");
  const [maxRate,setMaxRate] = useState("");
  const [sortKey,setSortKey] = useState("Tarih");
  const [ascending,setAscending] = useState(false);
  const [showChartTable,setShowChartTable] = useState(false);
  const [showMonthlyTable,setShowMonthlyTable] = useState(false);
  const [showForecastTable,setShowForecastTable] = useState(false);
  const [showSameDayTable,setShowSameDayTable] = useState(false);
  const [loadedAt,setLoadedAt] = useState("");

  useEffect(() => {
    let alive=true;
    (async()=>{
      try {
        const res=await fetch("/baraj-doluluk.json");
        if(!res.ok) throw new Error("Veri dosyası okunamadı.");
        const json=await res.json();
        if(!Array.isArray(json.fields)||!Array.isArray(json.records)) throw new Error("JSON yapısı beklenenden farklı.");
        const fields=json.fields.map((f:{id:string})=>f.id);
        const parsed:RowData[]=json.records.map((r:unknown[])=>{
          const item=Object.fromEntries(fields.map((f:string,i:number)=>[f,r[i]])) as RowData;
          const out:RowData={...item,Tarih:String(item.Tarih??"")};
          reservoirs.forEach(k=>{const n=Number(item[k]);out[k]=Number.isFinite(n)?(n>1?n/100:n):0;});
          return out;
        });
        // Duplicate dates are reduced to one record, keeping the last occurrence.
        const unique=new Map<string,RowData>();
        parsed.forEach(r=>{if(r.Tarih) unique.set(r.Tarih.slice(0,10),r);});
        const sorted=[...unique.values()].sort((a,b)=>+new Date(a.Tarih)-+new Date(b.Tarih));
        if(alive){setRows(sorted);setLoadedAt(new Date().toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"}));}
      } catch(e) {
        if(alive) setError(e instanceof Error?e.message:"Veri yüklenemedi.");
      } finally {if(alive)setLoading(false);}
    })();
    return ()=>{alive=false;};
  },[]);

  const [currentWater, setCurrentWater] = useState<{
    data: { dolulukOrani: number; tarih: string | null }[];
    sonGuncellemeZamani: string | null;
    sourceName?: string;
    sourceUrl?: string;
    attribution?: string;
    freshness?: string;
    checkedAt?: string;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;

    const loadCurrentWater = async () => {
      try {
        const response = await fetch("/api/iski", {
          cache: "no-store",
          signal: AbortSignal.timeout(25000),
        });
        const json = await response.json();
        if (!response.ok || !Array.isArray(json?.data) || !json.data.length) {
          throw new Error(json?.detail || json?.error || "Güncel veri alınamadı.");
        }
        if (active) setCurrentWater({ ...json, checkedAt: new Date().toISOString() });
      } catch (liveError) {
        // Canlı kaynaklar erişilemezse GitHub Actions'ın son başarılı günlük
        // snapshot'ını kullan. Bu kayıt canlı ölçüm gibi etiketlenmez.
        try {
          const snapshotResponse = await fetch("/iski-guncel.json", {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
          if (!snapshotResponse.ok) throw new Error("Henüz otomatik veri kaydı bulunmuyor.");
          const snapshot = await snapshotResponse.json();
          const records = Array.isArray(snapshot?.data) ? snapshot.data : [];
          const latest = [...records].sort((a, b) =>
            String(a.date ?? a.tarih ?? "").localeCompare(String(b.date ?? b.tarih ?? ""))
          ).at(-1);
          const rawRate = Number(latest?.fill_rate ?? latest?.fillRate ?? latest?.dolulukOrani ?? latest?.value);
          if (!latest || !Number.isFinite(rawRate) || rawRate < 0) {
            throw new Error("Son otomatik kayıtta geçerli doluluk değeri bulunamadı.");
          }
          const measuredAt = latest.date ?? latest.tarih ?? null;
          if (active) {
            setCurrentWater({
              data: [{ dolulukOrani: rawRate > 1 ? rawRate / 100 : rawRate, tarih: measuredAt }],
              sonGuncellemeZamani: snapshot.retrievedAt ?? measuredAt,
              sourceName: "Son başarılı otomatik veri kaydı",
              sourceUrl: snapshot.sourceUrl ?? "https://www.dolulukorani.com/api/v1/provinces/istanbul/history?days=30",
              attribution: "Canlı API'ye erişilemediği için son başarılı günlük kayıt gösteriliyor.",
              freshness: "Bu kayıt canlı değildir; ölçüm tarihi kontrol edilmelidir.",
              checkedAt: new Date().toISOString(),
            });
          }
        } catch (snapshotError) {
          console.error("Güncel veri ve snapshot yüklenemedi:", liveError, snapshotError);
          if (active) {
            setCurrentWater({
              data: [],
              sonGuncellemeZamani: null,
              error: liveError instanceof Error ? liveError.message : "Güncel veri alınamadı.",
              checkedAt: new Date().toISOString(),
              sourceUrl: "https://www.dolulukorani.com/api/v1/provinces/istanbul/history?days=30",
            });
          }
        }
      }
    };

    void loadCurrentWater();
    return () => { active = false; };
  }, []);
  const last=rows[rows.length-1];
  const years=rows.map(r=>new Date(r.Tarih).getFullYear()).filter(Number.isFinite);
  const minYear=years.length?Math.min(...years):2000;
  const maxYear=years.length?Math.max(...years):2024;
  const filtered=useMemo(()=>rows.filter(r=>{
    const y=new Date(r.Tarih).getFullYear();
    return y>=Number(startYear)&&y<=Number(endYear);
  }),[rows,startYear,endYear]);
  const averages=useMemo(()=>reservoirs.map(k=>({key:k,avg:mean(filtered.map(r=>Number(r[k])).filter(Number.isFinite))})).sort((a,b)=>b.avg-a.avg),[filtered]);
  const trendRows=useMemo(()=>filtered.filter((_,i)=>i%Math.max(1,Math.floor(filtered.length/180))===0),[filtered]);
  const monthly=useMemo(()=>Array.from({length:12},(_,i)=>{
    const xs=filtered.filter(r=>new Date(r.Tarih).getMonth()===i).map(r=>Number(r[reservoir])).filter(Number.isFinite);
    return {month:new Date(2000,i,1).toLocaleDateString("tr-TR",{month:"short"}),avg:mean(xs)*100,count:xs.length};
  }),[filtered,reservoir]);
  // 12 aylık ileri tahmin: seçili tarih aralığındaki aynı takvim aylarının
  // tarihsel ortalaması; belirsizlik bandı ±1 örnek standart sapmadır.
  const forecast = useMemo(() => {
    if (!filtered.length) return [];
    // Tahmin ufku güncel ölçüm tarihinden başlar; tarihsel dosyanın 2024'te
    // bitmesi, tahminin de 2024'te başlatılmasına neden olmamalıdır.
    const liveDate = currentWater?.data?.[0]?.tarih
      ? new Date(currentWater.data[0].tarih)
      : new Date();
    const baseDate = Number.isNaN(liveDate.getTime()) ? new Date() : liveDate;
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + index + 1, 1);
      const monthValues = filtered
        .filter((row) => new Date(row.Tarih).getMonth() === date.getMonth())
        .map((row) => Number(row[reservoir]))
        .filter((value) => Number.isFinite(value));
      const average = mean(monthValues);
      const deviation = sd(monthValues);
      const lower = Math.max(0, average - deviation);
      const upper = Math.min(1, average + deviation);
      return {
        month: date.toLocaleDateString("tr-TR", { month: "short", year: "numeric" }),
        low: lower * 100,
        band: (upper - lower) * 100,
        pred: average * 100,
      };
    });
  }, [filtered, reservoir, currentWater]);
  const sameDay=useMemo(()=>{
    if(!last)return [];
    // Karşılaştırma gününü mümkünse en güncel canlı ölçümden al; canlı kaynak
    // yoksa tarihsel dosyanın son gününe geri dön.
    const reference = currentWater?.data?.[0]?.tarih
      ? new Date(currentWater.data[0].tarih)
      : new Date(last.Tarih);
    if(Number.isNaN(reference.getTime())) return [];
    const year = reference.getFullYear();
    return Array.from({length:10},(_,i)=>year-9+i).flatMap(targetYear=>{
      const match=rows.find(r=>{const x=new Date(r.Tarih);return x.getFullYear()===targetYear&&x.getMonth()===reference.getMonth()&&x.getDate()===reference.getDate();});
      return match?[{year:String(targetYear),value:Number(match[reservoir])*100}]:[];
    });
  },[rows,last,reservoir,currentWater]);
  const matchingDetails=useMemo(()=>filtered.filter(r=>{const dateMatch=!tableSearch||dateText(r.Tarih).includes(tableSearch.trim());const raw=Number(r[reservoir]);const value=Number.isFinite(raw)?(raw<=1?raw*100:raw):NaN;const minMatch=minRate===""||(Number.isFinite(value)&&value>=Number(minRate));const maxMatch=maxRate===""||(Number.isFinite(value)&&value<=Number(maxRate));return dateMatch&&minMatch&&maxMatch;}),[filtered,tableSearch,minRate,maxRate,reservoir]);
  const details=useMemo(()=>[...matchingDetails].sort((a,b)=>{
    const av=sortKey==="Tarih"?+new Date(a.Tarih):Number(a[sortKey]),bv=sortKey==="Tarih"?+new Date(b.Tarih):Number(b[sortKey]);
    return (av-bv)*(ascending?1:-1);
  }).slice(0,250),[filtered,tableSearch,minRate,maxRate,reservoir,sortKey,ascending]);

  if(loading)return <main className="min-h-screen bg-[#f7f5ef] p-8"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-44 rounded-2xl bg-stone-200"/><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(x=><div key={x} className="h-24 bg-stone-200 rounded-xl"/>)}</div><p role="status">Tarihsel veriler yükleniyor…</p></div></main>;
  if(error||!last)return <main className="min-h-screen bg-[#f7f5ef] p-8"><div className="mx-auto max-w-2xl rounded-xl bg-white p-8"><h1 className="font-serif text-3xl">Veri yüklenemedi</h1><p className="mt-3">{error||"Kayıt bulunamadı."}</p><a className="mt-4 inline-block underline" href={sourceUrl} target="_blank" rel="noreferrer">İBB veri kaynağı</a></div></main>;

  const reset=()=>{setStartYear(String(minYear));setEndYear(String(maxYear));setSearch("");};
  return <main className="min-h-screen bg-[#f7f5ef] text-[#20251f]">
    <header className="hero-shell relative isolate overflow-hidden border-b border-cyan-900/15">
      <div className="hero-watermark" aria-hidden="true"/>
      <div className="relative z-10 mx-auto grid max-w-[1500px] gap-9 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
        <div>
          <p className="hero-kicker">İSTANBUL · SU VE İKLİM DOSYASI</p>
          <h1 className="hero-title mt-6 max-w-6xl font-serif text-4xl font-black uppercase leading-[1.02] tracking-[-.04em] sm:text-6xl lg:text-[clamp(3.8rem,5vw,4.7rem)]">İSTANBUL BARAJLARINDA DOLULUK DURUMU</h1>
          <p className="hero-description mt-7 max-w-3xl text-lg leading-8 sm:text-2xl sm:leading-10">Barajların tarihsel doluluk oranlarını inceleyin, mevsimsel değişimleri karşılaştırın ve geleceğe yönelik tahminleri keşfedin.</p>
          <div className="mt-8 flex flex-wrap items-center gap-5 sm:gap-7">
            <a className="hero-source" href={sourceUrl} target="_blank" rel="noreferrer">İBB AÇIK VERİ KAYNAĞI <span aria-hidden="true">↗</span></a>
            <div className="hero-date"><span className="text-2xl" aria-hidden="true">▦</span><span><span className="block text-sm text-slate-600">VERİ ARALIĞI</span><b>{dateText(rows[0].Tarih)} – {dateText(last.Tarih)}</b></span></div>
          </div>
        </div>
        <aside className="hero-info-card" aria-label="Tarihsel veri bilgisi">
          <p className="hero-info-title"><span aria-hidden="true">◷</span> TARİHSEL VERİ PANELİ</p>
          <p><span aria-hidden="true">●</span> Son ölçüm: <b>{dateText(last.Tarih)}</b></p>
          <p><span aria-hidden="true">◷</span> Panel yükleme zamanı:<br/><b className="ml-7">{loadedAt}</b></p>
          <p className="hero-info-note">Tarihsel veri, güncel doluluk oranı anlamına gelmez.</p>
        </aside>
      </div>
    </header>
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8">
      <section className="kpi-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Özet göstergeler">
        <Kpi title="Tarihsel kayıt" value={rows.length.toLocaleString("tr-TR")} note="Tekilleştirilmiş ölçüm günü"/>
        <Kpi title="Son ölçüm" value={dateText(last.Tarih)} note="Güncel doluluk anlamına gelmez"/>
        <Kpi title="En yüksek tarihsel ortalama" value={pct(averages[0]?.avg??0)} note={names[averages[0]?.key??"Terkos"]}/>
        <Kpi title="En düşük tarihsel ortalama" value={pct(averages[averages.length-1]?.avg??0)} note={names[averages[averages.length-1]?.key??"Alibey"]}/>
      </section>

      <section className="rounded-2xl border border-emerald-900/20 bg-[#eaf2eb] p-5 sm:p-7" aria-labelledby="live-water-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-900">Canlı veri · Ayrı kaynak</p>
            <h2 id="live-water-title" className="mt-1 font-serif text-2xl font-bold">İstanbul güncel doluluk oranı</h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-stone-700">Bu gösterge, tarihsel grafiklerden ayrı olarak güncel veri kaynağından alınır.</p>
          </div>
          <div className="min-w-40">
            <p className="font-serif text-4xl font-bold text-emerald-950">
              {currentWater?.data?.length ? pct(Number(currentWater.data[0].dolulukOrani)) : "—"}
            </p>
            <p className="mt-1 text-sm text-stone-700">
              {currentWater?.data?.[0]?.tarih ? `Ölçüm: ${dateText(currentWater.data[0].tarih)}` : currentWater?.error ? "Güncel veri şu an alınamadı" : "Güncel ölçüm bekleniyor"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-700">
          {currentWater?.sourceUrl && <a className="font-semibold underline text-emerald-950" href={currentWater.sourceUrl} target="_blank" rel="noreferrer">Veri kaynağını aç ↗</a>}
          <span>{currentWater?.sourceName ?? "Canlı kaynak bekleniyor"}</span>
          {currentWater?.checkedAt && <span>Son kontrol: {new Date(currentWater.checkedAt).toLocaleString("tr-TR")}</span>}
          {currentWater?.freshness && <span>Veri tazeliği: {currentWater.freshness}</span>}
          {!currentWater && <span role="status">Güncel veri kontrol ediliyor…</span>}
          {currentWater?.error && <span role="status">Bağlantı hatası: {currentWater.error}</span>}
          {currentWater?.attribution && <span>{currentWater.attribution}</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Keşif paneli</p><h2 className="mt-1 font-serif text-2xl font-bold">Veriyi daraltın</h2></div><button onClick={reset} className="rounded-lg border border-stone-400 px-4 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">Filtreleri sıfırla</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Baraj<select className="field" value={reservoir} onChange={e=>setReservoir(e.target.value)}>{reservoirs.map(k=><option key={k} value={k}>{names[k]}</option>)}</select></label>
          <label className="text-sm font-semibold">Başlangıç yılı<select className="field" value={startYear} onChange={e=>setStartYear(e.target.value)}>{Array.from({length:maxYear-minYear+1},(_,i)=>minYear+i).map(y=><option key={y}>{y}</option>)}</select></label>
          <label className="text-sm font-semibold">Bitiş yılı<select className="field" value={endYear} onChange={e=>setEndYear(e.target.value)}>{Array.from({length:maxYear-minYear+1},(_,i)=>minYear+i).map(y=><option key={y}>{y}</option>)}</select></label>
          <label className="text-sm font-semibold">Tarihe göre ara<input className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Örn. 19.02.2024"/></label>
        </div>
        {Number(startYear)>Number(endYear)&&<p className="mt-3 text-sm text-red-700">Başlangıç yılı bitiş yılından büyük olamaz.</p>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_.8fr]">
        <article className="min-w-0 rounded-2xl border border-stone-300 bg-white p-5 sm:p-7">
          <SectionLabel>01 · Ana grafik</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Doluluk zaman içinde nasıl değişti?</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-stone-600">{names[reservoir]} için seçilen yıllardaki günlük tarihsel kayıtlar. Bu seri canlı ölçüm değildir.</p>
          {filtered.length===0?<Empty/>:<div className="mt-5 h-80" role="img" aria-label={`${names[reservoir]} tarihsel doluluk çizgisi; tablo alternatifi aşağıda.`}><DeferredChart kind="line" data={trendRows} dataKey={reservoir} label={names[reservoir]} /></div>}
          <p className="mt-3 text-sm leading-6 text-stone-600"><b>Grafik özeti:</b> Seçilen barajın doluluk oranı seçilen tarih aralığında gösterilir; yüzdeler tarihsel ölçümlerdir.</p>
          <button className="mt-3 rounded-lg border border-stone-400 px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={()=>setShowChartTable(!showChartTable)}>{showChartTable?"Grafik tablosunu gizle":"Grafik verisini tablo olarak gör"}</button>
          {showChartTable&&<div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Tarih</th><th className="p-2 text-right">{names[reservoir]}</th></tr></thead><tbody>{filtered.slice(-100).map(r=><tr className="border-t" key={r.Tarih}><td className="p-2">{dateText(r.Tarih)}</td><td className="p-2 text-right">{pct(Number(r[reservoir]))}</td></tr>)}</tbody></table></div>}
        </article>
        <article className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>Baraj görünümü</SectionLabel><h2 className="mt-2 font-serif text-2xl font-bold">Tarihsel ortalamalar</h2><p className="mt-2 text-sm leading-6 text-stone-600">Seçilen dönem için baraj başına ortalama doluluk.</p><div className="mt-6 space-y-4">{averages.map(x=><div key={x.key}><div className="mb-1 flex justify-between gap-2 text-sm"><span>{names[x.key]}</span><b>{pct(x.avg)}</b></div><div className="h-2.5 rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-800" style={{width:`${Math.max(0,Math.min(100,x.avg*100))}%`}}/></div></div>)}</div></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>02 · İkincil grafik</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Mevsimsel örüntü</h2><p className="mt-2 text-sm leading-6 text-stone-600">Seçilen yıllarda her ayın ortalama doluluk oranı.</p><div className="mt-5 h-72" role="img" aria-label={`${names[reservoir]} aylık ortalama doluluk grafiği`}><DeferredChart kind="monthly" data={monthly} /></div><p className="mt-3 text-sm leading-6 text-stone-600"><b>Grafik özeti:</b> Aylık ortalamalar mevsimsel farkları gösterir, geleceği garanti etmez.</p><button className="mt-3 rounded-lg border border-stone-400 px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={()=>setShowMonthlyTable(!showMonthlyTable)}>{showMonthlyTable?"Aylık tabloyu gizle":"Veriyi tablo olarak gör"}</button>{showMonthlyTable&&<div className="mt-3 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ay</th><th className="p-2 text-right">Ortalama</th><th className="p-2 text-right">Kayıt</th></tr></thead><tbody>{monthly.map(x=><tr key={x.month} className="border-t"><td className="p-2">{x.month}</td><td className="p-2 text-right">{x.avg.toLocaleString("tr-TR",{maximumFractionDigits:1})}%</td><td className="p-2 text-right">{x.count}</td></tr>)}</tbody></table></div>}</article>
        <article className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>03 · Zorunlu ileri özellik</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Mevsimsel tahmin ve belirsizlik</h2><p className="mt-2 text-sm leading-6 text-stone-600">Önümüzdeki 12 ay için çizgi, seçilen dönemdeki aynı ayların ortalamasını; gölgeli bant ±1 standart sapmayı gösterir.</p><div className="mt-5 h-72" role="img" aria-label={`${names[reservoir]} için mevsimsel tahmin ve belirsizlik bandı`}><DeferredChart kind="forecast" data={forecast} /></div><p className="mt-3 text-sm leading-6 text-stone-600"><b>Yöntem sınırı:</b> Bu basit mevsimsel tahmin, seçilen tarih aralığındaki aynı takvim aylarının ortalamasını kullanır; gölgeli alan ±1 örnek standart sapmadır. Yağış, tüketim, hava durumu ve işletme kararlarını içermez; resmî tahmin veya güncel ölçüm değildir.</p><button className="mt-3 rounded-lg border border-stone-400 px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={()=>setShowForecastTable(!showForecastTable)}>{showForecastTable?"Tahmin tablosunu gizle":"Tahmin verisini tablo olarak gör"}</button>{showForecastTable&&<div className="mt-3 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Ay</th><th className="p-2 text-right">Tahmin</th><th className="p-2 text-right">Alt sınır</th><th className="p-2 text-right">Üst sınır</th></tr></thead><tbody>{forecast.map(x=><tr key={x.month} className="border-t"><td className="p-2">{x.month}</td><td className="p-2 text-right">{x.pred.toLocaleString("tr-TR",{maximumFractionDigits:1})}%</td><td className="p-2 text-right">{x.low.toLocaleString("tr-TR",{maximumFractionDigits:1})}%</td><td className="p-2 text-right">{(x.low+x.band).toLocaleString("tr-TR",{maximumFractionDigits:1})}%</td></tr>)}</tbody></table></div>}</article>
      </section>

      <section className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>04 · Aynı gün karşılaştırması</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Son ölçüm gününün geçmiş 10 yılı</h2><p className="mt-2 text-sm leading-6 text-stone-600">Canlı kaynak ölçümünün ayı ve günü (kaynak yanıt vermezse tarihsel son ölçüm) için geçmiş 10 yılda veri bulunan yıllar karşılaştırılır; eksik tarihler gösterilmez.</p>{sameDay.length?<div className="mt-5 h-72" role="img" aria-label="Son ölçümün aynı takvim günündeki geçmiş on yıl karşılaştırması"><DeferredChart kind="same-day" data={sameDay} label={names[reservoir]} /></div>:<Empty/>}<p className="mt-3 text-sm leading-6 text-stone-600"><b>Grafik özeti:</b> {names[reservoir]} için aynı takvim gününde bulunan {sameDay.length} yıllık kayıt gösterilir.</p><button className="mt-3 rounded-lg border border-stone-400 px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={()=>setShowSameDayTable(!showSameDayTable)}>{showSameDayTable?"Karşılaştırma tablosunu gizle":"Veriyi tablo olarak gör"}</button>{showSameDayTable&&<div className="mt-3 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Yıl</th><th className="p-2 text-right">Doluluk</th></tr></thead><tbody>{sameDay.map(x=><tr key={x.year} className="border-t"><td className="p-2">{x.year}</td><td className="p-2 text-right">{x.value.toLocaleString("tr-TR",{maximumFractionDigits:1})}%</td></tr>)}</tbody></table></div>}</section>

      <section className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>05 · Ayrıntılı veri</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Günlük kayıt tablosu</h2><p className="mt-2 text-sm text-stone-600">Sütun başlıklarına tıklayarak sıralayın. Filtreler seçili barajın doluluk oranına ve tarihe uygulanır; en fazla 250 satır gösterilir.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Tarih ara<input className="field" value={tableSearch} onChange={e=>setTableSearch(e.target.value)} placeholder="Örn. 19.02.2024"/></label>
          <label className="text-sm font-semibold">En az doluluk (%)<input className="field" type="number" min="0" max="100" value={minRate} onChange={e=>setMinRate(e.target.value)} placeholder="Örn. 30"/></label>
          <label className="text-sm font-semibold">En fazla doluluk (%)<input className="field" type="number" min="0" max="100" value={maxRate} onChange={e=>setMaxRate(e.target.value)} placeholder="Örn. 80"/></label>
          <div className="flex items-end"><button className="w-full rounded-lg border border-stone-400 px-4 py-3 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={()=>{setTableSearch("");setMinRate("");setMaxRate("");}}>Tablo filtrelerini temizle</button></div>
        </div>
        <p className="mt-3 text-sm text-stone-600" role="status">Filtreye uyan toplam kayıt: {matchingDetails.length} · Gösterilen: {details.length}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-sm"><thead className="bg-stone-100"><tr><th className="p-3 text-left"><button className="underline" onClick={()=>{setSortKey("Tarih");setAscending(!ascending)}}>Tarih {sortKey==="Tarih"?(ascending?"↑":"↓"):"↕"}</button></th>{reservoirs.map(k=><th key={k} className="p-3 text-right"><button className="underline" onClick={()=>{setSortKey(k);setAscending(!ascending)}}>{names[k]} {sortKey===k?(ascending?"↑":"↓"):"↕"}</button></th>)}</tr></thead><tbody>{details.map(r=><tr key={r.Tarih} className="border-b border-stone-200 hover:bg-emerald-50"><td className="whitespace-nowrap p-3">{dateText(r.Tarih)}</td>{reservoirs.map(k=><td key={k} className="whitespace-nowrap p-3 text-right tabular-nums">{pct(Number(r[k]))}</td>)}</tr>)}</tbody></table>{!details.length&&<Empty/>}</div></section>

      <footer className="max-w-[70ch] border-t border-stone-300 py-5 text-sm leading-6 text-stone-600"><p><b>Veri notu:</b> İBB Açık Veri Portalı’ndan indirilen tarihsel dosyanın son ölçümü 19 Şubat 2024’tür. Bu değerler güncel baraj doluluk oranları olarak yorumlanmamalıdır.</p><p className="mt-2"><b>Panel yüklenme zamanı:</b> {loadedAt}. Bu, panelin tarayıcıda yüklendiği zamandır; kaynak verinin güncellendiği zaman değildir.</p><p className="mt-2">Bilgilendirme amaçlıdır, su yönetimi tavsiyesi değildir. Kaynak: <a className="font-semibold underline text-emerald-900" href={sourceUrl} target="_blank" rel="noreferrer">İBB İstanbul Barajları Günlük Doluluk Oranları</a>.</p></footer>
    </div>
    <style jsx>{`.field{display:block;width:100%;margin-top:.5rem;border:1px solid #a8a29e;border-radius:.5rem;background:white;padding:.75rem;font-weight:400}.field:focus-visible{outline:2px solid #166534;outline-offset:2px}`}</style>
  </main>;
}

function DeferredChart({kind,data,dataKey,label}:{kind:"line"|"monthly"|"forecast"|"same-day";data:unknown[];dataKey?:string;label?:string}) {
  const [visible,setVisible]=useState(false);
  const [node,setNode]=useState<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(!node||visible)return;
    if(!("IntersectionObserver" in window)){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{rootMargin:"240px"});
    observer.observe(node);
    return ()=>observer.disconnect();
  },[node,visible]);
  return <div ref={setNode} className="h-full w-full">
    {visible?<DeferredChartView kind={kind} data={data} dataKey={dataKey} label={label}/>:<div className="h-full min-h-56 rounded-lg bg-stone-50" aria-label="Grafik görünüm alanı"/>}
  </div>;
}

function SectionLabel({children}:{children:React.ReactNode}) { return <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">{children}</p>; }
function Kpi({title,value,note}:{title:string;value:string;note:string}) { return <article className="kpi-card rounded-2xl bg-white px-6 py-5"><p className="text-sm font-extrabold uppercase tracking-[.12em] text-slate-600">{title}</p><p className="mt-3 font-serif text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{value}</p><p className="mt-2 text-base text-slate-600">{note}</p></article>; }
function Empty(){return <p className="rounded-lg border border-dashed border-stone-400 bg-stone-50 p-5 text-sm text-stone-700">Bu filtrelerle eşleşen kayıt bulunamadı. Yıl aralığını değiştirin.</p>;}
