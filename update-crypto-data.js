// Ayaz Trade — Kârlılık Odaklı Model Tarayıcı veri güncelleme scripti
// GitHub Actions içinde çalışır, Binance mum verilerini data/market.json dosyasına yazar.
// Node 18+ native fetch kullanır.

const fs = require('fs');
const path = require('path');

const API_BASES = [
  'https://data-api.binance.vision',
  'https://api.binance.com'
];

const DEFAULT_SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT',
  'LINKUSDT','TRXUSDT','DOTUSDT','LTCUSDT','BCHUSDT','NEARUSDT','ARBUSDT','OPUSDT',
  'APTUSDT','ATOMUSDT'
];

const TIMEFRAMES = ['15m','30m','1h','2h','4h','1d'];
const TOP_SYMBOL_LIMIT = Number(process.env.TOP_SYMBOL_LIMIT || 18);
const KLINE_LIMIT = Number(process.env.KLINE_LIMIT || 1000);
const PAUSE_MS = Number(process.env.PAUSE_MS || 120);

function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchJsonFromBase(base, apiPath, timeoutMs = 20000){
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try{
    const res = await fetch(base + apiPath, { signal: ac.signal, headers: { 'accept': 'application/json' }});
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function api(apiPath){
  let lastErr;
  for(const base of API_BASES){
    for(let attempt=1; attempt<=3; attempt++){
      try{
        return await fetchJsonFromBase(base, apiPath);
      } catch(err){
        lastErr = err;
        await sleep(350 * attempt);
      }
    }
  }
  throw lastErr;
}

function isCleanUsdtSymbol(s){
  const blocked = ['UPUSDT','DOWNUSDT','BULLUSDT','BEARUSDT'];
  return s.endsWith('USDT') && !blocked.some(x => s.includes(x.replace('USDT','')));
}

async function getTopSymbols(){
  try{
    const info = await api('/api/v3/exchangeInfo');
    const tradable = new Set(
      info.symbols
        .filter(x => x.status === 'TRADING' && x.quoteAsset === 'USDT' && x.isSpotTradingAllowed !== false)
        .map(x => x.symbol)
        .filter(isCleanUsdtSymbol)
    );
    const tickers = await api('/api/v3/ticker/24hr');
    const ranked = tickers
      .filter(x => tradable.has(x.symbol))
      .map(x => ({ symbol: x.symbol, quoteVolume: Number(x.quoteVolume || 0) }))
      .sort((a,b) => b.quoteVolume - a.quoteVolume)
      .map(x => x.symbol);

    const preferred = DEFAULT_SYMBOLS.filter(s => tradable.has(s));
    const merged = [...new Set([...preferred, ...ranked])].slice(0, TOP_SYMBOL_LIMIT);
    return merged.length ? merged : DEFAULT_SYMBOLS.slice(0, TOP_SYMBOL_LIMIT);
  } catch(err){
    console.log('Sembol listesi alınamadı, varsayılan liste kullanılacak:', err.message);
    return DEFAULT_SYMBOLS.slice(0, TOP_SYMBOL_LIMIT);
  }
}

async function getKlines(symbol, interval){
  const raw = await api(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${KLINE_LIMIT}`);
  return raw.map(k => [
    k[0],
    Number(k[1]),
    Number(k[2]),
    Number(k[3]),
    Number(k[4]),
    Number(k[5])
  ]);
}

async function main(){
  const startedAt = new Date();
  const symbols = await getTopSymbols();
  const data = {};
  const errors = [];

  console.log('Ayaz Trade veri güncelleme başladı');
  console.log('Semboller:', symbols.join(', '));
  console.log('Timeframes:', TIMEFRAMES.join(', '));

  for(const symbol of symbols){
    data[symbol] = {};
    for(const tf of TIMEFRAMES){
      try{
        const klines = await getKlines(symbol, tf);
        data[symbol][tf] = klines;
        const last = klines[klines.length - 1];
        console.log(`OK ${symbol} ${tf} mum=${klines.length} son=${last ? new Date(last[0]).toISOString() : '-'}`);
      } catch(err){
        errors.push({ symbol, tf, error: err.message });
        console.log(`HATA ${symbol} ${tf}: ${err.message}`);
      }
      await sleep(PAUSE_MS);
    }
  }

  const payload = {
    app: 'Ayaz Trade — Karlilik Odakli Model Tarayici',
    version: 'kar-model-tarayici-v1',
    generatedAt: new Date().toISOString(),
    generatedAtTR: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }),
    source: 'Binance public klines via data-api.binance.vision/api.binance.com',
    symbols,
    timeframes: TIMEFRAMES,
    klineLimit: KLINE_LIMIT,
    data,
    errors,
    durationSec: Math.round((Date.now() - startedAt.getTime()) / 1000)
  };

  const outDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'market.json'), JSON.stringify(payload));
  fs.writeFileSync(path.join(outDir, 'last-update.txt'), payload.generatedAtTR + '\n');
  console.log('data/market.json yazıldı');
  console.log('Süre:', payload.durationSec, 'sn');
  if(errors.length){
    console.log('Eksik veri sayısı:', errors.length);
  }
}

main().catch(err => {
  console.error('Veri güncelleme başarısız:', err);
  process.exit(1);
});
