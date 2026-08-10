"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useMobile } from "@/hooks/mobile";
import { useDialogA11y } from "@/hooks/use-dialog";
import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { MobileDock } from "./mobile-dock";
import { SystemStatusBanner } from "./system-status-banner";
import styles from "./shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const mobile = useMobile();

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => { if (!mobile && menu) setMenu(false); }, [mobile, menu]);
  const drawerRef = useDialogA11y<HTMLDivElement>(menu, () => setMenu(false));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header onMenu={() => setMenu(true)} />
      <SystemStatusBanner />
      <div className="app-main">
        <Sidebar />
        <main id="main-content" className="page-content" tabIndex={-1}>{children}<Footer /></main>
      </div>
      <MobileDock />
      {menu && (
        <div className={styles.drawerBackdrop} onMouseDown={() => setMenu(false)} role="presentation">
          <div ref={drawerRef} tabIndex={-1} className={styles.drawerPanel} role="dialog" aria-modal="true" aria-label="Navigation" onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation()}><button className={styles.drawerClose} onClick={() => setMenu(false)} aria-label="Close navigation"><X size={18} /></button><Sidebar mobile onNavigate={() => setMenu(false)} /></div>
        </div>
      )}
    </div>
  );
}
