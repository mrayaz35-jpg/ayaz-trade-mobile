# Ayaz Trade v24.0 — Trade Edilebilir 10/10 Skorsuz

Bu sürümde izleme listesi yoktur. Sistem yalnızca **trade edilebilir ilk 10 LONG** ve **trade edilebilir ilk 10 SHORT** adayını gösterir.

## Ana mantık

- Skor/puan yoktur.
- Mevcut grafikte hangi strateji geçiyorsa, backtest aynı strateji adını ve aynı teknik kapıyı geçmiş mumlarda arar.
- Bağlam tek başına yeterli değildir; strateji + canlı teknik kalite + aynı-strateji backtest sağlığı birlikte geçmelidir.

## Trade edilebilir kapı

Aday listeye girmek için:

- Üst zaman dilimi bağlamı geçmeli.
- BOS/CHOCH veya yapı kırılımı olmalı.
- Destek/direnç, trend çizgisi, mum veya likidite bağı kurulmalı.
- EMA/RSI/MACD/ADX/DI/hacim kuralları yeterli olmalı.
- Aynı stratejinin backtestinde yeterli işlem, win, PF, Net R, TP2 ve hızlı stop şartları geçmeli.

## Link

GitHub Pages repo adı `ayaz-trade-mobile` ise uygulama linki:

https://mrayaz35-jpg.github.io/ayaz-trade-mobile/
