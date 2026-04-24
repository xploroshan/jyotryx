/**
 * Pure forecasting math — no Prisma, no Nest, no side effects. Exported
 * separately from the service so unit tests can pin the numbers without
 * constructing a full DI graph.
 *
 * We implement the trend-only Holt smoothing (not the full Holt-Winters
 * seasonal variant) because our daily LLM cost series doesn't have a
 * strong seasonal component at the 30-day window we forecast over.
 * Seasonality would need 7-day or 30-day periods and a much longer
 * history to fit stably; the trend model is honest about what we can
 * actually learn from the data.
 *
 *   level_t  = alpha * y_t       + (1 - alpha) * (level_{t-1} + trend_{t-1})
 *   trend_t  = beta  * (level_t - level_{t-1}) + (1 - beta)  * trend_{t-1}
 *   forecast_{t+h} = level_t + h * trend_t
 *
 * Alpha/beta defaults come from the Hyndman/Athanasopoulos textbook
 * recommendation for short-ish daily series: smooth enough to shrug
 * off a single noisy day but responsive enough to track a real trend
 * shift within a week.
 */

export interface HoltForecastResult {
  level: number;
  trend: number;
  /** Forecasted values for horizons 1..horizonDays, clipped at 0. */
  forecast: number[];
  /** Single-sigma residual standard deviation — used for a confidence band. */
  residualStd: number;
}

export function holtForecast(
  history: number[],
  horizonDays: number,
  alpha = 0.3,
  beta = 0.1,
): HoltForecastResult {
  const horizon = Math.max(0, Math.floor(horizonDays));

  if (history.length === 0) {
    return { level: 0, trend: 0, forecast: new Array(horizon).fill(0), residualStd: 0 };
  }
  if (history.length === 1) {
    return {
      level: history[0],
      trend: 0,
      forecast: new Array(horizon).fill(Math.max(0, history[0])),
      residualStd: 0,
    };
  }

  // Seed: level starts at y_0, trend is the first difference. Both
  // initialisations are standard and mean the forecast is exactly the
  // first observation when history has length 1.
  let level = history[0];
  let trend = history[1] - history[0];
  const fitted: number[] = [history[0]];

  for (let t = 1; t < history.length; t++) {
    const prevLevel = level;
    level = alpha * history[t] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level);
  }

  const forecast: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(Math.max(0, level + h * trend));
  }

  // Residuals for a rough 1-σ band. Dropping the first point because
  // the fitted value there is just the seed.
  let sumSq = 0;
  let n = 0;
  for (let t = 1; t < history.length; t++) {
    const err = history[t] - fitted[t];
    sumSq += err * err;
    n++;
  }
  const residualStd = n > 0 ? Math.sqrt(sumSq / n) : 0;

  return { level, trend, forecast, residualStd };
}

/**
 * Linear regression over a numeric series. Returns the slope and
 * intercept so a caller can extrapolate or compute "days until X".
 * Uses the index as the x-axis — callers are responsible for passing
 * the series in the right order (oldest → newest).
 */
export function linearTrend(series: number[]): { slope: number; intercept: number } {
  const n = series.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: series[0] };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += series[i];
    sumXY += i * series[i];
    sumXX += i * i;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: series[0] };
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * "At the current growth rate, how many days until `current` crosses
 * `limit`?" Negative / zero slope returns `Infinity` (never hits at
 * this rate). Used for the OpenAI TPM capacity forecast. Rounded to
 * the nearest whole day so the UI doesn't have to.
 */
export function daysUntilLimit(current: number, slopePerDay: number, limit: number): number {
  if (!Number.isFinite(slopePerDay) || slopePerDay <= 0) return Infinity;
  if (current >= limit) return 0;
  return Math.round((limit - current) / slopePerDay);
}
