export type TimeRange = "24H" | "7D" | "30D" | "90D";
export type ChartMetric = "portfolio-value" | "volume" | "liquidity" | "fees" | "price" | "transactions";
export type ChartUnit = "USD" | "token" | "count" | "percent";
export type ChartPoint = { timestamp: number; value: number; label: string };
export type ChartSeries = { id: string; label: string; unit: ChartUnit; metric?: ChartMetric; points: ChartPoint[] };
export type ChartState = { range: TimeRange; loading: boolean; stale: boolean; updatedAt?: number };
