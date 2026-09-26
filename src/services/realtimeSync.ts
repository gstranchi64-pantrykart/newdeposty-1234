// Real-Time Synchronization Service
// Combines Server-Sent Events (SSE), Browser BroadcastChannel, and Custom DOM events
// Ensures multi-tab and real-time live data propagation across all open screens

type RealtimeListener = (event: { entity?: string; action?: string; timestamp: number }) => void;

class RealtimeSyncManager {
  private listeners: Set<RealtimeListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;
  private isConnected: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initBroadcastChannel();
      this.initEventSource();
    }
  }

  private initBroadcastChannel() {
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('pantrymaster_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'DATA_MUTATED') {
            this.emit(event.data);
          }
        };
      }
    } catch (e) {
      console.warn('[RealtimeSync] BroadcastChannel not supported:', e);
    }
  }

  private initEventSource() {
    if (typeof window === 'undefined') return;
    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource('/api/events');

      this.eventSource.onopen = () => {
        this.isConnected = true;
      };

      this.eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.type === 'DATABASE_MUTATION') {
            this.emit({
              entity: parsed.entity,
              action: parsed.action,
              timestamp: parsed.timestamp || Date.now(),
            });
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.initEventSource();
        }, 5000);
      };
    } catch (e) {
      console.warn('[RealtimeSync] SSE connection error:', e);
    }
  }

  private emit(event: { entity?: string; action?: string; timestamp: number }) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RealtimeSync] Error in listener:', err);
      }
    }
    // Also dispatch window custom event
    try {
      window.dispatchEvent(new CustomEvent('pantrymaster:livedatachanged', { detail: event }));
    } catch {}
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notifyMutation(entity: string, action: string = 'UPDATE', data?: any) {
    const event = {
      type: 'DATA_MUTATED',
      entity,
      action,
      data,
      timestamp: Date.now(),
    };

    // Broadcast across browser tabs
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch {}
    }

    // Trigger local listeners
    this.emit({ entity, action, timestamp: event.timestamp });
  }

  public getStatus(): boolean {
    return this.isConnected;
  }
}

export const realtimeSync = new RealtimeSyncManager();
