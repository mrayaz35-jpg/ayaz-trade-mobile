import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function SignalTable({ title, rows, side }) {
  return (
    <section className={`card ${side.toLowerCase()}`}>
      <h2>{title} <span>{rows.length}</span></h2>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Coin</th>
              <th>TF</th>
              <th>Durum</th>
              <th>Entry USDT</th>
              <th>Entry TL</th>
              <th>Stop USDT</th>
              <th>Stop TL</th>
              <th>TP1 USDT</th>
              <th>TP1 TL</th>
              <th>TP2 USDT</th>
              <th>TP2 TL</th>
              <th>TP3 USDT</th>
              <th>TP3 TL</th>
              <th>ATR USDT</th>
              <th>ATR TL</th>
              <th>RSI</th>
              <th>MACD Hist.</th>
              <th>R/R1</th>
              <th>R/R2</th>
              <th>Neden</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.symbol}-${r.side}-${r.interval}`}>
                <td className="symbol">{r.symbol}</td>
                <td>{r.interval}</td>
                <td>{r.status}</td>
                <td>{r.entry}</td>
                <td className="try">₺{r.entryTry}</td>
                <td>{r.stop}</td>
                <td className="try">₺{r.stopTry}</td>
                <td>{r.tp1}</td>
                <td className="try">₺{r.tp1Try}</td>
                <td>{r.tp2}</td>
                <td className="try">₺{r.tp2Try}</td>
                <td>{r.tp3}</td>
                <td className="try">₺{r.tp3Try}</td>
                <td>{r.atr}</td>
                <td className="try">₺{r.atrTry}</td>
                <td>{r.rsi}</td>
                <td>{r.macdHistogram}</td>
                <td>{r.rr1}</td>
                <td>{r.rr2}</td>
                <td className="reasons">{r.reasons.join(' • ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function App() {
  const [intervals, setIntervals] = useState(['15m', '30m', '1h', '2h', '4h', '1d']);
  const [limit, setLimit] = useState(120);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function scan() {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const queryIntervals = intervals.join(',');
      const res = await fetch(`${API_URL}/api/scan?intervals=${queryIntervals}&limit=${limit}`);
      if (!res.ok) throw new Error('Canlı veri taraması başarısız oldu');
      setData(await res.json());
    } catch (err) {
      setError(err.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <div>
          <h1>MACD RSI MA Crypto Scanner</h1>
          <p>Binance canlı mum verisi + canlı USD/TRY kuru ile şartları geçen Long/Short sinyalleri.</p>
        </div>
      </header>

      <section className="controls">
        <div className="timeframes">
          <span>Zaman Dilimleri</span>
          {['15m', '30m', '1h', '2h', '4h', '1d'].map((tf) => (
            <label key={tf} className="check">
              <input
                type="checkbox"
                checked={intervals.includes(tf)}
                onChange={(e) => {
                  setIntervals((current) => {
                    if (e.target.checked) return [...new Set([...current, tf])];
                    const next = current.filter((x) => x !== tf);
                    return next.length ? next : current;
                  });
                }}
              />
              {tf}
            </label>
          ))}
        </div>
        <label>
          Coin Sayısı
          <input type="number" min="20" max="450" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <button onClick={scan} disabled={loading}>{loading ? 'Canlı taranıyor...' : 'Canlı Tara'}</button>
      </section>

      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <section className="summary">
            <div><b>{data.scanned}</b><span>Taranan</span></div>
            <div><b>{data.found}</b><span>Şartları geçen</span></div>
            <div><b>{data.long.length}</b><span>Long</span></div>
            <div><b>{data.short.length}</b><span>Short</span></div>
            <div><b>{data.intervals?.join(', ')}</b><span>Time frame</span></div>
            <div><b>₺{data.usdTry}</b><span>Canlı USD/TRY - {data.usdTrySource}</span></div>
          </section>
          <SignalTable title="Long Şartlarını Geçenler" rows={data.long} side="LONG" />
          <SignalTable title="Short Şartlarını Geçenler" rows={data.short} side="SHORT" />
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
