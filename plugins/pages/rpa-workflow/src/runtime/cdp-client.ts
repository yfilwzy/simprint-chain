interface CdpPendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface CdpEventWaiter {
  method: string;
  sessionId?: string;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
}

interface CdpResponseEnvelope {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  method?: string;
  params?: unknown;
  sessionId?: string;
}

export class CdpClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, CdpPendingRequest>();
  private readonly eventWaiters = new Set<CdpEventWaiter>();

  async connect(wsUrl: string): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      this.socket = socket;

      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener(
        'error',
        () => reject(new Error('Failed to connect to CDP endpoint')),
        { once: true }
      );
      socket.addEventListener('message', (event) => this.handleMessage(event));
      socket.addEventListener('close', () => {
        this.socket = null;
        for (const [, pending] of this.pending) {
          pending.reject(new Error('CDP_CONNECTION_CLOSED'));
        }
        this.pending.clear();

        for (const waiter of this.eventWaiters) {
          window.clearTimeout(waiter.timeoutId);
          waiter.reject(new Error('CDP_CONNECTION_CLOSED'));
        }
        this.eventWaiters.clear();
      });
    });
  }

  async send<T>(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<T> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('CDP connection is not open');
    }

    const id = this.nextId++;
    const payload = {
      id,
      method,
      params,
      sessionId,
    };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket?.send(JSON.stringify(payload));
    });
  }

  async waitForEvent<T = unknown>(
    method: string,
    options?: { sessionId?: string; timeoutMs?: number }
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? 10000;

    return new Promise<T>((resolve, reject) => {
      const waiter: CdpEventWaiter = {
        method,
        sessionId: options?.sessionId,
        resolve,
        reject,
        timeoutId: window.setTimeout(() => {
          this.eventWaiters.delete(waiter);
          reject(new Error(`Timed out waiting for CDP event: ${method}`));
        }, timeoutMs),
      };

      this.eventWaiters.add(waiter);
    });
  }

  close(): void {
    this.socket?.close();
  }

  private handleMessage(event: MessageEvent<string>): void {
    let envelope: CdpResponseEnvelope;
    try {
      envelope = JSON.parse(event.data) as CdpResponseEnvelope;
    } catch {
      return;
    }

    if (typeof envelope.id !== 'number') {
      this.handleEvent(envelope);
      return;
    }

    const pending = this.pending.get(envelope.id);
    if (!pending) {
      return;
    }

    this.pending.delete(envelope.id);
    if (envelope.error) {
      pending.reject(new Error(envelope.error.message));
      return;
    }

    pending.resolve(envelope.result);
  }

  private handleEvent(envelope: CdpResponseEnvelope): void {
    if (typeof envelope.method !== 'string') {
      return;
    }

    for (const waiter of this.eventWaiters) {
      if (waiter.method !== envelope.method) {
        continue;
      }

      if (waiter.sessionId && waiter.sessionId !== envelope.sessionId) {
        continue;
      }

      this.eventWaiters.delete(waiter);
      window.clearTimeout(waiter.timeoutId);
      waiter.resolve(envelope.params);
      break;
    }
  }
}
