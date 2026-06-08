window.__AYAZ_ACTIVE_VERSION__="v20.3-bist-livebridge-crypto-bist-s9";
const VERSION="v20.3 BIST CANLI VERİ KÖPRÜSÜ — KRİPTO + BIST S9";
const TFS=["15m","30m","1h","2h","4h"];
const TFMS={"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000};
const CRYPTO_LIMIT=150;
const BIST_LIMIT=100;
const RULE={limit15:900,limit1h:650,maxCryptoAgeSec:300,maxBistAgeSec:172800,topN:5,watchMs:65000,spotTry:10000,minStopPct:0.45,maxStopPct:8.50,atrStop:1.15,tp1R:1,tp2R:2,tp3R:3,maxHoldBars:36,fxMaxAgeSec:300};
let fx={rate:null,source:"-",updatedAt:null,ageSec:null,stale:true};
let bistBridgeCache=null, bistBridgeLoadedAt=0;
const DEFAULT_CRYPTO=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","TRXUSDT","LINKUSDT","AVAXUSDT","LTCUSDT","BCHUSDT","DOTUSDT","NEARUSDT","APTUSDT","OPUSDT","ARBUSDT","SUIUSDT","INJUSDT","ATOMUSDT","UNIUSDT","AAVEUSDT","ETCUSDT","FILUSDT","WIFUSDT","PEPEUSDT","FETUSDT","CAKEUSDT","HBARUSDT","WLDUSDT"];
const BIST100=["AEFES","AGHOL","AHGAZ","AKBNK","AKCNS","AKFGY","AKFYE","AKSA","AKSEN","ALARK","ALFAS","ALTNY","ANSGR","ARCLK","ASELS","ASTOR","AVPGY","BERA","BIMAS","BRSAN","BRYAT","BSOKE","BTCIM","CANTE","CCOLA","CIMSA","CLEBI","CWENE","DOAS","DOHOL","ECILC","EFORC","EGEEN","ENERY","ENJSA","ENKAI","EREGL","FROTO","GARAN","GESAN","GOLTS","GRTHO","GUBRF","HALKB","HEKTS","ISCTR","ISGYO","KCAER","KCHOL","KLSER","KONTR","KOZAA","KOZAL","KRDMD","KTLEV","LMKDC","MAGEN","MAVI","MGROS","MIATK","MPARK","OBAMS","ODAS","OYAKC","PASEU","PETKM","PGSUS","QUAGR","REEDR","RGYAS","SAHOL","SASA","SDTTR","SELEC","SISE","SKBNK","SMRTG","SOKM","TABGD","TAVHL","TCELL","THYAO","TKFEN","TOASO","TSKB","TTKOM","TTRAK","TUPRS","TURSG","ULKER","VAKBN","VESTL","YKBNK","YYLGD","ZOREN","ADEL","AKSGY","ARASE","BIENY","EUPWR","KORDS"].slice(0,100);
const BAD_BASE=new Set(["USDC","FDUSD","TUSD","BUSD","DAI","USDP","TRY","EUR","PAX"]);
let cryptoSymbols=[...DEFAULT_CRYPTO], watchActive=false, watchTimer=null, scanRunning=false, cycle=0, activeWatchMarket=null;
let pools={crypto:{LONG:[],SHORT:[]},bist:{LONG:[],SHORT:[]}}, selected=null;
let stats={market:'-',done:0,total:0,sets:0,candles:0,source:'-',age:'-',stale:0};
const $=id=>document.getElementById(id), now=()=>Date.now();
function fmt(n,d=2){return n==null||!isFinite(n)?'-':Number(n).toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(n,d=1){return fmt(n,d)+'%'}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function avg(a){return a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function dec(n){n=Math.abs(Number(n)||0); if(n>=1000)return 2;if(n>=100)return 3;if(n>=1)return 4;if(n>=.01)return 5;return 8}
function setBar(p){$('bar').style.width=clamp(p,0,100)+'%'}
function setMeta(t){$('meta').textContent=t}
function setButtons(){
  const ids=['cryptoScanBtn','bistScanBtn','allScanBtn','cryptoWatchBtn','bistWatchBtn'];
  ids.forEach(id=>{const el=$(id); if(el)el.disabled=scanRunning||watchActive;});
  const st=$('stopBtn'); if(st)st.disabled=!watchActive;
}
async function jfetch(url,timeout=14000){const c=new AbortController();const id=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal,headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(id)}}

function fxAgeSec(){return fx.updatedAt?Math.max(0,Math.floor((now()-fx.updatedAt)/1000)):(fx.ageSec??null)}
async function loadFx(force=false){
  if(!force&&fx.rate&&fxAgeSec()!=null&&fxAgeSec()<=RULE.fxMaxAgeSec)return true;
  const sources=[
    {source:'BINANCE-DATA USDTTRY',url:'https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY',parse:j=>Number(j.price)},
    {source:'BINANCE-SPOT USDTTRY',url:'https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY',parse:j=>Number(j.price)},
    {source:'BINANCE-API1 USDTTRY',url:'https://api1.binance.com/api/v3/ticker/price?symbol=USDTTRY',parse:j=>Number(j.price)},
    {source:'BTCTURK USDTTRY',url:'https://api.btcturk.com/api/v2/ticker?pairSymbol=USDTTRY',parse:j=>Number(j?.data?.[0]?.last)},
    {source:'COINBASE USDT/TRY',url:'https://api.coinbase.com/v2/exchange-rates?currency=USDT',parse:j=>Number(j?.data?.rates?.TRY)},
    {source:'FRANKFURTER USDTRY yaklaşık',url:'https://api.frankfurter.app/latest?from=USD&to=TRY',parse:j=>Number(j?.rates?.TRY)}
  ];
  for(const src of sources){
    for(const u of proxies(src.url)){
      try{const j=await jfetch(u,9000);const r=src.parse(j);if(isFinite(r)&&r>10&&r<250){fx={rate:r,source:src.source,updatedAt:now(),ageSec:0,stale:false};return true}}catch(e){}
    }
  }
  if(fx.rate){fx.stale=true;fx.ageSec=fxAgeSec();return false}
  fx={rate:46.1,source:'ACİL YEDEK KUR',updatedAt:null,ageSec:null,stale:true};return false;
}
function tl(n){if(!fx.rate||!isFinite(n))return '- TL';const v=n*fx.rate;return fmt(v, v>=100?2:v>=1?4:6)+' TL'}
function fxLine(){const age=fxAgeSec();const cls=fx.stale?'bad':'ok';return `Kur: <b class="${cls}">1 USDT ≈ ${fmt(fx.rate||0,4)} TL</b> | Kaynak: ${fx.source} | Yaş: ${age??'-'} sn${fx.stale?' | UYARI: TL yaklaşık':''}`}

function proxies(url){const e=encodeURIComponent(url);return [url,`https://api.allorigins.win/raw?url=${e}`,`https://corsproxy.io/?${e}`]}
function cleanCrypto(s){const u=String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z0-9]{2,14}USDT$/.test(u))return null;const b=u.replace(/USDT$/,'');if(BAD_BASE.has(b))return null;return u}
function base(sym){return String(sym||'').replace(/USDT$/,'').replace(/\.IS$/,'')}
function displaySymbol(x){return x.market==='bist'?x.sym.replace('.IS',''):x.sym}
function priceUnit(x){return x.market==='bist'?'TRY':'USDT'}
function dual(x,n){return x.market==='crypto'?`${fmt(n,dec(n))} USDT / ${tl(n)}`:`${fmt(n,dec(n))} TRY`}
function cryptoRows(raw,src){if(!Array.isArray(raw))return [];return raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6],liveTime:now(),source:src})).filter(k=>isFinite(k.close)).sort((a,b)=>a.time-b.time)}
function yahooRows(j,src){try{const r=j.chart.result[0],q=r.indicators.quote[0],ts=r.timestamp||[];return ts.map((t,i)=>({time:t*1000,open:+q.open[i],high:+q.high[i],low:+q.low[i],close:+q.close[i],volume:+(q.volume[i]||0),closeTime:t*1000,liveTime:t*1000,source:src})).filter(k=>isFinite(k.close)&&isFinite(k.high)&&isFinite(k.low)&&isFinite(k.open)).sort((a,b)=>a.time-b.time)}catch(e){return []}}
function aggregate(c,ms){if(!c||!c.length)return [];const map=new Map();for(const k of c){const bucket=Math.floor(k.time/ms)*ms;let x=map.get(bucket);if(!x){x={time:bucket,open:k.open,high:k.high,low:k.low,close:k.close,volume:0,closeTime:k.closeTime,liveTime:k.liveTime,source:k.source}}x.high=Math.max(x.high,k.high);x.low=Math.min(x.low,k.low);x.close=k.close;x.volume+=(k.volume||0);x.closeTime=k.closeTime;x.liveTime=k.liveTime;map.set(bucket,x)}return [...map.values()].sort((a,b)=>a.time-b.time)}
async function cryptoUniverse(){try{const ticks=await jfetch('https://api.binance.com/api/v3/ticker/24hr',12000);const arr=ticks.filter(t=>cleanCrypto(t.symbol)&&Number(t.quoteVolume)>150000).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,CRYPTO_LIMIT).map(t=>cleanCrypto(t.symbol));if(arr.length>50)cryptoSymbols=arr}catch(e){cryptoSymbols=[...DEFAULT_CRYPTO]}}
async function fetchCryptoBase(sym,interval,limit){const urls=[`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,`https://api1.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${limit}`];for(const u of urls){for(const pu of proxies(u)){try{const raw=await jfetch(pu,10000);const arr=cryptoRows(raw,pu.includes('fapi')?'BINANCE-FUTURES':'BINANCE');if(arr.length>120)return arr}catch(e){}}}return []}
async function getCryptoSets(sym){const c15=await fetchCryptoBase(sym,'15m',RULE.limit15);const c1h=await fetchCryptoBase(sym,'1h',RULE.limit1h);return {"15m":c15,"30m":aggregate(c15,TFMS['30m']),"1h":c1h,"2h":aggregate(c1h,TFMS['2h']),"4h":aggregate(c1h,TFMS['4h'])}}
function bistProxyUrls(url){const e=encodeURIComponent(url);return [
  {url,mode:'raw'},
  {url:url.replace('query1.finance.yahoo.com','query2.finance.yahoo.com'),mode:'raw'},
  {url:`https://api.allorigins.win/raw?url=${e}`,mode:'raw'},
  {url:`https://api.allorigins.win/get?url=${e}`,mode:'contents'},
  {url:`https://corsproxy.io/?${e}`,mode:'raw'},
  {url:`https://api.codetabs.com/v1/proxy?quest=${e}`,mode:'raw'}
]}
async function fetchJsonBist(url,timeout=16000){
  const c=new AbortController();const id=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{cache:'no-store',signal:c.signal,headers:{'Accept':'application/json,text/plain,*/*'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const txt=await r.text();
    let j=JSON.parse(txt);
    if(j&&typeof j.contents==='string')j=JSON.parse(j.contents);
    return j;
  }finally{clearTimeout(id)}
}
async function fetchYahoo(sym,interval,range){
  const base=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includePrePost=false&events=history`;
  for(const pu of bistProxyUrls(base)){
    try{const j=await fetchJsonBist(pu.url,17000);const arr=yahooRows(j,pu.url.includes('allorigins')||pu.url.includes('corsproxy')||pu.url.includes('codetabs')?'YAHOO-BIST-PROXY':'YAHOO-BIST');if(arr.length>=30)return arr}catch(e){}
  }
  return []
}
async function loadBistBridge(force=false){
  if(!force&&bistBridgeCache&&now()-bistBridgeLoadedAt<120000)return bistBridgeCache;
  const urls=[`data/bist-market.json?v=${now()}`,`./data/bist-market.json?v=${now()}`];
  for(const u of urls){
    try{const j=await jfetch(u,10000);if(j&&j.data){bistBridgeCache=j;bistBridgeLoadedAt=now();return j}}catch(e){}
  }
  return null;
}
function rowsFromBistBridge(code,tf){
  const j=bistBridgeCache;if(!j||!j.data||!j.data[code])return [];
  const rec=j.data[code];const arr=rec.sets&&rec.sets[tf];if(!Array.isArray(arr)||!arr.length)return [];
  const gen=Date.parse(j.generatedAt||rec.generatedAt||new Date().toISOString())||now();
  return arr.map(k=>({time:+k.t,open:+k.o,high:+k.h,low:+k.l,close:+k.c,volume:+(k.v||0),closeTime:+k.t,liveTime:gen,source:'BIST-JSON-KÖPRÜ'})).filter(k=>isFinite(k.close)&&isFinite(k.high)&&isFinite(k.low)&&isFinite(k.open)).sort((a,b)=>a.time-b.time);
}
function bridgeSets(code){
  const out={};for(const tf of TFS)out[tf]=rowsFromBistBridge(code,tf);return out;
}
async function getBistSets(code){
  const sym=code+'.IS';
  // 1) Önce tarayıcıdan doğrudan/proxy Yahoo dene. Çalışırsa en taze kaynak budur.
  const c15=await fetchYahoo(sym,'15m','60d');
  let c1h=await fetchYahoo(sym,'60m','730d');
  if(c15.length>=80||c1h.length>=80){
    if(!c1h.length)c1h=aggregate(c15,TFMS['1h']);
    return {"15m":c15,"30m":aggregate(c15,TFMS['30m']),"1h":c1h,"2h":aggregate(c1h,TFMS['2h']),"4h":aggregate(c1h,TFMS['4h'])}
  }
  // 2) Tarayıcı kaynakları CORS/erişim yüzünden boş dönerse GitHub Actions'ın ürettiği kendi JSON köprüsünü kullan.
  await loadBistBridge(false);
  const js=bridgeSets(code);
  if(Object.values(js).some(a=>a&&a.length>=80))return js;
  return {"15m":[],"30m":[],"1h":[],"2h":[],"4h":[]}
}
function enrich(raw){const c=raw.map(x=>({...x})).filter(x=>isFinite(x.close)&&isFinite(x.high)&&isFinite(x.low)&&isFinite(x.open));const closes=c.map(x=>x.close);let trs=[];for(let i=0;i<c.length;i++){const p=c[i-1]||c[i];const tr=Math.max(c[i].high-c[i].low,Math.abs(c[i].high-p.close),Math.abs(c[i].low-p.close));trs.push(tr);const atr=avg(trs.slice(Math.max(0,i-13),i+1));c[i].atr=atr;c[i].atrPct=c[i].close?atr/c[i].close*100:0}return c}
function pivots(c,i,kind,left=3,right=3){const out=[];for(let x=left;x<=i-right;x++){let ok=true;for(let j=x-left;j<=x+right;j++){if(j===x)continue;if(kind==='H'&&c[j].high>=c[x].high)ok=false;if(kind==='L'&&c[j].low<=c[x].low)ok=false}if(ok)out.push({i:x,v:kind==='H'?c[x].high:c[x].low})}return out}
function trendLineValue(p1,p2,i){if(!p1||!p2||p1.i===p2.i)return null;const m=(p2.v-p1.v)/(p2.i-p1.i);return p2.v+m*(i-p2.i)}
function s9Event(c,i,dir){if(!c||i<120)return {ok:false};const atr=c[i].atr||0;if(!atr)return {ok:false};const highs=pivots(c,i-1,'H'), lows=pivots(c,i-1,'L');if(highs.length<3||lows.length<3)return {ok:false};const h=highs.slice(-3), l=lows.slice(-3);if(dir==='LONG'){const trendOk=h[2].v<h[1].v&&h[1].v<h[0].v&&l[2].v<l[1].v;const line=trendLineValue(h[1],h[2],i);const trendBreak=line!=null&&c[i].close>line+0.10*atr;const lastLH=h[2].v;const choch=c[i].close>lastLH+0.10*atr;return {ok:trendOk&&trendBreak&&choch,trendOk,trendBreak,choch,pivot:lastLH,line}}else{const trendOk=h[2].v>h[1].v&&l[2].v>l[1].v&&l[1].v>l[0].v;const line=trendLineValue(l[1],l[2],i);const trendBreak=line!=null&&c[i].close<line-0.10*atr;const lastHL=l[2].v;const choch=c[i].close<lastHL-0.10*atr;return {ok:trendOk&&trendBreak&&choch,trendOk,trendBreak,choch,pivot:lastHL,line}}}
function plan(c,i,dir){const entry=c[i].close, atr=c[i].atr||0;let risk=atr*1.15;const minRisk=entry*RULE.minStopPct/100, maxRisk=entry*RULE.maxStopPct/100;let note='ATR/R';if(risk<minRisk){risk=minRisk;note='min stop sınırı'}if(risk>maxRisk){risk=maxRisk;note='ATR yüksek, risk üst sınırla kesildi'}const stop=dir==='LONG'?entry-risk:entry+risk;const t1=dir==='LONG'?entry+risk:entry-risk;const t2=dir==='LONG'?entry+2*risk:entry-2*risk;const t3=dir==='LONG'?entry+3*risk:entry-3*risk;return {entry,stop,t1,t2,t3,risk,stopPct:risk/entry*100,tp1Pct:risk/entry*100,tp2Pct:2*risk/entry*100,tp3Pct:3*risk/entry*100,stopAtr:atr?risk/atr:0,planNote:note}}
function simulate(c,i,dir,p){let maxFav=0,maxAdv=0,fast=false;for(let j=i+1;j<Math.min(c.length,i+1+RULE.maxHoldBars);j++){const hi=c[j].high,lo=c[j].low;if(dir==='LONG'){maxFav=Math.max(maxFav,(hi-p.entry)/p.risk);maxAdv=Math.max(maxAdv,(p.entry-lo)/p.risk);if(lo<=p.stop)return {r:-1,mfe:maxFav,mae:maxAdv,fast:j-i<=3,tp2:false};if(hi>=p.t3)return {r:3,mfe:Math.max(maxFav,3),mae:maxAdv,fast,tp2:true};if(hi>=p.t2)return {r:2,mfe:Math.max(maxFav,2),mae:maxAdv,fast,tp2:true}}else{maxFav=Math.max(maxFav,(p.entry-lo)/p.risk);maxAdv=Math.max(maxAdv,(hi-p.entry)/p.risk);if(hi>=p.stop)return {r:-1,mfe:maxFav,mae:maxAdv,fast:j-i<=3,tp2:false};if(lo<=p.t3)return {r:3,mfe:Math.max(maxFav,3),mae:maxAdv,fast,tp2:true};if(lo<=p.t2)return {r:2,mfe:Math.max(maxFav,2),mae:maxAdv,fast,tp2:true}}}return {r:maxFav>=1?1:-0.25,mfe:maxFav,mae:maxAdv,fast:false,tp2:maxFav>=2}}
function summarize(tr){if(!tr.length)return {count:0,win:0,pf:0,fast:0,net:0,avgMfe:0,avgMae:0,tp2Rate:0};const win=tr.filter(x=>x.r>0),loss=tr.filter(x=>x.r<=0);const gp=win.reduce((s,x)=>s+x.r,0),gl=Math.abs(loss.reduce((s,x)=>s+x.r,0));return {count:tr.length,win:win.length/tr.length*100,pf:gl?gp/gl:(gp>0?20:0),fast:tr.filter(x=>x.fast).length/tr.length*100,net:tr.reduce((s,x)=>s+x.r,0),avgMfe:avg(tr.map(x=>x.mfe)),avgMae:avg(tr.map(x=>x.mae)),tp2Rate:tr.filter(x=>x.tp2).length/tr.length*100}}
function backtest(c,dir){const tr=[];let cool=0;for(let i=120;i<c.length-40;i++){if(cool>0){cool--;continue}const ev=s9Event(c,i,dir);if(!ev.ok)continue;const p=plan(c,i,dir);tr.push(simulate(c,i,dir,p));cool=5}return summarize(tr)}
function rank(bt,p,ageSec){const mfeMae=bt.avgMae>0?bt.avgMfe/bt.avgMae:bt.avgMfe;let s=0;s+=clamp(bt.net*3,0,28);s+=clamp((bt.pf-1)*9,0,22);s+=clamp((bt.win-45)*0.65,0,20);s+=clamp((30-bt.fast)*0.35,0,10);s+=clamp((mfeMae-1)*8,0,10);s+=clamp((bt.count-2)*1.0,0,8);s+=ageSec<600?2:0;if(p.stopPct>=8.0)s-=8;return clamp(s,0,100)}
function analyze(sym,tf,raw,dir,market){if(!raw||raw.length<160)return null;const c=enrich(raw),i=c.length-1,x=c[i];const ageSec=Math.max(0,Math.floor((now()-(x.liveTime||x.closeTime||x.time||now()))/1000));if(market==='crypto'&&ageSec>RULE.maxCryptoAgeSec)return null;if(market==='bist'&&ageSec>RULE.maxBistAgeSec)return null;const ev=s9Event(c,i,dir);if(!ev.ok)return null;const p=plan(c,i,dir);if(p.stopPct>RULE.maxStopPct)return null;const bt=backtest(c,dir);const score=rank(bt,p,ageSec);return {market,sym,tf,dir,event:ev,...p,bt,rankScore:score,ageSec,source:x.source||'-',atrPct:x.atrPct,candles:c}}
function addCandidate(x){if(!x)return;const arr=pools[x.market][x.dir];const key=x.sym+'_'+x.dir;const oldIdx=arr.findIndex(v=>v.sym+'_'+v.dir===key);if(oldIdx>=0){if(x.rankScore>arr[oldIdx].rankScore)arr[oldIdx]=x}else arr.push(x);pools[x.market][x.dir]=arr.sort((a,b)=>b.rankScore-a.rankScore).slice(0,RULE.topN)}
function allCandidates(){return [...pools.crypto.LONG,...pools.crypto.SHORT,...pools.bist.LONG,...pools.bist.SHORT]}
function resetPools(market=null){if(!market)pools={crypto:{LONG:[],SHORT:[]},bist:{LONG:[],SHORT:[]}};else pools[market]={LONG:[],SHORT:[]};selected=null}
function dataLine(){return `${stats.market.toUpperCase()} | Geçerli set ${stats.sets}/${stats.done} | Mum ${stats.candles} | Kaynak ${stats.source} | Yaş ${stats.age} sn | ${VERSION}<br>${fxLine()}`}
function summary(){const cL=pools.crypto.LONG.length,cS=pools.crypto.SHORT.length,bL=pools.bist.LONG.length,bS=pools.bist.SHORT.length;const fxAge=fxAgeSec();$('summary').innerHTML=`<div class="dash"><div><b>${cryptoSymbols.length}</b><span>kripto evreni</span></div><div><b>${BIST100.length}</b><span>BIST evreni</span></div><div><b>${stats.done}/${stats.total}</b><span>${stats.market} tarama</span></div><div><b>${stats.candles}</b><span>mum</span></div><div><b>${cL}+${cS}</b><span>kripto L/S</span></div><div><b>${bL}+${bS}</b><span>BIST L/S</span></div></div><div class="note"><b>v20.3:</b> Kripto ve BIST motorları ayrı çalışır; veri karışmaz. BIST tarafında tarayıcı Yahoo/Proxy kaynakları çalışmazsa GitHub Actions BIST JSON köprüsü devreye girer. Kripto tarafında USDT fiyatları canlı USDT/TRY ile TL’ye çevrilir.</div>`}
function topBy(market,dir){return pools[market][dir].slice(0,RULE.topN)}
function card(x,i){const cls=x.dir==='SHORT'?'short':'long';const name=displaySymbol(x);const title=x.dir==='LONG'?'Düşen trend kırılım + bullish CHOCH':'Yükselen trend kırılım + bearish CHOCH';return `<div class="candidate ${cls}" onclick="selectCandidate('${x.key}')"><div class="top"><div><div class="sym">${i+1}) ${name} / ${x.tf}</div><div class="model">${x.market.toUpperCase()} ${x.dir} — ${title}</div></div><div class="score ${x.dir.toLowerCase()}">${Math.round(x.rankScore)}<br><span style="font-size:15px">BT</span></div></div><div class="line">S9: GEÇTİ | Trend: ${x.event.trendOk?'EVET':'HAYIR'} | Kırılım: ${x.event.trendBreak?'EVET':'HAYIR'} | CHOCH: ${x.event.choch?'EVET':'HAYIR'} | Sıralama: ${Math.round(x.rankScore)}<br>Giriş ${dual(x,x.entry)} | Stop ${dual(x,x.stop)} | Stop ${pct(x.stopPct,2)} | ATR% ${pct(x.atrPct,2)} | Plan: ${x.planNote}<br>TP1 ${dual(x,x.t1)} | TP2 ${dual(x,x.t2)} | TP3 ${dual(x,x.t3)}<br><b>Aynalı BT:</b> İşlem ${x.bt.count} | Win ${pct(x.bt.win,1)} | PF ${x.bt.pf>=20?'20+':fmt(x.bt.pf,2)} | Hızlı stop ${pct(x.bt.fast,1)} | Net ${fmt(x.bt.net,2)}R | MFE/MAE ${fmt(x.bt.avgMfe,2)}R/${fmt(x.bt.avgMae,2)}R<br>Veri: ${x.ageSec} sn | Kaynak: ${x.source}</div><span class="pill ${x.dir==='LONG'?'green':'red'}">${x.market.toUpperCase()} ${x.dir}</span><span class="pill blue">S9</span></div>`}
function render(){summary();const all=allCandidates();all.forEach((x,i)=>x.key=x.key||`${x.market}_${x.sym}_${x.tf}_${x.dir}_${i}`);window.__map=new Map(all.map(x=>[x.key,x]));function sec(market,dir,label){const arr=topBy(market,dir);return `<div class="section ${dir==='LONG'?'long':'short'}"><h3>${label}</h3>${arr.length?arr.map((x,i)=>card(x,i)).join(''):'<p>Aday yok.</p>'}</div>`}$('list').innerHTML=sec('crypto','LONG','KRİPTO Trade Edilebilir İlk 5 LONG')+sec('crypto','SHORT','KRİPTO Trade Edilebilir İlk 5 SHORT')+sec('bist','LONG','BIST Trade Edilebilir İlk 5 LONG')+sec('bist','SHORT','BIST Trade Edilebilir İlk 5 SHORT');const first=topBy('crypto','LONG')[0]||topBy('crypto','SHORT')[0]||topBy('bist','LONG')[0]||topBy('bist','SHORT')[0];if(first&&!selected)selectCandidate(first.key,true);$('dataBox').innerHTML=dataLine()}
function metric(k,v){return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`}
function selectCandidate(key,silent=false){const x=window.__map&&window.__map.get(key);if(!x)return;selected=x;$('decision').className='decision '+(x.dir==='LONG'?'long':'short');$('decision').textContent=`${displaySymbol(x)} ${x.market.toUpperCase()} ${x.dir} / ${x.tf}`;$('metrics').innerHTML=metric('Giriş',dual(x,x.entry))+metric('Stop',dual(x,x.stop))+metric('Stop %',pct(x.stopPct,2))+metric('TP1',dual(x,x.t1))+metric('TP2',dual(x,x.t2))+metric('TP3',dual(x,x.t3))+metric('BT İşlem',x.bt.count)+metric('Win',pct(x.bt.win,1))+metric('PF',x.bt.pf>=20?'20+':fmt(x.bt.pf,2))+metric('Net R',fmt(x.bt.net,2))+metric('MFE/MAE',fmt(x.bt.avgMfe,2)+'/'+fmt(x.bt.avgMae,2))+metric('Veri',x.ageSec+' sn');$('tryPlan').innerHTML=`<b>${displaySymbol(x)} ${x.dir}</b><br>S9 stratejisi aktif. Giriş ${dual(x,x.entry)}, stop ${dual(x,x.stop)}, TP2 ${dual(x,x.t2)}. ${x.market==='bist'?'BIST tarafı TRY bazlıdır; SHORT teknik senaryodur, uygulama/ürün uygunluğu kullanıcı tarafındadır.':'Kripto tarafı USDT bazlıdır.'}`;renderChart(x);$('bt').innerHTML=`<div class="grid">${metric('İşlem',x.bt.count)+metric('Win',pct(x.bt.win,1))+metric('PF',x.bt.pf>=20?'20+':fmt(x.bt.pf,2))+metric('Hızlı stop',pct(x.bt.fast,1))+metric('Net R',fmt(x.bt.net,2))+metric('TP2 oranı',pct(x.bt.tp2Rate,1))}</div><div class="note">Backtest canlıdaki aynı S9 şartını geçmiş mumlarda çalıştırır: trend kırılım + CHOCH, ATR/R stop ve 1R/2R/3R hedef.</div>`;if(!silent)$('planBox').scrollIntoView({behavior:'smooth',block:'start'})}
function renderChart(x){const c=x.candles.slice(-90),cv=$('chart'),ctx=cv.getContext('2d'),w=cv.width,h=cv.height;ctx.clearRect(0,0,w,h);if(!c.length)return;const vals=c.flatMap(k=>[k.high,k.low,x.entry,x.stop,x.t1,x.t2,x.t3]);const mn=Math.min(...vals),mx=Math.max(...vals),pad=(mx-mn)*.08||1;const y=v=>h-20-(v-(mn-pad))/(mx-mn+pad*2)*(h-40),xp=i=>20+i*(w-40)/(c.length-1);ctx.lineWidth=3;ctx.strokeStyle='#89aaff';ctx.beginPath();c.forEach((k,i)=>{if(i)ctx.lineTo(xp(i),y(k.close));else ctx.moveTo(xp(i),y(k.close))});ctx.stroke();function line(v,col,t){ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();ctx.fillStyle=col;ctx.font='18px Arial';ctx.fillText(t,24,y(v)-5)}line(x.entry,'#ffd166','Giriş');line(x.stop,'#ff6b8a','Stop');line(x.t1,'#7cff9f','TP1');line(x.t2,'#7cff9f','TP2');line(x.t3,'#7cff9f','TP3')}
async function scanMarket(market,watch=false){if(market==='crypto'){await cryptoUniverse();const symbols=cryptoSymbols;for(const sym of symbols){if(watch&&!watchActive)break;let sets={};try{sets=await getCryptoSets(sym)}catch(e){}for(const tf of TFS){stats.done++;setBar(stats.done/stats.total*100);const raw=sets[tf];if(raw&&raw.length>160){stats.sets++;stats.candles+=raw.length;stats.source=raw[raw.length-1].source;stats.age=Math.max(0,Math.floor((now()-(raw[raw.length-1].liveTime||now()))/1000));addCandidate(analyze(sym,tf,raw,'LONG','crypto'));addCandidate(analyze(sym,tf,raw,'SHORT','crypto'));}else stats.stale++;if(stats.done%5===0){setMeta(`${market.toUpperCase()} ${stats.done}/${stats.total} | ${sym} ${tf} | ${dataLine()}`);render();await new Promise(r=>setTimeout(r,0));}}}}else{for(const code of BIST100){if(watch&&!watchActive)break;let sets={};try{sets=await getBistSets(code)}catch(e){}for(const tf of TFS){stats.done++;setBar(stats.done/stats.total*100);const raw=sets[tf];if(raw&&raw.length>160){stats.sets++;stats.candles+=raw.length;stats.source=raw[raw.length-1].source||'BIST-KÖPRÜ';stats.age=Math.max(0,Math.floor((now()-(raw[raw.length-1].liveTime||raw[raw.length-1].time||now()))/1000));addCandidate(analyze(code+'.IS',tf,raw,'LONG','bist'));addCandidate(analyze(code+'.IS',tf,raw,'SHORT','bist'));}else stats.stale++;if(stats.done%5===0){setMeta(`${market.toUpperCase()} ${stats.done}/${stats.total} | ${code} ${tf} | ${dataLine()}`);render();await new Promise(r=>setTimeout(r,0));}}}}}

async function runMarketScan(market,watch=false){
  if(scanRunning)return;
  scanRunning=true;setButtons();
  if(!watch)resetPools(market);
  stats={market,done:0,total:(market==='crypto'?CRYPTO_LIMIT:BIST100.length)*TFS.length,sets:0,candles:0,source:'-',age:'-',stale:0};
  setBar(0);
  setMeta(`${market==='crypto'?'KRİPTO':'BIST'} ${watch?'dinamik nöbet döngüsü '+(cycle+1):'canlı tarama'} başladı...`);
  try{
    if(market==='crypto')await loadFx(true);
    await scanMarket(market,watch);
    render();
    setMeta(`${market==='crypto'?'KRİPTO':'BIST'} ${watch?'nöbet döngüsü':'tarama'} bitti: ${dataLine()}`);
  }catch(e){console.error(e);setMeta('Hata: '+(e.message||e))}
  finally{scanRunning=false;setButtons();if(watch&&watchActive&&activeWatchMarket===market){cycle++;watchTimer=setTimeout(()=>runMarketScan(market,true),RULE.watchMs)}}
}
async function oneClickCryptoScan(){watchActive=false;activeWatchMarket=null;if(watchTimer)clearTimeout(watchTimer);await runMarketScan('crypto',false)}
async function oneClickBistScan(){watchActive=false;activeWatchMarket=null;if(watchTimer)clearTimeout(watchTimer);await runMarketScan('bist',false)}
async function oneClickAllScan(){watchActive=false;activeWatchMarket=null;if(watchTimer)clearTimeout(watchTimer);resetPools();await runMarketScan('crypto',false);await runMarketScan('bist',false)}
async function startCryptoWatchScan(){if(scanRunning||watchActive)return;watchActive=true;activeWatchMarket='crypto';cycle=0;resetPools('crypto');setButtons();setMeta('KRİPTO dinamik nöbet başladı. İlk 5 LONG/SHORT her döngüde revize olur.');await runMarketScan('crypto',true)}
async function startBistWatchScan(){if(scanRunning||watchActive)return;watchActive=true;activeWatchMarket='bist';cycle=0;resetPools('bist');setButtons();setMeta('BIST dinamik nöbet başladı. İlk 5 LONG/SHORT her döngüde revize olur.');await runMarketScan('bist',true)}
function stopWatchScan(){watchActive=false;activeWatchMarket=null;if(watchTimer)clearTimeout(watchTimer);scanRunning=false;setButtons();setMeta('Nöbet durduruldu. Son listeler ekranda kaldı.');render()}
window.oneClickCryptoScan=oneClickCryptoScan;window.oneClickBistScan=oneClickBistScan;window.oneClickAllScan=oneClickAllScan;window.startCryptoWatchScan=startCryptoWatchScan;window.startBistWatchScan=startBistWatchScan;window.stopWatchScan=stopWatchScan;window.oneClickScan=oneClickCryptoScan;window.startWatchScan=startCryptoWatchScan;loadFx(false).then(()=>{setButtons();summary();render();});

