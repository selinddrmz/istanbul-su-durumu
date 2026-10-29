"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

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
  const [sortKey,setSortKey] = useState("Tarih");
  const [ascending,setAscending] = useState(false);
  const [showChartTable,setShowChartTable] = useState(false);
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
    data: { dolulukOrani: number; tarih: string }[];
    sonGuncellemeZamani: string;
  } | null>(null);
  useEffect(() => {
    fetch("/api/iski")
      .then((res) => {
        if (!res.ok) throw new Error("İSKİ verisi alınamadı");
        return res.json();
      })
      .then((json) => {
        setCurrentWater(json);
      })
      .catch((err) => {
        console.error("İSKİ güncel veri hatası:", err);
      });
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
  const [analysisForecast, setAnalysisForecast] = useState<any[]>([]);

useEffect(() => {
  fetch("/su_analiz_sonuclari.json")
    .then((res) => {
      if (!res.ok) throw new Error("Analiz dosyası yüklenemedi");
      return res.json();
    })
    .then((json) => {
      console.log("Jupyter tahmin kayıtları:", json.tahmin?.length);
      setAnalysisForecast(json.tahmin ?? []);
    })
    .catch((err) => console.error(err));
}, []);
const forecast = useMemo(() => {
  if (analysisForecast.length === 0) return [];

  return analysisForecast.map((item) => ({
    month: new Date(item.tarih + "T00:00:00").toLocaleDateString("tr-TR", {
      month: "short",
      year: "numeric",
    }),
    low: item.alt_sinir * 100,
    band: (item.ust_sinir - item.alt_sinir) * 100,
    pred: item.tahmin * 100,
  }));
}, [analysisForecast]);
  const sameDay=useMemo(()=>{
    if(!last)return [];
    const d=new Date(last.Tarih),y=d.getFullYear();
    return Array.from({length:10},(_,i)=>y-9+i).flatMap(year=>{
      const match=rows.find(r=>{const x=new Date(r.Tarih);return x.getFullYear()===year&&x.getMonth()===d.getMonth()&&x.getDate()===d.getDate();});
      return match?[{year:String(year),value:Number(match[reservoir])*100}]:[];
    });
  },[rows,last,reservoir]);
  const details=useMemo(()=>filtered.filter(r=>!search||r.Tarih.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))||reservoirs.some(k=>names[k].toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")))).sort((a,b)=>{
    const av=sortKey==="Tarih"?+new Date(a.Tarih):Number(a[sortKey]),bv=sortKey==="Tarih"?+new Date(b.Tarih):Number(b[sortKey]);
    return (av-bv)*(ascending?1:-1);
  }).slice(0,250),[filtered,search,sortKey,ascending]);

  if(loading)return <main className="min-h-screen bg-[#f7f5ef] p-8"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-44 rounded-2xl bg-stone-200"/><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(x=><div key={x} className="h-24 bg-stone-200 rounded-xl"/>)}</div><p role="status">Tarihsel veriler yükleniyor…</p></div></main>;
  if(error||!last)return <main className="min-h-screen bg-[#f7f5ef] p-8"><div className="mx-auto max-w-2xl rounded-xl bg-white p-8"><h1 className="font-serif text-3xl">Veri yüklenemedi</h1><p className="mt-3">{error||"Kayıt bulunamadı."}</p><a className="mt-4 inline-block underline" href={sourceUrl} target="_blank" rel="noreferrer">İBB veri kaynağı</a></div></main>;

  const reset=()=>{setStartYear(String(minYear));setEndYear(String(maxYear));setSearch("");};
  return <main className="min-h-screen bg-[#f7f5ef] text-[#20251f]">
    <header className="border-b border-stone-300"><div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-800">İstanbul · Su ve iklim dosyası</p>
      <div className="mt-3 grid gap-5 md:grid-cols-[1fr_260px] md:items-end">
        <div><h1 className="max-w-4xl font-serif text-4xl font-bold leading-tight sm:text-6xl">İstanbul’un suyu: doluluk, eğilim ve belirsizlik</h1>
        <p className="mt-4 max-w-[65ch] leading-7 text-stone-700">Barajların tarihsel doluluk kayıtlarını inceleyin, mevsimsel örüntüleri karşılaştırın ve geçmiş veriye dayalı basit tahmini keşfedin.</p></div>
        <aside className="border-l-2 border-emerald-800 pl-4 text-sm leading-6 text-stone-600"><b className="text-stone-900">Tarihsel veri paneli</b><p>Son ölçüm: {dateText(last.Tarih)}</p><p>Panel yükleme zamanı: {loadedAt}</p></aside>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm"><a className="font-semibold underline text-emerald-900" href={sourceUrl} target="_blank" rel="noreferrer">İBB açık veri kaynağı ↗</a><span>Veri aralığı: {dateText(rows[0].Tarih)} – {dateText(last.Tarih)}</span></div>
    </div></header>
    <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Özet göstergeler">
        <Kpi title="Tarihsel kayıt" value={rows.length.toLocaleString("tr-TR")} note="Tekilleştirilmiş ölçüm günü"/>
        <Kpi title="Son ölçüm" value={dateText(last.Tarih)} note="Güncel doluluk anlamına gelmez"/>
        <Kpi title="En yüksek tarihsel ortalama" value={pct(averages[0]?.avg??0)} note={names[averages[0]?.key??"Terkos"]}/>
        <Kpi title="En düşük tarihsel ortalama" value={pct(averages[averages.length-1]?.avg??0)} note={names[averages[averages.length-1]?.key??"Alibey"]}/>
      </section>

      <section className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Keşif paneli</p><h2 className="mt-1 font-serif text-2xl font-bold">Veriyi daraltın</h2></div><button onClick={reset} className="rounded-lg border border-stone-400 px-4 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800">Filtreleri sıfırla</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold">Baraj<select className="field" value={reservoir} onChange={e=>setReservoir(e.target.value)}>{reservoirs.map(k=><option key={k} value={k}>{names[k]}</option>)}</select></label>
          <label className="text-sm font-semibold">Başlangıç yılı<select className="field" value={startYear} onChange={e=>setStartYear(e.target.value)}>{Array.from({length:maxYear-minYear+1},(_,i)=>minYear+i).map(y=><option key={y}>{y}</option>)}</select></label>
          <label className="text-sm font-semibold">Bitiş yılı<select className="field" value={endYear} onChange={e=>setEndYear(e.target.value)}>{Array.from({length:maxYear-minYear+1},(_,i)=>minYear+i).map(y=><option key={y}>{y}</option>)}</select></label>
          <label className="text-sm font-semibold">Tabloda ara<input className="field" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tarih veya baraj adı…"/></label>
        </div>
        {Number(startYear)>Number(endYear)&&<p className="mt-3 text-sm text-red-700">Başlangıç yılı bitiş yılından büyük olamaz.</p>}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_.8fr]">
        <article className="min-w-0 rounded-2xl border border-stone-300 bg-white p-5 sm:p-7">
          <SectionLabel>01 · Ana grafik</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Doluluk zaman içinde nasıl değişti?</h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-stone-600">{names[reservoir]} için seçilen yıllardaki günlük tarihsel kayıtlar. Bu seri canlı ölçüm değildir.</p>
          {filtered.length===0?<Empty/>:<div className="mt-5 h-80" role="img" aria-label={`${names[reservoir]} tarihsel doluluk çizgisi; tablo alternatifi aşağıda.`}><ResponsiveContainer width="100%" height="100%"><LineChart data={trendRows}><CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/><XAxis dataKey="Tarih" tickFormatter={v=>String(v).slice(0,4)} minTickGap={30}/><YAxis domain={[0,1]} tickFormatter={v=>`${Math.round(Number(v)*100)}%`}/><Tooltip labelFormatter={v=>dateText(String(v))} formatter={v=>[pct(Number(v)),names[reservoir]]}/><Line dataKey={reservoir} name={names[reservoir]} stroke="#176b50" strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>}
          <p className="mt-3 text-sm leading-6 text-stone-600"><b>Grafik özeti:</b> Seçilen barajın doluluk oranı seçilen tarih aralığında gösterilir; yüzdeler tarihsel ölçümlerdir.</p>
          <button className="mt-3 rounded-lg border border-stone-400 px-3 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-800" onClick={()=>setShowChartTable(!showChartTable)}>{showChartTable?"Grafik tablosunu gizle":"Grafik verisini tablo olarak gör"}</button>
          {showChartTable&&<div className="mt-3 max-h-72 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Tarih</th><th className="p-2 text-right">{names[reservoir]}</th></tr></thead><tbody>{filtered.slice(-100).map(r=><tr className="border-t" key={r.Tarih}><td className="p-2">{dateText(r.Tarih)}</td><td className="p-2 text-right">{pct(Number(r[reservoir]))}</td></tr>)}</tbody></table></div>}
        </article>
        <article className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>Baraj görünümü</SectionLabel><h2 className="mt-2 font-serif text-2xl font-bold">Tarihsel ortalamalar</h2><p className="mt-2 text-sm leading-6 text-stone-600">Seçilen dönem için baraj başına ortalama doluluk.</p><div className="mt-6 space-y-4">{averages.map(x=><div key={x.key}><div className="mb-1 flex justify-between gap-2 text-sm"><span>{names[x.key]}</span><b>{pct(x.avg)}</b></div><div className="h-2.5 rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-800" style={{width:`${Math.max(0,Math.min(100,x.avg*100))}%`}}/></div></div>)}</div></article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>02 · İkincil grafik</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Mevsimsel örüntü</h2><p className="mt-2 text-sm leading-6 text-stone-600">Seçilen yıllarda her ayın ortalama doluluk oranı.</p><div className="mt-5 h-72" role="img" aria-label={`${names[reservoir]} aylık ortalama doluluk grafiği`}><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/><XAxis dataKey="month"/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/><Tooltip formatter={v=>[`${Number(v).toLocaleString("tr-TR",{maximumFractionDigits:1})}%`,"Aylık ortalama"]}/><Bar dataKey="avg" fill="#176b50" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><p className="mt-3 text-sm leading-6 text-stone-600"><b>Grafik özeti:</b> Aylık ortalamalar mevsimsel farkları gösterir, geleceği garanti etmez.</p></article>
        <article className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>03 · Zorunlu ileri özellik</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Mevsimsel tahmin ve belirsizlik</h2><p className="mt-2 text-sm leading-6 text-stone-600">Çizgi, geçmiş yılların aynı ay ortalamasını; gölgeli bant ±1 standart sapmayı gösterir.</p><div className="mt-5 h-72" role="img" aria-label={`${names[reservoir]} için mevsimsel tahmin ve belirsizlik bandı`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={forecast}><CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/><XAxis dataKey="month"/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/><Tooltip formatter={(v,n)=>[`${Number(v).toLocaleString("tr-TR",{maximumFractionDigits:1})}%`,String(n)]}/><Area dataKey="low" stackId="range" stroke="none" fill="#fff" name="Alt sınır"/><Area dataKey="band" stackId="range" stroke="none" fill="#a7cdb8" fillOpacity={.9} name="Belirsizlik bandı"/><Line dataKey="pred" name="Mevsimsel ortalama" stroke="#176b50" strokeWidth={3} dot={{r:3}}/></ComposedChart></ResponsiveContainer></div><p className="mt-3 text-sm leading-6 text-stone-600"><b>Yöntem sınırı:</b> Tahmin yağış, tüketim, hava durumu veya işletme kararlarını içermez. Kaynak verisi 19.02.2024’te sona erdiğinden bu grafik güncel durum ya da resmî tahmin değildir.</p></article>
      </section>

      <section className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>04 · Aynı gün karşılaştırması</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Son ölçüm gününün geçmiş 10 yılı</h2><p className="mt-2 text-sm leading-6 text-stone-600">Son ölçümün ayı ve günü ({new Date(last.Tarih).getDate()}.{new Date(last.Tarih).getMonth()+1}) için bulunan yıllar karşılaştırılır; eksik tarihler gösterilmez.</p>{sameDay.length?<div className="mt-5 h-72" role="img" aria-label="Son ölçümün aynı takvim günündeki geçmiş on yıl karşılaştırması"><ResponsiveContainer width="100%" height="100%"><BarChart data={sameDay}><CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/><XAxis dataKey="year"/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/><Tooltip formatter={v=>[`${Number(v).toLocaleString("tr-TR",{maximumFractionDigits:1})}%`,names[reservoir]]}/><Bar dataKey="value" name={names[reservoir]} fill="#176b50" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>:<Empty/>}<p className="mt-3 text-sm leading-6 text-stone-600"><b>Grafik özeti:</b> {names[reservoir]} için aynı takvim gününde bulunan {sameDay.length} yıllık kayıt gösterilir.</p></section>

      <section className="rounded-2xl border border-stone-300 bg-white p-5 sm:p-7"><SectionLabel>05 · Ayrıntılı veri</SectionLabel><h2 className="mt-2 font-serif text-3xl font-bold">Günlük kayıt tablosu</h2><p className="mt-2 text-sm text-stone-600">Sütun başlıklarına tıklayarak sıralayın. En fazla 250 satır gösterilir.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-sm"><thead className="bg-stone-100"><tr><th className="p-3 text-left"><button className="underline" onClick={()=>{setSortKey("Tarih");setAscending(!ascending)}}>Tarih {sortKey==="Tarih"?(ascending?"↑":"↓"):"↕"}</button></th>{reservoirs.map(k=><th key={k} className="p-3 text-right"><button className="underline" onClick={()=>{setSortKey(k);setAscending(!ascending)}}>{names[k]} {sortKey===k?(ascending?"↑":"↓"):"↕"}</button></th>)}</tr></thead><tbody>{details.map(r=><tr key={r.Tarih} className="border-b border-stone-200 hover:bg-emerald-50"><td className="whitespace-nowrap p-3">{dateText(r.Tarih)}</td>{reservoirs.map(k=><td key={k} className="whitespace-nowrap p-3 text-right tabular-nums">{pct(Number(r[k]))}</td>)}</tr>)}</tbody></table>{!details.length&&<Empty/>}</div></section>

      <footer className="max-w-[70ch] border-t border-stone-300 py-5 text-sm leading-6 text-stone-600"><p><b>Veri notu:</b> İBB Açık Veri Portalı’ndan indirilen tarihsel dosyanın son ölçümü 19 Şubat 2024’tür. Bu değerler güncel baraj doluluk oranları olarak yorumlanmamalıdır.</p><p className="mt-2"><b>Panel yüklenme zamanı:</b> {loadedAt}. Bu, panelin tarayıcıda yüklendiği zamandır; kaynak verinin güncellendiği zaman değildir.</p><p className="mt-2">Bilgilendirme amaçlıdır, su yönetimi tavsiyesi değildir. Kaynak: <a className="font-semibold underline text-emerald-900" href={sourceUrl} target="_blank" rel="noreferrer">İBB İstanbul Barajları Günlük Doluluk Oranları</a>.</p></footer>
    </div>
    <style jsx>{`.field{display:block;width:100%;margin-top:.5rem;border:1px solid #a8a29e;border-radius:.5rem;background:white;padding:.75rem;font-weight:400}.field:focus-visible{outline:2px solid #166534;outline-offset:2px}`}</style>
  </main>;
}

function SectionLabel({children}:{children:React.ReactNode}) { return <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">{children}</p>; }
function Kpi({title,value,note}:{title:string;value:string;note:string}) { return <article className="border-y-2 border-stone-300 bg-white px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-stone-600">{title}</p><p className="mt-2 font-serif text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-stone-600">{note}</p></article>; }
function Empty(){return <p className="rounded-lg border border-dashed border-stone-400 bg-stone-50 p-5 text-sm text-stone-700">Bu filtrelerle eşleşen kayıt bulunamadı. Yıl aralığını değiştirin.</p>;}
