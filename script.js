const VERSION="v16.4 teknik + backtest 7 LONG + 7 SHORT";
const TFS=["15m","30m","1h","2h","4h"];
const TFMS={"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000};
const NEXT_TF={"15m":"1h","30m":"2h","1h":"4h","2h":"4h","4h":"4h"};
const DEFAULT_SYMBOLS=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","TRXUSDT","LINKUSDT","AVAXUSDT","LTCUSDT","BCHUSDT","DOTUSDT","NEARUSDT","APTUSDT","OPUSDT","ARBUSDT","SUIUSDT","INJUSDT","ATOMUSDT","UNIUSDT","AAVEUSDT","ETCUSDT","FILUSDT","WIFUSDT","PEPEUSDT","FETUSDT","CAKEUSDT","HBARUSDT","WLDUSDT"];
const UNIVERSE_LIMIT=150;
const EXCLUDED_BASES=new Set(["USDC","FDUSD","TUSD","BUSD","DAI","USDP","EUR","TRY","BRL","GBP","UAH","AEUR","EURI","PAX","USTC"]);
const BAD_SUFFIX=["UP","DOWN","BULL","BEAR","3L","3S","5L","5S"];
const RULE={
  maxAgeMs:300000,
  limit:700,
  spotTry:10000,
  // v16.4: Teknik argümanlar eksiksiz ölçülür ama havuza giriş için aşırı sert AND kapısı kullanılmaz.
  // Amaç: önce teknik bağlamı olan adayları yakalamak, finalde backtest dayanıklılığına göre sıralamak.
  techMin:45,
  execMin:55,
  minLayerHits:5,
  maxPoolStop:5.0,
  minPoolTp2:1.20,
  minBtCount:12,
  minBtWin:45,
  minBtPf:1.15,
  maxBtFast:45,
  showEach:7
};
let SYMBOLS=[...DEFAULT_SYMBOLS],market={data:{},generatedAt:null},fx={rate:null,source:"-",ageSec:null},scan={done:0,total:0,dirChecks:0,passedTech:0,btPassed:0,out:0,json:0,rest:0,stale:0,invalid:0},pool=[],selected=null;
const $=id=>document.getElementById(id),now=()=>Date.now();
function fmt(n,d=2){if(n===null||n===undefined||!isFinite(n))return"-";return Number(n).toLocaleString("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(n,d=1){return fmt(n,d)+"%"}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function avg(a){return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function cleanSymbol(s){const raw=String(s||"").trim();if(!raw||/[^\x00-\x7F]/.test(raw))return null;const u=raw.toUpperCase().replace(/[^A-Z0-9]/g,"");if(!/^[A-Z0-9]{2,14}USDT$/.test(u))return null;const b=u.replace(/USDT$/,'');if(EXCLUDED_BASES.has(b)||BAD_SUFFIX.some(x=>b.endsWith(x)))return null;return u}
function base(sym){return String(sym||"").replace(/USDT$/,'')}
function priceDecimals(n){n=Math.abs(Number(n)||0);if(n>=1000)return 2;if(n>=100)return 3;if(n>=1)return 4;if(n>=.01)return 5;return 8}
function tlDecimals(n){n=Math.abs(Number(n)||0);if(n>=1000)return 2;if(n>=10)return 3;if(n>=1)return 4;return 6}
function tlPrice(n){if(!fx.rate)return"TL yok";const v=n*fx.rate;return fmt(v,tlDecimals(v))+" TL"}
function dual(n){return fmt(n,priceDecimals(n))+" USDT / "+tlPrice(n)}
function money(n){return fmt(n,2)+"$"+(fx.rate?" / "+fmt(n*fx.rate,2)+" TL":"")}
function setMeta(t){$("meta").textContent=t}
function setBar(p){$("bar").style.width=clamp(p,0,100)+"%"}
function setDataBox(){const ok=market&&Object.keys(market.data||{}).length;$("dataBox").innerHTML=`Veri: <b class="${ok?'ok':'bad'}">${ok?'BAĞLI':'BEKLEMEDE'}</b> | Coin: ${SYMBOLS.length} | Mum: ${Object.values(market.data||{}).reduce((s,v)=>s+TFS.reduce((a,tf)=>a+((v&&v[tf]&&v[tf].length)||0),0),0)} | v16.4 teknik+backtest 7+7`}
function setFxBox(){if(fx.rate)$("fxBox").innerHTML=`Kur: <b>1 USDT ≈ ${fmt(fx.rate,4)} TL</b> | Kaynak: ${fx.source} | Yaş: ${fx.ageSec??'-'} sn`;else $("fxBox").textContent="USDT/TRY kuru alınamadı."}
async function jfetch(url,timeout=12000){const ctrl=new AbortController();const id=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{cache:"no-store",signal:ctrl.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(id)}}
async function loadMarket(){try{const j=await jfetch("data/market.json?v="+Date.now(),9000);market=j||{data:{}};if(j.symbols&&Array.isArray(j.symbols))SYMBOLS=j.symbols.map(cleanSymbol).filter(Boolean).slice(0,UNIVERSE_LIMIT);if(j.fx&&j.fx.usdtTry){fx={rate:Number(j.fx.usdtTry),source:j.fx.source||"market.json",ageSec:Math.floor((now()-Date.parse(j.fx.generatedAt||j.generatedAt||new Date()))/1000)}}sanitizeMarket();setFxBox();setDataBox();return true}catch(e){market={data:{}};setDataBox();return false}}
async function loadFx(){if(fx.rate)return;const urls=["https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY","https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY"];for(const u of urls){try{const j=await jfetch(u,7000);const r=Number(j.price);if(r>10&&r<250){fx={rate:r,source:"Binance USDTTRY",ageSec:0};setFxBox();return}}catch(e){}}fx={rate:45.9,source:"yedek varsayılan",ageSec:null};setFxBox()}
function sanitizeMarket(){const out={};for(const [s,v] of Object.entries(market.data||{})){const cs=cleanSymbol(s);if(!cs){scan.invalid++;continue}out[cs]=out[cs]||{};for(const tf of TFS){const arr=v&&v[tf];if(Array.isArray(arr)&&arr.length)out[cs][tf]=arr.map(k=>({time:+(k.time||k[0]),open:+(k.open||k[1]),high:+(k.high||k[2]),low:+(k.low||k[3]),close:+(k.close||k[4]),volume:+(k.volume||k[5]),closeTime:+(k.closeTime||k[6]||k.time||k[0]),liveTime:k.liveTime}))}}market.data=out}
async function getCandles(sym,tf){sym=cleanSymbol(sym);if(!sym)return null;let arr=market.data&&market.data[sym]&&market.data[sym][tf];if(arr&&arr.length>80){const last=arr[arr.length-1],t=Number(last.liveTime||last.closeTime||last.time||0);if(now()-t<=RULE.maxAgeMs){scan.json++;return arr.slice(-RULE.limit).map(x=>({...x,source:"JSON"}))}}try{const raw=await jfetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${RULE.limit}`,9000);const a=raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6],source:"REST"}));scan.rest++;return a}catch(e){scan.stale++;return null}}
async function getUniverse(){try{const [ex,ticks]=await Promise.all([jfetch("https://data-api.binance.vision/api/v3/exchangeInfo",10000),jfetch("https://data-api.binance.vision/api/v3/ticker/24hr",10000)]);const allowed=new Set((ex.symbols||[]).filter(x=>x.status==="TRADING"&&x.quoteAsset==="USDT"&&x.isSpotTradingAllowed!==false).map(x=>x.symbol));const arr=(ticks||[]).filter(t=>{const s=cleanSymbol(t.symbol);if(!s||!allowed.has(s))return false;return Number(t.quoteVolume||0)>150000&&Number(t.lastPrice||0)>0&&Number(t.count||0)>50}).sort((a,b)=>Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,UNIVERSE_LIMIT).map(t=>cleanSymbol(t.symbol));if(arr.length>=80)SYMBOLS=arr}catch(e){}SYMBOLS=[...new Set(SYMBOLS.map(cleanSymbol).filter(Boolean))].slice(0,UNIVERSE_LIMIT)}
function ema(values,len){const k=2/(len+1),out=[];let e=values[0];for(let i=0;i<values.length;i++){e=i?values[i]*k+e*(1-k):values[i];out.push(e)}return out}
function enrich(raw){const c=raw.map(x=>({...x})).filter(x=>isFinite(x.close)&&isFinite(x.high)&&isFinite(x.low)&&isFinite(x.open));const closes=c.map(x=>x.close),highs=c.map(x=>x.high),lows=c.map(x=>x.low),vols=c.map(x=>x.volume||0);const e21=ema(closes,21),e55=ema(closes,55),e100=ema(closes,100),e200=ema(closes,200);let gain=0,loss=0,trs=[],obv=0,obvs=[],mfq=[];for(let i=0;i<c.length;i++){const p=c[i-1]||c[i];const ch=c[i].close-p.close;gain=(gain*13+Math.max(ch,0))/14;loss=(loss*13+Math.max(-ch,0))/14;const tr=Math.max(c[i].high-c[i].low,Math.abs(c[i].high-p.close),Math.abs(c[i].low-p.close));trs.push(tr);obv+=ch>0?vols[i]:ch<0?-vols[i]:0;obvs.push(obv);const mfm=(c[i].high===c[i].low)?0:((c[i].close-c[i].low)-(c[i].high-c[i].close))/(c[i].high-c[i].low);mfq.push(mfm*vols[i]);c[i].rsi=100-100/(1+(gain/(loss||1e-9)));c[i].e21=e21[i];c[i].e55=e55[i];c[i].e100=e100[i];c[i].e200=e200[i];c[i].tr=tr;c[i].obv=obv}const atr=ema(trs,14),ef=ema(closes,12),es=ema(closes,26),macd=ef.map((v,i)=>v-es[i]),sig=ema(macd,9);for(let i=0;i<c.length;i++){const start=Math.max(0,i-19),vs=vols.slice(start,i+1),mfs=mfq.slice(start,i+1);c[i].atr=atr[i];c[i].macd=macd[i];c[i].macdSig=sig[i];c[i].volAvg=avg(vs)||1;c[i].cmf=mfs.reduce((a,b)=>a+b,0)/(vs.reduce((a,b)=>a+b,0)||1);c[i].obvSlope=obvs[i]-(obvs[Math.max(0,i-10)]||0);c[i].bbWidth=std(closes.slice(start,i+1))/(avg(closes.slice(start,i+1))||1)*100}return c}
function std(a){const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)*(x-m)))||0)}
function zone(c,i,dir,len=80){const s=c.slice(Math.max(0,i-len),i);if(s.length<20)return {level:c[i].close,dist:9,touches:0};const lvl=dir==="LONG"?Math.min(...s.map(x=>x.low)):Math.max(...s.map(x=>x.high));const atr=c[i].atr||((c[i].high-c[i].low)||1);const dist=Math.abs(c[i].close-lvl)/(atr||1);const touches=s.filter(x=>dir==="LONG"?Math.abs(x.low-lvl)<=atr*.5:Math.abs(x.high-lvl)<=atr*.5).length;return {level:lvl,dist,touches}}
function swings(c,i){const s=c.slice(Math.max(0,i-120),i);let ph=[],pl=[];for(let k=2;k<s.length-2;k++){if(s[k].high>s[k-1].high&&s[k].high>s[k-2].high&&s[k].high>s[k+1].high&&s[k].high>s[k+2].high)ph.push(s[k].high);if(s[k].low<s[k-1].low&&s[k].low<s[k-2].low&&s[k].low<s[k+1].low&&s[k].low<s[k+2].low)pl.push(s[k].low)}return{ph,pl,lastH:ph.at(-1)||Math.max(...s.map(x=>x.high)),lastL:pl.at(-1)||Math.min(...s.map(x=>x.low)),prevH:ph.at(-2)||ph.at(-1)||0,prevL:pl.at(-2)||pl.at(-1)||0}}
function candleScore(c,i,dir){const x=c[i],p=c[i-1]||x;const range=Math.max(x.high-x.low,1e-9),body=Math.abs(x.close-x.open),upper=x.high-Math.max(x.close,x.open),lower=Math.min(x.close,x.open)-x.low;const strong=body/range>.45;if(dir==="LONG"){let s=0;if(lower/range>.35&&x.close>x.open)s+=35;if(x.close>p.high)s+=35;if(x.close>x.open&&strong)s+=25;if(p.close<p.open&&x.close>x.open&&x.close>p.open)s+=25;return clamp(s,0,100)}let s=0;if(upper/range>.35&&x.close<x.open)s+=35;if(x.close<p.low)s+=35;if(x.close<x.open&&strong)s+=25;if(p.close>p.open&&x.close<x.open&&x.close<p.open)s+=25;return clamp(s,0,100)}
function structureScore(c,i,dir){const x=c[i],sw=swings(c,i);if(dir==="LONG"){let s=0;if(x.close>sw.lastH)s+=45;if(sw.lastL>sw.prevL)s+=25;if(x.close>x.e55)s+=15;if(x.e21>x.e55)s+=15;return clamp(s,0,100)}let s=0;if(x.close<sw.lastL)s+=45;if(sw.lastH<sw.prevH)s+=25;if(x.close<x.e55)s+=15;if(x.e21<x.e55)s+=15;return clamp(s,0,100)}
function smcScore(c,i,dir){const x=c[i],a=x.atr||1,prior=c.slice(Math.max(0,i-40),i);const minL=Math.min(...prior.map(z=>z.low)),maxH=Math.max(...prior.map(z=>z.high));let fvg=0,ob=0,sweep=0;if(i>3){const a2=c[i-2];if(dir==="LONG"&&a2.high<x.low)fvg=30;if(dir==="SHORT"&&a2.low>x.high)fvg=30}for(let k=Math.max(1,i-12);k<i;k++){const z=c[k],n=c[k+1];if(dir==="LONG"&&z.close<z.open&&n.close>z.high+a*.4)ob=30;if(dir==="SHORT"&&z.close>z.open&&n.close<z.low-a*.4)ob=30}if(dir==="LONG"&&x.low<minL&&x.close>minL)sweep=40;if(dir==="SHORT"&&x.high>maxH&&x.close<maxH)sweep=40;return clamp(fvg+ob+sweep,0,100)}
function supportResistanceScore(c,i,dir){const x=c[i],z=zone(c,i,dir),sw=swings(c,i),a=x.atr||1;let s=clamp(100-z.dist*20+z.touches*7,0,100);if(dir==="LONG"){if(Math.abs(x.close-sw.lastL)<=a*1.2)s+=18;if(x.close>sw.lastL&&x.low<=sw.lastL+a*.35)s+=14}else{if(Math.abs(x.close-sw.lastH)<=a*1.2)s+=18;if(x.close<sw.lastH&&x.high>=sw.lastH-a*.35)s+=14}return clamp(s,0,100)}
function supplyDemandScore(c,i,dir){const x=c[i],a=x.atr||1;let score=0;for(let k=Math.max(3,i-55);k<i-1;k++){const z=c[k],n=c[k+1],imp=Math.abs(n.close-z.close)/(a||1);if(dir==="LONG"&&z.close<z.open&&n.close>z.high&&imp>.55){const dist=Math.abs(x.close-z.low)/a;score=Math.max(score,clamp(90-dist*22,0,100))}if(dir==="SHORT"&&z.close>z.open&&n.close<z.low&&imp>.55){const dist=Math.abs(x.close-z.high)/a;score=Math.max(score,clamp(90-dist*22,0,100))}}return score}
function liquidityScore(c,i,dir){const x=c[i],a=x.atr||1,prior=c.slice(Math.max(0,i-55),i);const lows=prior.map(z=>z.low),highs=prior.map(z=>z.high);const minL=Math.min(...lows),maxH=Math.max(...highs);const eqL=lows.filter(v=>Math.abs(v-minL)<=a*.25).length,eqH=highs.filter(v=>Math.abs(v-maxH)<=a*.25).length;let s=0;if(dir==="LONG"){if(eqL>=2)s+=22;if(x.low<minL&&x.close>minL)s+=58;if(x.close>x.open&&x.low<=minL+a*.45)s+=18}else{if(eqH>=2)s+=22;if(x.high>maxH&&x.close<maxH)s+=58;if(x.close<x.open&&x.high>=maxH-a*.45)s+=18}return clamp(s,0,100)}
function locationScore(c,i,dir){const x=c[i],a=x.atr||1,z=zone(c,i,dir);const emaDist=Math.min(Math.abs(x.close-x.e21),Math.abs(x.close-x.e55))/(a||1);let s=clamp(92-z.dist*18-emaDist*8,0,100);if(dir==="LONG"){if(x.close>x.e21&&x.low<=x.e21+a*.35)s+=12;if(x.close>x.e55&&x.low<=x.e55+a*.45)s+=10}else{if(x.close<x.e21&&x.high>=x.e21-a*.35)s+=12;if(x.close<x.e55&&x.high>=x.e55-a*.45)s+=10}return clamp(s,0,100)}
function regimeScore(sym,tf,dir){const raw=market.data&&market.data["BTCUSDT"]&&(market.data["BTCUSDT"][tf]||market.data["BTCUSDT"][NEXT_TF[tf]]);if(!raw||raw.length<80||sym==="BTCUSDT")return 65;const c=enrich(raw),i=c.length-1,x=c[i];let s=50;if(dir==="LONG"){if(x.close>x.e55)s+=18;if(x.e21>x.e55)s+=16;if(x.rsi>48)s+=10;if(x.macd>x.macdSig)s+=8}else{if(x.close<x.e55)s+=18;if(x.e21<x.e55)s+=16;if(x.rsi<52)s+=10;if(x.macd<x.macdSig)s+=8}return clamp(s,0,100)}

function momentumScore(c,i,dir){const x=c[i],p=c[i-1]||x;let s=0;if(dir==="LONG"){if(x.rsi>50)s+=25;if(x.rsi>p.rsi)s+=20;if(x.macd>x.macdSig)s+=25;if(x.macd>p.macd)s+=15;if(x.e21>x.e55)s+=15}else{if(x.rsi<50)s+=25;if(x.rsi<p.rsi)s+=20;if(x.macd<x.macdSig)s+=25;if(x.macd<p.macd)s+=15;if(x.e21<x.e55)s+=15}return clamp(s,0,100)}
function volumeScore(c,i,dir){const x=c[i],p=c[i-1]||x;let s=0;if(x.volume>x.volAvg*.85)s+=20;if(x.volume>x.volAvg*1.15)s+=20;if(dir==="LONG"){if(x.cmf>-0.02)s+=25;if(x.obvSlope>=0)s+=25;if(x.close>x.open&&x.volume>p.volume*.8)s+=10}else{if(x.cmf<0.02)s+=25;if(x.obvSlope<=0)s+=25;if(x.close<x.open&&x.volume>p.volume*.8)s+=10}return clamp(s,0,100)}
function trendScore(c,i,dir){const x=c[i],slope=x.e21-(c[Math.max(0,i-8)].e21||x.e21);let sc=0;if(dir==="LONG"){if(x.close>x.e21)sc+=20;if(x.e21>x.e55)sc+=25;if(x.e55>x.e100)sc+=20;if(x.close>x.e100)sc+=15;if(slope>0)sc+=20}else{if(x.close<x.e21)sc+=20;if(x.e21<x.e55)sc+=25;if(x.e55<x.e100)sc+=20;if(x.close<x.e100)sc+=15;if(slope<0)sc+=20}return clamp(sc,0,100)}
function upperTfScore(sym,tf,dir){const up=NEXT_TF[tf];const raw=market.data&&market.data[sym]&&market.data[sym][up];if(!raw||raw.length<80)return 55;const c=enrich(raw),i=c.length-1,x=c[i];let sc=50;if(dir==="LONG"){if(x.close>x.e55)sc+=20;if(x.e21>x.e55)sc+=20;if(x.rsi>48)sc+=10}else{if(x.close<x.e55)sc+=20;if(x.e21<x.e55)sc+=20;if(x.rsi<52)sc+=10}return clamp(sc,0,100)}
function stopTp(c,i,dir){const x=c[i],sw=swings(c,i),a=x.atr||Math.max(x.high-x.low,1e-9),entry=x.close;let stop,nearTarget;if(dir==="LONG"){stop=Math.min(sw.lastL,entry-a*1.05);if(stop>=entry)stop=entry-a*1.1;nearTarget=sw.lastH>entry?sw.lastH:entry+a*2.2}else{stop=Math.max(sw.lastH,entry+a*1.05);if(stop<=entry)stop=entry+a*1.1;nearTarget=sw.lastL<entry?sw.lastL:entry-a*2.2}const risk=Math.abs(entry-stop)||a,stopPct=risk/entry*100;const t1=dir==="LONG"?entry+risk*1.05:entry-risk*1.05,t2=dir==="LONG"?entry+risk*1.85:entry-risk*1.85,t3=dir==="LONG"?entry+risk*2.65:entry-risk*2.65;const area=Math.abs(nearTarget-entry)/risk;let stopQ=100-Math.abs(stopPct-1.6)*22;if(stopPct<.55)stopQ-=28;if(stopPct>3.2)stopQ-=25;let tpQ=clamp(area*35,0,100);return{entry,stop,t1,t2,t3,risk,stopPct,tp2Area:area,stopQ:clamp(stopQ,0,100),tpQ}}
function volatilityScore(c,i,st){const x=c[i];let s=70;if(x.bbWidth>.35)s+=15;if(x.bbWidth>4.5)s-=10;if(st.stopPct>=.7&&st.stopPct<=2.4)s+=15;if(st.stopPct>3.2)s-=25;return clamp(s,0,100)}
function analyzeLast(sym,tf,raw,dir){
  if(!raw||raw.length<220)return null;
  const c=enrich(raw),i=c.length-1,x=c[i];
  const ageSec=Math.max(0,Math.floor((now()-(x.liveTime||x.closeTime||x.time||now()))/1000));
  if(ageSec>RULE.maxAgeMs/1000)return null;
  if(String(x.source||"").includes("STALE"))return null;
  const st=stopTp(c,i,dir);
  if(st.stopPct>RULE.maxPoolStop||st.tp2Area<RULE.minPoolTp2)return null;
  const scores={
    trend:trendScore(c,i,dir),regime:regimeScore(sym,tf,dir),upper:upperTfScore(sym,tf,dir),
    structure:structureScore(c,i,dir),smc:smcScore(c,i,dir),sr:supportResistanceScore(c,i,dir),
    supplyDemand:supplyDemandScore(c,i,dir),liquidity:liquidityScore(c,i,dir),location:locationScore(c,i,dir),
    momentum:momentumScore(c,i,dir),flow:volumeScore(c,i,dir),candle:candleScore(c,i,dir),volatility:0,stopTp:0
  };
  scores.volatility=volatilityScore(c,i,st);
  scores.stopTp=clamp(st.stopQ*.55+st.tpQ*.45,0,100);
  const layerHits=Object.values(scores).filter(v=>v>=55).length;
  const tech=clamp(avg([scores.trend,scores.regime,scores.upper,scores.structure,scores.smc,scores.sr,scores.supplyDemand,scores.liquidity,scores.location,scores.momentum,scores.flow,scores.candle,scores.volatility]),0,100);
  const exec=clamp(avg([scores.location,scores.sr,scores.supplyDemand,scores.liquidity,scores.candle,scores.stopTp,scores.volatility])+Math.min(st.tp2Area,3.2)*4,0,100);
  // v16.4 teknik geçiş: tüm argümanlar ölçülür; havuza girişte yalnızca bağlamsız adaylar elenir.
  // Final liste puan/kaliteye göre değil, backtest dayanıklılığına göre sıralanır.
  if(layerHits<RULE.minLayerHits||tech<RULE.techMin||exec<RULE.execMin)return null;
  const bt=backtest(c,dir);
  // Backtest ön sağlık: ölçülemeyen veya geçmiş performansı tamamen zayıf olanlar elenir.
  if(bt.count<RULE.minBtCount||bt.win<RULE.minBtWin||bt.pf<RULE.minBtPf||bt.fast>RULE.maxBtFast)return null;
  const back=backScore(bt);
  const dataScore=x.source==="REST"?92:x.source==="JSON"?88:82;
  const btRank=backtestRank(bt,st,layerHits,tech,exec,dataScore);
  const model=dir==="LONG"?longModel(scores):shortModel(scores);
  return{sym,tf,dir,model,mode:"TEKNIK GECIS + BACKTEST TOP10",listMode:"BACKTEST EN İYİ",poolClass:tech>=72&&exec>=78&&layerHits>=10?"T1":tech>=66&&exec>=72?"T2":"T3",quality:backtestLabel(btRank),main:true,rankScore:btRank,btRank,tech,exec,back,dataScore,scores,layerHits,bt,...st,ageSec,source:x.source||"JSON"}
}

function poolClass(score,hits){if(score>=76&&hits>=9)return"H1";if(score>=65&&hits>=7)return"H2";return"H3"}
function backScore(b){if(!b||b.count<10)return 50;let s=0;s+=clamp((b.count-15)*1.2,0,20);s+=clamp((b.win-45)*1.15,0,30);s+=clamp((b.pf-1)*15,0,30);s+=clamp((25-b.fast)*.8,0,20);return clamp(s,0,100)}
function backtestRank(bt,st,hits,tech,exec,dataScore){
  // v16.4: Final sıralama ana olarak backtest dayanıklılığıdır.
  // Teknik katman sadece güvenlik kemeridir; teknik bağlamı geçen adaylar arasında kralı backtest seçer.
  const countScore=clamp((bt.count-12)*0.72,0,34);
  const winScore=clamp((bt.win-45)*1.15,0,44);
  const pfScore=clamp(Math.log(Math.max(bt.pf,1))*25,0,46);
  const fastScore=clamp((45-bt.fast)*0.90,0,40);
  const netScore=clamp(bt.net*1.20,0,32);
  const mfeMae=bt.avgMae>0?bt.avgMfe/bt.avgMae:bt.avgMfe;
  const mfeScore=clamp((mfeMae-0.85)*15,0,25);
  const tp2Score=clamp((st.tp2Area-1.20)*7,0,20);
  const sampleBonus=bt.count>=60?12:bt.count>=45?8:bt.count>=30?5:bt.count>=20?2:0;
  const technicalSafety=clamp((hits-5)*1.6+Math.min(tech,exec)*0.06+dataScore*0.03,0,14);
  let s=countScore+winScore+pfScore+fastScore+netScore+mfeScore+tp2Score+sampleBonus+technicalSafety;
  if(bt.count<20)s-=10;
  if(bt.fast>32)s-=12;
  if(bt.pf<1.50)s-=10;
  if(bt.win<50)s-=8;
  if(st.stopPct<0.45||st.stopPct>3.6)s-=8;
  return clamp(s,0,100);
}
function backtestLabel(s){return s>=88?"BT-A+":s>=78?"BT-A":s>=68?"BT-B+":"BT-B"}

function qualityClass(tech,exec,back,bt,st,hits){const fatal=bt.count<20||bt.pf<1.40||bt.win<48||bt.fast>35||st.tp2Area<1.40;let cls="B",main=false;if(!fatal&&bt.count>=55&&bt.pf>=2.60&&bt.win>=62&&bt.fast<=15&&tech>=72&&exec>=84&&back>=82&&st.tp2Area>=2.25&&hits>=9){cls="A+";main=true}else if(!fatal&&bt.count>=45&&bt.pf>=2.10&&bt.win>=58&&bt.fast<=20&&tech>=68&&exec>=80&&back>=76&&st.tp2Area>=1.90&&hits>=8){cls="A";main=true}else if(!fatal&&bt.count>=35&&bt.pf>=1.90&&bt.win>=55&&bt.fast<=23&&tech>=65&&exec>=78&&back>=72&&st.tp2Area>=1.75&&hits>=7){cls="A-";main=true}else if(!fatal&&bt.count>=25&&bt.pf>=1.55&&bt.win>=50&&bt.fast<=30&&hits>=6){cls="B+"}return{cls,main}}
function rankScore(poolScore,tech,exec,back,bt,st,hits,cls,main){const q={"A+":150,"A":115,"A-":82,"B+":32,"B":0,"C":-25}[cls]||0;const pfScore=clamp(Math.min(bt.pf,6)*6,0,36),winScore=clamp((bt.win-48)*.65,0,32),fastPenalty=bt.fast*.85;let s=poolScore*.24+tech*.18+exec*.22+back*.18+pfScore+winScore+Math.min(st.tp2Area,3.5)*7+hits*2.2-fastPenalty+q;const weak=Math.min(tech,exec,back);if(weak<60)s-=45;if(st.stopPct<.55||st.stopPct>3.2)s-=18;if(!main&&cls==="B+")s-=15;return s}
function longModel(s){const a=[];if(s.sr>=55)a.push("destek");if(s.supplyDemand>=55)a.push("demand");if(s.smc>=55)a.push("bullish OB/FVG");if(s.liquidity>=55)a.push("likidite reclaim");if(s.structure>=60)a.push("BOS/CHOCH");if(s.location>=65)a.push("lokasyon");if(s.momentum>=65)a.push("momentum");return"LONG — "+(a.slice(0,5).join(" + ")||"teknik bağlam")}
function shortModel(s){const a=[];if(s.sr>=55)a.push("direnç");if(s.supplyDemand>=55)a.push("supply");if(s.smc>=55)a.push("bearish OB/FVG");if(s.liquidity>=55)a.push("likidite rejection");if(s.structure>=60)a.push("BOS/CHOCH");if(s.location>=65)a.push("lokasyon");if(s.momentum>=65)a.push("momentum");return"SHORT — "+(a.slice(0,5).join(" + ")||"teknik bağlam")}
function backtest(c,dir){let trades=[],cool=0;for(let i=150;i<c.length-25;i++){if(cool>0){cool--;continue}const st=stopTp(c,i,dir);if(st.stopPct>4.2||st.tp2Area<1.2)continue;const sc=trendScore(c,i,dir)+structureScore(c,i,dir)+momentumScore(c,i,dir)+candleScore(c,i,dir)+volumeScore(c,i,dir);if(sc<220)continue;let hit=null,mfe=0,mae=0;for(let j=i+1;j<Math.min(c.length,i+28);j++){const hi=c[j].high,lo=c[j].low;const fav=dir==="LONG"?(hi-st.entry)/st.risk:(st.entry-lo)/st.risk;const adv=dir==="LONG"?(st.entry-lo)/st.risk:(hi-st.entry)/st.risk;mfe=Math.max(mfe,fav);mae=Math.max(mae,adv);if(dir==="LONG"){if(lo<=st.stop){hit="STOP";break}if(hi>=st.t2){hit="TP2";break}if(hi>=st.t1&&!hit)hit="TP1"}else{if(hi>=st.stop){hit="STOP";break}if(lo<=st.t2){hit="TP2";break}if(lo<=st.t1&&!hit)hit="TP1"}}let r=hit==="TP2"?1.85:hit==="TP1"?1.05:hit==="STOP"?-1:(mfe>1?0.4:-0.3);trades.push({r,hit,mfe,mae,fast:hit==="STOP"&&mae<0.75});cool=5}if(!trades.length)return{count:0,win:0,pf:0,fast:100,net:0,avgMfe:0,avgMae:0,trades:[]};const wins=trades.filter(t=>t.r>0),losses=trades.filter(t=>t.r<0);const gp=wins.reduce((a,b)=>a+b.r,0),gl=-losses.reduce((a,b)=>a+b.r,0);return{count:trades.length,win:wins.length/trades.length*100,pf:gp/(gl||.01),fast:trades.filter(t=>t.fast).length/trades.length*100,net:trades.reduce((a,b)=>a+b.r,0),avgMfe:avg(trades.map(t=>t.mfe)),avgMae:avg(trades.map(t=>t.mae)),trades:trades.slice(-10)}}
function selectTopByDir(dir){
  const arr=pool.filter(x=>x.dir===dir).sort((a,b)=>b.rankScore-a.rankScore);
  const selected=[],used=new Set();
  for(const x of arr){
    if(selected.length>=RULE.showEach)break;
    const key=x.sym+"_"+dir;
    if(used.has(key))continue;
    x.listMode=`BACKTEST EN İYİ 7 ${dir}`;
    selected.push(x);
    used.add(key);
  }
  return selected;
}
function renderSummary(){
  const long=pool.filter(x=>x.dir==="LONG"),short=pool.filter(x=>x.dir==="SHORT");
  const topLong=selectTopByDir("LONG"),topShort=selectTopByDir("SHORT");
  scan.passedTech=pool.length;
  $("summary").innerHTML=`<div class="dash"><div><b>${SYMBOLS.length}</b><span>coin evreni</span></div><div><b>${scan.done}/${scan.total}</b><span>sembol/TF analiz</span></div><div><b>${scan.dirChecks}</b><span>yön kontrolü</span></div><div><b>${long.length}</b><span>LONG teknik+BT geçti</span></div><div><b>${short.length}</b><span>SHORT teknik+BT geçti</span></div><div><b>${topLong.length}+${topShort.length}</b><span>ilk 7+7 backtest</span></div><div><b>${scan.rest}</b><span>REST</span></div><div><b>${scan.json}</b><span>JSON</span></div><div><b>${scan.stale}</b><span>canlı alınamadı</span></div><div><b>${scan.out}</b><span>elenen yön</span></div></div><div class="note"><b>v16.4 kuralı:</b> Teknik ve backtest motoru v16.3 ile aynı kalır. Önce tüm teknik analiz argümanları ve bağlamları geçilir: trend, üst zaman, piyasa yapısı, Smart Money, destek/direnç, supply-demand, order block/FVG, likidite, lokasyon, momentum, hacim/para akışı, mum tetik, volatilite ve stop/TP alanı. Sonra final yayın iki ayrı listeye bölünür: backtest dayanıklılığı en iyi 7 LONG ve en iyi 7 SHORT ayrı ayrı sıralanır.</div>`
}
function card(x,i){
  const cls=x.dir==="SHORT"?"short":"long";
  const sc=Math.round(x.rankScore);
  return `<div class="candidate ${cls}" onclick="selectCandidate('${x.key}')"><div class="top"><div><div class="sym">${i+1}) ${x.sym} / ${x.tf}</div><div class="model">${x.dir} — ${x.model.replace(/^LONG — |^SHORT — /,'')}</div></div><div class="score ${x.dir.toLowerCase()}">${sc}<br><span style="font-size:16px">BT</span></div></div><div class="line">Liste modu: ${x.listMode||"BACKTEST EN İYİ"} | Yön: ${x.dir} | Teknik geçiş: ${x.layerHits}/14 | Sınıf: ${x.quality}<br>Teknik bağlam: Teknik ${Math.round(x.tech)} / İcra ${Math.round(x.exec)} / Backtest sağlık ${Math.round(x.back)} / Veri ${x.dataScore}<br>Giriş ${dual(x.entry)}<br>Stop ${dual(x.stop)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2Area,2)}R<br>TP1 ${dual(x.t1)} | TP2 ${dual(x.t2)} | TP3 ${dual(x.t3)}<br><b>Backtest:</b> İşlem ${x.bt.count} | Win ${pct(x.bt.win,1)} | PF ${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)} | Hızlı stop ${pct(x.bt.fast,1)} | Net ${fmt(x.bt.net,2)}R | MFE/MAE ${fmt(x.bt.avgMfe,2)}R/${fmt(x.bt.avgMae,2)}R<br>Veri: ${x.ageSec} sn | Kaynak: ${x.source}</div><div><span class="pill ${x.dir==='LONG'?'green':'red'}">${x.dir} TEKNİK ADAY</span><span class="pill blue">${VERSION}</span><span class="pill amber">BACKTEST SIRALAMA</span><span class="pill amber">${x.quality}</span></div></div>`
}
function renderList(){
  renderSummary();
  pool.forEach((x,idx)=>x.key=x.key||`${x.sym}_${x.tf}_${x.dir}_${idx}`);
  const topLong=selectTopByDir("LONG");
  const topShort=selectTopByDir("SHORT");
  const map=new Map(pool.map(x=>[x.key,x]));
  window.__candMap=map;
  $("list").innerHTML=`<div class="listSection long"><h3>Backtest En İyi 7 LONG</h3><p>Teknik analiz kapısından geçen LONG adayları içinde, backtest dayanıklılığı en yüksek ilk 7 sıralanır.</p>${topLong.length?topLong.map((x,i)=>card(x,i)).join(''):'<p>LONG tarafında teknik + backtest barajını geçen aday yok.</p>'}</div><div class="listSection short"><h3>Backtest En İyi 7 SHORT</h3><p>Teknik analiz kapısından geçen SHORT adayları içinde, backtest dayanıklılığı en yüksek ilk 7 sıralanır.</p>${topShort.length?topShort.map((x,i)=>card(x,i)).join(''):'<p>SHORT tarafında teknik + backtest barajını geçen aday yok.</p>'}</div>`;
  const first=topLong[0]||topShort[0];
  if(first&&!selected)selectCandidate(first.key,true)
}

function selectCandidate(key,silent=false){const x=window.__candMap&&window.__candMap.get(key);if(!x)return;selected=x;$("decision").className="decision "+(x.dir==="LONG"?"long":"short");$("decision").textContent=`${x.sym} ${x.dir} / ${x.tf} — ${x.listMode}`;function m(k,v){return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`}$("metrics").innerHTML=m("BT Sınıf",x.quality)+m("BT Endeks",Math.round(x.btRank))+m("Katman",`${x.layerHits}/14`)+m("Giriş",dual(x.entry))+m("Stop",dual(x.stop))+m("Stop %",pct(x.stopPct,2))+m("TP1",dual(x.t1))+m("TP2",dual(x.t2))+m("TP3",dual(x.t3))+m("Win",pct(x.bt.win,1))+m("PF",x.bt.pf>=20?"20+":fmt(x.bt.pf,2))+m("Hızlı stop",pct(x.bt.fast,1));const qty=RULE.spotTry/(x.entry*(fx.rate||1));const riskTry=Math.abs(x.entry-x.stop)*qty*(fx.rate||1);$("tryPlan").innerHTML=`<b>${x.dir} teknik plan</b><br>Teknik kapı geçilmiş adaydır; final sıralama backtest dayanıklılığına göre yapılır. 10.000 TL varsayımıyla yaklaşık miktar: ${fmt(qty,2)} ${base(x.sym)}. Tahmini risk: ${fmt(riskTry,2)} TL. TP1/TP2/TP3 fiyatları yukarıda.`;$("reasons").innerHTML=Object.entries(x.scores).map(([k,v])=>`<span class="pill ${v>=65?'green':v>=50?'amber':'gray'}">${k}: ${Math.round(v)}</span>`).join('');renderChart(x);renderBt(x);if(!silent)document.getElementById('planBox').scrollIntoView({behavior:'smooth',block:'start'})}
function renderBt(x){const trs=(x.bt.trades||[]).slice(-8);$("bt").innerHTML=`<div class="grid"><div class="metric"><div class="k">İşlem</div><div class="v">${x.bt.count}</div></div><div class="metric"><div class="k">Win</div><div class="v">${pct(x.bt.win,1)}</div></div><div class="metric"><div class="k">PF</div><div class="v">${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)}</div></div><div class="metric"><div class="k">Net R</div><div class="v">${fmt(x.bt.net,2)}</div></div><div class="metric"><div class="k">MFE/MAE</div><div class="v">${fmt(x.bt.avgMfe,2)}R / ${fmt(x.bt.avgMae,2)}R</div></div><div class="metric"><div class="k">Hızlı stop</div><div class="v">${pct(x.bt.fast,1)}</div></div></div><div class="note">Bu sürümde final sıra backtest dayanıklılığına göre verilir: işlem sayısı, win, PF, hızlı stop, net R ve MFE/MAE birlikte okunur.</div>`}
function renderChart(x){const raw=market.data&&market.data[x.sym]&&market.data[x.sym][x.tf];const c=raw?raw.slice(-80):[];const canvas=$("chart"),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);if(!c.length)return;const vals=c.flatMap(z=>[z.high,z.low,x.entry,x.stop,x.t1,x.t2,x.t3]);const mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*.08||1;const y=v=>h-20-(v-(mn-pad))/(mx-mn+pad*2)*(h-40),xpos=i=>20+i*(w-40)/(c.length-1);ctx.lineWidth=3;ctx.strokeStyle="#89aaff";ctx.beginPath();c.forEach((z,i)=>{const xx=xpos(i),yy=y(z.close);if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy)});ctx.stroke();function line(v,col,txt){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();ctx.fillStyle=col;ctx.font="18px Arial";ctx.fillText(txt,24,y(v)-5)}line(x.entry,"#ffd166","Giriş");line(x.stop,"#ff6b8a","Stop");line(x.t1,"#7cff9f","TP1");line(x.t2,"#7cff9f","TP2");line(x.t3,"#7cff9f","TP3")}
async function oneClickScan(){pool=[];selected=null;scan={done:0,total:0,dirChecks:0,passedTech:0,btPassed:0,out:0,json:0,rest:0,stale:0,invalid:0};$("mainBtn").disabled=true;setMeta("Veri bağlantısı kuruluyor...");setBar(0);await loadMarket();await loadFx();await getUniverse();scan.total=SYMBOLS.length*TFS.length;setDataBox();for(const sym of SYMBOLS){for(const tf of TFS){const raw=await getCandles(sym,tf);scan.done++;setBar(scan.done/scan.total*100);if(raw&&raw.length>=220){for(const dir of ["LONG","SHORT"]){scan.dirChecks++;const c=analyzeLast(sym,tf,raw,dir);if(c)pool.push(c);else scan.out++}}else{scan.dirChecks+=2;scan.out+=2}setMeta(`Tarama ${scan.done}/${scan.total} | ${sym} ${tf} | Teknik+BT geçen ${pool.length} | LONG ${pool.filter(x=>x.dir==='LONG').length} | SHORT ${pool.filter(x=>x.dir==='SHORT').length}`);if(scan.done%8===0){renderList();await new Promise(r=>setTimeout(r,0))}}}pool=dedup(pool).sort((a,b)=>b.rankScore-a.rankScore);renderList();setMeta(`Tarama bitti: ${scan.done}/${scan.total} sembol/TF | Yön kontrolü ${scan.dirChecks} | Teknik+BT geçen ${pool.length} | Backtest en iyi 7 LONG + 7 SHORT hazır`);$("mainBtn").disabled=false}
function dedup(arr){const seen=new Map();for(const x of arr){const key=x.sym+"_"+x.tf+"_"+x.dir;const old=seen.get(key);if(!old||x.rankScore>old.rankScore)seen.set(key,x)}return [...seen.values()]}
loadMarket().then(loadFx);
