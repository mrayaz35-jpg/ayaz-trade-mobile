# Ayaz Trade — TAM REVİZE Binance Fix

Bu paket `Load failed` hatası için tamamen revize edildi.

## Düzeltmeler

- `App.jsx` içinde Binance tek endpoint değil, çoklu endpoint yedekli çalışır:
  - data-api.binance.vision
  - api1.binance.com
  - api2.binance.com
  - api3.binance.com
  - api.binance.com

- `update-crypto-data.js` ES Module uyumludur.
- `require()` yoktur.
- `import fs from "fs"` kullanır.

## Strateji

LONG:
- EMA9 > EMA21 > EMA50 > EMA200
- RSI > 55
- MACD çizgisi signal üstünde
- MACD histogram pozitif
- Hacim 20 mum ortalamasının üstünde

SHORT:
- EMA9 < EMA21 < EMA50 < EMA200
- RSI < 45
- MACD çizgisi signal altında
- MACD histogram negatif
- Hacim 20 mum ortalamasının üstünde

## Hedefler

- ATR(14)
- Stop = ATR x 1.5
- TP1 = Risk x 2
- TP2 = Risk x 3
- TP3 = Risk x 5

## Not

Güven skoru yoktur. Sadece şartları tam geçen coinler listelenir.
Gerçek emir açmaz.
