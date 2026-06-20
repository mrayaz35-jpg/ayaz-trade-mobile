# Serpaidias AI Trading Bot V2

Binance Futures için Freqtrade tabanlı long/short trading bot proje iskeleti.

## Ana amaç
Bu proje, GitHub'daki güçlü açık kaynak ekosistemi kullanarak profesyonel bir kripto trading bot altyapısı kurmak için hazırlandı.

## Kullanılan ana repolar / teknolojiler
- Freqtrade: ana bot motoru.
- CCXT: borsa bağlantısı; Freqtrade içinde kullanılır.
- smart-money-concepts: Smart Money Concepts fikirleri için dış paket alternatifi.
- pandas-ta-classic / TA-Lib: teknik analiz indikatörleri.
- Qlib / FinRL: ileri AI model geliştirme referansı.

## İçerik
```text
user_data/strategies/SerpaidiasHybridLongShortV2.py
user_data/configs/config_binance_futures_dry.json
user_data/configs/config_binance_futures_live_TEMPLATE.json
serpaidias_core/
scripts/
docs/
docker-compose.yml
Makefile
.env.example
```

## Hızlı kullanım

```bash
cp .env.example .env
./scripts/02_download_data.sh
./scripts/03_backtest.sh
./scripts/04_dry_run.sh
```

Docker kullanacaksan:

```bash
docker compose up -d
```

WebUI:

```text
http://127.0.0.1:8080
```

## Uyarı
Bu proje yatırım tavsiyesi değildir. Strateji kâr garantisi vermez. Önce backtest, sonra dry-run, sonra küçük sermaye testi yapılmalıdır.
