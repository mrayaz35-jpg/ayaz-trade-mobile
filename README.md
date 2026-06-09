# Ayaz Trade v42.0 — Professional Quality Gate Engine

Bu revize, 2000 taramada yalnızca 2 aday çıkmasına rağmen adayların kalite açısından zayıf kalması sorununu düzeltmek için hazırlandı.

## Ana değişiklik
- Trade / Adaptif Aday / Teyit Bekler / Elendi ayrımı.
- PF < 1 veya NetR negatif ise aday Trade olmaz.
- İşlem sayısı düşükse Backtest güçlü değil, düşük örneklem sayılır.
- Hacim x0.50 altı kritik zayıf kabul edilir.
- Yapı teyidi yoksa aday Trade değil, en fazla Adaptif/Teyit Bekler olur.
- 7 LONG + 7 SHORT liste hedefi korunur: gerçek Trade azsa kalanlar açıkça Adaptif Aday olarak gösterilir.

## Açılış
https://mrayaz35-jpg.github.io/ayaz-trade-mobile/?v=42-final-1
