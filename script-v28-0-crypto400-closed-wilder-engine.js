window.__AYAZ_ACTIVE_VERSION__="v28.0-closed-wilder-structural-engine";
const VERSION="v28.0 KRİPTO CLOSED CANDLE + WILDER + STRUCTURAL STOP MOTORU";
const TFS=["15m","30m","1h","2h","4h"];
const TFMS={"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000};
const CRYPTO_LIMIT=400;
const RULE={
  limit15:900, limit1h:650, maxCryptoAgeSec:420, topN:10, watchMs:65000,
  minStopPct:0.35, maxStopPct:6.50, atrStop:1.15, tp1R:1, tp2R:2, tp3R:3,
  maxHoldBars:40, fxMaxAgeSec:300,
  minBacktestTrades:10, minBacktestWin:42, minBacktestPf:1.20, minBacktestNetR:1.00,
  maxFastStopRate:28, minTp2Rate:18, minMfeMae:1.05,
  adaptiveMinTrades:6, adaptivePf:2.20, adaptiveNetR:4.00, adaptiveFastStop:15, adaptiveTp2Rate:30, adaptiveMfeMae:1.25,
  minLiveVolRatio:0.65
};
function maxStopAllowed(tf){return ({"15m":4.80,"30m":5.50,"1h":6.80,"2h":7.50,"4h":8.50}[tf]||6.80)}
function minBtTrades(tf){return ({"15m":8,"30m":8,"1h":10,"2h":10,"4h":10}[tf]||10)}
function maxAgeAllowed(tf){return Math.floor((TFMS[tf]||3600000)/1000)+420}
let fx={rate:null,source:"-",updatedAt:null,ageSec:null,stale:true};
const DEFAULT_CRYPTO=["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "TRXUSDT", "LINKUSDT", "AVAXUSDT", "LTCUSDT", "BCHUSDT", "DOTUSDT", "NEARUSDT", "APTUSDT", "OPUSDT", "ARBUSDT", "SUIUSDT", "INJUSDT", "ATOMUSDT", "UNIUSDT", "AAVEUSDT", "ETCUSDT", "FILUSDT", "WIFUSDT", "PEPEUSDT", "FETUSDT", "CAKEUSDT", "HBARUSDT", "WLDUSDT", "TIAUSDT", "SEIUSDT", "JUPUSDT", "JTOUSDT", "PYTHUSDT", "ORDIUSDT", "RUNEUSDT", "MKRUSDT", "LDOUSDT", "ENAUSDT", "ETHFIUSDT", "STRKUSDT", "STXUSDT", "GRTUSDT", "ARUSDT", "ICPUSDT", "IMXUSDT", "MANTAUSDT", "ALTUSDT", "PORTALUSDT", "RONINUSDT", "PIXELUSDT", "DYMUSDT", "AEVOUSDT", "BOMEUSDT", "SAGAUSDT", "TAOUSDT", "OMNIUSDT", "REZUSDT", "NOTUSDT", "IOUSDT", "ZKUSDT", "ZROUSDT", "LISTAUSDT", "BANANAUSDT", "RENDERUSDT", "TONUSDT", "DOGSUSDT", "EIGENUSDT", "SCRUSDT", "ACTUSDT", "PNUTUSDT", "NEIROUSDT", "TURBOUSDT", "MEWUSDT", "GOATUSDT", "MOODENGUSDT", "PENDLEUSDT", "MINAUSDT", "KASUSDT", "GALAUSDT", "SANDUSDT", "MANAUSDT", "AXSUSDT", "CHZUSDT", "APEUSDT", "DYDXUSDT", "GMTUSDT", "FLOWUSDT", "SNXUSDT", "CRVUSDT", "COMPUSDT", "SUSHIUSDT", "YFIUSDT", "1INCHUSDT", "ZRXUSDT", "BALUSDT", "LPTUSDT", "ENSUSDT", "MASKUSDT", "API3USDT", "CTSIUSDT", "ANKRUSDT", "CELOUSDT", "KAVAUSDT", "ROSEUSDT", "ONEUSDT", "HOTUSDT", "IOTAUSDT", "IOTXUSDT", "ZILUSDT", "QTUMUSDT", "ONTUSDT", "VETUSDT", "THETAUSDT", "TFUELUSDT", "EGLDUSDT", "KSMUSDT", "WAVESUSDT", "RVNUSDT", "XLMUSDT", "XMRUSDT", "ZECUSDT", "DASHUSDT", "ENJUSDT", "BATUSDT", "ICXUSDT", "IOSTUSDT", "STORJUSDT", "SKLUSDT", "BANDUSDT", "BLZUSDT", "KNCUSDT", "OCEANUSDT", "NKNUSDT", "DENTUSDT", "CELRUSDT", "COTIUSDT", "CHRUSDT", "DUSKUSDT", "ALGOUSDT", "XTZUSDT", "FLUXUSDT", "JOEUSDT", "GMXUSDT", "ACHUSDT", "HIGHUSDT", "HOOKUSDT", "MAGICUSDT", "IDUSDT"];
const BAD_BASE=new Set(["USDC","FDUSD","TUSD","BUSD","DAI","USDP","TRY","EUR","PAX"]);
let cryptoSymbols=[...DEFAULT_CRYPTO], watchActive=false, watchTimer=null, scanRunning=false, cycle=0;
let pools={crypto:{LONG:[],SHORT:[]}}, selected=null;
let stats={done:0,total:0,sets:0,candles:0,source:'-',age:'-',stale:0,passedGate:0};
const $=id=>document.getElementById(id), now=()=>Date.now();
function fmt(n,d=2){return n==null||!isFinite(n)?'-':Number(n).toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(n,d=1){return fmt(n,d)+'%'}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function avg(a){return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function sum(a){return a&&a.length?a.reduce((x,y)=>x+y,0):0}
function dec(n){n=Math.abs(Number(n)||0); if(n>=1000)return 2;if(n>=100)return 3;if(n>=1)return 4;if(n>=.01)return 5;return 8}
function setBar(p){const el=$('bar');if(el)el.style.width=clamp(p,0,100)+'%'}
function setMeta(t){const el=$('meta');if(el)el.textContent=t}
function setButtons(){['cryptoScanBtn','cryptoWatchBtn'].forEach(id=>{const el=$(id);if(el)el.disabled=scanRunning||watchActive;});const st=$('stopBtn');if(st)st.disabled=!watchActive;}
async function jfetch(url,timeout=14000){const c=new AbortController();const id=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal,headers:{'Accept':'application/json,text/plain,*/*'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(id)}}
function proxies(url){const e=encodeURIComponent(url);return [url,`https://api.allorigins.win/raw?url=${e}`,`https://corsproxy.io/?${e}`]}
function fxAgeSec(){return fx.updatedAt?Math.max(0,Math.floor((now()-fx.updatedAt)/1000)):(fx.ageSec??null)}
async function loadFx(force=false){
  if(!force&&fx.rate&&fxAgeSec()!=null&&fxAgeSec()<=RULE.fxMaxAgeSec)return true;
  const sources=[
    {source:'BINANCE-DATA USDTTRY',url:'https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY',parse:j=>Number(j.price)},
    {source:'BINANCE-SPOT USDTTRY',url:'https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY',parse:j=>Number(j.price)},
    {source:'BTCTURK USDTTRY',url:'https://api.btcturk.com/api/v2/ticker?pairSymbol=USDTTRY',parse:j=>Number(j?.data?.[0]?.last)},
    {source:'COINBASE USDT/TRY',url:'https://api.coinbase.com/v2/exchange-rates?currency=USDT',parse:j=>Number(j?.data?.rates?.TRY)}
  ];
  for(const src of sources){for(const u of proxies(src.url)){try{const j=await jfetch(u,9000);const r=src.parse(j);if(isFinite(r)&&r>10&&r<250){fx={rate:r,source:src.source,updatedAt:now(),ageSec:0,stale:false};return true}}catch(e){}}}
  if(fx.rate){fx.stale=true;fx.ageSec=fxAgeSec();return false}
  fx={rate:46.1,source:'ACİL YEDEK KUR',updatedAt:null,ageSec:null,stale:true};return false;
}
function tl(n){if(!fx.rate||!isFinite(n))return '- TL';const v=n*fx.rate;return fmt(v, v>=100?2:v>=1?4:6)+' TL'}
function fxLine(){const age=fxAgeSec();const cls=fx.stale?'bad':'ok';return `Kur: <b class="${cls}">1 USDT ≈ ${fmt(fx.rate||0,4)} TL</b> | Kaynak: ${fx.source} | Yaş: ${age??'-'} sn${fx.stale?' | UYARI: TL yaklaşık':''}`}
function cleanCrypto(s){const u=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z0-9]{2,14}USDT$/.test(u))return null;const b=u.replace(/USDT$/,'');if(BAD_BASE.has(b))return null;return u}
function displaySymbol(x){return x.sym}
function dual(x,n){return `${fmt(n,dec(n))} USDT / ${tl(n)}`}
function cryptoRows(raw,src){
  if(!Array.isArray(raw))return [];
  const tnow=now();
  // V28: karar motoru yalnızca kapanmış mumla çalışır. Binance son açık mumu üretirse analizden atılır.
  return raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6],liveTime:+k[6],source:src,closed:+k[6] <= tnow-1000}))
    .filter(k=>k.closed&&isFinite(k.close)&&isFinite(k.high)&&isFinite(k.low)&&isFinite(k.open))
    .sort((a,b)=>a.time-b.time)
}
function aggregate(c,ms){
  if(!c||!c.length)return [];
  const map=new Map();
  for(const k of c){
    const bucket=Math.floor(k.time/ms)*ms;
    let x=map.get(bucket);
    if(!x)x={time:bucket,open:k.open,high:k.high,low:k.low,close:k.close,volume:0,closeTime:bucket+ms-1,liveTime:bucket+ms-1,source:k.source,closed:false};
    x.high=Math.max(x.high,k.high);x.low=Math.min(x.low,k.low);x.close=k.close;x.volume+=(k.volume||0);x.source=k.source;
    map.set(bucket,x)
  }
  const tnow=now();
  return [...map.values()].filter(x=>x.closeTime<=tnow-1000).sort((a,b)=>a.time-b.time)
}
async function cryptoUniverse(){try{const ticks=await jfetch('https://api.binance.com/api/v3/ticker/24hr',12000);const arr=ticks.filter(t=>cleanCrypto(t.symbol)&&Number(t.quoteVolume)>150000).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,CRYPTO_LIMIT).map(t=>cleanCrypto(t.symbol));if(arr.length>50)cryptoSymbols=[...new Set(arr)]}catch(e){cryptoSymbols=[...DEFAULT_CRYPTO]}}
async function fetchCryptoBase(sym,interval,limit){const urls=[`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,`https://api1.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${limit}`];for(const u of urls){for(const pu of proxies(u)){try{const raw=await jfetch(pu,10000);const arr=cryptoRows(raw,pu.includes('fapi')?'BINANCE-FUTURES':'BINANCE');if(arr.length>120)return arr}catch(e){}}}return []}
async function getCryptoSets(sym){const c15=await fetchCryptoBase(sym,'15m',RULE.limit15);const c1h=await fetchCryptoBase(sym,'1h',RULE.limit1h);return {"15m":c15,"30m":aggregate(c15,TFMS['30m']),"1h":c1h,"2h":aggregate(c1h,TFMS['2h']),"4h":aggregate(c1h,TFMS['4h'])}}
function ema(prev,price,len){const k=2/(len+1);return prev==null?price:price*k+prev*(1-k)}
function smaAt(arr,i,len){const s=arr.slice(Math.max(0,i-len+1),i+1);return avg(s)}
function rma(prev,val,len,seedArr){
  if(prev==null){
    if(seedArr&&seedArr.length>=len)return avg(seedArr.slice(seedArr.length-len));
    return val;
  }
  return (prev*(len-1)+val)/len;
}
function enrich(raw){
  const c=raw.map(x=>({...x})).filter(x=>isFinite(x.close)&&isFinite(x.high)&&isFinite(x.low)&&isFinite(x.open));
  const vols=[], trs=[], gains=[], losses=[], plusDMs=[], minusDMs=[], dxs=[];
  let e9=null,e21=null,e50=null,e200=null,macF=null,macS=null,macSig=null;
  let atrR=null,gainR=null,lossR=null,plusR=null,minusR=null,adxR=null;
  for(let i=0;i<c.length;i++){
    const x=c[i],p=c[i-1]||x;
    vols.push(x.volume||0);
    const tr=Math.max(x.high-x.low,Math.abs(x.high-p.close),Math.abs(x.low-p.close));
    trs.push(tr);
    const up=x.high-p.high, dn=p.low-x.low;
    const plus=up>dn&&up>0?up:0, minus=dn>up&&dn>0?dn:0;
    plusDMs.push(plus); minusDMs.push(minus);
    // V28: TradingView'e daha yakın Wilder/RMA ATR, RSI ve DMI/ADX.
    atrR=rma(atrR,tr,14,trs); x.atr=atrR; x.atrPct=x.close?atrR/x.close*100:0;
    e9=ema(e9,x.close,9);e21=ema(e21,x.close,21);e50=ema(e50,x.close,50);e200=ema(e200,x.close,200);x.ema9=e9;x.ema21=e21;x.ema50=e50;x.ema200=e200;
    macF=ema(macF,x.close,12);macS=ema(macS,x.close,26);x.macd=macF-macS;macSig=ema(macSig,x.macd,9);x.macdSig=macSig;x.macdHist=x.macd-x.macdSig;
    const ch=i?x.close-c[i-1].close:0;const g=Math.max(0,ch),l=Math.max(0,-ch);gains.push(g);losses.push(l);
    gainR=rma(gainR,g,14,gains);lossR=rma(lossR,l,14,losses);x.rsi=lossR?100-(100/(1+gainR/lossR)):(gainR?100:50);
    plusR=rma(plusR,plus,14,plusDMs);minusR=rma(minusR,minus,14,minusDMs);
    const pdi=atrR?100*plusR/atrR:0, mdi=atrR?100*minusR/atrR:0;const dx=(pdi+mdi)?100*Math.abs(pdi-mdi)/(pdi+mdi):0;dxs.push(dx);adxR=rma(adxR,dx,14,dxs);x.pdi=pdi;x.mdi=mdi;x.adx=adxR;
    x.volSma20=smaAt(vols,i,20);x.volRatio=x.volSma20?x.volume/x.volSma20:1;
    x.body=Math.abs(x.close-x.open);x.range=Math.max(1e-12,x.high-x.low);x.bodyPct=x.body/x.range*100;x.upperWick=(x.high-Math.max(x.open,x.close))/x.range*100;x.lowerWick=(Math.min(x.open,x.close)-x.low)/x.range*100;
  }
  return c;
}
function pivotList(c,i,kind,left=3,right=2){const out=[];for(let x=left;x<=i-right;x++){let ok=true;for(let j=x-left;j<=x+right;j++){if(j===x)continue;if(kind==='H'&&c[j].high>=c[x].high)ok=false;if(kind==='L'&&c[j].low<=c[x].low)ok=false}if(ok)out.push({i:x,v:kind==='H'?c[x].high:c[x].low})}return out}
function lineVal(p1,p2,i){if(!p1||!p2||p1.i===p2.i)return null;const m=(p2.v-p1.v)/(p2.i-p1.i);return p2.v+m*(i-p2.i)}
function lastN(a,n){return a.slice(Math.max(0,a.length-n))}
function trendContext(c,i){
  const x=c[i], p10=c[Math.max(0,i-10)], p20=c[Math.max(0,i-20)];
  const highs=pivotList(c,i,'H'), lows=pivotList(c,i,'L');const H=lastN(highs,3), L=lastN(lows,3);
  const upStruct=H.length>=2&&L.length>=2&&H[H.length-1].v>H[H.length-2].v&&L[L.length-1].v>L[L.length-2].v;
  const downStruct=H.length>=2&&L.length>=2&&H[H.length-1].v<H[H.length-2].v&&L[L.length-1].v<L[L.length-2].v;
  const emaUp=x.close>x.ema50&&x.ema21>x.ema50&&x.ema50>=x.ema200*0.995&&x.ema21>p10.ema21;
  const emaDown=x.close<x.ema50&&x.ema21<x.ema50&&x.ema50<=x.ema200*1.005&&x.ema21<p10.ema21;
  let state='RANGE';if((upStruct||emaUp)&&!emaDown)state='UP';if((downStruct||emaDown)&&!emaUp)state='DOWN';
  const lastHigh=H[H.length-1]||null, prevHigh=H[H.length-2]||null, lastLow=L[L.length-1]||null, prevLow=L[L.length-2]||null;
  const resLine=prevHigh&&lastHigh?{p1:prevHigh,p2:lastHigh,value:lineVal(prevHigh,lastHigh,i),falling:lastHigh.v<prevHigh.v}:null;
  const supLine=prevLow&&lastLow?{p1:prevLow,p2:lastLow,value:lineVal(prevLow,lastLow,i),rising:lastLow.v>prevLow.v}:null;
  const breakDownLine=resLine&&resLine.falling&&x.close>resLine.value+0.08*x.atr;
  const breakUpLine=supLine&&supLine.rising&&x.close<supLine.value-0.08*x.atr;
  const strength=clamp((x.adx||0)/35*50 + (Math.abs(x.ema21-x.ema50)/x.close*100)*10 + (upStruct||downStruct?25:0),0,100);
  return {state,upStruct,downStruct,lastHigh,prevHigh,lastLow,prevLow,resLine,supLine,breakDownLine,breakUpLine,strength,emaUp,emaDown};
}
function structureContext(c,i,dir,tr){const x=c[i],atr=x.atr||0;const lh=tr.lastHigh, ll=tr.lastLow;let bos=false,choch=false;let ref=null;if(dir==='LONG'){ref=lh;bos=!!lh&&x.close>lh.v+0.10*atr;choch=(tr.state==='DOWN'||tr.downStruct)&&bos;}else{ref=ll;bos=!!ll&&x.close<ll.v-0.10*atr;choch=(tr.state==='UP'||tr.upStruct)&&bos;}return {bos,choch,ref}}
function levelContext(c,i,dir,tr){
  const x=c[i],atr=x.atr||0, highs=lastN(pivotList(c,i,'H'),8), lows=lastN(pivotList(c,i,'L'),8);
  const supports=lows.map(p=>p.v).filter(v=>v<x.close).sort((a,b)=>b-a);const resistances=highs.map(p=>p.v).filter(v=>v>x.close).sort((a,b)=>a-b);
  const support=supports[0]??Math.min(...c.slice(Math.max(0,i-30),i+1).map(k=>k.low));
  const resistance=resistances[0]??Math.max(...c.slice(Math.max(0,i-30),i+1).map(k=>k.high));
  const distSupport=atr?Math.abs(x.close-support)/atr:99, distResistance=atr?Math.abs(resistance-x.close)/atr:99;
  const roomLong=atr?(resistance-x.close)/atr:0, roomShort=atr?(x.close-support)/atr:0;
  const nearSupport=distSupport<=1.35 || (tr.resLine&&tr.breakDownLine);
  const nearResistance=distResistance<=1.35 || (tr.supLine&&tr.breakUpLine);
  return {support,resistance,distSupport,distResistance,roomLong,roomShort,nearSupport,nearResistance,ok:dir==='LONG'?(roomLong>=1.2||nearSupport):(roomShort>=1.2||nearResistance)};
}
function candleContext(c,i,dir){
  const x=c[i],p=c[i-1]||x,pp=c[i-2]||p;const bull=x.close>x.open,bear=x.close<x.open;
  const bullEng=bull&&p.close<p.open&&x.close>=p.open&&x.open<=p.close;
  const bearEng=bear&&p.close>p.open&&x.close<=p.open&&x.open>=p.close;
  const hammer=bull&&x.lowerWick>=42&&x.upperWick<=32&&x.bodyPct>=16;
  const shooting=bear&&x.upperWick>=42&&x.lowerWick<=32&&x.bodyPct>=16;
  const momentumBull=bull&&x.bodyPct>=44&&x.close>p.high&&x.volRatio>=0.85;
  const momentumBear=bear&&x.bodyPct>=44&&x.close<p.low&&x.volRatio>=0.85;
  const insideBreakBull=bull&&x.close>Math.max(p.high,pp.high)&&x.bodyPct>=34&&x.volRatio>=0.70;
  const insideBreakBear=bear&&x.close<Math.min(p.low,pp.low)&&x.bodyPct>=34&&x.volRatio>=0.70;
  const strongBull=bull&&x.bodyPct>=48&&x.close>=p.close&&x.volRatio>=0.65;
  const strongBear=bear&&x.bodyPct>=48&&x.close<=p.close&&x.volRatio>=0.65;
  const ok=dir==='LONG'?(bullEng||hammer||momentumBull||insideBreakBull||strongBull):(bearEng||shooting||momentumBear||insideBreakBear||strongBear);
  const name=dir==='LONG'?(bullEng?'Bullish engulfing':hammer?'Hammer/pinbar':momentumBull?'Güçlü yeşil kırılım':insideBreakBull?'İç yapı yukarı kırılım':strongBull?'Güçlü yeşil gövde':'Yetersiz mum'):(bearEng?'Bearish engulfing':shooting?'Shooting star/pinbar':momentumBear?'Güçlü kırmızı kırılım':insideBreakBear?'İç yapı aşağı kırılım':strongBear?'Güçlü kırmızı gövde':'Yetersiz mum');
  return {ok,name,bullEng,bearEng,hammer,shooting,momentumBull,momentumBear,insideBreakBull,insideBreakBear,strongBull,strongBear,bodyPct:x.bodyPct,volRatio:x.volRatio};
}
function liquidityContext(c,i,dir,lv){
  const x=c[i],atr=x.atr||0;const lo=Math.min(...c.slice(Math.max(0,i-20),i).map(k=>k.low));const hi=Math.max(...c.slice(Math.max(0,i-20),i).map(k=>k.high));
  const sweepLong=x.low<Math.min(lo,lv.support)-0.05*atr && x.close>Math.min(lo,lv.support)+0.10*atr;
  const sweepShort=x.high>Math.max(hi,lv.resistance)+0.05*atr && x.close<Math.max(hi,lv.resistance)-0.10*atr;
  return {ok:dir==='LONG'?sweepLong:sweepShort,sweepLong,sweepShort,ref:dir==='LONG'?Math.min(lo,lv.support):Math.max(hi,lv.resistance)};
}
function indicatorContext(c,i,dir){
  const x=c[i],p=c[i-1]||x;let checks=[];
  if(dir==='LONG'){
    checks=[x.close>x.ema21, x.ema9>=x.ema21*0.998, x.ema21>=p.ema21*0.999, x.rsi>=43&&x.rsi<=76, x.macdHist>=p.macdHist||x.macdHist>0, x.adx>=13, x.pdi>=x.mdi*0.82, x.volRatio>=0.60];
  }else{
    checks=[x.close<x.ema21, x.ema9<=x.ema21*1.002, x.ema21<=p.ema21*1.001, x.rsi<=57&&x.rsi>=24, x.macdHist<=p.macdHist||x.macdHist<0, x.adx>=13, x.mdi>=x.pdi*0.82, x.volRatio>=0.60];
  }
  const passed=checks.filter(Boolean).length;return {ok:passed>=5,passed,total:checks.length,rsi:x.rsi,adx:x.adx,pdi:x.pdi,mdi:x.mdi,macdHist:x.macdHist,volRatio:x.volRatio};
}
function enriched(raw){return raw&&raw.length&&raw[raw.length-1].ema21!==undefined?raw:enrich(raw||[])}
function prepareSets(sets){const out={};for(const tf of TFS){out[tf]=enriched((sets&&sets[tf])||[])}return out}
function idxAt(c,t){let lo=0,hi=c.length-1,ans=-1;while(lo<=hi){const m=(lo+hi)>>1;if(c[m].time<=t){ans=m;lo=m+1}else hi=m-1}return ans}
function trendSnapshot(raw){if(!raw||raw.length<160)return null;const c=enriched(raw);const i=c.length-1;return trendContext(c,i)}
function trendSnapshotAt(raw,t){if(!raw||raw.length<160)return null;const c=enriched(raw);const i=idxAt(c,t);if(i<150)return null;return trendContext(c,i)}
function mtfContext(sets,tf,dir,t=null){
  if(!sets)return {ok:false,label:'Üst TF yok',passed:0,total:0,opposite:0,neutral:0};
  const order={"15m":["30m","1h"],"30m":["1h","2h"],"1h":["2h","4h"],"2h":["4h"],"4h":["4h"]}[tf]||["1h","4h"];
  let passed=0,total=0,opposite=0,neutral=0,labels=[];
  for(const htf of order){
    const s=t==null?trendSnapshot(sets[htf]):trendSnapshotAt(sets[htf],t);
    if(!s)continue;
    total++;
    const good=dir==='LONG'?(s.state==='UP'||(s.state==='RANGE'&&s.breakDownLine)):(s.state==='DOWN'||(s.state==='RANGE'&&s.breakUpLine));
    const bad=dir==='LONG'?s.state==='DOWN':s.state==='UP';
    if(good)passed++; else if(bad)opposite++; else neutral++;
    labels.push(`${htf}:${s.state}`);
  }
  // Dengeli kapı: üst TF tam ters olmamalı. En az bir üst TF uygun veya hepsi range/kararsız ise nötr kabul edilir.
  const ok=total>0 && opposite===0 && (passed>=1 || neutral===total);
  return {ok,label:labels.join(' / ')||'Üst TF yok',passed,total,opposite,neutral};
}
function setupZoneName(dir,trend,levels,liquidity,x){
  if(liquidity.ok)return dir==='LONG'?'Likidite sweep sonrası reclaim':'Üst likidite sweep sonrası ret';
  if(dir==='LONG'){
    if(levels.nearSupport)return 'Destek / demand / kırılmış direnç retesti';
    if(trend.breakDownLine)return 'Düşen trend çizgisi kırılım bölgesi';
    if(x.close>=x.ema21*0.995&&x.close<=x.ema50*1.018)return 'EMA21-EMA50 dinamik destek bandı';
    return 'Yapı içi yükseliş alanı';
  }else{
    if(levels.nearResistance)return 'Direnç / supply / kırılmış destek retesti';
    if(trend.breakUpLine)return 'Yükselen trend çizgisi kırılım bölgesi';
    if(x.close<=x.ema21*1.005&&x.close>=x.ema50*0.982)return 'EMA21-EMA50 dinamik direnç bandı';
    return 'Yapı içi düşüş alanı';
  }
}
function gatePack(c,i,dir,trend,structure,levels,candle,liquidity,ind,mtf){
  const x=c[i],p=c[i-1]||x,atr=x.atr||0,long=dir==='LONG';
  const trendAligned=long?trend.state==='UP':trend.state==='DOWN';
  const oppositeTrend=long?trend.state==='DOWN':trend.state==='UP';
  const lineBreak=long?trend.breakDownLine:trend.breakUpLine;
  const nearLevel=long?levels.nearSupport:levels.nearResistance;
  const enoughRoom=long?levels.roomLong>=1.05:levels.roomShort>=1.05;
  const emaZone=long?((x.close>=x.ema21*0.992)||(x.close>=x.ema50*0.992&&x.close<=x.ema21*1.030)):((x.close<=x.ema21*1.008)||(x.close<=x.ema50*1.008&&x.close>=x.ema21*0.970));
  const emaRetest=long?(x.low<=x.ema21+0.40*atr&&x.close>=x.ema21*0.995):(x.high>=x.ema21-0.40*atr&&x.close<=x.ema21*1.005);
  const microBreak=long?(x.close>Math.max(p.high,(trend.resLine&&trend.resLine.value)||p.high)+0.02*atr):(x.close<Math.min(p.low,(trend.supLine&&trend.supLine.value)||p.low)-0.02*atr);
  const srBreak=long?(x.close>levels.resistance+0.04*atr||lineBreak||structure.bos):(x.close<levels.support-0.04*atr||lineBreak||structure.bos);
  const retest=long?((p.close>levels.resistance||trend.breakDownLine||structure.bos)&&x.low<=Math.max(levels.resistance,(trend.resLine&&trend.resLine.value)||levels.resistance)+0.50*atr&&x.close>=x.open):((p.close<levels.support||trend.breakUpLine||structure.bos)&&x.high>=Math.min(levels.support,(trend.supLine&&trend.supLine.value)||levels.support)-0.50*atr&&x.close<=x.open);
  const directionOk=long?(x.close>x.open||x.close>p.high||candle.ok):(x.close<x.open||x.close<p.low||candle.ok);
  const strongBody=directionOk&&x.bodyPct>=48;
  const strongBreak=(srBreak||lineBreak||microBreak)&&strongBody&&x.volRatio>=0.70;
  const volumeOk=(x.volRatio>=0.85&&candle.ok)||(x.volRatio>=0.65&&strongBody)||(x.volRatio>=1.05&&(srBreak||lineBreak||microBreak))||(liquidity.ok&&x.bodyPct>=32);
  const momentumOk=long?((x.rsi>=43&&x.rsi<=77)||(x.macdHist>p.macdHist)||(x.pdi>=x.mdi*0.82)):((x.rsi<=57&&x.rsi>=23)||(x.macdHist<p.macdHist)||(x.mdi>=x.pdi*0.82));
  const triggerOk=candle.ok||liquidity.ok||retest||strongBreak||(emaRetest&&strongBody);
  const locationOk=nearLevel||emaZone||lineBreak||liquidity.ok||retest;
  const structureOk=structure.bos||structure.choch||srBreak||lineBreak||microBreak;
  const groups=[locationOk,triggerOk,momentumOk,volumeOk,directionOk,enoughRoom];
  const groupPass=groups.filter(Boolean).length;
  return {trendAligned,oppositeTrend,lineBreak,nearLevel,enoughRoom,emaZone,emaRetest,microBreak,srBreak,retest,strongBody,strongBreak,volumeOk,momentumOk,directionOk,triggerOk,locationOk,structureOk,groupPass,totalGroups:groups.length,groupsOk:groupPass>=5,mtfOk:mtf.ok};
}
function technicalEvent(c,i,dir,sets=null,tf='1h'){
  if(!c||i<150)return {ok:false,reason:'mum yetersiz'};
  const x=c[i];
  if(!x.atr||!isFinite(x.atr))return {ok:false,reason:'ATR yok'};
  const trend=trendContext(c,i), structure=structureContext(c,i,dir,trend), levels=levelContext(c,i,dir,trend), candle=candleContext(c,i,dir), liquidity=liquidityContext(c,i,dir,levels), ind=indicatorContext(c,i,dir), mtf=mtfContext(sets,tf,dir,x.time);
  const long=dir==='LONG';
  const gates=gatePack(c,i,dir,trend,structure,levels,candle,liquidity,ind,mtf);
  const strategies=[]; const profiles=[];
  const zone=setupZoneName(dir,trend,levels,liquidity,x);
  const indCore=ind.passed>=5;
  const indSoft=ind.passed>=4 && gates.momentumOk && gates.volumeOk;
  const premiumTrigger=candle.ok||liquidity.ok||gates.retest||gates.strongBreak||(gates.emaRetest&&gates.strongBody&&gates.volumeOk);
  const mtfSoft=mtf.ok || (structure.choch&&liquidity.ok&&premiumTrigger);
  function add(name,type,why,entryRule,stopRule,targetRule,priority){strategies.push(name);profiles.push({name,type,why,entryRule,stopRule,targetRule,priority});}

  // 1) Trend Devam: ana trend + lokasyon + tetik + hacim/gövde. BOS/CHOCH zorunlu değildir.
  if(mtf.ok && gates.trendAligned && gates.locationOk && gates.enoughRoom && gates.volumeOk && premiumTrigger && indCore && gates.groupPass>=5){
    add(long?'Trend Devam LONG':'Trend Devam SHORT','TREND_DEVAM',
      long?'Ana ve üst zaman yönü yukarı; fiyat destek/EMA/trend çizgisi bölgesinde alıcı tepkisi verdi.':'Ana ve üst zaman yönü aşağı; fiyat direnç/EMA/trend çizgisi bölgesinde satıcı tepkisi verdi.',
      'Tetikleyici mum kapanışı veya kırılan mikro yapının retest onayı',
      long?'Son onaylı dip / destek / demand altı + 0.20 ATR':'Son onaylı tepe / direnç / supply üstü + 0.20 ATR',
      long?'TP1 en yakın direnç/swing high, TP2 üst TF likidite, TP3 3R veya majör direnç':'TP1 en yakın destek/swing low, TP2 alt likidite, TP3 3R veya majör destek',4);
  }

  // 2) Kırılım-Retest / Kırılım-Onay: retest idealdir; retest yoksa güçlü gövde + hacimli kapanış ister.
  const breakOk=(gates.srBreak||gates.lineBreak||structure.bos);
  const breakRetestOk=breakOk && (gates.retest || gates.strongBreak || (candle.ok&&x.volRatio>=0.85));
  if(mtf.ok && gates.enoughRoom && breakRetestOk && gates.volumeOk && premiumTrigger && indCore && gates.groupPass>=5){
    const brName = gates.retest ? (long?'Kırılım-Retest LONG':'Kırılım-Retest SHORT') : (long?'Kırılım-Onay LONG':'Kırılım-Onay SHORT');
    const brType = gates.retest ? 'KIRILIM_RETEST' : 'KIRILIM_ONAY';
    add(brName,brType,
      gates.retest
        ? (long?'Direnç/düşen trend çizgisi kırıldı ve kırılan bölge retestte korundu.':'Destek/yükselen trend çizgisi kırıldı ve kırılan bölge retestte reddedildi.')
        : (long?'Retest beklenmeden güçlü gövdeli/hacimli kapanışla kırılım onayı geldi.':'Retest beklenmeden güçlü gövdeli/hacimli kapanışla aşağı kırılım onayı geldi.'),
      gates.retest?'Kırılım sonrası retest onay mumu kapanışı':'Güçlü gövdeli ve hacimli kırılım kapanışı',
      long?'Retest/kırılım mumunun geçersizleşme dibi veya kırılan direnç altı + 0.20 ATR':'Retest/kırılım mumunun geçersizleşme tepesi veya kırılan destek üstü + 0.20 ATR',
      long?'TP1 önceki swing high/direnç, TP2 üst likidite/direnç, TP3 3R':'TP1 önceki swing low/destek, TP2 alt likidite/destek, TP3 3R',5);
  }

  // 3) Karakter değişimi: CHOCH zorunlu; likidite/level/çizgi ve tetik birlikte aranır.
  if(mtfSoft && structure.choch && gates.enoughRoom && (liquidity.ok||gates.nearLevel||gates.lineBreak) && premiumTrigger && gates.volumeOk && indCore && gates.groupPass>=5){
    add(long?'Bullish CHOCH Dönüş LONG':'Bearish CHOCH Dönüş SHORT','CHOCH_DONUS',
      long?'Düşen yapı içinde alt likidite/destek sonrası son lower-high üstü kapanış geldi; karakter yukarı döndü.':'Yükselen yapı içinde üst likidite/direnç sonrası son higher-low altı kapanış geldi; karakter aşağı döndü.',
      'CHOCH mumu kapanışı veya CHOCH sonrası kırılan yapının retest onayı',
      long?'Sweep low / CHOCH öncesi son dip altı + 0.20 ATR':'Sweep high / CHOCH öncesi son tepe üstü + 0.20 ATR',
      long?'TP1 ilk direnç, TP2 önceki lower-high/likidite, TP3 3R':'TP1 ilk destek, TP2 önceki higher-low/likidite, TP3 3R',6);
  }

  // 4) EMA Pullback: trendde EMA bandı savunulursa/ret yerse çalışır.
  if(mtf.ok && gates.trendAligned && gates.emaRetest && gates.enoughRoom && gates.volumeOk && premiumTrigger && (indCore||indSoft) && gates.groupPass>=5){
    add(long?'EMA Pullback LONG':'EMA Pullback SHORT','EMA_PULLBACK',
      long?'Yükselen trendde EMA21/EMA50 bölgesine geri çekilme alıcı mumuyla savunuldu.':'Düşen trendde EMA21/EMA50 bölgesine geri çekilme satıcı mumuyla reddedildi.',
      'EMA bandı üstünde/altında teyit mumu kapanışı',
      long?'EMA bandı ve son mini dip altı + 0.20 ATR':'EMA bandı ve son mini tepe üstü + 0.20 ATR',
      long?'TP1 son swing high, TP2 direnç/likidite, TP3 3R':'TP1 son swing low, TP2 destek/likidite, TP3 3R',3);
  }

  // 5) Likidite Reclaim/Sweep: sweep + reclaim/ret + momentum gerekir.
  if(mtfSoft && liquidity.ok && gates.enoughRoom && gates.directionOk && premiumTrigger && gates.volumeOk && (structure.bos||structure.choch||gates.microBreak) && (indCore||indSoft) && gates.groupPass>=5){
    add(long?'Likidite Reclaim LONG':'Likidite Sweep SHORT','LIKIDITE_RECLAIM',
      long?'Alt likidite süpürüldü ve fiyat destek/range içine tekrar kapandı.':'Üst likidite süpürüldü ve fiyat direnç/range içine tekrar kapandı.',
      'Sweep sonrası reclaim/ret mumu kapanışı',
      long?'Süpürülen dip altı + 0.20 ATR':'Süpürülen tepe üstü + 0.20 ATR',
      long?'TP1 range ortası/ilk direnç, TP2 üst likidite, TP3 3R':'TP1 range ortası/ilk destek, TP2 alt likidite, TP3 3R',4);
  }

  profiles.sort((a,b)=>b.priority-a.priority);
  const ok=profiles.length>0;
  const primary=ok?profiles[0].name:'Trade plan yok';
  const selected=profiles[0]||null;
  const reason=ok?selected.why:[
    mtf.ok?'Üst TF uygun':'Üst TF ters/zayıf',
    gates.locationOk?'Lokasyon var':'Destek/direnç/EMA/çizgi lokasyonu yok',
    gates.triggerOk?'Tetik var':'Mum/kırılım/retest/sweep tetik yok',
    gates.volumeOk?'Hacim/gövde var':'Hacim/gövde yetersiz',
    gates.enoughRoom?'Hedef alanı var':'TP alanı yetersiz',
    `İndikatör ${ind.passed}/${ind.total}`,`Grup ${gates.groupPass}/${gates.totalGroups}`
  ].join(' | ');
  return {ok,reason,strategies,profiles,primary,profile:selected,setupZone:zone,trend,structure,levels,candle,liquidity,ind,mtf,gates,tf,
    trendAligned:gates.trendAligned,oppositeTrend:gates.oppositeTrend,lineBreak:gates.lineBreak,nearLevel:gates.nearLevel,enoughRoom:gates.enoughRoom,indicatorCore:indCore,indicatorLoose:indSoft,candleOrSweep:candle.ok||liquidity.ok||gates.strongBreak};
}
function structuralRef(c,i,dir,ev){
  const x=c[i], tr=ev.trend, lv=ev.levels, liq=ev.liquidity;
  const recent=c.slice(Math.max(0,i-10),i+1);
  if(dir==='LONG'){
    const refs=[...recent.map(k=>k.low), lv.support];
    if(tr.lastLow)refs.push(tr.lastLow.v);
    if(liq.ok&&isFinite(liq.ref))refs.push(liq.ref);
    // V28: stop en uzak dipten değil, işlemin bozulacağı en yakın geçerli invalidasyon seviyesinden gelir.
    const below=refs.filter(v=>Number.isFinite(v)&&v<x.close).sort((a,b)=>b-a);
    return below[0]??Math.min(...refs.filter(Number.isFinite));
  }else{
    const refs=[...recent.map(k=>k.high), lv.resistance];
    if(tr.lastHigh)refs.push(tr.lastHigh.v);
    if(liq.ok&&isFinite(liq.ref))refs.push(liq.ref);
    const above=refs.filter(v=>Number.isFinite(v)&&v>x.close).sort((a,b)=>a-b);
    return above[0]??Math.max(...refs.filter(Number.isFinite));
  }
}
function targetRefs(c,i,dir,ev){
  const x=c[i], atr=x.atr||0, lv=ev.levels;
  const futureRange=c.slice(Math.max(0,i-120),i+1);
  if(dir==='LONG'){
    const highs=pivotList(c,i,'H').map(p=>p.v).filter(v=>v>x.close).sort((a,b)=>a-b);
    const t1=highs[0]||lv.resistance||x.close+atr;
    const t2=highs[1]||Math.max(lv.resistance||t1,t1+atr);
    const t3=highs[2]||Math.max(...futureRange.map(k=>k.high),t2+atr);
    return {t1,t2,t3};
  }else{
    const lows=pivotList(c,i,'L').map(p=>p.v).filter(v=>v<x.close).sort((a,b)=>b-a);
    const t1=lows[0]||lv.support||x.close-atr;
    const t2=lows[1]||Math.min(lv.support||t1,t1-atr);
    const t3=lows[2]||Math.min(...futureRange.map(k=>k.low),t2-atr);
    return {t1,t2,t3};
  }
}
function plan(c,i,dir,ev=null){
  const entry=c[i].close, atr=c[i].atr||0;
  let stopRaw, stop, risk, note='Yapısal stop + ATR tampon';
  if(ev){
    const ref=structuralRef(c,i,dir,ev);
    stopRaw=dir==='LONG'?ref-0.20*atr:ref+0.20*atr;
    risk=Math.abs(entry-stopRaw);
  }else{
    risk=atr*RULE.atrStop;
    stopRaw=dir==='LONG'?entry-risk:entry+risk;
    note='ATR/R yedek plan';
  }
  const minRisk=entry*RULE.minStopPct/100, maxRisk=entry*maxStopAllowed(ev?.tf||'1h')/100;
  if(!isFinite(risk)||risk<=0){risk=atr*RULE.atrStop;note='ATR/R yedek plan'}
  let structuralRisk=risk, riskCapped=false;
  if(risk<minRisk){risk=minRisk;note+=' | min stop sınırı'}
  if(risk>maxRisk){riskCapped=true;note+=' | yapısal stop geniş: aday final kapıda elenir'}
  stop=dir==='LONG'?entry-risk:entry+risk;
  let t1=dir==='LONG'?entry+risk:entry-risk, t2=dir==='LONG'?entry+2*risk:entry-2*risk, t3=dir==='LONG'?entry+3*risk:entry-3*risk;
  if(ev){
    const trgs=targetRefs(c,i,dir,ev);
    if(dir==='LONG'){
      if(isFinite(trgs.t1)&&trgs.t1>entry+0.80*risk)t1=trgs.t1;
      if(isFinite(trgs.t2)&&trgs.t2>Math.max(t1,entry+1.35*risk))t2=trgs.t2; else t2=Math.max(t1+0.35*risk,entry+2*risk);
      if(isFinite(trgs.t3)&&trgs.t3>Math.max(t2,entry+2.20*risk))t3=trgs.t3; else t3=Math.max(t2+0.50*risk,entry+3*risk);
    }else{
      if(isFinite(trgs.t1)&&trgs.t1<entry-0.80*risk)t1=trgs.t1;
      if(isFinite(trgs.t2)&&trgs.t2<Math.min(t1,entry-1.35*risk))t2=trgs.t2; else t2=Math.min(t1-0.35*risk,entry-2*risk);
      if(isFinite(trgs.t3)&&trgs.t3<Math.min(t2,entry-2.20*risk))t3=trgs.t3; else t3=Math.min(t2-0.50*risk,entry-3*risk);
    }
  }
  const tp1ReachR=Math.abs(t1-entry)/risk, tp2ReachR=Math.abs(t2-entry)/risk, tp3ReachR=Math.abs(t3-entry)/risk;
  return {entry,stop,t1,t2,t3,risk,stopPct:risk/entry*100,tp1Pct:risk/entry*100,tp2Pct:2*risk/entry*100,tp3Pct:3*risk/entry*100,stopAtr:atr?risk/atr:0,planNote:note,structuralRiskPct:structuralRisk/entry*100,riskCapped,tp1ReachR,tp2ReachR,tp3ReachR,entryRule:ev?.profile?.entryRule||'Tetikleyici mum kapanışı',stopRule:ev?.profile?.stopRule||'ATR stop',targetRule:ev?.profile?.targetRule||'1R/2R/3R'}
}
function simulate(c,i,dir,p){let maxFav=0,maxAdv=0;for(let j=i+1;j<Math.min(c.length,i+1+RULE.maxHoldBars);j++){const hi=c[j].high,lo=c[j].low;if(dir==='LONG'){maxFav=Math.max(maxFav,(hi-p.entry)/p.risk);maxAdv=Math.max(maxAdv,(p.entry-lo)/p.risk);if(lo<=p.stop)return {r:-1,mfe:maxFav,mae:maxAdv,fast:j-i<=3,tp2:false};if(hi>=p.t3)return {r:3,mfe:Math.max(maxFav,3),mae:maxAdv,fast:false,tp2:true};if(hi>=p.t2)return {r:2,mfe:Math.max(maxFav,2),mae:maxAdv,fast:false,tp2:true};}else{maxFav=Math.max(maxFav,(p.entry-lo)/p.risk);maxAdv=Math.max(maxAdv,(hi-p.entry)/p.risk);if(hi>=p.stop)return {r:-1,mfe:maxFav,mae:maxAdv,fast:j-i<=3,tp2:false};if(lo<=p.t3)return {r:3,mfe:Math.max(maxFav,3),mae:maxAdv,fast:false,tp2:true};if(lo<=p.t2)return {r:2,mfe:Math.max(maxFav,2),mae:maxAdv,fast:false,tp2:true};}}return {r:maxFav>=1?1:-0.25,mfe:maxFav,mae:maxAdv,fast:false,tp2:maxFav>=2}}
function summarize(tr){if(!tr.length)return {count:0,win:0,pf:0,fast:0,net:0,avgMfe:0,avgMae:0,tp2Rate:0};const win=tr.filter(x=>x.r>0),loss=tr.filter(x=>x.r<=0);const gp=sum(win.map(x=>x.r)),gl=Math.abs(sum(loss.map(x=>x.r)));return {count:tr.length,win:win.length/tr.length*100,pf:gl?gp/gl:(gp>0?20:0),fast:tr.filter(x=>x.fast).length/tr.length*100,net:sum(tr.map(x=>x.r)),avgMfe:avg(tr.map(x=>x.mfe)),avgMae:avg(tr.map(x=>x.mae)),tp2Rate:tr.filter(x=>x.tp2).length/tr.length*100}}
function backtest(c,dir,strategyName,sets=null,tf='1h'){
  const tr=[];let cool=0;
  for(let i=150;i<c.length-45;i++){
    if(cool>0){cool--;continue}
    const ev=technicalEvent(c,i,dir,sets,tf);
    if(!ev.ok||!ev.strategies.includes(strategyName))continue;
    const p=plan(c,i,dir,ev);
    if(p.riskCapped||p.structuralRiskPct>maxStopAllowed(tf)||p.tp1ReachR<0.85||p.tp2ReachR<1.35)continue;
    tr.push(simulate(c,i,dir,p));
    cool=6;
  }
  return summarize(tr);
}
function contextTag(bt,p,ev,ageSec){
  const mfeMae=bt.avgMae>0?bt.avgMfe/bt.avgMae:bt.avgMfe;
  const dataOk=ageSec<=maxAgeAllowed(ev.tf||'1h');
  const maxStop=maxStopAllowed(ev.tf||'1h');
  const riskOk=p.stopPct>=RULE.minStopPct && p.stopPct<=maxStop && !p.riskCapped && p.structuralRiskPct<=maxStop;
  const triggerQuality=ev.candle.ok||ev.liquidity.ok||ev.gates.strongBreak||ev.gates.retest||ev.gates.emaRetest;
  const livePowerOk=ev.mtf.ok && ev.gates?.groupsOk && ev.gates.groupPass>=5 && ev.ind.passed>=5 && ev.gates.enoughRoom && ev.gates.triggerOk && ev.gates.locationOk && ev.gates.volumeOk && triggerQuality;
  const classicBtOk=bt.count>=Math.max(RULE.minBacktestTrades,minBtTrades(ev.tf||'1h')) && bt.win>=RULE.minBacktestWin && bt.pf>=RULE.minBacktestPf && bt.net>=RULE.minBacktestNetR && bt.fast<=RULE.maxFastStopRate && bt.tp2Rate>=RULE.minTp2Rate && mfeMae>=RULE.minMfeMae;
  const adaptiveBtOk=bt.count>=RULE.adaptiveMinTrades && bt.count<Math.max(RULE.minBacktestTrades,minBtTrades(ev.tf||'1h')) && bt.pf>=RULE.adaptivePf && bt.net>=RULE.adaptiveNetR && bt.fast<=RULE.adaptiveFastStop && bt.tp2Rate>=RULE.adaptiveTp2Rate && mfeMae>=RULE.adaptiveMfeMae && ev.gates.groupPass>=6 && riskOk && livePowerOk;
  const btOk=classicBtOk||adaptiveBtOk;
  const tradeOk=btOk && livePowerOk && riskOk && dataOk && p.tp1ReachR>=0.85 && p.tp2ReachR>=1.35;
  const state=tradeOk?'TRADE EDİLEBİLİR':'ELENDİ';
  return {state,tradeOk,btOk,classicBtOk,adaptiveBtOk,livePowerOk,mfeMae,riskOk,dataOk,maxStop,primary:ev.primary,strategies:ev.strategies};
}
function strategyPriority(x){
  const p=x?.event?.primary||'';
  if(p.includes('CHOCH'))return 6;
  if(p.includes('Kırılım-Retest'))return 5;
  if(p.includes('Kırılım-Onay'))return 4;
  if(p.includes('Trend Devam'))return 4;
  if(p.includes('Likidite'))return 4;
  if(p.includes('EMA Pullback'))return 3;
  if(p.includes('Trend devam'))return 3;
  return 0;
}
function betterCandidate(a,b){
  if(!b)return true;
  const ap=strategyPriority(a), bp=strategyPriority(b); if(ap!==bp)return ap>bp;
  if(a.context.adaptiveBtOk!==b.context.adaptiveBtOk)return !a.context.adaptiveBtOk;
  if(Math.abs(a.bt.net-b.bt.net)>0.01)return a.bt.net>b.bt.net;
  if(Math.abs(a.bt.pf-b.bt.pf)>0.01)return a.bt.pf>b.bt.pf;
  if(Math.abs(a.bt.fast-b.bt.fast)>0.1)return a.bt.fast<b.bt.fast;
  if(Math.abs(a.bt.tp2Rate-b.bt.tp2Rate)>0.1)return a.bt.tp2Rate>b.bt.tp2Rate;
  if(a.bt.count!==b.bt.count)return a.bt.count>b.bt.count;
  if(Math.abs(a.stopPct-b.stopPct)>0.01)return a.stopPct<b.stopPct;
  return a.ageSec<b.ageSec;
}
function sortCandidates(arr){return arr.sort((a,b)=>betterCandidate(a,b)?-1:betterCandidate(b,a)?1:0)}
function analyze(sym,tf,raw,dir,sets){
  if(!raw||raw.length<180)return null;
  const preparedSets=prepareSets(sets);
  const c=enriched(raw),i=c.length-1,x=c[i];
  const ageSec=Math.max(0,Math.floor((now()-(x.liveTime||x.closeTime||x.time||now()))/1000));
  if(ageSec>maxAgeAllowed(tf))return null;
  const ev=technicalEvent(c,i,dir,preparedSets,tf);
  if(!ev.ok)return null;
  const p=plan(c,i,dir,ev);
  if(p.riskCapped||p.stopPct>maxStopAllowed(tf)||p.structuralRiskPct>maxStopAllowed(tf)||p.tp1ReachR<0.85||p.tp2ReachR<1.35)return null;
  const bt=backtest(c,dir,ev.primary,preparedSets,tf);
  const context=contextTag(bt,p,ev,ageSec);
  if(!context.tradeOk)return null;
  return {market:'crypto',sym,tf,dir,event:ev,...p,bt,context,ageSec,source:x.source||'-',atrPct:x.atrPct,candles:c};
}
function addCandidate(x){
  if(!x)return;
  stats.passedGate++;
  const arr=pools.crypto[x.dir];
  const key=x.sym+'_'+x.dir;
  const oldIdx=arr.findIndex(v=>v.sym+'_'+v.dir===key);
  if(oldIdx>=0){if(betterCandidate(x,arr[oldIdx]))arr[oldIdx]=x}else arr.push(x);
  pools.crypto[x.dir]=sortCandidates(arr).slice(0,RULE.topN);
}
function allCandidates(){return [...pools.crypto.LONG,...pools.crypto.SHORT]}
function resetPools(){pools={crypto:{LONG:[],SHORT:[]}};selected=null}
function dataLine(){return `KRİPTO | Geçerli set ${stats.sets}/${stats.done} | Mum ${stats.candles} | Kapıdan geçen ${stats.passedGate} | Kaynak ${stats.source} | Yaş ${stats.age} sn | ${VERSION}<br>${fxLine()}`}
function summary(){const cL=pools.crypto.LONG.length,cS=pools.crypto.SHORT.length;$('summary').innerHTML=`<div class="dash"><div><b>${cryptoSymbols.length}</b><span>kripto evreni</span></div><div><b>${stats.done}/${stats.total}</b><span>tarama</span></div><div><b>${stats.sets}</b><span>geçerli set</span></div><div><b>${stats.candles}</b><span>mum</span></div><div><b>${stats.passedGate}</b><span>bağlam kapısı</span></div><div><b>${cL}</b><span>LONG aday</span></div><div><b>${cS}</b><span>SHORT aday</span></div></div><div class="note"><b>v28.0:</b> Kapalı mum standardı aktif. ATR/RSI/ADX-DI Wilder/RMA mantığına çekildi. Stop artık en yakın mantıklı yapısal invalidasyon + 0.20 ATR ile hesaplanır. Kırılım-Retest ve Kırılım-Onay ayrıldı. Skor ve izleme yok; yalnızca trade edilebilir ilk 10 LONG + ilk 10 SHORT listelenir.</div>`}
function topBy(dir){return pools.crypto[dir].slice(0,RULE.topN)}
function yn(v){return v?'EVET':'HAYIR'}
function card(x,i){const cls=x.dir==='SHORT'?'short':'long';const e=x.event;const title=x.dir==='LONG'?'Profesyonel LONG planı':'Profesyonel SHORT planı';const badge='TRADE';return `<div class="candidate ${cls}" onclick="selectCandidate('${x.key}')"><div class="top"><div><div class="sym">${i+1}) ${displaySymbol(x)} / ${x.tf}</div><div class="model">KRİPTO ${x.dir} — ${title}</div></div><div class="badge ${x.dir.toLowerCase()}">${badge}<br><span style="font-size:13px">${e.primary}</span></div></div><div class="line"><b>Strateji:</b> ${e.primary}<br><b>Setup bölgesi:</b> ${e.setupZone}<br><b>Giriş kuralı:</b> ${x.entryRule}<br><b>Stop kuralı:</b> ${x.stopRule}<br><b>Hedef kuralı:</b> ${x.targetRule}<br><b>Trend:</b> Ana TF ${e.trend.state} | Üst TF ${e.mtf.label} | Uyum ${yn(e.mtf.ok)}<br><b>Yapı:</b> BOS ${yn(e.structure.bos)} | CHOCH ${yn(e.structure.choch)} | Kırılım/Retest ${yn(e.gates.srBreak||e.gates.lineBreak)} / ${yn(e.gates.retest)}<br><b>Destek/Direnç:</b> Destek ${dual(x,e.levels.support)} | Direnç ${dual(x,e.levels.resistance)} | Alan ${x.dir==='LONG'?fmt(e.levels.roomLong,2):fmt(e.levels.roomShort,2)} ATR<br><b>Mum & Likidite:</b> ${e.candle.name} | Sweep/Reclaim ${yn(e.liquidity.ok)} | Hacim x${fmt(e.candle.volRatio,2)}<br><b>Kapı grupları:</b> Lokasyon ${yn(e.gates.locationOk)} | Tetik ${yn(e.gates.triggerOk)} | Momentum ${yn(e.gates.momentumOk)} | Hacim/Gövde ${yn(e.gates.volumeOk)} | Alan ${yn(e.gates.enoughRoom)} | Grup ${e.gates.groupPass}/${e.gates.totalGroups}<br><b>Final canlı kapı:</b> Üst TF ${yn(e.mtf.ok)} | Tetik kalitesi ${yn(e.candle.ok||e.liquidity.ok||e.gates.strongBreak||e.gates.retest||e.gates.emaRetest)} | Hacim/Gövde ${yn(e.gates.volumeOk)} | İndikatör ${e.ind.passed}/${e.ind.total} | Alan ${yn(e.gates.enoughRoom)}<br><b>Hesap motoru:</b> Kapalı mum | Wilder ATR/RSI/ADX | Yapısal stop<br><b>Final kalite:</b> Risk ${yn(x.context.riskOk)} | Backtest ${x.context.classicBtOk?'KLASİK GEÇTİ':x.context.adaptiveBtOk?'ADAPTİF GEÇTİ':'HAYIR'} | Max stop ${pct(x.context.maxStop,2)}<br>Giriş ${dual(x,x.entry)} | Stop ${dual(x,x.stop)} | Stop ${pct(x.stopPct,2)} | TP1 ${dual(x,x.t1)} (${fmt(x.tp1ReachR,2)}R) | TP2 ${dual(x,x.t2)} (${fmt(x.tp2ReachR,2)}R) | TP3 ${dual(x,x.t3)} (${fmt(x.tp3ReachR,2)}R)<br><b>Aynı strateji backtest:</b> İşlem ${x.bt.count} | Win ${pct(x.bt.win,1)} | PF ${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)} | Hızlı stop ${pct(x.bt.fast,1)} | Net ${fmt(x.bt.net,2)}R | TP2 ${pct(x.bt.tp2Rate,1)} | MFE/MAE ${fmt(x.bt.avgMfe,2)}R/${fmt(x.bt.avgMae,2)}R<br>Veri: ${x.ageSec} sn | Kaynak: ${x.source}</div><span class="pill ${x.dir==='LONG'?'green':'red'}">KRİPTO ${x.dir}</span><span class="pill blue">SKORSUZ</span><span class="pill amber">${e.profile?.type||e.primary}</span><span class="pill gray">ENTRY + STOP + TP PLAN</span></div>`}
function render(){summary();const all=allCandidates();all.forEach((x,i)=>x.key=x.key||`crypto_${x.sym}_${x.tf}_${x.dir}_${i}`);window.__map=new Map(all.map(x=>[x.key,x]));function sec(dir,label){const arr=topBy(dir);return `<div class="section ${dir==='LONG'?'long':'short'}"><h3>${label}</h3>${arr.length?arr.map((x,i)=>card(x,i)).join(''):'<p>Trade edilebilir aday yok. Profesyonel trade planı + aynı-strateji backtest kapısını geçen coin/timeframe bulunursa burada görünür.</p>'}</div>`}$('list').innerHTML=sec('LONG','KRİPTO Trade Edilebilir İlk 10 LONG')+sec('SHORT','KRİPTO Trade Edilebilir İlk 10 SHORT');const first=topBy('LONG')[0]||topBy('SHORT')[0];if(first&&!selected)selectCandidate(first.key,true);$('dataBox').innerHTML=dataLine()}
function metric(k,v){return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`}
function selectCandidate(key,silent=false){const x=window.__map&&window.__map.get(key);if(!x)return;selected=x;const e=x.event;$('decision').className='decision '+(x.dir==='LONG'?'long':'short');$('decision').textContent=`${displaySymbol(x)} KRİPTO ${x.dir} / ${x.tf} — ${e.primary}`;$('metrics').innerHTML=metric('Strateji',e.primary)+metric('Setup',e.setupZone)+metric('Giriş',dual(x,x.entry))+metric('Stop',dual(x,x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dual(x,x.t1)+' / '+fmt(x.tp1ReachR,2)+'R')+metric('TP2',dual(x,x.t2)+' / '+fmt(x.tp2ReachR,2)+'R')+metric('TP3',dual(x,x.t3)+' / '+fmt(x.tp3ReachR,2)+'R')+metric('Trend',e.trend.state)+metric('Üst TF',e.mtf.label)+metric('BOS / CHOCH',yn(e.structure.bos)+' / '+yn(e.structure.choch))+metric('Kapı',e.gates.groupPass+'/'+e.gates.totalGroups);$('tryPlan').innerHTML=`<b>${displaySymbol(x)} ${x.dir}</b><br><b>Neden giriş hazır?</b> ${e.reason}<br><b>Giriş:</b> ${x.entryRule}.<br><b>Stop:</b> ${x.stopRule}. Hesaplanan stop ${dual(x,x.stop)} (${pct(x.stopPct,2)}).<br><b>Hedef:</b> ${x.targetRule}. TP1 ${dual(x,x.t1)}, TP2 ${dual(x,x.t2)}, TP3 ${dual(x,x.t3)}.<br><b>Plan notu:</b> ${x.planNote}.`;renderChart(x);$('bt').innerHTML=`<div class="grid">${metric('Test edilen strateji',e.primary)+metric('İşlem',x.bt.count)+metric('Win',pct(x.bt.win,1))+metric('PF',x.bt.pf>=20?'20+':fmt(x.bt.pf,2))+metric('Hızlı stop',pct(x.bt.fast,1))+metric('Net R',fmt(x.bt.net,2))+metric('TP2 oranı',pct(x.bt.tp2Rate,1))+metric('MFE/MAE',fmt(x.bt.avgMfe,2)+'/'+fmt(x.bt.avgMae,2))+metric('Kapı durumu',x.context.state)}</div><div class="note"><b>Backtest kapısı:</b> Canlıda hangi strateji geçtiyse geçmişte yalnızca aynı strateji aranır. Aynı trend/üst TF, lokasyon, tetik, yapı kırılımı, mum/likidite, indikatör grupları, aynı kapalı mum standardı, Wilder ATR, aynı giriş kuralı, en yakın yapısal stop + ATR tampon ve aynı hedef mantığıyla R sonucu ölçülür. Puanlama, izleme ve farklı stratejiyle test yoktur.</div>`;if(!silent)$('planBox').scrollIntoView({behavior:'smooth',block:'start'})}
function renderChart(x){const c=x.candles.slice(-110),cv=$('chart'),ctx=cv.getContext('2d'),w=cv.width,h=cv.height;ctx.clearRect(0,0,w,h);if(!c.length)return;const e=x.event;const vals=c.flatMap(k=>[k.high,k.low,x.entry,x.stop,x.t1,x.t2,x.t3,e.levels.support,e.levels.resistance]);const mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*.08||1;const y=v=>h-20-(v-(mn-pad))/(mx-mn+pad*2)*(h-40),xp=i=>20+i*(w-40)/(c.length-1);ctx.lineWidth=3;ctx.strokeStyle='#89aaff';ctx.beginPath();c.forEach((k,i)=>{if(i)ctx.lineTo(xp(i),y(k.close));else ctx.moveTo(xp(i),y(k.close))});ctx.stroke();function hline(v,col,t){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();ctx.fillStyle=col;ctx.font='17px Arial';ctx.fillText(t,24,y(v)-5)}hline(x.entry,'#ffd166','Giriş');hline(x.stop,'#ff6b8a','Stop');hline(x.t1,'#7cff9f','TP1');hline(x.t2,'#7cff9f','TP2');hline(x.t3,'#7cff9f','TP3');hline(e.levels.support,'#50d890','Destek');hline(e.levels.resistance,'#ffb454','Direnç');function tline(line,col,label){if(!line||line.value==null)return;const firstGlobal=x.candles.length-c.length;const a=Math.max(0,line.p1.i-firstGlobal),b=Math.min(c.length-1,line.p2.i-firstGlobal+20);const va=lineVal(line.p1,line.p2,firstGlobal+a),vb=lineVal(line.p1,line.p2,firstGlobal+b);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(xp(a),y(va));ctx.lineTo(xp(b),y(vb));ctx.stroke();ctx.fillStyle=col;ctx.font='16px Arial';ctx.fillText(label,xp(Math.max(0,b-18)),y(vb)-8)}tline(e.trend.resLine,'#ffcf7a','Düşen direnç çizgisi');tline(e.trend.supLine,'#76ffa8','Yükselen destek çizgisi')}
async function scanMarket(watch=false){await cryptoUniverse();const symbols=cryptoSymbols;for(const sym of symbols){if(watch&&!watchActive)break;let sets={};try{sets=await getCryptoSets(sym)}catch(e){}for(const tf of TFS){stats.done++;setBar(stats.done/stats.total*100);const raw=sets[tf];if(raw&&raw.length>180){stats.sets++;stats.candles+=raw.length;stats.source=raw[raw.length-1].source;stats.age=Math.max(0,Math.floor((now()-(raw[raw.length-1].liveTime||now()))/1000));addCandidate(analyze(sym,tf,raw,'LONG',sets));addCandidate(analyze(sym,tf,raw,'SHORT',sets));}else stats.stale++;if(stats.done%5===0){setMeta(`KRİPTO ${stats.done}/${stats.total} | ${sym} ${tf} | ${VERSION}`);render();await new Promise(r=>setTimeout(r,0));}}}}
async function runMarketScan(watch=false){if(scanRunning)return;scanRunning=true;setButtons();if(!watch)resetPools();stats={done:0,total:CRYPTO_LIMIT*TFS.length,sets:0,candles:0,source:'-',age:'-',stale:0,passedGate:0};setBar(0);setMeta(`KRİPTO ${watch?'dinamik nöbet döngüsü '+(cycle+1):'canlı tarama'} başladı...`);try{await loadFx(true);await scanMarket(watch);render();setMeta(`KRİPTO ${watch?'nöbet döngüsü':'tarama'} bitti: bağlam kapısından geçenler listelendi.`)}catch(e){console.error(e);setMeta('Hata: '+(e.message||e))}finally{scanRunning=false;setButtons();if(watch&&watchActive){cycle++;watchTimer=setTimeout(()=>runMarketScan(true),RULE.watchMs)}}}
async function oneClickCryptoScan(){watchActive=false;if(watchTimer)clearTimeout(watchTimer);await runMarketScan(false)}
async function startCryptoWatchScan(){if(scanRunning||watchActive)return;watchActive=true;cycle=0;resetPools();setButtons();setMeta('KRİPTO dinamik nöbet başladı. İlk 10 LONG/SHORT her döngüde final canlı kapı + aynı-strateji backtest sağlık şartlarıyla revize olur.');await runMarketScan(true)}
function stopWatchScan(){watchActive=false;if(watchTimer)clearTimeout(watchTimer);scanRunning=false;setButtons();setMeta('Nöbet durduruldu. Son listeler ekranda kaldı.');render()}
window.oneClickCryptoScan=oneClickCryptoScan;window.startCryptoWatchScan=startCryptoWatchScan;window.stopWatchScan=stopWatchScan;window.oneClickScan=oneClickCryptoScan;window.startWatchScan=startCryptoWatchScan;loadFx(false).then(()=>{setButtons();summary();render();});
