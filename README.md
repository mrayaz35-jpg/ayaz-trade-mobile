# MACD RSI MA Crypto Scanner

Binance canlı mum verisiyle USDT paritelerinde çoklu zaman dilimi Long/Short taraması yapan; Entry, Stop ve TP seviyelerini hem USDT hem canlı TL karşılığıyla gösteren dashboard.

## Karar mantığı

Bu uygulamada güven skoru, trade skoru, yüzde veya puanlama yoktur.

Sistem yalnızca strateji şartlarının tamamını geçen coinleri listeler. Şartları tam sağlamayan coinler ekranda gösterilmez. Güven skoru, trade skoru, yüzde veya puanlama yoktur.


## Canlı veri ve TL dönüşümü

Bu sürümde iki canlı veri zorunludur:

1. Coin taraması Binance canlı mum verisi ile yapılır.
2. USD/TRY dönüşümü canlı kurla yapılır.

Kur alma sırası:

- Önce Binance `USDTTRY` canlı fiyatı denenir.
- Alınamazsa Binance çapraz kur: `BTCTRY / BTCUSDT` denenir.
- O da alınamazsa harici USD/TRY yedek servisi denenir.

Tabloda şu alanlar yan yana gösterilir:

- Entry USDT / Entry TL
- Stop USDT / Stop TL
- TP1 USDT / TP1 TL
- TP2 USDT / TP2 TL
- TP3 USDT / TP3 TL
- ATR USDT / ATR TL

Backend canlı kur endpointi:

```bash
GET /api/usdtry
```

Tarama endpointi canlı kur bilgisini sonuçla beraber döndürür:

```bash
GET /api/scan?intervals=15m,30m,1h,2h,4h,1d&limit=400
```

## Strateji

Uygulamada ARES yoktur. MAD yoktur. Ana omurga:

- MACD 12 / 26 / 9
- RSI 14 momentum filtresi
- EMA 9 / EMA 21 / EMA 50 / EMA 200 trend filtresi
- ATR 14 risk, stop ve hedef hesaplama
- Hacim filtresi

## Long şartları

- EMA9 > EMA21 > EMA50
- Fiyat EMA50 üzerinde
- RSI 50 üzerinde ve yukarı eğimli
- MACD çizgisi signal çizgisinin üzerinde
- MACD histogramı pozitif ve güçleniyor
- Hacim filtresi uygun

## Short şartları

- EMA9 < EMA21 < EMA50
- Fiyat EMA50 altında
- RSI 50 altında ve aşağı eğimli
- MACD çizgisi signal çizgisinin altında
- MACD histogramı negatif ve zayıflıyor
- Hacim filtresi uygun

## Time frame desteği

Tek butonla şu zaman dilimleri beraber taranabilir:

- 15m
- 30m
- 1h
- 2h
- 4h
- 1d

Frontend tarafında checkbox ile seçilir. Backend `/api/scan?intervals=15m,30m,1h,2h,4h,1d` formatını destekler.

## Hedef ve stop mantığı

ATR Wilder yöntemiyle hesaplanır.

Long için:

- Entry: son kapanış
- Stop: ATR tabanlı ve son 36 mum yapısal destek dikkate alınarak hesaplanır
- TP1: risk x 2
- TP2: risk x 3 veya güçlü trendde geniş hedef
- TP3: risk x 5 veya güçlü trendde geniş hedef

Short için aynı mantığın ters yönlü versiyonu kullanılır.

Risk/ödül:

- RR1: TP1 / Stop riski
- RR2: TP2 / Stop riski
- RR3: TP3 / Stop riski

## Kurulum

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Varsayılan backend adresi:

```bash
http://localhost:4000
```

## Not

Bu ilk sürüm gerçek işlem açmaz. Sadece şartları geçen sinyalleri, hedefleri, stopları, USDT/TL karşılıklarını ve risk/ödül planını üretir. Gerçek emir modülü eklenmeden önce backtest ve paper trade yapılmalıdır.
