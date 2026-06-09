// Ayaz Trade v42.0 — Professional Quality Gate Engine
// Bu dosya mevcut veri/motor fonksiyonlarının üzerine profesyonel kalite kapısı ve karar mantığı eklemek için yazıldı.
// Entegrasyon notu: Mevcut tarama döngüsünde aday üretildikten sonra normalizeCandidateV42(c) ve decideCandidateV42(c) çağrılmalıdır.

window.__AYAZ_ACTIVE_VERSION__="v42.0-professional-quality-gate";
const VERSION="v42.0 KRİPTO PROFESSIONAL QUALITY GATE ENGINE";

function gradeBT(bt){
  const n=bt?.trades||0, pf=bt?.pf||0, win=bt?.win||0, net=bt?.netR||0, fast=bt?.fastStop||0;
  if(n<8) return {pass:false, level:"YETERSİZ ÖRNEKLEM", reason:`İşlem ${n}`};
  if(pf<1 || net<=0) return {pass:false, level:"RED", reason:`PF ${pf}, NetR ${net}`};
  if(n<20) return {pass:false, level:"ADAPTİF", reason:`İşlem ${n}, PF ${pf}, Win ${win}%`};
  if(pf>=1.5 && win>=40 && fast<=35) return {pass:true, level:"GÜÇLÜ", reason:`İşlem ${n}, PF ${pf}, Win ${win}%`};
  if(pf>=1.2 && win>=35 && fast<=45) return {pass:true, level:"GEÇTİ", reason:`İşlem ${n}, PF ${pf}, Win ${win}%`};
  return {pass:false, level:"ZAYIF", reason:`İşlem ${n}, PF ${pf}, Win ${win}%, Fast ${fast}%`};
}

function gradeVolume(v){
  if(v==null) return {pass:false, level:"BİLİNMİYOR"};
  if(v<0.5) return {pass:false, level:"KRİTİK ZAYIF"};
  if(v<0.8) return {pass:false, level:"ZAYIF"};
  if(v<1.0) return {pass:true, level:"NORMAL-DÜŞÜK"};
  if(v<1.5) return {pass:true, level:"GÜÇLÜ"};
  return {pass:true, level:"ÇOK GÜÇLÜ"};
}

function gradeStructure(c){
  const hits=[c.bos,c.choch,c.srBreak,c.retest,c.micro].filter(Boolean).length;
  if(hits>=2) return {pass:true, level:"GÜÇLÜ", hits};
  if(hits===1) return {pass:true, level:"ORTA", hits};
  return {pass:false, level:"YAPI TEYİDİ YOK", hits};
}

function gradeTarget(c){
  const stopPct=c.stopPct||0, tp1R=c.tp1R||0, tp2R=c.tp2R||0, atrArea=c.atrArea||0;
  if(stopPct<1.0) return {pass:false, level:"STOP ÇOK DAR"};
  if(tp1R<1.2 || tp2R<1.6) return {pass:false, level:"HEDEF R YETERSİZ"};
  if(atrArea<1.5) return {pass:false, level:"ALAN DAR"};
  return {pass:true, level:"UYGUN", detail:`Stop ${stopPct}%, TP1 ${tp1R}R, TP2 ${tp2R}R, Alan ${atrArea} ATR`};
}

function decideCandidateV42(c){
  const trendPass = !!c.trendOk;
  const struct = gradeStructure(c);
  const vol = gradeVolume(c.volumeRatio);
  const bt = gradeBT(c.backtest||{});
  const target = gradeTarget(c);
  const indPass = (c.indicatorPass||0)>=6;
  const candlePass = c.candleQuality && !String(c.candleQuality).toLowerCase().includes("yetersiz");

  const hardReject = target.level==="STOP ÇOK DAR" || (bt.level==="RED") || (vol.level==="KRİTİK ZAYIF" && !struct.pass);
  if(hardReject) return {decision:"ELENDİ", class:"D", trendPass, struct, vol, bt, target, indPass, candlePass};

  const core = [trendPass, indPass, target.pass, candlePass].filter(Boolean).length;
  const pro = [struct.pass, vol.pass, bt.pass].filter(Boolean).length;

  if(core>=4 && pro>=2) return {decision:"TRADE", class: bt.level==="GÜÇLÜ" ? "A" : "B", trendPass, struct, vol, bt, target, indPass, candlePass};
  if(core>=3 && pro>=1) return {decision:"ADAPTİF ADAY", class:"C", trendPass, struct, vol, bt, target, indPass, candlePass};
  return {decision:"TEYİT BEKLER", class:"D", trendPass, struct, vol, bt, target, indPass, candlePass};
}

// Demo UI fallback: mevcut ana motor yoksa ekran boş kalmasın.
function oneClickCryptoScan(){
  const meta=document.getElementById("meta"), data=document.getElementById("dataBox"), list=document.getElementById("list"), summary=document.getElementById("summary");
  meta.innerHTML="V42 Professional Quality Gate çalışıyor. Mevcut Binance veri motoruna bağlanınca gerçek tarama sonucu burada listelenir.";
  data.innerHTML="Kural: 2000 taramada 0-3 gerçek TRADE çıkarsa sistem 7+7 listeyi Adaptif Aday/Teyit Bekler ile tamamlar; ancak TRADE etiketi yalnızca backtest+risk+teknik kapı geçtiğinde verilir.";
  const demo=[
    {symbol:"EDUUSDT",tf:"15m",side:"SHORT",trendOk:true,bos:false,choch:false,srBreak:false,retest:false,micro:false,volumeRatio:1.48,indicatorPass:8,candleQuality:"Shooting star/pinbar",stopPct:1.36,tp1R:1.34,tp2R:2.12,atrArea:1.74,backtest:{trades:16,pf:.67,win:25,netR:-4,fastStop:31.3}},
    {symbol:"IDUSDT",tf:"30m",side:"SHORT",trendOk:true,bos:false,choch:false,srBreak:false,retest:false,micro:false,volumeRatio:.58,indicatorPass:6,candleQuality:"Bearish engulfing",stopPct:1.54,tp1R:2.12,tp2R:3.18,atrArea:2.6,backtest:{trades:5,pf:2,win:40,netR:1,fastStop:20}}
  ];
  summary.innerHTML='<div class="box">V42: TRADE / ADAPTİF ADAY / TEYİT BEKLER / ELENDİ ayrımı aktif.</div>';
  list.innerHTML=demo.map(c=>{
    const d=decideCandidateV42(c);
    return `<div class="candidate ${c.side==='SHORT'?'short':''}"><span class="badge">${d.decision}<br>${c.side}</span><h2>${c.symbol} / ${c.tf}</h2><div class="line">
    Sınıf: ${d.class}<br>
    Trend: ${d.trendPass?'GEÇTİ':'GEÇMEDİ'} | Yapı: ${d.struct.level} | Hacim: ${d.vol.level} x${c.volumeRatio}<br>
    Mum: ${d.candlePass?'GEÇTİ':'ZAYIF'} | İndikatör: ${c.indicatorPass}/8 | Hedef: ${d.target.level}<br>
    Backtest: ${d.bt.level} | ${d.bt.reason}<br>
    Karar notu: PF<1 veya NetR negatifse Trade verilmez; düşük örneklem Adaptif Aday olur.
    </div></div>`;
  }).join('');
}
function startCryptoWatchScan(){oneClickCryptoScan()}
function stopWatchScan(){document.getElementById("meta").innerHTML="Nöbet durduruldu."}
