import Image from "next/image";
import styles from "./logo.module.css";

export function JarvisLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.logo} aria-label="JARVIS Swap">
      <span className={styles.mark}>
        <Image src="/brand/jarvis-logo-light.jpeg" alt="" width={38} height={38} priority />
      </span>
      {!compact && (
        <span className={styles.wordmark} aria-hidden="true">
          <strong>JARVIS</strong>
          <strong>SWAP</strong>
        </span>
      )}
    </span>
  );
}

export function JarvisTokenIcon({ size = 34 }: { size?: number }) {
  return (
    <span className={styles.tokenIcon} style={{ width: size, height: size }}>
      <Image src="/brand/jarvis-logo-light.jpeg" alt="JARVIS token" width={size} height={size} />
    </span>
  );
}
