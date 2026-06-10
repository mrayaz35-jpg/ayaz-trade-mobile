import React, { useEffect, useMemo, useRef, useState } from "react";

const BINANCE = "https://api.binance.com";
const TF_LIST = ["15m", "30m", "1h", "2h", "4h", "1d"];
const RULE = { atrPeriod: 14, rsiPeriod: 14, atrStop: 1.5, tp1R: 2, tp2R: 3, tp3R: 5, volumePeriod: 20, minVolumeUsdt: 10000000 };

function fmt(n, d = 6) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  return Number(n).toLocaleString("tr-TR", { maximumFractionDigits: d });
}
function money(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "-";
  return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function getUsdTry() {
  try {
    const data = await fetchJson("https://open.er-api.com/v6/latest/USD", 12000);
    const rate = Number(data?.rates?.TRY || 0);
    if (rate > 0) return { rate, source: "open.er-api.com" };
  } catch {}
  try {
    const data = await fetchJson("https://api.frankfurter.app/latest?from=USD&to=TRY", 12000);
    const rate = Number(data?.rates?.TRY || 0);
    if (rate > 0) return { rate, source: "frankfurter.app" };
  } catch {}
  return { rate: 0, source: "alınamadı" };
}

async function getSymbols(maxCount, minVolumeUsdt) {
  const [exchangeInfo, tickers] = await Promise.all([
    fetchJson(`${BINANCE}/api/v3/exchangeInfo`, 25000),
    fetchJson(`${BINANCE}/api/v3/ticker/24hr`, 25000),
  ]);

  const active = new Set(exchangeInfo.symbols
    .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT" && s.isSpotTradingAllowed)
    .map((s) => s.symbol));

  return tickers
    .filter((t) => active.has(t.symbol))
    .filter((t) => Number(t.quoteVolume) >= minVolumeUsdt)
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, maxCount)
    .map((t) => t.symbol);
}

async function getKlines(symbol, interval, limit) {
  const raw = await fetchJson(`${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, 20000);
  return raw.map((k) => ({ time: Number(k[0]), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) }));
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
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) => fastEma[i] !== null && slowEma[i] !== null ? fastEma[i] - slowEma[i] : null);
  const signal = ema(line.map((v) => v ?? 0), signalPeriod);
  const hist = line.map((v, i) => v !== null && signal[i] !== null ? v - signal[i] : null);
  return { line, signal, hist };
}

function atr(candles, period = 14) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
  return ema(tr, period);
}

function avgLast(arr, period) {
  const part = arr.slice(-period);
  return part.length ? part.reduce((a, b) => a + b, 0) / part.length : 0;
}

function analyzeSymbol(symbol, tf, candles, usdtry) {
  if (!candles || candles.length < 220 || !usdtry) return null;
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const i = candles.length - 1;

  const ema9 = ema(closes, 9), ema21 = ema(closes, 21), ema50 = ema(closes, 50), ema200 = ema(closes, 200);
  const rsi14 = rsi(closes, RULE.rsiPeriod);
  const macdData = macd(closes);
  const atr14 = atr(candles, RULE.atrPeriod);

  const entry = closes[i], atrNow = atr14[i], rsiNow = rsi14[i];
  if (!atrNow || !rsiNow || !entry) return null;

  const volumeOk = volumes[i] > avgLast(volumes, RULE.volumePeriod);

  const longOk = ema9[i] > ema21[i] && ema21[i] > ema50[i] && ema50[i] > ema200[i] && rsiNow > 55 && macdData.line[i] > macdData.signal[i] && macdData.hist[i] > 0 && volumeOk;
  const shortOk = ema9[i] < ema21[i] && ema21[i] < ema50[i] && ema50[i] < ema200[i] && rsiNow < 45 && macdData.line[i] < macdData.signal[i] && macdData.hist[i] < 0 && volumeOk;

  if (!longOk && !shortOk) return null;

  const side = longOk ? "LONG" : "SHORT";
  const risk = atrNow * RULE.atrStop;
  const stop = side === "LONG" ? entry - risk : entry + risk;
  const tp1 = side === "LONG" ? entry + risk * RULE.tp1R : entry - risk * RULE.tp1R;
  const tp2 = side === "LONG" ? entry + risk * RULE.tp2R : entry - risk * RULE.tp2R;
  const tp3 = side === "LONG" ? entry + risk * RULE.tp3R : entry - risk * RULE.tp3R;

  return {
    symbol, tf, side, entry, stop, tp1, tp2, tp3,
    entryTl: entry * usdtry, stopTl: stop * usdtry, tp1Tl: tp1 * usdtry, tp2Tl: tp2 * usdtry, tp3Tl: tp3 * usdtry,
    rsi: rsiNow, atr: atrNow, macdHist: macdData.hist[i],
    reason: "EMA trend + MACD + RSI + hacim şartları tam geçti",
  };
}

function SignalCard({ signal }) {
  const isLong = signal.side === "LONG";
  return (
    <div className={`candidate ${isLong ? "long" : "short"}`}>
      <div className="candidateTop">
        <div>
          <div className="symbol">{signal.symbol} <span>{signal.tf}</span></div>
          <div className="reason">{signal.reason}</div>
        </div>
        <div className={`side ${isLong ? "long" : "short"}`}>{signal.side}</div>
      </div>
      <div className="tags">
        <span>RSI {fmt(signal.rsi, 2)}</span>
        <span>ATR {fmt(signal.atr, 8)}</span>
        <span>MACD Hist {fmt(signal.macdHist, 8)}</span>
        <span>Canlı Veri</span>
      </div>
      <div className="metrics">
        <div><b>Entry USDT</b><strong>{fmt(signal.entry, 8)}</strong></div>
        <div><b>Entry TL</b><strong>{money(signal.entryTl)}</strong></div>
        <div><b>Stop USDT</b><strong>{fmt(signal.stop, 8)}</strong></div>
        <div><b>Stop TL</b><strong>{money(signal.stopTl)}</strong></div>
        <div><b>TP1 USDT</b><strong>{fmt(signal.tp1, 8)}</strong></div>
        <div><b>TP1 TL</b><strong>{money(signal.tp1Tl)}</strong></div>
        <div><b>TP2 USDT</b><strong>{fmt(signal.tp2, 8)}</strong></div>
        <div><b>TP2 TL</b><strong>{money(signal.tp2Tl)}</strong></div>
        <div><b>TP3 USDT</b><strong>{fmt(signal.tp3, 8)}</strong></div>
        <div><b>TP3 TL</b><strong>{money(signal.tp3Tl)}</strong></div>
      </div>
    </div>
  );
}

export default function App() {
  const [usdtry, setUsdtry] = useState(0);
  const [fxSource, setFxSource] = useState("-");
  const [limit, setLimit] = useState(400);
  const [minVolume, setMinVolume] = useState(RULE.minVolumeUsdt);
  const [candleLimit, setCandleLimit] = useState(300);
  const [selectedTfs, setSelectedTfs] = useState(["15m", "30m", "1h", "4h"]);
  const [status, setStatus] = useState("Hazır.");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [signals, setSignals] = useState([]);
  const stopRef = useRef(false);

  const longSignals = useMemo(() => signals.filter((s) => s.side === "LONG"), [signals]);
  const shortSignals = useMemo(() => signals.filter((s) => s.side === "SHORT"), [signals]);

  async function refreshFx() {
    const fx = await getUsdTry();
    setUsdtry(fx.rate);
    setFxSource(fx.source);
  }

  useEffect(() => {
    refreshFx();
    const timer = setInterval(refreshFx, 60000);
    return () => clearInterval(timer);
  }, []);

  function toggleTf(tf) {
    setSelectedTfs((prev) => prev.includes(tf) ? prev.filter((x) => x !== tf) : [...prev, tf]);
  }

  async function scan() {
    if (running) return;
    stopRef.current = false;
    setRunning(true); setDone(0); setTotal(0); setSignals([]);
    setStatus("Canlı USD/TRY alınıyor...");
    const fx = await getUsdTry();
    setUsdtry(fx.rate); setFxSource(fx.source);

    if (!fx.rate) { setStatus("USD/TRY canlı kur alınamadı."); setRunning(false); return; }
    if (!selectedTfs.length) { setStatus("En az bir time frame seç."); setRunning(false); return; }

    let symbols = [];
    try {
      setStatus("Binance aktif USDT pariteleri alınıyor...");
      symbols = await getSymbols(Number(limit), Number(minVolume));
    } catch (err) {
      setStatus("Binance sembol listesi alınamadı: " + err.message);
      setRunning(false);
      return;
    }

    const scanTotal = symbols.length * selectedTfs.length;
    setTotal(scanTotal);
    let localDone = 0;

    for (const symbol of symbols) {
      for (const tf of selectedTfs) {
        if (stopRef.current) { setStatus(`Durduruldu. Kontrol edilen: ${localDone}/${scanTotal}`); setRunning(false); return; }
        setStatus(`Taranıyor: ${symbol} ${tf} — ${localDone}/${scanTotal}`);
        try {
          const candles = await getKlines(symbol, tf, Number(candleLimit));
          const result = analyzeSymbol(symbol, tf, candles, fx.rate);
          if (result) setSignals((prev) => [...prev, result]);
        } catch {}
        localDone += 1;
        setDone(localDone);
        await sleep(90);
      }
    }
    setStatus("Tarama tamamlandı.");
    setRunning(false);
  }

  function stop() { stopRef.current = true; }
  function clear() { setSignals([]); setDone(0); setTotal(0); setStatus("Temizlendi."); }

  return (
    <div className="page">
      <style>{`
        :root{--bg:#070c1d;--card:#101832;--card2:#0b1228;--line:#293762;--text:#f4f7ff;--muted:#aeb9dc;--blue:#2f7df6}
        *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
        .page{max-width:1120px;margin:0 auto;padding:20px 14px 80px}
        .hero,.card{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:24px;padding:18px;margin:14px 0;box-shadow:0 12px 28px rgba(0,0,0,.22)}
        .hero{border:2px solid #f2ca61}.hero h1{font-size:32px;line-height:1.08;margin:0 0 8px;font-weight:950}.hero p{margin:0;color:var(--muted);font-weight:800}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        label{display:block;color:var(--muted);font-size:13px;font-weight:850;margin-bottom:6px}
        input{width:100%;background:#0a1127;color:#fff;border:1px solid var(--line);border-radius:16px;padding:13px;font-size:16px;font-weight:850}
        .tfbar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.tf{background:#0a1127;border:1px solid var(--line);border-radius:999px;padding:10px 13px;font-weight:950;color:#dce5ff;cursor:pointer}.tf.active{background:#17386f;border-color:#65a0ff}
        .btn{width:100%;border:1px solid #65a0ff;background:var(--blue);color:#fff;border-radius:20px;padding:17px 14px;font-size:21px;font-weight:950;cursor:pointer}.btn.secondary{background:#223052;border-color:#405582;margin-top:10px}.btn:disabled{opacity:.55}
        .dash{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:8px 0 16px}.dash div{background:#0a1127;border:1px solid var(--line);border-radius:17px;padding:11px;text-align:center}.dash b{display:block;font-size:22px}.dash span{display:block;color:var(--muted);font-size:12px;font-weight:850;margin-top:4px}
        .status{margin-top:12px;background:#101936;border:1px solid var(--line);border-radius:17px;padding:12px 14px;font-size:15px;font-weight:900;color:#dce5ff}.progress{height:13px;background:#0b1228;border:1px solid var(--line);border-radius:999px;overflow:hidden;margin:14px 0}.bar{height:100%;background:#2f7df6}
        .section{border-top:1px solid var(--line);padding-top:12px;margin-top:18px}.section.long h2{color:#76ffa8}.section.short h2{color:#ff95a6}
        .candidate{border:2px solid #0f944e;border-radius:23px;background:#0b1228;padding:17px;margin:13px 0}.candidate.short{border-color:#7d1d31}.candidateTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
        .symbol{font-size:27px;font-weight:950;line-height:1.08}.symbol span{color:var(--muted);font-size:18px}.reason{font-size:15px;line-height:1.42;color:#d3dcff;font-weight:850;margin-top:9px}
        .side{font-size:24px;font-weight:950;border-radius:18px;padding:11px 13px;min-width:88px;text-align:center}.side.long{background:#06451f;color:#76ffa8}.side.short{background:#551121;color:#ff95a6}
        .tags span{display:inline-block;border-radius:999px;padding:7px 10px;font-weight:950;font-size:12px;margin:8px 5px 5px 0;background:#202844;color:#c8d2f5}
        .metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:10px}.metrics div{background:#0a1127;border:1px solid var(--line);border-radius:17px;padding:13px}.metrics b{color:var(--muted);font-size:13px;font-weight:850;display:block}.metrics strong{font-size:18px;font-weight:950;margin-top:5px;display:block;word-break:break-word}
        .empty{color:var(--muted);font-weight:750}
        @media(max-width:760px){.grid2,.grid3,.dash,.metrics{grid-template-columns:1fr}.page{padding:14px 10px 70px}.hero h1{font-size:28px}.candidateTop{display:block}.side{margin-top:10px;display:inline-block}}
      `}</style>

      <div className="hero">
        <h1>Ayaz Trade — MACD RSI MA ATR</h1>
        <p>Binance canlı mum verisi + canlı USD/TRY. Güven skoru yok; sadece şartları tam geçen Long ve Short fırsatları listelenir.</p>
      </div>

      <div className="card">
        <div className="grid3">
          <div><label>Maksimum coin</label><input type="number" value={limit} min="10" max="450" onChange={(e) => setLimit(e.target.value)} /></div>
          <div><label>Minimum 24s hacim USDT</label><input type="number" value={minVolume} min="0" onChange={(e) => setMinVolume(e.target.value)} /></div>
          <div><label>Mum sayısı</label><input type="number" value={candleLimit} min="220" max="1000" onChange={(e) => setCandleLimit(e.target.value)} /></div>
        </div>

        <div className="tfbar">
          {TF_LIST.map((tf) => <button key={tf} className={`tf ${selectedTfs.includes(tf) ? "active" : ""}`} onClick={() => toggleTf(tf)} type="button">{tf === "1d" ? "Günlük" : tf}</button>)}
        </div>

        <button className="btn" onClick={scan} disabled={running}>{running ? "TARANIYOR..." : "TARAMAYI BAŞLAT"}</button>
        <div className="grid2">
          <button className="btn secondary" onClick={stop} type="button">DURDUR</button>
          <button className="btn secondary" onClick={clear} type="button">TEMİZLE</button>
        </div>

        <div className="progress"><div className="bar" style={{ width: total ? `${Math.min(100, (done / total) * 100)}%` : "0%" }} /></div>
        <div className="status">{status}</div>
      </div>

      <div className="dash">
        <div><b>{usdtry ? money(usdtry) : "-"}</b><span>USD/TRY {fxSource}</span></div>
        <div><b>{done}</b><span>Kontrol</span></div>
        <div><b>{total}</b><span>Toplam</span></div>
        <div><b>{longSignals.length}</b><span>Long</span></div>
        <div><b>{shortSignals.length}</b><span>Short</span></div>
      </div>

      <div className="card section long">
        <h2>LONG Şartlarını Geçenler</h2>
        {longSignals.length ? longSignals.map((signal, index) => <SignalCard key={`${signal.symbol}-${signal.tf}-${index}`} signal={signal} />) : <p className="empty">Henüz Long sinyali yok.</p>}
      </div>

      <div className="card section short">
        <h2>SHORT Şartlarını Geçenler</h2>
        {shortSignals.length ? shortSignals.map((signal, index) => <SignalCard key={`${signal.symbol}-${signal.tf}-${index}`} signal={signal} />) : <p className="empty">Henüz Short sinyali yok.</p>}
      </div>
    </div>
  );
}
