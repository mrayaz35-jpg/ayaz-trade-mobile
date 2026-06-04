const VERSION="v16.10 bilimsel dengeli+ teknik kapı + backtest top 5";
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
  // v16.10 Bilimsel Dengeli+ Teknik Kapı: canlı veri ve backtest standardı değişmez.
  // Sadece teknik havuza giriş eşikleri ölçü birimli olarak kademeli gevşetildi.
  minLayerHits:6,          // 7/14 -> 6/14; en az 6 bağımsız teknik katman şartı korunur.
  techMin:52,              // 55 -> 52; teknik skor hâlâ 50 üstü bağlam ister.
  execMin:60,              // 62 -> 60; giriş/stop/TP icrası alt eşiği.
  minPoolTp2:1.50,         // 1.60R -> 1.50R; 1.40R altı yine kabul edilmez.
  stopAtrMin:0.70,         // stop alt bandı korunur; stopTp motoru ve backtest standardı bozulmaz.
  stopAtrMax:2.60,         // 2.40ATR -> 2.60ATR; 3.20ATR üstü yine kalite dışıdır.
  trendCtxMin:50,
  structureCtxMin:50,
  triggerCtxMin:48,
  executionCtxMin:56,
  contextCountMin:3
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
function setDataBox(){const ok=market&&Object.keys(market.data||{}).length;$("dataBox").innerHTML=`Veri: <b class="${ok?'ok':'bad'}">${ok?'BAĞLI':'BEKLEMEDE'}</b> | Coin: ${SYMBOLS.length} | Mum: ${Object.values(market.data||{}).reduce((s,v)=>s+TFS.reduce((a,tf)=>a+((v&&v[tf]&&v[tf].length)||0),0),0)} | v16.10 bilimsel dengeli+ teknik kapı + backtest top 5`}
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
      if(a&&a.length){scan.rest++;return a}
    }catch(e){}
  }
  let arr=market.data&&market.data[sym]&&market.data[sym][tf];
  if(arr&&arr.length>80){
    const last=arr[arr.length-1],t=Number(last.liveTime||market.generatedAt&&Date.parse(market.generatedAt)||last.closeTime||last.time||0);
    if(now()-t<=RULE.maxAgeMs){scan.json++;return arr.slice(-RULE.limit).map(x=>({...x,source:"JSON"}))}
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
function stopTp(c,i,dir){const x=c[i],sw=swings(c,i),a=x.atr||Math.max(x.high-x.low,1e-9),entry=x.close;let stop,nearTarget;if(dir==="LONG"){stop=Math.min(sw.lastL-.10*a,entry-RULE.stopAtrIdealMin*a);nearTarget=sw.lastH>entry?sw.lastH:entry+a*2.2}else{stop=Math.max(sw.lastH+.10*a,entry+RULE.stopAtrIdealMin*a);nearTarget=sw.lastL<entry?sw.lastL:entry-a*2.2}const risk=Math.abs(entry-stop)||a,stopPct=risk/entry*100,stopAtr=risk/a;const t1=dir==="LONG"?entry+risk*1.05:entry-risk*1.05,t2=dir==="LONG"?entry+risk*1.85:entry-risk*1.85,t3=dir==="LONG"?entry+risk*2.65:entry-risk*2.65;const area=Math.abs(nearTarget-entry)/risk;let stopQ=0;if(stopAtr>=RULE.stopAtrIdealMin&&stopAtr<=RULE.stopAtrIdealMax)stopQ=100;else if(stopAtr>=RULE.stopAtrHardMin&&stopAtr<RULE.stopAtrIdealMin)stopQ=60;else if(stopAtr>RULE.stopAtrIdealMax&&stopAtr<=RULE.stopAtrHardMax)stopQ=55;let tpQ=clamp(area/RULE.minPoolTp2*100,0,100);return{entry,stop,t1,t2,t3,risk,stopPct,stopAtr,tp2Area:area,stopQ:clamp(stopQ,0,100),tpQ}}
function volatilityScore(c,i,st){const x=c[i];let s=0;if(x.atrPct>=.30&&x.atrPct<=6.00)s+=25;if(x.atrPercentile>=20&&x.atrPercentile<=85)s+=25;const rangeATR=(x.high-x.low)/(x.atr||1);if(rangeATR<=2.00)s+=20;if(x.bbWidthPercentile>=15&&x.bbWidthPercentile<=85)s+=15;if(st.stopAtr>=RULE.stopAtrIdealMin&&st.stopAtr<=RULE.stopAtrIdealMax)s+=15;return clamp(s,0,100)}

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

function analyzeLast(sym,tf,raw,dir){
  if(!raw||raw.length<220)return null;
  const c=enrich(raw),i=c.length-1,x=c[i];
  const ageSec=Math.max(0,Math.floor((now()-(x.liveTime||x.closeTime||x.time||now()))/1000));
  if(ageSec>RULE.maxAgeMs/1000)return null;
  if(String(x.source||"").includes("STALE"))return null;
  const st=stopTp(c,i,dir);
  if(st.stopAtr<TECH_GATE.stopAtrMin||st.stopAtr>TECH_GATE.stopAtrMax||st.tp2Area<TECH_GATE.minPoolTp2)return null;
  const scores={
    trend:trendScore(c,i,dir),regime:regimeScore(sym,tf,dir),upper:upperTfScore(sym,tf,dir),
    structure:structureScore(c,i,dir),smc:smcScore(c,i,dir),sr:supportResistanceScore(c,i,dir),
    supplyDemand:supplyDemandScore(c,i,dir),liquidity:liquidityScore(c,i,dir),location:locationScore(c,i,dir),
    momentum:momentumScore(c,i,dir),flow:volumeScore(c,i,dir),candle:candleScore(c,i,dir),volatility:0,stopTp:0
  };
  scores.volatility=volatilityScore(c,i,st);
  scores.stopTp=clamp(st.stopQ*.55+st.tpQ*.45,0,100);
  const layerHits=Object.values(scores).filter(v=>v>=55).length;
  const ctx=contextGate(scores,st);
  const tech=clamp(avg([scores.trend,scores.regime,scores.upper,scores.structure,scores.smc,scores.sr,scores.supplyDemand,scores.liquidity,scores.location,scores.momentum,scores.flow,scores.candle,scores.volatility,scores.stopTp]),0,100);
  const exec=clamp(avg([scores.location,scores.sr,scores.supplyDemand,scores.liquidity,scores.candle,scores.stopTp,scores.volatility])+Math.min(st.tp2Area,3.2)*4,0,100);
  // v16.9 dengeli teknik kapı: önce sadece teknik bağlam ölçülür.
  // Teknik kapı geçilmeden backtest hesaplanıp listeye alınmaz.
  if(layerHits<TECH_GATE.minLayerHits||tech<TECH_GATE.techMin||exec<TECH_GATE.execMin||!ctx.ok)return null;
  const bt=backtest(c,dir);
  // Backtest artık ikinci kapı değildir; teknik havuzdaki adayların SIRALAMA ölçüsüdür.
  // bt.count düşükse rank doğal olarak düşük kalır; aday teknik havuzdan silinmez.
  const back=backScore(bt);
  const dataScore=x.source==="REST"?92:x.source==="JSON"?88:82;
  const btRank=backtestRank(bt,st,layerHits,tech,exec,dataScore);
  const q=qualityClass(tech,exec,back,bt,st,layerHits);
  const model=dir==="LONG"?longModel(scores):shortModel(scores);
  return{sym,tf,dir,model,mode:"TEKNIK KAPI HAVUZU + BACKTEST TOP 5",listMode:"TEKNIK KAPI HAVUZU / BACKTEST TOP 5",poolClass:poolClass(tech,layerHits),quality:q.cls,main:q.main,rankScore:btRank,btRank,tech,exec,back,dataScore,scores,context:ctx,layerHits,bt,...st,ageSec,source:x.source||"JSON"}
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
function backtest(c,dir){let trades=[],cool=0;for(let i=160;i<c.length-25;i++){if(cool>0){cool--;continue}const st=stopTp(c,i,dir);if(st.stopAtr<RULE.stopAtrIdealMin||st.stopAtr>RULE.stopAtrIdealMax||st.tp2Area<RULE.minPoolTp2)continue;const scores={trend:trendScore(c,i,dir),structure:structureScore(c,i,dir),smc:smcScore(c,i,dir),sr:supportResistanceScore(c,i,dir),supplyDemand:supplyDemandScore(c,i,dir),liquidity:liquidityScore(c,i,dir),location:locationScore(c,i,dir),momentum:momentumScore(c,i,dir),flow:volumeScore(c,i,dir),candle:candleScore(c,i,dir),volatility:volatilityScore(c,i,st),stopTp:clamp(st.stopQ*.55+st.tpQ*.45,0,100)};const hits=Object.values(scores).filter(v=>v>=55).length;const techAvg=avg(Object.values(scores));if(hits<7||techAvg<55)continue;let hit=null,mfe=0,mae=0,bars=0;for(let j=i+1;j<Math.min(c.length,i+28);j++){bars++;const hi=c[j].high,lo=c[j].low;const fav=dir==="LONG"?(hi-st.entry)/st.risk:(st.entry-lo)/st.risk;const adv=dir==="LONG"?(st.entry-lo)/st.risk:(hi-st.entry)/st.risk;mfe=Math.max(mfe,fav);mae=Math.max(mae,adv);if(dir==="LONG"){if(lo<=st.stop){hit="STOP";break}if(hi>=st.t2){hit="TP2";break}if(hi>=st.t1&&!hit)hit="TP1"}else{if(hi>=st.stop){hit="STOP";break}if(lo<=st.t2){hit="TP2";break}if(lo<=st.t1&&!hit)hit="TP1"}}let r=hit==="TP2"?1.85:hit==="TP1"?1.05:hit==="STOP"?-1:(mfe>1?0.4:-0.3);trades.push({r,hit,mfe,mae,bars,fast:hit==="STOP"&&bars<=4});cool=5}if(!trades.length)return{count:0,win:0,pf:0,fast:100,net:0,avgMfe:0,avgMae:0,maxDd:0,tp2Rate:0,expectancy:0,trades:[]};const wins=trades.filter(t=>t.r>0),losses=trades.filter(t=>t.r<0);const gp=wins.reduce((a,b)=>a+b.r,0),gl=-losses.reduce((a,b)=>a+b.r,0);let eq=0,peak=0,maxDd=0;for(const t of trades){eq+=t.r;peak=Math.max(peak,eq);maxDd=Math.max(maxDd,peak-eq)}const net=trades.reduce((a,b)=>a+b.r,0);return{count:trades.length,win:wins.length/trades.length*100,pf:gp/(gl||.01),fast:trades.filter(t=>t.fast).length/trades.length*100,net,avgMfe:avg(trades.map(t=>t.mfe)),avgMae:avg(trades.map(t=>t.mae)),maxDd,tp2Rate:trades.filter(t=>t.hit==="TP2").length/trades.length*100,expectancy:net/trades.length,trades:trades.slice(-10)}}
function selectTopByDir(dir){
  const arr=pool.filter(x=>x.dir===dir).sort((a,b)=>b.rankScore-a.rankScore);
  const selected=[],used=new Set();
  for(const x of arr){
    if(selected.length>=RULE.showEach)break;
    const key=x.sym+"_"+dir;
    if(used.has(key))continue;
    x.listMode=`TEKNİK HAVUZDAN BACKTEST EN İYİ 5 ${dir}`;
    selected.push(x);
    used.add(key);
  }
  return selected;
}
function renderSummary(){
  const long=pool.filter(x=>x.dir==="LONG"),short=pool.filter(x=>x.dir==="SHORT");
  const topLong=selectTopByDir("LONG"),topShort=selectTopByDir("SHORT");
  scan.passedTech=pool.length;
  $("summary").innerHTML=`<div class="dash"><div><b>${SYMBOLS.length}</b><span>coin evreni</span></div><div><b>${scan.done}/${scan.total}</b><span>sembol/TF analiz</span></div><div><b>${scan.dirChecks}</b><span>yön kontrolü</span></div><div><b>${long.length}</b><span>LONG teknik kapı havuzu</span></div><div><b>${short.length}</b><span>SHORT teknik kapı havuzu</span></div><div><b>${topLong.length}+${topShort.length}</b><span>ilk 5+5 backtest</span></div><div><b>${scan.rest}</b><span>REST</span></div><div><b>${scan.json}</b><span>JSON</span></div><div><b>${scan.stale}</b><span>canlı alınamadı</span></div><div><b>${scan.out}</b><span>elenen yön</span></div></div><div class="note"><b>v16.10 kuralı:</b> Teknik kapı Dengeli moddan Bilimsel Dengeli+ moda alındı: layer≥6/14, teknik≥52, icra≥60, TP2_R≥1.50, 0.70≤stopATR≤2.60. Canlı veri ve backtest standardı korunur. Önce teknik kapı çalışır, geçenler teknik havuza alınır; backtest bu havuzdaki adayların sıralama ölçüsüdür. Final yayın backtest dayanıklılığı en iyi 5 LONG ve en iyi 5 SHORT olarak ayrı sıralanır.</div>`
}
function card(x,i){
  const cls=x.dir==="SHORT"?"short":"long";
  const sc=Math.round(x.rankScore);
  return `<div class="candidate ${cls}" onclick="selectCandidate('${x.key}')"><div class="top"><div><div class="sym">${i+1}) ${x.sym} / ${x.tf}</div><div class="model">${x.dir} — ${x.model.replace(/^LONG — |^SHORT — /,'')}</div></div><div class="score ${x.dir.toLowerCase()}">${sc}<br><span style="font-size:16px">BT</span></div></div><div class="line">Liste modu: ${x.listMode||"BACKTEST EN İYİ"} | Yön: ${x.dir} | Teknik geçiş: ${x.layerHits}/14 | Sınıf: ${x.quality}<br>Teknik bağlam: Teknik ${Math.round(x.tech)} / İcra ${Math.round(x.exec)} / Backtest sağlık ${Math.round(x.back)} / Veri ${x.dataScore}<br>Bağlam: Trend ${Math.round(x.context?.trendCtx??0)} / Yapı-Lokasyon ${Math.round(x.context?.structureCtx??0)} / Tetik ${Math.round(x.context?.triggerCtx??0)} / İcra ${Math.round(x.context?.executionCtx??0)}<br>Giriş ${dual(x.entry)}<br>Stop ${dual(x.stop)} | stopATR ${fmt(x.stopAtr,2)} | Stop ${pct(x.stopPct,2)} | TP2 alanı ${fmt(x.tp2Area,2)}R<br>TP1 ${dual(x.t1)} | TP2 ${dual(x.t2)} | TP3 ${dual(x.t3)}<br><b>Backtest:</b> İşlem ${x.bt.count} | Win ${pct(x.bt.win,1)} | PF ${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)} | Hızlı stop ${pct(x.bt.fast,1)} | Net ${fmt(x.bt.net,2)}R | Beklenti ${fmt(x.bt.expectancy||0,2)}R | MFE/MAE ${fmt(x.bt.avgMfe,2)}R/${fmt(x.bt.avgMae,2)}R<br>Veri: ${x.ageSec} sn | Kaynak: ${x.source}</div><div><span class="pill ${x.dir==='LONG'?'green':'red'}">${x.dir} TEKNİK ADAY</span><span class="pill blue">${VERSION}</span><span class="pill amber">BACKTEST SIRALAMA</span><span class="pill amber">${x.quality}</span></div></div>`
}
function renderList(){
  renderSummary();
  pool.forEach((x,idx)=>x.key=x.key||`${x.sym}_${x.tf}_${x.dir}_${idx}`);
  const topLong=selectTopByDir("LONG");
  const topShort=selectTopByDir("SHORT");
  const map=new Map(pool.map(x=>[x.key,x]));
  window.__candMap=map;
  $("list").innerHTML=`<div class="listSection long"><h3>Backtest En İyi 5 LONG</h3><p>Önce teknik kapıdan geçen LONG adayları teknik havuza alınır; bu havuzun içinde backtest dayanıklılığı en yüksek ilk 5 sıralanır.</p>${topLong.length?topLong.map((x,i)=>card(x,i)).join(''):'<p>LONG tarafında teknik + backtest barajını geçen aday yok.</p>'}</div><div class="listSection short"><h3>Backtest En İyi 5 SHORT</h3><p>Önce teknik kapıdan geçen SHORT adayları teknik havuza alınır; bu havuzun içinde backtest dayanıklılığı en yüksek ilk 5 sıralanır.</p>${topShort.length?topShort.map((x,i)=>card(x,i)).join(''):'<p>SHORT tarafında teknik + backtest barajını geçen aday yok.</p>'}</div>`;
  const first=topLong[0]||topShort[0];
  if(first&&!selected)selectCandidate(first.key,true)
}

function selectCandidate(key,silent=false){const x=window.__candMap&&window.__candMap.get(key);if(!x)return;selected=x;$("decision").className="decision "+(x.dir==="LONG"?"long":"short");$("decision").textContent=`${x.sym} ${x.dir} / ${x.tf} — ${x.listMode}`;function m(k,v){return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`}$("metrics").innerHTML=m("BT Sınıf",x.quality)+m("BT Endeks",Math.round(x.btRank))+m("Katman",`${x.layerHits}/14`)+m("Giriş",dual(x.entry))+m("Stop",dual(x.stop))+m("stopATR",fmt(x.stopAtr,2))+m("Stop %",pct(x.stopPct,2))+m("TP1",dual(x.t1))+m("TP2",dual(x.t2))+m("TP3",dual(x.t3))+m("Win",pct(x.bt.win,1))+m("PF",x.bt.pf>=20?"20+":fmt(x.bt.pf,2))+m("Hızlı stop",pct(x.bt.fast,1));const qty=RULE.spotTry/(x.entry*(fx.rate||1));const riskTry=Math.abs(x.entry-x.stop)*qty*(fx.rate||1);$("tryPlan").innerHTML=`<b>${x.dir} teknik plan</b><br>Teknik kapı havuzundan seçilmiş adaydır; final sıralama bu havuz içindeki backtest dayanıklılığına göre yapılır. 10.000 TL varsayımıyla yaklaşık miktar: ${fmt(qty,2)} ${base(x.sym)}. Tahmini risk: ${fmt(riskTry,2)} TL. TP1/TP2/TP3 fiyatları yukarıda.`;$("reasons").innerHTML=Object.entries(x.scores).map(([k,v])=>`<span class="pill ${v>=65?'green':v>=50?'amber':'gray'}">${k}: ${Math.round(v)}</span>`).join('');renderChart(x);renderBt(x);if(!silent)document.getElementById('planBox').scrollIntoView({behavior:'smooth',block:'start'})}
function renderBt(x){const trs=(x.bt.trades||[]).slice(-8);$("bt").innerHTML=`<div class="grid"><div class="metric"><div class="k">İşlem</div><div class="v">${x.bt.count}</div></div><div class="metric"><div class="k">Win</div><div class="v">${pct(x.bt.win,1)}</div></div><div class="metric"><div class="k">PF</div><div class="v">${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)}</div></div><div class="metric"><div class="k">Net R</div><div class="v">${fmt(x.bt.net,2)}</div></div><div class="metric"><div class="k">MFE/MAE</div><div class="v">${fmt(x.bt.avgMfe,2)}R / ${fmt(x.bt.avgMae,2)}R</div></div><div class="metric"><div class="k">Hızlı stop</div><div class="v">${pct(x.bt.fast,1)}</div></div></div><div class="note">Final sıra backtest dayanıklılığına göre verilir: işlem sayısı, win, PF, hızlı stop, Net R, MFE/MAE, max DD ve TP2 oranı birlikte okunur. A+ etiketi ayrıca teknik katman/teknik skor/işlem sayısı barajlarını geçmeden verilmez.</div>`}
function renderChart(x){const raw=market.data&&market.data[x.sym]&&market.data[x.sym][x.tf];const c=raw?raw.slice(-80):[];const canvas=$("chart"),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);if(!c.length)return;const vals=c.flatMap(z=>[z.high,z.low,x.entry,x.stop,x.t1,x.t2,x.t3]);const mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*.08||1;const y=v=>h-20-(v-(mn-pad))/(mx-mn+pad*2)*(h-40),xpos=i=>20+i*(w-40)/(c.length-1);ctx.lineWidth=3;ctx.strokeStyle="#89aaff";ctx.beginPath();c.forEach((z,i)=>{const xx=xpos(i),yy=y(z.close);if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy)});ctx.stroke();function line(v,col,txt){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();ctx.fillStyle=col;ctx.font="18px Arial";ctx.fillText(txt,24,y(v)-5)}line(x.entry,"#ffd166","Giriş");line(x.stop,"#ff6b8a","Stop");line(x.t1,"#7cff9f","TP1");line(x.t2,"#7cff9f","TP2");line(x.t3,"#7cff9f","TP3")}
async function oneClickScan(){pool=[];selected=null;scan={done:0,total:0,dirChecks:0,passedTech:0,btPassed:0,out:0,json:0,rest:0,stale:0,invalid:0};$("mainBtn").disabled=true;setMeta("Veri bağlantısı kuruluyor...");setBar(0);await loadMarket();await loadFx();await getUniverse();scan.total=SYMBOLS.length*TFS.length;setDataBox();for(const sym of SYMBOLS){for(const tf of TFS){const raw=await getCandles(sym,tf);scan.done++;setBar(scan.done/scan.total*100);if(raw&&raw.length>=220){for(const dir of ["LONG","SHORT"]){scan.dirChecks++;const c=analyzeLast(sym,tf,raw,dir);if(c)pool.push(c);else scan.out++}}else{scan.dirChecks+=2;scan.out+=2}setMeta(`Tarama ${scan.done}/${scan.total} | ${sym} ${tf} | Teknik havuz ${pool.length} | LONG ${pool.filter(x=>x.dir==='LONG').length} | SHORT ${pool.filter(x=>x.dir==='SHORT').length}`);if(scan.done%8===0){renderList();await new Promise(r=>setTimeout(r,0))}}}pool=dedup(pool).sort((a,b)=>b.rankScore-a.rankScore);renderList();setMeta(`Tarama bitti: ${scan.done}/${scan.total} sembol/TF | Yön kontrolü ${scan.dirChecks} | Teknik havuz ${pool.length} | Backtest en iyi 5 LONG + 5 SHORT hazır`);$("mainBtn").disabled=false}
function dedup(arr){const seen=new Map();for(const x of arr){const key=x.sym+"_"+x.tf+"_"+x.dir;const old=seen.get(key);if(!old||x.rankScore>old.rankScore)seen.set(key,x)}return [...seen.values()]}
loadMarket().then(loadFx);
