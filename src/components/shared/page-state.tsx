import type { ReactNode } from "react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import styles from "./page-state.module.css";

export function PageState({
  kind,
  title,
  description,
  action,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = kind === "loading" ? LoaderCircle : kind === "error" ? AlertTriangle : Inbox;
  return (
    <section className={styles.state} data-kind={kind} role={kind === "error" ? "alert" : "status"} aria-live={kind === "error" ? "assertive" : "polite"}>
      <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
      <div className={styles.copy}><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  );
}
