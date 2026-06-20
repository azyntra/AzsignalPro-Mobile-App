import { create } from 'zustand';
import { Platform } from 'react-native';

export interface Signal {
  id: string;
  bot_signal_id: string;
  symbol: string;
  exchange: string;
  market_type: string;
  style: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  entry_low: number;
  entry_high: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp1_pct: number;
  tp2_pct: number;
  tp3_pct: number;
  stop_loss: number;
  risk_pct: number;
  rr_ratio: number;
  leverage: number;
  price_at_signal: number;
  reasons_json: string;
  indicators_json: string;
  ai_decision: string;
  ai_adjusted_conf: number;
  ai_reasoning: string;
  created_at: string;
  outcome?: string;
  profit_pct?: number;
}

interface SignalState {
  signals: Signal[];
  isConnected: boolean;
  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  updateSignal: (signal: Signal) => void;
  connect: () => void;
  disconnect: () => void;
}

const localWsUrl = Platform.OS === 'android' ? 'ws://10.0.2.2:3000' : 'ws://localhost:3000';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || localWsUrl;
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

export const useSignalStore = create<SignalState>((set, get) => ({
  signals: [],
  isConnected: false,

  setSignals: (signals) => set({ signals }),

  addSignal: (signal) => set((state) => {
    // Avoid duplicates
    if (state.signals.find(s => s.id === signal.id)) return state;
    return { signals: [signal, ...state.signals] };
  }),

  updateSignal: (updatedSignal) => set((state) => ({
    signals: state.signals.map(s => s.id === updatedSignal.id ? updatedSignal : s)
  })),

  connect: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimer) clearTimeout(reconnectTimer);

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      set({ isConnected: true });
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'signal.new') {
          get().addSignal(payload.data);
        } else if (payload.type === 'signal.update') {
          get().updateSignal(payload.data);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      set({ isConnected: false });
      ws = null;
      // Reconnect after 3s
      reconnectTimer = setTimeout(() => {
        get().connect();
      }, 3000);
    };

    ws.onerror = (e) => {
      // handled by onclose
    };
  },

  disconnect: () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null; // prevent reconnection
      ws.close();
      ws = null;
    }
    set({ isConnected: false });
  }
}));
