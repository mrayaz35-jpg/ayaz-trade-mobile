const fs = require('fs');
const path = require('path');

const SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT',
  'TRXUSDT','MATICUSDT','LTCUSDT','BCHUSDT','ATOMUSDT','NEARUSDT','APTUSDT','OPUSDT','ARBUSDT','INJUSDT',
  'FILUSDT','ETCUSDT','SUIUSDT','SEIUSDT','TIAUSDT','RUNEUSDT','AAVEUSDT','UNIUSDT','MKRUSDT','FETUSDT',
  'RENDERUSDT','RNDRUSDT','GRTUSDT','PEPEUSDT','SHIBUSDT','WIFUSDT','BONKUSDT','FLOKIUSDT','HBARUSDT','ICPUSDT',
  'XLMUSDT','VETUSDT','ALGOUSDT','SANDUSDT','MANAUSDT','AXSUSDT','GALAUSDT','IMXUSDT','LDOUSDT','CRVUSDT',
  'SUSHIUSDT','COMPUSDT','SNXUSDT','DYDXUSDT','JUPUSDT','PYTHUSDT','WLDUSDT','ARUSDT','STXUSDT','ENAUSDT',
  'PENDLEUSDT','JASMYUSDT','THETAUSDT','QNTUSDT','KAVAUSDT','ROSEUSDT','MINAUSDT','FLOWUSDT','CHZUSDT','APEUSDT',
  'BLURUSDT','GMTUSDT','WOOUSDT','ENSUSDT','ZILUSDT','IOTAUSDT','KSMUSDT','CELOUSDT','BATUSDT','QTUMUSDT'
];

const TFS = {
  '5m':  { binance:'5m',  okx:'5m',  kucoin:'5min',  ms:5*60*1000,      sr:48, fib:120, am:1.10, rr:1.40, label:'5 dakika' },
  '15m': { binance:'15m', okx:'15m', kucoin:'15min', ms:15*60*1000,     sr:48, fib:120, am:1.20, rr:1.50, label:'15 dakika' },
  '30m': { binance:'30m', okx:'30m', kucoin:'30min', ms:30*60*1000,     sr:48, fib:120, am:1.30, rr:1.60, label:'30 dakika' },
  '1h':  { binance:'1h',  okx:'1H',  kucoin:'1hour', ms:60*60*1000,     sr:48, fib:160, am:1.40, rr:1.80, label:'1 saat' },
  '2h':  { binance:'2h',  okx:'2H',  kucoin:'2hour', ms:2*60*60*1000,   sr:48, fib:160, am:1.50, rr:2.00, label:'2 saat' },
  '4h':  { binance:'4h',  okx:'4H',  kucoin:'4hour', ms:4*60*60*1000,   sr:50, fib:180, am:1.60, rr:2.20, label:'4 saat' },
  '1d':  { binance:'1d',  okx:'1D',  kucoin:'1day',  ms:24*60*60*1000,  sr:80, fib:220, am:2.20, rr:3.00, label:'1 gün' }
};

const LIMIT = 240;
const CONCURRENCY = 8;

function baseFromSymbol(symbol) {
  return symbol.replace(/USDT$/, '').replace(/USD$/, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'AyazTradeData/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanCandles(rows, min = 80) {
  const out = rows
    .map(row => row.map(Number))
    .filter(row => row.length >= 6 && row.every(Number.isFinite) && row[4] > 0 && row[2] > 0 && row[3] > 0)
    .sort((a, b) => a[0] - b[0])
    .slice(-LIMIT);
  if (out.length < min) throw new Error(`Yetersiz temiz mum verisi: ${out.length}`);
  return out;
}

async function fromBinance(symbol, tf) {
  const bases = ['https://data-api.binance.vision', 'https://api.binance.com', 'https://api1.binance.com', 'https://api2.binance.com', 'https://api3.binance.com', 'https://api4.binance.com'];
  let lastError = null;
  for (const base of bases) {
    try {
      const url = `${base}/api/v3/klines?symbol=${symbol}&interval=${tf.binance}&limit=${LIMIT}`;
      const data = await fetchJson(url);
      if (!Array.isArray(data)) throw new Error('Binance format hatası');
      const candles = cleanCandles(data.map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5]]));
      return { source: base.replace('https://', ''), candles };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Binance veri vermedi');
}

async function fromOKX(symbol, tf) {
  const base = baseFromSymbol(symbol);
  const instId = `${base}-USDT`;
  const url = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${tf.okx}&limit=${LIMIT}`;
  const data = await fetchJson(url);
  if (data.code !== '0') throw new Error(data.msg || 'OKX hata');
  if (!Array.isArray(data.data)) throw new Error('OKX format hatası');
  const candles = cleanCandles(data.data.map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[5]]));
  return { source: 'OKX', candles };
}

async function fromKuCoin(symbol, tf) {
  const base = baseFromSymbol(symbol);
  const pair = `${base}-USDT`;
  const url = `https://api.kucoin.com/api/v1/market/candles?type=${tf.kucoin}&symbol=${pair}`;
  const data = await fetchJson(url);
  if (data.code !== '200000') throw new Error(data.msg || 'KuCoin hata');
  if (!Array.isArray(data.data)) throw new Error('KuCoin format hatası');
  const candles = cleanCandles(data.data.map(x => [+x[0] * 1000, +x[1], +x[3], +x[4], +x[2], +x[5]]));
  return { source: 'KuCoin', candles };
}

async function fetchOne(symbol, tfName) {
  const tf = TFS[tfName];
  const attempts = [];
  const providers = [
    ['Binance', () => fromBinance(symbol, tf)],
    ['OKX', () => fromOKX(symbol, tf)],
    ['KuCoin', () => fromKuCoin(symbol, tf)]
  ];

  for (const [name, fn] of providers) {
    try {
      const result = await fn();
      attempts.push({ source: name, ok: true });
      return {
        ok: true,
        source: result.source,
        attempts,
        candles: result.candles,
        realMs: result.candles.length > 1 ? result.candles[result.candles.length - 1][0] - result.candles[result.candles.length - 2][0] : tf.ms,
        profile: { sr: tf.sr, fib: tf.fib, am: tf.am, rr: tf.rr, label: tf.label, ms: tf.ms }
      };
    } catch (error) {
      attempts.push({ source: name, ok: false, error: error.message || String(error) });
      await sleep(50);
    }
  }

  return { ok: false, attempts, error: 'Tüm veri kaynakları başarısız', candles: [], profile: { sr: tf.sr, fib: tf.fib, am: tf.am, rr: tf.rr, label: tf.label, ms: tf.ms } };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main() {
  const started = new Date();
  const markets = {};
  const errors = [];
  const tasks = [];

  for (const symbol of SYMBOLS) {
    markets[symbol] = {};
    for (const tfName of Object.keys(TFS)) {
      tasks.push({ symbol, tfName });
    }
  }

  await mapLimit(tasks, CONCURRENCY, async ({ symbol, tfName }) => {
    const result = await fetchOne(symbol, tfName);
    markets[symbol][tfName] = result;
    if (!result.ok) errors.push({ symbol, tf: tfName, error: result.error, attempts: result.attempts });
    console.log(`${symbol} ${tfName}: ${result.ok ? 'OK ' + result.source : 'FAIL'}`);
  });

  const output = {
    ok: true,
    generatedAt: new Date().toISOString(),
    startedAt: started.toISOString(),
    symbols: SYMBOLS,
    timeframes: Object.keys(TFS),
    tfProfiles: Object.fromEntries(Object.entries(TFS).map(([k, v]) => [k, { sr: v.sr, fib: v.fib, am: v.am, rr: v.rr, label: v.label, ms: v.ms }])),
    markets,
    errors
  };

  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'data', 'market.json'), JSON.stringify(output));
  console.log(`Market data written. Errors: ${errors.length}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
