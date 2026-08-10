"use client";

import { useMemo } from "react";
import type { ChartPoint } from "@/types/charts";
import { formatCompact } from "@/utils/formats";
import styles from "@/components/shared/market.module.css";

export function VolumeChart({ points }: { points: ChartPoint[] }) {
  const polyline = useMemo(() => {
    if (!points.length) return "";
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(1, max - min);
    return points.map((point, index) => {
      const x = points.length === 1 ? 400 : (index / (points.length - 1)) * 800;
      const y = 185 - ((point.value - min) / spread) * 150;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [points]);
  const latest = points.at(-1)?.value ?? 0;
  return <div>
    <div className={styles.chartValue}><strong>{formatCompact(latest)}</strong><span>latest volume bucket</span></div>
    <svg className={styles.chart} viewBox="0 0 800 210" preserveAspectRatio="none" role="img" aria-label="Swap volume trend">
      <line x1="0" y1="50" x2="800" y2="50"/><line x1="0" y1="105" x2="800" y2="105"/><line x1="0" y1="160" x2="800" y2="160"/>
      <polyline points={polyline}/>
    </svg>
    <div className={styles.chartLabels}>{points.filter((_, index) => index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2)).map((point) => <span key={`${point.timestamp}-${point.label}`}>{point.label}</span>)}</div>
  </div>;
}
