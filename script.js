
const DEFAULT_SYMBOLS=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","DOTUSDT","TRXUSDT","ATOMUSDT","NEARUSDT","APTUSDT","OPUSDT","ARBUSDT","BCHUSDT","LTCUSDT","INJUSDT","RNDRUSDT","SUIUSDT","FILUSDT","UNIUSDT","AAVEUSDT","ETCUSDT","MATICUSDT","TONUSDT","PEPEUSDT","WIFUSDT","FETUSDT"];
let SYMBOLS=[...DEFAULT_SYMBOLS];
const UNIVERSE_LIMIT=100;
const EXCLUDED_BASES=new Set(["USDC","FDUSD","TUSD","BUSD","DAI","USDP","EUR","TRY","BRL","GBP","UAH","AEUR","EURI","PAX","USTC"]);
const BAD_SUFFIX=["UP","DOWN","BULL","BEAR","3L","3S","5L","5S"];
const TFS=["15m","30m","1h","2h","4h"];
const TFMS={"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000};
const MODELS=["BAGLI LONG","BAGLI SHORT"];
const RULE={capital:100,riskPct:2.5,spotTry:10000,maxLev:6,minConf:62,liveOnlyMinConf:58,maxLiveAgeMs:300000,maxStopPct:3.8,maxMainStopPct:3.25,minRR:1.20,minTrades:6,minPF:1.05,minWin:45,minMfeMae:0.75,cooldown:6,minConfluence:4,minZoneTouch:1,forceTopCount:14,maxConf:94,maxDisplay:14,liveRequired:true,allowHighRiskTop:false,
  // v15.0: aynı coin aynı yön stop sonrası tekrar giriş kilidi + stop avı/noise filtresi
  sameDirStopLockHours:6, symbolLossLockHours:3, minResetMoveR:0.55, recentStopLookback:6,
  maxRecentStops:2, maxRecentLosses:3, maxFastStopRate:28, maxBackToBackLoss:1,
  minStopMajor15m:.55, minStopAlt15m:.95
};
let market={generatedAt:null,data:{}},wsList=[],wsOk=false,wsLast=0,liveMap={},sourceMap={},candidates=[],selected=null,scanLog={total:0,done:0,rest:0,ws:0,json:0,skipped:0,stale:0,invalid:0,lowQuality:0,highRisk:0,cooldown:0,lossCluster:0,noiseAdjusted:0},fx={rate:null,source:'-',updatedAt:null,ageSec:null},dataHealth={json:false,rest:false,ws:false,lastError:'-',candles:0};
const $=id=>document.getElementById(id);const now=()=>Date.now();
function fmt(n,d=2){if(n===null||n===undefined||!isFinite(n))return"-";return Number(n).toLocaleString("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(n,d=1){return fmt(n,d)+"%"}
function money(n){return(n>=0?fmt(n,2):"-"+fmt(Math.abs(n),2))+"$"}
function fxReady(){return fx&&fx.rate&&isFinite(fx.rate)&&fx.rate>0}
function tlMoney(n){if(!fxReady())return"TL yok";return(n>=0?fmt(n*fx.rate,2):"-"+fmt(Math.abs(n*fx.rate),2))+" TL"}
function priceDecimals(n){n=Math.abs(Number(n)||0);if(n>=1000)return 2;if(n>=100)return 3;if(n>=1)return 4;if(n>=0.01)return 5;return 8}
function tlDecimals(n){n=Math.abs(Number(n)||0);if(n>=10000)return 2;if(n>=1000)return 2;if(n>=10)return 3;if(n>=1)return 4;return 6}
function trimFixed(n,d){return Number(n).toLocaleString("tr-TR",{minimumFractionDigits:d>4?0:2,maximumFractionDigits:d})}
function tlPrice(n,d=null){if(!fxReady())return"TL yok";const v=n*fx.rate,dd=d===null?tlDecimals(v):d;return trimFixed(v,dd)+" TL"}
function tlInput(n,d=null){if(!fxReady())return"-";const v=n*fx.rate,dd=d===null?tlDecimals(v):d;return trimFixed(v,dd)}
function dualPrice(n,d=null){const dd=d===null?priceDecimals(n):d;return fmt(n,dd)+" USDT / "+tlPrice(n)}
function dualMoney(n){return money(n)+" / "+tlMoney(n)}
function cleanSymbol(s){
  const raw=String(s||"").trim();
  if(!raw)return null;
  // Coin sembolü asla çevrilmez. Çinçe/Türkçe isim alanı gelirse aday dışına alınır.
  if(/[^\x00-\x7F]/.test(raw))return null;
  s=raw.toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!/^[A-Z0-9]{2,14}USDT$/.test(s))return null;
  const base=s.replace(/USDT$/,'');
  if(EXCLUDED_BASES.has(base))return null;
  if(BAD_SUFFIX.some(x=>base.endsWith(x)))return null;
  return s;
}
function symbolLabel(s){return cleanSymbol(s)||"GEÇERSİZ";}
function sanitizeMarketData(){
  const src=(market&&market.data)||{};
  const out={};let bad=0;
  for(const [k,v] of Object.entries(src)){
    const cs=cleanSymbol(k);
    if(!cs){bad++;continue;}
    out[cs]=out[cs]||{};
    for(const tf of TFS){
      const arr=v&&v[tf];
      if(Array.isArray(arr)&&arr.length)out[cs][tf]=arr;
    }
  }
  market.data=out;
  if(bad)scanLog.invalid=(scanLog.invalid||0)+bad;
}
function validCandidateSymbol(x){
  const cs=cleanSymbol(x&&x.sym);
  if(!cs){scanLog.invalid=(scanLog.invalid||0)+1;return null;}
  x.sym=cs;
  return cs;
}
function sourcePriority(src){
  src=String(src||"").toUpperCase();
  if(src.includes("WS"))return 4;
  if(src.includes("REST"))return 3;
  if(src.includes("JSON TAZE"))return 2;
  if(src.includes("TAZE"))return 1;
  return 0;
}

function sourceCap(src){
  src=String(src||"").toUpperCase();
  if(src.includes("WS"))return 94;
  if(src.includes("REST"))return 91;
  if(src.includes("JSON TAZE"))return 88;
  if(src.includes("TAZE"))return 84;
  return 76;
}

const TRADE_MEMORY_KEY="ayaz_trade_v150_trade_memory";
const MAJOR_BASES=new Set(["BTC","ETH","BNB","SOL","XRP","TRX","ADA","DOGE","AVAX","LINK"]);
function baseAsset(sym){return String(cleanSymbol(sym)||sym||"").replace(/USDT$/,'');}
function tfFactor(tf){return tf==="15m"?1:tf==="30m"?1.15:tf==="1h"?1.35:tf==="2h"?1.60:1.90;}
function minStopPctFor(sym,tf){
  const major=MAJOR_BASES.has(baseAsset(sym));
  const base=major?RULE.minStopMajor15m:RULE.minStopAlt15m;
  return base*tfFactor(tf);
}
function loadTradeMemory(){
  try{return JSON.parse(localStorage.getItem(TRADE_MEMORY_KEY)||"[]").filter(x=>x&&x.ts&&x.sym&&x.dir)}catch(e){return []}
}
function saveTradeMemory(arr){
  try{localStorage.setItem(TRADE_MEMORY_KEY,JSON.stringify(arr.slice(-120)))}catch(e){}
}
function recordTradeOutcome(sym,dir,outcome,tf,price){
  sym=cleanSymbol(sym); if(!sym||!dir)return;
  const arr=loadTradeMemory();
  arr.push({sym,dir,outcome:String(outcome||'').toUpperCase(),tf:tf||'',price:Number(price)||null,ts:now()});
  saveTradeMemory(arr);
}
function recentOutcomes(sym,dir,hours=null){
  sym=cleanSymbol(sym); if(!sym)return [];
  const h=hours===null?RULE.sameDirStopLockHours:hours;
  const lim=now()-h*3600000;
  return loadTradeMemory().filter(x=>x.sym===sym&&(!dir||x.dir===dir)&&x.ts>=lim);
}
function localStopEvents(sym,dir){return recentOutcomes(sym,dir,RULE.sameDirStopLockHours).filter(x=>x.outcome==='STOP');}
function localAnySymbolLoss(sym){return recentOutcomes(sym,null,RULE.symbolLossLockHours).filter(x=>x.outcome==='STOP');}
function localStopLocked(x){
  if(!x||!x.sym||!x.dir)return false;
  return localStopEvents(x.sym,x.dir).length>0;
}
function localSymbolHeat(x){
  if(!x||!x.sym)return 0;
  return localAnySymbolLoss(x.sym).length;
}
function localCooldownText(x){
  const stops=localStopEvents(x&&x.sym,x&&x.dir);
  if(!stops.length)return 'Yok';
  const last=Math.max(...stops.map(e=>e.ts));
  const remain=Math.max(0,Math.ceil((last+RULE.sameDirStopLockHours*3600000-now())/60000));
  return `${stops.length} stop | ${remain} dk kilit`;
}
function markSelectedOutcome(outcome){
  if(!selected)return;
  const out=String(outcome||'').toUpperCase();
  recordTradeOutcome(selected.sym,selected.dir,out,selected.tf,selected.entry);
  if(out==='STOP'){
    setMeta(`${symbolLabel(selected.sym)} ${selected.dir} STOP kaydedildi. Aynı coin aynı yön ${RULE.sameDirStopLockHours} saat boyunca listeden çıkarılır.`);
  }else if(out==='TP'){
    setMeta(`${symbolLabel(selected.sym)} ${selected.dir} TP kaydedildi. Hafıza güncellendi.`);
  }else{
    setMeta(`${symbolLabel(selected.sym)} ${selected.dir} işlem sonucu kaydedildi.`);
  }
  sortCandidates();renderList();
  const next=firstAutoCandidateIndex();
  if(next>=0)selectCandidate(next,true);
}
function clearTradeMemory(){
  saveTradeMemory([]);
  setMeta('Stop/TP hafızası temizlendi. Tarama listeleri yeniden düzenlendi.');
  sortCandidates();renderList();
}
function statStopRisk(stat){
  const out={hard:false,cap:99,penalty:0,notes:[],recentStops:0,recentLosses:0,lastStop:false,lastLoss:false};
  if(!stat||!Array.isArray(stat.trades)||!stat.trades.length)return out;
  const recent=stat.trades.slice(-RULE.recentStopLookback);
  const stopLike=t=>String(t.exit||'').includes('STOP')||t.pnl<=-0.80;
  const lossLike=t=>t.pnl<0;
  out.recentStops=recent.filter(stopLike).length;
  out.recentLosses=recent.filter(lossLike).length;
  out.lastStop=stopLike(recent[recent.length-1]);
  out.lastLoss=lossLike(recent[recent.length-1]);
  const last2=recent.slice(-2),last3=recent.slice(-3);
  const backToBackLoss=last2.length===2&&last2.every(lossLike);
  const backToBackStop=last2.length===2&&last2.every(stopLike);
  const threeLoss=last3.length===3&&last3.every(lossLike);
  if(out.lastStop){out.cap=Math.min(out.cap,78);out.penalty+=10;out.notes.push('son benzer sinyal stop');}
  if(backToBackLoss){out.cap=Math.min(out.cap,72);out.penalty+=16;out.notes.push('arka arkaya zarar');}
  if(backToBackStop){out.cap=Math.min(out.cap,68);out.penalty+=22;out.notes.push('arka arkaya stop');out.hard=true;}
  if(threeLoss){out.cap=Math.min(out.cap,66);out.penalty+=24;out.notes.push('3 işlem zarar serisi');out.hard=true;}
  if(out.recentStops>=RULE.maxRecentStops){out.cap=Math.min(out.cap,72);out.penalty+=14;out.notes.push('son işlemlerde stop kümelenmesi');}
  if(out.recentLosses>=RULE.maxRecentLosses){out.cap=Math.min(out.cap,74);out.penalty+=12;out.notes.push('son işlemlerde zarar kümelenmesi');}
  if((stat.fast||0)>RULE.maxFastStopRate){out.cap=Math.min(out.cap,76);out.penalty+=10;out.notes.push('hızlı stop oranı yüksek');}
  return out;
}
function normalizeTradePlan(sym,tf,sig){
  if(!sig||!sig.entry||!isFinite(sig.entry))return sig;
  const minStop=minStopPctFor(sym,tf);
  if(sig.stopPct>0 && sig.stopPct<minStop){
    const r=sig.entry*minStop/100;
    const mult1=Math.max(sig.rr||1.25,1.35), mult2=Math.max(mult1+0.55,2.05), mult3=Math.max(mult2+0.70,2.85);
    if(sig.dir==='LONG'){
      sig.stop=sig.entry-r; sig.t1=sig.entry+r*mult1; sig.t2=sig.entry+r*mult2; sig.t3=sig.entry+r*mult3;
    }else{
      sig.stop=sig.entry+r; sig.t1=sig.entry-r*mult1; sig.t2=sig.entry-r*mult2; sig.t3=sig.entry-r*mult3;
    }
    sig.stopPct=Math.abs(sig.entry-sig.stop)/sig.entry*100;
    sig.rr=Math.abs(sig.t1-sig.entry)/Math.abs(sig.entry-sig.stop);
    sig.noiseAdjusted=true;
    sig.why=[...(sig.why||[]),'noise stop filtresi'];
    scanLog.noiseAdjusted=(scanLog.noiseAdjusted||0)+1;
  }
  return sig;
}
function dataProfile(sym,tf,arr){
  const key=(cleanSymbol(sym)||sym)+"|"+tf;
  const src=sourceMap[key]||"Taze veri";
  const liveStamp=liveMap[key]||pairSourceTime(sym,tf,arr);
  const ageSec=liveStamp?Math.round(sourceAgeMs(liveStamp)/1000):9999;
  const jsonStamp=safeTs(market&&market.generatedAt);
  const jsonAgeSec=jsonStamp?Math.round(sourceAgeMs(jsonStamp)/1000):null;
  let candleSource=src, priceSource=src;
  if(src==="WS"){candleSource="WS kline";priceSource="WS son fiyat";}
  else if(src==="REST"){candleSource="REST mum";priceSource="REST son kapanış";}
  else if(src.includes("JSON")){candleSource="JSON mum";priceSource="JSON son kapanış";}
  return{source:src,candleSource,priceSource,ageSec,jsonAgeSec,sourceCap:sourceCap(src)};
}
function candidateQualityScore(x){
  if(!x)return -999;
  const st=x.stat||{};
  const pf=isFinite(st.pf)?Math.min(st.pf,4):0;
  const win=isFinite(st.win)?st.win:0;
  const count=isFinite(st.count)?st.count:0;
  const mfeMae=st.avgMae?st.avgMfe/Math.max(st.avgMae,.05):0;
  let q=(x.conf||0)*1.35 + sourcePriority(x.source)*2.5 + pf*3.2 + Math.min(win,75)*.08 + Math.min(count,50)*.16 + Math.min(mfeMae,3)*2.2;
  q += Math.max(-2,Math.min(8,((x.rr||1.2)-1.2)*5));
  q -= (x.stopPct||0)*2.2;
  if(x.riskClass==="Orta")q-=5;
  if(x.riskClass==="Yüksek")q-=22;
  if(x.liveOnly)q-=6;
  if((x.ageSec||9999)>60)q-=2;
  if((x.ageSec||9999)>180)q-=5;
  if((x.stopPct||0)>RULE.maxMainStopPct)q-=12;
  const sr=statStopRisk(x.stat);
  q-=sr.penalty||0;
  if(localStopLocked(x))q-=80;
  if(localSymbolHeat(x)>0)q-=8;
  if(x.noiseAdjusted)q-=3;
  return q;
}
function mainListEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if(localStopLocked(x)){scanLog.cooldown=(scanLog.cooldown||0)+1;return false;}
  if((x.stopPct||999)>RULE.maxStopPct)return false;
  if(x.riskClass==="Yüksek")return false;
  if((x.conf||0)<RULE.minConf)return false;
  return true;
}
function riskPriority(r){
  if(r==="Dengeli"||r==="Düşük")return 0;
  if(r==="Orta")return 1;
  return 2;
}
function candidateRank(a,b){
  const sA=(a.selectorScore||0),sB=(b.selectorScore||0);
  const bdA=a.scoreBreakdown||{},bdB=b.scoreBreakdown||{};
  const stA=a.stat||{},stB=b.stat||{};
  const composite=x=>{
    const bd=x.scoreBreakdown||{}, st=x.stat||{};
    return (x.selectorScore||0)*1.00 + (bd.execution||0)*0.23 + (bd.backtest||0)*0.28 + Math.min((st.pf||0),8)*1.7 + Math.max(0,(st.win||0)-50)*0.22 - Math.max(0,(st.fast||0)-15)*0.45 + Math.min((x.tp2RoomR||0),4)*2.2 - (x.stopPct||0)*0.9;
  };
  const ca=composite(a), cb=composite(b); if(Math.abs(cb-ca)>0.001)return cb-ca;
  return sourcePriority(b.source)-sourcePriority(a.source) || (a.stopPct||0)-(b.stopPct||0);
}
function rankedList(dir,limit=7){
  const valid=candidates.filter(x=>x&&x.dir===dir&&validCandidateSymbol(x)&&!localStopLocked(x)).sort(candidateRank);
  const primary=valid.filter(mainListEligible);
  const fallback=valid.filter(x=>!primary.includes(x)).sort(candidateRank);
  return [...primary,...fallback].slice(0,limit);
}
function countByDir(dir){
  const seen=new Set();
  for(const x of candidates){
    if(!x||x.dir!==dir)continue;
    const cs=validCandidateSymbol(x);
    if(!cs)continue;
    seen.add(cs+'|'+x.tf+'|'+x.dir);
  }
  return seen.size;
}
function firstAutoCandidateIndex(){
  const x=rankedList("LONG",1)[0]||rankedList("SHORT",1)[0];
  return x?candidates.indexOf(x):-1;
}
function asArray(x){return Array.isArray(x)?x:(x?[x]:[])}
function safeTs(v){
  if(!v)return 0;
  if(typeof v==="number")return v>1000000000000?v:v*1000;
  const t=Date.parse(v);
  return isFinite(t)?t:0;
}
function pairSourceTime(sym,tf,arr){
  const a=arr||getCandles(sym,tf)||[];
  const last=a[a.length-1]||{};
  // Karar için mum açılışı değil, verinin gerçekten çekildiği liveTime/generatedAt kullanılır.
  const live=Number(last.liveTime)||0;
  const json=safeTs(market&&market.generatedAt)||0;
  return Math.max(live,json);
}
function sourceAgeMs(stamp){
  if(!stamp)return 999999999;
  return Math.max(0,now()-stamp);
}
function pairAgeSeconds(sym,tf,arr){
  const stamp=liveMap[sym+"|"+tf]||pairSourceTime(sym,tf,arr);
  return stamp?Math.round(sourceAgeMs(stamp)/1000):9999;
}
function updateDataBox(){
  const b=$("dataBox"); if(!b)return;
  const ok=dataHealth.json||dataHealth.rest||dataHealth.ws;
  b.innerHTML=`Veri: <b class="${ok?'ok':'bad'}">${ok?'BAĞLI':'BAĞLANMADI'}</b> | JSON: ${dataHealth.json?'OK':'0'} | REST: ${dataHealth.rest?'OK':'0'} | WS: ${dataHealth.ws?'OK':'0'} | Mum: ${dataHealth.candles||0} | Hata: ${dataHealth.lastError||'-'}`;
}
function updateFxBox(){
  const b=$("fxBox"); if(!b)return;
  if(fxReady()){
    b.innerHTML=`Kur: <b>1 USDT ≈ ${fmt(fx.rate,4)} TL</b> | Kaynak: ${fx.source}${fx.ageSec!==null?` | Yaş: ${fx.ageSec} sn`:""}`;
  }else{
    b.textContent="USDT/TRY kuru alınamadı; TL hesapları beklemede.";
  }
}
async function loadUsdTry(){
  // Binance TR için en pratik dönüşüm USDT/TRY'dir. Çünkü uygulama coin fiyatlarını USDT üzerinden üretir.
  if(market.fx && Number(market.fx.usdtTry)>0){
    fx={rate:Number(market.fx.usdtTry),source:market.fx.source||"market.json USDTTRY",updatedAt:market.fx.generatedAt||market.generatedAt||null,ageSec:null};
    updateFxBox();
  }
  const sources=[
    async()=>{const r=await fetch("https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY",{cache:"no-store"});if(!r.ok)throw new Error("data-api USDTTRY");const j=await r.json();return{rate:Number(j.price),source:"Binance USDTTRY"};},
    async()=>{const r=await fetch("https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY",{cache:"no-store"});if(!r.ok)throw new Error("api.binance USDTTRY");const j=await r.json();return{rate:Number(j.price),source:"Binance API USDTTRY"};},
    async()=>{const r=await fetch("https://open.er-api.com/v6/latest/USD",{cache:"no-store"});if(!r.ok)throw new Error("USDTRY");const j=await r.json();return{rate:Number(j.rates&&j.rates.TRY),source:"USDTRY açık kur"};}
  ];
  for(const get of sources){
    try{
      const v=await get();
      if(v.rate>10 && v.rate<250){
        fx={rate:v.rate,source:v.source,updatedAt:new Date().toISOString(),ageSec:0};
        updateFxBox();
        return fx;
      }
    }catch(e){}
  }
  updateFxBox();
  return fx;
}
function setBar(x){$("bar").style.width=Math.max(0,Math.min(100,x))+"%"}function setMeta(t){$("meta").textContent=t}function liveAgeSec(){return wsLast?Math.round((now()-wsLast)/1000):9999}function liveText(){return wsOk?`WS CANLI: son akış ${liveAgeSec()} sn`:(wsLast?`WS KOPTU: son akış ${liveAgeSec()} sn`:"WS bağlanmadı")}function delay(ms){return new Promise(r=>setTimeout(r,ms))}
async function oneClickScan(){
  $("mainBtn").disabled=true;
  candidates=[];
  sourceMap={};
  scanLog={total:0,done:0,rest:0,ws:0,json:0,skipped:0,stale:0,invalid:0,lowQuality:0,highRisk:0,cooldown:0,lossCluster:0,noiseAdjusted:0};
  dataHealth={json:false,rest:false,ws:false,lastError:"-",candles:0};
  updateDataBox();
  $("list").innerHTML="<p>Veri bağlantısı kuruluyor: JSON → REST → WS kontrol ediliyor...</p>";
  setBar(1);
  await loadMarketJson();
  await loadUsdTry();
  await loadDynamicUniverse();
  if(!SYMBOLS.length){
    $("list").innerHTML="<p>Coin evreni alınamadı. İnternet/Binance erişimini kontrol et.</p>";
    setMeta("Dinamik coin listesi alınamadı.");
    $("mainBtn").disabled=false;
    return;
  }
  startWS();
  setMeta("Ön veri testi yapılıyor...");
  const probe=SYMBOLS.slice(0,6);
  for(const s of probe){await ensureCandles(s,"15m");await delay(60)}
  await preloadCoreData();
  await delay(500);
  await scanAll();
  $("mainBtn").disabled=false;
}
async function loadMarketJson(){
  setMeta("market.json yükleniyor...");
  dataHealth.lastError="-";
  try{
    const r=await fetch("data/market.json?v="+Date.now(),{cache:"no-store"});
    if(r.ok){
      const j=await r.json();
      if(j&&j.data){
        market=j; dataHealth.json=true;
        dataHealth.candles=Object.values(market.data||{}).reduce((a,tfs)=>a+Object.values(tfs||{}).reduce((b,arr)=>b+(Array.isArray(arr)?arr.length:0),0),0);
      }else dataHealth.lastError="market.json boş";
    }else dataHealth.lastError="market.json HTTP "+r.status;
  }catch(e){dataHealth.lastError="market.json okunamadı"}
  if(!market.data)market.data={};
  sanitizeMarketData();
  if(market.fx&&Number(market.fx.usdtTry)>0){
    fx={rate:Number(market.fx.usdtTry),source:market.fx.source||"market.json USDTTRY",updatedAt:market.fx.generatedAt||market.generatedAt||null,ageSec:null};
    updateFxBox();
  }
  updateDataBox();
}
async function loadDynamicUniverse(){
  setMeta("Binance dinamik coin evreni hazırlanıyor...");
  try{
    const [exRes,tkRes]=await Promise.all([
      fetch("https://data-api.binance.vision/api/v3/exchangeInfo",{cache:"no-store"}),
      fetch("https://data-api.binance.vision/api/v3/ticker/24hr",{cache:"no-store"})
    ]);
    if(!tkRes.ok)throw new Error("ticker");
    const tickers=await tkRes.json();
    let allowed=null;
    if(exRes.ok){
      const ex=await exRes.json();
      allowed=new Set((ex.symbols||[]).filter(x=>x.status==="TRADING"&&x.quoteAsset==="USDT"&&(x.isSpotTradingAllowed!==false)).map(x=>x.symbol));
    }
    const picked=tickers.filter(t=>{
      const sym=t.symbol||"";
      if(!sym.endsWith("USDT"))return false;
      if(allowed && !allowed.has(sym))return false;
      const base=sym.replace(/USDT$/,'');
      if(EXCLUDED_BASES.has(base))return false;
      if(BAD_SUFFIX.some(s=>base.endsWith(s)))return false;
      const qv=Number(t.quoteVolume||0),last=Number(t.lastPrice||0),trades=Number(t.count||0);
      return qv>2500000 && last>0 && trades>1000;
    }).sort((a,b)=>Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,UNIVERSE_LIMIT).map(t=>t.symbol);
    if(picked.length>=40){SYMBOLS=picked;setMeta(`Dinamik evren hazır: ${SYMBOLS.length} likit USDT coin seçildi.`);return;}
  }catch(e){/* fallback aşağıda */}
  const fromJson=[...new Set(Object.keys(market.data||{}).map(cleanSymbol).filter(Boolean))];
  if(fromJson.length>=40){SYMBOLS=fromJson.slice(0,UNIVERSE_LIMIT);setMeta(`Dinamik evren market.json içinden alındı: ${SYMBOLS.length} coin.`);return;}
  SYMBOLS=[...DEFAULT_SYMBOLS];
  setMeta(`Dinamik evren alınamadı, güvenli yedek liste kullanılıyor: ${SYMBOLS.length} coin.`);
}
function startWS(){
  try{for(const w of wsList)w.close()}catch(e){}
  wsList=[];wsOk=false;
  const streams=[];
  for(const s of SYMBOLS){for(const tf of TFS)streams.push(s.toLowerCase()+"@kline_"+tf)}
  const chunks=[];for(let i=0;i<streams.length;i+=160)chunks.push(streams.slice(i,i+160));
  let openCount=0;
  for(const part of chunks){
    try{
      const url="wss://data-stream.binance.vision/stream?streams="+part.join("/");
      const w=new WebSocket(url);
      w.onopen=()=>{openCount++;wsOk=true;wsLast=now();setMeta(`${liveText()} | WS bağlantı ${openCount}/${chunks.length} | Dinamik tarama devam ediyor...`)};
      w.onmessage=ev=>{
        try{
          const msg=JSON.parse(ev.data),d=msg.data||msg;
          if(d.e==="kline"&&d.k){
            const k=d.k,s=k.s,tf=k.i;
            const candle={time:+k.t,open:+k.o,high:+k.h,low:+k.l,close:+k.c,volume:+k.v,liveTime:+d.E||now(),closed:!!k.x};
            market.data[s]=market.data[s]||{};
            const arr=market.data[s][tf]||[];
            if(arr.length&&arr[arr.length-1].time===candle.time)arr[arr.length-1]=candle;else{arr.push(candle);if(arr.length>900)arr.shift()}
            market.data[s][tf]=arr;wsLast=now();liveMap[s+'|'+tf]=now();sourceMap[s+'|'+tf]='WS';
          }
        }catch(e){}
      };
      w.onerror=()=>{};
      w.onclose=()=>{openCount=Math.max(0,openCount-1);wsOk=openCount>0};
      wsList.push(w);
    }catch(e){}
  }
}
function getCandles(s,tf){return market?.data?.[s]?.[tf]||[]}async function ensureCandles(s,tf){
  s=cleanSymbol(s); if(!s)return [];
  let arr=getCandles(s,tf);
  const key=s+"|"+tf;
  let pairLive=liveMap[key]||pairSourceTime(s,tf,arr);
  let ageMs=sourceAgeMs(pairLive);

  // v14.4: Sadece 5 dakikadan taze kaynak işlem üretimine girebilir.
  // JSON tazeyse kullanılır; eskiyse sadece arşiv/teşhis olarak kalır.
  if(arr.length>=220 && pairLive && ageMs<=RULE.maxLiveAgeMs){
    liveMap[key]=pairLive;
    if(sourceMap[key]==='WS'){scanLog.ws++;dataHealth.ws=true;}
    else if(sourceMap[key]==='REST'){scanLog.rest++;dataHealth.rest=true;}
    else {sourceMap[key]='JSON TAZE';scanLog.json++;dataHealth.json=true;}
    updateDataBox(); return arr;
  }

  const urls=[
    `https://data-api.binance.vision/api/v3/klines?symbol=${s}&interval=${tf}&limit=700`,
    `https://api.binance.com/api/v3/klines?symbol=${s}&interval=${tf}&limit=700`
  ];
  for(const url of urls){
    try{
      const r=await fetch(url,{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const raw=await r.json();
      const fresh=raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],liveTime:now()}));
      if(fresh.length>=220){
        market.data[s]=market.data[s]||{};
        market.data[s][tf]=fresh;
        liveMap[key]=now();sourceMap[key]='REST'; wsLast=now(); scanLog.rest++;
        dataHealth.rest=true; dataHealth.candles+=fresh.length; dataHealth.lastError="-"; updateDataBox();
        return fresh;
      }
    }catch(e){dataHealth.lastError=`${s} ${tf} REST hata`;updateDataBox()}
  }

  arr=getCandles(s,tf);
  if(arr&&arr.length>=220){
    pairLive=pairSourceTime(s,tf,arr);
    ageMs=sourceAgeMs(pairLive);
    scanLog.json++; scanLog.stale++; dataHealth.json=true;
    dataHealth.lastError=`${s} ${tf} JSON eski ${Math.round(ageMs/1000)} sn - işlem kapalı`;
    updateDataBox();
    return arr;
  }
  scanLog.skipped++;
  return arr||[];
}

async function preloadCoreData(){
  setMeta("Çekirdek veri hazırlanıyor: BTC ve üst zaman dilimleri...");
  for(const tf of TFS){await ensureCandles("BTCUSDT",tf); await delay(10)}
}
function ema(v,l){const k=2/(l+1);let o=[],p=v[0]||0;v.forEach((x,i)=>{p=i?x*k+p*(1-k):x;o.push(p)});return o}
function sma(v,l){return v.map((_,i)=>i<l-1?null:v.slice(i-l+1,i+1).reduce((a,b)=>a+b,0)/l)}
function stdev(v,l){return v.map((_,i)=>{if(i<l-1)return null;const a=v.slice(i-l+1,i+1),m=a.reduce((x,y)=>x+y,0)/l;return Math.sqrt(a.reduce((x,y)=>x+(y-m)*(y-m),0)/l)})}
function atr(c,l=14){let tr=c.map((x,i)=>i?Math.max(x.high-x.low,Math.abs(x.high-c[i-1].close),Math.abs(x.low-c[i-1].close)):x.high-x.low);return ema(tr,l)}
function rsi(v,l=14){let out=Array(v.length).fill(50),g=0,ls=0;for(let i=1;i<v.length;i++){let ch=v[i]-v[i-1],gg=Math.max(ch,0),ll=Math.max(-ch,0);if(i<=l){g+=gg;ls+=ll;if(i===l){g/=l;ls/=l}}else{g=(g*(l-1)+gg)/l;ls=(ls*(l-1)+ll)/l}if(i>=l){let rs=ls===0?99:g/ls;out[i]=100-100/(1+rs)}}return out}
function macd(v){const a=ema(v,12),b=ema(v,26),line=v.map((_,i)=>a[i]-b[i]),sig=ema(line,9);return line.map((x,i)=>x-sig[i])}
function dmi(c,l=14){let plus=[],minus=[],tr=[];for(let i=0;i<c.length;i++){if(!i){plus.push(0);minus.push(0);tr.push(c[i].high-c[i].low);continue}let up=c[i].high-c[i-1].high,dn=c[i-1].low-c[i].low;plus.push(up>dn&&up>0?up:0);minus.push(dn>up&&dn>0?dn:0);tr.push(Math.max(c[i].high-c[i].low,Math.abs(c[i].high-c[i-1].close),Math.abs(c[i].low-c[i-1].close)))}const atrv=ema(tr,l),pdm=ema(plus,l),mdm=ema(minus,l);let pdi=pdm.map((x,i)=>atrv[i]?100*x/atrv[i]:0),mdi=mdm.map((x,i)=>atrv[i]?100*x/atrv[i]:0);let dx=pdi.map((x,i)=>{let s=x+mdi[i];return s?100*Math.abs(x-mdi[i])/s:0});let adx=ema(dx,l);return{pdi,mdi,adx}}
function cmf(c,l=20){let out=[];for(let i=0;i<c.length;i++){if(i<l-1){out.push(0);continue}let mfv=0,vol=0;for(let j=i-l+1;j<=i;j++){let r=c[j].high-c[j].low,m=r?((c[j].close-c[j].low)-(c[j].high-c[j].close))/r:0;mfv+=m*c[j].volume;vol+=c[j].volume}out.push(vol?mfv/vol:0)}return out}
function obv(c){let o=[0];for(let i=1;i<c.length;i++){o.push(o[i-1]+(c[i].close>c[i-1].close?c[i].volume:c[i].close<c[i-1].close?-c[i].volume:0))}return o}
function hi(c,i,l,k="high"){let s=Math.max(0,i-l+1),m=-Infinity;for(let j=s;j<=i;j++)m=Math.max(m,c[j][k]);return m}
function lo(c,i,l,k="low"){let s=Math.max(0,i-l+1),m=Infinity;for(let j=s;j<=i;j++)m=Math.min(m,c[j][k]);return m}
function enrich(c){const cl=c.map(x=>x.close),vol=c.map(x=>x.volume);const e9=ema(cl,9),e21=ema(cl,21),e55=ema(cl,55),e100=ema(cl,100),e200=ema(cl,200),s20=sma(cl,20),s50=sma(cl,50),sd20=stdev(cl,20),a=atr(c,14),rs=rsi(cl,14),mh=macd(cl),v20=sma(vol,20),dm=dmi(c,14),cm=cmf(c,20),ob=obv(c);return c.map((x,i)=>{let mid=s20[i]||x.close,sd=sd20[i]||0,up=mid+sd*2,loB=mid-sd*2,width=mid?((up-loB)/mid*100):0;return{...x,e9:e9[i],e21:e21[i],e55:e55[i],e100:e100[i],e200:e200[i],s20:s20[i],s50:s50[i],bbMid:mid,bbUp:up,bbLo:loB,bbWidth:width,atr:a[i],rsi:rs[i],macd:mh[i],v20:v20[i],pdi:dm.pdi[i],mdi:dm.mdi[i],adx:dm.adx[i],cmf:cm[i],obv:ob[i],obvSlope:i>8?ob[i]-ob[i-8]:0,sup:lo(c,i,80),res:hi(c,i,80),sup34:lo(c,i,34),res34:hi(c,i,34),donHi:hi(c,i,40),donLo:lo(c,i,40)}})}

function swingPoints(c,i,L=3,R=1,look=140){
  const highs=[],lows=[];const start=Math.max(L,i-look);
  for(let k=start;k<=i-R;k++){
    let ph=true,pl=true;
    for(let j=k-L;j<=k+R;j++){if(j<0||j>=c.length)continue;if(c[j].high>c[k].high)ph=false;if(c[j].low<c[k].low)pl=false}
    if(ph)highs.push({idx:k,v:c[k].high}); if(pl)lows.push({idx:k,v:c[k].low});
  }
  return{highs,lows,lastHigh:highs[highs.length-1],lastLow:lows[lows.length-1]}
}
function marketStructure(c,i){
  const sw=swingPoints(c,i,3,1,160),hs=sw.highs,ls=sw.lows,x=c[i],p=c[i-1];
  const h1=hs[hs.length-1],h2=hs[hs.length-2],l1=ls[ls.length-1],l2=ls[ls.length-2];
  const higherHigh=h1&&h2&&h1.v>h2.v, higherLow=l1&&l2&&l1.v>l2.v, lowerHigh=h1&&h2&&h1.v<h2.v, lowerLow=l1&&l2&&l1.v<l2.v;
  const up=!!(higherHigh&&higherLow), down=!!(lowerHigh&&lowerLow);
  const bosUp=h1&&x.close>h1.v&&p.close<=h1.v, bosDown=l1&&x.close<l1.v&&p.close>=l1.v;
  const chochUp=down&&h1&&x.close>h1.v, chochDown=up&&l1&&x.close<l1.v;
  return{...sw,up,down,bosUp,bosDown,chochUp,chochDown,higherHigh,higherLow,lowerHigh,lowerLow};
}
function zoneStrength(c,i,level,kind){
  const a=c[i].atr||c[i].high-c[i].low||1;let touches=0,vol=0;
  for(let k=Math.max(0,i-120);k<=i;k++){
    const near=kind==="sup"?Math.abs(c[k].low-level)<=a*.75:Math.abs(c[k].high-level)<=a*.75;
    if(near){touches++;vol+=c[k].volume||0}
  }
  return{touches,ok:touches>=RULE.minZoneTouch,vol};
}
function microCandle(c,i,dir){const x=c[i],p=c[i-1];const body=Math.abs(x.close-x.open),range=Math.max(x.high-x.low,1e-9);const upper=x.high-Math.max(x.open,x.close),lower=Math.min(x.open,x.close)-x.low;const strongBody=body/range>.45,wickRejectShort=upper/range>.38&&x.close<x.open,wickRejectLong=lower/range>.38&&x.close>x.open;const engulfShort=x.close<x.open&&p.close>p.open&&x.close<p.open&&x.open>p.close;const engulfLong=x.close>x.open&&p.close<p.open&&x.close>p.open&&x.open<p.close;const threeDown=x.close<p.close&&p.close<c[i-2].close,threeUp=x.close>p.close&&p.close>c[i-2].close;if(dir==="SHORT")return(wickRejectShort||engulfShort||threeDown||strongBody&&x.close<x.open);return(wickRejectLong||engulfLong||threeUp||strongBody&&x.close>x.open)}
function signal(c,i,model){
  if(i<190)return null;
  const x=c[i],p=c[i-1],p2=c[i-2],p3=c[i-3],a=x.atr||x.high-x.low||1;
  const ms=marketStructure(c,i);
  const zSup=zoneStrength(c,i,ms.lastLow?ms.lastLow.v:x.sup34,"sup"), zRes=zoneStrength(c,i,ms.lastHigh?ms.lastHigh.v:x.res34,"res");
  const volOk=!x.v20||x.volume>=x.v20*.78, volStrong=!x.v20||x.volume>=x.v20*1.08;
  const up=x.e21>x.e55&&x.close>x.e21, down=x.e21<x.e55&&x.close<x.e21;
  const strongUp=x.e21>x.e55&&x.e55>x.e100&&x.close>x.e21&&x.e100>=x.e200*.985;
  const strongDown=x.e21<x.e55&&x.e55<x.e100&&x.close<x.e21&&x.e100<=x.e200*1.015;
  const pivotSup=ms.lastLow?ms.lastLow.v:x.sup34, pivotRes=ms.lastHigh?ms.lastHigh.v:x.res34;
  const nearSup=Math.abs(x.low-pivotSup)<=a*1.05||Math.abs(x.close-x.sup34)<=a*.85;
  const nearRes=Math.abs(x.high-pivotRes)<=a*1.05||Math.abs(x.close-x.res34)<=a*.85;
  const sweepLow=x.low<lo(c,i-1,28)&&x.close>p.close&&x.close>x.low+a*.35;
  const sweepHigh=x.high>hi(c,i-1,28)&&x.close<p.close&&x.high-x.close>a*.35;
  const bullFvg=p2.high<x.low||(p3.high<p.low&&x.close>p3.high), bearFvg=p2.low>x.high||(p3.low>p.high&&x.close<p3.low);
  const pullLong=up&&x.low<=x.e21+a*.65&&x.close>x.e21;
  const pullShort=down&&x.high>=x.e21-a*.65&&x.close<x.e21;
  const brk=x.close>hi(c,i-1,45)&&volOk&&x.close>x.e21, brd=x.close<lo(c,i-1,45)&&volOk&&x.close<x.e21;
  const squeeze=x.bbWidth<4.2 || (p.bbWidth&&x.bbWidth<p.bbWidth*.92);
  const structureLong=ms.up||ms.bosUp||ms.chochUp||(nearSup&&zSup.ok&&!ms.down);
  const structureShort=ms.down||ms.bosDown||ms.chochDown||(nearRes&&zRes.ok&&!ms.up);
  const momentumLong=(x.rsi>50&&x.macd>=p.macd)||(x.rsi>55&&x.pdi>x.mdi);
  const momentumShort=(x.rsi<50&&x.macd<=p.macd)||(x.rsi<45&&x.mdi>x.pdi);
  const moneyLong=x.cmf>-0.05&&x.obvSlope>=0, moneyShort=x.cmf<0.05&&x.obvSlope<=0;
  const trendLong=strongUp||up&&x.close>x.e100||ms.bosUp, trendShort=strongDown||down&&x.close<x.e100||ms.bosDown;
  const locLong=nearSup||bullFvg||sweepLow||pullLong||brk, locShort=nearRes||bearFvg||sweepHigh||pullShort||brd;
  const hiddenCandleLong=microCandle(c,i,"LONG")||x.close>p.high||x.close>x.open&&x.close>p.close;
  const hiddenCandleShort=microCandle(c,i,"SHORT")||x.close<p.low||x.close<x.open&&x.close<p.close;
  let dir=model.includes("LONG")?"LONG":"SHORT",why=[],ok=false,sub=[];
  if(dir==="LONG"){
    if(trendLong)why.push("trend"); if(structureLong)why.push("piyasa yapısı"); if(locLong)why.push("lokasyon"); if(momentumLong)why.push("momentum"); if(moneyLong)why.push("para akışı"); if(volOk)why.push("hacim"); if(hiddenCandleLong)why.push("tetik");
    if(nearSup)sub.push("destek bölgesi"); if(bullFvg)sub.push("bullish FVG"); if(sweepLow)sub.push("alt likidite dönüşü"); if(pullLong)sub.push("EMA pullback"); if(brk)sub.push("BOS/kırılım"); if(squeeze&&brk)sub.push("sıkışma-kırılım");
    ok=why.length>=RULE.minConfluence&&trendLong&&structureLong&&locLong&&momentumLong&&hiddenCandleLong&&moneyLong;
  }else{
    if(trendShort)why.push("trend"); if(structureShort)why.push("piyasa yapısı"); if(locShort)why.push("lokasyon"); if(momentumShort)why.push("momentum"); if(moneyShort)why.push("para akışı"); if(volOk)why.push("hacim"); if(hiddenCandleShort)why.push("tetik");
    if(nearRes)sub.push("direnç bölgesi"); if(bearFvg)sub.push("bearish FVG"); if(sweepHigh)sub.push("üst likidite dönüşü"); if(pullShort)sub.push("EMA pullback"); if(brd)sub.push("BOS/kırılım"); if(squeeze&&brd)sub.push("sıkışma-kırılım");
    ok=why.length>=RULE.minConfluence&&trendShort&&structureShort&&locShort&&momentumShort&&hiddenCandleShort&&moneyShort;
  }
  if(!ok)return null;
  const entry=x.close;let stop,t1,t2,t3,r,struct;
  if(dir==="LONG"){
    struct=Math.min(x.low-a*.22,pivotSup-a*.12,x.e55-a*.10);
    r=Math.max(entry-struct,a*.58); stop=entry-r; t1=entry+r*1.55; t2=entry+r*2.25; t3=entry+r*3.15;
  }else{
    struct=Math.max(x.high+a*.22,pivotRes+a*.12,x.e55+a*.10);
    r=Math.max(struct-entry,a*.58); stop=entry+r; t1=entry-r*1.55; t2=entry-r*2.25; t3=entry-r*3.15;
  }
  const stopPct=Math.abs(entry-stop)/entry*100,rr=Math.abs(t1-entry)/Math.abs(entry-stop);
  const q=rawQuality(c,i,dir,why,stopPct,rr,volOk,sub,ms,volStrong);
  return {model:"Bağlı Strateji "+dir,sub:sub.slice(0,3).join(" + ")||"bağlı kurgu",dir,entry,stop,t1,t2,t3,atr:a,stopPct,rr,why,q,ms}
}
function rawQuality(c,i,dir,why,stopPct,rr,volOk,sub=[],ms={},volStrong=false){
  const x=c[i];let q=32+why.length*5.5+sub.length*4.5;
  if(dir==="LONG"){
    if(x.e21>x.e55)q+=5;if(x.e55>x.e100)q+=5;if(x.close>x.e21)q+=4;if(ms.up||ms.bosUp||ms.chochUp)q+=8;if(x.rsi>52)q+=4;if(x.macd>0)q+=3;if(x.pdi>x.mdi)q+=4;if(x.cmf>0)q+=4;if(x.obvSlope>0)q+=3;
  }else{
    if(x.e21<x.e55)q+=5;if(x.e55<x.e100)q+=5;if(x.close<x.e21)q+=4;if(ms.down||ms.bosDown||ms.chochDown)q+=8;if(x.rsi<48)q+=4;if(x.macd<0)q+=3;if(x.mdi>x.pdi)q+=4;if(x.cmf<0)q+=4;if(x.obvSlope<0)q+=3;
  }
  if(volOk)q+=3;if(volStrong)q+=3;if(x.adx>18)q+=4;if(x.adx>25)q+=3;
  if(stopPct<=2.0)q+=9;else if(stopPct<=RULE.maxStopPct)q+=4;else q-=24;
  if(rr>=2.1)q+=8;else if(rr>=RULE.minRR)q+=4;
  return Math.max(0,Math.min(100,q));
}

// v10: Sadece son mumdaki kusursuz tetiği bekleme.
// Gerçek piyasada 150 parite/TF taranırken kusursuz tetik her dakika gelmez.
// Bu fonksiyon mevcut bağlamdan işlem fırsatı üretir; güven puanı düşükse zaten aşağı sıralanır.
function setupOpportunitySignal(c,i,dir){
  if(i<190)return null;
  const x=c[i],p=c[i-1],p2=c[i-2],p3=c[i-3],a=x.atr||x.high-x.low||1;
  const ms=marketStructure(c,i);
  const zSup=zoneStrength(c,i,ms.lastLow?ms.lastLow.v:x.sup34,"sup"), zRes=zoneStrength(c,i,ms.lastHigh?ms.lastHigh.v:x.res34,"res");
  const volOk=!x.v20||x.volume>=x.v20*.62, volStrong=!x.v20||x.volume>=x.v20*.95;
  const up=x.e21>x.e55&&x.close>x.e21, down=x.e21<x.e55&&x.close<x.e21;
  const strongUp=x.e21>x.e55&&x.e55>x.e100&&x.close>x.e21;
  const strongDown=x.e21<x.e55&&x.e55<x.e100&&x.close<x.e21;
  const pivotSup=ms.lastLow?ms.lastLow.v:x.sup34, pivotRes=ms.lastHigh?ms.lastHigh.v:x.res34;
  const nearSup=Math.abs(x.low-pivotSup)<=a*1.45||Math.abs(x.close-x.sup34)<=a*1.15;
  const nearRes=Math.abs(x.high-pivotRes)<=a*1.45||Math.abs(x.close-x.res34)<=a*1.15;
  const sweepLow=x.low<lo(c,i-1,28)&&x.close>x.low+a*.25;
  const sweepHigh=x.high>hi(c,i-1,28)&&x.high-x.close>a*.25;
  const bullFvg=p2.high<x.low||(p3.high<p.low&&x.close>p3.high), bearFvg=p2.low>x.high||(p3.low>p.high&&x.close<p3.low);
  const pullLong=(x.e21>=x.e55*.995)&&x.low<=x.e21+a*.95&&x.close>=x.e21-a*.25;
  const pullShort=(x.e21<=x.e55*1.005)&&x.high>=x.e21-a*.95&&x.close<=x.e21+a*.25;
  const brk=x.close>hi(c,i-1,45)&&volOk, brd=x.close<lo(c,i-1,45)&&volOk;
  const structureLong=ms.up||ms.bosUp||ms.chochUp||(nearSup&&(zSup.ok||zSup.touches>=1)&&!ms.down);
  const structureShort=ms.down||ms.bosDown||ms.chochDown||(nearRes&&(zRes.ok||zRes.touches>=1)&&!ms.up);
  const momentumLong=(x.rsi>47&&x.macd>=p.macd-a/1800)||(x.rsi>52)||(x.pdi>x.mdi&&x.rsi>44);
  const momentumShort=(x.rsi<53&&x.macd<=p.macd+a/1800)||(x.rsi<48)||(x.mdi>x.pdi&&x.rsi<56);
  const moneyLong=x.cmf>-0.12||x.obvSlope>=0;
  const moneyShort=x.cmf<0.12||x.obvSlope<=0;
  const trendLong=strongUp||up||ms.bosUp||(x.close>x.e100&&x.e21>x.e55*.99);
  const trendShort=strongDown||down||ms.bosDown||(x.close<x.e100&&x.e21<x.e55*1.01);
  const locLong=nearSup||bullFvg||sweepLow||pullLong||brk;
  const locShort=nearRes||bearFvg||sweepHigh||pullShort||brd;
  const hiddenLong=microCandle(c,i,"LONG")||x.close>p.close||x.close>x.open;
  const hiddenShort=microCandle(c,i,"SHORT")||x.close<p.close||x.close<x.open;
  let why=[],sub=[];
  if(dir==="LONG"){
    if(trendLong)why.push("trend"); if(structureLong)why.push("yapı"); if(locLong)why.push("lokasyon"); if(momentumLong)why.push("momentum"); if(moneyLong)why.push("para akışı"); if(volOk)why.push("hacim"); if(hiddenLong)why.push("tetik yakın");
    if(nearSup)sub.push("Destek Tepki"); if(bullFvg)sub.push("FVG Devam"); if(sweepLow)sub.push("Likidite Dönüş"); if(pullLong)sub.push("Pullback"); if(brk)sub.push("Breakout");
    if(!(trendLong&&(structureLong||locLong)&&momentumLong&&moneyLong))return null;
  }else{
    if(trendShort)why.push("trend"); if(structureShort)why.push("yapı"); if(locShort)why.push("lokasyon"); if(momentumShort)why.push("momentum"); if(moneyShort)why.push("para akışı"); if(volOk)why.push("hacim"); if(hiddenShort)why.push("tetik yakın");
    if(nearRes)sub.push("Direnç Reddi"); if(bearFvg)sub.push("FVG Devam"); if(sweepHigh)sub.push("Likidite Dönüş"); if(pullShort)sub.push("Pullback"); if(brd)sub.push("Breakdown");
    if(!(trendShort&&(structureShort||locShort)&&momentumShort&&moneyShort))return null;
  }
  if(why.length<RULE.minConfluence)return null;
  const entry=x.close; let stop,t1,t2,t3,r,struct;
  if(dir==="LONG"){
    struct=Math.min(x.low-a*.18,pivotSup-a*.10,x.e55-a*.08);
    r=Math.max(entry-struct,a*.50); stop=entry-r; t1=entry+r*1.35; t2=entry+r*2.00; t3=entry+r*2.85;
  }else{
    struct=Math.max(x.high+a*.18,pivotRes+a*.10,x.e55+a*.08);
    r=Math.max(struct-entry,a*.50); stop=entry+r; t1=entry-r*1.35; t2=entry-r*2.00; t3=entry-r*2.85;
  }
  const stopPct=Math.abs(entry-stop)/entry*100, rr=Math.abs(t1-entry)/Math.abs(entry-stop);
  const q=rawQuality(c,i,dir,why,stopPct,rr,volOk,sub,ms,volStrong)+(hiddenLong&&dir==="LONG"?3:0)+(hiddenShort&&dir==="SHORT"?3:0);
  const name=(sub[0]||"Hibrit")+" "+dir;
  return {model:name,sub:sub.slice(1,3).join(" + ")||"tek tuş fırsat",dir,entry,stop,t1,t2,t3,atr:a,stopPct,rr,why,q:Math.max(0,Math.min(100,q)),ms};
}
function simulate(c,sig,start){
  const risk=Math.abs(sig.entry-sig.stop);if(!risk)return null;
  let mfe=0,mae=0,exit="ZAMAN",pnl=-.05,bars=0,trail=false,peakR=0;
  for(let j=start+1;j<Math.min(c.length,start+90);j++){
    const x=c[j];bars++;
    if(sig.dir==="LONG"){
      const favorable=(x.high-sig.entry)/risk, adverse=(sig.entry-x.low)/risk;mfe=Math.max(mfe,favorable);mae=Math.max(mae,adverse);peakR=Math.max(peakR,favorable);
      if(x.low<=sig.stop){exit=bars<=4?"HIZLI STOP":"STOP";pnl=-1;break}
      if(x.high>=sig.t3){exit="TP3";pnl=3.15;break}
      if(x.high>=sig.t2){exit="TP2";pnl=2.25;break}
      if(x.high>=sig.t1)trail=true;
      if(trail&&x.close<sig.entry+risk*.25){exit="BE/STOP";pnl=.32;break}
      if(peakR>=1.05&&favorable<peakR*.45&&bars>5){exit="DİNAMİK ÇIKIŞ";pnl=Math.max(.25,peakR*.45);break}
      if(bars>18&&mfe<.45){exit="ZAMAN";pnl=-.15;break}
    }else{
      const favorable=(sig.entry-x.low)/risk, adverse=(x.high-sig.entry)/risk;mfe=Math.max(mfe,favorable);mae=Math.max(mae,adverse);peakR=Math.max(peakR,favorable);
      if(x.high>=sig.stop){exit=bars<=4?"HIZLI STOP":"STOP";pnl=-1;break}
      if(x.low<=sig.t3){exit="TP3";pnl=3.15;break}
      if(x.low<=sig.t2){exit="TP2";pnl=2.25;break}
      if(x.low<=sig.t1)trail=true;
      if(trail&&x.close>sig.entry-risk*.25){exit="BE/STOP";pnl=.32;break}
      if(peakR>=1.05&&favorable<peakR*.45&&bars>5){exit="DİNAMİK ÇIKIŞ";pnl=Math.max(.25,peakR*.45);break}
      if(bars>18&&mfe<.45){exit="ZAMAN";pnl=-.15;break}
    }
  }
  if(exit==="ZAMAN"){
    const last=c[Math.min(c.length-1,start+90)].close;
    const r=sig.dir==="LONG"?(last-sig.entry)/risk:(sig.entry-last)/risk;
    pnl=Math.max(-.30,Math.min(1.25,r));
  }
  return{date:new Date(c[start].time).toLocaleDateString("tr-TR"),dir:sig.dir,exit,pnl,mfe,mae,bars}
}
function calcStats(model,tr){const count=tr.length,w=tr.filter(x=>x.pnl>0).length,win=count?w/count*100:0;const grossWin=tr.filter(x=>x.pnl>0).reduce((a,b)=>a+b.pnl,0),grossLoss=Math.abs(tr.filter(x=>x.pnl<0).reduce((a,b)=>a+b.pnl,0));const net=tr.reduce((a,b)=>a+b.pnl,0),pf=grossLoss===0&&grossWin>0?20:grossLoss===0?0:grossWin/grossLoss;const avgMfe=count?tr.reduce((a,b)=>a+b.mfe,0)/count:0,avgMae=count?tr.reduce((a,b)=>a+b.mae,0)/count:0,fast=count?tr.filter(x=>x.exit==="HIZLI STOP").length/count*100:0;return{model,count,win,net,pf,avgMfe,avgMae,fast,trades:tr}}
function backtest(sym,tf){const raw=getCandles(sym,tf);if(!raw||raw.length<240)return null;const c=enrich(raw),map={"Bağlı Strateji LONG":[],"Bağlı Strateji SHORT":[]};let cd=0;for(let i=170;i<c.length-2;i++){if(cd>0){cd--;continue}const sigs=MODELS.map(m=>signal(c,i,m)).filter(Boolean).filter(s=>s.stopPct<=RULE.maxStopPct*1.35).sort((a,b)=>b.q-a.q);if(!sigs.length)continue;const sig=sigs[0],tr=simulate(c,sig,i);if(!tr)continue;map[sig.model]=map[sig.model]||[];map[sig.model].push(tr);cd=RULE.cooldown}const stats=Object.keys(map).map(m=>calcStats(m,map[m])).filter(s=>s.count>0).sort((a,b)=>modelScore(b)-modelScore(a));return{sym,tf,candles:c,stats}}
function modelScore(s){const mfeMae=s.avgMfe/Math.max(s.avgMae,.05);return Math.min(s.pf,5)*12+s.win*.22+s.net*2.2+mfeMae*8-s.fast*.35+(s.count>=RULE.minTrades?12:0)}
function confidenceCaps(sig,stat,rawConf,mfeMae){
  let cap=RULE.maxConf,notes=[];
  // v12: güven puanı artık “sinyal heyecanı” değil, istatistik + risk tavanıdır.
  if(stat.count<8){cap=Math.min(cap,74);notes.push("işlem sayısı çok az")}
  else if(stat.count<12){cap=Math.min(cap,80);notes.push("işlem sayısı az")}
  else if(stat.count<20){cap=Math.min(cap,86);notes.push("örneklem orta")}
  else if(stat.count<30){cap=Math.min(cap,89);notes.push("30 altı örneklem")}
  if(stat.win<50){cap=Math.min(cap,72);notes.push("win zayıf")}
  else if(stat.win<55){cap=Math.min(cap,78);notes.push("win sınırlı")}
  else if(stat.win<60){cap=Math.min(cap,82);notes.push("win orta")}
  else if(stat.win<65){cap=Math.min(cap,86);notes.push("win iyi ama %90 değil")}
  else if(stat.win<70){cap=Math.min(cap,90);notes.push("win 70 altı")}
  if(stat.pf<1.15){cap=Math.min(cap,76);notes.push("PF zayıf")}
  else if(stat.pf<1.50){cap=Math.min(cap,84);notes.push("PF orta")}
  else if(stat.pf<2.00){cap=Math.min(cap,90);notes.push("PF iyi")}
  if(mfeMae<0.90){cap=Math.min(cap,76);notes.push("MFE/MAE zayıf")}
  else if(mfeMae<1.15){cap=Math.min(cap,82);notes.push("MFE/MAE orta")}
  else if(mfeMae<1.45){cap=Math.min(cap,88);notes.push("MFE/MAE iyi")}
  if(stat.fast>35){cap=Math.min(cap,76);notes.push("hızlı stop yüksek")}
  else if(stat.fast>25){cap=Math.min(cap,82);notes.push("hızlı stop dikkat")}
  else if(stat.fast>15){cap=Math.min(cap,88);notes.push("hızlı stop orta")}
  if(sig.stopPct>3.50){cap=Math.min(cap,74);notes.push("stop çok geniş")}
  else if(sig.stopPct>3.00){cap=Math.min(cap,80);notes.push("stop geniş")}
  else if(sig.stopPct>2.50){cap=Math.min(cap,84);notes.push("stop orta-geniş")}
  else if(sig.stopPct>2.00){cap=Math.min(cap,88);notes.push("stop orta")}
  if(sig.rr<1.35){cap=Math.min(cap,80);notes.push("RR sınırlı")}
  else if(sig.rr<1.55){cap=Math.min(cap,86);notes.push("RR orta")}
  let conf=Math.max(1,Math.min(rawConf,cap));
  return{conf:Math.round(conf),cap,notes};
}
function riskClass(stopPct,lev){
  const pressure=stopPct*lev;
  if(stopPct>3.2||pressure>18)return"Yüksek";
  if(stopPct>2.2||pressure>12)return"Orta";
  return"Dengeli";
}
function leverage(sig,conf){
  const stopDec=sig.stopPct/100,riskD=RULE.capital*RULE.riskPct/100;
  // v12: kaldıraç güvene göre değil, önce stop genişliğine göre sınırlandırılır.
  let byConf=conf>=92?7:conf>=88?6:conf>=84?5:conf>=78?4:conf>=70?3:2;
  let byStop=2;
  if(sig.stopPct<=0.90)byStop=10;
  else if(sig.stopPct<=1.20)byStop=8;
  else if(sig.stopPct<=1.60)byStop=6;
  else if(sig.stopPct<=2.00)byStop=5;
  else if(sig.stopPct<=2.50)byStop=4;
  else if(sig.stopPct<=3.20)byStop=3;
  else byStop=2;
  let lev=Math.min(RULE.maxLev,byConf,byStop);
  if(conf<82)lev=Math.min(lev,3);
  if(conf<74)lev=Math.min(lev,2);
  const notional=Math.min(RULE.capital*lev,riskD/Math.max(stopDec,.001));
  const margin=notional/lev;
  return{lev,notional,margin,riskD,liqPressure:sig.stopPct*lev};
}
function adjustRiskConfidence(obj){
  if(!obj)return obj;
  const prof=dataProfile(obj.sym,obj.tf,obj.candles);
  obj.source=prof.source||obj.source||'Taze veri';
  obj.candleSource=prof.candleSource;
  obj.priceSource=prof.priceSource;
  obj.jsonAgeSec=prof.jsonAgeSec;
  obj.ageSec=prof.ageSec;
  obj.capNotes=[...(obj.capNotes||[])];
  let cap=Math.min(obj.cap||RULE.maxConf, sourceCap(obj.source));
  if(String(obj.source).includes('JSON TAZE'))obj.capNotes.push('JSON taze güven tavanı');
  if(String(obj.source).includes('REST'))obj.capNotes.push('REST güven tavanı');
  if(String(obj.source).includes('WS'))obj.capNotes.push('WS canlı fiyat');
  const n=obj.stat&&isFinite(obj.stat.count)?obj.stat.count:0;
  if(obj.liveOnly){cap=Math.min(cap,76);obj.capNotes.push('backtest yetersiz güven tavanı');}
  else if(n<8){cap=Math.min(cap,74);obj.capNotes.push('işlem sayısı çok az');}
  else if(n<12){cap=Math.min(cap,80);obj.capNotes.push('işlem sayısı az');}
  else if(n<20){cap=Math.min(cap,86);obj.capNotes.push('örneklem orta');}
  else if(n<30){cap=Math.min(cap,88);obj.capNotes.push('30 altı örneklem');}
  else if(n<50){cap=Math.min(cap,91);obj.capNotes.push('50 altı örneklem');}
  if(obj.riskClass==='Yüksek'){cap=Math.min(cap,74);obj.capNotes.push('yüksek risk güven tavanı');scanLog.highRisk=(scanLog.highRisk||0)+1;}
  else if(obj.riskClass==='Orta'){cap=Math.min(cap,88);obj.capNotes.push('orta risk güven tavanı');}
  const sr=statStopRisk(obj.stat);
  if(sr.notes.length){cap=Math.min(cap,sr.cap);obj.capNotes.push(...sr.notes);}
  if(sr.hard){scanLog.lossCluster=(scanLog.lossCluster||0)+1;return null;}
  if(localStopLocked(obj)){scanLog.cooldown=(scanLog.cooldown||0)+1;return null;}
  if(localSymbolHeat(obj)>0){cap=Math.min(cap,82);obj.capNotes.push('aynı coinde yakın stop hafızası');}
  if(obj.noiseAdjusted){cap=Math.min(cap,88);obj.capNotes.push('noise stop genişletildi');}
  if(obj.stopPct>3.25){cap=Math.min(cap,80);obj.capNotes.push('ana liste stop üst sınırına yakın');}
  if(obj.stopPct>RULE.maxStopPct)return null;
  obj.rawConf=Math.max(1,Math.min(99,Math.round(obj.rawConf||obj.conf||0)));
  obj.conf=Math.max(1,Math.min(obj.rawConf,Math.round(cap)));
  obj.qualityScore=Math.round(candidateQualityScore(obj));
  if(obj.conf<(obj.liveOnly?RULE.liveOnlyMinConf:RULE.minConf)){scanLog.lowQuality=(scanLog.lowQuality||0)+1;return null;}
  return obj;
}
function htfFor(tf){return tf==="15m"?"1h":tf==="30m"?"2h":tf==="1h"?"4h":tf==="2h"?"4h":"4h"}
function htfOk(sym,tf,dir){
  const htf=htfFor(tf),raw=getCandles(sym,htf);
  let selfOk=true;
  if(raw&&raw.length>=120){const c=enrich(raw),x=c[c.length-1];selfOk=dir==="LONG"?x.close>x.e55&&x.e21>=x.e55*.995:x.close<x.e55&&x.e21<=x.e55*1.005}
  const btc=getCandles("BTCUSDT",tf);let btcOk=true;
  if(sym!=="BTCUSDT"&&btc&&btc.length>=120){const b=enrich(btc),x=b[b.length-1];btcOk=dir==="LONG"?x.close>=x.e55*.985:x.close<=x.e55*1.015}
  return selfOk&&btcOk;
}
function buildCandidate(sym,tf,b,stat){
  sym=cleanSymbol(sym); if(!sym)return null;
  // v10 teşhis: v9 yalnızca son mumda kusursuz sinyal istediği için çoğu taramada 0 aday çıkıyordu.
  // v14.2 teşhis: JSON taze olsa bile liveMap boşsa scanAll adayı hiç build etmiyordu; artık kaynak zamanı pairSourceTime ile alınır.
  if(stat.count<RULE.minTrades||stat.pf<RULE.minPF||stat.win<RULE.minWin||stat.net<=-1.5)return null;
  const mfeMae=stat.avgMfe/Math.max(stat.avgMae,.05);
  if(mfeMae<RULE.minMfeMae||stat.fast>45)return null;
  const c=b.candles,last=c[c.length-1],pairLive=liveMap[sym+'|'+tf]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  const stale=false;
  const dir=stat.model.includes("LONG")?"LONG":"SHORT";
  let sig=null;
  for(let k=0;k<=3;k++){
    sig=signal(c,c.length-1-k,"BAGLI "+dir);
    if(sig){
      const drift=Math.abs(last.close-sig.entry)/Math.max(Math.abs(sig.entry),1)*100;
      if(drift<=0.45){sig.entry=last.close;break}
      sig=null;
    }
  }
  if(!sig)sig=setupOpportunitySignal(c,c.length-1,dir);
  sig=normalizeTradePlan(sym,tf,sig);
  if(!sig||sig.stopPct>RULE.maxStopPct||sig.rr<RULE.minRR)return null;
  if(!htfOk(sym,tf,sig.dir)&&sig.q<82)return null;
  const recent=stat.trades.slice(-6),recentBad=recent.length>=4&&recent.filter(x=>x.pnl<0).length>=4;
  if(recentBad&&sig.q<84)return null;
  const sr0=statStopRisk(stat);
  if(sr0.hard&&sig.q<92){scanLog.lossCluster=(scanLog.lossCluster||0)+1;return null;}
  let rawConf=Math.round(sig.q*.50+Math.min(stat.pf,4)*7+stat.win*.17+Math.min(mfeMae,3)*6+Math.min(stat.count,40)*.22+Math.max(-7,Math.min(10,stat.net*.55))-stat.fast*.18);
  rawConf=Math.max(1,Math.min(99,rawConf));
  const capInfo=confidenceCaps(sig,stat,rawConf,mfeMae);
  let conf=capInfo.conf;
  if(conf<RULE.minConf)return null;
  const lev=leverage(sig,conf);
  const rClass=riskClass(sig.stopPct,lev.lev);
  return adjustRiskConfidence({sym,tf,model:sig.model,sub:sig.sub,dir:sig.dir,conf,rawConf,cap:capInfo.cap,capNotes:["canlı/taze veri", ...capInfo.notes],riskClass:rClass,entry:sig.entry,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,why:sig.why,noiseAdjusted:!!sig.noiseAdjusted,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source:sourceMap[sym+'|'+tf]||'Taze veri',liveOnly:false,stale:false})
}
function emptyLiveStat(dir){
  return{model:"Canlı Bağlam "+dir,count:0,win:0,net:0,pf:0,avgMfe:0,avgMae:0,fast:0,trades:[]};
}
function pickStatForDir(b,dir){
  if(!b||!b.stats||!b.stats.length)return emptyLiveStat(dir);
  return b.stats.find(s=>String(s.model||"").includes(dir))||emptyLiveStat(dir);
}
function buildLiveCandidate(sym,tf,raw,b){
  sym=cleanSymbol(sym); if(!sym)return [];
  if(!raw||raw.length<240)return [];
  const c=(b&&b.candles)||enrich(raw);
  const last=c[c.length-1],pairLive=liveMap[sym+'|'+tf]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return [];
  const stale=false;
  const out=[];
  for(const dir of ["LONG","SHORT"]){
    let sig=null;
    for(let k=0;k<=2;k++){
      sig=signal(c,c.length-1-k,"BAGLI "+dir);
      if(sig){sig.entry=last.close;break}
    }
    if(!sig)sig=setupOpportunitySignal(c,c.length-1,dir);
    sig=normalizeTradePlan(sym,tf,sig);
    if(!sig||sig.stopPct>RULE.maxStopPct||sig.rr<1.05)continue;
    const stat=pickStatForDir(b,dir);
    const hasStat=stat.count>=RULE.minTrades;
    const mfeMae=stat.count?stat.avgMfe/Math.max(stat.avgMae,.05):1.05;
    let statBoost=0;
    if(hasStat)statBoost=Math.min(stat.pf,3)*4+Math.min(stat.win,70)*.08+Math.min(stat.count,25)*.12-stat.fast*.08+Math.max(-4,Math.min(6,stat.net*.28));
    let rawConf=Math.round(sig.q*.72+statBoost);
    if(!htfOk(sym,tf,sig.dir))rawConf-=8;
    if(!hasStat)rawConf=Math.min(rawConf,76);
    rawConf=Math.max(45,Math.min(92,rawConf));
    const minConf=hasStat?RULE.minConf:RULE.liveOnlyMinConf;
    if(rawConf<minConf)continue;
    const conf=Math.round(Math.min(rawConf,hasStat?RULE.maxConf:76));
    const lev=leverage(sig,conf),rClass=riskClass(sig.stopPct,lev.lev);
    out.push(adjustRiskConfidence({sym,tf,model:sig.model||("Canlı Bağlam "+dir),sub:(sig.sub||"canlı bağlam"),dir:sig.dir,conf,rawConf,cap:hasStat?RULE.maxConf:76,capNotes:hasStat?["canlı/taze veri", "canlı fırsat filtresi"]:["canlı/taze veri", "backtest örneklemi yetersiz", "canlı bağlam öncelikli"],riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,why:sig.why,noiseAdjusted:!!sig.noiseAdjusted,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source:sourceMap[sym+'|'+tf]||'Taze veri',liveOnly:!hasStat,stale:false}));
  }
  const clean=out.filter(Boolean);
  clean.sort((a,b)=>b.conf-a.conf);
  return clean.slice(0,2);
}
function buildContextFallbackCandidate(sym,tf,raw,b){
  sym=cleanSymbol(sym); if(!sym)return [];
  if(!raw||raw.length<160)return [];
  const c=(b&&b.candles)||enrich(raw),i=c.length-1,x=c[i],p=c[i-1],a=x.atr||x.high-x.low||1;
  if(!x||!p||!isFinite(x.close)||!isFinite(a))return [];
  const ms=marketStructure(c,i);
  const pairLive=liveMap[sym+'|'+tf]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return [];
  const stale=false;
  const volOk=!x.v20||x.volume>=x.v20*.50;
  const pivotSup=ms.lastLow?ms.lastLow.v:x.sup34, pivotRes=ms.lastHigh?ms.lastHigh.v:x.res34;
  const nearSup=Math.abs(x.low-pivotSup)<=a*2.15||Math.abs(x.close-x.sup34)<=a*1.60||x.close<=x.e21+a*.65;
  const nearRes=Math.abs(x.high-pivotRes)<=a*2.15||Math.abs(x.close-x.res34)<=a*1.60||x.close>=x.e21-a*.65;
  function make(dir){
    let score=42,why=[],sub=[];
    if(dir==='LONG'){
      if(x.e21>=x.e55*.995){score+=9;why.push('trend')}else score-=4;
      if(x.close>=x.e21*.995){score+=6;sub.push('EMA üstü')}else score-=2;
      if(ms.up||ms.bosUp||ms.chochUp){score+=10;why.push('yapı')}else if(!ms.down){score+=4;why.push('nötr yapı')}
      if(nearSup){score+=8;why.push('lokasyon');sub.push('destek/pullback')}
      if(x.rsi>=50){score+=7;why.push('momentum')}else if(x.rsi>=46){score+=3;why.push('momentum yakın')}else score-=5;
      if(x.macd>=p.macd)score+=4;
      if(x.pdi>=x.mdi)score+=4;
      if(x.cmf>-0.10||x.obvSlope>=0){score+=6;why.push('para akışı')}
      if(volOk){score+=3;why.push('hacim')}
    }else{
      if(x.e21<=x.e55*1.005){score+=9;why.push('trend')}else score-=4;
      if(x.close<=x.e21*1.005){score+=6;sub.push('EMA altı')}else score-=2;
      if(ms.down||ms.bosDown||ms.chochDown){score+=10;why.push('yapı')}else if(!ms.up){score+=4;why.push('nötr yapı')}
      if(nearRes){score+=8;why.push('lokasyon');sub.push('direnç/pullback')}
      if(x.rsi<=50){score+=7;why.push('momentum')}else if(x.rsi<=54){score+=3;why.push('momentum yakın')}else score-=5;
      if(x.macd<=p.macd)score+=4;
      if(x.mdi>=x.pdi)score+=4;
      if(x.cmf<0.10||x.obvSlope<=0){score+=6;why.push('para akışı')}
      if(volOk){score+=3;why.push('hacim')}
    }
    if(x.adx>18)score+=3;if(x.adx>25)score+=3;
    if(!htfOk(sym,tf,dir))score-=6;
    if(why.length<3)score-=8;
    let entry=x.close,stop,t1,t2,t3,r;
    if(dir==='LONG'){
      stop=Math.min(x.low-a*.20,pivotSup-a*.10,x.e55-a*.05);
      r=Math.max(entry-stop,a*.55);
      r=Math.min(r,entry*(RULE.maxStopPct/100));
      stop=entry-r;t1=entry+r*1.25;t2=entry+r*1.85;t3=entry+r*2.60;
    }else{
      stop=Math.max(x.high+a*.20,pivotRes+a*.10,x.e55+a*.05);
      r=Math.max(stop-entry,a*.55);
      r=Math.min(r,entry*(RULE.maxStopPct/100));
      stop=entry+r;t1=entry-r*1.25;t2=entry-r*1.85;t3=entry-r*2.60;
    }
    let tmpSig=normalizeTradePlan(sym,tf,{dir,entry,stop,t1,t2,t3,stopPct:Math.abs(entry-stop)/entry*100,rr:Math.abs(t1-entry)/Math.abs(entry-stop),why});
    entry=tmpSig.entry;stop=tmpSig.stop;t1=tmpSig.t1;t2=tmpSig.t2;t3=tmpSig.t3;
    const stopPct=tmpSig.stopPct,rr=tmpSig.rr;
    if(tmpSig.noiseAdjusted)score-=2;
    if(stopPct<=1.4)score+=6;else if(stopPct<=2.6)score+=3;else score-=3;
    if(rr>=1.2)score+=3;
    const stat=pickStatForDir(b,dir),hasStat=stat.count>=RULE.minTrades;
    if(hasStat){
      const sr=statStopRisk(stat); if(sr.hard){scanLog.lossCluster=(scanLog.lossCluster||0)+1;return null;}
      score+=Math.min(8,stat.pf*2)+Math.min(7,stat.win/10)+Math.min(5,stat.count/5)-Math.min(8,stat.fast/8)-Math.min(18,sr.penalty||0);
    }
    if(score<48)return null;
    let conf=Math.round(Math.max(50,Math.min(82,score)));
    const lev=leverage({stopPct},conf),rClass=riskClass(stopPct,lev.lev);
    return adjustRiskConfidence({sym,tf,model:'Canlı Yedek Bağlam '+dir,sub:sub.slice(0,2).join(' + ')||'iki liste doldurma',dir,conf,rawConf:Math.round(score),cap:82,capNotes:['canlı/taze veri','sert sinyal yoksa bağlam adayı'],riskClass:rClass,entry,stop,t1,t2,t3,stopPct,rr,why:[...new Set(why)].slice(0,6),noiseAdjusted:!!tmpSig.noiseAdjusted,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source:sourceMap[sym+'|'+tf]||'Taze veri',liveOnly:true,stale:false,contextFallback:true});
  }
  const arr=[make('LONG'),make('SHORT')].filter(Boolean).sort((a,b)=>b.conf-a.conf);
  return arr.slice(0,2);
}
function sortCandidates(){
  const valid=candidates.filter(x=>x&&validCandidateSymbol(x));
  valid.sort(candidateRank);
  const seen=new Set(),dedup=[];
  for(const c of valid){
    const k=c.sym+'|'+c.tf+'|'+c.dir;
    if(seen.has(k))continue;
    seen.add(k);dedup.push(c);
  }
  const longs=dedup.filter(x=>x.dir==='LONG').sort(candidateRank).slice(0,40);
  const shorts=dedup.filter(x=>x.dir==='SHORT').sort(candidateRank).slice(0,40);
  candidates=[...longs,...shorts];
}
async function scanAll(){
  setMeta(`Dinamik fırsat taraması başladı: ${SYMBOLS.length} coin x ${TFS.length} TF = ${SYMBOLS.length*TFS.length} kontrol...`);
  candidates=[];
  const total=SYMBOLS.length*TFS.length;
  scanLog.total=total;scanLog.done=0;
  let done=0;
  for(const s0 of SYMBOLS){
    const s=cleanSymbol(s0);
    if(!s){scanLog.skipped+=TFS.length;continue}
    for(const tf of TFS){
      await ensureCandles(s,tf);
      const arr=getCandles(s,tf);
      const key=s+"|"+tf;
      const pairLive=liveMap[key]||pairSourceTime(s,tf,arr);
      const pairAge=pairLive?Math.round(sourceAgeMs(pairLive)/1000):9999;
      if(arr&&arr.length>=220&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){
        const before=candidates.length;
        const b=backtest(s,tf);
        const added=[];
        if(b){for(const st of b.stats){const cand=buildCandidate(s,tf,b,st);if(cand){candidates.push(cand);added.push(cand)}}}
        let dirsAdded=new Set(added.map(c=>c.dir));
        if(dirsAdded.size<2){
          for(const cand of asArray(buildLiveCandidate(s,tf,arr,b))){
            if(cand&&!dirsAdded.has(cand.dir)){candidates.push(cand);added.push(cand);dirsAdded.add(cand.dir)}
          }
        }
        if(dirsAdded.size<2){
          for(const cand of asArray(buildContextFallbackCandidate(s,tf,arr,b))){
            if(cand&&!dirsAdded.has(cand.dir)){candidates.push(cand);added.push(cand);dirsAdded.add(cand.dir)}
          }
        }
        if(candidates.length>0&&(candidates.length!==before||done%12===0)){sortCandidates();renderList();}
      }else{scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;}
      done++;scanLog.done=done;setBar(done/total*100);
      setMeta(`${liveText()} | Dinamik tarama ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | JSON: ${scanLog.json} | REST: ${scanLog.rest} | WS: ${scanLog.ws} | LONG: ${countByDir("LONG")} | SHORT: ${countByDir("SHORT")} | Eski/bozuk: ${(scanLog.stale||0)+(scanLog.invalid||0)}`);
      await delay(18);
    }
  }
  sortCandidates();
  renderList();
  const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50);
  setMeta(`${liveText()} | Tarama bitti: ${done}/${total} kontrol | Coin evreni: ${SYMBOLS.length} | JSON: ${scanLog.json} | REST: ${scanLog.rest} | WS: ${scanLog.ws} | LONG: ${countByDir("LONG")} / Gösterilen 7 | SHORT: ${countByDir("SHORT")} / Gösterilen 7 | Eski veri: ${scanLog.stale||0} | Bozuk sembol: ${scanLog.invalid||0} | Taze veri sınırı: 5 dk | v15.0 anti-stop aktif`);
}
function renderList(){
  const box=$("list");
  const longs=rankedList("LONG",7), shorts=rankedList("SHORT",7);
  const summary=`<div class="dash"><div><b>${countByDir("LONG")}</b><span>LONG aday</span></div><div><b>${countByDir("SHORT")}</b><span>SHORT aday</span></div><div><b>${scanLog.cooldown||0}</b><span>stop kilidi</span></div><div><b>${scanLog.lossCluster||0}</b><span>zarar serisi</span></div><div><b>${scanLog.noiseAdjusted||0}</b><span>noise stop</span></div><div><b>${scanLog.invalid||0}</b><span>bozuk sembol</span></div></div>`;
  if(!longs.length&&!shorts.length){
    box.innerHTML=summary+'<div class="decision wait">ADAY HENÜZ YOK</div><p>Tarama devam ediyor veya canlı/taze veri bekleniyor. v15.0 eski JSON’dan işlem açmaz; REST/WS ya da 5 dakikadan taze market.json gerekir.</p>';
    return;
  }
  const card=(x,i)=>{
    const idx=candidates.indexOf(x);
    const bt=x.liveOnly?'Canlı bağlam / backtest yetersiz':`İşlem ${x.stat.count} | Win ${pct(x.stat.win,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf,2)} | Net ${money(x.stat.net)}`;
    const warn=!mainListEligible(x)?'<span class="pill amber">yedek kalite</span>':'';
    const spot=x.dir==='LONG'?'<span class="pill green">spot AL uygun</span>':'<span class="pill red">spotta short değil</span>';
    return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?" — "+x.sub:""}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.conf}%<br><span style="font-size:16px">${x.dir}</span></div></div><div class="line">Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | RR ${fmt(x.rr,2)}<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source} | Kalite: ${x.qualityScore||'-'}<br>Risk: ${x.riskClass} | Ham ${x.rawConf}% → Gerçekçi ${x.conf}%</div><div>${spot}${warn}${(x.capNotes||[]).slice(0,2).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`;
  };
  const section=(title,arr,dir,desc)=>{
    if(!arr.length)return `<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p>${desc} Şu an uygun aday yok.</p></div>`;
    return `<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.map(card).join("")}</div>`;
  };
  box.innerHTML=summary+
    section("En İyi 7 LONG İşlem",longs,"LONG","Binance TR spotta AL yönlü takip edilebilir adaylar. 10.000 TL spot planı seçilen işlemde ayrıca hesaplanır.")+
    section("En İyi 7 SHORT İşlem",shorts,"SHORT","Spotta doğrudan short değildir; vadeli/marjin veya longdan çıkış-dikkat listesi olarak değerlendir.");
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return;
  selected=x;
  $("decision").className="decision "+(x.dir==="LONG"?"long":"short");
  $("decision").textContent=`${x.dir} İŞLEM — GÜVEN ${x.conf}%${x.liveOnly?' — CANLI BAĞLAM':''}`;
  $("metrics").innerHTML=metric("Sembol / TF",`${symbolLabel(x.sym)} / ${x.tf}`)+metric("Model",x.model+(x.sub?" — "+x.sub:""))+metric("Canlı veri",`${x.ageSec} sn`)+metric("Mum kaynağı",x.candleSource||x.source||"Taze veri")+metric("Fiyat kaynağı",x.priceSource||x.source||"Taze veri")+metric("Risk sınıfı",x.riskClass)+metric("Ham/Gerçekçi güven",`${x.rawConf}% / ${x.conf}%`)+metric("Kalite puanı",x.qualityScore||"-")+metric("Stop hafızası",localCooldownText(x))+metric("Giriş",dualPrice(x.entry))+metric("Stop",dualPrice(x.stop))+metric("Stop %",pct(x.stopPct,2))+metric("TP1",dualPrice(x.t1))+metric("TP2",dualPrice(x.t2))+metric("TP3",dualPrice(x.t3))+metric("Spot tutar",fmt(RULE.spotTry,0)+" TL")+metric("Kaldıraç modeli",`x${fmt(x.lev.lev,1)}`)+metric("Model pozisyon",dualMoney(x.lev.notional))+metric("Model marjin",dualMoney(x.lev.margin))+metric("Risk",dualMoney(x.lev.riskD))+metric("RR",fmt(x.rr,2))+metric("PF",x.liveOnly?"Canlı bağlam":(x.stat.pf>=20?"20+":fmt(x.stat.pf,2)));
  $("tryPlan").innerHTML=binanceTryPlan(x);
  $("reasons").innerHTML=x.why.map(r=>`<span class="pill ${x.dir==="LONG"?"green":"red"}">${r}</span>`).join("")+`<span class="pill blue">${x.liveOnly?'Canlı fırsat':'Win '+pct(x.stat.win,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe,2)}R / ${fmt(x.stat.avgMae,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,5).map(n=>`<span class="pill amber">${n}</span>`).join(""):"");
  drawChart(x.candles,x);renderBacktest(x);
  if(!auto)$("planBox").scrollIntoView({behavior:"smooth"});
}
function metric(k,v){return`<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`}
function memoryButtons(){
  return `<div class="memoryBtns"><button class="miniBtn danger" onclick="markSelectedOutcome('STOP')">Bu işlem STOP oldu</button><button class="miniBtn okBtn" onclick="markSelectedOutcome('TP')">TP/Kâr oldu</button><button class="miniBtn grayBtn" onclick="markSelectedOutcome('CLOSE')">Elle kapattım</button><button class="miniBtn grayBtn" onclick="clearTradeMemory()">Hafızayı temizle</button></div><div class="tryline">Not: STOP olarak kaydedilen coin aynı yönde ${RULE.sameDirStopLockHours} saat listeden çıkarılır. Böylece 2 saat sonra aynı coinde aynı LONG tekrar açtırmaz.</div>`;
}
function binanceTryPlan(x){
  if(!fxReady())return"USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.";
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString("tr-TR",{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==="LONG"){
    const stopLimit=x.stop*0.998;
    const riskTry=RULE.spotTry*(x.stopPct/100);
    const p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — 10.000 TL plan</b><div class="tryline">1) Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa TRY paritesini; yoksa USDT piyasasında ${symbolLabel(x.sym)} karşılığını kontrol et.</div><div class="tryline">2) Emir tipi: Limit AL veya Piyasa AL. Limit fiyat referansı: ${tlInput(x.entry)} TL.</div><div class="tryline">3) Tutar alanı: ${fmt(RULE.spotTry,0)} TL. Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline">4) Stop/OCO SAT: Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL | TP1 ${tlInput(x.t1)} TL.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>${memoryButtons()}`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Bu yön Binance TR spotta doğrudan short olarak açılamaz. Vadeli/marjin altyapısı gerekir; spot kullanıcı için çıkış/dikkat/long açmama sinyalidir.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL</div>${memoryButtons()}`;
}function renderBacktest(x){
  if(x.liveOnly){
    $("bt").innerHTML=`<div class="grid">${metric("Durum","Canlı bağlam")}${metric("Backtest",x.contextFallback?"Bağlam adayı":"Yeterli örnek yok")}${metric("Güven",pct(x.conf,0))}${metric("RR",fmt(x.rr,2))}${metric("Stop",pct(x.stopPct,2))}${metric("Risk sınıfı",x.riskClass)}</div><div class="note">Bu aday yalnızca 5 dakikadan taze veriyle üretildi. Veri kaynağı ayrıca kartta gösterilir. Backtest örneklemi yetersizse canlı bağlam motoru devrededir; eski JSON’dan işlem açılmaz.</div>`;
    return;
  }
  const trs=x.stat.trades.slice(-10).reverse();
  $("bt").innerHTML=`<div class="grid">${metric("İşlem",x.stat.count)}${metric("Win",pct(x.stat.win,1))}${metric("PF",x.stat.pf>=20?"20+":fmt(x.stat.pf,2))}${metric("Net",dualMoney(x.stat.net))}${metric("MFE/MAE",`${fmt(x.stat.avgMfe,2)}R / ${fmt(x.stat.avgMae,2)}R`)}${metric("Hızlı stop",pct(x.stat.fast,1))}</div><h3>Son işlemler</h3><div class="lastRows">${trs.map(t=>`<div class="tradeRow"><div>${t.date}</div><div>${t.dir}</div><div>${t.exit}</div><div>${fmt(t.mfe,2)}R/${fmt(t.mae,2)}R</div></div>`).join("")}</div><div class="note">Bu plan otomatik üretilir. USDT değerlerin yanındaki TL değerleri güncel USDT/TRY kuru ile hesaplanır. Binance TR spotta LONG uygulanabilir; SHORT sinyaller spotta doğrudan short değildir.</div>`
}
function drawChart(c,x){const cvs=$("chart"),ctx=cvs.getContext("2d");ctx.clearRect(0,0,cvs.width,cvs.height);const arr=c.slice(-110);if(arr.length<5)return;const vals=[];arr.forEach(a=>vals.push(a.high,a.low));vals.push(x.entry,x.stop,x.t1,x.t2,x.t3);const high=Math.max(...vals),low=Math.min(...vals),pad=32,w=cvs.width-pad*2,h=cvs.height-pad*2;const xx=i=>pad+i/(arr.length-1)*w,yy=v=>pad+(high-v)/(high-low)*h;ctx.strokeStyle="#79a3ff";ctx.lineWidth=3;ctx.beginPath();arr.forEach((a,i)=>{i?ctx.lineTo(xx(i),yy(a.close)):ctx.moveTo(xx(i),yy(a.close))});ctx.stroke();line(ctx,pad,w,yy(x.entry),"#f2c45f","Giriş "+fmt(x.entry,4));line(ctx,pad,w,yy(x.stop),"#ff6e86","Stop "+fmt(x.stop,4));line(ctx,pad,w,yy(x.t1),"#6dff9f","TP1 "+fmt(x.t1,4));line(ctx,pad,w,yy(x.t2),"#6dff9f","TP2 "+fmt(x.t2,4));line(ctx,pad,w,yy(x.t3),"#6dff9f","TP3 "+fmt(x.t3,4))}function line(ctx,pad,w,y,color,text){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(pad+w,y);ctx.stroke();ctx.fillStyle=color;ctx.font="15px Arial";ctx.fillText(text,pad+5,y-6)}

/* =========================================================
   v15.0 TEKNIK KALITE MOTORU OVERRIDE
   Amaç: Adayı doldurmak değil, teknik olarak kaliteli işlemi elemek/seçmek.
   Eski gevşek bağlam/yedek aday üretimi kapatıldı.
========================================================= */
Object.assign(RULE,{
  minConf:68,
  liveOnlyMinConf:64,
  minConfluence:7,
  minTrades:12,
  minPF:1.25,
  minWin:52,
  minMfeMae:1.05,
  maxStopPct:3.05,
  maxMainStopPct:2.75,
  minRR:1.35,
  maxFastStopRate:24,
  forceTopCount:0
});

function v149Body(c,i){
  const x=c[i],p=c[i-1],p2=c[i-2]||p,p3=c[i-3]||p2;
  const body=Math.abs(x.close-x.open),range=Math.max(x.high-x.low,1e-9);
  const upper=x.high-Math.max(x.open,x.close),lower=Math.min(x.open,x.close)-x.low;
  return {body,range,upper,lower,bodyPct:body/range,upperPct:upper/range,lowerPct:lower/range,bull:x.close>x.open,bear:x.close<x.open,p,p2,p3};
}
function v149TrendState(c,i,dir){
  const x=c[i],p=c[i-1];
  const slope21=x.e21-p.e21, slope55=x.e55-p.e55;
  const longStack=x.e21>x.e55 && x.e55>=x.e100*.992 && x.close>x.e21 && x.close>=x.e200*.975 && slope21>=0;
  const shortStack=x.e21<x.e55 && x.e55<=x.e100*1.008 && x.close<x.e21 && x.close<=x.e200*1.025 && slope21<=0;
  const longEarly=x.close>x.e21 && x.e21>=x.e55*.99 && slope21>0 && x.close>x.e100*.985;
  const shortEarly=x.close<x.e21 && x.e21<=x.e55*1.01 && slope21<0 && x.close<x.e100*1.015;
  return dir==='LONG'?{ok:longStack||longEarly,strong:longStack,score:(longStack?12:longEarly?7:0),slope21,slope55}:{ok:shortStack||shortEarly,strong:shortStack,score:(shortStack?12:shortEarly?7:0),slope21,slope55};
}
function v149MTFState(sym,tf,dir){
  const htf=htfFor(tf),raw=getCandles(sym,htf);
  let selfOk=true,selfStrong=false;
  if(raw&&raw.length>=160){
    const c=enrich(raw),x=c[c.length-1],p=c[c.length-2];
    selfOk=dir==='LONG'?(x.close>x.e55&&x.e21>=x.e55*.992&&x.close>=x.e100*.98&&x.e21>=p.e21):(x.close<x.e55&&x.e21<=x.e55*1.008&&x.close<=x.e100*1.02&&x.e21<=p.e21);
    selfStrong=dir==='LONG'?(x.e21>x.e55&&x.e55>x.e100):(x.e21<x.e55&&x.e55<x.e100);
  }
  const btc=getCandles('BTCUSDT',tf);let btcOk=true,btcHard=false;
  if(sym!=='BTCUSDT'&&btc&&btc.length>=160){
    const b=enrich(btc),x=b[b.length-1],p=b[b.length-2];
    btcOk=dir==='LONG'?(x.close>=x.e55*.985 && x.e21>=p.e21*.998):(x.close<=x.e55*1.015 && x.e21<=p.e21*1.002);
    btcHard=dir==='LONG'?(x.close<x.e200*.985&&x.e21<x.e55):(x.close>x.e200*1.015&&x.e21>x.e55);
  }
  return {ok:selfOk&&btcOk&&!btcHard,selfOk,btcOk,selfStrong,btcHard};
}
function v149StructureState(c,i,dir){
  const ms=marketStructure(c,i);
  const x=c[i],p=c[i-1],a=x.atr||x.high-x.low||1;
  const pivotSup=ms.lastLow?ms.lastLow.v:x.sup34, pivotRes=ms.lastHigh?ms.lastHigh.v:x.res34;
  const zSup=zoneStrength(c,i,pivotSup,'sup'), zRes=zoneStrength(c,i,pivotRes,'res');
  const sweepLow=x.low<lo(c,i-1,34)&&x.close>x.low+a*.35&&x.close>p.close;
  const sweepHigh=x.high>hi(c,i-1,34)&&x.high-x.close>a*.35&&x.close<p.close;
  const bosRetestLong=ms.bosUp || (ms.lastHigh&&x.close>ms.lastHigh.v-a*.15&&p.close<=ms.lastHigh.v+a*.15);
  const bosRetestShort=ms.bosDown || (ms.lastLow&&x.close<ms.lastLow.v+a*.15&&p.close>=ms.lastLow.v-a*.15);
  const okLong=(ms.up||bosRetestLong||ms.chochUp||sweepLow||(zSup.ok&&!ms.down));
  const okShort=(ms.down||bosRetestShort||ms.chochDown||sweepHigh||(zRes.ok&&!ms.up));
  const hardBadLong=ms.down&&!ms.chochUp&&!sweepLow;
  const hardBadShort=ms.up&&!ms.chochDown&&!sweepHigh;
  return {ms,pivotSup,pivotRes,zSup,zRes,sweepLow,sweepHigh,bosRetestLong,bosRetestShort,ok:dir==='LONG'?okLong:okShort,hardBad:dir==='LONG'?hardBadLong:hardBadShort};
}
function v149LocationState(c,i,dir,st){
  const x=c[i],p=c[i-1],p2=c[i-2],p3=c[i-3],a=x.atr||x.high-x.low||1;
  const b=v149Body(c,i);
  const nearSup=Math.abs(x.low-st.pivotSup)<=a*1.05 || Math.abs(x.close-x.sup34)<=a*.75 || (x.low<=x.e21+a*.45&&x.close>=x.e21-a*.05);
  const nearRes=Math.abs(x.high-st.pivotRes)<=a*1.05 || Math.abs(x.close-x.res34)<=a*.75 || (x.high>=x.e21-a*.45&&x.close<=x.e21+a*.05);
  const bullFvg=p2&&p2.high<x.low || (p3&&p3.high<p.low&&x.close>p3.high);
  const bearFvg=p2&&p2.low>x.high || (p3&&p3.low>p.high&&x.close<p3.low);
  const pullLong=x.low<=x.e21+a*.50&&x.close>x.e21&&x.e21>=x.e55*.99;
  const pullShort=x.high>=x.e21-a*.50&&x.close<x.e21&&x.e21<=x.e55*1.01;
  const breakoutLong=x.close>hi(c,i-1,45)&&x.volume>=(x.v20||0)*.95;
  const breakoutShort=x.close<lo(c,i-1,45)&&x.volume>=(x.v20||0)*.95;
  const chaseLong=x.close>x.e21+a*1.65 && !breakoutLong && !st.sweepLow;
  const chaseShort=x.close<x.e21-a*1.65 && !breakoutShort && !st.sweepHigh;
  const okLong=(nearSup||bullFvg||st.sweepLow||pullLong||breakoutLong)&&!chaseLong;
  const okShort=(nearRes||bearFvg||st.sweepHigh||pullShort||breakoutShort)&&!chaseShort;
  const labels=[];
  if(dir==='LONG'){
    if(nearSup)labels.push('destek'); if(pullLong)labels.push('EMA pullback'); if(bullFvg)labels.push('bullish FVG'); if(st.sweepLow)labels.push('likidite dönüşü'); if(breakoutLong)labels.push('BOS/kırılım');
  }else{
    if(nearRes)labels.push('direnç'); if(pullShort)labels.push('EMA pullback'); if(bearFvg)labels.push('bearish FVG'); if(st.sweepHigh)labels.push('likidite dönüşü'); if(breakoutShort)labels.push('BOS/kırılım');
  }
  return {ok:dir==='LONG'?okLong:okShort,labels,chase:dir==='LONG'?chaseLong:chaseShort,bullFvg,bearFvg,pullLong,pullShort,breakoutLong,breakoutShort};
}
function v149MomentumState(c,i,dir){
  const x=c[i],p=c[i-1];
  const longOk=(x.rsi>=50&&x.rsi<=68&&x.macd>=p.macd&&x.pdi>=x.mdi) || (x.rsi>=54&&x.macd>0&&x.pdi>x.mdi);
  const shortOk=(x.rsi<=50&&x.rsi>=32&&x.macd<=p.macd&&x.mdi>=x.pdi) || (x.rsi<=46&&x.macd<0&&x.mdi>x.pdi);
  const overLong=x.rsi>72; const overShort=x.rsi<28;
  return {ok:dir==='LONG'?longOk&&!overLong:shortOk&&!overShort,over:dir==='LONG'?overLong:overShort};
}
function v149FlowState(c,i,dir){
  const x=c[i];
  const volOk=!x.v20||x.volume>=x.v20*.88;
  const volStrong=!x.v20||x.volume>=x.v20*1.15;
  const longOk=(x.cmf>-0.02&&x.obvSlope>=0)||(x.cmf>0.05)||(volStrong&&x.close>x.open);
  const shortOk=(x.cmf<0.02&&x.obvSlope<=0)||(x.cmf<-0.05)||(volStrong&&x.close<x.open);
  return {ok:(dir==='LONG'?longOk:shortOk)&&volOk,volOk,volStrong};
}
function v149TriggerState(c,i,dir){
  const x=c[i],p=c[i-1],b=v149Body(c,i);
  const longOk=microCandle(c,i,'LONG') || (x.close>p.high&&b.bodyPct>.35) || (b.lowerPct>.34&&x.close>x.open);
  const shortOk=microCandle(c,i,'SHORT') || (x.close<p.low&&b.bodyPct>.35) || (b.upperPct>.34&&x.close<x.open);
  return {ok:dir==='LONG'?longOk:shortOk,body:b};
}
function v149VolatilityState(c,i,dir,st,loc){
  const x=c[i];
  const trending=x.adx>=18;
  const flat=x.adx<14&&x.bbWidth<2.2;
  const ok=trending || st.sweepLow || st.sweepHigh || loc.breakoutLong || loc.breakoutShort;
  return {ok:ok&&!flat,flat,trending};
}
function v149RoomState(c,i,dir,entry,stop,st){
  const r=Math.abs(entry-stop);
  if(!r||!isFinite(r))return {ok:false,rr:0,roomR:0};
  let room=Infinity;
  if(dir==='LONG')room=(st.pivotRes&&st.pivotRes>entry)?(st.pivotRes-entry):((c[i].res34||entry+r*2)-entry);
  else room=(st.pivotSup&&st.pivotSup<entry)?(entry-st.pivotSup):(entry-(c[i].sup34||entry-r*2));
  const roomR=room/r;
  return {ok:roomR>=1.15,roomR};
}
function v149TechGate(c,i,dir,sym,tf){
  const x=c[i],a=x.atr||x.high-x.low||1;
  const trend=v149TrendState(c,i,dir),mtf=v149MTFState(sym,tf,dir),st=v149StructureState(c,i,dir),loc=v149LocationState(c,i,dir,st),mom=v149MomentumState(c,i,dir),flow=v149FlowState(c,i,dir),trig=v149TriggerState(c,i,dir),vol=v149VolatilityState(c,i,dir,st,loc);
  const labels=[]; let hard=false;
  function add(ok,name){ if(ok)labels.push(name); else hard=true; }
  add(trend.ok,'trend'); add(mtf.ok,'MTF'); add(st.ok&&!st.hardBad,'piyasa yapısı'); add(loc.ok,'lokasyon'); add(mom.ok,'momentum'); add(flow.ok,'hacim/para akışı'); add(trig.ok,'mum tetik'); add(vol.ok,'volatilite');
  if(loc.chase||mom.over)hard=true;
  let entry=x.close,stop,struct,r;
  if(dir==='LONG'){
    struct=Math.min(x.low-a*.26,st.pivotSup-a*.16,x.e55-a*.12);
    r=Math.max(entry-struct,a*.68); stop=entry-r;
  }else{
    struct=Math.max(x.high+a*.26,st.pivotRes+a*.16,x.e55+a*.12);
    r=Math.max(struct-entry,a*.68); stop=entry+r;
  }
  let stopPct=Math.abs(entry-stop)/entry*100;
  const minStop=minStopPctFor(sym,tf)*1.10;
  if(stopPct<minStop){
    r=entry*minStop/100;
    stop=dir==='LONG'?entry-r:entry+r;
    stopPct=minStop;
  }
  const room=v149RoomState(c,i,dir,entry,stop,st);
  if(!room.ok)hard=true;
  const rr1=1.45,rr2=2.10,rr3=2.95;
  const t1=dir==='LONG'?entry+r*rr1:entry-r*rr1;
  const t2=dir==='LONG'?entry+r*rr2:entry-r*rr2;
  const t3=dir==='LONG'?entry+r*rr3:entry-r*rr3;
  const rr=Math.abs(t1-entry)/Math.abs(entry-stop);
  const sub=[];
  sub.push(...loc.labels.slice(0,3));
  if(st.ms.bosUp||st.ms.bosDown)sub.push('BOS');
  if(st.ms.chochUp||st.ms.chochDown)sub.push('CHOCH');
  let q=28+labels.length*7;
  q+=trend.strong?5:0; q+=mtf.selfStrong?4:0; q+=flow.volStrong?4:0; q+=vol.trending?4:0; q+=Math.min(8,Math.max(0,(room.roomR-1.15)*3));
  if(stopPct<=2.2)q+=6; else if(stopPct>2.75)q-=7;
  if(hard)q-=35;
  return {ok:!hard&&labels.length>=7&&stopPct<=RULE.maxStopPct&&rr>=RULE.minRR,labels,sub:[...new Set(sub)],entry,stop,t1,t2,t3,stopPct,rr,q:Math.max(0,Math.min(100,q)),detail:{trend,mtf,st,loc,mom,flow,trig,vol,room}};
}

function signal(c,i,model){
  if(i<210)return null;
  const dir=model.includes('LONG')?'LONG':'SHORT';
  const gate=v149TechGate(c,i,dir,'BTCUSDT','15m'); // sym/tf yoksa min stop ana coin gibi hesaplanır; build aşamasında tekrar normalize edilir.
  if(!gate.ok)return null;
  return {model:'Kurumsal Teknik '+dir,sub:gate.sub.slice(0,3).join(' + ')||'çoklu teyit',dir,entry:gate.entry,stop:gate.stop,t1:gate.t1,t2:gate.t2,t3:gate.t3,atr:c[i].atr||0,stopPct:gate.stopPct,rr:gate.rr,why:gate.labels,q:gate.q,techDetail:gate.detail};
}
function signalForSymbol(c,i,model,sym,tf){
  if(i<210)return null;
  const dir=model.includes('LONG')?'LONG':'SHORT';
  const gate=v149TechGate(c,i,dir,sym,tf);
  if(!gate.ok)return null;
  return {model:'Kurumsal Teknik '+dir,sub:gate.sub.slice(0,3).join(' + ')||'çoklu teyit',dir,entry:gate.entry,stop:gate.stop,t1:gate.t1,t2:gate.t2,t3:gate.t3,atr:c[i].atr||0,stopPct:gate.stopPct,rr:gate.rr,why:gate.labels,q:gate.q,techDetail:gate.detail};
}
function setupOpportunitySignal(c,i,dir){ return null; }
function buildContextFallbackCandidate(sym,tf,raw,b){ return []; }

function backtest(sym,tf){
  const raw=getCandles(sym,tf);if(!raw||raw.length<260)return null;
  const c=enrich(raw),map={'Kurumsal Teknik LONG':[],'Kurumsal Teknik SHORT':[]};let cd=0;
  for(let i=210;i<c.length-2;i++){
    if(cd>0){cd--;continue}
    const sigs=['LONG','SHORT'].map(d=>signalForSymbol(c,i,'BAGLI '+d,sym,tf)).filter(Boolean).filter(s=>s.stopPct<=RULE.maxStopPct).sort((a,b)=>b.q-a.q);
    if(!sigs.length)continue;
    const sig=sigs[0],tr=simulate(c,sig,i);if(!tr)continue;
    map[sig.model]=map[sig.model]||[];map[sig.model].push(tr);cd=RULE.cooldown;
  }
  const stats=Object.keys(map).map(m=>calcStats(m,map[m])).filter(s=>s.count>0).sort((a,b)=>modelScore(b)-modelScore(a));
  return {sym,tf,candles:c,stats};
}
function pickStatForDir(b,dir){
  if(!b||!b.stats||!b.stats.length)return emptyLiveStat(dir);
  return b.stats.find(s=>String(s.model||'').includes(dir))||emptyLiveStat(dir);
}
function confidenceCaps(sig,stat,rawConf,mfeMae){
  let cap=90,notes=[];
  const n=stat&&stat.count?stat.count:0;
  if(n<12){cap=Math.min(cap,72);notes.push('örneklem yetersiz')}
  else if(n<20){cap=Math.min(cap,80);notes.push('20 altı örneklem')}
  else if(n<30){cap=Math.min(cap,84);notes.push('30 altı örneklem')}
  else if(n<50){cap=Math.min(cap,88);notes.push('50 altı örneklem')}
  if((stat&&stat.win||0)<58){cap=Math.min(cap,84);notes.push('win kalite tavanı')}
  if((stat&&stat.pf||0)<1.65){cap=Math.min(cap,83);notes.push('PF kalite tavanı')}
  if((stat&&stat.fast||0)>18){cap=Math.min(cap,82);notes.push('hızlı stop filtresi')}
  if(mfeMae<1.2){cap=Math.min(cap,82);notes.push('MFE/MAE zayıf')}
  if(sig.stopPct>2.4){cap=Math.min(cap,84);notes.push('stop mesafesi orta')}
  if(sig.stopPct>2.8){cap=Math.min(cap,79);notes.push('stop mesafesi yüksek')}
  if(sig.rr<1.45){cap=Math.min(cap,80);notes.push('RR alt sınır')}
  return {conf:Math.min(Math.round(rawConf),cap),cap,notes};
}
function buildCandidate(sym,tf,b,stat){
  sym=cleanSymbol(sym); if(!sym||!b||!stat)return null;
  if(stat.count<RULE.minTrades||stat.pf<RULE.minPF||stat.win<RULE.minWin||stat.net<=0)return null;
  const mfeMae=stat.avgMfe/Math.max(stat.avgMae,.05);
  if(mfeMae<RULE.minMfeMae||stat.fast>RULE.maxFastStopRate)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  const dir=String(stat.model).includes('LONG')?'LONG':'SHORT';
  let sig=null;
  for(let k=0;k<=2;k++){
    sig=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(sig){
      const drift=Math.abs(last.close-sig.entry)/Math.max(Math.abs(sig.entry),1)*100;
      if(drift<=0.30){
        const oldR=Math.abs(sig.entry-sig.stop);
        sig.entry=last.close;
        if(dir==='LONG'){sig.stop=Math.min(sig.stop,last.low-(last.atr||oldR)*.12);}
        else{sig.stop=Math.max(sig.stop,last.high+(last.atr||oldR)*.12);}
        const r=Math.abs(sig.entry-sig.stop); sig.t1=dir==='LONG'?sig.entry+r*1.45:sig.entry-r*1.45; sig.t2=dir==='LONG'?sig.entry+r*2.10:sig.entry-r*2.10; sig.t3=dir==='LONG'?sig.entry+r*2.95:sig.entry-r*2.95; sig.stopPct=r/sig.entry*100; sig.rr=1.45;
        break;
      }
      sig=null;
    }
  }
  if(!sig)return null;
  if(sig.stopPct>RULE.maxStopPct||sig.rr<RULE.minRR)return null;
  const htf=v149MTFState(sym,tf,dir); if(!htf.ok)return null;
  const sr=statStopRisk(stat); if(sr.hard||sr.lastStop||sr.recentStops>=2)return null;
  let rawConf=Math.round(sig.q*.48+Math.min(stat.pf,4)*6.2+stat.win*.16+Math.min(mfeMae,3)*5.5+Math.min(stat.count,50)*.18+Math.max(-6,Math.min(8,stat.net*.35))-stat.fast*.22);
  rawConf=Math.max(1,Math.min(99,rawConf));
  const capInfo=confidenceCaps(sig,stat,rawConf,mfeMae);
  const lev=leverage(sig,capInfo.conf),rClass=riskClass(sig.stopPct,lev.lev);
  if(rClass==='Yüksek')return null;
  return adjustRiskConfidence({sym,tf,model:sig.model,sub:sig.sub,dir:sig.dir,conf:capInfo.conf,rawConf,cap:capInfo.cap,capNotes:['kurumsal teknik filtre',...capInfo.notes],riskClass:rClass,entry:sig.entry,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source:sourceMap[key]||'Taze veri',liveOnly:false,stale:false});
}
function buildLiveCandidate(sym,tf,raw,b){
  sym=cleanSymbol(sym); if(!sym||!raw||raw.length<260)return [];
  const c=(b&&b.candles)||enrich(raw),last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return [];
  const out=[];
  for(const dir of ['LONG','SHORT']){
    const sig=signalForSymbol(c,c.length-1,'BAGLI '+dir,sym,tf);
    if(!sig||sig.stopPct>RULE.maxStopPct||sig.rr<RULE.minRR)continue;
    const stat=pickStatForDir(b,dir),hasStat=stat.count>=RULE.minTrades;
    if(!hasStat)continue; // v15.0: backtest örneği olmayan canlı bağlam adayını listeye basma.
    const mfeMae=stat.avgMfe/Math.max(stat.avgMae,.05);
    if(stat.pf<RULE.minPF||stat.win<RULE.minWin||mfeMae<RULE.minMfeMae||stat.fast>RULE.maxFastStopRate)continue;
    const capInfo=confidenceCaps(sig,stat,Math.round(sig.q*.55+Math.min(stat.pf,4)*5+stat.win*.13),mfeMae);
    if(capInfo.conf<RULE.minConf)continue;
    const lev=leverage(sig,capInfo.conf),rClass=riskClass(sig.stopPct,lev.lev);
    if(rClass==='Yüksek')continue;
    out.push(adjustRiskConfidence({sym,tf,model:sig.model,sub:sig.sub,dir:sig.dir,conf:capInfo.conf,rawConf:capInfo.conf,cap:capInfo.cap,capNotes:['kurumsal teknik filtre','son mum teknik teyit'],riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source:sourceMap[key]||'Taze veri',liveOnly:false,stale:false}));
  }
  return out.filter(Boolean).sort(candidateRank).slice(0,2);
}
function adjustRiskConfidence(obj){
  if(!obj)return obj;
  const prof=dataProfile(obj.sym,obj.tf,obj.candles);
  obj.source=prof.source||obj.source||'Taze veri'; obj.candleSource=prof.candleSource; obj.priceSource=prof.priceSource; obj.jsonAgeSec=prof.jsonAgeSec; obj.ageSec=prof.ageSec;
  obj.capNotes=[...(obj.capNotes||[])];
  let cap=Math.min(obj.cap||90, sourceCap(obj.source));
  if(String(obj.source).includes('JSON TAZE')){cap=Math.min(cap,86);obj.capNotes.push('JSON taze tavanı')}
  if(String(obj.source).includes('REST')){cap=Math.min(cap,89);obj.capNotes.push('REST tavanı')}
  if(String(obj.source).includes('WS')){cap=Math.min(cap,92);obj.capNotes.push('WS canlı')}
  const n=obj.stat&&isFinite(obj.stat.count)?obj.stat.count:0;
  if(n<20)cap=Math.min(cap,80); else if(n<30)cap=Math.min(cap,84); else if(n<50)cap=Math.min(cap,88);
  const sr=statStopRisk(obj.stat); if(sr.notes.length){cap=Math.min(cap,sr.cap);obj.capNotes.push(...sr.notes)}
  if(sr.hard||sr.lastStop)return null;
  if(obj.stopPct<minStopPctFor(obj.sym,obj.tf)*.95){cap=Math.min(cap,78);obj.capNotes.push('stop noise sınırı')}
  if(obj.stopPct>RULE.maxStopPct)return null;
  if(obj.riskClass==='Yüksek')return null;
  obj.rawConf=Math.max(1,Math.min(99,Math.round(obj.rawConf||obj.conf||0)));
  obj.conf=Math.max(1,Math.min(obj.rawConf,Math.round(cap)));
  obj.qualityScore=Math.round(candidateQualityScore(obj));
  if(obj.conf<RULE.minConf)return null;
  return obj;
}
function mainListEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if((x.stopPct||999)>RULE.maxMainStopPct)return false;
  if((x.conf||0)<RULE.minConf)return false;
  if(x.riskClass==='Yüksek')return false;
  if(x.liveOnly||x.contextFallback)return false;
  const st=x.stat||{};
  if((st.count||0)<RULE.minTrades||(st.pf||0)<RULE.minPF||(st.win||0)<RULE.minWin)return false;
  return true;
}
function rankedList(dir,limit=7){
  return candidates.filter(x=>x&&x.dir===dir&&mainListEligible(x)).sort(candidateRank).slice(0,limit);
}
function firstAutoCandidateIndex(){
  const x=rankedList('LONG',1)[0]||rankedList('SHORT',1)[0];
  return x?candidates.indexOf(x):-1;
}
function countByDir(dir){return candidates.filter(x=>x&&x.dir===dir&&mainListEligible(x)).length;}
function renderList(){
  const box=$('list'); const longs=rankedList('LONG',7),shorts=rankedList('SHORT',7);
  const rawLong=candidates.filter(x=>x&&x.dir==='LONG').length,rawShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const summary=`<div class="dash"><div><b>${longs.length}</b><span>kaliteli LONG</span></div><div><b>${shorts.length}</b><span>kaliteli SHORT</span></div><div><b>${rawLong+rawShort}</b><span>ham teknik aday</span></div><div><b>${scanLog.lowQuality||0}</b><span>kalite elendi</span></div><div><b>${scanLog.lossCluster||0}</b><span>son performans elendi</span></div><div><b>${scanLog.invalid||0}</b><span>bozuk sembol</span></div></div>`;
  if(!longs.length&&!shorts.length){box.innerHTML=summary+'<div class="decision wait">KALİTELİ ADAY YOK</div><p>Motor liste doldurmak için zayıf bağlam adayı üretmez. Trend + MTF + piyasa yapısı + lokasyon + momentum + hacim/para akışı + mum tetik + volatilite aynı anda geçmeden işlem gösterilmez.</p>';return;}
  const card=(x,i)=>{const idx=candidates.indexOf(x);const bt=`İşlem ${x.stat.count} | Win ${pct(x.stat.win,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf,2)} | Net ${money(x.stat.net)}`;const spot=x.dir==='LONG'?'<span class="pill green">spot AL uygun</span>':'<span class="pill red">spotta short değil</span>';return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.conf}%<br><span style="font-size:16px">${x.dir}</span></div></div><div class="line">Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | RR ${fmt(x.rr,2)}<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source} | Kalite: ${x.qualityScore||'-'}<br>Teknik: ${(x.why||[]).join(' + ')}<br>Risk: ${x.riskClass} | Ham ${x.rawConf}% → Gerçekçi ${x.conf}%</div><div>${spot}<span class="pill blue">kurumsal teknik filtre</span>${(x.capNotes||[]).slice(0,2).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):'<p>Bu yönde teknik kalite eşiğini geçen aday yok.</p>'}</div>`;
  box.innerHTML=summary+section('En İyi 7 LONG İşlem',longs,'LONG','Sadece yüksek teknik teyitli spot AL adayları. Liste dolsun diye zayıf işlem eklenmez.')+section('En İyi 7 SHORT İşlem',shorts,'SHORT','Spotta emir değil; vadeli/marjin veya longdan çıkış-dikkat listesi. Zayıf shortlar gösterilmez.');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} İŞLEM — TEKNİK GÜVEN ${x.conf}%`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Mum kaynağı',x.candleSource||x.source||'Taze veri')+metric('Fiyat kaynağı',x.priceSource||x.source||'Taze veri')+metric('Risk sınıfı',x.riskClass)+metric('Ham/Gerçekçi güven',`${x.rawConf}% / ${x.conf}%`)+metric('Kalite puanı',x.qualityScore||'-')+metric('Teknik çekirdek',(x.why||[]).join(' + '))+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Spot tutar',fmt(RULE.spotTry,0)+' TL')+metric('Kaldıraç modeli',`x${fmt(x.lev.lev,1)}`)+metric('Model pozisyon',dualMoney(x.lev.notional))+metric('Model marjin',dualMoney(x.lev.margin))+metric('Risk',dualMoney(x.lev.riskD))+metric('RR',fmt(x.rr,2))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=x.why.map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe,2)}R / ${fmt(x.stat.avgMae,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,5).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function memoryButtons(){return '';}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.';
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString('tr-TR',{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==='LONG'){
    const stopLimit=x.stop*0.998, riskTry=RULE.spotTry*(x.stopPct/100), p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — 10.000 TL teknik plan</b><div class="tryline">Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa TRY paritesini kullan. Yoksa bu adayı Binance TR spot için uygulama.</div><div class="tryline">Limit AL referansı: ${tlInput(x.entry)} TL | Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline">OCO SAT: TP1 ${tlInput(x.t1)} TL | Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div><div class="tryline"><b>Teknik şart:</b> girişten sonra mum kapanışı zayıflarsa veya fiyat stopa yaklaşmadan trend bozulursa emir tekrar gözden geçirilir.</div>`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Bu yön Binance TR spotta doğrudan short olarak açılamaz. Vadeli/marjin altyapısı gerekir; spot kullanıcı için çıkış/dikkat/long açmama sinyalidir.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL</div>`;
}
async function scanAll(){
  setMeta(`Kurumsal teknik tarama başladı: ${SYMBOLS.length} coin x ${TFS.length} TF. Zayıf bağlam adayları artık listeye basılmaz...`);
  candidates=[]; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=260&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const st of b.stats){const cand=buildCandidate(s,tf,b,st); if(cand)candidates.push(cand)}} for(const cand of asArray(buildLiveCandidate(s,tf,arr,b))){if(cand)candidates.push(cand)} if(candidates.length>before||done%12===0){sortCandidates();renderList()}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | Kurumsal teknik tarama ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG kaliteli: ${countByDir('LONG')} | SHORT kaliteli: ${countByDir('SHORT')} | Zayıf/elenen: ${scanLog.lowQuality||0} | Eski/bozuk: ${(scanLog.stale||0)+(scanLog.invalid||0)}`); await delay(18);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} kontrol | Kaliteli LONG: ${countByDir('LONG')} / 7 | Kaliteli SHORT: ${countByDir('SHORT')} / 7 | Eski veri: ${scanLog.stale||0} | Bozuk sembol: ${scanLog.invalid||0} | v15.0 kurumsal teknik kalite aktif`);
}


/* =========================================================
   v15.0 PROFESYONEL TEKNIK ANALIZ REVIZYONU
   Ana hedef: stopa giden zayıf girişleri engellemek.
   Liste doldurma yok. Teknik kalite + hedef/stop gerçekliği yoksa işlem yok.
========================================================= */
Object.assign(RULE,{
  minConf:72,
  liveOnlyMinConf:70,
  minTrades:24,
  minPF:1.75,
  minWin:62,
  minMfeMae:1.35,
  maxFastStopRate:12,
  minRR:1.45,
  maxStopPct:2.85,
  maxMainStopPct:2.45,
  cooldown:9,
  minConfluence:9,
  maxConf:90,
  // v15: TP2 gerçekliği ana filtre. Kullanıcı TP2 hedeflediği için oda yoksa işlem yok.
  minTp2RoomR:1.85,
  minBreakEvenRoomR:1.15,
  maxEntryDriftAtr:0.38,
  maxEntryDriftPct:0.22,
  minAdxTrend:18,
  maxFlatBbWidth:2.05,
  minStopMajor15m:.75,
  minStopAlt15m:1.10
});

function v150Bar(c,i){
  const x=c[i],p=c[i-1]||x,p2=c[i-2]||p,p3=c[i-3]||p2;
  const range=Math.max(x.high-x.low,1e-9), body=Math.abs(x.close-x.open);
  const upper=x.high-Math.max(x.open,x.close), lower=Math.min(x.open,x.close)-x.low;
  const bodyPct=body/range, upperPct=upper/range, lowerPct=lower/range;
  const up3=x.close>p.close&&p.close>p2.close&&p2.close>p3.close;
  const dn3=x.close<p.close&&p.close<p2.close&&p2.close<p3.close;
  return {x,p,p2,p3,range,body,bodyPct,upper,lower,upperPct,lowerPct,bull:x.close>x.open,bear:x.close<x.open,up3,dn3};
}
function v150Trend(c,i,dir){
  const x=c[i],p=c[i-1];
  const slope21=x.e21-p.e21, slope55=x.e55-p.e55, slope100=x.e100-p.e100;
  const longFull=x.e21>x.e55&&x.e55>x.e100&&x.close>x.e21&&slope21>0&&slope55>=0;
  const shortFull=x.e21<x.e55&&x.e55<x.e100&&x.close<x.e21&&slope21<0&&slope55<=0;
  const longPull=x.e21>=x.e55*.995&&x.close>=x.e55&&slope21>=0&&x.close>=x.e100*.985;
  const shortPull=x.e21<=x.e55*1.005&&x.close<=x.e55&&slope21<=0&&x.close<=x.e100*1.015;
  const longHardBad=x.e21<x.e55&&x.close<x.e100&&slope21<0;
  const shortHardBad=x.e21>x.e55&&x.close>x.e100&&slope21>0;
  const ok=dir==='LONG'?(longFull||longPull):shortFull||shortPull;
  const strong=dir==='LONG'?longFull:shortFull;
  const hardBad=dir==='LONG'?longHardBad:shortHardBad;
  return {ok,strong,hardBad,slope21,slope55,slope100,label:strong?'ana trend':'pullback trend'};
}
function v150Mtf(sym,tf,dir){
  const htf=htfFor(tf),raw=getCandles(sym,htf); let selfOk=false,selfStrong=false,selfHard=false;
  if(raw&&raw.length>=240){
    const c=enrich(raw),x=c[c.length-1],p=c[c.length-2];
    selfOk=dir==='LONG'?(x.close>x.e55&&x.e21>=x.e55*.995&&x.e21>=p.e21*.998):(x.close<x.e55&&x.e21<=x.e55*1.005&&x.e21<=p.e21*1.002);
    selfStrong=dir==='LONG'?(x.e21>x.e55&&x.e55>=x.e100*.995):(x.e21<x.e55&&x.e55<=x.e100*1.005);
    selfHard=dir==='LONG'?(x.close<x.e100&&x.e21<x.e55):(x.close>x.e100&&x.e21>x.e55);
  } else { selfOk=false; selfHard=true; }
  const btcRaw=getCandles('BTCUSDT',tf); let btcOk=true,btcHard=false;
  if(sym!=='BTCUSDT'&&btcRaw&&btcRaw.length>=240){
    const b=enrich(btcRaw),x=b[b.length-1],p=b[b.length-2];
    btcOk=dir==='LONG'?(x.close>=x.e55*.992&&x.e21>=p.e21*.997):(x.close<=x.e55*1.008&&x.e21<=p.e21*1.003);
    btcHard=dir==='LONG'?(x.close<x.e100*.985&&x.e21<x.e55):(x.close>x.e100*1.015&&x.e21>x.e55);
  }
  return {ok:selfOk&&btcOk&&!selfHard&&!btcHard,selfOk,btcOk,selfStrong,selfHard,btcHard,htf};
}
function v150Structure(c,i,dir){
  const x=c[i],p=c[i-1],a=x.atr||x.high-x.low||1,ms=marketStructure(c,i);
  const pivotSup=ms.lastLow?ms.lastLow.v:x.sup34, pivotRes=ms.lastHigh?ms.lastHigh.v:x.res34;
  const zSup=zoneStrength(c,i,pivotSup,'sup'), zRes=zoneStrength(c,i,pivotRes,'res');
  const brokeUp=ms.lastHigh&&x.close>ms.lastHigh.v&&p.close<=ms.lastHigh.v+a*.08;
  const brokeDn=ms.lastLow&&x.close<ms.lastLow.v&&p.close>=ms.lastLow.v-a*.08;
  const sweepLow=x.low<lo(c,i-1,40)&&x.close>x.low+a*.42&&x.close>p.close;
  const sweepHigh=x.high>hi(c,i-1,40)&&x.high-x.close>a*.42&&x.close<p.close;
  const okLong=ms.up||brokeUp||ms.chochUp||sweepLow||(zSup.ok&&!ms.down);
  const okShort=ms.down||brokeDn||ms.chochDown||sweepHigh||(zRes.ok&&!ms.up);
  const hardBadLong=ms.down&&!ms.chochUp&&!sweepLow&&!brokeUp;
  const hardBadShort=ms.up&&!ms.chochDown&&!sweepHigh&&!brokeDn;
  return {ok:dir==='LONG'?okLong:okShort,hardBad:dir==='LONG'?hardBadLong:hardBadShort,ms,pivotSup,pivotRes,zSup,zRes,brokeUp,brokeDn,sweepLow,sweepHigh};
}
function v150Location(c,i,dir,st){
  const x=c[i],p=c[i-1],p2=c[i-2],a=x.atr||x.high-x.low||1,b=v150Bar(c,i);
  const nearSup=Math.abs(x.low-st.pivotSup)<=a*.92 || Math.abs(x.close-x.sup34)<=a*.65 || (x.low<=x.e21+a*.32&&x.close>=x.e21-a*.10);
  const nearRes=Math.abs(x.high-st.pivotRes)<=a*.92 || Math.abs(x.close-x.res34)<=a*.65 || (x.high>=x.e21-a*.32&&x.close<=x.e21+a*.10);
  const bullFvg=p2&&p2.high<x.low&&x.close>p2.high;
  const bearFvg=p2&&p2.low>x.high&&x.close<p2.low;
  const pullLong=x.low<=x.e21+a*.36&&x.close>x.e21&&x.e21>=x.e55*.995;
  const pullShort=x.high>=x.e21-a*.36&&x.close<x.e21&&x.e21<=x.e55*1.005;
  const breakRetestLong=st.brokeUp || (st.ms.lastHigh&&x.low<=st.ms.lastHigh.v+a*.25&&x.close>st.ms.lastHigh.v);
  const breakRetestShort=st.brokeDn || (st.ms.lastLow&&x.high>=st.ms.lastLow.v-a*.25&&x.close<st.ms.lastLow.v);
  // Chase filtresi: fiyat lokasyondan kaçmışsa işlem kalitesi yoktur.
  const chaseLong=(x.close>x.e21+a*1.38&&!breakRetestLong&&!st.sweepLow) || b.up3;
  const chaseShort=(x.close<x.e21-a*1.38&&!breakRetestShort&&!st.sweepHigh) || b.dn3;
  const labels=[];
  if(dir==='LONG'){if(nearSup)labels.push('destek');if(pullLong)labels.push('EMA pullback');if(bullFvg)labels.push('bullish FVG');if(st.sweepLow)labels.push('likidite dönüşü');if(breakRetestLong)labels.push('BOS retest');}
  else{if(nearRes)labels.push('direnç');if(pullShort)labels.push('EMA pullback');if(bearFvg)labels.push('bearish FVG');if(st.sweepHigh)labels.push('likidite dönüşü');if(breakRetestShort)labels.push('BOS retest');}
  const ok=dir==='LONG'?(nearSup||pullLong||bullFvg||st.sweepLow||breakRetestLong):nearRes||pullShort||bearFvg||st.sweepHigh||breakRetestShort;
  return {ok:ok&&!(dir==='LONG'?chaseLong:chaseShort),chase:dir==='LONG'?chaseLong:chaseShort,labels,bullFvg,bearFvg,pullLong,pullShort,breakRetestLong,breakRetestShort};
}
function v150Momentum(c,i,dir){
  const x=c[i],p=c[i-1];
  const longOk=x.rsi>=51&&x.rsi<=66&&x.macd>=p.macd&&x.pdi>=x.mdi&&x.adx>=RULE.minAdxTrend;
  const shortOk=x.rsi<=49&&x.rsi>=34&&x.macd<=p.macd&&x.mdi>=x.pdi&&x.adx>=RULE.minAdxTrend;
  const longEarly=x.rsi>=48&&x.rsi<=62&&x.macd>p.macd&&x.pdi>x.mdi&&x.adx>=15;
  const shortEarly=x.rsi<=52&&x.rsi>=38&&x.macd<p.macd&&x.mdi>x.pdi&&x.adx>=15;
  const over=dir==='LONG'?x.rsi>69:x.rsi<31;
  return {ok:(dir==='LONG'?(longOk||longEarly):(shortOk||shortEarly))&&!over,over};
}
function v150Flow(c,i,dir){
  const x=c[i],p=c[i-1];
  const volBase=x.v20||0,volOk=!volBase||x.volume>=volBase*.95,volStrong=!volBase||x.volume>=volBase*1.20;
  const longOk=((x.cmf>0.00&&x.obvSlope>=0)||(volStrong&&x.close>x.open))&&volOk;
  const shortOk=((x.cmf<0.00&&x.obvSlope<=0)||(volStrong&&x.close<x.open))&&volOk;
  const badDivLong=x.close>p.close&&x.obvSlope<0&&x.cmf<-.05;
  const badDivShort=x.close<p.close&&x.obvSlope>0&&x.cmf>.05;
  return {ok:(dir==='LONG'?longOk&&!badDivLong:shortOk&&!badDivShort),volOk,volStrong,badDiv:dir==='LONG'?badDivLong:badDivShort};
}
function v150Trigger(c,i,dir){
  const x=c[i],p=c[i-1],b=v150Bar(c,i);
  const longReject=b.lowerPct>=.32&&x.close>x.open&&x.close>=p.close;
  const shortReject=b.upperPct>=.32&&x.close<x.open&&x.close<=p.close;
  const longClose=x.close>p.high || (x.close>x.e21&&x.close>p.close&&b.bodyPct>=.32);
  const shortClose=x.close<p.low || (x.close<x.e21&&x.close<p.close&&b.bodyPct>=.32);
  const ok=dir==='LONG'?(longReject||longClose||microCandle(c,i,'LONG')):(shortReject||shortClose||microCandle(c,i,'SHORT'));
  return {ok,body:b};
}
function v150Volatility(c,i,dir,loc,st){
  const x=c[i];
  const flat=x.adx<14&&x.bbWidth<RULE.maxFlatBbWidth;
  const squeeze=x.bbWidth<1.55&&x.adx<18;
  const ok=!flat&&!squeeze&&(x.atr&&x.atr/x.close*100>.35);
  return {ok:ok||st.sweepLow||st.sweepHigh||loc.breakRetestLong||loc.breakRetestShort,flat,squeeze};
}
function v150Plan(c,i,dir,st,loc){
  const x=c[i],p=c[i-1],a=x.atr||x.high-x.low||1,entry=x.close;
  let stop,r;
  if(dir==='LONG'){
    const structural=Math.min(x.low-a*.42,p.low-a*.24,st.pivotSup-a*.22,x.e55-a*.16);
    r=Math.max(entry-structural,a*.78,entry*minStopPctFor('BTCUSDT','15m')/100);
    stop=entry-r;
  }else{
    const structural=Math.max(x.high+a*.42,p.high+a*.24,st.pivotRes+a*.22,x.e55+a*.16);
    r=Math.max(structural-entry,a*.78,entry*minStopPctFor('BTCUSDT','15m')/100);
    stop=entry+r;
  }
  let stopPct=Math.abs(entry-stop)/entry*100;
  return {entry,stop,r,stopPct};
}
function v150Room(c,i,dir,entry,r,st){
  const x=c[i],a=x.atr||x.high-x.low||1;
  const candidates=dir==='LONG'
    ? [st.pivotRes,x.res34,x.res,hi(c,i,100),''].filter(v=>Number(v)>entry+a*.25)
    : [st.pivotSup,x.sup34,x.sup,lo(c,i,100),''].filter(v=>Number(v)<entry-a*.25);
  let nearest=dir==='LONG'?Math.min(...candidates.map(Number)):Math.max(...candidates.map(Number));
  if(!isFinite(nearest)){nearest=dir==='LONG'?entry+r*3.2:entry-r*3.2;}
  const rawRoom=dir==='LONG'?nearest-entry:entry-nearest;
  const roomR=rawRoom/Math.max(r,1e-9);
  return {nearest,roomR,rawRoom,ok:roomR>=RULE.minTp2RoomR};
}
function v150TechGate(c,i,dir,sym,tf){
  if(i<230)return null;
  const trend=v150Trend(c,i,dir),mtf=v150Mtf(sym,tf,dir),st=v150Structure(c,i,dir),loc=v150Location(c,i,dir,st),mom=v150Momentum(c,i,dir),flow=v150Flow(c,i,dir),trig=v150Trigger(c,i,dir),vol=v150Volatility(c,i,dir,loc,st);
  const reasons=[]; let hard=false;
  function require(ok,label){if(ok)reasons.push(label); else hard=true;}
  require(trend.ok&&!trend.hardBad,'trend');
  require(mtf.ok,'üst zaman teyidi');
  require(st.ok&&!st.hardBad,'piyasa yapısı');
  require(loc.ok&&!loc.chase,'lokasyon');
  require(mom.ok&&!mom.over,'momentum');
  require(flow.ok&&!flow.badDiv,'hacim/para akışı');
  require(trig.ok,'mum tetik');
  require(vol.ok,'volatilite');
  const plan=v150Plan(c,i,dir,st,loc);
  const minStop=minStopPctFor(sym,tf); // gerçek coin/TF için noise stop alt sınırı
  if(plan.stopPct<minStop){
    const rr=plan.entry*minStop/100; plan.r=rr; plan.stop=dir==='LONG'?plan.entry-rr:plan.entry+rr; plan.stopPct=minStop;
  }
  if(plan.stopPct>RULE.maxStopPct)hard=true;
  const room=v150Room(c,i,dir,plan.entry,plan.r,st);
  require(room.ok,'TP2 alanı');
  const rr1=1.18,rr2=1.80,rr3=2.55;
  let t1=dir==='LONG'?plan.entry+plan.r*rr1:plan.entry-plan.r*rr1;
  let t2=dir==='LONG'?plan.entry+plan.r*rr2:plan.entry-plan.r*rr2;
  let t3=dir==='LONG'?plan.entry+plan.r*rr3:plan.entry-plan.r*rr3;
  // Hedefleri ilk güçlü duvarın ötesine körlemesine taşıma. TP2 duvar önünde kalmalı.
  if(dir==='LONG'&&isFinite(room.nearest)){t2=Math.min(t2,room.nearest-plan.r*.12);t3=Math.min(t3,room.nearest+plan.r*.28)}
  if(dir==='SHORT'&&isFinite(room.nearest)){t2=Math.max(t2,room.nearest+plan.r*.12);t3=Math.max(t3,room.nearest-plan.r*.28)}
  const rr=Math.abs(t1-plan.entry)/Math.abs(plan.entry-plan.stop);
  if(rr<RULE.minRR)hard=true;
  const labels=[...new Set([...(loc.labels||[]), ...(st.brokeUp||st.brokeDn?['BOS']:[]), ...(st.ms.chochUp||st.ms.chochDown?['CHOCH']:[])])];
  let q=18+reasons.length*8;
  if(trend.strong)q+=5; if(mtf.selfStrong)q+=5; if(flow.volStrong)q+=4; if(st.sweepLow||st.sweepHigh)q+=4; if(room.roomR>=2.5)q+=5; if(plan.stopPct<=1.8)q+=4; if(plan.stopPct>2.35)q-=5;
  if(hard)q-=45;
  const ok=!hard&&reasons.length>=8&&plan.stopPct<=RULE.maxStopPct&&room.roomR>=RULE.minTp2RoomR;
  return {ok,reasons,sub:labels,dir,entry:plan.entry,stop:plan.stop,t1,t2,t3,stopPct:plan.stopPct,rr,room,q:Math.max(0,Math.min(100,q)),detail:{trend,mtf,st,loc,mom,flow,trig,vol,room}};
}
function signalForSymbol(c,i,model,sym,tf){
  const dir=model.includes('LONG')?'LONG':'SHORT';
  const g=v150TechGate(c,i,dir,sym,tf);
  if(!g||!g.ok)return null;
  return {model:'v15 Kurumsal Teknik '+dir,sub:g.sub.slice(0,3).join(' + ')||'tam teyit',dir,entry:g.entry,stop:g.stop,t1:g.t1,t2:g.t2,t3:g.t3,atr:c[i].atr||0,stopPct:g.stopPct,rr:g.rr,why:g.reasons,q:g.q,techDetail:g.detail,tp2RoomR:g.room.roomR};
}
function signal(c,i,model){return signalForSymbol(c,i,model,'BTCUSDT','15m');}
function simulate(c,sig,start){
  const risk=Math.abs(sig.entry-sig.stop); if(!risk)return null;
  let mfe=0,mae=0,exit='ZAMAN',pnl=-.08,bars=0,peakR=0,tp1Hit=false;
  for(let j=start+1;j<Math.min(c.length,start+80);j++){
    const x=c[j]; bars++;
    if(sig.dir==='LONG'){
      const fav=(x.high-sig.entry)/risk, adv=(sig.entry-x.low)/risk; mfe=Math.max(mfe,fav); mae=Math.max(mae,adv); peakR=Math.max(peakR,fav);
      if(x.low<=sig.stop){exit=bars<=5?'HIZLI STOP':'STOP'; pnl=-1; break;}
      if(x.high>=sig.t3){exit='TP3'; pnl=2.55; break;}
      if(x.high>=sig.t2){exit='TP2'; pnl=1.80; break;}
      if(x.high>=sig.t1){tp1Hit=true;}
      if(tp1Hit&&x.close<sig.entry+risk*.18){exit='KORUMALI ÇIKIŞ'; pnl=.28; break;}
      if(peakR>=1.25&&fav<peakR*.42&&bars>4){exit='DİNAMİK ÇIKIŞ'; pnl=Math.max(.35,peakR*.48); break;}
      if(bars>16&&mfe<.70){exit='ZAMAN'; pnl=-.25; break;}
    }else{
      const fav=(sig.entry-x.low)/risk, adv=(x.high-sig.entry)/risk; mfe=Math.max(mfe,fav); mae=Math.max(mae,adv); peakR=Math.max(peakR,fav);
      if(x.high>=sig.stop){exit=bars<=5?'HIZLI STOP':'STOP'; pnl=-1; break;}
      if(x.low<=sig.t3){exit='TP3'; pnl=2.55; break;}
      if(x.low<=sig.t2){exit='TP2'; pnl=1.80; break;}
      if(x.low<=sig.t1){tp1Hit=true;}
      if(tp1Hit&&x.close>sig.entry-risk*.18){exit='KORUMALI ÇIKIŞ'; pnl=.28; break;}
      if(peakR>=1.25&&fav<peakR*.42&&bars>4){exit='DİNAMİK ÇIKIŞ'; pnl=Math.max(.35,peakR*.48); break;}
      if(bars>16&&mfe<.70){exit='ZAMAN'; pnl=-.25; break;}
    }
  }
  if(exit==='ZAMAN'){
    const last=c[Math.min(c.length-1,start+80)].close;
    const r=sig.dir==='LONG'?(last-sig.entry)/risk:(sig.entry-last)/risk;
    pnl=Math.max(-.35,Math.min(1.15,r));
  }
  return {date:new Date(c[start].time).toLocaleDateString('tr-TR'),dir:sig.dir,exit,pnl,mfe,mae,bars};
}
function v150RecentGate(stat){
  const out={ok:true,cap:90,notes:[]};
  if(!stat||!Array.isArray(stat.trades)||stat.trades.length<_RULE_SAFE('minTrades')){out.ok=false;out.notes.push('örneklem yok');return out;}
  const last=stat.trades.slice(-12), last6=stat.trades.slice(-6);
  const win12=last.length?last.filter(t=>t.pnl>0).length/last.length*100:0;
  const loss12=Math.abs(last.filter(t=>t.pnl<0).reduce((a,b)=>a+b.pnl,0));
  const winR12=last.filter(t=>t.pnl>0).reduce((a,b)=>a+b.pnl,0);
  const pf12=loss12?winR12/loss12:(winR12>0?20:0);
  const fast6=last6.filter(t=>String(t.exit).includes('STOP')||t.pnl<=-0.80).length;
  if(last.length>=8&&win12<55){out.ok=false;out.notes.push('son dönem win zayıf');}
  if(last.length>=8&&pf12<1.20){out.ok=false;out.notes.push('son dönem PF zayıf');}
  if(fast6>=2){out.ok=false;out.notes.push('son 6 işlemde stop kümelenmesi');}
  if(stat.fast>RULE.maxFastStopRate){out.ok=false;out.notes.push('hızlı stop oranı yüksek');}
  if(win12<65)out.cap=Math.min(out.cap,84);
  if(pf12<1.65)out.cap=Math.min(out.cap,84);
  return out;
}
function _RULE_SAFE(k){return RULE&&RULE[k]!==undefined?RULE[k]:0}
function confidenceCaps(sig,stat,rawConf,mfeMae){
  let cap=88,notes=[]; const n=stat&&stat.count?stat.count:0;
  if(n<24){cap=Math.min(cap,0);notes.push('24 altı örneklem reddi')}
  else if(n<35){cap=Math.min(cap,80);notes.push('35 altı örneklem')}
  else if(n<50){cap=Math.min(cap,84);notes.push('50 altı örneklem')}
  else if(n<80){cap=Math.min(cap,87);notes.push('80 altı örneklem')}
  if((stat&&stat.win||0)<62){cap=Math.min(cap,0);notes.push('win 62 altı reddi')}
  else if(stat.win<68){cap=Math.min(cap,82);notes.push('win 68 altı')}
  if((stat&&stat.pf||0)<1.75){cap=Math.min(cap,0);notes.push('PF 1.75 altı reddi')}
  else if(stat.pf<2.20){cap=Math.min(cap,84);notes.push('PF 2.20 altı')}
  if(mfeMae<1.35){cap=Math.min(cap,0);notes.push('MFE/MAE 1.35 altı reddi')}
  else if(mfeMae<1.65){cap=Math.min(cap,84);notes.push('MFE/MAE orta')}
  if(sig.stopPct>2.45){cap=Math.min(cap,80);notes.push('stop geniş')}
  if(sig.tp2RoomR&&sig.tp2RoomR<RULE.minTp2RoomR){cap=0;notes.push('TP2 alanı yetersiz')}
  if(sig.rr<1.45){cap=0;notes.push('RR yetersiz')}
  const rg=v150RecentGate(stat); if(!rg.ok){cap=0;notes.push(...rg.notes)} else {cap=Math.min(cap,rg.cap); notes.push(...rg.notes)}
  return {conf:Math.max(0,Math.min(Math.round(rawConf),cap)),cap,notes};
}
function backtest(sym,tf){
  const raw=getCandles(sym,tf); if(!raw||raw.length<330)return null;
  const c=enrich(raw),map={'v15 Kurumsal Teknik LONG':[],'v15 Kurumsal Teknik SHORT':[]}; let cd=0;
  for(let i=240;i<c.length-2;i++){
    if(cd>0){cd--;continue;}
    const sigs=['LONG','SHORT'].map(d=>signalForSymbol(c,i,'BAGLI '+d,sym,tf)).filter(Boolean).filter(s=>s.stopPct<=RULE.maxStopPct&&s.tp2RoomR>=RULE.minTp2RoomR).sort((a,b)=>b.q-a.q);
    if(!sigs.length)continue;
    const sig=sigs[0],tr=simulate(c,sig,i); if(!tr)continue;
    map[sig.model]=map[sig.model]||[]; map[sig.model].push(tr); cd=RULE.cooldown;
  }
  const stats=Object.keys(map).map(m=>calcStats(m,map[m])).filter(s=>s.count>0).sort((a,b)=>modelScore(b)-modelScore(a));
  return {sym,tf,candles:c,stats};
}
function buildCandidate(sym,tf,b,stat){
  sym=cleanSymbol(sym); if(!sym||!b||!stat)return null;
  if(stat.count<RULE.minTrades||stat.pf<RULE.minPF||stat.win<RULE.minWin||stat.net<=1.5)return null;
  const mfeMae=stat.avgMfe/Math.max(stat.avgMae,.05);
  if(mfeMae<RULE.minMfeMae||stat.fast>RULE.maxFastStopRate)return null;
  const recent=v150RecentGate(stat); if(!recent.ok)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  const dir=String(stat.model).includes('LONG')?'LONG':'SHORT';
  let sig=null;
  for(let k=0;k<=1;k++){
    sig=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(sig){
      const driftPct=Math.abs(last.close-sig.entry)/Math.max(Math.abs(sig.entry),1)*100;
      const driftAtr=Math.abs(last.close-sig.entry)/Math.max(last.atr||0,1e-9);
      if(driftPct<=RULE.maxEntryDriftPct&&driftAtr<=RULE.maxEntryDriftAtr){
        const oldR=Math.abs(sig.entry-sig.stop); sig.entry=last.close;
        if(dir==='LONG')sig.stop=Math.min(sig.stop,last.low-(last.atr||oldR)*.18); else sig.stop=Math.max(sig.stop,last.high+(last.atr||oldR)*.18);
        const r=Math.abs(sig.entry-sig.stop); sig.t1=dir==='LONG'?sig.entry+r*1.18:sig.entry-r*1.18; sig.t2=dir==='LONG'?sig.entry+r*1.80:sig.entry-r*1.80; sig.t3=dir==='LONG'?sig.entry+r*2.55:sig.entry-r*2.55; sig.stopPct=r/sig.entry*100; sig.rr=1.18;
        break;
      }
      sig=null;
    }
  }
  if(!sig||sig.stopPct>RULE.maxStopPct||sig.rr<RULE.minRR||sig.tp2RoomR<RULE.minTp2RoomR)return null;
  const sr=statStopRisk(stat); if(sr.hard||sr.lastStop||sr.recentStops>=1)return null;
  let rawConf=Math.round(sig.q*.45+Math.min(stat.pf,4)*5.5+stat.win*.15+Math.min(mfeMae,3)*5+Math.min(stat.count,80)*.13+Math.max(-6,Math.min(8,stat.net*.28))-stat.fast*.35);
  rawConf=Math.max(1,Math.min(99,rawConf));
  const capInfo=confidenceCaps(sig,stat,rawConf,mfeMae); if(capInfo.conf<RULE.minConf)return null;
  const lev=leverage(sig,capInfo.conf),rClass=riskClass(sig.stopPct,lev.lev); if(rClass==='Yüksek')return null;
  return adjustRiskConfidence({sym,tf,model:sig.model,sub:sig.sub,dir:sig.dir,conf:capInfo.conf,rawConf,cap:capInfo.cap,capNotes:['v15 profesyonel teknik filtre',...capInfo.notes],riskClass:rClass,entry:sig.entry,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,tp2RoomR:sig.tp2RoomR,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source:sourceMap[key]||'Taze veri',liveOnly:false,stale:false});
}
function buildLiveCandidate(sym,tf,raw,b){
  // v15: backtest ve son dönem performansı olmayan canlı bağlam adayı yok.
  return [];
}
function adjustRiskConfidence(obj){
  if(!obj)return obj; const prof=dataProfile(obj.sym,obj.tf,obj.candles);
  obj.source=prof.source||obj.source||'Taze veri'; obj.candleSource=prof.candleSource; obj.priceSource=prof.priceSource; obj.jsonAgeSec=prof.jsonAgeSec; obj.ageSec=prof.ageSec;
  obj.capNotes=[...(obj.capNotes||[])]; let cap=Math.min(obj.cap||88,sourceCap(obj.source));
  if(String(obj.source).includes('JSON TAZE')){cap=Math.min(cap,84);obj.capNotes.push('JSON taze tavanı')}
  if(String(obj.source).includes('REST')){cap=Math.min(cap,87);obj.capNotes.push('REST tavanı')}
  if(String(obj.source).includes('WS')){cap=Math.min(cap,90);obj.capNotes.push('WS canlı')}
  const n=obj.stat&&isFinite(obj.stat.count)?obj.stat.count:0; if(n<35)cap=Math.min(cap,80); else if(n<50)cap=Math.min(cap,84); else if(n<80)cap=Math.min(cap,87);
  if(obj.tp2RoomR&&obj.tp2RoomR<RULE.minTp2RoomR)return null;
  if(obj.stopPct>RULE.maxMainStopPct){cap=Math.min(cap,80);obj.capNotes.push('stop ana sınıra yakın')}
  if(obj.stopPct>RULE.maxStopPct||obj.riskClass==='Yüksek')return null;
  obj.rawConf=Math.max(1,Math.min(99,Math.round(obj.rawConf||obj.conf||0))); obj.conf=Math.max(1,Math.min(obj.rawConf,Math.round(cap)));
  obj.qualityScore=Math.round(candidateQualityScore(obj)+(obj.tp2RoomR?Math.min(8,obj.tp2RoomR*2):0));
  if(obj.conf<RULE.minConf)return null; return obj;
}
function mainListEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if((x.stopPct||999)>RULE.maxMainStopPct)return false;
  if((x.conf||0)<RULE.minConf)return false;
  if(x.riskClass==='Yüksek'||x.liveOnly||x.contextFallback)return false;
  const st=x.stat||{}; if((st.count||0)<RULE.minTrades||(st.pf||0)<RULE.minPF||(st.win||0)<RULE.minWin)return false;
  if((st.fast||0)>RULE.maxFastStopRate)return false;
  if(x.tp2RoomR&&x.tp2RoomR<RULE.minTp2RoomR)return false;
  return true;
}
function rankedList(dir,limit=7){return candidates.filter(x=>x&&x.dir===dir&&mainListEligible(x)).sort(candidateRank).slice(0,limit);}
function countByDir(dir){return candidates.filter(x=>x&&x.dir===dir&&mainListEligible(x)).length;}
function renderList(){
  const box=$('list'); const longs=rankedList('LONG',7),shorts=rankedList('SHORT',7);
  const rawLong=candidates.filter(x=>x&&x.dir==='LONG').length,rawShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const summary=`<div class="dash"><div><b>${longs.length}</b><span>prof. LONG</span></div><div><b>${shorts.length}</b><span>prof. SHORT</span></div><div><b>${rawLong+rawShort}</b><span>ham aday</span></div><div><b>${scanLog.lowQuality||0}</b><span>kalite elendi</span></div><div><b>${scanLog.lossCluster||0}</b><span>seri stop elendi</span></div><div><b>${scanLog.stale||0}</b><span>eski veri</span></div></div>`;
  if(!longs.length&&!shorts.length){box.innerHTML=summary+'<div class="decision wait">İŞLEM YOK — KALİTE GEÇMEDİ</div><p>v15 motor liste doldurmaz. Trend + üst zaman + piyasa yapısı + lokasyon + momentum + hacim/para akışı + mum tetik + volatilite + TP2 alanı + son dönem backtest birlikte geçmezse işlem göstermez.</p>';return;}
  const card=(x,i)=>{const idx=candidates.indexOf(x);const bt=`İşlem ${x.stat.count} | Win ${pct(x.stat.win,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf,2)} | Hızlı stop ${pct(x.stat.fast,1)}`;const spot=x.dir==='LONG'?'<span class="pill green">spot AL adayı</span>':'<span class="pill red">spotta short değil</span>';return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.conf}%<br><span style="font-size:16px">${x.dir}</span></div></div><div class="line">Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | RR ${fmt(x.rr,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source} | Kalite: ${x.qualityScore||'-'}<br>Teknik: ${(x.why||[]).join(' + ')}<br>Risk: ${x.riskClass} | Ham ${x.rawConf}% → Gerçekçi ${x.conf}%</div><div>${spot}<span class="pill blue">v15 tam teknik</span>${(x.capNotes||[]).slice(0,3).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):'<p>Bu yönde v15 kalite eşiğini geçen aday yok.</p>'}</div>`;
  box.innerHTML=summary+section('En İyi 7 LONG İşlem',longs,'LONG','Spot AL için yalnızca tam teknik teyitli ve TP2 alanı olan adaylar.')+section('En İyi 7 SHORT İşlem',shorts,'SHORT','Spotta emir değildir; vadeli/marjin veya eldeki longdan çıkış-dikkat listesi.');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} İŞLEM — v15 TEKNİK GÜVEN ${x.conf}%`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Mum/Fiyat kaynağı',`${x.candleSource||x.source} / ${x.priceSource||x.source}`)+metric('Risk sınıfı',x.riskClass)+metric('Ham/Gerçekçi güven',`${x.rawConf}% / ${x.conf}%`)+metric('Kalite puanı',x.qualityScore||'-')+metric('TP2 alanı',`${fmt(x.tp2RoomR||0,2)}R`)+metric('Teknik çekirdek',(x.why||[]).join(' + '))+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Spot tutar',fmt(RULE.spotTry,0)+' TL')+metric('Model pozisyon',dualMoney(x.lev.notional))+metric('Risk',dualMoney(x.lev.riskD))+metric('RR',fmt(x.rr,2))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=x.why.map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win,1)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe,2)}R / ${fmt(x.stat.avgMae,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,6).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.';
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString('tr-TR',{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==='LONG'){
    const stopLimit=x.stop*0.9975, riskTry=RULE.spotTry*(x.stopPct/100), p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — v15 korumalı plan</b><div class="tryline">Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa kullan. Yoksa bu adayı spotta uygulama.</div><div class="tryline">Limit AL referansı: ${tlInput(x.entry)} TL | Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline"><b>Tek OCO güvenli mod:</b> TP1 ${tlInput(x.t1)} TL | Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL.</div><div class="tryline"><b>TP2 modu:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan miktarı TP2’ye taşı.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Binance TR spotta doğrudan short açılamaz. Bu liste vadeli/marjin veya eldeki longdan çıkış-dikkat yönüdür.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2 alanı: ${fmt(x.tp2RoomR||0,2)}R</div>`;
}
async function scanAll(){
  setMeta(`v15 profesyonel teknik tarama başladı: ${SYMBOLS.length} coin x ${TFS.length} TF. Zayıf işlem, yetersiz TP2 alanı ve şişirilmiş backtest elenir...`);
  candidates=[]; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=330&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const st of b.stats){const cand=buildCandidate(s,tf,b,st); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%10===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15 teknik tarama ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG: ${countByDir('LONG')} | SHORT: ${countByDir('SHORT')} | Kalite elenen: ${scanLog.lowQuality||0} | Eski veri: ${scanLog.stale||0}`); await delay(18);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | Profesyonel LONG: ${countByDir('LONG')} / 7 | Profesyonel SHORT: ${countByDir('SHORT')} / 7 | Kalite elenen: ${scanLog.lowQuality||0} | v15 stop/TP/teknik kalite aktif`);
}

/* ============================================================
   v15.1 MILLI TAKIM SECICI — GENIS HAVUZ + EN IYI 7 SEÇIM
   Mantık: Aday havuzunu boğma. Önce geniş teknik adayları gör,
   sonra kalite puanıyla 7 LONG + 7 SHORT milli takım seç.
============================================================ */
Object.assign(RULE,{
  minConf:50,
  liveOnlyMinConf:48,
  maxStopPct:4.60,
  maxMainStopPct:4.60,
  minRR:1.05,
  minTrades:6,
  minPF:1.00,
  minWin:42,
  minMfeMae:0.60,
  maxFastStopRate:45,
  minTp2RoomR:1.05,
  maxEntryDriftPct:1.05,
  maxEntryDriftAtr:1.35,
  cooldown:2,
  poolMinScore:54,
  eliteMinScore:66,
  nationalTeamSize:7,
  minAdxTrend:12,
  maxFlatBbWidth:1.10
});

function v151Clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function v151Score01(x){return v151Clamp(x,0,100);}
function v151BoolScore(ok,strong=false,near=false){return strong?100:ok?78:near?56:20;}
function v151BaseProfile(sym){return MAJOR_BASES.has(baseAsset(sym))?'MAJOR':'ALT';}
function v151Bar(c,i){return v150Bar(c,i);}

function v151TrendScore(c,i,dir){
  const x=c[i],p=c[i-1]||x;
  const slope21=x.e21-p.e21, slope55=x.e55-p.e55;
  const longStrong=x.e21>x.e55&&x.e55>x.e100&&x.close>x.e21&&slope21>=0;
  const shortStrong=x.e21<x.e55&&x.e55<x.e100&&x.close<x.e21&&slope21<=0;
  const longOk=x.e21>=x.e55*.992&&x.close>=x.e55*.992&&slope21>=-(x.atr||x.close)*.015;
  const shortOk=x.e21<=x.e55*1.008&&x.close<=x.e55*1.008&&slope21<=(x.atr||x.close)*.015;
  const longBad=x.e21<x.e55&&x.close<x.e100&&slope21<0&&slope55<0;
  const shortBad=x.e21>x.e55&&x.close>x.e100&&slope21>0&&slope55>0;
  const ok=dir==='LONG'?longOk:shortOk, strong=dir==='LONG'?longStrong:shortStrong, bad=dir==='LONG'?longBad:shortBad;
  let score=strong?95:ok?74:bad?18:48;
  if(dir==='LONG'&&x.close>x.e200)score+=4;
  if(dir==='SHORT'&&x.close<x.e200)score+=4;
  return {ok:ok&&!bad,strong,bad,score:v151Score01(score),label:strong?'ana trend':ok?'uyumlu trend':'zayıf trend'};
}
function v151MtfScore(sym,tf,dir){
  const htf=htfFor(tf),raw=getCandles(sym,htf); let selfScore=50,selfHard=false,selfStrong=false;
  if(raw&&raw.length>=160){
    const c=enrich(raw),x=c[c.length-1],p=c[c.length-2]||x;
    const longStrong=x.e21>x.e55&&x.close>x.e21&&x.e21>=p.e21*.998;
    const shortStrong=x.e21<x.e55&&x.close<x.e21&&x.e21<=p.e21*1.002;
    const longOk=x.close>=x.e55*.985&&x.e21>=x.e55*.985;
    const shortOk=x.close<=x.e55*1.015&&x.e21<=x.e55*1.015;
    const longHard=x.close<x.e100*.975&&x.e21<x.e55;
    const shortHard=x.close>x.e100*1.025&&x.e21>x.e55;
    selfStrong=dir==='LONG'?longStrong:shortStrong;
    const ok=dir==='LONG'?longOk:shortOk; selfHard=dir==='LONG'?longHard:shortHard;
    selfScore=selfStrong?96:ok?76:selfHard?20:50;
  }
  let btcScore=62,btcHard=false;
  const btcRaw=getCandles('BTCUSDT',tf);
  if(sym!=='BTCUSDT'&&btcRaw&&btcRaw.length>=160){
    const b=enrich(btcRaw),x=b[b.length-1],p=b[b.length-2]||x;
    const longOk=x.close>=x.e55*.988&&x.e21>=p.e21*.996;
    const shortOk=x.close<=x.e55*1.012&&x.e21<=p.e21*1.004;
    const longHard=x.close<x.e100*.970&&x.e21<x.e55;
    const shortHard=x.close>x.e100*1.030&&x.e21>x.e55;
    const ok=dir==='LONG'?longOk:shortOk; btcHard=dir==='LONG'?longHard:shortHard;
    btcScore=ok?78:btcHard?24:54;
  }
  const score=v151Score01(selfScore*.68+btcScore*.32);
  return {ok:score>=54&&!selfHard&&!btcHard,strong:selfStrong,hard:selfHard||btcHard,score,htf};
}
function v151StructureScore(c,i,dir){
  const x=c[i],p=c[i-1]||x,a=x.atr||x.high-x.low||1,ms=marketStructure(c,i);
  const pivotSup=ms.lastLow?ms.lastLow.v:x.sup34, pivotRes=ms.lastHigh?ms.lastHigh.v:x.res34;
  const zSup=zoneStrength(c,i,pivotSup,'sup'), zRes=zoneStrength(c,i,pivotRes,'res');
  const brokeUp=ms.lastHigh&&x.close>ms.lastHigh.v&&p.close<=ms.lastHigh.v+a*.18;
  const brokeDn=ms.lastLow&&x.close<ms.lastLow.v&&p.close>=ms.lastLow.v-a*.18;
  const sweepLow=x.low<lo(c,i-1,34)&&x.close>x.low+a*.28;
  const sweepHigh=x.high>hi(c,i-1,34)&&x.high-x.close>a*.28;
  const longOk=ms.up||brokeUp||ms.chochUp||sweepLow||(zSup.touches>=1&&!ms.down);
  const shortOk=ms.down||brokeDn||ms.chochDown||sweepHigh||(zRes.touches>=1&&!ms.up);
  const longHard=ms.down&&!ms.chochUp&&!sweepLow&&!brokeUp;
  const shortHard=ms.up&&!ms.chochDown&&!sweepHigh&&!brokeDn;
  const ok=dir==='LONG'?longOk:shortOk, hard=dir==='LONG'?longHard:shortHard;
  const strong=dir==='LONG'?(ms.up||brokeUp||sweepLow):(ms.down||brokeDn||sweepHigh);
  let score=strong?92:ok?74:hard?22:50;
  return {ok:ok&&!hard,hard,strong,score:v151Score01(score),ms,pivotSup,pivotRes,zSup,zRes,brokeUp,brokeDn,sweepLow,sweepHigh};
}
function v151LocationScore(c,i,dir,st){
  const x=c[i],p=c[i-1]||x,p2=c[i-2]||p,a=x.atr||x.high-x.low||1,b=v151Bar(c,i);
  const nearSup=Math.abs(x.low-st.pivotSup)<=a*1.35||Math.abs(x.close-x.sup34)<=a*.95||(x.low<=x.e21+a*.58&&x.close>=x.e21-a*.22);
  const nearRes=Math.abs(x.high-st.pivotRes)<=a*1.35||Math.abs(x.close-x.res34)<=a*.95||(x.high>=x.e21-a*.58&&x.close<=x.e21+a*.22);
  const bullFvg=p2&&p2.high<x.low&&x.close>p2.high;
  const bearFvg=p2&&p2.low>x.high&&x.close<p2.low;
  const pullLong=x.low<=x.e21+a*.68&&x.close>=x.e21-a*.18&&x.e21>=x.e55*.99;
  const pullShort=x.high>=x.e21-a*.68&&x.close<=x.e21+a*.18&&x.e21<=x.e55*1.01;
  const breakRetestLong=st.brokeUp||(st.ms.lastHigh&&x.low<=st.ms.lastHigh.v+a*.42&&x.close>st.ms.lastHigh.v-a*.04);
  const breakRetestShort=st.brokeDn||(st.ms.lastLow&&x.high>=st.ms.lastLow.v-a*.42&&x.close<st.ms.lastLow.v+a*.04);
  const chaseLong=(x.close>x.e21+a*2.10&&!breakRetestLong&&!st.sweepLow)||b.up3&&x.close>x.e21+a*1.55;
  const chaseShort=(x.close<x.e21-a*2.10&&!breakRetestShort&&!st.sweepHigh)||b.dn3&&x.close<x.e21-a*1.55;
  const labels=[];
  if(dir==='LONG'){if(nearSup)labels.push('destek');if(pullLong)labels.push('EMA pullback');if(bullFvg)labels.push('bullish FVG');if(st.sweepLow)labels.push('likidite dönüşü');if(breakRetestLong)labels.push('BOS retest');}
  else{if(nearRes)labels.push('direnç');if(pullShort)labels.push('EMA pullback');if(bearFvg)labels.push('bearish FVG');if(st.sweepHigh)labels.push('likidite dönüşü');if(breakRetestShort)labels.push('BOS retest');}
  const count=labels.length, chase=dir==='LONG'?chaseLong:chaseShort;
  const ok=count>0&&!chase;
  let score=count>=3?96:count===2?82:count===1?66:42;
  if(chase)score-=35;
  return {ok,chase,labels,score:v151Score01(score),bullFvg,bearFvg,pullLong,pullShort,breakRetestLong,breakRetestShort};
}
function v151MomentumScore(c,i,dir){
  const x=c[i],p=c[i-1]||x;
  let score=50;
  if(dir==='LONG'){
    if(x.rsi>=50&&x.rsi<=68)score+=20; else if(x.rsi>=46&&x.rsi<50)score+=8; else if(x.rsi>72)score-=18;
    if(x.macd>=p.macd)score+=15; else score-=8;
    if(x.pdi>=x.mdi)score+=12; else score-=6;
    if(x.adx>=18)score+=8; else if(x.adx<10)score-=8;
  }else{
    if(x.rsi<=50&&x.rsi>=32)score+=20; else if(x.rsi<=54&&x.rsi>50)score+=8; else if(x.rsi<28)score-=18;
    if(x.macd<=p.macd)score+=15; else score-=8;
    if(x.mdi>=x.pdi)score+=12; else score-=6;
    if(x.adx>=18)score+=8; else if(x.adx<10)score-=8;
  }
  return {ok:score>=54,over:dir==='LONG'?x.rsi>72:x.rsi<28,score:v151Score01(score)};
}
function v151FlowScore(c,i,dir){
  const x=c[i],p=c[i-1]||x,base=x.v20||0;
  const volRatio=base?x.volume/base:1;
  let score=48;
  if(volRatio>=1.20)score+=20; else if(volRatio>=.85)score+=10; else if(volRatio<.55)score-=15;
  if(dir==='LONG'){
    if(x.cmf>=0)score+=12; else if(x.cmf>-0.10)score+=4; else score-=8;
    if(x.obvSlope>=0)score+=12; else score-=6;
    if(x.close>p.close&&x.obvSlope<0&&x.cmf<-.05)score-=18;
  }else{
    if(x.cmf<=0)score+=12; else if(x.cmf<0.10)score+=4; else score-=8;
    if(x.obvSlope<=0)score+=12; else score-=6;
    if(x.close<p.close&&x.obvSlope>0&&x.cmf>.05)score-=18;
  }
  return {ok:score>=52,volStrong:volRatio>=1.2,volRatio,score:v151Score01(score)};
}
function v151TriggerScore(c,i,dir){
  const x=c[i],p=c[i-1]||x,b=v151Bar(c,i);
  const longReject=b.lowerPct>=.28&&x.close>=x.open;
  const shortReject=b.upperPct>=.28&&x.close<=x.open;
  const longClose=x.close>p.high||(x.close>x.e21&&x.close>=p.close&&b.bodyPct>=.25);
  const shortClose=x.close<p.low||(x.close<x.e21&&x.close<=p.close&&b.bodyPct>=.25);
  const mc=dir==='LONG'?microCandle(c,i,'LONG'):microCandle(c,i,'SHORT');
  const ok=dir==='LONG'?(longReject||longClose||mc):(shortReject||shortClose||mc);
  const near=dir==='LONG'?(x.close>=p.close||b.lowerPct>.22):(x.close<=p.close||b.upperPct>.22);
  return {ok,near,score:v151BoolScore(ok,false,near),body:b};
}
function v151VolScore(c,i,dir,loc,st){
  const x=c[i];
  const atrPct=(x.atr||0)/Math.max(x.close,1e-9)*100;
  const flat=x.adx<10&&x.bbWidth<RULE.maxFlatBbWidth;
  const squeeze=x.bbWidth<.75&&x.adx<13;
  let score=65;
  if(atrPct>.45&&atrPct<5.5)score+=18; else if(atrPct<=.28)score-=20; else if(atrPct>7.5)score-=18;
  if(flat||squeeze)score-=22;
  if(st.sweepLow||st.sweepHigh||loc.breakRetestLong||loc.breakRetestShort)score+=10;
  return {ok:score>=45,flat,squeeze,atrPct,score:v151Score01(score)};
}
function v151Plan(c,i,dir,st,sym,tf){
  const x=c[i],p=c[i-1]||x,a=x.atr||x.high-x.low||1,entry=x.close;
  let rawStop,r,minStop=entry*minStopPctFor(sym,tf)/100;
  if(dir==='LONG'){
    rawStop=Math.min(x.low-a*.25,p.low-a*.16,st.pivotSup-a*.14,x.e55-a*.10);
    r=Math.max(entry-rawStop,a*.55,minStop);
    r=Math.min(r,entry*(RULE.maxStopPct/100));
    return {entry,stop:entry-r,r,stopPct:r/entry*100};
  }
  rawStop=Math.max(x.high+a*.25,p.high+a*.16,st.pivotRes+a*.14,x.e55+a*.10);
  r=Math.max(rawStop-entry,a*.55,minStop);
  r=Math.min(r,entry*(RULE.maxStopPct/100));
  return {entry,stop:entry+r,r,stopPct:r/entry*100};
}
function v151Room(c,i,dir,entry,r,st){
  const x=c[i],a=x.atr||x.high-x.low||1;
  const walls=dir==='LONG'
    ? [st.pivotRes,x.res34,x.res,hi(c,i,72),hi(c,i,144)].filter(v=>Number(v)>entry+a*.12).map(Number)
    : [st.pivotSup,x.sup34,x.sup,lo(c,i,72),lo(c,i,144)].filter(v=>Number(v)<entry-a*.12).map(Number);
  let nearest=dir==='LONG'?Math.min(...walls):Math.max(...walls);
  if(!isFinite(nearest))nearest=dir==='LONG'?entry+r*3.0:entry-r*3.0;
  const raw=dir==='LONG'?nearest-entry:entry-nearest;
  const roomR=raw/Math.max(r,1e-9);
  let score=roomR>=2.2?92:roomR>=1.65?78:roomR>=1.15?61:roomR>=.85?44:25;
  return {nearest,roomR,rawRoom:raw,ok:roomR>=.85,score:v151Score01(score)};
}
function v151TechGate(c,i,dir,sym,tf){
  if(i<190)return null;
  const trend=v151TrendScore(c,i,dir),mtf=v151MtfScore(sym,tf,dir),st=v151StructureScore(c,i,dir),loc=v151LocationScore(c,i,dir,st),mom=v151MomentumScore(c,i,dir),flow=v151FlowScore(c,i,dir),trig=v151TriggerScore(c,i,dir),vol=v151VolScore(c,i,dir,loc,st);
  const plan=v151Plan(c,i,dir,st,sym,tf),room=v151Room(c,i,dir,plan.entry,plan.r,st);
  const riskScore=(()=>{let s=70;if(plan.stopPct<minStopPctFor(sym,tf)*.98)s-=15;if(plan.stopPct>=.70&&plan.stopPct<=2.40)s+=18;else if(plan.stopPct>3.35)s-=20;if(room.roomR>=1.65)s+=18;else if(room.roomR<1.0)s-=25;return v151Score01(s);})();
  const total=v151Score01(
    trend.score*.14 + mtf.score*.11 + st.score*.14 + loc.score*.18 + mom.score*.12 + flow.score*.09 + trig.score*.08 + vol.score*.06 + room.score*.04 + riskScore*.04
  );
  const reasons=[];
  if(trend.score>=58)reasons.push('trend'); if(mtf.score>=54)reasons.push('üst zaman'); if(st.score>=58)reasons.push('piyasa yapısı'); if(loc.score>=58)reasons.push('lokasyon'); if(mom.score>=54)reasons.push('momentum'); if(flow.score>=52)reasons.push('para akışı'); if(trig.score>=56)reasons.push('tetik'); if(vol.score>=48)reasons.push('volatilite'); if(room.roomR>=1.05)reasons.push('hedef alanı');
  const labels=[...new Set([...(loc.labels||[]),...(st.brokeUp||st.brokeDn?['BOS']:[]),...(st.ms.chochUp||st.ms.chochDown?['CHOCH']:[])])];
  let hard=false,hardNotes=[];
  if(trend.bad&&st.hard&&mtf.hard){hard=true;hardNotes.push('trend+yapı+MTF ters');}
  if(loc.chase&&room.roomR<1.2){hard=true;hardNotes.push('kaçmış fiyat');}
  if(plan.stopPct>RULE.maxStopPct){hard=true;hardNotes.push('stop çok geniş');}
  if(room.roomR<.85){hard=true;hardNotes.push('hedef alanı yok');}
  if(vol.flat&&loc.labels.length===0){hard=true;hardNotes.push('yatay ve lokasyon yok');}
  const rr1=1.12,rr2=1.72,rr3=2.45;
  let t1=dir==='LONG'?plan.entry+plan.r*rr1:plan.entry-plan.r*rr1;
  let t2=dir==='LONG'?plan.entry+plan.r*rr2:plan.entry-plan.r*rr2;
  let t3=dir==='LONG'?plan.entry+plan.r*rr3:plan.entry-plan.r*rr3;
  if(dir==='LONG'&&isFinite(room.nearest)){t2=Math.min(t2,room.nearest-plan.r*.08);t3=Math.min(t3,room.nearest+plan.r*.22);}
  if(dir==='SHORT'&&isFinite(room.nearest)){t2=Math.max(t2,room.nearest+plan.r*.08);t3=Math.max(t3,room.nearest-plan.r*.22);}
  const q=Math.max(0,Math.min(100,total-(hard?40:0)));
  const ok=!hard && q>=RULE.poolMinScore && reasons.length>=5;
  return {ok,q,dir,entry:plan.entry,stop:plan.stop,t1,t2,t3,stopPct:plan.stopPct,rr:rr1,room,reasons,sub:labels,hardNotes,detail:{trend,mtf,st,loc,mom,flow,trig,vol,room,riskScore,total}};
}
function signalForSymbol(c,i,model,sym,tf){
  const dir=model.includes('LONG')?'LONG':'SHORT';
  const g=v151TechGate(c,i,dir,sym,tf);
  if(!g||!g.ok)return null;
  return {model:'v15.1 Milli Takım '+dir,sub:g.sub.slice(0,3).join(' + ')||'çoklu teknik seçim',dir,entry:g.entry,stop:g.stop,t1:g.t1,t2:g.t2,t3:g.t3,atr:c[i].atr||0,stopPct:g.stopPct,rr:g.rr,why:g.reasons,q:g.q,techDetail:g.detail,tp2RoomR:g.room.roomR,hardNotes:g.hardNotes||[]};
}
function signal(c,i,model){return signalForSymbol(c,i,model,'BTCUSDT','15m');}
function backtest(sym,tf){
  const raw=getCandles(sym,tf); if(!raw||raw.length<260)return null;
  const c=enrich(raw),map={'v15.1 Milli Takım LONG':[],'v15.1 Milli Takım SHORT':[]}; let cd=0;
  for(let i=210;i<c.length-2;i++){
    if(cd>0){cd--;continue;}
    const sigs=['LONG','SHORT'].map(d=>signalForSymbol(c,i,'BAGLI '+d,sym,tf)).filter(Boolean).filter(s=>s.stopPct<=RULE.maxStopPct).sort((a,b)=>b.q-a.q);
    if(!sigs.length)continue;
    const sig=sigs[0],tr=simulate(c,sig,i); if(!tr)continue;
    map[sig.model]=map[sig.model]||[]; map[sig.model].push(tr); cd=RULE.cooldown;
  }
  const stats=Object.keys(map).map(m=>calcStats(m,map[m])).filter(s=>s.count>0).sort((a,b)=>modelScore(b)-modelScore(a));
  return {sym,tf,candles:c,stats};
}
function v151StatSelectorScore(stat){
  if(!stat||!stat.count)return 35;
  const mfeMae=stat.avgMfe/Math.max(stat.avgMae,.05);
  let s=35;
  s+=Math.min(20,stat.win*.22);
  s+=Math.min(18,Math.max(0,stat.pf-1)*9);
  s+=Math.min(12,stat.count*.35);
  s+=Math.min(12,mfeMae*6);
  s+=Math.max(-15,Math.min(10,stat.net*.18));
  s-=Math.min(18,stat.fast*.32);
  const recent=stat.trades.slice(-10),wins=recent.filter(t=>t.pnl>0).length,loss=recent.filter(t=>t.pnl<0).length;
  if(recent.length>=6)s+=(wins-loss)*1.8;
  return v151Score01(s);
}
function v151SelectorScore(sig,stat,source){
  const d=sig.techDetail||{};
  const tech=sig.q||50, stScore=v151StatSelectorScore(stat), src=sourcePriority(source)*4;
  let s=tech*.58 + stScore*.27 + src;
  if(sig.stopPct>=.70&&sig.stopPct<=2.35)s+=6; else if(sig.stopPct>3.20)s-=8;
  if(sig.tp2RoomR>=1.6)s+=6; else if(sig.tp2RoomR<1.05)s-=8;
  if((d.loc&&d.loc.labels&&d.loc.labels.length>=2))s+=5;
  if(d.flow&&d.flow.volStrong)s+=3;
  if(d.mtf&&d.mtf.strong)s+=4;
  return v151Score01(s);
}
function v151ConfidenceFromScore(selectorScore,stat,source){
  let cap=sourceCap(source);
  const n=stat&&stat.count?stat.count:0;
  if(n<8)cap=Math.min(cap,70); else if(n<18)cap=Math.min(cap,78); else if(n<30)cap=Math.min(cap,84); else if(n<50)cap=Math.min(cap,88);
  if(stat&&stat.win<48)cap=Math.min(cap,76);
  if(stat&&stat.pf<1.15)cap=Math.min(cap,76);
  return Math.round(Math.min(cap,Math.max(50,selectorScore)));
}
function buildCandidate(sym,tf,b,stat){
  sym=cleanSymbol(sym); if(!sym||!b||!stat)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  const dir=String(stat.model).includes('LONG')?'LONG':'SHORT';
  let sig=null,usedK=0;
  for(let k=0;k<=6;k++){
    sig=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(sig){
      const driftPct=Math.abs(last.close-sig.entry)/Math.max(Math.abs(sig.entry),1)*100;
      const driftAtr=Math.abs(last.close-sig.entry)/Math.max(last.atr||0,1e-9);
      if(driftPct<=RULE.maxEntryDriftPct&&driftAtr<=RULE.maxEntryDriftAtr){usedK=k;break;}
      sig=null;
    }
  }
  if(!sig)return null;
  const source=sourceMap[key]||'Taze veri';
  const statScore=v151StatSelectorScore(stat);
  const selectorScore=v151SelectorScore(sig,stat,source) - usedK*2;
  if(selectorScore<RULE.poolMinScore)return null;
  const conf=v151ConfidenceFromScore(selectorScore,stat,source), lev=leverage(sig,conf), rClass=riskClass(sig.stopPct,lev.lev);
  if(sig.stopPct>RULE.maxStopPct || rClass==='Yüksek')return null;
  const notes=['geniş havuzdan seçildi'];
  if(selectorScore>=82)notes.push('milli takım A'); else if(selectorScore>=72)notes.push('milli takım B'); else notes.push('yedek aday');
  if(stat.count<18)notes.push('örneklem sınırlı');
  if(stat.win<55)notes.push('win orta');
  if(stat.pf<1.35)notes.push('PF orta');
  if(usedK>0)notes.push(`${usedK} mum önce tetik`);
  return adjustRiskConfidence({sym,tf,model:sig.model,sub:sig.sub,dir:sig.dir,conf,rawConf:Math.round(selectorScore),cap:conf,capNotes:notes,riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,tp2RoomR:sig.tp2RoomR,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source,liveOnly:false,stale:false,selectorScore:Math.round(selectorScore),poolGrade:selectorScore>=82?'A':selectorScore>=72?'B':'C'});
}
function adjustRiskConfidence(obj){
  if(!obj)return obj; const prof=dataProfile(obj.sym,obj.tf,obj.candles);
  obj.source=prof.source||obj.source||'Taze veri'; obj.candleSource=prof.candleSource; obj.priceSource=prof.priceSource; obj.jsonAgeSec=prof.jsonAgeSec; obj.ageSec=prof.ageSec;
  obj.capNotes=[...(obj.capNotes||[])];
  const srcCap=sourceCap(obj.source);
  let cap=Math.min(obj.cap||90,srcCap);
  const n=obj.stat&&isFinite(obj.stat.count)?obj.stat.count:0;
  if(n<8)cap=Math.min(cap,70); else if(n<18)cap=Math.min(cap,78); else if(n<30)cap=Math.min(cap,84); else if(n<50)cap=Math.min(cap,88);
  if(String(obj.source).includes('JSON TAZE'))obj.capNotes.push('JSON taze');
  if(obj.stopPct>RULE.maxStopPct||obj.riskClass==='Yüksek')return null;
  obj.rawConf=Math.round(obj.rawConf||obj.conf||0);
  obj.conf=Math.max(45,Math.min(obj.rawConf,Math.round(cap)));
  obj.selectorScore=Math.round(obj.selectorScore||obj.rawConf);
  obj.qualityScore=Math.round((obj.selectorScore||0)+(obj.tp2RoomR?Math.min(6,obj.tp2RoomR*1.5):0));
  return obj.conf>=RULE.minConf?obj:null;
}
function candidateRank(a,b){
  return (b.selectorScore||b.qualityScore||b.conf||0)-(a.selectorScore||a.qualityScore||a.conf||0) || sourcePriority(b.source)-sourcePriority(a.source) || (b.stat?.count||0)-(a.stat?.count||0);
}
function mainListEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if((x.stopPct||999)>RULE.maxMainStopPct)return false;
  if(x.riskClass==='Yüksek'||x.liveOnly||x.contextFallback)return false;
  if((x.selectorScore||0)<RULE.poolMinScore)return false;
  return true;
}
function rankedList(dir,limit=7){return candidates.filter(x=>x&&x.dir===dir&&mainListEligible(x)).sort(candidateRank).slice(0,limit);}
function countByDir(dir){return candidates.filter(x=>x&&x.dir===dir&&mainListEligible(x)).length;}
function firstAutoCandidateIndex(){const x=rankedList('LONG',1)[0]||rankedList('SHORT',1)[0];return x?candidates.indexOf(x):-1;}
function renderList(){
  const box=$('list'),longs=rankedList('LONG',7),shorts=rankedList('SHORT',7);
  const rawLong=candidates.filter(x=>x&&x.dir==='LONG').length,rawShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const aLong=candidates.filter(x=>x&&x.dir==='LONG'&&(x.selectorScore||0)>=82).length,aShort=candidates.filter(x=>x&&x.dir==='SHORT'&&(x.selectorScore||0)>=82).length;
  const summary=`<div class="dash"><div><b>${rawLong}</b><span>LONG havuz</span></div><div><b>${rawShort}</b><span>SHORT havuz</span></div><div><b>${longs.length}</b><span>seçilen LONG</span></div><div><b>${shorts.length}</b><span>seçilen SHORT</span></div><div><b>${aLong+aShort}</b><span>A kalite</span></div><div><b>${scanLog.lowQuality||0}</b><span>elenen</span></div></div>`;
  if(!longs.length&&!shorts.length){box.innerHTML=summary+'<div class="decision wait">HAVUZ TARANIYOR — HENÜZ MİLLİ TAKIM YOK</div><p>v15.1 çok sıkı/çok gevşek çalışmaz: önce geniş teknik havuz üretir, sonra milli takım puanı ile en iyi 7 LONG ve 7 SHORT seçer. Yeterli havuz oluşmadıysa tarama bitimini bekle.</p>';return;}
  const card=(x,i)=>{const idx=candidates.indexOf(x);const bt=`İşlem ${x.stat.count} | Win ${pct(x.stat.win,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf,2)} | Hızlı stop ${pct(x.stat.fast,1)}`;const spot=x.dir==='LONG'?'<span class="pill green">spot AL adayı</span>':'<span class="pill red">spotta short değil</span>';const grade=x.poolGrade||((x.selectorScore||0)>=82?'A':(x.selectorScore||0)>=72?'B':'C');return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.conf}%<br><span style="font-size:16px">${x.dir}</span></div></div><div class="line">Milli takım puanı: <b>${x.selectorScore}</b> | Kalite sınıfı: <b>${grade}</b><br>Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | RR ${fmt(x.rr,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source}<br>Teknik: ${(x.why||[]).join(' + ')}</div><div>${spot}<span class="pill blue">v15.1 seçici</span>${(x.capNotes||[]).slice(0,3).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):'<p>Bu yönde havuz var ama ilk 7 eşiğine giren aday yok.</p>'}</div>`;
  box.innerHTML=summary+section('En İyi 7 LONG İşlem — Milli Takım',longs,'LONG','Geniş LONG havuzundan trend, lokasyon, momentum, hedef alanı, stop kalitesi ve backtest dengesine göre seçilir.')+section('En İyi 7 SHORT İşlem — Milli Takım',shorts,'SHORT','Geniş SHORT havuzundan seçilir; Binance TR spotta emir değil, vadeli/izleme-çıkış yönüdür.');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} İŞLEM — MİLLİ TAKIM PUANI ${x.selectorScore||x.qualityScore}`;
  const d=x.techDetail||{};
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Kalite sınıfı',x.poolGrade||'-')+metric('Milli takım puanı',x.selectorScore||'-')+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Mum/Fiyat kaynağı',`${x.candleSource||x.source} / ${x.priceSource||x.source}`)+metric('Risk sınıfı',x.riskClass)+metric('Ham/Gerçekçi güven',`${x.rawConf}% / ${x.conf}%`)+metric('Trend / MTF',`${fmt(d.trend?.score||0,0)} / ${fmt(d.mtf?.score||0,0)}`)+metric('Yapı / Lokasyon',`${fmt(d.st?.score||0,0)} / ${fmt(d.loc?.score||0,0)}`)+metric('Momentum / Para akışı',`${fmt(d.mom?.score||0,0)} / ${fmt(d.flow?.score||0,0)}`)+metric('Tetik / Volatilite',`${fmt(d.trig?.score||0,0)} / ${fmt(d.vol?.score||0,0)}`)+metric('TP2 alanı',`${fmt(x.tp2RoomR||0,2)}R`)+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Spot tutar',fmt(RULE.spotTry,0)+' TL')+metric('Risk',dualMoney(x.lev.riskD))+metric('RR',fmt(x.rr,2))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=x.why.map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win,1)}</span><span class="pill blue">PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf,2)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe,2)}R / ${fmt(x.stat.avgMae,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,6).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.';
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString('tr-TR',{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==='LONG'){
    const stopLimit=x.stop*0.9975, riskTry=RULE.spotTry*(x.stopPct/100), p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — v15.1 seçici plan</b><div class="tryline">Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa kullan. Yoksa bu adayı spotta uygulama.</div><div class="tryline">Limit AL referansı: ${tlInput(x.entry)} TL | Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline"><b>Güvenli OCO:</b> TP1 ${tlInput(x.t1)} TL | Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL.</div><div class="tryline"><b>TP2 modu:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan miktarı TP2’ye taşı.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Binance TR spotta doğrudan short açılamaz. Bu liste vadeli/marjin veya eldeki longdan çıkış-dikkat yönüdür.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2 alanı: ${fmt(x.tp2RoomR||0,2)}R</div>`;
}
async function scanAll(){
  setMeta(`v15.1 Milli Takım tarama başladı: önce geniş havuz, sonra en iyi 7 LONG + 7 SHORT seçimi...`);
  candidates=[]; scanLog.lowQuality=0; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue;} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=260&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const st of b.stats){const cand=buildCandidate(s,tf,b,st); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%10===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15.1 havuz ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} | Seçilen: ${rankedList('LONG',7).length}+${rankedList('SHORT',7).length}`); await delay(18);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} / seçilen ${rankedList('LONG',7).length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} / seçilen ${rankedList('SHORT',7).length} | v15.1 Milli Takım Seçici aktif`);
}

/* =========================================================
   v15.3 GUCLU KADRO SECICI
   Ana fikir: cok gevsek havuz + cok kaliteli secici.
   50-100 aday olabilir; ilk 7, teknik/icra/backtest/veri karnesiyle secilir.
========================================================= */
Object.assign(RULE,{
  versionName:'v15.3 Güçlü Kadro Seçici',
  // Havuz geniş kalır; ilk 7 artık asla zayıf adayla doldurulmaz.
  poolMinScore:42,
  championMinScore:74,
  eliteMinScore:86,
  reserveMinScore:68,
  nationalTeamSize:7,
  minConf:58,
  minTrades:0,
  minPF:0,
  minWin:0,
  minMfeMae:0,
  maxFastStopRate:30,
  maxStopPct:4.20,
  maxMainStopPct:3.25,
  minRR:1.05,
  minTp2RoomR:1.70,
  maxEntryDriftPct:1.05,
  maxEntryDriftAtr:1.35,
  cooldown:2,
  maxFlatBbWidth:.95,
  rosterMinTrades:30,
  rosterMinPF:1.80,
  rosterMinWin:53,
  rosterMaxFastStop:25,
  rosterMinBacktestScore:72,
  rosterMinExecutionScore:76,
  rosterMinTechScore:62,
  aPlusMinTrades:45,
  aPlusMinPF:2.20,
  aPlusMinWin:58,
  aPlusMaxFastStop:20,
  aPlusMinTp2RoomR:2.00
});

function v152Score(n){return Math.max(0,Math.min(100,Number(n)||0));}
function v152SafeStat(stat,dir){
  if(stat&&isFinite(stat.count))return stat;
  return emptyLiveStat(dir);
}
function v152RecentForm(stat){
  const out={score:50,notes:[],bad:false};
  if(!stat||!Array.isArray(stat.trades)||!stat.trades.length){out.score=42;out.notes.push('backtest yok');return out;}
  const r=stat.trades.slice(-10), last6=stat.trades.slice(-6);
  const win=r.filter(t=>t.pnl>0).length, loss=r.filter(t=>t.pnl<0).length;
  const stop=last6.filter(t=>String(t.exit||'').includes('STOP')||t.pnl<=-.80).length;
  let s=52+(win-loss)*4-stop*8;
  if(r.length>=6&&win>=loss+2){s+=10;out.notes.push('son form güçlü');}
  if(stop>=2){s-=18;out.notes.push('son stop baskısı');}
  if(stop>=3){out.bad=true;out.notes.push('stop kümelenmesi');}
  out.score=v152Score(s);return out;
}
function v153BacktestVeto(stat){
  const notes=[]; let hard=false, cap=100;
  const n=stat&&isFinite(stat.count)?stat.count:0, pf=Number(stat&&stat.pf)||0, win=Number(stat&&stat.win)||0, fast=Number(stat&&stat.fast)||0;
  if(n<12){hard=true;notes.push('örneklem çok az');}
  else if(n<24){cap=Math.min(cap,68);notes.push('örneklem zayıf');}
  else if(n<30){cap=Math.min(cap,74);notes.push('örneklem sınırda');}
  else if(n<45){cap=Math.min(cap,86);}
  if(pf<1.20){hard=true;notes.push('PF veto');}
  else if(pf<1.60){cap=Math.min(cap,64);notes.push('PF zayıf');}
  else if(pf<1.80){cap=Math.min(cap,72);notes.push('PF sınırda');}
  if(win<45){hard=true;notes.push('win veto');}
  else if(win<50){cap=Math.min(cap,62);notes.push('win zayıf');}
  else if(win<RULE.rosterMinWin){cap=Math.min(cap,72);notes.push('win sınırda');}
  if(fast>35){hard=true;notes.push('hızlı stop veto');}
  else if(fast>30){cap=Math.min(cap,66);notes.push('hızlı stop çok yüksek');}
  else if(fast>25){cap=Math.min(cap,76);notes.push('hızlı stop yüksek');}
  else if(fast>20){cap=Math.min(cap,86);notes.push('hızlı stop dikkat');}
  return {hard,cap,notes,n,pf,win,fast};
}
function v153StopTpVeto(sig,tf){
  const notes=[]; let hard=false, cap=100;
  const stop=Number(sig&&sig.stopPct)||0, room=Number(sig&&sig.tp2RoomR)||0;
  const is15=tf==='15m', is30=tf==='30m';
  if(room<1.35){hard=true;notes.push('TP2 alanı yok');}
  else if(room<1.70){cap=Math.min(cap,72);notes.push('TP2 alanı zayıf');}
  else if(room<2.00){cap=Math.min(cap,84);notes.push('TP2 alanı sınırda');}
  if(stop<0.55){hard=true;notes.push('stop çok yakın / stop avı');}
  else if(is15&&stop>3.05){cap=Math.min(cap,78);notes.push('15m stop geniş');}
  else if(is30&&stop>3.35){cap=Math.min(cap,80);notes.push('30m stop geniş');}
  else if(stop>3.70){hard=true;notes.push('stop çok geniş');}
  return {hard,cap,notes,stop,room};
}
function v152StatScore(stat){
  if(!stat||!stat.count){return {score:12,notes:['backtest yok'],reliable:false,form:{score:42,notes:['backtest yok']},veto:v153BacktestVeto(stat)}};
  const n=stat.count, wins=n*(stat.win||0)/100;
  const bayes=(wins+18*.56)/(n+18)*100;
  const mfeMae=(stat.avgMfe||0)/Math.max(stat.avgMae||0,.05);
  const form=v152RecentForm(stat);
  const veto=v153BacktestVeto(stat);
  let s=18;
  s+=Math.min(22,Math.max(0,(bayes-42))*0.72);
  s+=Math.min(24,Math.max(0,(stat.pf||0)-1)*8.5);
  s+=Math.min(14,Math.log10(n+1)*15);
  s+=Math.min(12,mfeMae*6);
  s+=Math.max(-8,Math.min(8,(stat.net||0)*.16));
  s-=Math.min(24,(stat.fast||0)*.42);
  s+=form.score*.12-6;
  s=Math.min(s,veto.cap);
  if(veto.hard)s=Math.min(s,24);
  const notes=[...veto.notes];
  if(n<RULE.rosterMinTrades)notes.push('ana kadro için örneklem az');
  if((stat.pf||0)<RULE.rosterMinPF)notes.push('PF ana kadro altı');
  if((stat.win||0)<RULE.rosterMinWin)notes.push('win ana kadro altı');
  if((stat.fast||0)>RULE.rosterMaxFastStop)notes.push('hızlı stop ana kadro üstü');
  notes.push(...form.notes);
  return {score:v152Score(s),notes:[...new Set(notes)],reliable:!veto.hard&&n>=RULE.rosterMinTrades&&(stat.pf||0)>=RULE.rosterMinPF&&(stat.win||0)>=RULE.rosterMinWin&&(stat.fast||0)<=RULE.rosterMaxFastStop,form,veto};
}
function v152ExecutionScore(sig){
  const d=sig.techDetail||{}, stop=Number(sig.stopPct)||0, room=Number(sig.tp2RoomR)||0;
  const loc=d.loc?.score||50, trig=d.trig?.score||50, vol=d.vol?.score||50, flow=d.flow?.score||50;
  let stopScore=70;
  if(stop<.55)stopScore=18;
  else if(stop<.80)stopScore=55;
  else if(stop<=2.25)stopScore=94;
  else if(stop<=2.85)stopScore=82;
  else if(stop<=3.25)stopScore=66;
  else if(stop<=3.70)stopScore=48;
  else stopScore=18;
  let roomScore=room>=3.0?100:room>=2.35?94:room>=2.0?88:room>=1.70?76:room>=1.35?55:24;
  const s=stopScore*.28+roomScore*.32+loc*.18+trig*.12+flow*.06+vol*.04;
  const notes=[];
  if(stop<.80)notes.push('stop yakın');
  if(stop>2.85)notes.push('stop geniş');
  if(room<2.00)notes.push('TP2 alanı A+ değil');
  if(room<1.70)notes.push('TP2 alanı yetersiz');
  if((d.loc?.labels||[]).length>=2)notes.push('lokasyon güçlü');
  return {score:v152Score(s),notes};
}
function v152TechGate(c,i,dir,sym,tf){
  if(i<185)return null;
  const trend=v151TrendScore(c,i,dir), mtf=v151MtfScore(sym,tf,dir), st=v151StructureScore(c,i,dir), loc=v151LocationScore(c,i,dir,st), mom=v151MomentumScore(c,i,dir), flow=v151FlowScore(c,i,dir), trig=v151TriggerScore(c,i,dir), vol=v151VolScore(c,i,dir,loc,st);
  const plan=v151Plan(c,i,dir,st,sym,tf), room=v151Room(c,i,dir,plan.entry,plan.r,st);
  const riskScore=(()=>{let s=64;if(plan.stopPct>=.70&&plan.stopPct<=2.45)s+=24;else if(plan.stopPct<.55)s-=25;else if(plan.stopPct>3.35)s-=20;if(room.roomR>=1.55)s+=18;else if(room.roomR<.85)s-=22;return v152Score(s);})();
  const total=v152Score(trend.score*.11+mtf.score*.10+st.score*.13+loc.score*.20+mom.score*.11+flow.score*.09+trig.score*.13+vol.score*.05+room.score*.05+riskScore*.03);
  const reasons=[];
  if(trend.score>=52)reasons.push('trend');
  if(mtf.score>=50)reasons.push('üst zaman');
  if(st.score>=52)reasons.push('piyasa yapısı');
  if(loc.score>=54)reasons.push('lokasyon');
  if(mom.score>=50)reasons.push('momentum');
  if(flow.score>=48)reasons.push('para akışı');
  if(trig.score>=50)reasons.push('tetik');
  if(vol.score>=42)reasons.push('volatilite');
  if(room.roomR>=.85)reasons.push('hedef alanı');
  const labels=[...new Set([...(loc.labels||[]), ...(st.brokeUp||st.brokeDn?['BOS']:[]), ...(st.ms.chochUp||st.ms.chochDown?['CHOCH']:[])])];
  let hard=false,notes=[];
  if(trend.bad&&st.hard&&mtf.hard){hard=true;notes.push('ana yön ters');}
  if(loc.chase&&room.roomR<1.05){hard=true;notes.push('kaçmış fiyat');}
  if(plan.stopPct>RULE.maxStopPct){hard=true;notes.push('stop çok geniş');}
  if(room.roomR<.75){hard=true;notes.push('hedef alanı yok');}
  if(vol.flat&&labels.length===0&&trig.score<50){hard=true;notes.push('yatay + tetik yok');}
  const rr1=1.08, rr2=1.62, rr3=2.30;
  let t1=dir==='LONG'?plan.entry+plan.r*rr1:plan.entry-plan.r*rr1;
  let t2=dir==='LONG'?plan.entry+plan.r*rr2:plan.entry-plan.r*rr2;
  let t3=dir==='LONG'?plan.entry+plan.r*rr3:plan.entry-plan.r*rr3;
  if(dir==='LONG'&&isFinite(room.nearest)){t2=Math.min(t2,room.nearest-plan.r*.06);t3=Math.min(t3,room.nearest+plan.r*.18);}
  if(dir==='SHORT'&&isFinite(room.nearest)){t2=Math.max(t2,room.nearest+plan.r*.06);t3=Math.max(t3,room.nearest-plan.r*.18);}
  const q=v152Score(total-(hard?35:0));
  const ok=!hard && q>=RULE.poolMinScore && reasons.length>=4;
  return {ok,q,dir,entry:plan.entry,stop:plan.stop,t1,t2,t3,stopPct:plan.stopPct,rr:rr1,room,reasons,sub:labels,hardNotes:notes,detail:{trend,mtf,st,loc,mom,flow,trig,vol,room,riskScore,total}};
}
function signalForSymbol(c,i,model,sym,tf){
  const dir=String(model||'').includes('LONG')?'LONG':'SHORT';
  const g=v152TechGate(c,i,dir,sym,tf);
  if(!g||!g.ok)return null;
  return {model:'v15.3 Güçlü Kadro '+dir,sub:g.sub.slice(0,3).join(' + ')||'çoklu teknik seçim',dir,entry:g.entry,stop:g.stop,t1:g.t1,t2:g.t2,t3:g.t3,atr:c[i].atr||0,stopPct:g.stopPct,rr:g.rr,why:g.reasons,q:g.q,techDetail:g.detail,tp2RoomR:g.room.roomR,hardNotes:g.hardNotes||[]};
}
function signal(c,i,model){return signalForSymbol(c,i,model,'BTCUSDT','15m');}
function backtest(sym,tf){
  const raw=getCandles(sym,tf); if(!raw||raw.length<235)return null;
  const c=enrich(raw),map={'v15.3 Güçlü Kadro LONG':[],'v15.3 Güçlü Kadro SHORT':[]}; let cd=0;
  for(let i=195;i<c.length-2;i++){
    if(cd>0){cd--;continue;}
    const sigs=['LONG','SHORT'].map(d=>signalForSymbol(c,i,'BAGLI '+d,sym,tf)).filter(Boolean).filter(s=>s.stopPct<=RULE.maxStopPct).sort((a,b)=>b.q-a.q);
    if(!sigs.length)continue;
    const sig=sigs[0],tr=simulate(c,sig,i); if(!tr)continue;
    map[sig.model]=map[sig.model]||[]; map[sig.model].push(tr); cd=RULE.cooldown;
  }
  const stats=Object.keys(map).map(m=>calcStats(m,map[m])).filter(s=>s.count>0).sort((a,b)=>modelScore(b)-modelScore(a));
  return {sym,tf,candles:c,stats};
}
function v153WeakLinkCaps(sig,stat,source,selBase,tf){
  const caps=[]; const notes=[]; let hard=false;
  const bt=v153BacktestVeto(stat), ex=v153StopTpVeto(sig,tf);
  if(bt.hard){hard=true;notes.push(...bt.notes);} else caps.push(bt.cap);
  if(ex.hard){hard=true;notes.push(...ex.notes);} else caps.push(ex.cap);
  if((selBase.stat||0)<RULE.rosterMinBacktestScore){caps.push(74);notes.push('backtest karnesi ana kadro altı');}
  if((selBase.execution||0)<RULE.rosterMinExecutionScore){caps.push(78);notes.push('icra karnesi ana kadro altı');}
  if((selBase.tech||0)<RULE.rosterMinTechScore){caps.push(72);notes.push('teknik karnesi ana kadro altı');}
  if(String(source||'').includes('REST')){caps.push(94);notes.push('REST kaynak tavanı');}
  if(String(source||'').includes('JSON')){caps.push(88);notes.push('JSON kaynak tavanı');}
  return {hard,cap:caps.length?Math.min(...caps):100,notes:[...new Set(notes)]};
}
function v152SelectorScore(sig,stat,source,usedK=0,tf='15m'){
  const tech=Number(sig.q)||45, statInfo=v152StatScore(stat), exe=v152ExecutionScore(sig), src=44+sourcePriority(source)*12;
  const d=sig.techDetail||{};
  // Dünya şampiyonu seçici: icra + backtest teknik etiketten daha önemli.
  let s=tech*.26+exe.score*.34+statInfo.score*.30+src*.10;
  if((d.loc?.labels||[]).length>=2)s+=3;
  if(d.mtf?.strong)s+=2;
  if(d.flow?.volStrong)s+=1.5;
  if((sig.tp2RoomR||0)>=2.00)s+=3.5;
  if((sig.tp2RoomR||0)<1.70)s-=8;
  if((stat.fast||0)>25)s-=8;
  if((stat.count||0)<RULE.rosterMinTrades)s-=8;
  s-=usedK*2.2;
  const base={score:v152Score(s),tech,execution:exe.score,stat:statInfo.score,source:src,notes:[...new Set([...exe.notes,...statInfo.notes])],statInfo,exe};
  const weak=v153WeakLinkCaps(sig,stat,source,base,tf);
  let finalScore=weak.hard?Math.min(base.score,28):Math.min(base.score,weak.cap);
  return {score:v152Score(finalScore),tech,execution:exe.score,stat:statInfo.score,source:src,notes:[...new Set([...base.notes,...weak.notes])],statInfo,exe,weak};
}
function v152Confidence(sel,stat,source){
  let cap=sourceCap(source);
  const n=stat&&stat.count?stat.count:0;
  if(n<12)cap=Math.min(cap,64); else if(n<24)cap=Math.min(cap,72); else if(n<30)cap=Math.min(cap,78); else if(n<45)cap=Math.min(cap,86);
  if((stat&&stat.fast||0)>25)cap=Math.min(cap,78);
  if((stat&&stat.pf||0)<RULE.rosterMinPF)cap=Math.min(cap,74);
  if((stat&&stat.win||0)<RULE.rosterMinWin)cap=Math.min(cap,74);
  return Math.round(Math.max(50,Math.min(cap,sel.score)));
}
function v153Grade(sel,sig,stat,tf){
  const n=stat?.count||0, pf=stat?.pf||0, win=stat?.win||0, fast=stat?.fast||0, room=sig?.tp2RoomR||0;
  const bd={tech:sel.tech||0,execution:sel.execution||0,backtest:sel.stat||0};
  if(sel.weak?.hard || pf<1.60 || win<50 || fast>30 || n<24 || room<1.50 || bd.backtest<60)return 'C';
  const aplus=n>=RULE.aPlusMinTrades && pf>=RULE.aPlusMinPF && win>=RULE.aPlusMinWin && fast<=RULE.aPlusMaxFastStop && room>=RULE.aPlusMinTp2RoomR && bd.execution>=82 && bd.backtest>=80 && bd.tech>=68 && sel.score>=RULE.eliteMinScore;
  if(aplus)return 'A+';
  const a=n>=RULE.rosterMinTrades && pf>=RULE.rosterMinPF && win>=RULE.rosterMinWin && fast<=RULE.rosterMaxFastStop && room>=RULE.minTp2RoomR && bd.execution>=RULE.rosterMinExecutionScore && bd.backtest>=RULE.rosterMinBacktestScore && bd.tech>=RULE.rosterMinTechScore && sel.score>=RULE.championMinScore;
  if(a)return 'A';
  if(sel.score>=68 && pf>=1.45 && win>=50 && fast<=30 && n>=24 && room>=1.50)return 'B+';
  return 'B';
}
function buildCandidateForDir(sym,tf,b,dir){
  sym=cleanSymbol(sym); if(!sym||!b)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  let sig=null,usedK=0;
  for(let k=0;k<=7;k++){
    const s=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(!s)continue;
    const driftPct=Math.abs(last.close-s.entry)/Math.max(Math.abs(s.entry),1)*100;
    const driftAtr=Math.abs(last.close-s.entry)/Math.max(last.atr||0,1e-9);
    if(driftPct<=RULE.maxEntryDriftPct&&driftAtr<=RULE.maxEntryDriftAtr){sig=s;usedK=k;break;}
  }
  if(!sig)return null;
  const stat=v152SafeStat((b.stats||[]).find(s=>String(s.model||'').includes(dir)),dir);
  const source=sourceMap[key]||'Taze veri';
  const sel=v152SelectorScore(sig,stat,source,usedK,tf);
  if(sel.score<RULE.poolMinScore)return null;
  const conf=v152Confidence(sel,stat,source),lev=leverage(sig,conf),rClass=riskClass(sig.stopPct,lev.lev);
  if(sig.stopPct>RULE.maxStopPct||rClass==='Yüksek')return null;
  const grade=v153Grade(sel,sig,stat,tf);
  const notes=['geniş havuzdan geldi','v15.3 seçici'];
  if(sel.score>=RULE.eliteMinScore)notes.push('dünya kupası adayı'); else if(sel.score>=RULE.championMinScore)notes.push('milli takım adayı'); else notes.push('yedek havuz');
  if(usedK>0)notes.push(`${usedK} mum önce tetik`);
  notes.push(...sel.notes.slice(0,3));
  const obj={sym,tf,model:sig.model,sub:sig.sub,dir:sig.dir,conf,rawConf:Math.round(sel.score),cap:conf,capNotes:[...new Set(notes)],riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,tp2RoomR:sig.tp2RoomR,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source,liveOnly:stat.count<1,stale:false,selectorScore:Math.round(sel.score),poolGrade:grade,scoreBreakdown:{tech:Math.round(sel.tech),execution:Math.round(sel.execution),backtest:Math.round(sel.stat),source:Math.round(sel.source)}};
  return adjustRiskConfidence(obj);
}
function buildCandidate(sym,tf,b,stat){
  if(!stat)return null;
  const dir=String(stat.model||'').includes('LONG')?'LONG':'SHORT';
  return buildCandidateForDir(sym,tf,b,dir);
}
function adjustRiskConfidence(obj){
  if(!obj)return obj; const prof=dataProfile(obj.sym,obj.tf,obj.candles);
  obj.source=prof.source||obj.source||'Taze veri'; obj.candleSource=prof.candleSource; obj.priceSource=prof.priceSource; obj.jsonAgeSec=prof.jsonAgeSec; obj.ageSec=prof.ageSec;
  obj.capNotes=[...(obj.capNotes||[])]; let cap=Math.min(obj.cap||90,sourceCap(obj.source));
  if(String(obj.source).includes('JSON TAZE'))obj.capNotes.push('JSON taze');
  if((obj.stat?.count||0)<6)cap=Math.min(cap,70); else if((obj.stat?.count||0)<12)cap=Math.min(cap,76); else if((obj.stat?.count||0)<24)cap=Math.min(cap,82); else if((obj.stat?.count||0)<40)cap=Math.min(cap,87);
  if(obj.stopPct>RULE.maxStopPct||obj.riskClass==='Yüksek')return null;
  obj.rawConf=Math.round(obj.rawConf||obj.conf||0);
  obj.conf=Math.max(50,Math.min(obj.rawConf,Math.round(cap)));
  obj.selectorScore=Math.round(obj.selectorScore||obj.rawConf);
  obj.qualityScore=Math.round(obj.selectorScore+(obj.tp2RoomR?Math.min(6,obj.tp2RoomR*1.5):0));
  return obj.conf>=RULE.minConf?obj:null;
}
function v153CoreRosterOk(x,allowBorder=false){
  if(!x||!validCandidateSymbol(x))return false;
  const st=x.stat||{}, bd=x.scoreBreakdown||{}, d=x.techDetail||{};
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if((x.stopPct||999)>RULE.maxMainStopPct)return false;
  if(x.riskClass==='Yüksek')return false;
  if((x.tp2RoomR||0)<(allowBorder?1.55:RULE.minTp2RoomR))return false;
  if((x.selectorScore||0)<(allowBorder?RULE.reserveMinScore:RULE.championMinScore))return false;
  if((st.count||0)<(allowBorder?24:RULE.rosterMinTrades))return false;
  if((st.pf||0)<(allowBorder?1.55:RULE.rosterMinPF))return false;
  if((st.win||0)<(allowBorder?50:RULE.rosterMinWin))return false;
  if((st.fast||0)>(allowBorder?30:RULE.rosterMaxFastStop))return false;
  if((bd.backtest||0)<(allowBorder?64:RULE.rosterMinBacktestScore))return false;
  if((bd.execution||0)<(allowBorder?70:RULE.rosterMinExecutionScore))return false;
  if((bd.tech||0)<(allowBorder?58:RULE.rosterMinTechScore))return false;
  if((d.loc?.score||0)<(allowBorder?52:56))return false;
  if((d.trig?.score||0)<(allowBorder?47:50))return false;
  return true;
}
function v152ChampionEligible(x){return v153CoreRosterOk(x,false);}
function v152ReserveEligible(x){return v153CoreRosterOk(x,true);}
function v152UniqueTop(arr,limit){
  const out=[],seen=new Set();
  for(const x of arr.sort(candidateRank)){
    const key=x.sym+'|'+x.dir;
    if(seen.has(key))continue;
    seen.add(key); out.push(x);
    if(out.length>=limit)break;
  }
  return out;
}
function candidateRank(a,b){
  const sa=b.selectorScore||b.qualityScore||b.conf||0, sb=a.selectorScore||a.qualityScore||a.conf||0;
  if(Math.abs(sa-sb)>0.001)return sa-sb;
  const ea=(b.scoreBreakdown?.execution||0)-(a.scoreBreakdown?.execution||0); if(ea)return ea;
  const ba=(b.scoreBreakdown?.backtest||0)-(a.scoreBreakdown?.backtest||0); if(ba)return ba;
  return sourcePriority(b.source)-sourcePriority(a.source) || (a.stopPct||0)-(b.stopPct||0);
}
function rankedList(dir,limit=7){
  const all=candidates.filter(x=>x&&x.dir===dir);
  const champions=v152UniqueTop(all.filter(v152ChampionEligible),limit);
  if(champions.length>=limit)return champions;
  const used=new Set(champions.map(x=>x.sym+'|'+x.dir));
  const reserves=v152UniqueTop(all.filter(x=>!used.has(x.sym+'|'+x.dir)&&v152ReserveEligible(x)),limit-champions.length);
  return [...champions,...reserves].slice(0,limit);
}
function countByDir(dir){return rankedList(dir,999).length;}
function firstAutoCandidateIndex(){const x=rankedList('LONG',1)[0]||rankedList('SHORT',1)[0];return x?candidates.indexOf(x):-1;}
function renderList(){
  const box=$('list'),longs=rankedList('LONG',7),shorts=rankedList('SHORT',7);
  const poolLong=candidates.filter(x=>x&&x.dir==='LONG').length,poolShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const champLong=candidates.filter(x=>x&&x.dir==='LONG'&&v152ChampionEligible(x)).length,champShort=candidates.filter(x=>x&&x.dir==='SHORT'&&v152ChampionEligible(x)).length;
  const elite=candidates.filter(x=>x&&(x.selectorScore||0)>=RULE.eliteMinScore).length;
  const summary=`<div class="dash"><div><b>${poolLong}</b><span>LONG havuz</span></div><div><b>${poolShort}</b><span>SHORT havuz</span></div><div><b>${champLong}</b><span>şampiyon LONG</span></div><div><b>${champShort}</b><span>şampiyon SHORT</span></div><div><b>${longs.length}+${shorts.length}</b><span>ilk 7+7</span></div><div><b>${elite}</b><span>A/A+ kalite</span></div></div>`;
  if(!longs.length&&!shorts.length){box.innerHTML=summary+'<div class="decision wait">HAVUZ VAR AMA KALİTE KADROSU YOK</div><p>v15.3 zayıf adayı ilk 7’ye doldurmaz. PF, win, hızlı stop, TP2 alanı, icra ve teknik karnesi geçmezse kadro eksik kalır; bu hata değil kalite filtresidir.</p>';return;}
  const card=(x,i)=>{const idx=candidates.indexOf(x),bd=x.scoreBreakdown||{};const bt=`İşlem ${x.stat.count||0} | Win ${pct(x.stat.win||0,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)} | Hızlı stop ${pct(x.stat.fast||0,1)}`;const spot=x.dir==='LONG'?'<span class="pill green">spot AL adayı</span>':'<span class="pill red">spotta short değil</span>';return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.selectorScore}<br><span style="font-size:15px">PUAN</span></div></div><div class="line">Kalite sınıfı: <b>${x.poolGrade}</b> | Güven: ${x.conf}%<br>Skor kırılımı: Teknik ${bd.tech||'-'} / İcra ${bd.execution||'-'} / Backtest ${bd.backtest||'-'} / Veri ${bd.source||'-'}<br>Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source}<br>Teknik: ${(x.why||[]).join(' + ')}</div><div>${spot}<span class="pill blue">v15.3 güçlü seçici</span>${(x.capNotes||[]).slice(0,4).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):'<p>Bu yönde havuz var ama şampiyon ilk 7 eşiğine giren aday yok.</p>'}</div>`;
  box.innerHTML=summary+section('En İyi 7 LONG — Güçlü Kadro',longs,'LONG','Geniş LONG havuzundan sadece en iyi icra + teknik + backtest dengesine sahip adaylar seçilir.')+section('En İyi 7 SHORT — Güçlü Kadro',shorts,'SHORT','Spotta emir değil; vadeli/izleme-çıkış yönüdür. Yalnızca en güçlü short bağlamları ilk 7’ye girer.');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  const bd=x.scoreBreakdown||{},d=x.techDetail||{};
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} İŞLEM — KADRO PUAN ${x.selectorScore} / ${x.poolGrade}`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Kalite sınıfı',x.poolGrade||'-')+metric('Kadro puanı',x.selectorScore||'-')+metric('Teknik / İcra',`${bd.tech||'-'} / ${bd.execution||'-'}`)+metric('Backtest / Veri',`${bd.backtest||'-'} / ${bd.source||'-'}`)+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Mum/Fiyat kaynağı',`${x.candleSource||x.source} / ${x.priceSource||x.source}`)+metric('Risk sınıfı',x.riskClass)+metric('Güven',`${x.conf}%`)+metric('Trend / MTF',`${fmt(d.trend?.score||0,0)} / ${fmt(d.mtf?.score||0,0)}`)+metric('Yapı / Lokasyon',`${fmt(d.st?.score||0,0)} / ${fmt(d.loc?.score||0,0)}`)+metric('Momentum / Para akışı',`${fmt(d.mom?.score||0,0)} / ${fmt(d.flow?.score||0,0)}`)+metric('Tetik / Volatilite',`${fmt(d.trig?.score||0,0)} / ${fmt(d.vol?.score||0,0)}`)+metric('TP2 alanı',`${fmt(x.tp2RoomR||0,2)}R`)+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Spot tutar',fmt(RULE.spotTry,0)+' TL')+metric('Risk',dualMoney(x.lev.riskD))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=(x.why||[]).map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win||0,1)}</span><span class="pill blue">PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast||0,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe||0,2)}R / ${fmt(x.stat.avgMae||0,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,7).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.';
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString('tr-TR',{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==='LONG'){
    const stopLimit=x.stop*0.9975, riskTry=RULE.spotTry*(x.stopPct/100), p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — v15.2 şampiyon plan</b><div class="tryline">Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa kullan. Yoksa bu adayı spotta uygulama.</div><div class="tryline">Limit AL referansı: ${tlInput(x.entry)} TL | Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline"><b>Güvenli OCO:</b> TP1 ${tlInput(x.t1)} TL | Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL.</div><div class="tryline"><b>TP2 modu:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan miktarı TP2’ye taşı.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Binance TR spotta doğrudan short açılamaz. Bu liste vadeli/marjin veya eldeki longdan çıkış-dikkat yönüdür.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2 alanı: ${fmt(x.tp2RoomR||0,2)}R</div>`;
}
async function scanAll(){
  setMeta(`v15.3 Güçlü Kadro tarama başladı: geniş havuz kuruluyor, sonra 7+7 kadro seçiliyor...`);
  candidates=[]; scanLog.lowQuality=0; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue;} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=235&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const dir of ['LONG','SHORT']){const cand=buildCandidateForDir(s,tf,b,dir); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%8===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15.3 havuz ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} | Kadro: ${rankedList('LONG',7).length}+${rankedList('SHORT',7).length}`); await delay(16);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | LONG havuz ${candidates.filter(x=>x.dir==='LONG').length} / kadro ${rankedList('LONG',7).length} | SHORT havuz ${candidates.filter(x=>x.dir==='SHORT').length} / kadro ${rankedList('SHORT',7).length} | v15.3 Güçlü Kadro Seçici aktif`);
}

/* =========================================================
   v15.4 SAMPIYON KALITE SECICI
   Temel karar: Bol havuz kalır; ilk 7 artık sadece A/A+ ana kadro.
   B+ adaylar işlem önerisi değil, yedek/izleme havuzudur.
========================================================= */
Object.assign(RULE,{
  versionName:'v15.4 Şampiyon Kalite Seçici',
  poolMinScore:40,
  reserveMinScore:66,
  championMinScore:78,
  eliteMinScore:88,
  nationalTeamSize:7,
  minConf:58,
  // Ana kadro minimumları: dünya şampiyonu kadrosu standardı
  rosterMinTrades:45,
  rosterMinPF:2.20,
  rosterMinWin:58,
  rosterMaxFastStop:20,
  rosterMinBacktestScore:78,
  rosterMinExecutionScore:80,
  rosterMinTechScore:68,
  // A+ eşiği
  aPlusMinTrades:55,
  aPlusMinPF:2.80,
  aPlusMinWin:62,
  aPlusMaxFastStop:15,
  aPlusMinTp2RoomR:2.25,
  // İşlem geometrisi
  minTp2RoomR:2.00,
  mainMinTp2RoomR:2.00,
  reserveMinTp2RoomR:1.65,
  maxMainStopPct:2.85,
  maxStopPct:3.40,
  minMainStopPct:0.75,
  maxFreshSignalBars15m:2,
  maxFreshSignalBars30m:2,
  maxFreshSignalBars1h:3,
  maxFreshSignalBars2h:3,
  maxFreshSignalBars4h:4,
  // Teknik alt eşikler
  minMainLocScore:60,
  minMainTrigScore:55,
  minMainStructScore:56,
  minMainMomScore:52,
  minMainFlowScore:48,
  minMainMtfScore:52,
  minMainTrendScore:54
});

function v154FreshLimit(tf){
  if(tf==='15m')return RULE.maxFreshSignalBars15m;
  if(tf==='30m')return RULE.maxFreshSignalBars30m;
  if(tf==='1h')return RULE.maxFreshSignalBars1h;
  if(tf==='2h')return RULE.maxFreshSignalBars2h;
  if(tf==='4h')return RULE.maxFreshSignalBars4h;
  return 2;
}
function v154EvidenceCount(x){
  const d=x?.techDetail||{}, arr=[d.trend,d.mtf,d.st,d.loc,d.mom,d.flow,d.trig,d.vol];
  return arr.filter(o=>(o?.score||0)>=55).length + ((x?.tp2RoomR||0)>=RULE.mainMinTp2RoomR?1:0);
}
function v154WeakDimensionCount(x){
  const d=x?.techDetail||{};
  const vals=[d.trend?.score||0,d.mtf?.score||0,d.st?.score||0,d.loc?.score||0,d.mom?.score||0,d.flow?.score||0,d.trig?.score||0];
  return vals.filter(v=>v>0&&v<50).length;
}
function v154StopOk(x,main=true){
  const stop=x?.stopPct||999, tf=x?.tf||'15m';
  const max = tf==='4h'?3.15:tf==='2h'?3.05:tf==='1h'?2.95:RULE.maxMainStopPct;
  const min = main?RULE.minMainStopPct:0.60;
  return stop>=min && stop<=max;
}
function v154BacktestMainOk(x){
  const s=x?.stat||{}, bd=x?.scoreBreakdown||{};
  return (s.count||0)>=RULE.rosterMinTrades && (s.pf||0)>=RULE.rosterMinPF && (s.win||0)>=RULE.rosterMinWin && (s.fast||0)<=RULE.rosterMaxFastStop && (bd.backtest||0)>=RULE.rosterMinBacktestScore;
}
function v154TechMainOk(x){
  const d=x?.techDetail||{}, bd=x?.scoreBreakdown||{};
  if((bd.tech||0)<RULE.rosterMinTechScore)return false;
  if((bd.execution||0)<RULE.rosterMinExecutionScore)return false;
  if((d.loc?.score||0)<RULE.minMainLocScore)return false;
  if((d.trig?.score||0)<RULE.minMainTrigScore)return false;
  if((d.st?.score||0)<RULE.minMainStructScore)return false;
  if((d.mom?.score||0)<RULE.minMainMomScore)return false;
  if((d.flow?.score||0)<RULE.minMainFlowScore)return false;
  if((d.mtf?.score||0)<RULE.minMainMtfScore)return false;
  if((d.trend?.score||0)<RULE.minMainTrendScore)return false;
  return true;
}
function v154NotChased(x){
  const d=x?.techDetail||{};
  if(d.loc?.chase)return false;
  if((x?.usedK||0)>v154FreshLimit(x?.tf))return false;
  return true;
}
function v154MainEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if(x.riskClass==='Yüksek')return false;
  if((x.selectorScore||0)<RULE.championMinScore)return false;
  if((x.tp2RoomR||0)<RULE.mainMinTp2RoomR)return false;
  if(!v154StopOk(x,true))return false;
  if(!v154BacktestMainOk(x))return false;
  if(!v154TechMainOk(x))return false;
  if(!v154NotChased(x))return false;
  if(v154EvidenceCount(x)<7)return false;
  if(v154WeakDimensionCount(x)>0)return false;
  return true;
}
function v154ReserveEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  const s=x.stat||{}, bd=x.scoreBreakdown||{}, d=x.techDetail||{};
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if(x.riskClass==='Yüksek')return false;
  if((x.selectorScore||0)<RULE.reserveMinScore)return false;
  if((x.tp2RoomR||0)<RULE.reserveMinTp2RoomR)return false;
  if(!v154StopOk(x,false))return false;
  if((s.count||0)<30 || (s.pf||0)<1.70 || (s.win||0)<52 || (s.fast||0)>27)return false;
  if((bd.backtest||0)<66 || (bd.execution||0)<72 || (bd.tech||0)<58)return false;
  if((d.loc?.score||0)<52 || (d.trig?.score||0)<48)return false;
  return true;
}
function v154Grade(sel,sig,stat,tf,usedK=0){
  const n=stat?.count||0, pf=stat?.pf||0, win=stat?.win||0, fast=stat?.fast||0, room=sig?.tp2RoomR||0;
  const bd={tech:sel.tech||0,execution:sel.execution||0,backtest:sel.stat||0};
  if(sel.weak?.hard || pf<1.60 || win<50 || fast>30 || n<24 || room<1.50 || bd.backtest<60)return 'C';
  const fresh=usedK<=v154FreshLimit(tf);
  const aplus=fresh && n>=RULE.aPlusMinTrades && pf>=RULE.aPlusMinPF && win>=RULE.aPlusMinWin && fast<=RULE.aPlusMaxFastStop && room>=RULE.aPlusMinTp2RoomR && bd.execution>=84 && bd.backtest>=84 && bd.tech>=72 && sel.score>=RULE.eliteMinScore;
  if(aplus)return 'A+';
  const a=fresh && n>=RULE.rosterMinTrades && pf>=RULE.rosterMinPF && win>=RULE.rosterMinWin && fast<=RULE.rosterMaxFastStop && room>=RULE.mainMinTp2RoomR && bd.execution>=RULE.rosterMinExecutionScore && bd.backtest>=RULE.rosterMinBacktestScore && bd.tech>=RULE.rosterMinTechScore && sel.score>=RULE.championMinScore;
  if(a)return 'A';
  if(sel.score>=RULE.reserveMinScore && pf>=1.70 && win>=52 && fast<=27 && n>=30 && room>=RULE.reserveMinTp2RoomR)return 'B+';
  return 'B';
}
function v154ScorePenalty(sig,stat,sel,source,usedK,tf){
  let p=0;
  const d=sig.techDetail||{}, room=sig.tp2RoomR||0, stop=sig.stopPct||0;
  if((stat.count||0)<45)p+=8;
  if((stat.win||0)<58)p+=8;
  if((stat.pf||0)<2.2)p+=10;
  if((stat.fast||0)>20)p+=8;
  if(room<2)p+=8;
  if(stop<0.75)p+=6;
  if(stop>2.85)p+=6;
  if(usedK>v154FreshLimit(tf))p+=10;
  if((d.trend?.score||0)<RULE.minMainTrendScore)p+=5;
  if((d.mtf?.score||0)<RULE.minMainMtfScore)p+=5;
  if((d.loc?.score||0)<RULE.minMainLocScore)p+=6;
  if((d.trig?.score||0)<RULE.minMainTrigScore)p+=5;
  if(String(source||'').includes('JSON'))p+=4;
  return p;
}
function v152SelectorScore(sig,stat,source,usedK=0,tf='15m'){
  const tech=Number(sig.q)||45, statInfo=v152StatScore(stat), exe=v152ExecutionScore(sig), src=44+sourcePriority(source)*12;
  const d=sig.techDetail||{};
  // v15.4: backtest + icra + taze tetik ana seçicidir; teknik etiket tek başına yetmez.
  let s=tech*.22+exe.score*.34+statInfo.score*.34+src*.10;
  if((d.loc?.labels||[]).length>=2)s+=2;
  if(d.mtf?.strong)s+=2;
  if(d.flow?.volStrong)s+=1;
  if((sig.tp2RoomR||0)>=2.25)s+=3;
  if((sig.tp2RoomR||0)<2.00)s-=7;
  s-=v154ScorePenalty(sig,stat,{},source,usedK,tf)*0.85;
  const base={score:v152Score(s),tech,execution:exe.score,stat:statInfo.score,source:src,notes:[...new Set([...exe.notes,...statInfo.notes])],statInfo,exe};
  const weak=v153WeakLinkCaps(sig,stat,source,base,tf);
  let finalScore=weak.hard?Math.min(base.score,24):Math.min(base.score,weak.cap);
  return {score:v152Score(finalScore),tech,execution:exe.score,stat:statInfo.score,source:src,notes:[...new Set([...base.notes,...weak.notes])],statInfo,exe,weak};
}
function v152Confidence(sel,stat,source){
  let cap=sourceCap(source);
  const n=stat&&stat.count?stat.count:0;
  if(n<24)cap=Math.min(cap,68); else if(n<45)cap=Math.min(cap,78); else if(n<55)cap=Math.min(cap,86);
  if((stat&&stat.fast||0)>20)cap=Math.min(cap,78);
  if((stat&&stat.pf||0)<RULE.rosterMinPF)cap=Math.min(cap,76);
  if((stat&&stat.win||0)<RULE.rosterMinWin)cap=Math.min(cap,76);
  return Math.round(Math.max(50,Math.min(cap,sel.score)));
}
function buildCandidateForDir(sym,tf,b,dir){
  sym=cleanSymbol(sym); if(!sym||!b)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  let sig=null,usedK=0;
  for(let k=0;k<=7;k++){
    const s=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(!s)continue;
    const driftPct=Math.abs(last.close-s.entry)/Math.max(Math.abs(s.entry),1)*100;
    const driftAtr=Math.abs(last.close-s.entry)/Math.max(last.atr||0,1e-9);
    if(driftPct<=RULE.maxEntryDriftPct&&driftAtr<=RULE.maxEntryDriftAtr){sig=s;usedK=k;break;}
  }
  if(!sig)return null;
  const stat=v152SafeStat((b.stats||[]).find(s=>String(s.model||'').includes(dir)),dir);
  const source=sourceMap[key]||'Taze veri';
  const sel=v152SelectorScore(sig,stat,source,usedK,tf);
  if(sel.score<RULE.poolMinScore)return null;
  const conf=v152Confidence(sel,stat,source),lev=leverage(sig,conf),rClass=riskClass(sig.stopPct,lev.lev);
  if(sig.stopPct>RULE.maxStopPct||rClass==='Yüksek')return null;
  const grade=v154Grade(sel,sig,stat,tf,usedK);
  const notes=['geniş havuzdan geldi','v15.4 seçici'];
  if(grade==='A+'||grade==='A')notes.push('ana kadro'); else if(grade==='B+')notes.push('yedek/izleme'); else notes.push('havuz dışı kalite');
  if(usedK>0)notes.push(`${usedK} mum önce tetik`);
  notes.push(...sel.notes.slice(0,3));
  const obj={sym,tf,model:'v15.4 Şampiyon Kalite '+dir,sub:sig.sub,dir:sig.dir,conf,rawConf:Math.round(sel.score),cap:conf,capNotes:[...new Set(notes)],riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,tp2RoomR:sig.tp2RoomR,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source,liveOnly:stat.count<1,stale:false,selectorScore:Math.round(sel.score),poolGrade:grade,usedK,scoreBreakdown:{tech:Math.round(sel.tech),execution:Math.round(sel.execution),backtest:Math.round(sel.stat),source:Math.round(sel.source)}};
  return adjustRiskConfidence(obj);
}
function candidateRank(a,b){
  const gradeW={"A+":400,"A":300,"B+":120,"B":40,"C":0};
  const ga=gradeW[a.poolGrade]||0, gb=gradeW[b.poolGrade]||0;
  if(gb!==ga)return gb-ga;
  const sa=b.selectorScore||b.qualityScore||b.conf||0, sb=a.selectorScore||a.qualityScore||a.conf||0;
  if(Math.abs(sa-sb)>0.001)return sa-sb;
  const ea=(b.scoreBreakdown?.execution||0)-(a.scoreBreakdown?.execution||0); if(ea)return ea;
  const ba=(b.scoreBreakdown?.backtest||0)-(a.scoreBreakdown?.backtest||0); if(ba)return ba;
  return sourcePriority(b.source)-sourcePriority(a.source) || (a.stopPct||0)-(b.stopPct||0);
}
function rankedList(dir,limit=7){
  const all=candidates.filter(x=>x&&x.dir===dir);
  return v152UniqueTop(all.filter(v154MainEligible),limit);
}
function reserveList(dir,limit=10){
  const mainKeys=new Set(rankedList(dir,999).map(x=>x.sym+'|'+x.dir));
  const all=candidates.filter(x=>x&&x.dir===dir&&!mainKeys.has(x.sym+'|'+x.dir));
  return v152UniqueTop(all.filter(v154ReserveEligible),limit);
}
function countByDir(dir){return rankedList(dir,999).length;}
function firstAutoCandidateIndex(){const x=rankedList('LONG',1)[0]||rankedList('SHORT',1)[0]||reserveList('LONG',1)[0]||reserveList('SHORT',1)[0];return x?candidates.indexOf(x):-1;}
function v154RejectStats(dir){
  const arr=candidates.filter(x=>x&&x.dir===dir);
  const rejected=arr.filter(x=>!v154MainEligible(x));
  const badFast=rejected.filter(x=>(x.stat?.fast||0)>RULE.rosterMaxFastStop).length;
  const badBt=rejected.filter(x=>(x.scoreBreakdown?.backtest||0)<RULE.rosterMinBacktestScore||(x.stat?.pf||0)<RULE.rosterMinPF||(x.stat?.win||0)<RULE.rosterMinWin).length;
  const badTech=rejected.filter(x=>!v154TechMainOk(x)).length;
  const badTp=rejected.filter(x=>(x.tp2RoomR||0)<RULE.mainMinTp2RoomR).length;
  const oldTrig=rejected.filter(x=>(x.usedK||0)>v154FreshLimit(x.tf)).length;
  return {all:arr.length,rejected:rejected.length,badFast,badBt,badTech,badTp,oldTrig};
}
function renderList(){
  const box=$('list'),longs=rankedList('LONG',7),shorts=rankedList('SHORT',7),longRes=reserveList('LONG',8),shortRes=reserveList('SHORT',8);
  const poolLong=candidates.filter(x=>x&&x.dir==='LONG').length,poolShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const champLong=longs.length,champShort=shorts.length,elite=candidates.filter(x=>x&&(x.poolGrade==='A+'||x.poolGrade==='A')).length;
  const rL=v154RejectStats('LONG'),rS=v154RejectStats('SHORT');
  const summary=`<div class="dash"><div><b>${poolLong}</b><span>LONG havuz</span></div><div><b>${poolShort}</b><span>SHORT havuz</span></div><div><b>${champLong}</b><span>ana LONG</span></div><div><b>${champShort}</b><span>ana SHORT</span></div><div><b>${longRes.length}+${shortRes.length}</b><span>yedek izleme</span></div><div><b>${elite}</b><span>A/A+ havuz</span></div></div>
  <div class="note"><b>v15.4 standardı:</b> İlk 7’ye B+ alınmaz. Aday; backtest, icra, teknik bağlam, taze tetik, TP2 alanı ve stop kalitesinden birlikte geçerse ana kadroya girer. Kalite yetmezse yedek havuza düşer. LONG eleme: ${rL.rejected}/${rL.all} | SHORT eleme: ${rS.rejected}/${rS.all}</div>`;
  const card=(x,i)=>{const idx=candidates.indexOf(x),bd=x.scoreBreakdown||{};const bt=`İşlem ${x.stat.count||0} | Win ${pct(x.stat.win||0,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)} | Hızlı stop ${pct(x.stat.fast||0,1)}`;const spot=x.dir==='LONG'?'<span class="pill green">spot AL adayı</span>':'<span class="pill red">spotta short değil</span>';return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.selectorScore}<br><span style="font-size:15px">PUAN</span></div></div><div class="line">Kalite sınıfı: <b>${x.poolGrade}</b> | Güven: ${x.conf}% | Tetik: ${x.usedK||0} mum<br>Skor kırılımı: Teknik ${bd.tech||'-'} / İcra ${bd.execution||'-'} / Backtest ${bd.backtest||'-'} / Veri ${bd.source||'-'}<br>Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source}<br>Teknik: ${(x.why||[]).join(' + ')}</div><div>${spot}<span class="pill blue">v15.4 şampiyon kalite</span>${(x.capNotes||[]).slice(0,5).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc,empty)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):empty}</div>`;
  box.innerHTML=summary+
    section('Ana Kadro LONG — Yalnız A/A+',longs,'LONG','Binance TR spot için AL yönünde kullanılabilecek ana kadro. B+ burada görünmez.','<p>LONG havuz var ama A/A+ ana kadro eşiğini geçen aday yok. İşlem açma, yedekleri sadece izle.</p>')+
    section('Ana Kadro SHORT — Yalnız A/A+',shorts,'SHORT','Spotta emir değil; vadeli/izleme-çıkış yönüdür. Sadece A/A+ short bağlamları gelir.','<p>SHORT havuz var ama A/A+ short kadro eşiğini geçen aday yok.</p>')+
    section('Yedek LONG İzleme Havuzu',longRes,'LONG','B+ kalite: teknik olarak izlenir ama ana işlem kadrosu değildir.','<p>Yedek LONG yok.</p>')+
    section('Yedek SHORT İzleme Havuzu',shortRes,'SHORT','B+ kalite: izleme/çıkış uyarısı; ana short kadrosu değildir.','<p>Yedek SHORT yok.</p>');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  const bd=x.scoreBreakdown||{},d=x.techDetail||{};
  const status=v154MainEligible(x)?'ANA KADRO':'YEDEK / İZLEME';
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} ${status} — PUAN ${x.selectorScore} / ${x.poolGrade}`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Kalite sınıfı',x.poolGrade||'-')+metric('Kadro durumu',status)+metric('Kadro puanı',x.selectorScore||'-')+metric('Teknik / İcra',`${bd.tech||'-'} / ${bd.execution||'-'}`)+metric('Backtest / Veri',`${bd.backtest||'-'} / ${bd.source||'-'}`)+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Tetik yaşı',`${x.usedK||0} mum`)+metric('Mum/Fiyat kaynağı',`${x.candleSource||x.source} / ${x.priceSource||x.source}`)+metric('Risk sınıfı',x.riskClass)+metric('Güven',`${x.conf}%`)+metric('Trend / MTF',`${fmt(d.trend?.score||0,0)} / ${fmt(d.mtf?.score||0,0)}`)+metric('Yapı / Lokasyon',`${fmt(d.st?.score||0,0)} / ${fmt(d.loc?.score||0,0)}`)+metric('Momentum / Para akışı',`${fmt(d.mom?.score||0,0)} / ${fmt(d.flow?.score||0,0)}`)+metric('Tetik / Volatilite',`${fmt(d.trig?.score||0,0)} / ${fmt(d.vol?.score||0,0)}`)+metric('TP2 alanı',`${fmt(x.tp2RoomR||0,2)}R`)+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Spot tutar',fmt(RULE.spotTry,0)+' TL')+metric('Risk',dualMoney(x.lev.riskD))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=(x.why||[]).map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win||0,1)}</span><span class="pill blue">PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast||0,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe||0,2)}R / ${fmt(x.stat.avgMae||0,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,8).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.';
  if(!v154MainEligible(x))return `<b>YEDEK / İZLEME</b><div class="tryline">Bu aday ana kadro kalitesinde değil. İşlem açma; sadece takip et. Ana kadro için A/A+ standardı, taze tetik, TP2 alanı, güçlü backtest ve teknik bağlam gerekir.</div>`;
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString('tr-TR',{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==='LONG'){
    const stopLimit=x.stop*0.9975, riskTry=RULE.spotTry*(x.stopPct/100), p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — v15.4 ANA KADRO</b><div class="tryline">Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa kullan. Yoksa bu adayı spotta uygulama.</div><div class="tryline">Limit AL referansı: ${tlInput(x.entry)} TL | Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline"><b>Güvenli OCO:</b> TP1 ${tlInput(x.t1)} TL | Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL.</div><div class="tryline"><b>TP2 modu:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan miktarı TP2’ye taşı.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Binance TR spotta doğrudan short açılamaz. Bu liste vadeli/marjin veya eldeki longdan çıkış-dikkat yönüdür.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2 alanı: ${fmt(x.tp2RoomR||0,2)}R</div>`;
}
async function scanAll(){
  setMeta(`v15.4 Şampiyon Kalite tarama başladı: geniş havuz + ana kadro/yedek ayrımı...`);
  candidates=[]; scanLog.lowQuality=0; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue;} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=235&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const dir of ['LONG','SHORT']){const cand=buildCandidateForDir(s,tf,b,dir); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%8===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15.4 havuz ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} | Ana kadro: ${rankedList('LONG',7).length}+${rankedList('SHORT',7).length} | Yedek: ${reserveList('LONG',99).length}+${reserveList('SHORT',99).length}`); await delay(16);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | LONG havuz ${candidates.filter(x=>x.dir==='LONG').length} / ana ${rankedList('LONG',7).length} / yedek ${reserveList('LONG',99).length} | SHORT havuz ${candidates.filter(x=>x.dir==='SHORT').length} / ana ${rankedList('SHORT',7).length} / yedek ${reserveList('SHORT',99).length} | v15.4 Şampiyon Kalite Seçici aktif`);
}


/* =========================================================
   v15.5 MILLI TAKIM KALITE ANAYASASI
   Amaç: Havuz bol kalsın; ilk 7 işlem ise ne çok gevşek ne de kör sıkı seçilsin.
   Ana kadroya A+, A ve güçlü A- alınır. B+ yalnız izleme/yedek havuzdur.
========================================================= */
Object.assign(RULE,{
  versionName:'v15.5 Milli Takım Kalite Anayasası',
  poolMinScore:38,
  reserveMinScore:60,
  championMinScore:70,
  eliteMinScore:86,
  nationalTeamSize:7,
  minConf:58,
  // Ölümcül veto kapısı
  hardMinTrades:25,
  hardMinPF:1.55,
  hardMinWin:50,
  hardMaxFastStop:30,
  hardMinBacktestScore:60,
  hardMinExecutionScore:68,
  hardMinTechScore:50,
  hardMinTp2RoomR:1.45,
  // Ana kadro alt standardı: A- dahil ama B+ değil
  rosterMinTrades:35,
  rosterMinPF:1.90,
  rosterMinWin:55,
  rosterMaxFastStop:23,
  rosterMinBacktestScore:72,
  rosterMinExecutionScore:76,
  rosterMinTechScore:60,
  rosterMinTp2RoomR:1.75,
  // A standardı
  aMinTrades:45,
  aMinPF:2.10,
  aMinWin:58,
  aMaxFastStop:20,
  aMinBacktestScore:76,
  aMinExecutionScore:80,
  aMinTechScore:65,
  aMinTp2RoomR:1.90,
  // A+ standardı
  aPlusMinTrades:55,
  aPlusMinPF:2.60,
  aPlusMinWin:62,
  aPlusMaxFastStop:15,
  aPlusMinBacktestScore:82,
  aPlusMinExecutionScore:84,
  aPlusMinTechScore:72,
  aPlusMinTp2RoomR:2.25,
  // Stop/TP alanı
  minTp2RoomR:1.45,
  mainMinTp2RoomR:1.75,
  reserveMinTp2RoomR:1.50,
  maxMainStopPct:3.10,
  maxStopPct:3.60,
  minMainStopPct:0.55,
  // Tetik tazeliği: ana kadro için ana zaman dilimine göre esnek ama sınırsız değil
  maxFreshSignalBars15m:3,
  maxFreshSignalBars30m:3,
  maxFreshSignalBars1h:4,
  maxFreshSignalBars2h:4,
  maxFreshSignalBars4h:5,
  // Teknik alt kapılar: A- için minimum bağlam
  minMainLocScore:52,
  minMainTrigScore:48,
  minMainStructScore:50,
  minMainMomScore:46,
  minMainFlowScore:42,
  minMainMtfScore:46,
  minMainTrendScore:48,
  // A/A+ için daha güçlü bağlam
  strongLocScore:58,
  strongTrigScore:54,
  strongStructScore:56,
  strongMomScore:52,
  strongFlowScore:48,
  strongMtfScore:52,
  strongTrendScore:54
});

function v155FreshLimit(tf){
  if(tf==='15m')return RULE.maxFreshSignalBars15m;
  if(tf==='30m')return RULE.maxFreshSignalBars30m;
  if(tf==='1h')return RULE.maxFreshSignalBars1h;
  if(tf==='2h')return RULE.maxFreshSignalBars2h;
  if(tf==='4h')return RULE.maxFreshSignalBars4h;
  return 3;
}
function v154FreshLimit(tf){return v155FreshLimit(tf)}
function v155EvidenceCount(x){
  const d=x?.techDetail||{}, arr=[d.trend,d.mtf,d.st,d.loc,d.mom,d.flow,d.trig,d.vol];
  return arr.filter(o=>(o?.score||0)>=52).length + ((x?.tp2RoomR||0)>=RULE.rosterMinTp2RoomR?1:0);
}
function v154EvidenceCount(x){return v155EvidenceCount(x)}
function v155WeakDimensionCount(x){
  const d=x?.techDetail||{};
  const vals=[d.trend?.score||0,d.mtf?.score||0,d.st?.score||0,d.loc?.score||0,d.mom?.score||0,d.flow?.score||0,d.trig?.score||0];
  return vals.filter(v=>v>0&&v<44).length;
}
function v154WeakDimensionCount(x){return v155WeakDimensionCount(x)}
function v155StopOk(x,main=true){
  const stop=x?.stopPct||999, tf=x?.tf||'15m';
  const max = tf==='4h'?3.40:tf==='2h'?3.30:tf==='1h'?3.20:RULE.maxMainStopPct;
  const min = main?RULE.minMainStopPct:0.45;
  return stop>=min && stop<=max;
}
function v154StopOk(x,main=true){return v155StopOk(x,main)}
function v155HardVeto(x){
  const s=x?.stat||{}, bd=x?.scoreBreakdown||{}, room=x?.tp2RoomR||0;
  const reasons=[];
  if(!x||!validCandidateSymbol(x))reasons.push('sembol hatalı');
  if((x?.ageSec||9999)>RULE.maxLiveAgeMs/1000)reasons.push('veri eski');
  if(x?.riskClass==='Yüksek')reasons.push('risk yüksek');
  if((s.count||0)<RULE.hardMinTrades)reasons.push('örneklem düşük');
  if((s.pf||0)<RULE.hardMinPF)reasons.push('PF veto');
  if((s.win||0)<RULE.hardMinWin)reasons.push('win veto');
  if((s.fast||0)>RULE.hardMaxFastStop)reasons.push('hızlı stop veto');
  if((bd.backtest||0)<RULE.hardMinBacktestScore)reasons.push('backtest veto');
  if((bd.execution||0)<RULE.hardMinExecutionScore)reasons.push('icra veto');
  if((bd.tech||0)<RULE.hardMinTechScore)reasons.push('teknik veto');
  if(room<RULE.hardMinTp2RoomR)reasons.push('TP2 alan veto');
  if(!v155StopOk(x,false))reasons.push('stop geometrisi veto');
  return {ok:reasons.length===0,reasons};
}
function v155BacktestMainOk(x){
  const s=x?.stat||{}, bd=x?.scoreBreakdown||{};
  if(!v155HardVeto(x).ok)return false;
  return (s.count||0)>=RULE.rosterMinTrades && (s.pf||0)>=RULE.rosterMinPF && (s.win||0)>=RULE.rosterMinWin && (s.fast||0)<=RULE.rosterMaxFastStop && (bd.backtest||0)>=RULE.rosterMinBacktestScore;
}
function v154BacktestMainOk(x){return v155BacktestMainOk(x)}
function v155TechMainOk(x){
  const d=x?.techDetail||{}, bd=x?.scoreBreakdown||{};
  if((bd.tech||0)<RULE.rosterMinTechScore)return false;
  if((bd.execution||0)<RULE.rosterMinExecutionScore)return false;
  if((d.loc?.score||0)<RULE.minMainLocScore)return false;
  if((d.trig?.score||0)<RULE.minMainTrigScore)return false;
  if((d.st?.score||0)<RULE.minMainStructScore)return false;
  if((d.mom?.score||0)<RULE.minMainMomScore)return false;
  if((d.flow?.score||0)<RULE.minMainFlowScore)return false;
  if((d.mtf?.score||0)<RULE.minMainMtfScore)return false;
  if((d.trend?.score||0)<RULE.minMainTrendScore)return false;
  return true;
}
function v154TechMainOk(x){return v155TechMainOk(x)}
function v155StrongTechOk(x){
  const d=x?.techDetail||{}, bd=x?.scoreBreakdown||{};
  return (bd.tech||0)>=RULE.aMinTechScore && (bd.execution||0)>=RULE.aMinExecutionScore &&
    (d.loc?.score||0)>=RULE.strongLocScore && (d.trig?.score||0)>=RULE.strongTrigScore &&
    (d.st?.score||0)>=RULE.strongStructScore && (d.mom?.score||0)>=RULE.strongMomScore &&
    (d.flow?.score||0)>=RULE.strongFlowScore && (d.mtf?.score||0)>=RULE.strongMtfScore &&
    (d.trend?.score||0)>=RULE.strongTrendScore;
}
function v155NotChased(x){
  const d=x?.techDetail||{};
  if(d.loc?.chase)return false;
  if((x?.usedK||0)>v155FreshLimit(x?.tf))return false;
  return true;
}
function v154NotChased(x){return v155NotChased(x)}
function v155RosterBand(x){
  const s=x?.stat||{}, bd=x?.scoreBreakdown||{}, room=x?.tp2RoomR||0, score=x?.selectorScore||0;
  const used=x?.usedK||0, fresh=used<=v155FreshLimit(x?.tf);
  if(!v155HardVeto(x).ok)return 'C';
  if(!fresh)return 'B+';
  const aplus=(s.count||0)>=RULE.aPlusMinTrades && (s.pf||0)>=RULE.aPlusMinPF && (s.win||0)>=RULE.aPlusMinWin && (s.fast||0)<=RULE.aPlusMaxFastStop && room>=RULE.aPlusMinTp2RoomR && (bd.execution||0)>=RULE.aPlusMinExecutionScore && (bd.backtest||0)>=RULE.aPlusMinBacktestScore && (bd.tech||0)>=RULE.aPlusMinTechScore && score>=RULE.eliteMinScore && v155StrongTechOk(x);
  if(aplus)return 'A+';
  const a=(s.count||0)>=RULE.aMinTrades && (s.pf||0)>=RULE.aMinPF && (s.win||0)>=RULE.aMinWin && (s.fast||0)<=RULE.aMaxFastStop && room>=RULE.aMinTp2RoomR && (bd.execution||0)>=RULE.aMinExecutionScore && (bd.backtest||0)>=RULE.aMinBacktestScore && (bd.tech||0)>=RULE.aMinTechScore && score>=RULE.championMinScore && v155TechMainOk(x) && v155EvidenceCount(x)>=6;
  if(a)return 'A';
  const aminus=(s.count||0)>=RULE.rosterMinTrades && (s.pf||0)>=RULE.rosterMinPF && (s.win||0)>=RULE.rosterMinWin && (s.fast||0)<=RULE.rosterMaxFastStop && room>=RULE.rosterMinTp2RoomR && (bd.execution||0)>=RULE.rosterMinExecutionScore && (bd.backtest||0)>=RULE.rosterMinBacktestScore && (bd.tech||0)>=RULE.rosterMinTechScore && score>=RULE.championMinScore && v155TechMainOk(x) && v155EvidenceCount(x)>=6;
  if(aminus)return 'A-';
  const reserve=(s.count||0)>=30 && (s.pf||0)>=1.70 && (s.win||0)>=52 && (s.fast||0)<=27 && room>=RULE.reserveMinTp2RoomR && (bd.execution||0)>=72 && (bd.backtest||0)>=66 && (bd.tech||0)>=56;
  if(reserve)return 'B+';
  return 'B';
}
function v154Grade(sel,sig,stat,tf,usedK=0){
  // BuildCandidate aşamasında henüz obj yok; geçici obj ile v15.5 bandını hesapla.
  const temp={stat,scoreBreakdown:{tech:Math.round(sel.tech||0),execution:Math.round(sel.execution||0),backtest:Math.round(sel.stat||0),source:Math.round(sel.source||0)},tp2RoomR:sig?.tp2RoomR||0,stopPct:sig?.stopPct||0,selectorScore:Math.round(sel.score||0),usedK,tf,techDetail:sig?.techDetail||{},riskClass:'Dengeli',ageSec:0,sym:'TMPUSDT'};
  return v155RosterBand(temp);
}
function v155MainEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  const band=x.poolGrade||v155RosterBand(x);
  if(!['A+','A','A-'].includes(band))return false;
  if(!v155HardVeto(x).ok)return false;
  if(!v155StopOk(x,true))return false;
  if(!v155BacktestMainOk(x))return false;
  if(!v155TechMainOk(x))return false;
  if(!v155NotChased(x))return false;
  if(v155EvidenceCount(x)<6)return false;
  if(v155WeakDimensionCount(x)>0)return false;
  return true;
}
function v154MainEligible(x){return v155MainEligible(x)}
function v155ReserveEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if(v155MainEligible(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if(x.riskClass==='Yüksek')return false;
  const s=x.stat||{}, bd=x.scoreBreakdown||{}, d=x.techDetail||{};
  if((x.selectorScore||0)<RULE.reserveMinScore)return false;
  if((x.tp2RoomR||0)<RULE.reserveMinTp2RoomR)return false;
  if(!v155StopOk(x,false))return false;
  if((s.count||0)<30 || (s.pf||0)<1.70 || (s.win||0)<52 || (s.fast||0)>27)return false;
  if((bd.backtest||0)<66 || (bd.execution||0)<72 || (bd.tech||0)<56)return false;
  if((d.loc?.score||0)<48 || (d.trig?.score||0)<44)return false;
  return true;
}
function v154ReserveEligible(x){return v155ReserveEligible(x)}
function v155ScorePenalty(sig,stat,sel,source,usedK,tf){
  let p=0; const d=sig.techDetail||{}, room=sig.tp2RoomR||0, stop=sig.stopPct||0;
  if((stat.count||0)<RULE.rosterMinTrades)p+=7;
  if((stat.win||0)<RULE.rosterMinWin)p+=8;
  if((stat.pf||0)<RULE.rosterMinPF)p+=9;
  if((stat.fast||0)>RULE.rosterMaxFastStop)p+=9;
  if(room<RULE.rosterMinTp2RoomR)p+=10;
  if(stop<RULE.minMainStopPct)p+=6;
  if(stop>RULE.maxMainStopPct)p+=6;
  if(usedK>v155FreshLimit(tf))p+=10;
  if((d.trend?.score||0)<RULE.minMainTrendScore)p+=4;
  if((d.mtf?.score||0)<RULE.minMainMtfScore)p+=4;
  if((d.loc?.score||0)<RULE.minMainLocScore)p+=6;
  if((d.trig?.score||0)<RULE.minMainTrigScore)p+=5;
  if(String(source||'').includes('JSON'))p+=3;
  return p;
}
function v154ScorePenalty(sig,stat,sel,source,usedK,tf){return v155ScorePenalty(sig,stat,sel,source,usedK,tf)}
function v152SelectorScore(sig,stat,source,usedK=0,tf='15m'){
  const tech=Number(sig.q)||45, statInfo=v152StatScore(stat), exe=v152ExecutionScore(sig), src=44+sourcePriority(source)*12;
  const d=sig.techDetail||{};
  let s=tech*.20+exe.score*.32+statInfo.score*.38+src*.10;
  if((d.loc?.labels||[]).length>=2)s+=2;
  if(d.mtf?.strong)s+=2;
  if(d.flow?.volStrong)s+=1;
  if((sig.tp2RoomR||0)>=2.25)s+=3;
  if((sig.tp2RoomR||0)<RULE.rosterMinTp2RoomR)s-=8;
  s-=v155ScorePenalty(sig,stat,{},source,usedK,tf)*0.80;
  const base={score:v152Score(s),tech,execution:exe.score,stat:statInfo.score,source:src,notes:[...new Set([...exe.notes,...statInfo.notes])],statInfo,exe};
  const weak=v153WeakLinkCaps(sig,stat,source,base,tf);
  let finalScore=weak.hard?Math.min(base.score,24):Math.min(base.score,weak.cap);
  // v15.5 zayıf halka tavanları
  if((stat?.pf||0)<RULE.rosterMinPF)finalScore=Math.min(finalScore,72);
  if((stat?.win||0)<RULE.rosterMinWin)finalScore=Math.min(finalScore,72);
  if((stat?.fast||0)>RULE.rosterMaxFastStop)finalScore=Math.min(finalScore,72);
  if((stat?.count||0)<RULE.rosterMinTrades)finalScore=Math.min(finalScore,70);
  if((sig.tp2RoomR||0)<RULE.rosterMinTp2RoomR)finalScore=Math.min(finalScore,68);
  if((exe.score||0)<RULE.rosterMinExecutionScore)finalScore=Math.min(finalScore,72);
  if(usedK>v155FreshLimit(tf))finalScore=Math.min(finalScore,68);
  return {score:v152Score(finalScore),tech,execution:exe.score,stat:statInfo.score,source:src,notes:[...new Set([...base.notes,...weak.notes])],statInfo,exe,weak};
}
function v152Confidence(sel,stat,source){
  let cap=sourceCap(source); const n=stat&&stat.count?stat.count:0;
  if(n<25)cap=Math.min(cap,66); else if(n<35)cap=Math.min(cap,72); else if(n<45)cap=Math.min(cap,78); else if(n<55)cap=Math.min(cap,86);
  if((stat&&stat.fast||0)>RULE.rosterMaxFastStop)cap=Math.min(cap,76);
  if((stat&&stat.pf||0)<RULE.rosterMinPF)cap=Math.min(cap,74);
  if((stat&&stat.win||0)<RULE.rosterMinWin)cap=Math.min(cap,74);
  return Math.round(Math.max(50,Math.min(cap,sel.score)));
}
function candidateRank(a,b){
  const gradeW={"A+":520,"A":440,"A-":360,"B+":150,"B":40,"C":0};
  const ga=gradeW[a.poolGrade]||0, gb=gradeW[b.poolGrade]||0; if(gb!==ga)return gb-ga;
  const sa=b.selectorScore||b.qualityScore||b.conf||0, sb=a.selectorScore||a.qualityScore||a.conf||0; if(Math.abs(sa-sb)>0.001)return sa-sb;
  const fast=(a.stat?.fast||0)-(b.stat?.fast||0); if(Math.abs(fast)>0.01)return fast;
  const ba=(b.scoreBreakdown?.backtest||0)-(a.scoreBreakdown?.backtest||0); if(ba)return ba;
  const ea=(b.scoreBreakdown?.execution||0)-(a.scoreBreakdown?.execution||0); if(ea)return ea;
  const ta=(b.scoreBreakdown?.tech||0)-(a.scoreBreakdown?.tech||0); if(ta)return ta;
  return ((b.tp2RoomR||0)-(a.tp2RoomR||0)) || sourcePriority(b.source)-sourcePriority(a.source) || (a.stopPct||0)-(b.stopPct||0);
}
function rankedList(dir,limit=7){
  const all=candidates.filter(x=>x&&x.dir===dir&&v155MainEligible(x));
  return v152UniqueTop(all.sort(candidateRank),limit);
}
function reserveList(dir,limit=10){
  const mainKeys=new Set(rankedList(dir,999).map(x=>x.sym+'|'+x.dir));
  const all=candidates.filter(x=>x&&x.dir===dir&&!mainKeys.has(x.sym+'|'+x.dir)&&v155ReserveEligible(x));
  return v152UniqueTop(all.sort(candidateRank),limit);
}
function countByDir(dir){return rankedList(dir,999).length;}
function firstAutoCandidateIndex(){const x=rankedList('LONG',1)[0]||rankedList('SHORT',1)[0]||reserveList('LONG',1)[0]||reserveList('SHORT',1)[0];return x?candidates.indexOf(x):-1;}
function v155RejectStats(dir){
  const arr=candidates.filter(x=>x&&x.dir===dir), rejected=arr.filter(x=>!v155MainEligible(x));
  const badHard=rejected.filter(x=>!v155HardVeto(x).ok).length;
  const badFast=rejected.filter(x=>(x.stat?.fast||0)>RULE.rosterMaxFastStop).length;
  const badBt=rejected.filter(x=>(x.scoreBreakdown?.backtest||0)<RULE.rosterMinBacktestScore||(x.stat?.pf||0)<RULE.rosterMinPF||(x.stat?.win||0)<RULE.rosterMinWin).length;
  const badTech=rejected.filter(x=>!v155TechMainOk(x)).length;
  const badTp=rejected.filter(x=>(x.tp2RoomR||0)<RULE.rosterMinTp2RoomR).length;
  const oldTrig=rejected.filter(x=>(x.usedK||0)>v155FreshLimit(x.tf)).length;
  return {all:arr.length,rejected:rejected.length,badHard,badFast,badBt,badTech,badTp,oldTrig};
}
function v154RejectStats(dir){return v155RejectStats(dir)}
function v155BandLabel(x){return x.poolGrade==='A+'?'KAPTAN':x.poolGrade==='A'?'ANA KADRO':x.poolGrade==='A-'?'ANA KADRO SINIR':'YEDEK / İZLEME'}
function renderList(){
  const box=$('list'),longs=rankedList('LONG',7),shorts=rankedList('SHORT',7),longRes=reserveList('LONG',8),shortRes=reserveList('SHORT',8);
  const poolLong=candidates.filter(x=>x&&x.dir==='LONG').length,poolShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const elite=candidates.filter(x=>x&&(x.poolGrade==='A+'||x.poolGrade==='A'||x.poolGrade==='A-')).length;
  const rL=v155RejectStats('LONG'),rS=v155RejectStats('SHORT');
  const summary=`<div class="dash"><div><b>${poolLong}</b><span>LONG havuz</span></div><div><b>${poolShort}</b><span>SHORT havuz</span></div><div><b>${longs.length}</b><span>ana LONG</span></div><div><b>${shorts.length}</b><span>ana SHORT</span></div><div><b>${longRes.length}+${shortRes.length}</b><span>yedek izleme</span></div><div><b>${elite}</b><span>A-/A/A+ havuz</span></div></div>
  <div class="note"><b>v15.5 Milli Takım Kalite Anayasası:</b> Havuz geniş kalır; ilk 7’ye yalnız A+, A ve güçlü A- alınır. B+ işlem değil yedektir. Seçim sırası: ölümcül veto → backtest sağlık → giriş/stop/TP2 icrası → teknik bağlam → veri/tetik tazeliği. LONG eleme: ${rL.rejected}/${rL.all} | SHORT eleme: ${rS.rejected}/${rS.all}</div>`;
  const card=(x,i)=>{const idx=candidates.indexOf(x),bd=x.scoreBreakdown||{};const bt=`İşlem ${x.stat.count||0} | Win ${pct(x.stat.win||0,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)} | Hızlı stop ${pct(x.stat.fast||0,1)}`;const spot=x.dir==='LONG'?'<span class="pill green">spot AL adayı</span>':'<span class="pill red">spotta short değil</span>';const band=`<span class="pill ${x.poolGrade==='A+'?'green':x.poolGrade==='A'?'blue':x.poolGrade==='A-'?'amber':'gray'}">${v155BandLabel(x)}</span>`;return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.selectorScore}<br><span style="font-size:15px">PUAN</span></div></div><div class="line">Kalite: <b>${x.poolGrade}</b> | ${v155BandLabel(x)} | Güven: ${x.conf}% | Tetik: ${x.usedK||0} mum<br>Skor: Teknik ${bd.tech||'-'} / İcra ${bd.execution||'-'} / Backtest ${bd.backtest||'-'} / Veri ${bd.source||'-'}<br>Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source}<br>Teknik: ${(x.why||[]).join(' + ')}</div><div>${spot}${band}<span class="pill blue">v15.5 kalite anayasası</span>${(x.capNotes||[]).slice(0,4).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc,empty)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):empty}</div>`;
  box.innerHTML=summary+
    section('En İyi 7 LONG — Ana Kadro',longs,'LONG','Havuzdan seçilen A+/A/A- spot LONG adayları. İlk 3 kaptan, 4–7 ana kadro/sınır kadrodur.','<p>LONG havuz var ama ana kadro standardını geçen aday yok. Yedekleri izle, işlem açma.</p>')+
    section('En İyi 7 SHORT — Ana Kadro',shorts,'SHORT','Spotta emir değil; vadeli/izleme-çıkış yönüdür. Yalnız en sağlam short bağlamları gelir.','<p>SHORT havuz var ama ana short standardını geçen aday yok.</p>')+
    section('Yedek LONG İzleme Havuzu',longRes,'LONG','B+ kalite: takip edilir ama işlem açma listesi değildir.','<p>Yedek LONG yok.</p>')+
    section('Yedek SHORT İzleme Havuzu',shortRes,'SHORT','B+ kalite: izleme/çıkış uyarısıdır; ana kadro değildir.','<p>Yedek SHORT yok.</p>');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  const bd=x.scoreBreakdown||{},d=x.techDetail||{};
  const status=v155MainEligible(x)?v155BandLabel(x):'YEDEK / İZLEME';
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} ${status} — PUAN ${x.selectorScore} / ${x.poolGrade}`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Kalite sınıfı',x.poolGrade||'-')+metric('Kadro durumu',status)+metric('Kadro puanı',x.selectorScore||'-')+metric('Teknik / İcra',`${bd.tech||'-'} / ${bd.execution||'-'}`)+metric('Backtest / Veri',`${bd.backtest||'-'} / ${bd.source||'-'}`)+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Tetik yaşı',`${x.usedK||0} mum`)+metric('Mum/Fiyat kaynağı',`${x.candleSource||x.source} / ${x.priceSource||x.source}`)+metric('Risk sınıfı',x.riskClass)+metric('Güven',`${x.conf}%`)+metric('Trend / MTF',`${fmt(d.trend?.score||0,0)} / ${fmt(d.mtf?.score||0,0)}`)+metric('Yapı / Lokasyon',`${fmt(d.st?.score||0,0)} / ${fmt(d.loc?.score||0,0)}`)+metric('Momentum / Para akışı',`${fmt(d.mom?.score||0,0)} / ${fmt(d.flow?.score||0,0)}`)+metric('Tetik / Volatilite',`${fmt(d.trig?.score||0,0)} / ${fmt(d.vol?.score||0,0)}`)+metric('TP2 alanı',`${fmt(x.tp2RoomR||0,2)}R`)+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Spot tutar',fmt(RULE.spotTry,0)+' TL')+metric('Risk',dualMoney(x.lev.riskD))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=(x.why||[]).map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win||0,1)}</span><span class="pill blue">PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast||0,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe||0,2)}R / ${fmt(x.stat.avgMae||0,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,8).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden Binance TR emri girme.';
  if(!v155MainEligible(x))return `<b>YEDEK / İZLEME</b><div class="tryline">Bu aday ana kadro kalitesinde değil. İşlem açma; sadece takip et. Ana kadro için en az A- standardı, sağlam backtest, taze tetik, TP2 alanı, stop kalitesi ve teknik bağlam birlikte geçmelidir.</div>`;
  const entryTL=x.entry*fx.rate, qty=RULE.spotTry/Math.max(entryTL,1e-9);
  function qtyFmt(q){return Number(q).toLocaleString('tr-TR',{minimumFractionDigits:q>=1?3:5,maximumFractionDigits:q>=1?4:8})}
  if(x.dir==='LONG'){
    const stopLimit=x.stop*0.9975, riskTry=RULE.spotTry*(x.stopPct/100), p1=RULE.spotTry*((x.t1-x.entry)/x.entry),p2=RULE.spotTry*((x.t2-x.entry)/x.entry),p3=RULE.spotTry*((x.t3-x.entry)/x.entry);
    return `<b>Binance TR SPOT LONG — v15.5 ANA KADRO</b><div class="tryline">Parite: ${symbolLabel(x.sym).replace('USDT','')}/TRY varsa kullan. Yoksa bu adayı spotta uygulama.</div><div class="tryline">Limit AL referansı: ${tlInput(x.entry)} TL | Yaklaşık miktar: ${qtyFmt(qty)} ${symbolLabel(x.sym).replace('USDT','')}.</div><div class="tryline"><b>Güvenli OCO:</b> TP1 ${tlInput(x.t1)} TL | Stop ${tlInput(x.stop)} TL | Stop-limit ${tlInput(stopLimit)} TL.</div><div class="tryline"><b>TP2 modu:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan miktarı TP2’ye taşı.</div><div class="tryline">Tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
  }
  return `<b>SHORT planı — spot işlem değildir</b><div class="tryline">Binance TR spotta doğrudan short açılamaz. Bu liste vadeli/marjin veya eldeki longdan çıkış-dikkat yönüdür.</div><div class="tryline">Giriş: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2 alanı: ${fmt(x.tp2RoomR||0,2)}R</div>`;
}
async function scanAll(){
  setMeta(`v15.5 Milli Takım Kalite tarama başladı: geniş havuz + kaliteli 7 seçimi...`);
  candidates=[]; scanLog.lowQuality=0; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue;} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=235&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const dir of ['LONG','SHORT']){const cand=buildCandidateForDir(s,tf,b,dir); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%8===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15.5 havuz ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} | Ana: ${rankedList('LONG',7).length}+${rankedList('SHORT',7).length} | Yedek: ${reserveList('LONG',99).length}+${reserveList('SHORT',99).length}`); await delay(16);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | LONG havuz ${candidates.filter(x=>x.dir==='LONG').length} / ana ${rankedList('LONG',7).length} / yedek ${reserveList('LONG',99).length} | SHORT havuz ${candidates.filter(x=>x.dir==='SHORT').length} / ana ${rankedList('SHORT',7).length} / yedek ${reserveList('SHORT',99).length} | v15.5 Milli Takım Kalite Anayasası aktif`);
}

/* =========================================================
   v15.6 ESIT LONG/SHORT KALITE MOTORU
   Amaç: LONG ve SHORT kalite standartlarını tamamen eşitlemek.
   Spot/vadeli uygulanabilirlik teknik kaliteye karışmaz.
========================================================= */
Object.assign(RULE,{
  versionName:'v15.6 Eşit LONG/SHORT Kalite Motoru',
  nationalTeamSize:7,
  poolMinScore:38,
  reserveMinScore:60,
  championMinScore:70,
  eliteMinScore:86,
  minConf:58,
  // Genel havuz kapısı: iki yön için birebir aynı
  hardMinTrades:25,
  hardMinPF:1.55,
  hardMinWin:50,
  hardMaxFastStop:30,
  hardMinBacktestScore:60,
  hardMinExecutionScore:68,
  hardMinTechScore:50,
  hardMinTp2RoomR:1.45,
  // Ana kadro alt standardı: LONG/SHORT tamamen aynı
  rosterMinTrades:35,
  rosterMinPF:1.90,
  rosterMinWin:55,
  rosterMaxFastStop:23,
  rosterMinBacktestScore:72,
  rosterMinExecutionScore:76,
  rosterMinTechScore:60,
  rosterMinTp2RoomR:1.75,
  // A standardı
  aMinTrades:45,
  aMinPF:2.10,
  aMinWin:58,
  aMaxFastStop:20,
  aMinBacktestScore:76,
  aMinExecutionScore:80,
  aMinTechScore:65,
  aMinTp2RoomR:1.90,
  // A+ standardı
  aPlusMinTrades:55,
  aPlusMinPF:2.60,
  aPlusMinWin:62,
  aPlusMaxFastStop:15,
  aPlusMinBacktestScore:82,
  aPlusMinExecutionScore:84,
  aPlusMinTechScore:72,
  aPlusMinTp2RoomR:2.25,
  minTp2RoomR:1.45,
  mainMinTp2RoomR:1.75,
  reserveMinTp2RoomR:1.50,
  maxMainStopPct:3.10,
  maxStopPct:3.60,
  minMainStopPct:0.55
});
function v156FreshLimit(tf){return v155FreshLimit(tf)}
function v156DirectionMirrorName(dir){return dir==='LONG'?'LONG teknik aday':'SHORT teknik aday'}
function v156BandLabel(x){
  const g=x?.poolGrade||v156RosterBand(x);
  if(g==='A+')return 'A+ ANA KADRO';
  if(g==='A')return 'A ANA KADRO';
  if(g==='A-')return 'A- SINIR ANA KADRO';
  if(g==='B+')return 'B+ YEDEK / İZLEME';
  return 'HAVUZ / İZLEME';
}
function v156EvidenceCount(x){return v155EvidenceCount(x)}
function v156WeakDimensionCount(x){return v155WeakDimensionCount(x)}
function v156StopOk(x,main=true){return v155StopOk(x,main)}
function v156HardVeto(x){
  const s=x?.stat||{}, bd=x?.scoreBreakdown||{}, room=x?.tp2RoomR||0, reasons=[];
  if(!x||!validCandidateSymbol(x))reasons.push('sembol hatalı');
  if((x?.ageSec||9999)>RULE.maxLiveAgeMs/1000)reasons.push('veri eski');
  if(x?.riskClass==='Yüksek')reasons.push('risk yüksek');
  if((s.count||0)<RULE.hardMinTrades)reasons.push('örneklem düşük');
  if((s.pf||0)<RULE.hardMinPF)reasons.push('PF veto');
  if((s.win||0)<RULE.hardMinWin)reasons.push('win veto');
  if((s.fast||0)>RULE.hardMaxFastStop)reasons.push('hızlı stop veto');
  if((bd.backtest||0)<RULE.hardMinBacktestScore)reasons.push('backtest veto');
  if((bd.execution||0)<RULE.hardMinExecutionScore)reasons.push('icra veto');
  if((bd.tech||0)<RULE.hardMinTechScore)reasons.push('teknik veto');
  if(room<RULE.hardMinTp2RoomR)reasons.push('TP2 alan veto');
  if(!v156StopOk(x,false))reasons.push('stop geometrisi veto');
  return {ok:reasons.length===0,reasons};
}
function v156BacktestMainOk(x){return v155BacktestMainOk(x)}
function v156TechMainOk(x){return v155TechMainOk(x)}
function v156StrongTechOk(x){return v155StrongTechOk(x)}
function v156NotChased(x){return v155NotChased(x)}
function v156RosterBand(x){
  const s=x?.stat||{}, bd=x?.scoreBreakdown||{}, room=x?.tp2RoomR||0, score=x?.selectorScore||0;
  const used=x?.usedK||0, fresh=used<=v156FreshLimit(x?.tf);
  if(!v156HardVeto(x).ok)return 'C';
  if(!fresh)return 'B+';
  const aplus=(s.count||0)>=RULE.aPlusMinTrades && (s.pf||0)>=RULE.aPlusMinPF && (s.win||0)>=RULE.aPlusMinWin && (s.fast||0)<=RULE.aPlusMaxFastStop && room>=RULE.aPlusMinTp2RoomR && (bd.execution||0)>=RULE.aPlusMinExecutionScore && (bd.backtest||0)>=RULE.aPlusMinBacktestScore && (bd.tech||0)>=RULE.aPlusMinTechScore && score>=RULE.eliteMinScore && v156StrongTechOk(x);
  if(aplus)return 'A+';
  const a=(s.count||0)>=RULE.aMinTrades && (s.pf||0)>=RULE.aMinPF && (s.win||0)>=RULE.aMinWin && (s.fast||0)<=RULE.aMaxFastStop && room>=RULE.aMinTp2RoomR && (bd.execution||0)>=RULE.aMinExecutionScore && (bd.backtest||0)>=RULE.aMinBacktestScore && (bd.tech||0)>=RULE.aMinTechScore && score>=RULE.championMinScore && v156TechMainOk(x) && v156EvidenceCount(x)>=6;
  if(a)return 'A';
  const aminus=(s.count||0)>=RULE.rosterMinTrades && (s.pf||0)>=RULE.rosterMinPF && (s.win||0)>=RULE.rosterMinWin && (s.fast||0)<=RULE.rosterMaxFastStop && room>=RULE.rosterMinTp2RoomR && (bd.execution||0)>=RULE.rosterMinExecutionScore && (bd.backtest||0)>=RULE.rosterMinBacktestScore && (bd.tech||0)>=RULE.rosterMinTechScore && score>=RULE.championMinScore && v156TechMainOk(x) && v156EvidenceCount(x)>=6;
  if(aminus)return 'A-';
  const reserve=(s.count||0)>=30 && (s.pf||0)>=1.70 && (s.win||0)>=52 && (s.fast||0)<=27 && room>=RULE.reserveMinTp2RoomR && (bd.execution||0)>=72 && (bd.backtest||0)>=66 && (bd.tech||0)>=56;
  if(reserve)return 'B+';
  return 'B';
}
function v154Grade(sel,sig,stat,tf,usedK=0){
  const temp={stat,scoreBreakdown:{tech:Math.round(sel.tech||0),execution:Math.round(sel.execution||0),backtest:Math.round(sel.stat||0),source:Math.round(sel.source||0)},tp2RoomR:sig?.tp2RoomR||0,stopPct:sig?.stopPct||0,selectorScore:Math.round(sel.score||0),usedK,tf,techDetail:sig?.techDetail||{},riskClass:'Dengeli',ageSec:0,sym:'TMPUSDT'};
  return v156RosterBand(temp);
}
function v155RosterBand(x){return v156RosterBand(x)}
function v156MainEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  const band=x.poolGrade||v156RosterBand(x);
  if(!['A+','A','A-'].includes(band))return false;
  if(!v156HardVeto(x).ok)return false;
  if(!v156StopOk(x,true))return false;
  if(!v156BacktestMainOk(x))return false;
  if(!v156TechMainOk(x))return false;
  if(!v156NotChased(x))return false;
  if(v156EvidenceCount(x)<6)return false;
  if(v156WeakDimensionCount(x)>0)return false;
  return true;
}
function v155MainEligible(x){return v156MainEligible(x)}
function v154MainEligible(x){return v156MainEligible(x)}
function v156ReserveEligible(x){
  if(!x||!validCandidateSymbol(x))return false;
  if(v156MainEligible(x))return false;
  if((x.ageSec||9999)>RULE.maxLiveAgeMs/1000)return false;
  if(x.riskClass==='Yüksek')return false;
  const s=x.stat||{}, bd=x.scoreBreakdown||{}, d=x.techDetail||{};
  if((x.selectorScore||0)<RULE.reserveMinScore)return false;
  if((x.tp2RoomR||0)<RULE.reserveMinTp2RoomR)return false;
  if(!v156StopOk(x,false))return false;
  if((s.count||0)<30 || (s.pf||0)<1.70 || (s.win||0)<52 || (s.fast||0)>27)return false;
  if((bd.backtest||0)<66 || (bd.execution||0)<72 || (bd.tech||0)<56)return false;
  if((d.loc?.score||0)<48 || (d.trig?.score||0)<44)return false;
  return true;
}
function v155ReserveEligible(x){return v156ReserveEligible(x)}
function v154ReserveEligible(x){return v156ReserveEligible(x)}
function v156ScorePenalty(sig,stat,sel,source,usedK,tf){return v155ScorePenalty(sig,stat,sel,source,usedK,tf)}
function buildCandidateForDir(sym,tf,b,dir){
  sym=cleanSymbol(sym); if(!sym||!b)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  let sig=null,usedK=0;
  for(let k=0;k<=7;k++){
    const s=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(!s)continue;
    const driftPct=Math.abs(last.close-s.entry)/Math.max(Math.abs(s.entry),1)*100;
    const driftAtr=Math.abs(last.close-s.entry)/Math.max(last.atr||0,1e-9);
    if(driftPct<=RULE.maxEntryDriftPct&&driftAtr<=RULE.maxEntryDriftAtr){sig=s;usedK=k;break;}
  }
  if(!sig)return null;
  const stat=v152SafeStat((b.stats||[]).find(s=>String(s.model||'').includes(dir)),dir);
  const source=sourceMap[key]||'Taze veri';
  const sel=v152SelectorScore(sig,stat,source,usedK,tf);
  if(sel.score<RULE.poolMinScore)return null;
  const conf=v152Confidence(sel,stat,source),lev=leverage(sig,conf),rClass=riskClass(sig.stopPct,lev.lev);
  if(sig.stopPct>RULE.maxStopPct||rClass==='Yüksek')return null;
  const grade=v156RosterBand({stat,scoreBreakdown:{tech:Math.round(sel.tech),execution:Math.round(sel.execution),backtest:Math.round(sel.stat),source:Math.round(sel.source)},tp2RoomR:sig.tp2RoomR,stopPct:sig.stopPct,selectorScore:Math.round(sel.score),usedK,tf,techDetail:sig.techDetail,riskClass:rClass,ageSec:Math.max(0,Math.round(ageMs/1000)),sym});
  const notes=['geniş havuzdan geldi','v15.6 eşit seçici'];
  if(grade==='A+'||grade==='A'||grade==='A-')notes.push('ana teknik kadro'); else if(grade==='B+')notes.push('yedek/izleme'); else notes.push('havuz dışı kalite');
  if(usedK>0)notes.push(`${usedK} mum önce tetik`);
  notes.push(...sel.notes.slice(0,3));
  const obj={sym,tf,model:'v15.6 Eşit Kalite '+dir,sub:sig.sub,dir:sig.dir,conf,rawConf:Math.round(sel.score),cap:conf,capNotes:[...new Set(notes)],riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,tp2RoomR:sig.tp2RoomR,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source,liveOnly:stat.count<1,stale:false,selectorScore:Math.round(sel.score),poolGrade:grade,usedK,scoreBreakdown:{tech:Math.round(sel.tech),execution:Math.round(sel.execution),backtest:Math.round(sel.stat),source:Math.round(sel.source)}};
  return adjustRiskConfidence(obj);
}
function candidateRank(a,b){
  const gradeW={'A+':520,'A':440,'A-':360,'B+':150,'B':40,'C':0};
  const ga=gradeW[a.poolGrade]||0, gb=gradeW[b.poolGrade]||0; if(gb!==ga)return gb-ga;
  const sa=b.selectorScore||b.qualityScore||b.conf||0, sb=a.selectorScore||a.qualityScore||a.conf||0; if(Math.abs(sa-sb)>0.001)return sa-sb;
  const ba=(b.scoreBreakdown?.backtest||0)-(a.scoreBreakdown?.backtest||0); if(ba)return ba;
  const ea=(b.scoreBreakdown?.execution||0)-(a.scoreBreakdown?.execution||0); if(ea)return ea;
  const ta=(b.scoreBreakdown?.tech||0)-(a.scoreBreakdown?.tech||0); if(ta)return ta;
  const fast=(a.stat?.fast||0)-(b.stat?.fast||0); if(Math.abs(fast)>0.01)return fast;
  return ((b.tp2RoomR||0)-(a.tp2RoomR||0)) || sourcePriority(b.source)-sourcePriority(a.source) || (a.stopPct||0)-(b.stopPct||0);
}
function rankedList(dir,limit=7){
  const all=candidates.filter(x=>x&&x.dir===dir&&v156MainEligible(x));
  return v152UniqueTop(all.sort(candidateRank),limit);
}
function reserveList(dir,limit=10){
  const mainKeys=new Set(rankedList(dir,999).map(x=>x.sym+'|'+x.dir));
  const all=candidates.filter(x=>x&&x.dir===dir&&!mainKeys.has(x.sym+'|'+x.dir)&&v156ReserveEligible(x));
  return v152UniqueTop(all.sort(candidateRank),limit);
}
function countByDir(dir){return rankedList(dir,999).length}
function firstAutoCandidateIndex(){const x=rankedList('LONG',1)[0]||rankedList('SHORT',1)[0]||reserveList('LONG',1)[0]||reserveList('SHORT',1)[0];return x?candidates.indexOf(x):-1}
function v156RejectStats(dir){
  const arr=candidates.filter(x=>x&&x.dir===dir), rejected=arr.filter(x=>!v156MainEligible(x));
  return {all:arr.length,rejected:rejected.length,badBt:rejected.filter(x=>(x.scoreBreakdown?.backtest||0)<RULE.rosterMinBacktestScore||(x.stat?.pf||0)<RULE.rosterMinPF||(x.stat?.win||0)<RULE.rosterMinWin).length,badTech:rejected.filter(x=>!v156TechMainOk(x)).length,badTp:rejected.filter(x=>(x.tp2RoomR||0)<RULE.mainMinTp2RoomR).length,oldTrig:rejected.filter(x=>(x.usedK||0)>v156FreshLimit(x.tf)).length};
}
function renderList(){
  const box=$('list'),longs=rankedList('LONG',7),shorts=rankedList('SHORT',7),longRes=reserveList('LONG',8),shortRes=reserveList('SHORT',8);
  const poolLong=candidates.filter(x=>x&&x.dir==='LONG').length,poolShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const elite=candidates.filter(x=>x&&(x.poolGrade==='A+'||x.poolGrade==='A'||x.poolGrade==='A-')).length;
  const rL=v156RejectStats('LONG'),rS=v156RejectStats('SHORT');
  const summary=`<div class="dash"><div><b>${poolLong}</b><span>LONG havuz</span></div><div><b>${poolShort}</b><span>SHORT havuz</span></div><div><b>${longs.length}</b><span>ana LONG</span></div><div><b>${shorts.length}</b><span>ana SHORT</span></div><div><b>${longRes.length}+${shortRes.length}</b><span>yedek izleme</span></div><div><b>${elite}</b><span>A-/A/A+ havuz</span></div></div>
  <div class="note"><b>v15.6 Eşit Kalite Motoru:</b> LONG ve SHORT aynı teknik kalite anayasasından geçer. Spot/vadeli uygulanabilirlik kalite puanına katılmaz. Seçim sırası iki yönde de aynıdır: ölümcül veto → backtest sağlık → giriş/stop/TP2 icrası → teknik bağlam → veri/tetik tazeliği. LONG eleme: ${rL.rejected}/${rL.all} | SHORT eleme: ${rS.rejected}/${rS.all}</div>`;
  const dirPill=x=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${x.dir} TEKNİK ADAY</span>`;
  const card=(x,i)=>{const idx=candidates.indexOf(x),bd=x.scoreBreakdown||{};const bt=`İşlem ${x.stat.count||0} | Win ${pct(x.stat.win||0,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)} | Hızlı stop ${pct(x.stat.fast||0,1)}`;const band=`<span class="pill ${x.poolGrade==='A+'?'green':x.poolGrade==='A'?'blue':x.poolGrade==='A-'?'amber':'gray'}">${v156BandLabel(x)}</span>`;return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.selectorScore}<br><span style="font-size:15px">PUAN</span></div></div><div class="line">Kalite: <b>${x.poolGrade}</b> | ${v156BandLabel(x)} | Güven: ${x.conf}% | Tetik: ${x.usedK||0} mum<br>Skor: Teknik ${bd.tech||'-'} / İcra ${bd.execution||'-'} / Backtest ${bd.backtest||'-'} / Veri ${bd.source||'-'}<br>Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source}<br>Teknik: ${(x.why||[]).join(' + ')}</div><div>${dirPill(x)}${band}<span class="pill blue">v15.6 eşit kalite</span>${(x.capNotes||[]).slice(0,4).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc,empty)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):empty}</div>`;
  box.innerHTML=summary+
    section('En İyi 7 LONG — Ana Teknik Kadro',longs,'LONG','A+/A/A- kalite. SHORT ile aynı teknik standarttan geçer.','<p>LONG havuz var ama ana teknik kadro standardını geçen aday yok.</p>')+
    section('En İyi 7 SHORT — Ana Teknik Kadro',shorts,'SHORT','A+/A/A- kalite. LONG ile aynı teknik standarttan geçer.','<p>SHORT havuz var ama ana teknik kadro standardını geçen aday yok.</p>')+
    section('Yedek LONG İzleme Havuzu',longRes,'LONG','B+ kalite: takip edilir ama ana işlem kadrosu değildir.','<p>Yedek LONG yok.</p>')+
    section('Yedek SHORT İzleme Havuzu',shortRes,'SHORT','B+ kalite: takip edilir ama ana işlem kadrosu değildir.','<p>Yedek SHORT yok.</p>');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  const bd=x.scoreBreakdown||{},d=x.techDetail||{};
  const status=v156MainEligible(x)?v156BandLabel(x):'YEDEK / İZLEME';
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} ${status} — PUAN ${x.selectorScore} / ${x.poolGrade}`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Yön',`${x.dir} teknik işlem`)+metric('Kalite sınıfı',x.poolGrade||'-')+metric('Kadro durumu',status)+metric('Kadro puanı',x.selectorScore||'-')+metric('Teknik / İcra',`${bd.tech||'-'} / ${bd.execution||'-'}`)+metric('Backtest / Veri',`${bd.backtest||'-'} / ${bd.source||'-'}`)+metric('Model',x.model+(x.sub?' — '+x.sub:''))+metric('Canlı veri',`${x.ageSec} sn`)+metric('Tetik yaşı',`${x.usedK||0} mum`)+metric('Mum/Fiyat kaynağı',`${x.candleSource||x.source} / ${x.priceSource||x.source}`)+metric('Risk sınıfı',x.riskClass)+metric('Güven',`${x.conf}%`)+metric('Trend / MTF',`${fmt(d.trend?.score||0,0)} / ${fmt(d.mtf?.score||0,0)}`)+metric('Yapı / Lokasyon',`${fmt(d.st?.score||0,0)} / ${fmt(d.loc?.score||0,0)}`)+metric('Momentum / Para akışı',`${fmt(d.mom?.score||0,0)} / ${fmt(d.flow?.score||0,0)}`)+metric('Tetik / Volatilite',`${fmt(d.trig?.score||0,0)} / ${fmt(d.vol?.score||0,0)}`)+metric('TP2 alanı',`${fmt(x.tp2RoomR||0,2)}R`)+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('Referans tutar',fmt(RULE.spotTry,0)+' TL')+metric('Risk',dualMoney(x.lev.riskD))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=(x.why||[]).map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win||0,1)}</span><span class="pill blue">PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast||0,1)}</span><span class="pill blue">MFE/MAE ${fmt(x.stat.avgMfe||0,2)}R / ${fmt(x.stat.avgMae||0,2)}R</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,8).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden işlem planı girme.';
  if(!v156MainEligible(x))return `<b>YEDEK / İZLEME</b><div class="tryline">Bu aday ana kadro kalitesinde değil. İşlem açma; sadece takip et. Ana kadro için en az A- standardı, sağlam backtest, taze tetik, TP2 alanı, stop kalitesi ve teknik bağlam birlikte geçmelidir.</div>`;
  const entryTL=x.entry*fx.rate, riskTry=RULE.spotTry*(x.stopPct/100);
  const isLong=x.dir==='LONG';
  const p1=RULE.spotTry*(isLong?((x.t1-x.entry)/x.entry):((x.entry-x.t1)/x.entry));
  const p2=RULE.spotTry*(isLong?((x.t2-x.entry)/x.entry):((x.entry-x.t2)/x.entry));
  const p3=RULE.spotTry*(isLong?((x.t3-x.entry)/x.entry):((x.entry-x.t3)/x.entry));
  return `<b>${x.dir} TEKNİK ANA KADRO — v15.6</b><div class="tryline">Bu plan yalnız teknik kalite planıdır. Hangi piyasada uygulanacağı kullanıcı tercihidir; kalite hesabına spot/vadeli ayrımı katılmaz.</div><div class="tryline">Giriş referansı: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2: ${tlInput(x.t2)} TL.</div><div class="tryline"><b>Güvenli kullanım:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan kısmı TP2’ye taşı.</div><div class="tryline">Referans ${fmt(RULE.spotTry,0)} TL için tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
}
function renderBacktest(x){
  if(x.liveOnly){
    $('bt').innerHTML=`<div class="grid">${metric('Durum','Canlı bağlam')}${metric('Backtest',x.contextFallback?'Bağlam adayı':'Yeterli örnek yok')}${metric('Güven',pct(x.conf,0))}${metric('RR',fmt(x.rr,2))}${metric('Stop',pct(x.stopPct,2))}${metric('Risk sınıfı',x.riskClass)}</div><div class="note">Bu aday yalnızca taze veriyle üretildi. Backtest örneklemi yetersizse canlı bağlam motoru devrededir.</div>`;
    return;
  }
  const trs=(x.stat.trades||[]).slice(-10).reverse();
  $('bt').innerHTML=`<div class="grid">${metric('İşlem',x.stat.count)}${metric('Win',pct(x.stat.win,1))}${metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf,2))}${metric('Net',dualMoney(x.stat.net))}${metric('MFE/MAE',`${fmt(x.stat.avgMfe,2)}R / ${fmt(x.stat.avgMae,2)}R`)}${metric('Hızlı stop',pct(x.stat.fast,1))}</div><h3>Son işlemler</h3><div class="lastRows">${trs.map(t=>`<div class="tradeRow"><div>${t.date}</div><div>${t.dir}</div><div>${t.exit}</div><div>${fmt(t.mfe,2)}R/${fmt(t.mae,2)}R</div></div>`).join('')}</div><div class="note">Bu plan otomatik üretilir. LONG ve SHORT aynı teknik kalite standardıyla değerlendirilir. Geçmiş backtest geleceği garanti etmez; işlem öncesi canlı fiyat ve risk tekrar kontrol edilmelidir.</div>`;
}
async function scanAll(){
  setMeta('v15.6 Eşit LONG/SHORT Kalite taraması başladı: genel motor iki yönü aynı standartla seçiyor...');
  candidates=[]; scanLog.lowQuality=0; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue;} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=235&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const dir of ['LONG','SHORT']){const cand=buildCandidateForDir(s,tf,b,dir); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%8===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15.6 havuz ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} | Ana: ${rankedList('LONG',7).length}+${rankedList('SHORT',7).length} | Yedek: ${reserveList('LONG',99).length}+${reserveList('SHORT',99).length}`); await delay(16);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | LONG havuz ${candidates.filter(x=>x.dir==='LONG').length} / ana ${rankedList('LONG',7).length} / yedek ${reserveList('LONG',99).length} | SHORT havuz ${candidates.filter(x=>x.dir==='SHORT').length} / ana ${rankedList('SHORT',7).length} / yedek ${reserveList('SHORT',99).length} | v15.6 Eşit LONG/SHORT Kalite Motoru aktif`);
}

/* ============================================================
   v15.7 TAM TEKNIK GENEL HAVUZ MOTORU
   Amaç: Genel havuza LONG/SHORT adayları aynı standartla, 12+ teknik katmandan geçirerek almak.
   Milli takım seçici aynı kalır; önce havuz kalitesini güçlendirir.
============================================================ */
Object.assign(RULE,{
  poolMinScore:57,
  minPoolLayers:7,
  minCoreLayers:4,
  maxEntryDriftPct:1.15,
  maxEntryDriftAtr:1.45,
  minTp2RoomR:1.20,
  reserveMinTp2RoomR:1.50,
  mainMinTp2RoomR:1.75,
  maxStopPct:3.75,
  maxMainStopPct:3.15
});
function v157Clip(n,a=0,b=100){return Math.max(a,Math.min(b,Number(n)||0));}
function v157Avg(arr){const v=arr.filter(x=>isFinite(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;}
function v157Body(c,i){return v151Bar(c,i);}
function v157RecentLevelTouches(c,i,level,kind,len=80){
  const a=(c[i].atr||c[i].high-c[i].low||1), tol=a*.45; let touches=0,last=-999,vol=0;
  for(let j=Math.max(2,i-len);j<=i;j++){
    const hit=kind==='sup'?Math.abs(c[j].low-level)<=tol:Math.abs(c[j].high-level)<=tol;
    if(hit&&j-last>2){touches++;last=j;vol+=c[j].volume||0;}
  }
  return {touches,volAvg:touches?vol/touches:0};
}
function v157SupportResistanceScore(c,i,dir,st){
  const x=c[i],a=x.atr||x.high-x.low||1;
  const supLevels=[st.pivotSup,x.sup34,x.sup,lo(c,i,144)].filter(isFinite).map(Number);
  const resLevels=[st.pivotRes,x.res34,x.res,hi(c,i,144)].filter(isFinite).map(Number);
  const sup=supLevels.filter(v=>v<=x.close+a*1.4).sort((p,q)=>Math.abs(x.close-p)-Math.abs(x.close-q))[0]||x.sup34;
  const res=resLevels.filter(v=>v>=x.close-a*1.4).sort((p,q)=>Math.abs(x.close-p)-Math.abs(x.close-q))[0]||x.res34;
  const sTouch=v157RecentLevelTouches(c,i,sup,'sup'), rTouch=v157RecentLevelTouches(c,i,res,'res');
  const distSup=Math.abs(x.close-sup)/a, distRes=Math.abs(res-x.close)/a;
  const brokeSup=x.close<sup-a*.15, brokeRes=x.close>res+a*.15;
  const retestLong=!brokeRes&&x.low<=sup+a*.75&&x.close>=sup-a*.10;
  const retestShort=!brokeSup&&x.high>=res-a*.75&&x.close<=res+a*.10;
  let score=45,labels=[];
  if(dir==='LONG'){
    if(distSup<=1.25){score+=22;labels.push('destek yakın');}
    if(sTouch.touches>=2){score+=10;labels.push('çok dokunuşlu destek');}
    if(retestLong){score+=13;labels.push('destek retest');}
    if(distRes>=1.8){score+=12;labels.push('direnç boşluğu');} else if(distRes<.9)score-=18;
    if(brokeSup)score-=20;
  }else{
    if(distRes<=1.25){score+=22;labels.push('direnç yakın');}
    if(rTouch.touches>=2){score+=10;labels.push('çok dokunuşlu direnç');}
    if(retestShort){score+=13;labels.push('direnç retest');}
    if(distSup>=1.8){score+=12;labels.push('destek boşluğu');} else if(distSup<.9)score-=18;
    if(brokeRes)score-=20;
  }
  return {ok:score>=56,score:v157Clip(score),labels,sup,res,distSup,distRes};
}
function v157Fvg(c,i,dir){
  let found=false,near=false,age=99,kind=''; const x=c[i],a=x.atr||x.high-x.low||1;
  for(let j=Math.max(2,i-20);j<=i;j++){
    const bull=c[j-2]&&c[j-2].high<c[j].low; const bear=c[j-2]&&c[j-2].low>c[j].high;
    if(dir==='LONG'&&bull){found=true; kind='bullish FVG'; age=i-j; if(x.low<=c[j-2].high+a*.65&&x.close>=c[j-2].high-a*.15)near=true;}
    if(dir==='SHORT'&&bear){found=true; kind='bearish FVG'; age=i-j; if(x.high>=c[j-2].low-a*.65&&x.close<=c[j-2].low+a*.15)near=true;}
  }
  return {found,near,age,kind};
}
function v157OrderBlock(c,i,dir){
  const x=c[i],a=x.atr||x.high-x.low||1; let found=false,near=false,zone=null,age=99;
  for(let j=i-3;j>=Math.max(5,i-32);j--){
    const b=v157Body(c,j), n=c[j+1]||c[j];
    const impulseUp=n.close>n.open && (n.close-n.open)>a*.45 && n.close>c[j].high;
    const impulseDn=n.close<n.open && (n.open-n.close)>a*.45 && n.close<c[j].low;
    if(dir==='LONG' && c[j].close<c[j].open && impulseUp){found=true;zone={lo:c[j].low,hi:c[j].open};age=i-j;if(x.low<=zone.hi+a*.55&&x.close>=zone.lo-a*.15)near=true;break;}
    if(dir==='SHORT' && c[j].close>c[j].open && impulseDn){found=true;zone={lo:c[j].open,hi:c[j].high};age=i-j;if(x.high>=zone.lo-a*.55&&x.close<=zone.hi+a*.15)near=true;break;}
  }
  return {found,near,zone,age};
}
function v157SmcScore(c,i,dir,st,loc){
  const fvg=v157Fvg(c,i,dir), ob=v157OrderBlock(c,i,dir), x=c[i];
  const choch=dir==='LONG'?st.ms.chochUp:st.ms.chochDown;
  const bos=dir==='LONG'?st.brokeUp:st.brokeDn;
  const sweep=dir==='LONG'?st.sweepLow:st.sweepHigh;
  const breaker=dir==='LONG'?(st.ms.lastHigh&&x.low<=st.ms.lastHigh.v+(x.atr||1)*.45&&x.close>st.ms.lastHigh.v): (st.ms.lastLow&&x.high>=st.ms.lastLow.v-(x.atr||1)*.45&&x.close<st.ms.lastLow.v);
  let score=38,labels=[];
  if(bos){score+=18;labels.push('BOS');}
  if(choch){score+=18;labels.push('CHOCH');}
  if(sweep){score+=18;labels.push('sweep');}
  if(fvg.near){score+=14;labels.push(fvg.kind);} else if(fvg.found)score+=6;
  if(ob.near){score+=15;labels.push(dir==='LONG'?'bullish OB':'bearish OB');} else if(ob.found)score+=6;
  if(breaker){score+=10;labels.push('breaker/retest');}
  return {ok:score>=56,score:v157Clip(score),labels,fvg,ob,bos,choch,sweep,breaker};
}
function v157LiquidityScore(c,i,dir,st){
  const x=c[i],p=c[i-1]||x,a=x.atr||x.high-x.low||1;
  const lowA=lo(c,i-1,18), lowB=lo(c,i-19,18), highA=hi(c,i-1,18), highB=hi(c,i-19,18);
  const eqLow=Math.abs(lowA-lowB)<=a*.35, eqHigh=Math.abs(highA-highB)<=a*.35;
  const sweepLow=x.low<lowA-a*.05&&x.close>lowA-a*.12;
  const sweepHigh=x.high>highA+a*.05&&x.close<highA+a*.12;
  const reclaimLong=(x.close>p.high)||(sweepLow&&x.close>x.open);
  const reclaimShort=(x.close<p.low)||(sweepHigh&&x.close<x.open);
  let score=44,labels=[];
  if(dir==='LONG'){
    if(eqLow){score+=10;labels.push('equal lows');}
    if(sweepLow||st.sweepLow){score+=26;labels.push('alt likidite sweep');}
    if(reclaimLong){score+=14;labels.push('reclaim');}
    if(eqHigh)score+=5;
  }else{
    if(eqHigh){score+=10;labels.push('equal highs');}
    if(sweepHigh||st.sweepHigh){score+=26;labels.push('üst likidite sweep');}
    if(reclaimShort){score+=14;labels.push('reclaim');}
    if(eqLow)score+=5;
  }
  return {ok:score>=54,score:v157Clip(score),labels,eqLow,eqHigh,sweepLow,sweepHigh};
}
function v157SupplyDemandScore(c,i,dir){
  const x=c[i],a=x.atr||x.high-x.low||1; let zone=null,age=99,near=false,impulse=false;
  for(let j=i-4;j>=Math.max(5,i-45);j--){
    const n1=c[j+1],n2=c[j+2]||n1;
    const upImp=(Math.max(n1.close,n2.close)-c[j].low)>a*1.45 && n1.close>n1.open;
    const dnImp=(c[j].high-Math.min(n1.close,n2.close))>a*1.45 && n1.close<n1.open;
    if(dir==='LONG'&&c[j].close<c[j].open&&upImp){zone={lo:c[j].low,hi:Math.max(c[j].open,c[j].close)};age=i-j;impulse=true;near=x.low<=zone.hi+a*.70&&x.close>=zone.lo-a*.18;break;}
    if(dir==='SHORT'&&c[j].close>c[j].open&&dnImp){zone={lo:Math.min(c[j].open,c[j].close),hi:c[j].high};age=i-j;impulse=true;near=x.high>=zone.lo-a*.70&&x.close<=zone.hi+a*.18;break;}
  }
  let score=42,labels=[];
  if(impulse){score+=18;labels.push(dir==='LONG'?'demand':'supply');}
  if(near){score+=25;labels.push('kurumsal bölge');}
  if(age<=12)score+=6;
  return {ok:score>=55,score:v157Clip(score),labels,zone,age,near};
}
function v157ChannelScore(c,i,dir){
  const x=c[i],a=x.atr||x.high-x.low||1; const len=55;
  const lowNow=lo(c,i,len), highNow=hi(c,i,len), lowOld=lo(c,Math.max(0,i-len),len), highOld=hi(c,Math.max(0,i-len),len);
  const mid=(lowNow+highNow)/2, width=Math.max(highNow-lowNow,a);
  const slope=(mid-((lowOld+highOld)/2))/Math.max(mid,1e-9)*100;
  const nearLower=(x.low-lowNow)/width<.28, nearUpper=(highNow-x.high)/width<.28;
  const reclaimMid=x.close>mid&&c[i-1].close<=mid, loseMid=x.close<mid&&c[i-1].close>=mid;
  let score=45,labels=[];
  if(dir==='LONG'){
    if(nearLower){score+=18;labels.push('kanal altı');}
    if(slope>=-.20)score+=10; else score-=6;
    if(reclaimMid){score+=14;labels.push('orta bant reclaim');}
    if(x.close>highNow-a*.15)score+=8;
  }else{
    if(nearUpper){score+=18;labels.push('kanal üstü');}
    if(slope<=.20)score+=10; else score-=6;
    if(loseMid){score+=14;labels.push('orta bant kaybı');}
    if(x.close<lowNow+a*.15)score+=8;
  }
  return {ok:score>=53,score:v157Clip(score),labels,slope,nearLower,nearUpper,mid,low:lowNow,high:highNow};
}
function v157CandleScore(c,i,dir){
  const x=c[i],p=c[i-1]||x,p2=c[i-2]||p,b=v157Body(c,i); let score=42,labels=[];
  const bullEng=x.close>x.open&&p.close<p.open&&x.close>=p.open&&x.open<=p.close;
  const bearEng=x.close<x.open&&p.close>p.open&&x.close<=p.open&&x.open>=p.close;
  const hammer=b.lowerPct>=.40&&b.bodyPct<=.45&&x.close>=x.open;
  const shooting=b.upperPct>=.40&&b.bodyPct<=.45&&x.close<=x.open;
  const morning=p2.close<p2.open&&Math.abs(p.close-p.open)<(p.high-p.low)*.35&&x.close>x.open&&x.close>(p2.open+p2.close)/2;
  const evening=p2.close>p2.open&&Math.abs(p.close-p.open)<(p.high-p.low)*.35&&x.close<x.open&&x.close<(p2.open+p2.close)/2;
  const strong=dir==='LONG'?(x.close>x.open&&b.bodyPct>=.45):(x.close<x.open&&b.bodyPct>=.45);
  if(dir==='LONG'){
    if(bullEng){score+=24;labels.push('bullish engulfing');}
    if(hammer){score+=20;labels.push('hammer/fitil');}
    if(morning){score+=18;labels.push('morning star');}
    if(strong){score+=12;labels.push('güçlü kapanış');}
    if(x.close>p.high){score+=12;labels.push('önceki tepe üstü');}
  }else{
    if(bearEng){score+=24;labels.push('bearish engulfing');}
    if(shooting){score+=20;labels.push('shooting/fitil');}
    if(evening){score+=18;labels.push('evening star');}
    if(strong){score+=12;labels.push('güçlü kapanış');}
    if(x.close<p.low){score+=12;labels.push('önceki dip altı');}
  }
  return {ok:score>=55,score:v157Clip(score),labels};
}
function v157VolumeQualityScore(c,i,dir){
  const x=c[i],p=c[i-1]||x,base=x.v20||1,vr=x.volume/base; let score=44,labels=[];
  const up=x.close>x.open, dn=x.close<x.open;
  if(vr>=1.4){score+=24;labels.push('hacim güçlü');} else if(vr>=1.0){score+=12;labels.push('hacim yeterli');} else if(vr<.55)score-=14;
  if(dir==='LONG'){
    if(up&&x.close>=p.close){score+=12;labels.push('alıcı mum');}
    if(x.cmf>=.03){score+=10;labels.push('CMF pozitif');}
    if(x.obvSlope>0){score+=10;labels.push('OBV yukarı');}
    if(dn&&vr>=1.3)score-=12;
  }else{
    if(dn&&x.close<=p.close){score+=12;labels.push('satıcı mum');}
    if(x.cmf<=-.03){score+=10;labels.push('CMF negatif');}
    if(x.obvSlope<0){score+=10;labels.push('OBV aşağı');}
    if(up&&vr>=1.3)score-=12;
  }
  return {ok:score>=54,score:v157Clip(score),labels,volRatio:vr};
}
function v157TechGate(c,i,dir,sym,tf){
  if(i<210)return null;
  const trend=v151TrendScore(c,i,dir), mtf=v151MtfScore(sym,tf,dir), st=v151StructureScore(c,i,dir), loc=v151LocationScore(c,i,dir,st);
  const smc=v157SmcScore(c,i,dir,st,loc), sr=v157SupportResistanceScore(c,i,dir,st), liq=v157LiquidityScore(c,i,dir,st), sd=v157SupplyDemandScore(c,i,dir), channel=v157ChannelScore(c,i,dir);
  const mom=v151MomentumScore(c,i,dir), flow=v151FlowScore(c,i,dir), candle=v157CandleScore(c,i,dir), volumeQual=v157VolumeQualityScore(c,i,dir), trig=v151TriggerScore(c,i,dir), vol=v151VolScore(c,i,dir,loc,st);
  const plan=v151Plan(c,i,dir,st,sym,tf), room=v151Room(c,i,dir,plan.entry,plan.r,st);
  const stopIdeal=plan.stopPct>=minStopPctFor(sym,tf)*.96 && plan.stopPct<=3.10;
  const riskScore=v157Clip(52+(stopIdeal?20:-10)+(room.roomR>=1.8?18:room.roomR>=1.2?8:-18)-(loc.chase?22:0));
  const layerList=[trend,mtf,st,smc,sr,sd,liq,loc,mom,flow,volumeQual,candle,trig,vol,{score:room.score,ok:room.roomR>=1.05},{score:riskScore,ok:riskScore>=55},channel];
  const layersOk=layerList.filter(o=>(o?.score||0)>=54||o?.ok).length;
  const coreOk=[trend,st,smc,sr,loc,mom,flow,trig].filter(o=>(o?.score||0)>=54||o?.ok).length;
  const total=v157Clip(
    trend.score*.075 + mtf.score*.065 + st.score*.085 + smc.score*.105 + sr.score*.095 + sd.score*.075 + liq.score*.075 + loc.score*.075 + mom.score*.060 + flow.score*.055 + volumeQual.score*.060 + candle.score*.055 + trig.score*.055 + vol.score*.040 + channel.score*.040 + room.score*.045 + riskScore*.040
  );
  const reasons=[];
  const add=(cond,name)=>{if(cond)reasons.push(name)};
  add(trend.score>=54,'trend'); add(mtf.score>=54,'üst zaman'); add(st.score>=54,'piyasa yapısı'); add(smc.score>=54,'Smart Money'); add(sr.score>=54,'destek/direnç'); add(sd.score>=54,'supply/demand'); add(liq.score>=54,'likidite'); add(loc.score>=54,'lokasyon'); add(mom.score>=54,'momentum'); add(flow.score>=54,'para akışı'); add(volumeQual.score>=54,'hacim'); add(candle.score>=54,'mum formasyonu'); add(trig.score>=54,'tetik'); add(vol.score>=48,'volatilite'); add(room.roomR>=1.05,'hedef alanı');
  const labels=[...new Set([...(loc.labels||[]),...(smc.labels||[]),...(sr.labels||[]),...(liq.labels||[]),...(sd.labels||[]),...(channel.labels||[]),...(candle.labels||[])])];
  let hard=false,hardNotes=[];
  if(trend.bad&&st.hard&&mtf.hard){hard=true;hardNotes.push('trend+yapı+üst zaman ters');}
  if(loc.chase&&room.roomR<1.35){hard=true;hardNotes.push('giriş kaçmış');}
  if(plan.stopPct>RULE.maxStopPct){hard=true;hardNotes.push('stop çok geniş');}
  if(room.roomR<.90){hard=true;hardNotes.push('TP alanı yok');}
  if(layersOk<6){hard=true;hardNotes.push('teknik katman yetersiz');}
  if(coreOk<3){hard=true;hardNotes.push('çekirdek bağlam yetersiz');}
  if(vol.flat&&loc.labels.length===0&&smc.labels.length===0){hard=true;hardNotes.push('yatay piyasa + bağlam yok');}
  const rr1=1.10,rr2=Math.max(1.80,Math.min(2.35,room.roomR*.82)),rr3=Math.max(2.45,Math.min(3.25,room.roomR*1.05));
  let t1=dir==='LONG'?plan.entry+plan.r*rr1:plan.entry-plan.r*rr1;
  let t2=dir==='LONG'?plan.entry+plan.r*rr2:plan.entry-plan.r*rr2;
  let t3=dir==='LONG'?plan.entry+plan.r*rr3:plan.entry-plan.r*rr3;
  if(dir==='LONG'&&isFinite(room.nearest)){t2=Math.min(t2,room.nearest-plan.r*.10);t3=Math.min(t3,room.nearest+plan.r*.22);} 
  if(dir==='SHORT'&&isFinite(room.nearest)){t2=Math.max(t2,room.nearest+plan.r*.10);t3=Math.max(t3,room.nearest-plan.r*.22);} 
  const q=v157Clip(total-(hard?38:0));
  const ok=!hard && q>=RULE.poolMinScore && layersOk>=RULE.minPoolLayers && reasons.length>=7;
  return {ok,q,dir,entry:plan.entry,stop:plan.stop,t1,t2,t3,stopPct:plan.stopPct,rr:rr1,room,reasons,sub:labels,hardNotes,layersOk,coreOk,detail:{trend,mtf,st,smc,sr,sd,liq,loc,mom,flow,volumeQual,candle,trig,vol,channel,room,riskScore,total,layersOk,coreOk}};
}
function signalForSymbol(c,i,model,sym,tf){
  const dir=model.includes('LONG')?'LONG':'SHORT';
  const g=v157TechGate(c,i,dir,sym,tf);
  if(!g||!g.ok)return null;
  return {model:'v15.7 Tam Teknik Havuz '+dir,sub:g.sub.slice(0,5).join(' + ')||'12 katman teknik havuz',dir,entry:g.entry,stop:g.stop,t1:g.t1,t2:g.t2,t3:g.t3,atr:c[i].atr||0,stopPct:g.stopPct,rr:g.rr,why:g.reasons,q:g.q,techDetail:g.detail,tp2RoomR:g.room.roomR,hardNotes:g.hardNotes||[],layersOk:g.layersOk,coreOk:g.coreOk};
}
function signal(c,i,model){return signalForSymbol(c,i,model,'BTCUSDT','15m');}
function v157EvidenceCount(x){
  const d=x?.techDetail||{};
  const arr=[d.trend,d.mtf,d.st,d.smc,d.sr,d.sd,d.liq,d.loc,d.mom,d.flow,d.volumeQual,d.candle,d.trig,d.vol,d.channel];
  return arr.filter(o=>(o?.score||0)>=54||o?.ok).length + ((x?.tp2RoomR||0)>=RULE.rosterMinTp2RoomR?1:0);
}
function v156EvidenceCount(x){return v157EvidenceCount(x)}
function v155EvidenceCount(x){return v157EvidenceCount(x)}
function v157TechMainOk(x){
  const d=x?.techDetail||{}, bd=x?.scoreBreakdown||{};
  if((bd.tech||0)<RULE.rosterMinTechScore)return false;
  if((bd.execution||0)<RULE.rosterMinExecutionScore)return false;
  if((d.loc?.score||0)<RULE.minMainLocScore)return false;
  if((d.trig?.score||0)<RULE.minMainTrigScore)return false;
  if((d.st?.score||0)<RULE.minMainStructScore)return false;
  if((d.mom?.score||0)<RULE.minMainMomScore)return false;
  if((d.flow?.score||0)<RULE.minMainFlowScore)return false;
  if((d.mtf?.score||0)<RULE.minMainMtfScore)return false;
  if((d.trend?.score||0)<RULE.minMainTrendScore)return false;
  const smcOk=(d.smc?.score||0)>=54, srOk=(d.sr?.score||0)>=54, liqOk=(d.liq?.score||0)>=52, sdOk=(d.sd?.score||0)>=52, candleOk=(d.candle?.score||0)>=52, volumeOk=(d.volumeQual?.score||0)>=52;
  if([smcOk,srOk,liqOk,sdOk,candleOk,volumeOk].filter(Boolean).length<3)return false;
  return true;
}
function v156TechMainOk(x){return v157TechMainOk(x)}
function v155TechMainOk(x){return v157TechMainOk(x)}
function v157StrongTechOk(x){
  const d=x?.techDetail||{}, bd=x?.scoreBreakdown||{};
  return (bd.tech||0)>=RULE.aMinTechScore && (bd.execution||0)>=RULE.aMinExecutionScore && v157EvidenceCount(x)>=10 &&
    (d.smc?.score||0)>=60 && (d.sr?.score||0)>=60 && (d.loc?.score||0)>=RULE.strongLocScore &&
    (d.trig?.score||0)>=RULE.strongTrigScore && (d.st?.score||0)>=RULE.strongStructScore &&
    (d.mom?.score||0)>=RULE.strongMomScore && (d.flow?.score||0)>=RULE.strongFlowScore;
}
function v156StrongTechOk(x){return v157StrongTechOk(x)}
function v155StrongTechOk(x){return v157StrongTechOk(x)}
function v157PoolGrade(x){
  const ev=v157EvidenceCount(x), s=x?.selectorScore||0;
  if(ev>=11&&s>=76)return 'H1';
  if(ev>=8&&s>=62)return 'H2';
  if(ev>=6&&s>=54)return 'H3';
  return 'HAVUZ DIŞI';
}
function buildCandidateForDir(sym,tf,b,dir){
  sym=cleanSymbol(sym); if(!sym||!b)return null;
  const c=b.candles,last=c[c.length-1],key=sym+'|'+tf,pairLive=liveMap[key]||pairSourceTime(sym,tf,c),ageMs=sourceAgeMs(pairLive);
  if(!pairLive||ageMs>RULE.maxLiveAgeMs)return null;
  let sig=null,usedK=0;
  for(let k=0;k<=7;k++){
    const s=signalForSymbol(c,c.length-1-k,'BAGLI '+dir,sym,tf);
    if(!s)continue;
    const driftPct=Math.abs(last.close-s.entry)/Math.max(Math.abs(s.entry),1)*100;
    const driftAtr=Math.abs(last.close-s.entry)/Math.max(last.atr||0,1e-9);
    if(driftPct<=RULE.maxEntryDriftPct&&driftAtr<=RULE.maxEntryDriftAtr){sig=s;usedK=k;break;}
  }
  if(!sig)return null;
  const stat=v152SafeStat((b.stats||[]).find(s=>String(s.model||'').includes(dir)),dir);
  const source=sourceMap[key]||'Taze veri';
  const sel=v152SelectorScore(sig,stat,source,usedK,tf);
  if(sel.score<RULE.poolMinScore)return null;
  const conf=v152Confidence(sel,stat,source),lev=leverage(sig,conf),rClass=riskClass(sig.stopPct,lev.lev);
  if(sig.stopPct>RULE.maxStopPct||rClass==='Yüksek')return null;
  const temp={stat,scoreBreakdown:{tech:Math.round(sel.tech),execution:Math.round(sel.execution),backtest:Math.round(sel.stat),source:Math.round(sel.source)},tp2RoomR:sig.tp2RoomR,stopPct:sig.stopPct,selectorScore:Math.round(sel.score),usedK,tf,techDetail:sig.techDetail,riskClass:rClass,ageSec:Math.max(0,Math.round(ageMs/1000)),sym};
  const grade=v156RosterBand(temp), pool=v157PoolGrade(temp);
  const notes=['v15.7 tam teknik havuz',pool];
  if(grade==='A+'||grade==='A'||grade==='A-')notes.push('ana teknik kadro'); else if(grade==='B+')notes.push('yedek/izleme'); else notes.push('ana kadro dışı');
  if(usedK>0)notes.push(`${usedK} mum önce tetik`);
  notes.push(...sel.notes.slice(0,3));
  const obj={sym,tf,model:'v15.7 Tam Teknik Havuz '+dir,sub:sig.sub,dir:sig.dir,conf,rawConf:Math.round(sel.score),cap:conf,capNotes:[...new Set(notes)],riskClass:rClass,entry:last.close,stop:sig.stop,t1:sig.t1,t2:sig.t2,t3:sig.t3,stopPct:sig.stopPct,rr:sig.rr,tp2RoomR:sig.tp2RoomR,why:sig.why,techDetail:sig.techDetail,stat,lev,candles:c,ageSec:Math.max(0,Math.round(ageMs/1000)),source,liveOnly:stat.count<1,stale:false,selectorScore:Math.round(sel.score),poolGrade:grade,poolStage:pool,usedK,scoreBreakdown:{tech:Math.round(sel.tech),execution:Math.round(sel.execution),backtest:Math.round(sel.stat),source:Math.round(sel.source)}};
  return adjustRiskConfidence(obj);
}
function renderList(){
  const box=$('list');
  const longs=rankedList('LONG',7),shorts=rankedList('SHORT',7),longRes=reserveList('LONG',10),shortRes=reserveList('SHORT',10);
  const rawLong=candidates.filter(x=>x&&x.dir==='LONG').length, rawShort=candidates.filter(x=>x&&x.dir==='SHORT').length;
  const h1L=candidates.filter(x=>x.dir==='LONG'&&x.poolStage==='H1').length, h1S=candidates.filter(x=>x.dir==='SHORT'&&x.poolStage==='H1').length;
  const summary=`<div class="dash"><div><b>${rawLong}</b><span>LONG genel havuz</span></div><div><b>${rawShort}</b><span>SHORT genel havuz</span></div><div><b>${longs.length}</b><span>LONG ana kadro</span></div><div><b>${shorts.length}</b><span>SHORT ana kadro</span></div><div><b>${h1L+h1S}</b><span>H1 güçlü havuz</span></div><div><b>${scanLog.lowQuality||0}</b><span>havuz dışı</span></div></div>
  <div class="note"><b>v15.7 Tam Teknik Genel Havuz:</b> LONG ve SHORT aynı 12+ katmandan geçer: trend, üst zaman, market structure, Smart Money, destek/direnç, supply-demand, likidite, lokasyon, momentum, hacim/para akışı, mum formasyonu, volatilite, stop/TP alanı. Spot/vadeli ayrımı kaliteye katılmaz.</div>`;
  const dirPill=x=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${x.dir} TEKNİK ADAY</span>`;
  const card=(x,i)=>{const idx=candidates.indexOf(x),bd=x.scoreBreakdown||{},d=x.techDetail||{};const bt=`İşlem ${x.stat.count||0} | Win ${pct(x.stat.win||0,1)} | PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)} | Hızlı stop ${pct(x.stat.fast||0,1)}`;const band=`<span class="pill ${x.poolGrade==='A+'?'green':x.poolGrade==='A'?'blue':x.poolGrade==='A-'?'amber':'gray'}">${v156BandLabel(x)}</span>`;return `<div class="candidate ${x.dir==='SHORT'?'short':'long'}" onclick="selectCandidate(${idx})"><div class="top"><div><div class="sym">${i+1}) ${symbolLabel(x.sym)} / ${x.tf}</div><div class="model">${x.model}${x.sub?' — '+x.sub:''}</div></div><div class="score ${x.dir==='LONG'?'long':'short'}">${x.selectorScore}<br><span style="font-size:15px">PUAN</span></div></div><div class="line">Havuz: <b>${x.poolStage||'-'}</b> | Kalite: <b>${x.poolGrade}</b> | ${v156BandLabel(x)} | Güven: ${x.conf}% | Tetik: ${x.usedK||0} mum<br>Skor: Teknik ${bd.tech||'-'} / İcra ${bd.execution||'-'} / Backtest ${bd.backtest||'-'} / Veri ${bd.source||'-'}<br>Katman: Trend ${fmt(d.trend?.score||0,0)} | SMC ${fmt(d.smc?.score||0,0)} | S/R ${fmt(d.sr?.score||0,0)} | Likidite ${fmt(d.liq?.score||0,0)} | Mum ${fmt(d.candle?.score||0,0)} | Hacim ${fmt(d.volumeQual?.score||0,0)}<br>Giriş ${dualPrice(x.entry)}<br>Stop ${dualPrice(x.stop)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2RoomR||0,2)}R<br>TP1 ${dualPrice(x.t1)} | TP2 ${dualPrice(x.t2)} | TP3 ${dualPrice(x.t3)}<br>Backtest: ${bt}<br>Veri: ${x.ageSec} sn | Mum: ${x.candleSource||x.source} | Fiyat: ${x.priceSource||x.source}<br>Teknik: ${(x.why||[]).join(' + ')}</div><div>${dirPill(x)}${band}<span class="pill blue">v15.7 tam teknik</span>${(x.capNotes||[]).slice(0,5).map(n=>`<span class="pill amber">${n}</span>`).join('')}</div></div>`};
  const section=(title,arr,dir,desc,empty)=>`<div class="listSection ${dir.toLowerCase()}"><h3>${title}</h3><p class="dim">${desc}</p>${arr.length?arr.map(card).join(''):empty}</div>`;
  box.innerHTML=summary+
    section('En İyi 7 LONG — Ana Teknik Kadro',longs,'LONG','Genel havuzdan A+/A/A- kaliteye yükselen LONG adayları.','<p>LONG havuz var ama ana teknik kadro standardını geçen aday yok.</p>')+
    section('En İyi 7 SHORT — Ana Teknik Kadro',shorts,'SHORT','Genel havuzdan A+/A/A- kaliteye yükselen SHORT adayları. Standart LONG ile aynıdır.','<p>SHORT havuz var ama ana teknik kadro standardını geçen aday yok.</p>')+
    section('Yedek LONG İzleme Havuzu',longRes,'LONG','H2/H3 veya B+ kalite: takip edilir; ana kadro değildir.','<p>Yedek LONG yok.</p>')+
    section('Yedek SHORT İzleme Havuzu',shortRes,'SHORT','H2/H3 veya B+ kalite: takip edilir; ana kadro değildir.','<p>Yedek SHORT yok.</p>');
}
function selectCandidate(i,auto=false){
  const x=candidates[i]; if(!x)return; selected=x;
  const bd=x.scoreBreakdown||{},d=x.techDetail||{};
  const status=v156MainEligible(x)?v156BandLabel(x):'YEDEK / İZLEME';
  $('decision').className='decision '+(x.dir==='LONG'?'long':'short'); $('decision').textContent=`${x.dir} ${status} — v15.7 PUAN ${x.selectorScore} / ${x.poolGrade}`;
  $('metrics').innerHTML=metric('Sembol / TF',`${symbolLabel(x.sym)} / ${x.tf}`)+metric('Yön',`${x.dir} teknik işlem`)+metric('Havuz sınıfı',x.poolStage||'-')+metric('Kalite sınıfı',x.poolGrade||'-')+metric('Kadro durumu',status)+metric('Kadro puanı',x.selectorScore||'-')+metric('Teknik / İcra',`${bd.tech||'-'} / ${bd.execution||'-'}`)+metric('Backtest / Veri',`${bd.backtest||'-'} / ${bd.source||'-'}`)+metric('Canlı veri',`${x.ageSec} sn`)+metric('Tetik yaşı',`${x.usedK||0} mum`)+metric('Trend / MTF',`${fmt(d.trend?.score||0,0)} / ${fmt(d.mtf?.score||0,0)}`)+metric('Yapı / SMC',`${fmt(d.st?.score||0,0)} / ${fmt(d.smc?.score||0,0)}`)+metric('S/R / Supply-Demand',`${fmt(d.sr?.score||0,0)} / ${fmt(d.sd?.score||0,0)}`)+metric('Likidite / Lokasyon',`${fmt(d.liq?.score||0,0)} / ${fmt(d.loc?.score||0,0)}`)+metric('Momentum / Para akışı',`${fmt(d.mom?.score||0,0)} / ${fmt(d.flow?.score||0,0)}`)+metric('Hacim / Mum',`${fmt(d.volumeQual?.score||0,0)} / ${fmt(d.candle?.score||0,0)}`)+metric('Tetik / Volatilite',`${fmt(d.trig?.score||0,0)} / ${fmt(d.vol?.score||0,0)}`)+metric('Kanal / TP2',`${fmt(d.channel?.score||0,0)} / ${fmt(x.tp2RoomR||0,2)}R`)+metric('Giriş',dualPrice(x.entry))+metric('Stop',dualPrice(x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dualPrice(x.t1))+metric('TP2',dualPrice(x.t2))+metric('TP3',dualPrice(x.t3))+metric('PF',x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2));
  $('tryPlan').innerHTML=binanceTryPlan(x); $('reasons').innerHTML=(x.why||[]).map(r=>`<span class="pill ${x.dir==='LONG'?'green':'red'}">${r}</span>`).join('')+`<span class="pill blue">Win ${pct(x.stat.win||0,1)}</span><span class="pill blue">PF ${x.stat.pf>=20?'20+':fmt(x.stat.pf||0,2)}</span><span class="pill blue">Hızlı stop ${pct(x.stat.fast||0,1)}</span><span class="pill blue">Katman ${v157EvidenceCount(x)}</span>`+(x.capNotes&&x.capNotes.length?x.capNotes.slice(0,8).map(n=>`<span class="pill amber">${n}</span>`).join(''):'');
  drawChart(x.candles,x); renderBacktest(x); if(!auto)$('planBox').scrollIntoView({behavior:'smooth'});
}
function binanceTryPlan(x){
  if(!fxReady())return 'USDT/TRY kuru alınamadı. TL fiyatları görünmeden işlem planı girme.';
  if(!v156MainEligible(x))return `<b>YEDEK / İZLEME</b><div class="tryline">Bu aday genel havuza girmiş olabilir; fakat ana kadro kalitesine yükselmedi. İşlem açma; sadece takip et. Ana kadro için tam teknik havuz + kalite seçici birlikte geçmelidir.</div>`;
  const isLong=x.dir==='LONG';
  const riskTry=RULE.spotTry*(x.stopPct/100);
  const p1=RULE.spotTry*(isLong?((x.t1-x.entry)/x.entry):((x.entry-x.t1)/x.entry));
  const p2=RULE.spotTry*(isLong?((x.t2-x.entry)/x.entry):((x.entry-x.t2)/x.entry));
  const p3=RULE.spotTry*(isLong?((x.t3-x.entry)/x.entry):((x.entry-x.t3)/x.entry));
  return `<b>${x.dir} TEKNİK ANA KADRO — v15.7</b><div class="tryline">Bu plan teknik kalite planıdır. LONG ve SHORT aynı standartla üretilir; hangi piyasada uygulanacağı kullanıcı tercihidir.</div><div class="tryline">Giriş referansı: ${tlInput(x.entry)} TL | Stop: ${tlInput(x.stop)} TL | TP1: ${tlInput(x.t1)} TL | TP2: ${tlInput(x.t2)} TL.</div><div class="tryline"><b>Güvenli kullanım:</b> TP1 görülmeden tüm pozisyonu TP2’ye bağlama. TP1 sonrası stopu girişe/az kâra çekip kalan kısmı TP2’ye taşı.</div><div class="tryline">Referans ${fmt(RULE.spotTry,0)} TL için tahmini risk: ${fmt(riskTry,2)} TL | TP1/TP2/TP3 tahmini: ${fmt(p1,2)} / ${fmt(p2,2)} / ${fmt(p3,2)} TL.</div>`;
}
async function scanAll(){
  setMeta('v15.7 Tam Teknik Genel Havuz taraması başladı: SMC + destek/direnç + likidite + supply/demand + mum + hacim katmanları aktif...');
  candidates=[]; scanLog.lowQuality=0; const total=SYMBOLS.length*TFS.length; scanLog.total=total; scanLog.done=0; let done=0;
  for(const s0 of SYMBOLS){const s=cleanSymbol(s0); if(!s){scanLog.skipped+=TFS.length;continue;} for(const tf of TFS){await ensureCandles(s,tf); const arr=getCandles(s,tf); const key=s+'|'+tf; const pairLive=liveMap[key]||pairSourceTime(s,tf,arr); if(arr&&arr.length>=245&&pairLive&&sourceAgeMs(pairLive)<=RULE.maxLiveAgeMs){const before=candidates.length; const b=backtest(s,tf); if(b){for(const dir of ['LONG','SHORT']){const cand=buildCandidateForDir(s,tf,b,dir); if(cand)candidates.push(cand); else scanLog.lowQuality=(scanLog.lowQuality||0)+1;}} if(candidates.length>before||done%8===0){sortCandidates();renderList();}} else {scanLog.skipped++; if(pairLive&&sourceAgeMs(pairLive)>RULE.maxLiveAgeMs)scanLog.stale++;} done++; scanLog.done=done; setBar(done/total*100); setMeta(`${liveText()} | v15.7 genel havuz ${done}/${total} | Coin: ${symbolLabel(s)} | TF: ${tf} | LONG havuz: ${candidates.filter(x=>x.dir==='LONG').length} | SHORT havuz: ${candidates.filter(x=>x.dir==='SHORT').length} | Ana: ${rankedList('LONG',7).length}+${rankedList('SHORT',7).length} | H1: ${candidates.filter(x=>x.poolStage==='H1').length}`); await delay(16);}}
  sortCandidates(); renderList(); const autoIdx=firstAutoCandidateIndex(); if(autoIdx>=0)setTimeout(()=>selectCandidate(autoIdx,true),50); setMeta(`${liveText()} | Tarama bitti: ${done}/${total} | LONG havuz ${candidates.filter(x=>x.dir==='LONG').length} / ana ${rankedList('LONG',7).length} / yedek ${reserveList('LONG',99).length} | SHORT havuz ${candidates.filter(x=>x.dir==='SHORT').length} / ana ${rankedList('SHORT',7).length} / yedek ${reserveList('SHORT',99).length} | v15.7 Tam Teknik Genel Havuz aktif`);
}
