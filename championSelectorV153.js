/*
V15.3 İçerik Bazlı Şampiyon Kadro Seçici
Long/Short adaylarını renk, tür, etiket veya sinyal çeşidine göre değil,
yalnızca içerik kalitesiyle elemek ve sıralamak için hazırlanmıştır.

Final 7 = kaliteli izleme/kadro listesi.
İşlem açılabilir = Final 7 + canlı icra kapısından geçmiş aday.
*/

const STATUS = Object.freeze({
  DATA_ERROR: "VERİ HATASI",
  MATH_VETO: "MATEMATİK VETO",
  OUT_OF_POOL: "HAVUZ DIŞI",
  POOL_CANDIDATE: "HAVUZ ADAYI",
  FINAL_CANDIDATE: "FİNAL ADAYI",
  FINAL_7: "FİNAL 7",
  WAIT_EXECUTION: "İCRA BEKLİYOR",
  CAN_TRADE: "İŞLEM AÇILABİLİR",
  LATE: "GEÇ KALDI",
  STOP_TOUCHED: "STOP GÖRDÜ",
  RISKY: "RİSKLİ",
  SPOT_SHORT_WARNING: "SPOTTA SHORT DEĞİL"
});

const DEFAULTS = Object.freeze({
  stopPctHardTolerance: 0.60,
  stopPctWarnTolerance: 0.30,

  minTp1R: 0.40,
  minTp2R: 1.25,
  minTp3R: 1.60,

  preferredTp2R: 1.50,
  preferredTp3R: 2.00,

  minTrades: 35,
  minWinRate: 45,
  minProfitFactor: 1.80,
  minBacktestScore: 75,
  minDataScore: 85,
  maxFastStop: 28,

  preferredTrades: 50,
  preferredWinRate: 50,
  preferredProfitFactor: 2.00,
  preferredBacktestScore: 80,
  preferredDataScore: 90,
  preferredFastStop: 23,

  maxSignalAgeBarsForTrade: 2,
  staleSignalBars: 3,

  maxEntryDistanceR: 0.25,
  minStopDistanceR: 0.35,

  highRCheck: 5,
  highPfCheck: 5
});

function parseNumber(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

  let s = String(value)
    .trim()
    .replace(/USDT|TRY|TL|USD|%/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^\d.,-]/g, "");

  if (!s) return NaN;

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  if (commaCount && dotCount) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (commaCount) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const p = Math.pow(10, digits);
  return Math.round(value * p) / p;
}

function normalizeDirection(direction) {
  const d = String(direction || "").trim().toUpperCase();
  if (d.includes("LONG")) return "LONG";
  if (d.includes("SHORT") || d.includes("ŞORT")) return "SHORT";
  return d;
}

function getCandidateNumbers(c) {
  return {
    entry: parseNumber(c.entry ?? c.giris ?? c.giriş),
    stop: parseNumber(c.stop),
    tp1: parseNumber(c.tp1 ?? c.TP1),
    tp2: parseNumber(c.tp2 ?? c.TP2),
    tp3: parseNumber(c.tp3 ?? c.TP3),
    shownStopPct: parseNumber(c.stopPct ?? c.stopPercent ?? c.stopYuzde ?? c.stopYüzde),
    trades: parseNumber(c.trades ?? c.islem ?? c.işlem),
    winRate: parseNumber(c.winRate ?? c.win ?? c.winPct),
    profitFactor: parseNumber(c.profitFactor ?? c.pf ?? c.PF),
    fastStop: parseNumber(c.fastStop ?? c.hizliStop ?? c.hızlıStop),
    backtestScore: parseNumber(c.backtestScore ?? c.backtest),
    dataScore: parseNumber(c.dataScore ?? c.veri),
    signalAgeBars: parseNumber(c.signalAgeBars ?? c.signalAge ?? c.tetikMum ?? c.mumOnceTetik),
    livePrice: parseNumber(c.livePrice ?? c.price ?? c.fiyat)
  };
}

function evaluateCandidate(candidate, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const direction = normalizeDirection(candidate.direction ?? candidate.yon ?? candidate.yön ?? candidate.side);
  const n = getCandidateNumbers(candidate);

  const result = {
    symbol: candidate.symbol ?? candidate.parite ?? candidate.name ?? "",
    timeframe: candidate.timeframe ?? candidate.tf ?? "",
    direction,
    status: STATUS.POOL_CANDIDATE,
    vetoReasons: [],
    warnings: [],
    metrics: {},
    qualityScore: null,
    raw: candidate
  };

  if (!["LONG", "SHORT"].includes(direction)) {
    result.status = STATUS.DATA_ERROR;
    result.vetoReasons.push("Yön LONG veya SHORT değil");
    return result;
  }

  for (const key of ["entry", "stop", "tp1", "tp2", "tp3"]) {
    if (!Number.isFinite(n[key]) || n[key] <= 0) {
      result.status = STATUS.DATA_ERROR;
      result.vetoReasons.push(`Eksik/geçersiz fiyat verisi: ${key}`);
    }
  }
  if (result.vetoReasons.length) return result;

  let risk, stopPct, tp1R, tp2R, tp3R;

  if (direction === "LONG") {
    if (!(n.stop < n.entry)) result.vetoReasons.push("LONG için stop girişin altında değil");
    if (!(n.tp1 > n.entry)) result.vetoReasons.push("LONG için TP1 girişin üstünde değil");
    if (!(n.tp2 > n.tp1)) result.vetoReasons.push("LONG için TP2, TP1'in üstünde değil");
    if (!(n.tp3 > n.tp2)) result.vetoReasons.push("LONG için TP3, TP2'nin üstünde değil");

    risk = n.entry - n.stop;
    stopPct = (risk / n.entry) * 100;
    tp1R = (n.tp1 - n.entry) / risk;
    tp2R = (n.tp2 - n.entry) / risk;
    tp3R = (n.tp3 - n.entry) / risk;
  }

  if (direction === "SHORT") {
    if (!(n.stop > n.entry)) result.vetoReasons.push("SHORT için stop girişin üstünde değil");
    if (!(n.tp1 < n.entry)) result.vetoReasons.push("SHORT için TP1 girişin altında değil");
    if (!(n.tp2 < n.tp1)) result.vetoReasons.push("SHORT için TP2, TP1'in altında değil");
    if (!(n.tp3 < n.tp2)) result.vetoReasons.push("SHORT için TP3, TP2'nin altında değil");

    risk = n.stop - n.entry;
    stopPct = (risk / n.entry) * 100;
    tp1R = (n.entry - n.tp1) / risk;
    tp2R = (n.entry - n.tp2) / risk;
    tp3R = (n.entry - n.tp3) / risk;
  }

  if (result.vetoReasons.length || !Number.isFinite(risk) || risk <= 0) {
    result.status = STATUS.MATH_VETO;
    return result;
  }

  result.metrics = {
    entry: n.entry,
    stop: n.stop,
    tp1: n.tp1,
    tp2: n.tp2,
    tp3: n.tp3,
    risk: round(risk, 10),
    realStopPct: round(stopPct, 4),
    tp1R: round(tp1R, 4),
    tp2R: round(tp2R, 4),
    tp3R: round(tp3R, 4)
  };

  if (Number.isFinite(n.shownStopPct)) {
    const stopDiff = Math.abs(n.shownStopPct - stopPct);
    result.metrics.stopPctDiff = round(stopDiff, 4);
    if (stopDiff > cfg.stopPctHardTolerance) {
      result.status = STATUS.DATA_ERROR;
      result.vetoReasons.push("Ekrandaki stop yüzdesi ile gerçek stop yüzdesi uyumsuz");
      return result;
    }
    if (stopDiff > cfg.stopPctWarnTolerance) {
      result.warnings.push("Stop yüzdesi tolerans sınırında");
    }
  }

  if (tp1R < cfg.minTp1R) result.vetoReasons.push("TP1_R minimum standardın altında");
  if (tp2R < cfg.minTp2R) result.vetoReasons.push("TP2_R minimum standardın altında");
  if (tp3R < cfg.minTp3R) result.vetoReasons.push("TP3_R minimum standardın altında");

  if (result.vetoReasons.length) {
    result.status = STATUS.MATH_VETO;
    return result;
  }

  const trades = Number.isFinite(n.trades) ? n.trades : 0;
  const winRate = Number.isFinite(n.winRate) ? n.winRate : 0;
  const pf = Number.isFinite(n.profitFactor) ? n.profitFactor : 0;
  const fastStop = Number.isFinite(n.fastStop) ? n.fastStop : 999;
  const backtestScore = Number.isFinite(n.backtestScore) ? n.backtestScore : 0;
  const dataScore = Number.isFinite(n.dataScore) ? n.dataScore : 0;
  const signalAgeBars = Number.isFinite(n.signalAgeBars) ? n.signalAgeBars : 0;

  result.metrics.trades = trades;
  result.metrics.winRate = winRate;
  result.metrics.profitFactor = pf;
  result.metrics.fastStop = fastStop;
  result.metrics.backtestScore = backtestScore;
  result.metrics.dataScore = dataScore;
  result.metrics.signalAgeBars = signalAgeBars;

  if (trades < cfg.minTrades) result.vetoReasons.push("İşlem sayısı yetersiz");
  if (winRate < cfg.minWinRate) result.vetoReasons.push("Win oranı zayıf");
  if (pf < cfg.minProfitFactor) result.vetoReasons.push("PF zayıf");
  if (fastStop > cfg.maxFastStop) result.vetoReasons.push("Hızlı stop çok yüksek");
  if (backtestScore < cfg.minBacktestScore) result.vetoReasons.push("Backtest skoru zayıf");
  if (dataScore < cfg.minDataScore) result.vetoReasons.push("Veri skoru zayıf");

  if (result.vetoReasons.length) {
    result.status = STATUS.OUT_OF_POOL;
    return result;
  }

  if (fastStop > cfg.preferredFastStop) result.warnings.push("Hızlı stop riskli sınıfta");
  if (tp2R > cfg.highRCheck) result.warnings.push("Aşırı yüksek R: dar stop/veri şişmesi kontrol edilmeli");
  if (pf > cfg.highPfCheck) result.warnings.push("Çok yüksek PF: overfit, spread ve slippage kontrol edilmeli");
  if (signalAgeBars >= cfg.staleSignalBars) result.warnings.push("Sinyal yaşlanmış; işlem açma kapısı geçilmemeli");

  result.status = STATUS.FINAL_CANDIDATE;

  // İçerik bazlı kalite sıralaması.
  // Sinyal türü, renk veya etiket bu puana dahil edilmez.
  result.qualityScore =
    100
    + Math.min(tp2R, 3.0) * 8
    + Math.min(tp3R, 4.0) * 4
    + Math.min(pf, 5.0) * 6
    + winRate * 0.35
    + Math.min(trades, 100) * 0.15
    + backtestScore * 0.25
    + dataScore * 0.15
    - fastStop * 0.80
    - Math.max(signalAgeBars, 0) * 4;

  result.qualityScore = round(result.qualityScore, 2);
  return result;
}

function selectFinalSeven(candidates, direction, options = {}) {
  const dir = normalizeDirection(direction);
  return (Array.isArray(candidates) ? candidates : [])
    .map(c => evaluateCandidate(c, options))
    .filter(r => r.direction === dir)
    .filter(r => r.status === STATUS.FINAL_CANDIDATE)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 7)
    .map((r, index) => ({ ...r, rank: index + 1, status: STATUS.FINAL_7 }));
}

function executionGate(candidate, livePriceInput, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const c = candidate.raw ? candidate.raw : candidate;
  const direction = normalizeDirection(c.direction ?? c.yon ?? c.yön ?? c.side);
  const n = getCandidateNumbers(c);
  const livePrice = parseNumber(livePriceInput ?? n.livePrice);

  if (!["LONG", "SHORT"].includes(direction)) {
    return { canTrade: false, label: STATUS.DATA_ERROR, reason: "Yön geçersiz" };
  }
  if (!Number.isFinite(livePrice) || livePrice <= 0) {
    return { canTrade: false, label: STATUS.DATA_ERROR, reason: "Canlı fiyat eksik/geçersiz" };
  }

  const entry = n.entry;
  const stop = n.stop;
  let risk, distanceFromEntryR, distanceToStopR;

  if (direction === "LONG") {
    risk = entry - stop;
    if (!Number.isFinite(risk) || risk <= 0) {
      return { canTrade: false, label: STATUS.DATA_ERROR, reason: "Risk hesabı geçersiz" };
    }
    if (livePrice <= stop) {
      return { canTrade: false, label: STATUS.STOP_TOUCHED, reason: "Fiyat stop seviyesine değmiş veya altına inmiş" };
    }
    distanceFromEntryR = Math.abs(livePrice - entry) / risk;
    distanceToStopR = (livePrice - stop) / risk;
  }

  if (direction === "SHORT") {
    risk = stop - entry;
    if (!Number.isFinite(risk) || risk <= 0) {
      return { canTrade: false, label: STATUS.DATA_ERROR, reason: "Risk hesabı geçersiz" };
    }
    if (livePrice >= stop) {
      return { canTrade: false, label: STATUS.STOP_TOUCHED, reason: "Fiyat stop seviyesine değmiş veya üstüne çıkmış" };
    }
    distanceFromEntryR = Math.abs(livePrice - entry) / risk;
    distanceToStopR = (stop - livePrice) / risk;
  }

  const signalAgeBars = Number.isFinite(n.signalAgeBars) ? n.signalAgeBars : 0;

  if (signalAgeBars > cfg.maxSignalAgeBarsForTrade) {
    return {
      canTrade: false,
      label: STATUS.LATE,
      reason: "Sinyal yaşlanmış",
      metrics: { distanceFromEntryR: round(distanceFromEntryR, 4), distanceToStopR: round(distanceToStopR, 4), signalAgeBars }
    };
  }

  if (distanceFromEntryR > cfg.maxEntryDistanceR) {
    return {
      canTrade: false,
      label: STATUS.LATE,
      reason: "Fiyat giriş bölgesinden fazla uzaklaşmış",
      metrics: { distanceFromEntryR: round(distanceFromEntryR, 4), distanceToStopR: round(distanceToStopR, 4), signalAgeBars }
    };
  }

  if (distanceToStopR < cfg.minStopDistanceR) {
    return {
      canTrade: false,
      label: STATUS.RISKY,
      reason: "Fiyat stop bölgesine fazla yaklaşmış",
      metrics: { distanceFromEntryR: round(distanceFromEntryR, 4), distanceToStopR: round(distanceToStopR, 4), signalAgeBars }
    };
  }

  return {
    canTrade: true,
    label: STATUS.CAN_TRADE,
    reason: "Final 7 + canlı icra kapısı geçti",
    metrics: { distanceFromEntryR: round(distanceFromEntryR, 4), distanceToStopR: round(distanceToStopR, 4), signalAgeBars }
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    STATUS,
    DEFAULTS,
    parseNumber,
    evaluateCandidate,
    selectFinalSeven,
    executionGate
  };
}
