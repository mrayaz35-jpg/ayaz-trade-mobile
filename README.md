# Ayaz Trade v29.0 — Dengeli Closed Candle + Wilder Trade Plan Motoru

Bu sürüm V28'in teknik doğruluk çekirdeğini korur: sadece kapanmış mum, Wilder ATR/RSI/ADX-DI, yapısal stop, Kırılım-Retest ve Kırılım-Onay ayrımı.

V29'da yapılan ana revize:

- Örneklem aşırı daralmasın diye backtest kapısı dengelendi.
- Hacim/gövde kapısı korunur ama sadece ham volume oranına takılıp iyi gövdeli kırılımı boğmaz.
- TP2 alan eşiği 1.25R seviyesine dengelendi.
- Minimum backtest işlem eşiği TF'ye göre dengelendi.
- Skor ve izleme yoktur; yalnızca trade edilebilir ilk 10 LONG + ilk 10 SHORT gösterilir.
- Canlıda hangi strateji geçiyorsa backtestte de aynı strateji, aynı giriş-stop-hedef mantığıyla test edilir.


## v29 index fix
Bu paket index.html içinde v29 JavaScript motorunu çağırır. Eski v28 script referansı temizlenmiştir.
