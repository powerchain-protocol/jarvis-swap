"use client";

import { Search } from "lucide-react";
import styles from "./transaction-filters.module.css";

export type TxFilters = { status: string; query: string };

export function TransactionFilters({ value, onChange }: { value: TxFilters; onChange: (value: TxFilters) => void }) {
  return (
    <div className={styles.filters}>
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <input
          className="field-input"
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          placeholder="Search digest or token"
          aria-label="Search transactions"
        />
      </label>
      <select className="field-input" value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })} aria-label="Filter transaction status">
        <option value="all">All statuses</option>
        <option value="confirmed">Confirmed</option>
        <option value="failed">Failed</option>
      </select>
    </div>
  );
}
