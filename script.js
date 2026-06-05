const VERSION="v17.6 lokal aynalı BT veto kilidi";
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
  // v16.10: SIRA KİLİTLİDİR. Önce SADECE objektif teknik kapı çalışır ve teknik havuz oluşur.
  // Bu RULE değerleri backtest/etiket standardının korunması için bırakıldı.
  // Teknik havuz kapısı TECH_GATE içinde ölçü birimli olarak Dengeli+ seviyesine alındı.
  techMin:55,
  execMin:62,
  minLayerHits:7,
  stopAtrIdealMin:0.70,
  stopAtrIdealMax:2.40,
  stopAtrHardMin:0.60,
  stopAtrHardMax:3.20,
  minPoolTp2:1.60,
  minBtCount:30,
  minBtWin:52,
  minBtPf:1.50,
  maxBtFast:30,
  showEach:5
};

const TECH_GATE={
  // v16.12: Teknik kapı standardı korunur. Aynı çekirdek hem canlı adayda hem geçmiş backtestte çalışır.
  minLayerHits:6,
  techMin:52,
  execMin:60,
  minPoolTp2:1.50,
  stopAtrMin:0.70,
  stopAtrMax:2.60,
  trendCtxMin:50,
  structureCtxMin:50,
  triggerCtxMin:48,
  executionCtxMin:56,
  contextCountMin:3
};
const BACKTEST_GATE={
  // Final liste kilidi: teknik havuzdan gelen aday, aynalı backtestte bu barajları geçmeden ilk 5'e giremez.
  minCount:30,
  minWin:52,
  minPf:1.50,
  maxFast:30,
  minNet:0,
  minMfeMae:1.20,
  minHealth:50
};
const STRATEGY_GATE={
  // v17.0: Lokal aynalı BT çok nadir kalabilir. Bu yüzden canlı aday önce strateji ailesine bağlanır;
  // strateji ailesinin daha geniş geçmiş örneklemi, final seçimde ana kanıt olarak kullanılır.
  minCount:12,
  minWin:54,
  minPf:1.55,
  maxFast:30,
  minNet:0,
  minMfeMae:1.15,
  minHealth:45,
  // v17.5: Çok detaylı stratejilerde aynı bağlam geçmişte az oluşabilir.
  // Bu yüzden ana kadro ile risk kontrollü agresif kadro ayrılır.
  microCountMin:3,
  microCountMax:11,
  microWin:75,
  microPf:2.00,
  microFast:25,
  microMfeMae:1.50,
  microHealth:55,
  riskCountMin:3,
  riskWin:70,
  riskPf:2.00,
  riskFast:25,
  riskMfeMae:1.35,
  riskHealth:50,
  riskLocalCountMin:8,
  riskLocalWin:62,
  riskLocalPf:1.80,
  riskLocalFast:25,
  riskMinTech:55,
  riskMinExec:70,
  riskMinLayers:8,
  riskMinTp2:1.50,
  // v17.6: Strateji ana kadro değilse mikro sinyalin final açması için lokal aynalı BT negatif olmayacak.
  localSupportCountMin:8,
  localSupportWin:55,
  localSupportPf:1.25,
  localSupportFast:30,
  localSupportMfeMae:1.10
};
const TRADE_GATE={
  // v17.2: Strateji backtest güçlü olsa bile canlı işlem gerçek piyasada uygulanabilir olmalı.
  // Komisyon/spread/kayma ve çok düşük oynaklık yüzünden yapay R şişmesini engeller.
  minStopPct:0.35,
  minTp1Pct:0.45,
  minTp2Pct:0.80,
  minAtrPct:0.25,
  maxStopPct:7.50,
  totalCostPct:0.20,
  tp1CostMultiple:3,
  tp2CostMultiple:5,
  minFinalTech:58,
  minFinalExec:70,
  minFinalTrigger:50,
  pegLow:0.98,
  pegHigh:1.02,
  pegMaxAtrPct:0.25
};
let SYMBOLS=[...DEFAULT_SYMBOLS],market={data:{},generatedAt:null},fx={rate:null,source:"-",ageSec:null},scan={done:0,total:0,dirChecks:0,passedTech:0,btPassed:0,out:0,json:0,rest:0,stale:0,invalid:0,candles:0,restCandles:0,jsonCandles:0,validSets:0,latestCoinAgeSec:null,lastCoinSource:"-"},pool=[],selected=null;
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
function cachedCandleCount(){return Object.values(market.data||{}).reduce((s,v)=>s+TFS.reduce((a,tf)=>a+((v&&v[tf]&&v[tf].length)||0),0),0)}
function setDataBox(){const liveSets=scan.validSets||0;const liveCandles=scan.candles||0;const cached=cachedCandleCount();const ok=liveSets>0||cached>0;const candleText=liveCandles>0?liveCandles:cached;const ageText=scan.latestCoinAgeSec===null?"-":scan.latestCoinAgeSec;const srcText=scan.lastCoinSource||"-";$("dataBox").innerHTML=`Veri: <b class="${ok?'ok':'bad'}">${ok?'BAĞLI':'BEKLEMEDE'}</b> | Coin: ${SYMBOLS.length} | Geçerli set: ${liveSets}/${scan.done||0} | Mum: ${candleText} | Coin veri yaşı: ${ageText} sn | Kaynak: ${srcText} | v17.6 lokal aynalı BT veto`}
function setFxBox(){if(fx.rate)$("fxBox").innerHTML=`Kur: <b>1 USDT ≈ ${fmt(fx.rate,4)} TL</b> | Kaynak: ${fx.source} | Yaş: ${fx.ageSec??'-'} sn`;else $("fxBox").textContent="USDT/TRY kuru alınamadı."}
async function jfetch(url,timeout=12000){const ctrl=new AbortController();const id=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{cache:"no-store",signal:ctrl.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(id)}}
async function loadMarket(){try{const j=await jfetch("data/market.json?v="+Date.now(),9000);market=j||{data:{}};if(j.symbols&&Array.isArray(j.symbols))SYMBOLS=j.symbols.map(cleanSymbol).filter(Boolean).slice(0,UNIVERSE_LIMIT);if(j.fx&&j.fx.usdtTry){fx={rate:Number(j.fx.usdtTry),source:j.fx.source||"market.json",ageSec:Math.floor((now()-Date.parse(j.fx.generatedAt||j.generatedAt||new Date()))/1000)}}sanitizeMarket();setFxBox();setDataBox();return true}catch(e){market={data:{}};setDataBox();return false}}
async function loadFx(){if(fx.rate)return;const urls=["https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY","https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY"];for(const u of urls){try{const j=await jfetch(u,7000);const r=Number(j.price);if(r>10&&r<250){fx={rate:r,source:"Binance USDTTRY",ageSec:0};setFxBox();return}}catch(e){}}fx={rate:45.9,source:"yedek varsayılan",ageSec:null};setFxBox()}
function sanitizeMarket(){const out={};for(const [s,v] of Object.entries(market.data||{})){const cs=cleanSymbol(s);if(!cs){scan.invalid++;continue}out[cs]=out[cs]||{};for(const tf of TFS){const arr=v&&v[tf];if(Array.isArray(arr)&&arr.length)out[cs][tf]=arr.map(k=>({time:+(k.time||k[0]),open:+(k.open||k[1]),high:+(k.high||k[2]),low:+(k.low||k[3]),close:+(k.close||k[4]),volume:+(k.volume||k[5]),closeTime:+(k.closeTime||k[6]||k.time||k[0]),liveTime:k.liveTime}))}}market.data=out}
async function getCandles(sym,tf){
  sym=cleanSymbol(sym);if(!sym)return null;
  // v16.9 CANLI VERİ KORUMA: önce Binance canlı REST denenir.
  // JSON yalnızca REST başarısız olursa ve yaşı ≤300 sn ise yedek olarak kullanılır.
  const urls=[
    `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${RULE.limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${RULE.limit}`
  ];
  for(const url of urls){
    try{
      const fetchedAt=now();
      const raw=await jfetch(url,9000);
      const a=raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6],liveTime:fetchedAt,source:"REST"}));
      if(a&&a.length){scan.rest++;scan.validSets++;scan.candles+=a.length;scan.restCandles+=a.length;scan.latestCoinAgeSec=0;scan.lastCoinSource="REST";return a}
    }catch(e){}
  }
  let arr=market.data&&market.data[sym]&&market.data[sym][tf];
  if(arr&&arr.length>80){
    const last=arr[arr.length-1],t=Number(last.liveTime||market.generatedAt&&Date.parse(market.generatedAt)||last.closeTime||last.time||0);
    if(now()-t<=RULE.maxAgeMs){const age=Math.floor((now()-t)/1000);const out=arr.slice(-RULE.limit).map(x=>({...x,source:"JSON"}));scan.json++;scan.validSets++;scan.candles+=out.length;scan.jsonCandles+=out.length;scan.latestCoinAgeSec=scan.latestCoinAgeSec===null?age:Math.max(scan.latestCoinAgeSec,age);scan.lastCoinSource=scan.lastCoinSource==="REST"?"REST+JSON":"JSON";return out}
  }
  scan.stale++;return null;
}
async function getUniverse(){try{const [ex,ticks]=await Promise.all([jfetch("https://data-api.binance.vision/api/v3/exchangeInfo",10000),jfetch("https://data-api.binance.vision/api/v3/ticker/24hr",10000)]);const allowed=new Set((ex.symbols||[]).filter(x=>x.status==="TRADING"&&x.quoteAsset==="USDT"&&x.isSpotTradingAllowed!==false).map(x=>x.symbol));const arr=(ticks||[]).filter(t=>{const s=cleanSymbol(t.symbol);if(!s||!allowed.has(s))return false;return Number(t.quoteVolume||0)>150000&&Number(t.lastPrice||0)>0&&Number(t.count||0)>50}).sort((a,b)=>Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,UNIVERSE_LIMIT).map(t=>cleanSymbol(t.symbol));if(arr.length>=80)SYMBOLS=arr}catch(e){}SYMBOLS=[...new Set(SYMBOLS.map(cleanSymbol).filter(Boolean))].slice(0,UNIVERSE_LIMIT)}
function ema(values,len){const k=2/(len+1),out=[];let e=values[0];for(let i=0;i<values.length;i++){e=i?values[i]*k+e*(1-k):values[i];out.push(e)}return out}
function smaArr(values,len){const out=[];let sum=0;for(let i=0;i<values.length;i++){sum+=values[i]||0;if(i>=len)sum-=values[i-len]||0;out.push(i>=len-1?sum/len:sum/(i+1))}return out}
function rma(values,len){const out=[];let r=values[0]||0;for(let i=0;i<values.length;i++){r=i?(r*(len-1)+(values[i]||0))/len:(values[i]||0);out.push(r)}return out}
function percentileOf(arr,v){if(!arr||!arr.length||!isFinite(v))return 50;let n=arr.filter(x=>isFinite(x)&&x<=v).length;return n/arr.length*100}
function enrich(raw){
  const c=raw.map(x=>({...x})).filter(x=>isFinite(x.close)&&isFinite(x.high)&&isFinite(x.low)&&isFinite(x.open));
  const closes=c.map(x=>x.close),highs=c.map(x=>x.high),lows=c.map(x=>x.low),vols=c.map(x=>x.volume||0);
  const e21=ema(closes,21),e55=ema(closes,55),e100=ema(closes,100),e200=ema(closes,200);
  let gain=0,loss=0,obv=0,obvs=[],trs=[],plusDM=[],minusDM=[],typ=[],mfRaw=[],mfq=[];
  for(let i=0;i<c.length;i++){
    const x=c[i],p=c[i-1]||x,chg=x.close-p.close;
    gain=(gain*13+Math.max(chg,0))/14;loss=(loss*13+Math.max(-chg,0))/14;
    const up=x.high-p.high,down=p.low-x.low;
    plusDM.push(up>down&&up>0?up:0);minusDM.push(down>up&&down>0?down:0);
    const tr=Math.max(x.high-x.low,Math.abs(x.high-p.close),Math.abs(x.low-p.close));trs.push(tr);
    obv+=chg>0?vols[i]:chg<0?-vols[i]:0;obvs.push(obv);
    const tp=(x.high+x.low+x.close)/3;typ.push(tp);mfRaw.push(tp*vols[i]);
    const mfm=(x.high===x.low)?0:((x.close-x.low)-(x.high-x.close))/(x.high-x.low);mfq.push(mfm*vols[i]);
    x.rsi=100-100/(1+(gain/(loss||1e-9)));x.e21=e21[i];x.e55=e55[i];x.e100=e100[i];x.e200=e200[i];x.tr=tr;x.obv=obv;
  }
  const atr=rma(trs,14),pdm=rma(plusDM,14),mdm=rma(minusDM,14);
  const pdi=pdm.map((v,i)=>100*v/(atr[i]||1)),mdi=mdm.map((v,i)=>100*v/(atr[i]||1));
  const dx=pdi.map((v,i)=>100*Math.abs(v-mdi[i])/((v+mdi[i])||1));const adx=rma(dx,14);
  const ef=ema(closes,12),es=ema(closes,26),macd=ef.map((v,i)=>v-es[i]),sig=ema(macd,9);const hist=macd.map((v,i)=>v-sig[i]);
  for(let i=0;i<c.length;i++){
    const start20=Math.max(0,i-19),start14=Math.max(0,i-13),start100=Math.max(0,i-99);
    const vs=vols.slice(start20,i+1),mfs=mfq.slice(start20,i+1),cls20=closes.slice(start20,i+1),tp20=typ.slice(start20,i+1),vs100=vols.slice(start100,i+1);
    const hi14=Math.max(...highs.slice(start14,i+1)),lo14=Math.min(...lows.slice(start14,i+1));
    const k=hi14===lo14?50:(c[i].close-lo14)/(hi14-lo14)*100;
    const sma20=avg(cls20)||c[i].close,sd20=std(cls20),volAvg=avg(vs)||1,volSd=std(vs)||1;
    const posMF=[],negMF=[];for(let j=Math.max(1,i-13);j<=i;j++){if(typ[j]>typ[j-1])posMF.push(mfRaw[j]);else if(typ[j]<typ[j-1])negMF.push(mfRaw[j])}
    const pos=posMF.reduce((a,b)=>a+b,0),neg=negMF.reduce((a,b)=>a+b,0);const mfr=pos/(neg||1e-9);
    const md=avg(tp20.map(v=>Math.abs(v-(avg(tp20)||v))))||1e-9;
    c[i].atr=atr[i];c[i].atrPct=atr[i]/(c[i].close||1)*100;c[i].atrPercentile=percentileOf(atr.slice(start100,i+1),atr[i]);
    c[i].plusDI=pdi[i];c[i].minusDI=mdi[i];c[i].adx=adx[i];
    c[i].macd=macd[i];c[i].macdSig=sig[i];c[i].hist=hist[i];
    c[i].stochK=k;c[i].stochD=avg([k,(c[i-1]&&c[i-1].stochK)||k,(c[i-2]&&c[i-2].stochK)||k]);
    c[i].mfi=100-100/(1+mfr);c[i].cci=(typ[i]-(avg(tp20)||typ[i]))/(0.015*md);
    c[i].volAvg=volAvg;c[i].volumeRatio=(c[i].volume||0)/volAvg;c[i].volumeZ=((c[i].volume||0)-volAvg)/volSd;c[i].volumePercentile=percentileOf(vs100,c[i].volume||0);
    c[i].cmf=mfs.reduce((a,b)=>a+b,0)/(vs.reduce((a,b)=>a+b,0)||1);c[i].obvSlope=obvs[i]-(obvs[Math.max(0,i-10)]||0);
    c[i].bbWidth=(4*sd20/(sma20||1))*100;c[i].bbWidthPercentile=percentileOf(c.slice(start100,i+1).map(z=>z.bbWidth||0),c[i].bbWidth||0);
    c[i].ema55SlopeATR=((c[i].e55-(c[Math.max(0,i-5)].e55||c[i].e55))/(c[i].atr||1));
  }
  return c
}
function std(a){const m=avg(a);return Math.sqrt(avg(a.map(x=>(x-m)*(x-m)))||0)}
function zone(c,i,dir,len=80){const s=c.slice(Math.max(0,i-len),i);if(s.length<20)return {level:c[i].close,dist:9,touches:0,reactionATR:0};const lvl=dir==="LONG"?Math.min(...s.map(x=>x.low)):Math.max(...s.map(x=>x.high));const atr=c[i].atr||((c[i].high-c[i].low)||1);const dist=Math.abs(c[i].close-lvl)/(atr||1);const touches=s.filter(x=>dir==="LONG"?Math.abs(x.low-lvl)<=atr*.30:Math.abs(x.high-lvl)<=atr*.30).length;let reactionATR=0;for(let k=0;k<s.length-3;k++){if(dir==="LONG"&&Math.abs(s[k].low-lvl)<=atr*.30)reactionATR=Math.max(reactionATR,(Math.max(s[k+1].high,s[k+2].high,s[k+3].high)-lvl)/atr);if(dir==="SHORT"&&Math.abs(s[k].high-lvl)<=atr*.30)reactionATR=Math.max(reactionATR,(lvl-Math.min(s[k+1].low,s[k+2].low,s[k+3].low))/atr)}return {level:lvl,dist,touches,reactionATR}}
function swings(c,i){const s=c.slice(Math.max(0,i-120),i);let ph=[],pl=[];for(let k=2;k<s.length-2;k++){if(s[k].high>s[k-1].high&&s[k].high>s[k-2].high&&s[k].high>s[k+1].high&&s[k].high>s[k+2].high)ph.push(s[k].high);if(s[k].low<s[k-1].low&&s[k].low<s[k-2].low&&s[k].low<s[k+1].low&&s[k].low<s[k+2].low)pl.push(s[k].low)}return{ph,pl,lastH:ph.at(-1)||Math.max(...s.map(x=>x.high)),lastL:pl.at(-1)||Math.min(...s.map(x=>x.low)),prevH:ph.at(-2)||ph.at(-1)||0,prevL:pl.at(-2)||pl.at(-1)||0,lastLH:ph.at(-1)||0,lastHL:pl.at(-1)||0}}
function candleScore(c,i,dir){const x=c[i],p=c[i-1]||x;const range=Math.max(x.high-x.low,1e-9),body=Math.abs(x.close-x.open),upper=x.high-Math.max(x.close,x.open),lower=Math.min(x.close,x.open)-x.low;const bodyRatio=body/range,upperRatio=upper/range,lowerRatio=lower/range,closePos=(x.close-x.low)/range;let s=0;if(bodyRatio>=.35)s+=20;if(dir==="LONG"){if(lowerRatio>=.28)s+=25;if(closePos>=.58)s+=25;if(x.close>p.high)s+=20;if(p.close<p.open&&x.close>x.open&&body>Math.abs(p.close-p.open))s+=20}else{if(upperRatio>=.28)s+=25;if(closePos<=.42)s+=25;if(x.close<p.low)s+=20;if(p.close>p.open&&x.close<x.open&&body>Math.abs(p.close-p.open))s+=20}return clamp(s,0,100)}
function structureScore(c,i,dir){const x=c[i],sw=swings(c,i),a=x.atr||1;let s=0;if(dir==="LONG"){if(x.close>sw.lastH+.10*a)s+=35;if(sw.lastL>sw.prevL)s+=25;if(sw.lastH>sw.prevH)s+=15;if(x.close>x.e55)s+=10;if(x.e21>=x.e55)s+=15}else{if(x.close<sw.lastL-.10*a)s+=35;if(sw.lastH<sw.prevH)s+=25;if(sw.lastL<sw.prevL)s+=15;if(x.close<x.e55)s+=10;if(x.e21<=x.e55)s+=15}return clamp(s,0,100)}
function smcScore(c,i,dir){const x=c[i],a=x.atr||1,prior=c.slice(Math.max(0,i-40),i);const minL=Math.min(...prior.map(z=>z.low)),maxH=Math.max(...prior.map(z=>z.high));let fvg=0,ob=0,sweep=0;if(i>3){const a2=c[i-2];if(dir==="LONG"&&a2.high<x.low){const size=(x.low-a2.high)/a;if(size>=.15)fvg=30}if(dir==="SHORT"&&a2.low>x.high){const size=(a2.low-x.high)/a;if(size>=.15)fvg=30}}for(let k=Math.max(1,i-16);k<i;k++){const z=c[k],n=c[k+1];if(dir==="LONG"&&z.close<z.open&&n.close>z.high+a*.30)ob=Math.max(ob,30);if(dir==="SHORT"&&z.close>z.open&&n.close<z.low-a*.30)ob=Math.max(ob,30)}if(dir==="LONG"&&x.low<minL-.15*a&&x.close>minL)sweep=40;if(dir==="SHORT"&&x.high>maxH+.15*a&&x.close<maxH)sweep=40;return clamp(fvg+ob+sweep,0,100)}
function supportResistanceScore(c,i,dir){const x=c[i],z=zone(c,i,dir),sw=swings(c,i),a=x.atr||1;let s=0;if(z.dist<=1.00)s+=35;if(z.dist<=.50)s+=15;if(z.touches>=2&&z.touches<=6)s+=25;if(z.reactionATR>=.40)s+=15;if(dir==="LONG"&&Math.abs(x.close-sw.lastL)<=a*1.00)s+=10;if(dir==="SHORT"&&Math.abs(x.close-sw.lastH)<=a*1.00)s+=10;return clamp(s,0,100)}
function supplyDemandScore(c,i,dir){const x=c[i],a=x.atr||1;let score=0;for(let k=Math.max(3,i-60);k<i-1;k++){const z=c[k],n=c[k+1],imp=Math.abs(n.close-z.close)/(a||1);if(dir==="LONG"&&z.close<z.open&&n.close>z.high&&imp>=.50){const dist=Math.abs(x.close-z.low)/a;if(dist<=1.00)score=Math.max(score,80-dist*22)}if(dir==="SHORT"&&z.close>z.open&&n.close<z.low&&imp>=.50){const dist=Math.abs(x.close-z.high)/a;if(dist<=1.00)score=Math.max(score,80-dist*22)}}return clamp(score,0,100)}
function liquidityScore(c,i,dir){const x=c[i],a=x.atr||1,prior=c.slice(Math.max(0,i-55),i);const lows=prior.map(z=>z.low),highs=prior.map(z=>z.high);const minL=Math.min(...lows),maxH=Math.max(...highs);const eqL=lows.filter(v=>Math.abs(v-minL)<=a*.15).length,eqH=highs.filter(v=>Math.abs(v-maxH)<=a*.15).length;let s=0;if(dir==="LONG"){if(eqL>=2)s+=25;if(x.low<minL-.15*a&&x.close>minL)s+=60;if(x.close>x.open&&x.low<=minL+a*.35)s+=15}else{if(eqH>=2)s+=25;if(x.high>maxH+.15*a&&x.close<maxH)s+=60;if(x.close<x.open&&x.high>=maxH-a*.35)s+=15}return clamp(s,0,100)}
function locationScore(c,i,dir){const x=c[i],a=x.atr||1,z=zone(c,i,dir);const emaDist=Math.min(Math.abs(x.close-x.e21),Math.abs(x.close-x.e55))/(a||1);let s=0;if(z.dist<=1.00)s+=45;if(emaDist<=.70)s+=25;if(dir==="LONG"){if(x.close>=x.e55-.50*a)s+=15;if(x.low<=x.e21+.50*a||x.low<=x.e55+.60*a)s+=15}else{if(x.close<=x.e55+.50*a)s+=15;if(x.high>=x.e21-.50*a||x.high>=x.e55-.60*a)s+=15}return clamp(s,0,100)}
function regimeScore(sym,tf,dir){const raw=market.data&&market.data["BTCUSDT"]&&(market.data["BTCUSDT"][tf]||market.data["BTCUSDT"][NEXT_TF[tf]]);if(!raw||raw.length<80||sym==="BTCUSDT")return 65;const c=enrich(raw),i=c.length-1,x=c[i],p=c[Math.max(0,i-4)];const change1h=(x.close-p.close)/p.close*100;let s=50;if(dir==="LONG"){if(x.ema55SlopeATR>=-.05)s+=25;if(change1h>=-1.20)s+=20;if(x.macd>=x.macdSig)s+=10}else{if(x.ema55SlopeATR<=+.05)s+=25;if(change1h<=+1.20)s+=20;if(x.macd<=x.macdSig)s+=10}return clamp(s,0,100)}
function momentumScore(c,i,dir){const x=c[i],p3=c[Math.max(0,i-3)]||x;let s=0;if(dir==="LONG"){if(x.rsi>=35&&x.rsi<=65)s+=20;if(x.rsi-x.rsi<=0){} if(x.rsi-p3.rsi>0)s+=15;if(x.rsi<=75)s+=10;if(x.macd>x.macdSig)s+=15;if(x.hist>(c[i-1]?.hist??x.hist)&&(c[i-1]?.hist??x.hist)>=(c[i-2]?.hist??x.hist))s+=15;if(x.plusDI-x.minusDI>=2)s+=10;if(x.stochK>x.stochD&&x.stochK<80)s+=8;if(x.mfi>=45||x.mfi>p3.mfi)s+=7;if(x.cci>-100&&x.cci>(p3.cci||x.cci))s+=5}else{if(x.rsi>=35&&x.rsi<=65)s+=20;if(x.rsi-p3.rsi<0)s+=15;if(x.rsi>=25)s+=10;if(x.macd<x.macdSig)s+=15;if(x.hist<(c[i-1]?.hist??x.hist)&&(c[i-1]?.hist??x.hist)<=(c[i-2]?.hist??x.hist))s+=15;if(x.minusDI-x.plusDI>=2)s+=10;if(x.stochK<x.stochD&&x.stochK>20)s+=8;if(x.mfi<=55||x.mfi<p3.mfi)s+=7;if(x.cci<100&&x.cci<(p3.cci||x.cci))s+=5}return clamp(s,0,100)}
function volumeScore(c,i,dir){const x=c[i];let s=0;if(x.volumeRatio>=.90)s+=20;if(x.volumeRatio>=1.20)s+=15;if(x.volumeZ>=-.20)s+=15;if(x.volumeZ>=.50)s+=10;if(x.volumePercentile>=50)s+=10;if(x.volumePercentile>=70)s+=10;if(dir==="LONG"){if(x.cmf>=-.03)s+=15;if(x.cmf>=.05)s+=5;if(x.obvSlope>0)s+=10}else{if(x.cmf<=.03)s+=15;if(x.cmf<=-.05)s+=5;if(x.obvSlope<0)s+=10}return clamp(s,0,100)}
function trendScore(c,i,dir){const x=c[i];let sc=0;if(dir==="LONG"){if(x.e21>=x.e55)sc+=15;if(x.e21>x.e55&&x.e55>x.e100)sc+=15;if(x.ema55SlopeATR>=0)sc+=15;if(x.ema55SlopeATR>=.10)sc+=10;if(x.close>=x.e55-.50*x.atr)sc+=10;if(x.adx>=18)sc+=15;if(x.adx>=25)sc+=5;if(x.plusDI>x.minusDI)sc+=10;if(x.plusDI-x.minusDI>=2)sc+=5}else{if(x.e21<=x.e55)sc+=15;if(x.e21<x.e55&&x.e55<x.e100)sc+=15;if(x.ema55SlopeATR<=0)sc+=15;if(x.ema55SlopeATR<=-.10)sc+=10;if(x.close<=x.e55+.50*x.atr)sc+=10;if(x.adx>=18)sc+=15;if(x.adx>=25)sc+=5;if(x.minusDI>x.plusDI)sc+=10;if(x.minusDI-x.plusDI>=2)sc+=5}return clamp(sc,0,100)}
function upperTfScore(sym,tf,dir){const up=NEXT_TF[tf];const raw=market.data&&market.data[sym]&&market.data[sym][up];if(!raw||raw.length<80)return 55;const c=enrich(raw),i=c.length-1,x=c[i];let sc=50;if(dir==="LONG"){if(x.ema55SlopeATR>=0)sc+=25;if(x.e21>=x.e55)sc+=15;if(x.rsi>=45)sc+=10;if(x.ema55SlopeATR<-.10)sc-=30}else{if(x.ema55SlopeATR<=0)sc+=25;if(x.e21<=x.e55)sc+=15;if(x.rsi<=55)sc+=10;if(x.ema55SlopeATR>.10)sc-=30}return clamp(sc,0,100)}
function stopTp(c,i,dir){const x=c[i],sw=swings(c,i),a=x.atr||Math.max(x.high-x.low,1e-9),entry=x.close;let stop,nearTarget;if(dir==="LONG"){stop=Math.min(sw.lastL-.10*a,entry-RULE.stopAtrIdealMin*a);nearTarget=sw.lastH>entry?sw.lastH:entry+a*2.2}else{stop=Math.max(sw.lastH+.10*a,entry+RULE.stopAtrIdealMin*a);nearTarget=sw.lastL<entry?sw.lastL:entry-a*2.2}const risk=Math.abs(entry-stop)||a,stopPct=risk/entry*100,stopAtr=risk/a;const t1=dir==="LONG"?entry+risk*1.05:entry-risk*1.05,t2=dir==="LONG"?entry+risk*1.85:entry-risk*1.85,t3=dir==="LONG"?entry+risk*2.65:entry-risk*2.65;const area=Math.abs(nearTarget-entry)/risk;const tp1Pct=Math.abs(t1-entry)/entry*100,tp2Pct=Math.abs(t2-entry)/entry*100,tp3Pct=Math.abs(t3-entry)/entry*100;let stopQ=0;if(stopAtr>=RULE.stopAtrIdealMin&&stopAtr<=RULE.stopAtrIdealMax)stopQ=100;else if(stopAtr>=RULE.stopAtrHardMin&&stopAtr<RULE.stopAtrIdealMin)stopQ=60;else if(stopAtr>RULE.stopAtrIdealMax&&stopAtr<=RULE.stopAtrHardMax)stopQ=55;let tpQ=clamp(area/RULE.minPoolTp2*100,0,100);return{entry,stop,t1,t2,t3,risk,stopPct,stopAtr,tp1Pct,tp2Pct,tp3Pct,tp2Area:area,stopQ:clamp(stopQ,0,100),tpQ}}
function volatilityScore(c,i,st){const x=c[i];let s=0;if(x.atrPct>=.30&&x.atrPct<=6.00)s+=25;if(x.atrPercentile>=20&&x.atrPercentile<=85)s+=25;const rangeATR=(x.high-x.low)/(x.atr||1);if(rangeATR<=2.00)s+=20;if(x.bbWidthPercentile>=15&&x.bbWidthPercentile<=85)s+=15;if(st.stopAtr>=RULE.stopAtrIdealMin&&st.stopAtr<=RULE.stopAtrIdealMax)s+=15;return clamp(s,0,100)}

function tradeability(c,i,st,ctx,tech,exec){
  const x=c[i]||{};
  const reasons=[];
  const totalCost=TRADE_GATE.totalCostPct;
  const tp1Need=Math.max(TRADE_GATE.minTp1Pct,totalCost*TRADE_GATE.tp1CostMultiple);
  const tp2Need=Math.max(TRADE_GATE.minTp2Pct,totalCost*TRADE_GATE.tp2CostMultiple);
  if(st.stopPct<TRADE_GATE.minStopPct)reasons.push(`stopPct ${fmt(st.stopPct,2)}<${TRADE_GATE.minStopPct}`);
  if(st.stopPct>TRADE_GATE.maxStopPct)reasons.push(`stopPct ${fmt(st.stopPct,2)}>${TRADE_GATE.maxStopPct}`);
  if((st.tp1Pct||0)<tp1Need)reasons.push(`TP1% ${fmt(st.tp1Pct||0,2)}<${fmt(tp1Need,2)}`);
  if((st.tp2Pct||0)<tp2Need)reasons.push(`TP2% ${fmt(st.tp2Pct||0,2)}<${fmt(tp2Need,2)}`);
  if((x.atrPct||0)<TRADE_GATE.minAtrPct)reasons.push(`ATR% ${fmt(x.atrPct||0,2)}<${TRADE_GATE.minAtrPct}`);
  if(st.entry>=TRADE_GATE.pegLow&&st.entry<=TRADE_GATE.pegHigh&&(x.atrPct||0)<TRADE_GATE.pegMaxAtrPct)reasons.push(`PEG/düşük oynaklık: fiyat ${fmt(st.entry,4)}, ATR% ${fmt(x.atrPct||0,2)}`);
  if(tech<TRADE_GATE.minFinalTech)reasons.push(`canlı teknik ${Math.round(tech)}<${TRADE_GATE.minFinalTech}`);
  if(exec<TRADE_GATE.minFinalExec)reasons.push(`canlı icra ${Math.round(exec)}<${TRADE_GATE.minFinalExec}`);
  if((ctx?.triggerCtx||0)<TRADE_GATE.minFinalTrigger)reasons.push(`tetik ${Math.round(ctx?.triggerCtx||0)}<${TRADE_GATE.minFinalTrigger}`);
  const costR=totalCost/Math.max(st.stopPct,0.01);
  const rrInflated=(st.stopPct<TRADE_GATE.minStopPct&&st.tp2Area>=3.0);
  if(rrInflated)reasons.push(`R şişmesi: stop% ${fmt(st.stopPct,2)} ve TP2 ${fmt(st.tp2Area,2)}R`);
  return {ok:reasons.length===0,reasons,totalCostPct:totalCost,tp1Need,tp2Need,costR};
}
function tradeFailText(x){return x.tradeOk?'trade edilebilir':(x.tradeReasons&&x.tradeReasons.length?x.tradeReasons.join(' | '):'trade kapısı geçmedi')}

function contextGate(scores,st){
  // v16.9 dengeli bağlam kapısı: tek tek skor değil, teknik bağların birlikte çalışması ölçülür.
  // Her grup objektif alt metriklerden oluşur; grup geçişi için eşikler sabittir.
  const trendCtx=avg([scores.trend,scores.regime,scores.upper]);
  const structureCtx=avg([scores.structure,scores.smc,scores.sr,scores.supplyDemand,scores.liquidity,scores.location]);
  const triggerCtx=avg([scores.momentum,scores.flow,scores.candle]);
  const executionCtx=avg([scores.volatility,scores.stopTp,scores.location]);
  const passed={
    trend: trendCtx>=TECH_GATE.trendCtxMin,
    structure: structureCtx>=TECH_GATE.structureCtxMin,
    trigger: triggerCtx>=TECH_GATE.triggerCtxMin,
    execution: executionCtx>=TECH_GATE.executionCtxMin && st.tp2Area>=TECH_GATE.minPoolTp2 && st.stopAtr>=TECH_GATE.stopAtrMin && st.stopAtr<=TECH_GATE.stopAtrMax
  };
  const count=Object.values(passed).filter(Boolean).length;
  // Bilimsel Dengeli+ bağ kuralı: İcra zorunlu; en az 3/4 bağ geçmeli; yön bağı için trend veya yapı-lokasyon bağından biri zorunlu.
  return {trendCtx,structureCtx,triggerCtx,executionCtx,passed,count,ok:count>=TECH_GATE.contextCountMin && passed.execution && (passed.structure || passed.trend)};
}


function buildTechnicalScores(c,i,dir,st,sym,tf,mode){
  // Aynalı teknik çekirdek: canlı tarama ve geçmiş backtest aynı lokal teknik argümanları ölçer.
  // Üst zaman/BTC bağlamı geçmiş mumda birebir zaman eşlemesi yoksa nötr 55 alınır; canlı son barda gerçek kaynak varsa kullanılır.
  const live=mode!=="backtest";
  const scores={
    trend:trendScore(c,i,dir),
    regime:live?regimeScore(sym,tf,dir):55,
    upper:live?upperTfScore(sym,tf,dir):55,
    structure:structureScore(c,i,dir),smc:smcScore(c,i,dir),sr:supportResistanceScore(c,i,dir),
    supplyDemand:supplyDemandScore(c,i,dir),liquidity:liquidityScore(c,i,dir),location:locationScore(c,i,dir),
    momentum:momentumScore(c,i,dir),flow:volumeScore(c,i,dir),candle:candleScore(c,i,dir),volatility:0,stopTp:0
  };
  scores.volatility=volatilityScore(c,i,st);
  scores.stopTp=clamp(st.stopQ*.55+st.tpQ*.45,0,100);
  return scores;
}
function technicalEval(c,i,dir,sym="",tf="",mode="live"){
  if(!c||i<160||i>=c.length)return null;
  const st=stopTp(c,i,dir);
  if(st.stopAtr<TECH_GATE.stopAtrMin||st.stopAtr>TECH_GATE.stopAtrMax||st.tp2Area<TECH_GATE.minPoolTp2)return null;
  const scores=buildTechnicalScores(c,i,dir,st,sym,tf,mode);
  const layerHits=Object.values(scores).filter(v=>v>=55).length;
  const ctx=contextGate(scores,st);
  const tech=clamp(avg([scores.trend,scores.regime,scores.upper,scores.structure,scores.smc,scores.sr,scores.supplyDemand,scores.liquidity,scores.location,scores.momentum,scores.flow,scores.candle,scores.volatility,scores.stopTp]),0,100);
  const exec=clamp(avg([scores.location,scores.sr,scores.supplyDemand,scores.liquidity,scores.candle,scores.stopTp,scores.volatility])+Math.min(st.tp2Area,3.2)*4,0,100);
  const ok=layerHits>=TECH_GATE.minLayerHits && tech>=TECH_GATE.techMin && exec>=TECH_GATE.execMin && ctx.ok;
  return {ok,st,scores,layerHits,ctx,tech,exec};
}
function backtestEligible(bt,back){
  const mfeMae=bt&&bt.avgMae>0?bt.avgMfe/bt.avgMae:(bt?bt.avgMfe:0);
  return !!bt && bt.count>=BACKTEST_GATE.minCount && bt.win>=BACKTEST_GATE.minWin && bt.pf>=BACKTEST_GATE.minPf && bt.fast<=BACKTEST_GATE.maxFast && bt.net>BACKTEST_GATE.minNet && mfeMae>=BACKTEST_GATE.minMfeMae && back>=BACKTEST_GATE.minHealth;
}

function analyzeLast(sym,tf,raw,dir){
  if(!raw||raw.length<220)return null;
  const c=enrich(raw),i=c.length-1,x=c[i];
  const ageSec=Math.max(0,Math.floor((now()-(x.liveTime||x.closeTime||x.time||now()))/1000));
  if(ageSec>RULE.maxAgeMs/1000)return null;
  if(String(x.source||"").includes("STALE"))return null;
  const ev=technicalEval(c,i,dir,sym,tf,"live");
  if(!ev||!ev.ok)return null;
  const {st,scores,layerHits,ctx,tech,exec}=ev;
  const dataScore=x.source==="REST"?92:x.source==="JSON"?88:82;
  const localBt=backtest(c,dir,sym,tf);
  const localBack=backScore(localBt);
  const matches=matchingStrategies(scores,st,dir);
  if(!matches.length)return null;
  let chosen=null;
  for(const strat of matches){
    const sbt=strategyBacktest(c,dir,strat);
    const shealth=strategyHealth(sbt);
    const sok=strategyEligible(sbt,shealth);
    const mok=strategyMicroEligible(sbt,shealth,tech,exec,st,layerHits);
    const rank=strategyRankScore(sbt,localBt,st,tech,exec,dataScore,shealth,mok)+(sok?10:0)+(mok?6:0);
    if(!chosen||rank>chosen.rank)chosen={strategy:strat,strategyBt:sbt,strategyBack:shealth,strategyOk:sok,microOk:mok,rank};
  }
  const {strategy,strategyBt,strategyBack,strategyOk,microOk}=chosen;
  const trade=tradeability(c,i,st,ctx,tech,exec);
  // v17.6: Ana strateji BT güçlü ise ana kadro çalışır. Strateji mikro ise final açması için
  // lokal aynalı BT de pozitif olmak zorunda; lokal win/PF/net negatifse mikro sinyal veto edilir.
  const localSupportOk=localSupportEligible(localBt);
  const microFinalOk=microOk&&localSupportOk;
  const localVeto=microOk&&!localSupportOk&&!strategyOk;
  const riskOk=controlledRiskEligible(strategyBt,localBt,strategyBack,tech,exec,st,layerHits);
  const preOk=strategyOk||microFinalOk||riskOk;
  const btOk=preOk&&trade.ok;
  const btRank=clamp(chosen.rank + (riskOk?8:0) + (microFinalOk?4:0) + (trade.ok?6:-18) - (localVeto?18:0) - (trade.costR>0.5?8:0),0,100);
  const q=strategyQualityClass(strategyOk,microOk,riskOk,strategyBt,localBt,strategyBack,tech,exec,st,layerHits,localSupportOk);
  const model=strategy.name;
  return{sym,tf,dir,model,strategy,matchedStrategies:matches.map(m=>m.id).join(","),mode:"AYNALI STRATEJI BACKTEST + LOKAL VETO",listMode:"TEKNIK HAVUZ / STRATEJI BT DENETIM",poolClass:poolClass(tech,layerHits),quality:q.cls,main:q.main,btOk,strategyOk,microOk,microFinalOk,localSupportOk,localVeto,riskOk,tradeOk:trade.ok,tradeReasons:trade.reasons,tradeCostPct:trade.totalCostPct,tradeCostR:trade.costR,tp1Need:trade.tp1Need,tp2Need:trade.tp2Need,rankScore:btRank,btRank,tech,exec,back:localBack,strategyHealth:strategyBack,dataScore,scores,context:ctx,layerHits,bt:localBt,strategyBt,...st,ageSec,source:x.source||"JSON",atrPct:x.atrPct}
}

function btMfeMae(b){return b&&b.avgMae>0?b.avgMfe/b.avgMae:(b?b.avgMfe:0)}
function localSupportEligible(localBt){
  const lm=btMfeMae(localBt);
  return !!localBt && localBt.count>=STRATEGY_GATE.localSupportCountMin && localBt.win>=STRATEGY_GATE.localSupportWin && localBt.pf>=STRATEGY_GATE.localSupportPf && localBt.fast<=STRATEGY_GATE.localSupportFast && localBt.net>0 && lm>=STRATEGY_GATE.localSupportMfeMae;
}
function localFailReasons(localBt){
  const lm=btMfeMae(localBt||{}),r=[];
  if(!localBt||localBt.count<STRATEGY_GATE.localSupportCountMin)r.push(`lokal işlem ${localBt?.count||0}<${STRATEGY_GATE.localSupportCountMin}`);
  if((localBt?.win||0)<STRATEGY_GATE.localSupportWin)r.push(`lokal win ${fmt(localBt?.win||0,1)}<${STRATEGY_GATE.localSupportWin}`);
  if((localBt?.pf||0)<STRATEGY_GATE.localSupportPf)r.push(`lokal PF ${fmt(localBt?.pf||0,2)}<${STRATEGY_GATE.localSupportPf}`);
  if((localBt?.fast||0)>STRATEGY_GATE.localSupportFast)r.push(`lokal hızlı stop ${fmt(localBt?.fast||0,1)}>${STRATEGY_GATE.localSupportFast}`);
  if((localBt?.net||0)<=0)r.push(`lokal netR ${fmt(localBt?.net||0,2)}≤0`);
  if(lm<STRATEGY_GATE.localSupportMfeMae)r.push(`lokal MFE/MAE ${fmt(lm,2)}<${STRATEGY_GATE.localSupportMfeMae}`);
  return r.join(' | ');
}
function controlledRiskEligible(stratBt,localBt,stratHealth,tech,exec,st,layers){
  const sm=btMfeMae(stratBt),lm=btMfeMae(localBt);
  const strategyMicroStrong=!!stratBt && stratBt.count>=STRATEGY_GATE.riskCountMin && stratBt.count<STRATEGY_GATE.minCount && stratBt.win>=STRATEGY_GATE.riskWin && stratBt.pf>=STRATEGY_GATE.riskPf && stratBt.fast<=STRATEGY_GATE.riskFast && stratBt.net>0 && sm>=STRATEGY_GATE.riskMfeMae && stratHealth>=STRATEGY_GATE.riskHealth;
  const localConfirm=!!localBt && localBt.count>=STRATEGY_GATE.riskLocalCountMin && localBt.win>=STRATEGY_GATE.riskLocalWin && localBt.pf>=STRATEGY_GATE.riskLocalPf && localBt.fast<=STRATEGY_GATE.riskLocalFast && localBt.net>0 && lm>=1.25;
  const liveOk=layers>=STRATEGY_GATE.riskMinLayers && tech>=STRATEGY_GATE.riskMinTech && exec>=STRATEGY_GATE.riskMinExec && st.tp2Area>=STRATEGY_GATE.riskMinTp2;
  return strategyMicroStrong && localConfirm && liveOk;
}

function strategyQualityClass(strategyOk,microOk,riskOk,stratBt,localBt,stratHealth,tech,exec,st,hits,localSupportOk=false){
  const mfeMae=btMfeMae(stratBt);
  let cls="STR-C",main=false;
  if(strategyOk&&stratBt.count>=40&&stratBt.win>=60&&stratBt.pf>=2.20&&stratBt.fast<=18&&stratHealth>=72&&tech>=60&&exec>=70&&st.tp2Area>=1.70&&mfeMae>=1.35){cls="ANA KADRO A+";main=true}
  else if(strategyOk&&stratBt.count>=12&&stratBt.win>=54&&stratBt.pf>=1.55&&stratBt.fast<=30&&stratHealth>=45){cls="ANA KADRO";main=true}
  else if(riskOk){cls="RİSK KONTROLLÜ ADAY";main=false}
  else if(microOk&&localSupportOk){cls="MİKRO STRATEJİ + LOKAL ONAY";main=false}
  else if(microOk&&!localSupportOk){cls="MİKRO STRATEJİ / LOKAL VETO";main=false}
  else if(localBt.count>0){cls="TEKNİK-İZLEME"}
  return{cls,main}
}
function poolClass(score,hits){if(score>=76&&hits>=9)return"H1";if(score>=65&&hits>=7)return"H2";return"H3"}
function backScore(b){if(!b||b.count<10)return 0;let s=0;s+=clamp((b.count-20)*0.75,0,20);s+=clamp((b.win-48)*1.35,0,30);s+=clamp((b.pf-1.2)*13,0,25);s+=clamp((35-b.fast)*0.65,0,20);s+=clamp((b.avgMae>0?b.avgMfe/b.avgMae:b.avgMfe)-1.0,0,1)*5;return clamp(s,0,100)}
function backtestRank(bt,st,hits,tech,exec,dataScore){
  // v16.9: Final sıralama SADECE teknik kapıdan geçen adaylar arasında backtest dayanıklılığına göre yapılır.
  // Teknik skor burada sıralama kralı değildir; sıralamayı işlem sayısı, win, PF, hızlı stop, Net R ve MFE/MAE belirler.
  const countScore=clamp((bt.count-20)*0.80,0,24);
  const winScore=clamp((bt.win-48)*1.25,0,26);
  const pfScore=clamp((Math.min(bt.pf,6)-1.25)*7.0,0,24);
  const fastScore=clamp((35-bt.fast)*0.55,0,18);
  const netScore=clamp(bt.net*0.75,0,16);
  const mfeMae=bt.avgMae>0?bt.avgMfe/bt.avgMae:bt.avgMfe;
  const mfeScore=clamp((mfeMae-1.00)*9.0,0,12);
  const ddScore=clamp((8-(bt.maxDd||0))*0.85,0,7);
  const tp2Score=clamp((bt.tp2Rate||0)*0.07,0,7);
  const sampleBonus=bt.count>=70?7:bt.count>=55?5:bt.count>=40?3:bt.count>=30?1:0;
  const technicalSafety=clamp((hits-8)*0.8+Math.min(tech,exec)*0.025+dataScore*0.015,0,6);
  let s=countScore+winScore+pfScore+fastScore+netScore+mfeScore+ddScore+tp2Score+sampleBonus+technicalSafety;
  // Zayıf halka cezaları: teknik kapı geçmiş olsa bile backtest sağlığı çok zayıfsa üst sıraya çıkması engellenir.
  if(bt.count<30)s-=8;
  if(bt.fast>28)s-=8;
  if(bt.pf<1.55)s-=8;
  if(bt.win<52)s-=6;
  if((bt.maxDd||0)>8)s-=6;
  if(st.stopAtr<RULE.stopAtrIdealMin||st.stopAtr>RULE.stopAtrIdealMax)s-=6;
  return clamp(s,0,100);
}
function qualityClass(tech,exec,back,bt,st,hits){
  const mfeMae=bt.avgMae>0?bt.avgMfe/bt.avgMae:bt.avgMfe;
  const fatal=bt.count<RULE.minBtCount||bt.pf<RULE.minBtPf||bt.win<RULE.minBtWin||bt.fast>RULE.maxBtFast||st.tp2Area<RULE.minPoolTp2||st.stopAtr<RULE.stopAtrIdealMin||st.stopAtr>RULE.stopAtrIdealMax||tech<RULE.techMin||exec<RULE.execMin||hits<RULE.minLayerHits;
  let cls="BT-C",main=false;
  if(!fatal&&bt.count>=50&&bt.pf>=2.20&&bt.win>=60&&bt.fast<=15&&tech>=70&&exec>=78&&back>=75&&st.tp2Area>=2.0&&mfeMae>=1.40&&hits>=10&&st.stopAtr>=0.80&&st.stopAtr<=2.20&&bt.expectancy>=0.15){cls="BT-A+";main=true}
  else if(!fatal&&bt.count>=40&&bt.pf>=2.00&&bt.win>=58&&bt.fast<=20&&tech>=65&&exec>=74&&back>=68&&st.tp2Area>=1.80&&mfeMae>=1.25&&hits>=9&&bt.expectancy>0){cls="BT-A";main=true}
  else if(!fatal&&bt.count>=30&&bt.pf>=1.65&&bt.win>=54&&bt.fast<=25&&tech>=60&&exec>=68&&back>=58&&st.tp2Area>=1.80&&mfeMae>=1.10&&hits>=8){cls="BT-B+"}
  else if(!fatal&&bt.count>=20&&bt.pf>=1.30&&bt.win>=48&&bt.fast<=35){cls="BT-B"}
  return{cls,main}
}
function rankScore(poolScore,tech,exec,back,bt,st,hits,cls,main){return backtestRank(bt,st,hits,tech,exec,90)}
function longModel(s){const a=[];if(s.sr>=55)a.push("destek");if(s.supplyDemand>=55)a.push("demand");if(s.smc>=55)a.push("bullish OB/FVG");if(s.liquidity>=55)a.push("likidite reclaim");if(s.structure>=60)a.push("BOS/CHOCH");if(s.location>=65)a.push("lokasyon");if(s.momentum>=65)a.push("momentum");return"LONG — "+(a.slice(0,5).join(" + ")||"teknik bağlam")}
function shortModel(s){const a=[];if(s.sr>=55)a.push("direnç");if(s.supplyDemand>=55)a.push("supply");if(s.smc>=55)a.push("bearish OB/FVG");if(s.liquidity>=55)a.push("likidite rejection");if(s.structure>=60)a.push("BOS/CHOCH");if(s.location>=65)a.push("lokasyon");if(s.momentum>=65)a.push("momentum");return"SHORT — "+(a.slice(0,5).join(" + ")||"teknik bağlam")}


const STRATEGY_LIBRARY=[
  {id:"S1",kind:"pullback",label:{LONG:"LONG — destek + EMA pullback",SHORT:"SHORT — direnç + EMA pullback"}},
  {id:"S2",kind:"structure",label:{LONG:"LONG — demand + BOS/CHOCH + momentum",SHORT:"SHORT — supply + BOS/CHOCH + momentum"}},
  {id:"S3",kind:"smc",label:{LONG:"LONG — bullish OB/FVG + lokasyon",SHORT:"SHORT — bearish OB/FVG + lokasyon"}},
  {id:"S4",kind:"liquidity",label:{LONG:"LONG — alt likidite sweep + reclaim",SHORT:"SHORT — üst likidite sweep + rejection"}},
  {id:"S5",kind:"sr_momentum",label:{LONG:"LONG — destek + momentum dönüşü",SHORT:"SHORT — direnç + momentum dönüşü"}},
  {id:"S6",kind:"trend_structure",label:{LONG:"LONG — trend devam + yapı",SHORT:"SHORT — trend devam + yapı"}},
  {id:"S7A",kind:"multi_trend",label:{LONG:"LONG — trend + destek + momentum",SHORT:"SHORT — trend + direnç + momentum"}},
  {id:"S7B",kind:"multi_demand",label:{LONG:"LONG — demand + yapı + para akışı",SHORT:"SHORT — supply + yapı + para akışı"}},
  {id:"S7C",kind:"multi_ema_structure",label:{LONG:"LONG — EMA + yapı + lokasyon",SHORT:"SHORT — EMA + yapı + lokasyon"}},
  {id:"S7D",kind:"multi_fvg_trigger",label:{LONG:"LONG — OB/FVG + lokasyon + tetik",SHORT:"SHORT — OB/FVG + lokasyon + tetik"}},
  {id:"S8",kind:"breakout",label:{LONG:"LONG — volatilite kırılım + tetik",SHORT:"SHORT — volatilite kırılım + tetik"}},
  {id:"S0",kind:"multi_strict",label:{LONG:"LONG — sıkı çoklu teknik birleşim",SHORT:"SHORT — sıkı çoklu teknik birleşim"}}
];
function strategyDef(id){return STRATEGY_LIBRARY.find(x=>x.id===id)||STRATEGY_LIBRARY[6]}
function strategyName(id,dir){const d=strategyDef(id);return d.label[dir]||(`${dir} — ${d.kind}`)}
function strategyConditions(scores,st,dir,id){
  // v17.1 aynalı strateji standardı: canlıda sinyal üreten strateji koşulu ile backtestte aranan koşul aynıdır.
  // Ölçüler puan değil, objektif skor eşikleridir; LONG/SHORT aynı eşiklerle, ters yön bağlamında çalışır.
  if(!scores||!st)return false;
  if(st.tp2Area<1.50)return false;
  if(st.stopAtr<0.70||st.stopAtr>2.60)return false;
  const vals=[scores.trend,scores.structure,scores.smc,scores.sr,scores.supplyDemand,scores.liquidity,scores.location,scores.momentum,scores.flow,scores.candle,scores.volatility,scores.stopTp];
  const count55=vals.filter(v=>v>=55).length;
  if(id==="S1")return scores.trend>=52 && scores.location>=48 && scores.sr>=46 && scores.stopTp>=48 && scores.momentum>=42;
  if(id==="S2")return scores.supplyDemand>=50 && scores.structure>=52 && scores.momentum>=45 && scores.location>=42 && scores.stopTp>=48;
  if(id==="S3")return scores.smc>=52 && scores.location>=42 && scores.stopTp>=48 && (scores.candle>=35||scores.momentum>=42);
  if(id==="S4")return scores.liquidity>=52 && scores.momentum>=42 && scores.location>=38 && scores.stopTp>=48;
  if(id==="S5")return scores.sr>=52 && scores.momentum>=45 && scores.location>=42 && (scores.candle>=35||scores.flow>=42);
  if(id==="S6")return scores.trend>=52 && scores.structure>=45 && scores.momentum>=38 && scores.stopTp>=48;
  if(id==="S7A")return scores.trend>=55 && scores.sr>=52 && scores.momentum>=48 && scores.location>=45 && scores.stopTp>=50;
  if(id==="S7B")return scores.supplyDemand>=52 && scores.structure>=52 && scores.flow>=45 && scores.location>=45 && scores.stopTp>=50;
  if(id==="S7C")return scores.trend>=55 && scores.structure>=50 && scores.location>=45 && scores.stopTp>=50;
  if(id==="S7D")return scores.smc>=55 && scores.location>=45 && scores.candle>=45 && scores.stopTp>=50;
  if(id==="S8")return scores.volatility>=52 && scores.candle>=45 && scores.structure>=45 && st.tp2Area>=1.60;
  return count55>=7 && scores.location>=45 && scores.stopTp>=50 && scores.momentum>=45;
}
function matchingStrategies(scores,st,dir){
  return STRATEGY_LIBRARY.filter(x=>strategyConditions(scores,st,dir,x.id)).map(x=>({id:x.id,name:strategyName(x.id,dir),kind:x.kind}));
}
function strategyIdentify(scores,st,dir){
  const m=matchingStrategies(scores,st,dir);
  return m[0]||null;
}
function strategyMatch(scores,st,dir,strat){
  return strategyConditions(scores,st,dir,(strat&&strat.id)||"S7");
}
function chooseBestStrategy(c,dir,scores,st,tech,exec,dataScore){
  const matches=matchingStrategies(scores,st,dir);
  if(!matches.length)return null;
  let best=null;
  for(const strat of matches){
    const strategyBt=strategyBacktest(c,dir,strat);
    const strategyBack=strategyHealth(strategyBt);
    const strategyOk=strategyEligible(strategyBt,strategyBack);
    const localBt=backtest(c,dir,"","");
    const microOk=strategyMicroEligible(strategyBt,strategyBack,tech,exec,st,(Object.values(scores).filter(v=>v>=55).length));
    const score=strategyRankScore(strategyBt,localBt,st,tech,exec,dataScore,strategyBack,microOk)+(strategyOk?10:0)+(microOk?6:0)+(strat.id==="S2"?2:0);
    if(!best||score>best.score)best={strat,strategyBt,strategyBack,strategyOk,localBt,microOk,score};
  }
  return best;
}
function simulateTrade(c,i,dir,st){
  let hit=null,mfe=0,mae=0,bars=0;
  for(let j=i+1;j<Math.min(c.length,i+28);j++){
    bars++;
    const hi=c[j].high,lo=c[j].low;
    const fav=dir==="LONG"?(hi-st.entry)/st.risk:(st.entry-lo)/st.risk;
    const adv=dir==="LONG"?(st.entry-lo)/st.risk:(hi-st.entry)/st.risk;
    mfe=Math.max(mfe,fav);mae=Math.max(mae,adv);
    if(dir==="LONG"){
      if(lo<=st.stop){hit="STOP";break}
      if(hi>=st.t2){hit="TP2";break}
      if(hi>=st.t1&&!hit)hit="TP1"
    }else{
      if(hi>=st.stop){hit="STOP";break}
      if(lo<=st.t2){hit="TP2";break}
      if(lo<=st.t1&&!hit)hit="TP1"
    }
  }
  const grossR=hit==="TP2"?1.85:hit==="TP1"?1.05:hit==="STOP"?-1:(mfe>1?0.4:-0.3);
  const costR=TRADE_GATE.totalCostPct/Math.max(st.stopPct||0.01,0.01);
  const r=grossR-costR;
  return {r,hit,mfe,mae,bars,fast:hit==="STOP"&&bars<=4,costR};
}
function summarizeTrades(trades){
  if(!trades.length)return{count:0,win:0,pf:0,fast:100,net:0,avgMfe:0,avgMae:0,maxDd:0,tp2Rate:0,expectancy:0,trades:[]};
  const wins=trades.filter(t=>t.r>0),losses=trades.filter(t=>t.r<0);
  const gp=wins.reduce((a,b)=>a+b.r,0),gl=-losses.reduce((a,b)=>a+b.r,0);
  let eq=0,peak=0,maxDd=0;
  for(const t of trades){eq+=t.r;peak=Math.max(peak,eq);maxDd=Math.max(maxDd,peak-eq)}
  const net=trades.reduce((a,b)=>a+b.r,0);
  return{count:trades.length,win:wins.length/trades.length*100,pf:gp/(gl||.01),fast:trades.filter(t=>t.fast).length/trades.length*100,net,avgMfe:avg(trades.map(t=>t.mfe)),avgMae:avg(trades.map(t=>t.mae)),maxDd,tp2Rate:trades.filter(t=>t.hit==="TP2").length/trades.length*100,expectancy:net/trades.length,trades:trades.slice(-10)};
}
function strategyBacktest(c,dir,strat){
  let trades=[],cool=0;
  for(let i=160;i<c.length-25;i++){
    if(cool>0){cool--;continue}
    const st=stopTp(c,i,dir);
    const scores=buildTechnicalScores(c,i,dir,st,"","","backtest");
    if(!strategyMatch(scores,st,dir,strat))continue;
    trades.push(simulateTrade(c,i,dir,st));
    cool=5;
  }
  return summarizeTrades(trades);
}
function strategyHealth(b){
  if(!b||!b.count)return 0;
  const mfeMae=b.avgMae>0?b.avgMfe/b.avgMae:b.avgMfe;
  let s=0;
  s+=clamp((b.count-5)*1.0,0,22);
  s+=clamp((b.win-48)*1.25,0,26);
  s+=clamp((Math.min(b.pf,6)-1.20)*8.0,0,24);
  s+=clamp((35-b.fast)*0.60,0,18);
  s+=clamp((mfeMae-1.0)*8,0,10);
  return clamp(s,0,100);
}
function strategyEligible(b,health){
  const mfeMae=b&&b.avgMae>0?b.avgMfe/b.avgMae:(b?b.avgMfe:0);
  return !!b && b.count>=STRATEGY_GATE.minCount && b.win>=STRATEGY_GATE.minWin && b.pf>=STRATEGY_GATE.minPf && b.fast<=STRATEGY_GATE.maxFast && b.net>STRATEGY_GATE.minNet && mfeMae>=STRATEGY_GATE.minMfeMae && health>=STRATEGY_GATE.minHealth;
}
function strategyMicroEligible(bt,health,tech,exec,st,layers){
  // v17.3: Mikro kabul aynı strateji backtestinden gelir.
  // 3-11 örnek: istatistiksel kesinlik değil, nadir fakat aynı stratejiyle olumlu geçmiş kanıtıdır.
  const mfeMae=bt&&bt.avgMae>0?bt.avgMfe/bt.avgMae:(bt?bt.avgMfe:0);
  return !!bt && layers>=8 && tech>=52 && exec>=65 && st.tp2Area>=1.50 && bt.count>=STRATEGY_GATE.microCountMin && bt.count<=STRATEGY_GATE.microCountMax && bt.win>=STRATEGY_GATE.microWin && bt.pf>=STRATEGY_GATE.microPf && bt.fast<=STRATEGY_GATE.microFast && mfeMae>=STRATEGY_GATE.microMfeMae && bt.net>0 && health>=STRATEGY_GATE.microHealth;
}
function microEligible(bt,tech,exec,st,layers){
  // Eski lokal mikro fonksiyon geriye dönük uyumluluk için bırakıldı; final kararında kullanılmaz.
  const mfeMae=bt&&bt.avgMae>0?bt.avgMfe/bt.avgMae:(bt?bt.avgMfe:0);
  return !!bt && layers>=9 && tech>=52 && exec>=65 && st.tp2Area>=2.0 && bt.count>=STRATEGY_GATE.microCountMin && bt.count<STRATEGY_GATE.minCount && bt.win>=STRATEGY_GATE.microWin && bt.pf>=STRATEGY_GATE.microPf && bt.fast<=STRATEGY_GATE.microFast && mfeMae>=STRATEGY_GATE.microMfeMae && bt.net>0;
}
function strategyRankScore(strategyBt,localBt,st,tech,exec,dataScore,stratHealth,microOk){
  // v17.3: Sıralamanın kralı strateji backtestidir. Lokal BT sadece bağlam teyidi olarak küçük ağırlıktadır.
  const strategyCore=backtestRank(strategyBt,st,9,tech,exec,dataScore)*0.52 + clamp(stratHealth,0,100)*0.28;
  const localConfirm=backtestRank(localBt,st,9,tech,exec,dataScore)*0.08;
  const liveConfirm=clamp((Math.min(tech,exec)-50)*0.55,0,8) + clamp((st.tp2Area-1.5)*3,0,5);
  const sampleMode=microOk?6:0;
  return clamp(strategyCore+localConfirm+liveConfirm+sampleMode,0,100);
}
function strategyFailReasons(x){
  const b=x.strategyBt||{};
  const reasons=[];
  const mfeMae=b.avgMae>0?b.avgMfe/b.avgMae:(b.avgMfe||0);
  if((b.count||0)<STRATEGY_GATE.minCount)reasons.push(`strateji işlem ${b.count||0}<${STRATEGY_GATE.minCount}`);
  if((b.win||0)<STRATEGY_GATE.minWin)reasons.push(`strateji win ${fmt(b.win||0,1)}<${STRATEGY_GATE.minWin}`);
  if((b.pf||0)<STRATEGY_GATE.minPf)reasons.push(`strateji PF ${fmt(b.pf||0,2)}<${STRATEGY_GATE.minPf}`);
  if((b.fast||0)>STRATEGY_GATE.maxFast)reasons.push(`strateji hızlı stop ${fmt(b.fast||0,1)}>${STRATEGY_GATE.maxFast}`);
  if((b.net||0)<=STRATEGY_GATE.minNet)reasons.push(`strateji netR ${fmt(b.net||0,2)}≤${STRATEGY_GATE.minNet}`);
  if(mfeMae<STRATEGY_GATE.minMfeMae)reasons.push(`strateji MFE/MAE ${fmt(mfeMae,2)}<${STRATEGY_GATE.minMfeMae}`);
  if((x.strategyHealth||0)<STRATEGY_GATE.minHealth)reasons.push(`strateji sağlık ${Math.round(x.strategyHealth||0)}<${STRATEGY_GATE.minHealth}`);
  if(x.riskOk)reasons.push('risk kontrollü: strateji mikro + lokal aynalı BT olumlu');
  else if(x.microOk&&x.localSupportOk)reasons.push('aynı strateji mikro BT + lokal aynalı BT olumlu');
  else if(x.microOk&&!x.localSupportOk)reasons.push('mikro strateji var ama lokal aynalı BT veto: '+localFailReasons(x.bt));
  return reasons.length?reasons.join(' | '):'strateji uygun';
}
function backtest(c,dir,sym="",tf=""){
  // Lokal aynalı BT: canlı teknik çekirdeğin tam kapısını geçmiş mumlarda aynı eşikle çalıştırır.
  let trades=[],cool=0;
  for(let i=160;i<c.length-25;i++){
    if(cool>0){cool--;continue}
    const ev=technicalEval(c,i,dir,sym,tf,"backtest");
    if(!ev||!ev.ok)continue;
    trades.push({...simulateTrade(c,i,dir,ev.st),tech:ev.tech,exec:ev.exec,layers:ev.layerHits});
    cool=5;
  }
  return summarizeTrades(trades);
}
function selectTopByDir(dir){
  // Final liste artık teknik havuzun tamamı değil; aynalı backtest uygunluk kilidini geçenlerdir.
  const arr=pool.filter(x=>x.dir===dir && x.btOk).sort((a,b)=>b.rankScore-a.rankScore);
  const selected=[],used=new Set();
  for(const x of arr){
    if(selected.length>=RULE.showEach)break;
    const key=x.sym+"_"+dir;
    if(used.has(key))continue;
    x.listMode=`STRATEJİ BACKTEST BAĞLI EN İYİ 5 ${dir}`;
    selected.push(x);
    used.add(key);
  }
  return selected;
}

function btFailReasons(x){
  const r=[];
  if(!x.tradeOk)r.push(tradeFailText(x));
  if(x.strategyOk)r.push('strateji BT uygun');
  else if(x.riskOk)r.push('risk kontrollü agresif aday');
  else if(x.microOk&&x.localSupportOk)r.push('mikro BT + lokal onay olumlu');
  else if(x.microOk&&!x.localSupportOk)r.push('lokal aynalı BT veto: '+localFailReasons(x.bt));
  else r.push(strategyFailReasons(x));
  return r.join(' | ');
}

function renderSummary(){
  const long=pool.filter(x=>x.dir==="LONG"),short=pool.filter(x=>x.dir==="SHORT");
  const eligLong=long.filter(x=>x.btOk),eligShort=short.filter(x=>x.btOk);const stratLong=long.filter(x=>x.strategyOk),stratShort=short.filter(x=>x.strategyOk),microLong=long.filter(x=>x.microOk||x.riskOk),microShort=short.filter(x=>x.microOk||x.riskOk);
  const topLong=selectTopByDir("LONG"),topShort=selectTopByDir("SHORT");
  scan.passedTech=pool.length;scan.btPassed=eligLong.length+eligShort.length;
  $("summary").innerHTML=`<div class="dash"><div><b>${SYMBOLS.length}</b><span>coin evreni</span></div><div><b>${scan.done}/${scan.total}</b><span>sembol/TF analiz</span></div><div><b>${scan.dirChecks}</b><span>yön kontrolü</span></div><div><b>${long.length}</b><span>LONG teknik havuz</span></div><div><b>${short.length}</b><span>SHORT teknik havuz</span></div><div><b>${eligLong.length}+${eligShort.length}</b><span>final uygun</span></div><div><b>${microLong.length}+${microShort.length}</b><span>mikro/risk</span></div><div><b>${topLong.length}+${topShort.length}</b><span>final 5+5</span></div><div><b>${scan.rest}</b><span>REST set</span></div><div><b>${scan.json}</b><span>JSON set</span></div><div><b>${scan.candles}</b><span>toplam mum</span></div><div><b>${scan.latestCoinAgeSec===null?"-":scan.latestCoinAgeSec}</b><span>coin veri yaşı sn</span></div><div><b>${scan.stale}</b><span>canlı alınamadı</span></div></div><div class="note"><b>v17.6 lokal aynalı BT veto:</b> Canlı teknik aday önce strateji ailesine bağlanır. Final 5+5 listesine yalnızca aynı strateji fonksiyonuyla backtesti güçlü olanlar veya aynı strateji mikro BT olumlu + lokal aynalı BT pozitif olanlar girer. Strateji uygunluk: işlem≥${STRATEGY_GATE.minCount}, win≥${STRATEGY_GATE.minWin}%, PF≥${STRATEGY_GATE.minPf}, hızlı stop≤${STRATEGY_GATE.maxFast}%, MFE/MAE≥${STRATEGY_GATE.minMfeMae}, strateji sağlık≥${STRATEGY_GATE.minHealth}. Lokal aynalı BT ayrıca denetim için gösterilir; final kapısını tek başına açmaz.</div>`
}
function card(x,i){
  const cls=x.dir==="SHORT"?"short":"long";
  const sc=Math.round(x.rankScore);
  return `<div class="candidate ${cls}" onclick="selectCandidate('${x.key}')"><div class="top"><div><div class="sym">${i+1}) ${x.sym} / ${x.tf}</div><div class="model">${x.dir} — ${x.model.replace(/^LONG — |^SHORT — /,'')}</div></div><div class="score ${x.dir.toLowerCase()}">${sc}<br><span style="font-size:16px">BT</span></div></div><div class="line">Liste modu: ${x.listMode||"STRATEJİ BT"} | Yön: ${x.dir} | Teknik geçiş: ${x.layerHits}/14 | Sınıf: ${x.quality}<br>Strateji: ${x.strategy?.id||"-"} / ${x.strategy?.name||"-"} | Strateji uygun: ${x.strategyOk?"EVET":"HAYIR"} | Risk kontrollü: ${x.riskOk?"EVET":"HAYIR"} | Strateji mikro BT: ${x.microOk?"OLUMLU":"-"} | Lokal destek: ${x.localSupportOk?"EVET":"HAYIR"}<br>Teknik bağlam: Teknik ${Math.round(x.tech)} / İcra ${Math.round(x.exec)} / Strateji sağlık ${Math.round(x.strategyHealth||0)} / Final uygun: ${x.btOk?"EVET":"HAYIR"} / Sebep: ${x.btOk?"uygun":btFailReasons(x)} / Veri ${x.dataScore}<br>Trade kapısı: ${x.tradeOk?"EVET":"HAYIR"} | Maliyet ${pct(x.tradeCostPct,2)} | MaliyetR ${fmt(x.tradeCostR,2)} | ATR% ${pct(x.atrPct||0,2)}<br>Bağlam: Trend ${Math.round(x.context?.trendCtx??0)} / Yapı-Lokasyon ${Math.round(x.context?.structureCtx??0)} / Tetik ${Math.round(x.context?.triggerCtx??0)} / İcra ${Math.round(x.context?.executionCtx??0)}<br>Giriş ${dual(x.entry)}<br>Stop ${dual(x.stop)} | stopATR ${fmt(x.stopAtr,2)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2Area,2)}R<br>TP1 ${dual(x.t1)} (${pct(x.tp1Pct||0,2)}) | TP2 ${dual(x.t2)} (${pct(x.tp2Pct||0,2)}) | TP3 ${dual(x.t3)} (${pct(x.tp3Pct||0,2)})<br><b>Strateji BT:</b> İşlem ${x.strategyBt.count} | Win ${pct(x.strategyBt.win,1)} | PF ${x.strategyBt.pf>=20?'20+':fmt(x.strategyBt.pf,2)} | Hızlı stop ${pct(x.strategyBt.fast,1)} | Net ${fmt(x.strategyBt.net,2)}R | MFE/MAE ${fmt(x.strategyBt.avgMfe,2)}R/${fmt(x.strategyBt.avgMae,2)}R<br><b>Lokal aynalı BT:</b> İşlem ${x.bt.count} | Win ${pct(x.bt.win,1)} | PF ${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)} | Hızlı stop ${pct(x.bt.fast,1)} | Net ${fmt(x.bt.net,2)}R | MFE/MAE ${fmt(x.bt.avgMfe,2)}R/${fmt(x.bt.avgMae,2)}R<br>Veri: ${x.ageSec} sn | Kaynak: ${x.source}</div><div><span class="pill ${x.dir==='LONG'?'green':'red'}">${x.dir} TEKNİK ADAY</span><span class="pill blue">${VERSION}</span><span class="pill amber">AYNALI BACKTEST</span><span class="pill amber">${x.quality}</span></div></div>`
}
function renderList(){
  renderSummary();
  pool.forEach((x,idx)=>x.key=x.key||`${x.sym}_${x.tf}_${x.dir}_${idx}`);
  const topLong=selectTopByDir("LONG");
  const topShort=selectTopByDir("SHORT");
  const longPool=pool.filter(x=>x.dir==="LONG").sort((a,b)=>b.rankScore-a.rankScore);
  const shortPool=pool.filter(x=>x.dir==="SHORT").sort((a,b)=>b.rankScore-a.rankScore);
  longPool.forEach(x=>{if(!x.btOk)x.listMode="TEKNİK HAVUZ İZLEME / BT UYGUN DEĞİL"});
  shortPool.forEach(x=>{if(!x.btOk)x.listMode="TEKNİK HAVUZ İZLEME / BT UYGUN DEĞİL"});
  const map=new Map(pool.map(x=>[x.key,x]));
  window.__candMap=map;
  const longHtml=topLong.length?topLong.map((x,i)=>card(x,i)).join(''):'<p>LONG tarafında strateji BT/mikro BT final adayı yok.</p>';
  const shortHtml=topShort.length?topShort.map((x,i)=>card(x,i)).join(''):'<p>SHORT tarafında strateji BT/mikro BT final adayı yok.</p>';
  const longPoolHtml=longPool.length?longPool.map((x,i)=>card(x,i)).join(''):'<p>LONG teknik havuz boş.</p>';
  const shortPoolHtml=shortPool.length?shortPool.map((x,i)=>card(x,i)).join(''):'<p>SHORT teknik havuz boş.</p>';
  $("list").innerHTML=`<div class="listSection long"><h3>Ana Kadro + Risk Kontrollü — En İyi 5 LONG</h3><p>Önce ana kadro, yetmezse risk kontrollü agresif LONG adayları kalite sırasıyla girer.</p>${longHtml}</div><div class="listSection short"><h3>Ana Kadro + Risk Kontrollü — En İyi 5 SHORT</h3><p>Önce ana kadro, yetmezse risk kontrollü agresif SHORT adayları kalite sırasıyla girer.</p>${shortHtml}</div><div class="listSection long"><h3>Teknik Havuz LONG — Backtest Denetimi</h3><p>Teknik kapıdan geçen tüm LONG adayları burada görünür. Final listeye girmeyenlerin sebebi kartta Final uygun: HAYIR satırında, strateji BT ve lokal BT ölçülerinde görülür.</p>${longPoolHtml}</div><div class="listSection short"><h3>Teknik Havuz SHORT — Backtest Denetimi</h3><p>Teknik kapıdan geçen tüm SHORT adayları burada görünür. Bu bölüm işlem listesi değil, teknik havuzun strateji backtest denetimidir.</p>${shortPoolHtml}</div>`;
  const first=topLong[0]||topShort[0]||longPool[0]||shortPool[0];
  if(first&&!selected)selectCandidate(first.key,true)
}

function selectCandidate(key,silent=false){const x=window.__candMap&&window.__candMap.get(key);if(!x)return;selected=x;$("decision").className="decision "+(x.dir==="LONG"?"long":"short");$("decision").textContent=`${x.sym} ${x.dir} / ${x.tf} — ${x.listMode}`;function m(k,v){return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`}$("metrics").innerHTML=m("Sınıf",x.quality)+m("Strateji",x.strategy?.id||"-")+m("Endeks",Math.round(x.btRank))+m("Katman",`${x.layerHits}/14`)+m("Giriş",dual(x.entry))+m("Stop",dual(x.stop))+m("stopATR",fmt(x.stopAtr,2))+m("Stop %",pct(x.stopPct,2))+m("TP1",dual(x.t1))+m("TP2",dual(x.t2))+m("TP3",dual(x.t3))+m("TP1 %",pct(x.tp1Pct||0,2))+m("TP2 %",pct(x.tp2Pct||0,2))+m("Trade",x.tradeOk?"EVET":"HAYIR")+m("MaliyetR",fmt(x.tradeCostR||0,2))+m("Str Win",pct(x.strategyBt.win,1))+m("Str PF",x.strategyBt.pf>=20?"20+":fmt(x.strategyBt.pf,2))+m("Lokal İşlem",x.bt.count);const qty=RULE.spotTry/(x.entry*(fx.rate||1));const riskTry=Math.abs(x.entry-x.stop)*qty*(fx.rate||1);$("tryPlan").innerHTML=`<b>${x.dir} teknik plan</b><br>${x.btOk?"Ana kadro veya risk kontrollü strateji adayıdır; trade edilebilirlik kapısını geçmiştir.":"Teknik havuz adaydır; ana kadro/risk kontrollü strateji veya trade edilebilirlik kapısını geçmediği için işlem listesi adayı değildir. Sebep: "+btFailReasons(x)} 10.000 TL varsayımıyla yaklaşık miktar: ${fmt(qty,2)} ${base(x.sym)}. Tahmini risk: ${fmt(riskTry,2)} TL. TP1/TP2/TP3 fiyatları yukarıda.`;$("reasons").innerHTML=Object.entries(x.scores).map(([k,v])=>`<span class="pill ${v>=65?'green':v>=50?'amber':'gray'}">${k}: ${Math.round(v)}</span>`).join('');renderChart(x);renderBt(x);if(!silent)document.getElementById('planBox').scrollIntoView({behavior:'smooth',block:'start'})}
function renderBt(x){
  const mfeMaeS=x.strategyBt.avgMae>0?x.strategyBt.avgMfe/x.strategyBt.avgMae:x.strategyBt.avgMfe;
  const mfeMaeL=x.bt.avgMae>0?x.bt.avgMfe/x.bt.avgMae:x.bt.avgMfe;
  $("bt").innerHTML=`<h3>Strateji Ailesi Backtesti</h3><div class="grid"><div class="metric"><div class="k">Strateji</div><div class="v">${x.strategy?.id||"-"}</div></div><div class="metric"><div class="k">İşlem</div><div class="v">${x.strategyBt.count}</div></div><div class="metric"><div class="k">Win</div><div class="v">${pct(x.strategyBt.win,1)}</div></div><div class="metric"><div class="k">PF</div><div class="v">${x.strategyBt.pf>=20?'20+':fmt(x.strategyBt.pf,2)}</div></div><div class="metric"><div class="k">Net R</div><div class="v">${fmt(x.strategyBt.net,2)}</div></div><div class="metric"><div class="k">MFE/MAE</div><div class="v">${fmt(mfeMaeS,2)}</div></div></div><h3>Lokal Aynalı Backtest</h3><div class="grid"><div class="metric"><div class="k">İşlem</div><div class="v">${x.bt.count}</div></div><div class="metric"><div class="k">Win</div><div class="v">${pct(x.bt.win,1)}</div></div><div class="metric"><div class="k">PF</div><div class="v">${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)}</div></div><div class="metric"><div class="k">Net R</div><div class="v">${fmt(x.bt.net,2)}</div></div><div class="metric"><div class="k">MFE/MAE</div><div class="v">${fmt(mfeMaeL,2)}</div></div><div class="metric"><div class="k">Hızlı stop</div><div class="v">${pct(x.bt.fast,1)}</div></div></div><div class="note">v17.6’da final karar strateji merkezlidir: ana kadro için strateji BT güçlü olur; mikro/risk adayında lokal aynalı BT negatifse final veto uygulanır. Backtest sonuçları komisyon/spread/kayma maliyetini R cinsinden düşerek hesaplanır; düşük stop yüzünden şişen R sonuçları veto edilir.</div>`
}
function renderChart(x){const raw=market.data&&market.data[x.sym]&&market.data[x.sym][x.tf];const c=raw?raw.slice(-80):[];const canvas=$("chart"),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);if(!c.length)return;const vals=c.flatMap(z=>[z.high,z.low,x.entry,x.stop,x.t1,x.t2,x.t3]);const mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*.08||1;const y=v=>h-20-(v-(mn-pad))/(mx-mn+pad*2)*(h-40),xpos=i=>20+i*(w-40)/(c.length-1);ctx.lineWidth=3;ctx.strokeStyle="#89aaff";ctx.beginPath();c.forEach((z,i)=>{const xx=xpos(i),yy=y(z.close);if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy)});ctx.stroke();function line(v,col,txt){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();ctx.fillStyle=col;ctx.font="18px Arial";ctx.fillText(txt,24,y(v)-5)}line(x.entry,"#ffd166","Giriş");line(x.stop,"#ff6b8a","Stop");line(x.t1,"#7cff9f","TP1");line(x.t2,"#7cff9f","TP2");line(x.t3,"#7cff9f","TP3")}
async function oneClickScan(){pool=[];selected=null;scan={done:0,total:0,dirChecks:0,passedTech:0,btPassed:0,out:0,json:0,rest:0,stale:0,invalid:0,candles:0,restCandles:0,jsonCandles:0,validSets:0,latestCoinAgeSec:null,lastCoinSource:"-"};$("mainBtn").disabled=true;setMeta("Veri bağlantısı kuruluyor...");setBar(0);await loadMarket();await loadFx();await getUniverse();scan.total=SYMBOLS.length*TFS.length;setDataBox();for(const sym of SYMBOLS){for(const tf of TFS){const raw=await getCandles(sym,tf);scan.done++;setBar(scan.done/scan.total*100);if(raw&&raw.length>=220){for(const dir of ["LONG","SHORT"]){scan.dirChecks++;const c=analyzeLast(sym,tf,raw,dir);if(c)pool.push(c);else scan.out++}}else{scan.dirChecks+=2;scan.out+=2}setMeta(`Tarama ${scan.done}/${scan.total} | ${sym} ${tf} | Set ${scan.validSets} | Mum ${scan.candles} | Kaynak ${scan.lastCoinSource} | Yaş ${scan.latestCoinAgeSec===null?"-":scan.latestCoinAgeSec} sn | Teknik havuz ${pool.length}`);setDataBox();if(scan.done%8===0){renderList();await new Promise(r=>setTimeout(r,0))}}}pool=dedup(pool).sort((a,b)=>b.rankScore-a.rankScore);renderList();setDataBox();setMeta(`Tarama bitti: ${scan.done}/${scan.total} sembol/TF | Geçerli set ${scan.validSets} | Mum ${scan.candles} | REST ${scan.rest} | JSON ${scan.json} | Yön kontrolü ${scan.dirChecks} | Teknik havuz ${pool.length}`);$("mainBtn").disabled=false}
function dedup(arr){const seen=new Map();for(const x of arr){const key=x.sym+"_"+x.tf+"_"+x.dir;const old=seen.get(key);if(!old||x.rankScore>old.rankScore)seen.set(key,x)}return [...seen.values()]}
loadMarket().then(loadFx);
