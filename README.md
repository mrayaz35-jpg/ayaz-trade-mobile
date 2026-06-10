# Ayaz Trade — MACD RSI MA ATR

Bu revize pakette `update-crypto-data.js` ES Module uyumludur.

## Hata düzeltmesi

Repo `package.json` içinde `"type": "module"` olduğu için CommonJS `require()` hata veriyordu.

Bu paket içinde:

```js
import fs from "fs";
import path from "path";
```

kullanıldı.

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

Güven skoru yoktur.
