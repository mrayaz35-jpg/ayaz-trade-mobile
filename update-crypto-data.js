const fs=require("fs");
const https=require("https");

const TFS=["15m","30m","1h","2h","4h"];
const LIMIT=700;
const UNIVERSE_LIMIT=100;
const DEFAULT_SYMBOLS=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","DOTUSDT","TRXUSDT","ATOMUSDT","NEARUSDT","APTUSDT","OPUSDT","ARBUSDT","BCHUSDT","LTCUSDT","INJUSDT","RNDRUSDT","SUIUSDT","FILUSDT","UNIUSDT","AAVEUSDT","ETCUSDT","MATICUSDT","TONUSDT","PEPEUSDT","WIFUSDT","FETUSDT"];
const EXCLUDED_BASES=new Set(["USDC","FDUSD","TUSD","BUSD","DAI","USDP","EUR","TRY","BRL","GBP","UAH","AEUR","EURI","PAX","USTC"]);
const BAD_SUFFIX=["UP","DOWN","BULL","BEAR","3L","3S","5L","5S"];

function getJson(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{"User-Agent":"ayaz-trade-v23"}},res=>{let data="";res.on("data",d=>data+=d);res.on("end",()=>{try{resolve(JSON.parse(data))}catch(e){reject(e)}})}).on("error",reject)})}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function getFxTry(){
  const sources=[
    {url:"https://data-api.binance.vision/api/v3/ticker/price?symbol=USDTTRY",source:"Binance data-api USDTTRY"},
    {url:"https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY",source:"Binance API USDTTRY"}
  ];
  for(const s of sources){
    try{
      const j=await getJson(s.url);
      const rate=Number(j.price);
      if(rate>10&&rate<250)return{usdtTry:rate,source:s.source,generatedAt:new Date().toISOString()};
    }catch(e){console.log("FX fail",s.source,e.message)}
  }
  try{
    const j=await getJson("https://open.er-api.com/v6/latest/USD");
    const rate=Number(j.rates&&j.rates.TRY);
    if(rate>10&&rate<250)return{usdtTry:rate,source:"USDTRY açık kur",generatedAt:new Date().toISOString()};
  }catch(e){console.log("FX fallback fail",e.message)}
  return{usdtTry:null,source:"kur alınamadı",generatedAt:new Date().toISOString()};
}

async function getUniverse(){
  try{
    const [ex,tickers]=await Promise.all([
      getJson("https://data-api.binance.vision/api/v3/exchangeInfo"),
      getJson("https://data-api.binance.vision/api/v3/ticker/24hr")
    ]);
    const allowed=new Set((ex.symbols||[]).filter(x=>x.status==="TRADING"&&x.quoteAsset==="USDT"&&(x.isSpotTradingAllowed!==false)).map(x=>x.symbol));
    const picked=(tickers||[]).filter(t=>{
      const sym=t.symbol||""; if(!sym.endsWith("USDT"))return false; if(!allowed.has(sym))return false;
      const base=sym.replace(/USDT$/,''); if(EXCLUDED_BASES.has(base))return false; if(BAD_SUFFIX.some(s=>base.endsWith(s)))return false;
      const qv=Number(t.quoteVolume||0), last=Number(t.lastPrice||0), trades=Number(t.count||0);
      return qv>2500000 && last>0 && trades>1000;
    }).sort((a,b)=>Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,UNIVERSE_LIMIT).map(t=>t.symbol);
    return picked.length>=40?picked:DEFAULT_SYMBOLS;
  }catch(e){console.log("Universe fallback",e.message);return DEFAULT_SYMBOLS}
}
(async()=>{
  const symbols=await getUniverse();
  const fx=await getFxTry();
  const out={generatedAt:new Date().toISOString(),source:"data-api.binance.vision",universeLimit:UNIVERSE_LIMIT,symbolCount:symbols.length,symbols,fx,data:{}};
  const liveTime=Date.now();
  for(const sym of symbols){
    out.data[sym]={};
    for(const tf of TFS){
      const url=`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${LIMIT}`;
      try{
        const raw=await getJson(url);
        const arr=raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]}));
        if(arr.length)arr[arr.length-1].liveTime=liveTime;
        out.data[sym][tf]=arr;
        console.log("OK",sym,tf,arr.length);
      }catch(e){out.data[sym][tf]=[];console.log("FAIL",sym,tf,e.message)}
      await sleep(55);
    }
  }
  fs.mkdirSync("data",{recursive:true});
  fs.writeFileSync("data/market.json",JSON.stringify(out));
  console.log("market.json updated",out.generatedAt,"symbols",symbols.length);
})().catch(e=>{console.error(e);process.exit(1)});
