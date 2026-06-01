const fs=require("fs");
const https=require("https");
const SYMBOLS=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT","LINKUSDT","DOTUSDT","TRXUSDT","ATOMUSDT","NEARUSDT","APTUSDT","OPUSDT","ARBUSDT","BCHUSDT","LTCUSDT","INJUSDT","RNDRUSDT","SUIUSDT","FILUSDT","UNIUSDT","AAVEUSDT","ETCUSDT","MATICUSDT","TONUSDT","PEPEUSDT","WIFUSDT","FETUSDT"];
const TFS=["15m","30m","1h","2h","4h"];
const LIMIT=700;
function getJson(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{"User-Agent":"ayaz-trade-v6"}},res=>{let data="";res.on("data",d=>data+=d);res.on("end",()=>{try{resolve(JSON.parse(data))}catch(e){reject(e)}})}).on("error",reject)})}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
(async()=>{const out={generatedAt:new Date().toISOString(),source:"data-api.binance.vision",data:{}};const liveTime=Date.now();for(const sym of SYMBOLS){out.data[sym]={};for(const tf of TFS){const url=`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=${LIMIT}`;try{const raw=await getJson(url);const arr=raw.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5]}));if(arr.length)arr[arr.length-1].liveTime=liveTime;out.data[sym][tf]=arr;console.log("OK",sym,tf,arr.length)}catch(e){out.data[sym][tf]=[];console.log("FAIL",sym,tf,e.message)}await sleep(70)}}fs.mkdirSync("data",{recursive:true});fs.writeFileSync("data/market.json",JSON.stringify(out));console.log("market.json updated",out.generatedAt)})().catch(e=>{console.error(e);process.exit(1)});
