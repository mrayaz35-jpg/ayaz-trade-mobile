# Ayaz Trade v23.0 — Kripto Bağlam Motoru Skorsuz

Bu paket, v22 teknik kapı sürümünden sonra skor/puan mantığı kaldırılarak hazırlanmıştır.

## Ana değişiklik
- Sayısal skor, rankScore ve puan kutusu kaldırıldı.
- Adaylar “kaç puan aldı” diye değil, geçtiği net teknik bağlama göre listelenir.
- Motor sırası: trend → üst zaman bağlamı → BOS/CHOCH → destek/direnç → trend çizgisi → mum formasyonu → likidite sweep/reclaim → EMA/RSI/MACD/ADX/DI/hacim → backtest sağlığı.

## Strateji bağlamları
- Trend devam LONG/SHORT
- Destek/direnç pullback LONG/SHORT
- Bullish/Bearish CHOCH dönüş
- Trend çizgisi kırılımı
- Likidite reclaim/sweep
- Range kırılımı

## Sıralama mantığı
Sıralama puanla yapılmaz. Öncelik sırası objektif şartlarla belirlenir:
1. Bağlam durumu: TAM BAĞLAM / UYGUN BAĞLAM
2. Strateji türü
3. Backtest işlem sayısı
4. Profit factor
5. Net R
6. Win oranı
7. TP2 oranı
8. Daha düşük stop yüzdesi ve daha taze veri

Bu uygulama eğitim/test amaçlıdır; gerçek emir göndermez.
