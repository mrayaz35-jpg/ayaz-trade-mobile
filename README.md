# Ayaz Trade — MACD RSI MA ATR

React tabanlı kripto tarayıcı.

## İçerik

- `App.jsx`
- `update-crypto-data.js`
- `.github/workflows/update-market.yml`
- `data/market.json`
- `README.md`

## Strateji

### LONG
- EMA9 > EMA21
- EMA21 > EMA50
- EMA50 > EMA200
- RSI > 55
- MACD çizgisi signal üstünde
- MACD histogram pozitif
- Son hacim 20 mum ortalamasının üstünde

### SHORT
- EMA9 < EMA21
- EMA21 < EMA50
- EMA50 < EMA200
- RSI < 45
- MACD çizgisi signal altında
- MACD histogram negatif
- Son hacim 20 mum ortalamasının üstünde

## ATR Hedefler

LONG:
- Entry = son kapanış
- Stop = Entry - ATR x 1.5
- TP1 = Entry + Risk x 2
- TP2 = Entry + Risk x 3
- TP3 = Entry + Risk x 5

SHORT:
- Entry = son kapanış
- Stop = Entry + ATR x 1.5
- TP1 = Entry - Risk x 2
- TP2 = Entry - Risk x 3
- TP3 = Entry - Risk x 5

## Not

Güven skoru yoktur. Sadece şartları tam geçen coinler gösterilir.
Uygulama gerçek emir açmaz.
