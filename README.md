# Ayaz Trade v34.0 — Scientific ATR Stop + Target Motoru

Bu sürüm v33 sonrası stop ve hedef hesaplamasını bilimsel/teknik formüle bağlar.

Ana değişiklikler:
- ATR, Wilder/RMA True Range 14 ile hesaplanır.
- Stop, yapısal invalidasyon seviyesi + ATR tampon üzerinden hesaplanır.
- Stop yapay şekilde genişletilmez; risk ATR veya yüzde eşiğinin altında kalırsa aday elenir.
- LONG stop destek/demand/tetik mum low altında; SHORT stop direnç/supply/tetik mum high üstünde olmak zorundadır.
- TP1/TP2/TP3 gerçek swing, destek/direnç ve likidite alanlarına göre hesaplanır.
- En yakın gerçek hedef 1R vermiyorsa hedef uydurulmaz; aday elenir.
- Backtest canlıdaki aynı strateji, aynı entry, aynı stop ve aynı hedef mantığını test eder.
- Skor ve izleme yoktur; yalnızca trade edilebilir ilk 10 LONG + ilk 10 SHORT listelenir.
