import type { RealtimeConnectionInfo, RealtimeEnvelope, RealtimeState, RealtimeTopic } from "@/types/realtime";
import { parseRealtimeEnvelope } from "./validation";

export type RealtimeSocketOptions = {
  url: string;
  protocols?: string | string[];
  minReconnectMs?: number;
  maxReconnectMs?: number;
  heartbeatMs?: number;
  maxAttempts?: number;
};

type Listener<T> = (value: T) => void;

export class RealtimeSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private manuallyClosed = false;
  private attempts = 0;
  private readonly messageListeners = new Set<Listener<RealtimeEnvelope>>();
  private readonly stateListeners = new Set<Listener<RealtimeConnectionInfo>>();
  private readonly lastSequenceByTopic = new Map<RealtimeTopic, number>();
  private info: RealtimeConnectionInfo = { state: "idle", attempts: 0, lastConnectedAt: null, lastMessageAt: null, error: null };

  constructor(private readonly options: RealtimeSocketOptions) {}

  subscribe(listener: Listener<RealtimeEnvelope>) {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onState(listener: Listener<RealtimeConnectionInfo>) {
    this.stateListeners.add(listener);
    listener(this.info);
    return () => this.stateListeners.delete(listener);
  }

  connect() {
    if (typeof window === "undefined" || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    this.manuallyClosed = false;
    this.setState(this.attempts ? "reconnecting" : "connecting");

    try {
      this.socket = new WebSocket(this.options.url, this.options.protocols);
    } catch (error) {
      this.scheduleReconnect(error instanceof Error ? error.message : "WebSocket creation failed.");
      return;
    }

    this.socket.addEventListener("open", () => {
      this.attempts = 0;
      this.info = { ...this.info, state: "open", attempts: 0, lastConnectedAt: Date.now(), error: null };
      this.emitState();
      this.startHeartbeat();
    });

    this.socket.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      if (!raw || raw.length > 256 * 1024) return;
      try {
        const parsed = parseRealtimeEnvelope(JSON.parse(raw));
        if (!parsed) return;
        if (parsed.topic && parsed.sequence != null) {
          const previous = this.lastSequenceByTopic.get(parsed.topic);
          if (previous != null && parsed.sequence <= previous) return;
          this.lastSequenceByTopic.set(parsed.topic, parsed.sequence);
        }
        this.info = { ...this.info, lastMessageAt: Date.now() };
        this.emitState();
        for (const listener of this.messageListeners) listener(parsed);
      } catch {
        // Ignore malformed/untrusted frames rather than poisoning realtime state.
      }
    });

    this.socket.addEventListener("error", () => this.setError("Realtime connection error."));
    this.socket.addEventListener("close", () => {
      this.stopHeartbeat();
      this.socket = null;
      if (this.manuallyClosed) this.setState("closed");
      else this.scheduleReconnect("Realtime connection closed.");
    });
  }

  send(data: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(typeof data === "string" ? data : JSON.stringify(data));
    return true;
  }

  close() {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    this.socket?.close(1000, "Client closed");
    this.socket = null;
    this.lastSequenceByTopic.clear();
    this.setState("closed");
  }

  private scheduleReconnect(error: string) {
    this.attempts += 1;
    const maxAttempts = this.options.maxAttempts ?? Number.POSITIVE_INFINITY;
    if (this.attempts > maxAttempts) {
      this.info = { ...this.info, state: "error", attempts: this.attempts, error };
      this.emitState();
      return;
    }
    const min = this.options.minReconnectMs ?? 750;
    const max = this.options.maxReconnectMs ?? 15_000;
    const random = new Uint32Array(1);
    globalThis.crypto?.getRandomValues?.(random);
    const jitter = random[0] % 250;
    const delay = Math.min(max, min * 2 ** Math.min(this.attempts - 1, 6)) + jitter;
    this.info = { ...this.info, state: "reconnecting", attempts: this.attempts, error };
    this.emitState();
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    const interval = this.options.heartbeatMs ?? 25_000;
    if (interval <= 0) return;
    this.heartbeatTimer = setInterval(() => this.send({ type: "ping", timestamp: Date.now() }), interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private setState(state: RealtimeState) {
    this.info = { ...this.info, state, attempts: this.attempts };
    this.emitState();
  }

  private setError(error: string) {
    this.info = { ...this.info, error };
    this.emitState();
  }

  private emitState() {
    for (const listener of this.stateListeners) listener(this.info);
  }
}
