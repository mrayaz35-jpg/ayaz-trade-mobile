import React, { useEffect, useMemo, useRef, useState } from "react";

const APP_VERSION = "V8-CANLI-KANIT-PRO-PLAN";
const FIXED_CANDLE_LIMIT = 500;
const DEFAULT_COIN_LIMIT = 400;
const DEFAULT_MIN_VOLUME_USDT = 1000000;

const BINANCE_BASES = [
  "https://data-api.binance.vision",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api.binance.com",
];

const TF_LIST = ["15m", "30m", "1h", "2h", "4h", "1d"];
const SYMBOL_META = new Map();

const RULE = {
  rsiPeriod: 14,
  atrPeriod: 14,
  volumePeriod: 20,
  swingLookback: 20,
  targetLookback: 80,
  entryBufferAtr: 0.05,
  atrStop: 1.5,
  atrBuffer: 0.25,
  tp1R: 2,
  tp2R: 3,
  tp3R: 5,
};

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priceFmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  if (x >= 1000) return x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  if (x >= 1) return x.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
  if (x >= 0.01) return x.toLocaleString("tr-TR", { maximumFractionDigits: 6 });
  return x.toLocaleString("tr-TR", { maximumFractionDigits: 8 });
}

function dt(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("tr-TR");
}

function nowText() {
  return new Date().toLocaleString("tr-TR");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      signal: controller.signal,
      headers: { accept: "application/json,text/plain,*/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function binanceGet(path, timeout = 20000) {
  let lastError = null;
  for (const base of BINANCE_BASES) {
    try {
      const data = await fetchJson(base + path, timeout);
      return { data, base };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(lastError?.message || "Load failed");
}

async function getUsdTry() {
  try {
    const data = await fetchJson("https://open.er-api.com/v6/latest/USD", 12000);
    const rate = Number(data?.rates?.TRY || 0);
    if (rate > 0) return { rate, source: "open.er-api" };
  } catch {}

  try {
    const data = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY", 12000);
    const rate = Number(data?.rates?.TRY || 0);
    if (rate > 0) return { rate, source: "frankfurter" };
  } catch {}

  return { rate: 0, source: "alınamadı" };
}

async function getSymbols(maxCount, minVolumeUsdt) {
  const ex = await binanceGet("/api/v3/exchangeInfo", 25000);
  const tk = await binanceGet("/api/v3/ticker/24hr", 25000);

  const exchangeInfo = ex.data;
  const tickers = tk.data;
  SYMBOL_META.clear();

  const active = new Set(
    exchangeInfo.symbols
      .filter((s) => s.status === "TRADING")
      .filter((s) => s.quoteAsset === "USDT")
      .filter((s) => s.isSpotTradingAllowed)
      .map((s) => {
        const priceFilter = s.filters?.find((f) => f.filterType === "PRICE_FILTER");
        SYMBOL_META.set(s.symbol, { tickSize: Number(priceFilter?.tickSize || 0) });
        return s.symbol;
      })
  );

  const filtered = tickers
    .filter((t) => active.has(t.symbol))
    .filter((t) => Number(t.quoteVolume) >= Number(minVolumeUsdt || 0))
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume));

  return {
    symbols: filtered.slice(0, Number(maxCount || DEFAULT_COIN_LIMIT)).map((t) => t.symbol),
    allActiveCount: active.size,
    filteredCount: filtered.length,
    endpoint: ex.base,
  };
}

async function getKlines(symbol, interval) {
  const res = await binanceGet(
    `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${FIXED_CANDLE_LIMIT}`,
    20000
  );

  const candles = res.data.map((k) => ({
    time: Number(k[0]),
    closeTime: Number(k[6]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));

  return { candles, endpoint: res.base };
}

async function getBtcPrice() {
  const res = await binanceGet("/api/v3/ticker/price?symbol=BTCUSDT", 12000);
  return { price: Number(res.data?.price || 0), endpoint: res.base };
}

function ema(values, period) {
  if (!values || values.length < period) return Array(values?.length || 0).fill(null);
  const k = 2 / (period + 1);
  const out = Array(values.length).fill(null);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null
  );
  const signal = ema(line.map((v) => v ?? 0), signalPeriod);
  const hist = line.map((v, i) => (v !== null && signal[i] !== null ? v - signal[i] : null));
  return { line, signal, hist };
}

function atr(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  return ema(tr, period);
}

function avgLast(arr, period) {
  const part = arr.slice(-period);
  return part.length ? part.reduce((a, b) => a + b, 0) / part.length : 0;
}

function getTickSize(symbol, price) {
  const tick = Number(SYMBOL_META.get(symbol)?.tickSize || 0);
  if (tick > 0) return tick;
  if (price >= 1000) return 0.01;
  if (price >= 1) return 0.0001;
  if (price >= 0.01) return 0.000001;
  return 0.00000001;
}

function decimalsFromTick(tick) {
  if (!tick || !Number.isFinite(tick)) return 8;
  const s = tick.toString();
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  if (!s.includes(".")) return 0;
  return s.replace(/0+$/, "").split(".")[1]?.length || 0;
}

function roundToTick(price, tick, side = "nearest") {
  if (!tick || !Number.isFinite(tick) || tick <= 0) return price;
  let x = price / tick;
  if (side === "up") x = Math.ceil(x);
  else if (side === "down") x = Math.floor(x);
  else x = Math.round(x);
  return Number((x * tick).toFixed(decimalsFromTick(tick)));
}

function lowestLow(candles, lookback) {
  return Math.min(...candles.slice(-lookback).map((c) => c.low));
}

function highestHigh(candles, lookback) {
  return Math.max(...candles.slice(-lookback).map((c) => c.high));
}

function nearResistance(candles, entry) {
  const arr = candles.slice(-RULE.targetLookback, -1).map((c) => c.high).filter((x) => x > entry);
  return arr.length ? Math.min(...arr) : null;
}

function nearSupport(candles, entry) {
  const arr = candles.slice(-RULE.targetLookback, -1).map((c) => c.low).filter((x) => x < entry);
  return arr.length ? Math.max(...arr) : null;
}

function buildTradePlan({ symbol, side, closePrice, atrNow, candles }) {
  const last = candles[candles.length - 1];
  const tick = getTickSize(symbol, closePrice);
  const entryBuffer = Math.max(tick, atrNow * RULE.entryBufferAtr);

  const entry = side === "LONG"
    ? roundToTick(Math.max(closePrice, last.high + entryBuffer), tick, "up")
    : roundToTick(Math.min(closePrice, last.low - entryBuffer), tick, "down");

  if (side === "LONG") {
    const swingLow = lowestLow(candles, RULE.swingLookback);
    const stop = roundToTick(Math.min(entry - atrNow * RULE.atrStop, swingLow - atrNow * RULE.atrBuffer), tick, "down");
    const risk = entry - stop;
    if (risk <= 0) return null;

    const rr1 = roundToTick(entry + risk * RULE.tp1R, tick, "up");
    const rr2 = roundToTick(entry + risk * RULE.tp2R, tick, "up");
    const rr3 = roundToTick(entry + risk * RULE.tp3R, tick, "up");
    const structure = nearResistance(candles, entry);

    return {
      entry, stop,
      tp1: structure && structure > entry ? roundToTick(Math.max(structure, rr1), tick, "up") : rr1,
      tp2: rr2,
      tp3: rr3,
    };
  }

  if (side === "SHORT") {
    const swingHigh = highestHigh(candles, RULE.swingLookback);
    const stop = roundToTick(Math.max(entry + atrNow * RULE.atrStop, swingHigh + atrNow * RULE.atrBuffer), tick, "up");
    const risk = stop - entry;
    if (risk <= 0) return null;

    const rr1 = roundToTick(entry - risk * RULE.tp1R, tick, "down");
    const rr2 = roundToTick(entry - risk * RULE.tp2R, tick, "down");
    const rr3 = roundToTick(entry - risk * RULE.tp3R, tick, "down");
    const structure = nearSupport(candles, entry);

    const tp1 = structure && structure < entry ? roundToTick(Math.min(structure, rr1), tick, "down") : rr1;
    if (tp1 <= 0 || rr2 <= 0 || rr3 <= 0) return null;
    return { entry, stop, tp1, tp2: rr2, tp3: rr3 };
  }

  return null;
}

function analyzeSymbol(symbol, tf, candles, usdtry) {
  if (!candles || candles.length < 220 || !usdtry) return null;

  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const i = candles.length - 1;

  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const rs = rsi(closes, RULE.rsiPeriod);
  const m = macd(closes);
  const at = atr(candles, RULE.atrPeriod);

  const closePrice = closes[i];
  const atrNow = at[i];
  const rsiNow = rs[i];

  if (!atrNow || !rsiNow || !closePrice) return null;

  const volumeOk = volumes[i] > avgLast(volumes, RULE.volumePeriod);

  const longOk =
    e9[i] > e21[i] && e21[i] > e50[i] && e50[i] > e200[i] &&
    rsiNow > 55 &&
    m.line[i] > m.signal[i] &&
    m.hist[i] > 0 &&
    volumeOk;

  const shortOk =
    e9[i] < e21[i] && e21[i] < e50[i] && e50[i] < e200[i] &&
    rsiNow < 45 &&
    m.line[i] < m.signal[i] &&
    m.hist[i] < 0 &&
    volumeOk;

  if (!longOk && !shortOk) return null;

  const side = longOk ? "LONG" : "SHORT";
  const plan = buildTradePlan({ symbol, side, closePrice, atrNow, candles });
  if (!plan) return null;

  return {
    symbol, tf, side,
    entry: plan.entry, stop: plan.stop, tp1: plan.tp1, tp2: plan.tp2, tp3: plan.tp3,
    entryTl: plan.entry * usdtry, stopTl: plan.stop * usdtry, tp1Tl: plan.tp1 * usdtry, tp2Tl: plan.tp2 * usdtry, tp3Tl: plan.tp3 * usdtry,
  };
}

function SignalCard({ signal }) {
  const isLong = signal.side === "LONG";
  return (
    <div className={`candidate ${isLong ? "long" : "short"}`}>
      <div className="topline">
        <div><div className="symbol">{signal.symbol}</div><div className="subtf">{signal.tf}</div></div>
        <div className={`side ${isLong ? "long" : "short"}`}>{signal.side}</div>
      </div>
      <div className="plan">
        <div><span>Giriş</span><b>{priceFmt(signal.entry)}</b><em>{money(signal.entryTl)} TL</em></div>
        <div><span>Stop</span><b>{priceFmt(signal.stop)}</b><em>{money(signal.stopTl)} TL</em></div>
        <div><span>TP1</span><b>{priceFmt(signal.tp1)}</b><em>{money(signal.tp1Tl)} TL</em></div>
        <div><span>TP2</span><b>{priceFmt(signal.tp2)}</b><em>{money(signal.tp2Tl)} TL</em></div>
        <div><span>TP3</span><b>{priceFmt(signal.tp3)}</b><em>{money(signal.tp3Tl)} TL</em></div>
      </div>
    </div>
  );
}

export default function App() {
  const [usdtry, setUsdtry] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_COIN_LIMIT);
  const [minVolume, setMinVolume] = useState(DEFAULT_MIN_VOLUME_USDT);
  const [selectedTfs, setSelectedTfs] = useState([...TF_LIST]);
  const [status, setStatus] = useState("Hazır.");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [signals, setSignals] = useState([]);
  const [finalLong, setFinalLong] = useState(0);
  const [finalShort, setFinalShort] = useState(0);
  const [live, setLive] = useState({
    time: "-",
    btc: "-",
    endpoint: "-",
    active: "-",
    filtered: "-",
    lastSymbol: "-",
    lastTf: "-",
    requestedCandles: FIXED_CANDLE_LIMIT,
    receivedCandles: "-",
    lastCandle: "-",
    fxSource: "-",
  });
  const stopRef = useRef(false);

  const longSignals = useMemo(() => signals.filter((s) => s.side === "LONG"), [signals]);
  const shortSignals = useMemo(() => signals.filter((s) => s.side === "SHORT"), [signals]);

  async function refreshLivePanel() {
    const fx = await getUsdTry();
    setUsdtry(fx.rate || 0);
    let btc = "-";
    let endpoint = "-";
    try {
      const b = await getBtcPrice();
      btc = priceFmt(b.price);
      endpoint = b.endpoint;
    } catch {}
    setLive((p) => ({ ...p, time: nowText(), btc, endpoint, fxSource: fx.source || "-" }));
  }

  useEffect(() => {
    refreshLivePanel();
    const timer = setInterval(refreshLivePanel, 60000);
    return () => clearInterval(timer);
  }, []);

  function toggleTf(tf) {
    setSelectedTfs((prev) => prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]);
  }

  async function scan() {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    setDone(0); setTotal(0); setSignals([]); setFinalLong(0); setFinalShort(0);

    setStatus("Canlı kur ve semboller alınıyor...");
    const fx = await getUsdTry();
    setUsdtry(fx.rate || 0);
    if (!fx.rate) { setStatus("USD/TRY alınamadı."); setRunning(false); return; }
    if (!selectedTfs.length) { setStatus("Time frame seç."); setRunning(false); return; }

    let pack;
    try {
      pack = await getSymbols(Number(limit), Number(minVolume));
      setLive((p) => ({ ...p, time: nowText(), active: pack.allActiveCount, filtered: pack.filteredCount, endpoint: pack.endpoint, fxSource: fx.source || "-" }));
    } catch (err) {
      setStatus("Sembol alınamadı: " + (err?.message || "Load failed"));
      setRunning(false); return;
    }

    const symbols = pack.symbols;
    const scanTotal = symbols.length * selectedTfs.length;
    setTotal(scanTotal);

    let localDone = 0, localLong = 0, localShort = 0;

    for (const symbol of symbols) {
      for (const tf of selectedTfs) {
        if (stopRef.current) { setStatus(`Durduruldu. ${localDone}/${scanTotal}`); setRunning(false); return; }
        setStatus(`${symbol} ${tf} taranıyor... ${localDone}/${scanTotal}`);

        try {
          const { candles, endpoint } = await getKlines(symbol, tf);
          setLive((p) => ({
            ...p,
            time: nowText(),
            endpoint,
            lastSymbol: symbol,
            lastTf: tf,
            requestedCandles: FIXED_CANDLE_LIMIT,
            receivedCandles: candles.length,
            lastCandle: dt(candles[candles.length - 1]?.closeTime),
          }));

          const result = analyzeSymbol(symbol, tf, candles, fx.rate);
          if (result) {
            if (result.side === "LONG") localLong++;
            if (result.side === "SHORT") localShort++;
            setSignals((prev) => [...prev, result]);
          }
        } catch {}

        localDone++;
        setDone(localDone);
        await sleep(90);
      }
    }

    setFinalLong(localLong); setFinalShort(localShort);
    setStatus(`Tarama bitti. Long: ${localLong}, Short: ${localShort}`);
    setRunning(false);
  }

  function stop() { stopRef.current = true; }
  function clear() {
    setSignals([]); setDone(0); setTotal(0); setFinalLong(0); setFinalShort(0);
    setLimit(DEFAULT_COIN_LIMIT); setMinVolume(DEFAULT_MIN_VOLUME_USDT);
    setStatus("Temizlendi.");
  }

  return (
    <div className="page" data-version={APP_VERSION}>
      <style>{`
        :root{--bg:#070c1d;--card:#101832;--card2:#0b1228;--line:#293762;--text:#f4f7ff;--muted:#aeb9dc;--blue:#2f7df6}
        *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
        .page{max-width:1120px;margin:0 auto;padding:18px 12px 80px}.hero,.card{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:22px;padding:16px;margin:12px 0}.hero{border:2px solid #f2ca61}.hero h1{font-size:30px;line-height:1.05;margin:0 0 8px;font-weight:950}.hero p{margin:0;color:var(--muted);font-weight:800;font-size:15px}
        .formgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px} label{display:block;color:var(--muted);font-size:13px;font-weight:850;margin-bottom:6px} input,.fixedBox{width:100%;background:#0a1127;color:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;font-size:16px;font-weight:850}.fixedBox{font-weight:950}
        .tfbar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.tfbtn{background:#0a1127;border:1px solid var(--line);border-radius:999px;padding:10px 13px;font-weight:950;color:#dce5ff;cursor:pointer}.tfbtn.active{background:#17386f;border-color:#65a0ff}
        .btn{width:100%;border:1px solid #65a0ff;background:var(--blue);color:#fff;border-radius:18px;padding:16px 14px;font-size:20px;font-weight:950;cursor:pointer}.btn.secondary{background:#223052;border-color:#405582;margin-top:10px}.btn:disabled{opacity:.55}
        .livegrid,.dash{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:8px 0 14px}.livegrid div,.dash div{background:#0a1127;border:1px solid var(--line);border-radius:15px;padding:10px;text-align:center}.livegrid b,.dash b{display:block;font-size:18px;word-break:break-word}.livegrid span,.dash span{display:block;color:var(--muted);font-size:12px;font-weight:850;margin-top:4px}
        .status{margin-top:12px;background:#101936;border:1px solid var(--line);border-radius:15px;padding:12px;font-size:15px;font-weight:900;color:#dce5ff}.progress{height:12px;background:#0b1228;border:1px solid var(--line);border-radius:999px;overflow:hidden;margin:14px 0}.bar{height:100%;background:#2f7df6}
        .section.long h2{color:#76ffa8}.section.short h2{color:#ff95a6}.candidate{border:2px solid #0f944e;border-radius:20px;background:#0b1228;padding:15px;margin:12px 0}.candidate.short{border-color:#7d1d31}.topline{display:flex;justify-content:space-between;align-items:center;gap:10px}.symbol{font-size:26px;font-weight:950}.subtf{font-size:16px;color:var(--muted);font-weight:900}.side{font-size:22px;font-weight:950;border-radius:16px;padding:10px 13px;min-width:85px;text-align:center}.side.long{background:#06451f;color:#76ffa8}.side.short{background:#551121;color:#ff95a6}
        .plan{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}.plan div{background:#0a1127;border:1px solid var(--line);border-radius:15px;padding:12px}.plan span{display:block;color:var(--muted);font-size:13px;font-weight:900}.plan b{display:block;font-size:20px;font-weight:950;margin-top:5px}.plan em{display:block;font-style:normal;color:#dce5ff;font-weight:850;font-size:13px;margin-top:4px}.empty{color:var(--muted);font-weight:750}
        @media(max-width:760px){.formgrid,.grid2,.dash,.livegrid,.plan{grid-template-columns:1fr}.page{padding:12px 10px 70px}.hero h1{font-size:27px}.symbol{font-size:25px}.side{font-size:20px}}
      `}</style>

      <div className="hero">
        <h1>Ayaz Trade — V8 Canlı Kanıt</h1>
        <p>500 mum sabit. Gelen mum sayısı ve son mum zamanı ekranda görünür.</p>
      </div>

      <div className="card">
        <h2>Canlı Veri Kanıtı</h2>
        <div className="livegrid">
          <div><b>{APP_VERSION}</b><span>Sürüm</span></div>
          <div><b>{FIXED_CANDLE_LIMIT}</b><span>İstenen Mum</span></div>
          <div><b>{live.receivedCandles}</b><span>Gelen Mum</span></div>
          <div><b>{live.lastCandle}</b><span>Son Mum</span></div>
        </div>
        <div className="livegrid">
          <div><b>{usdtry ? money(usdtry) : "-"}</b><span>USD/TRY</span></div>
          <div><b>{live.btc}</b><span>BTCUSDT</span></div>
          <div><b>{live.lastSymbol} {live.lastTf}</b><span>Son Kontrol</span></div>
          <div><b>{live.time}</b><span>Kontrol Saati</span></div>
        </div>
        <div className="livegrid">
          <div><b>{live.active}</b><span>Aktif USDT</span></div>
          <div><b>{live.filtered}</b><span>Hacimden Sonra</span></div>
          <div><b>{live.fxSource}</b><span>Kur Kaynağı</span></div>
          <div><b>{live.endpoint}</b><span>Binance Endpoint</span></div>
        </div>
      </div>

      <div className="card">
        <div className="formgrid">
          <div><label>Maksimum coin</label><input type="number" value={limit} min="10" max="450" onChange={(e) => setLimit(e.target.value)} /></div>
          <div><label>Minimum 24s hacim USDT</label><input type="number" value={minVolume} min="0" onChange={(e) => setMinVolume(e.target.value)} /></div>
          <div><label>Mum sayısı</label><div className="fixedBox">500 SABİT</div></div>
        </div>

        <div className="tfbar">
          {TF_LIST.map((tf) => <button key={tf} className={`tfbtn ${selectedTfs.includes(tf) ? "active" : ""}`} onClick={() => toggleTf(tf)} type="button">{tf === "1d" ? "Günlük" : tf}</button>)}
        </div>

        <button className="btn" onClick={scan} disabled={running}>{running ? "TARANIYOR..." : "TARAMAYI BAŞLAT"}</button>
        <div className="grid2"><button className="btn secondary" onClick={stop} type="button">DURDUR</button><button className="btn secondary" onClick={clear} type="button">TEMİZLE</button></div>
        <div className="progress"><div className="bar" style={{ width: total ? `${Math.min(100, (done / total) * 100)}%` : "0%" }} /></div>
        <div className="status">{status}</div>
      </div>

      <div className="dash">
        <div><b>{done}</b><span>Kontrol</span></div>
        <div><b>{total}</b><span>Toplam</span></div>
        <div><b>{running ? longSignals.length : finalLong}</b><span>Long</span></div>
        <div><b>{running ? shortSignals.length : finalShort}</b><span>Short</span></div>
      </div>

      <div className="card section long"><h2>LONG</h2>{longSignals.length ? longSignals.map((signal, index) => <SignalCard key={`${signal.symbol}-${signal.tf}-${index}`} signal={signal} />) : <p className="empty">Long yok.</p>}</div>
      <div className="card section short"><h2>SHORT</h2>{shortSignals.length ? shortSignals.map((signal, index) => <SignalCard key={`${signal.symbol}-${signal.tf}-${index}`} signal={signal} />) : <p className="empty">Short yok.</p>}</div>
    </div>
  );
}
