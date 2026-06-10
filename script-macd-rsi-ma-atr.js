window.__AYAZ_ACTIVE_VERSION__="macd-rsi-ma-atr-v1";
const API="https://api.binance.com";
const RULE={atrStop:1.5,tp1R:2,tp2R:3,tp3R:5};
let usdtry=0, stopScan=false, scanRunning=false;
let counts={long:0,short:0,done:0,total:0};
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function fmt(n,d=4){return n==null||!isFinite(n)?"-":Number(n).toLocaleString("tr-TR",{maximumFractionDigits:d})}
function money(n){return n==null||!isFinite(n)?"-":Number(n).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function setStatus(s){$("status").innerHTML=s}
function updateDash(){
  $("usdtry").textContent=usdtry?money(usdtry):"-";
  $("done").textContent=counts.done;
  $("total").textContent=counts.total;
  $("longCount").textContent=counts.long;
  $("shortCount").textContent=counts.short;
  $("bar").style.width=counts.total?Math.min(100,counts.done/counts.total*100)+"%":"0%";
}
async function jfetch(url,timeout=20000){
  const ac=new AbortController(); const id=setTimeout(()=>ac.abort(),timeout);
  try{const r=await fetch(url,{cache:"no-store",signal:ac.signal});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json()}
  finally{clearTimeout(id)}
}
async function loadUsdTry(){
  try{const d=await jfetch("https://open.er-api.com/v6/latest/USD",12000);usdtry=Number(d?.rates?.TRY||0)}
  catch(e){try{const d=await jfetch("https://api.frankfurter.app/latest?from=USD&to=TRY",12000);usdtry=Number(d?.rates?.TRY||0)}catch(e2){usdtry=0}}
  updateDash();
}
async function symbolsFromBinance(maxCount,minVol){
  const [info,tickers]=await Promise.all([jfetch(API+"/api/v3/exchangeInfo",25000),jfetch(API+"/api/v3/ticker/24hr",25000)]);
  const active=new Set(info.symbols.filter(s=>s.status==="TRADING"&&s.quoteAsset==="USDT"&&s.isSpotTradingAllowed).map(s=>s.symbol));
  return tickers.filter(t=>active.has(t.symbol)).filter(t=>Number(t.quoteVolume)>=minVol).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,maxCount).map(t=>t.symbol);
}
async function klines(symbol,tf,limit){
  const raw=await jfetch(`${API}/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`,20000);
  return raw.map(k=>({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}));
}
function ema(values,period){
  const k=2/(period+1), out=[]; let prev=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=0;i<values.length;i++){if(i<period-1)out.push(null);else if(i===period-1)out.push(prev);else{prev=values[i]*k+prev*(1-k);out.push(prev)}}
  return out;
}
function rsi(closes,period=14){
  const out=Array(closes.length).fill(null); let gains=0,losses=0;
  for(let i=1;i<=period;i++){const d=closes[i]-closes[i-1];if(d>=0)gains+=d;else losses-=d}
  let ag=gains/period, al=losses/period; out[period]=al===0?100:100-100/(1+ag/al);
  for(let i=period+1;i<closes.length;i++){const d=closes[i]-closes[i-1];ag=(ag*(period-1)+Math.max(d,0))/period;al=(al*(period-1)+Math.max(-d,0))/period;out[i]=al===0?100:100-100/(1+ag/al)}
  return out;
}
function macd(closes){
  const e12=ema(closes,12), e26=ema(closes,26);
  const line=closes.map((_,i)=>e12[i]&&e26[i]?e12[i]-e26[i]:null);
  const signal=ema(line.map(v=>v??0),9);
  const hist=line.map((v,i)=>v!==null&&signal[i]!==null?v-signal[i]:null);
  return {line,signal,hist};
}
function atr(candles,period=14){
  const tr=[];
  for(let i=0;i<candles.length;i++){if(i===0)tr.push(candles[i].h-candles[i].l);else{const h=candles[i].h,l=candles[i].l,pc=candles[i-1].c;tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)))}}
  return ema(tr,period);
}
function avg(a,n){const s=a.slice(-n);return s.reduce((x,y)=>x+y,0)/s.length}
function analyze(symbol,tf,c){
  if(!c||c.length<220||!usdtry)return null;
  const close=c.map(x=>x.c), vol=c.map(x=>x.v), i=c.length-1;
  const e9=ema(close,9),e21=ema(close,21),e50=ema(close,50),e200=ema(close,200);
  const rs=rsi(close), m=macd(close), at=atr(c);
  const entry=close[i], atrNow=at[i], volOk=vol[i]>avg(vol,20);
  if(!atrNow)return null;
  const longOk=e9[i]>e21[i]&&e21[i]>e50[i]&&e50[i]>e200[i]&&rs[i]>55&&m.line[i]>m.signal[i]&&m.hist[i]>0&&volOk;
  const shortOk=e9[i]<e21[i]&&e21[i]<e50[i]&&e50[i]<e200[i]&&rs[i]<45&&m.line[i]<m.signal[i]&&m.hist[i]<0&&volOk;
  if(!longOk&&!shortOk)return null;
  const side=longOk?"LONG":"SHORT", risk=atrNow*RULE.atrStop;
  return {symbol,tf,side,entry,atr:atrNow,rsi:rs[i],stop:side==="LONG"?entry-risk:entry+risk,tp1:side==="LONG"?entry+risk*RULE.tp1R:entry-risk*RULE.tp1R,tp2:side==="LONG"?entry+risk*RULE.tp2R:entry-risk*RULE.tp2R,tp3:side==="LONG"?entry+risk*RULE.tp3R:entry-risk*RULE.tp3R,reason:"EMA 9/21/50/200 + MACD + RSI + hacim şartları tam geçti"};
}
function card(s){
  const cls=s.side==="LONG"?"long":"short", tl=v=>usdtry?money(v*usdtry):"-";
  const div=document.createElement("div"); div.className="candidate "+(s.side==="SHORT"?"short":"");
  div.innerHTML=`<div class="top"><div><div class="sym">${s.symbol} <span class="dim">${s.tf}</span></div><div class="line">${s.reason}</div></div><div class="side ${cls}">${s.side}</div></div>
  <div class="line"><span class="tag blue">RSI ${fmt(s.rsi,2)}</span><span class="tag gray">ATR ${fmt(s.atr,6)}</span><span class="tag ${cls==='long'?'green':'red'}">Canlı veri</span></div>
  <div class="grid">
    <div class="metric"><div class="k">Entry USDT</div><div class="v">${fmt(s.entry,8)}</div></div><div class="metric"><div class="k">Entry TL</div><div class="v">${tl(s.entry)}</div></div>
    <div class="metric"><div class="k">Stop USDT / TL</div><div class="v">${fmt(s.stop,8)} / ${tl(s.stop)}</div></div><div class="metric"><div class="k">TP1 USDT / TL</div><div class="v">${fmt(s.tp1,8)} / ${tl(s.tp1)}</div></div>
    <div class="metric"><div class="k">TP2 USDT / TL</div><div class="v">${fmt(s.tp2,8)} / ${tl(s.tp2)}</div></div><div class="metric"><div class="k">TP3 USDT / TL</div><div class="v">${fmt(s.tp3,8)} / ${tl(s.tp3)}</div></div>
  </div>`;
  return div;
}
function clearLists(){$("longList").innerHTML='<p class="dim">Henüz sinyal yok.</p>';$("shortList").innerHTML='<p class="dim">Henüz sinyal yok.</p>';counts={long:0,short:0,done:0,total:0};updateDash()}
function addSignal(s){const target=s.side==="LONG"?$("longList"):$("shortList");if(target.querySelector("p"))target.innerHTML="";target.appendChild(card(s));if(s.side==="LONG")counts.long++;else counts.short++;updateDash()}
async function scan(){
  if(scanRunning)return; scanRunning=true; stopScan=false; clearLists(); $("scanBtn").disabled=true;
  setStatus("Canlı USD/TRY alınıyor..."); await loadUsdTry();
  const tfs=[...document.querySelectorAll(".tf:checked")].map(x=>x.value);
  const maxCount=Number($("limit").value||400), minVol=Number($("minVolume").value||0), candleLimit=Number($("candleLimit").value||300);
  setStatus("Binance canlı USDT sembolleri alınıyor...");
  let syms=[]; try{syms=await symbolsFromBinance(maxCount,minVol)}catch(e){setStatus("Sembol alınamadı: "+e.message);scanRunning=false;$("scanBtn").disabled=false;return}
  counts.total=syms.length*tfs.length; updateDash();
  for(const sym of syms){for(const tf of tfs){
    if(stopScan){setStatus(`Durduruldu. Kontrol: ${counts.done}/${counts.total}`);scanRunning=false;$("scanBtn").disabled=false;return}
    setStatus(`Taranıyor: <b>${sym}</b> ${tf} — Kontrol: ${counts.done}/${counts.total}`);
    try{const c=await klines(sym,tf,candleLimit);const s=analyze(sym,tf,c);if(s)addSignal(s)}catch(e){}
    counts.done++;updateDash();await sleep(90);
  }}
  setStatus(`Tarama bitti. Long: ${counts.long}, Short: ${counts.short}.`);scanRunning=false;$("scanBtn").disabled=false;
}
$("scanBtn").onclick=scan;$("stopBtn").onclick=()=>{stopScan=true};$("clearBtn").onclick=clearLists;
loadUsdTry();setInterval(loadUsdTry,60000);
