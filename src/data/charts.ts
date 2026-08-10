import type { ChartPoint, TimeRange } from "@/types/charts";

// Illustrative local seed data. Live analytics adapters can replace this without changing the chart component.
export const SWAP_VOLUME: Record<TimeRange, ChartPoint[]> = {
  "24H": [120,128,126,140,136,149,155,151,167,175,171,186].map((value, i) => ({ timestamp: i, value: value * 10_000, label: `${i * 2}:00` })),
  "7D": [1.1,1.3,1.2,1.55,1.48,1.72,1.84].map((value, i) => ({ timestamp: i, value: value * 1_000_000, label: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i] })),
  "30D": [3.8,4.1,4.0,4.4,4.8,4.6,5.2,5.0,5.5,5.9].map((value, i) => ({ timestamp: i, value: value * 1_000_000, label: `W${i + 1}` })),
  "90D": [9.2,10.1,10.8,11.4,12.7,13.3,14.1,15.6,16.2,17.8,18.9,20.3].map((value, i) => ({ timestamp: i, value: value * 1_000_000, label: `P${i + 1}` })),
};
