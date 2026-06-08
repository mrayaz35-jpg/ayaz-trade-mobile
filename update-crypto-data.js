// Ayaz Trade v18.5 - GitHub Actions yakin-canli market.json veri uretici
const fs=require('fs');
const TFS=['15m','30m','1h','2h','4h'];
const TFMS={"15m":900000,"30m":1800000,"1h":3600000,"2h":7200000,"4h":14400000};
const LIMIT=500;
const UNIVERSE_LIMIT=150;
const EXCLUDED_BASES=new Set(['USDC','FDUSD','TUSD','BUSD','DAI','USDP','EUR','TRY','BRL','GBP','UAH','AEUR','EURI','PAX','USTC']);
const BAD_SUFFIX=['UP','DOWN','BULL','BEAR','3L','3S','5L','5S'];
const DEFAULT_SYMBOLS=['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','TRXUSDT','LINKUSDT','AVAXUSDT','LTCUSDT','BCHUSDT','DOTUSDT','NEARUSDT','APTUSDT','OPUSDT','ARBUSDT','SUIUSDT','INJUSDT','ATOMUSDT','UNIUSDT','AAVEUSDT','ETCUSDT','FILUSDT','WIFUSDT','PEPEUSDT','FETUSDT','CAKEUSDT','HBARUSDT','WLDUSDT'];
function cleanSymbol(sym){sym=String(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!/^[A-Z0-9]{2,14}USDT$/.test(sym))return null;const base=sym.replace(/USDT$/,'');if(EXCLUDED_BASES.has(base))return null;if(BAD_SUFFIX.some(s=>base.endsWith(s)))return null;return sym}
const base=s=>String(s||'').replace(/USDT$/,'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getJson(url,timeout=10000){const ctrl=new AbortController();const id=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{headers:{'User-Agent':'ayaz-trade-v18-7-fx'},signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(id)}}
function rowsAsc(rows){return rows.filter(x=>Number.isFinite(x.close)&&Number.isFinite(x.high)&&Number.isFinite(x.low)&&Number.isFinite(x.open)).sort((a,b)=>(a.time||0)-(b.time||0));}
function binanceRows(raw,source,liveTime){if(!Array.isArray(raw))return [];return rowsAsc(raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6],liveTime,source})));}
function bybitInterval(tf){return {"15m":"15","30m":"30","1h":"60","2h":"120","4h":"240"}[tf]||"60"}
function bybitRows(raw,source,liveTime){const list=raw&&raw.result&&Array.isArray(raw.result.list)?raw.result.list:[];return rowsAsc(list.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[0]+60000,liveTime,source})));}
function okxBar(tf){return {"15m":"15m","30m":"30m","1h":"1H","2h":"2H","4h":"4H"}[tf]||"1H"}
function okxRows(raw,source,liveTime){const list=raw&&Array.isArray(raw.data)?raw.data:[];return rowsAsc(list.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]||+k[7]||0,closeTime:+k[0],liveTime,source})));}
function gateInterval(tf){return {"15m":"15m","30m":"30m","1h":"1h","2h":"2h","4h":"4h"}[tf]||"1h"}
function gateRows(raw,source,liveTime){if(!Array.isArray(raw))return [];return rowsAsc(raw.map(k=>({time:+k[0]*1000,open:+k[5],high:+k[3],low:+k[4],close:+k[2],volume:+k[1],closeTime:+k[0]*1000,liveTime,source})));}
function kucoinType(tf){return {"15m":"15min","30m":"30min","1h":"1hour","2h":"2hour","4h":"4hour"}[tf]||"1hour"}
function kucoinRows(raw,source,liveTime){const list=raw&&raw.data&&Array.isArray(raw.data)?raw.data:[];return rowsAsc(list.map(k=>({time:+k[0]*1000,open:+k[1],high:+k[3],low:+k[4],close:+k[2],volume:+k[5],closeTime:+k[0]*1000,liveTime,source})));}
function mexcRows(raw,source,liveTime){if(!Array.isArray(raw))return [];return rowsAsc(raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6]||+k[0],liveTime,source})));}
async function getUniverse(){
  try{const [ex,tickers]=await Promise.all([getJson('https://api.binance.com/api/v3/exchangeInfo',12000),getJson('https://api.binance.com/api/v3/ticker/24hr',12000)]);const allowed=new Set((ex.symbols||[]).filter(x=>x.status==='TRADING'&&x.quoteAsset==='USDT'&&x.isSpotTradingAllowed!==false).map(x=>x.symbol));const arr=(tickers||[]).map(t=>({...t,symbol:cleanSymbol(t.symbol)})).filter(t=>t.symbol&&allowed.has(t.symbol)&&Number(t.quoteVolume||0)>150000&&Number(t.count||0)>500).sort((a,b)=>Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,UNIVERSE_LIMIT).map(t=>t.symbol);if(arr.length>=80)return arr}catch(e){console.log('Binance universe fail',e.message)}
  try{const j=await getJson('https://api.bybit.com/v5/market/tickers?category=linear',12000);const arr=((j.result&&j.result.list)||[]).map(t=>({...t,symbol:cleanSymbol(t.symbol)})).filter(t=>t.symbol&&Number(t.turnover24h||0)>150000).sort((a,b)=>Number(b.turnover24h||0)-Number(a.turnover24h||0)).slice(0,UNIVERSE_LIMIT).map(t=>t.symbol);if(arr.length>=80)return arr}catch(e){console.log('Bybit universe fail',e.message)}
  return DEFAULT_SYMBOLS;
}
async function getFx(){
  const sources=[
    ['https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY','Binance API USDTTRY',j=>Number(j.price)],
    ['https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY','Binance data-api USDTTRY',j=>Number(j.price)],
    ['https://api1.binance.com/api/v3/ticker/price?symbol=USDTTRY','Binance API1 USDTTRY',j=>Number(j.price)],
    ['https://api2.binance.com/api/v3/ticker/price?symbol=USDTTRY','Binance API2 USDTTRY',j=>Number(j.price)],
    ['https://api.btcturk.com/api/v2/ticker?pairSymbol=USDTTRY','BTCTURK USDTTRY',j=>Number(j&&j.data&&j.data[0]&&j.data[0].last)],
    ['https://api.coinbase.com/v2/exchange-rates?currency=USDT','Coinbase USDT/TRY',j=>Number(j&&j.data&&j.data.rates&&j.data.rates.TRY)],
    ['https://api.frankfurter.app/latest?from=USD&to=TRY','Frankfurter USDTRY yaklaşık',j=>Number(j&&j.rates&&j.rates.TRY)]
  ];
  for(const [url,source,parse] of sources){
    try{const j=await getJson(url,9000);const r=parse(j);if(r>10&&r<250)return{usdtTry:r,source,generatedAt:new Date().toISOString()}}catch(e){console.log('FX fail',source,e.message)}
  }
  return{usdtTry:null,source:'kur alınamadı',generatedAt:new Date().toISOString()}
}
async function getCandles(sym,tf){
  const liveTime=Date.now(); const bd=base(sym), pairDash=bd+'-USDT', pairUnd=bd+'_USDT';
  const candidates=[
    ['BINANCE-DATA',`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${LIMIT}`,binanceRows],
    ['BINANCE-SPOT',`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${LIMIT}`,binanceRows],
    ['BINANCE-FUTURES',`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=${LIMIT}`,binanceRows],
    ['BYBIT-LINEAR',`https://api.bybit.com/v5/market/kline?category=linear&symbol=${sym}&interval=${bybitInterval(tf)}&limit=${LIMIT}`,bybitRows],
    ['OKX-SWAP',`https://www.okx.com/api/v5/market/candles?instId=${pairDash}-SWAP&bar=${okxBar(tf)}&limit=300`,okxRows],
    ['OKX-SPOT',`https://www.okx.com/api/v5/market/candles?instId=${pairDash}&bar=${okxBar(tf)}&limit=300`,okxRows],
    ['GATE-SPOT',`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pairUnd}&interval=${gateInterval(tf)}&limit=300`,gateRows],
    ['KUCOIN-SPOT',`https://api.kucoin.com/api/v1/market/candles?type=${kucoinType(tf)}&symbol=${pairDash}&startAt=${Math.floor((Date.now()-TFMS[tf]*350)/1000)}&endAt=${Math.floor(Date.now()/1000)}`,kucoinRows],
    ['MEXC-SPOT',`https://api.mexc.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=500`,mexcRows]
  ];
  for(const [source,url,parser] of candidates){try{const raw=await getJson(url,8000);const arr=parser(raw,source,liveTime);if(arr.length>=120)return arr.slice(-LIMIT)}catch(e){}}
  return [];
}
(async()=>{
  const symbols=await getUniverse();const fx=await getFx();const out={generatedAt:new Date().toISOString(),mode:'v18.7-live-fx',source:'multi-exchange live snapshot',universeLimit:UNIVERSE_LIMIT,symbolCount:symbols.length,symbols,fx,data:{},stats:{sets:0,candles:0,failed:0,bySource:{}}};
  for(const sym of symbols){out.data[sym]={};for(const tf of TFS){const arr=await getCandles(sym,tf);out.data[sym][tf]=arr; if(arr.length){out.stats.sets++;out.stats.candles+=arr.length;const src=arr[arr.length-1].source||'UNKNOWN';out.stats.bySource[src]=(out.stats.bySource[src]||0)+1;console.log('OK',sym,tf,arr.length,src)}else{out.stats.failed++;console.log('FAIL',sym,tf)} await sleep(20)}}
  fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/market.json',JSON.stringify(out));console.log('market.json v18.7 fx updated',out.generatedAt,'symbols',symbols.length,'sets',out.stats.sets,'candles',out.stats.candles);
})().catch(e=>{console.error(e);process.exit(1)});
