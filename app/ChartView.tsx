"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

type Props = { kind: "line"|"monthly"|"forecast"|"same-day"; data: any[]; dataKey?: string; label?: string };
const percent=(v:number)=>`${v.toLocaleString("tr-TR",{maximumFractionDigits:1})}%`;
const dateLabel=(v:string)=>{const d=new Date(v);return Number.isNaN(+d)?v:d.toLocaleDateString("tr-TR");};

export default function ChartView({kind,data,dataKey="value",label="Doluluk"}:Props) {
  return <ResponsiveContainer width="100%" height="100%">
    {kind==="line" ? <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/>
      <XAxis dataKey="Tarih" tickFormatter={v=>String(v).slice(0,4)} minTickGap={30}/>
      <YAxis domain={[0,1]} tickFormatter={v=>`${Math.round(Number(v)*100)}%`}/>
      <Tooltip labelFormatter={v=>dateLabel(String(v))} formatter={v=>[percent(Number(v)*100),label]}/>
      <Line dataKey={dataKey} name={label} stroke="#176b50" strokeWidth={2} dot={false} isAnimationActive={false}/>
    </LineChart> : kind==="monthly" ? <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/>
      <XAxis dataKey="month"/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/>
      <Tooltip formatter={v=>[percent(Number(v)),"Aylık ortalama"]}/>
      <Bar dataKey="avg" fill="#176b50" radius={[4,4,0,0]}/>
    </BarChart> : kind==="forecast" ? <ComposedChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/>
      <XAxis dataKey="month"/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/>
      <Tooltip formatter={(v,n)=>[percent(Number(v)),String(n)]}/>
      <Area dataKey="low" stackId="range" stroke="none" fill="#fff" name="Alt sınır"/>
      <Area dataKey="band" stackId="range" stroke="none" fill="#a7cdb8" fillOpacity={.9} name="Belirsizlik bandı"/>
      <Line dataKey="pred" name="Mevsimsel ortalama" stroke="#176b50" strokeWidth={3} dot={{r:3}}/>
    </ComposedChart> : <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#dedbd2"/>
      <XAxis dataKey="year"/><YAxis domain={[0,100]} tickFormatter={v=>`${v}%`}/>
      <Tooltip formatter={v=>[percent(Number(v)),label]}/>
      <Bar dataKey="value" name={label} fill="#176b50" radius={[4,4,0,0]}/>
    </BarChart>}
  </ResponsiveContainer>;
}
