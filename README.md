# Ayaz Trade v28.0 — Closed Candle + Wilder + Structural Stop Motoru

Bu sürüm v27 sonrası çekirdek teknik hesap motorunu revize eder.

## Ana değişiklikler

- Sadece kapanmış mumla analiz yapılır; Binance'ın açık son mumu sinyal ve backtest dışında bırakılır.
- ATR, RSI ve DMI/ADX hesapları TradingView'e daha yakın Wilder/RMA mantığına çekildi.
- Stop en uzak dip/tepe yerine en yakın mantıklı yapısal invalidasyon seviyesi + 0.20 ATR tamponla hesaplanır.
- Kırılım-Retest ve Kırılım-Onay ayrıldı.
- Backtest, canlıda geçen stratejinin aynısını aynı giriş-stop-hedef planıyla test eder.
- Skor ve izleme yoktur; yalnızca trade edilebilir ilk 10 LONG + ilk 10 SHORT görünür.

## Dosyalar

- `index.html`
- `script-v28-0-crypto400-closed-wilder-engine.js`
- `update-crypto-data.js`

## Yayın

GitHub Pages repo köküne bu dosyaları yükleyin. Uygulama linki aynı kalır:

`https://mrayaz35-jpg.github.io/ayaz-trade-mobile/`
