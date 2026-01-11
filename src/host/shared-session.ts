import type { FrameName } from './frame-types';

export type ActiveSurface = 'canvas' | 'frames' | 'metadata' | 'telemetry' | 'unknown';

export type PresenceState = {
  sessionId: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
  lastSeenAt: string;
  isLocal: boolean;
};

export type SharedSessionSnapshot = {
  sessionId: string;
  revision: number;
  updatedAt: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
  presence: Record<string, PresenceState>;
};

type SharedSessionUpdate = {
  sessionId: string;
  revision: number;
  updatedAt: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
};

export type SharedSessionEventDetail = {
  state: SharedSessionSnapshot;
  origin: 'local' | 'remote';
};

export const SHARED_SESSION_UPDATE_EVENT = 'SHARED_SESSION_UPDATE';

const CHANNEL_NAME = 'nuwa-shared-session';
// Presence rules: every session update refreshes presence; stale entries expire after the TTL.
const PRESENCE_TTL_MS = 60_000;

const createSessionId = () =>
  globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildPresenceEntry = (
  update: SharedSessionUpdate,
  isLocal: boolean
): PresenceState => ({
  sessionId: update.sessionId,
  activeFrame: update.activeFrame,
  selectionPath: update.selectionPath,
  activeSurface: update.activeSurface,
  lastSeenAt: update.updatedAt,
  isLocal,
});

const prunePresence = (presence: Record<string, PresenceState>) => {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(presence).filter(([, entry]) => {
      if (entry.isLocal) return true;
      return now - Date.parse(entry.lastSeenAt) <= PRESENCE_TTL_MS;
    })
  );
};

const shouldApplyUpdate = (incoming: SharedSessionUpdate, current: SharedSessionSnapshot) => {
  if (incoming.revision !== current.revision) {
    return incoming.revision > current.revision;
  }
  if (incoming.updatedAt !== current.updatedAt) {
    return Date.parse(incoming.updatedAt) > Date.parse(current.updatedAt);
  }
  return incoming.sessionId > current.sessionId;
};

export class SharedSession extends EventTarget {
  private channel?: BroadcastChannel;
  state: SharedSessionSnapshot;

  constructor(initial: { activeFrame: FrameName; selectionPath?: string; activeSurface: ActiveSurface }) {
    super();
    const sessionId = createSessionId();
    const updatedAt = new Date().toISOString();
    this.state = {
      sessionId,
      revision: 0,
      updatedAt,
      activeFrame: initial.activeFrame,
      selectionPath: initial.selectionPath,
      activeSurface: initial.activeSurface,
      presence: {
        [sessionId]: buildPresenceEntry(
          {
            sessionId,
            revision: 0,
            updatedAt,
            activeFrame: initial.activeFrame,
            selectionPath: initial.selectionPath,
            activeSurface: initial.activeSurface,
          },
          true
        ),
      },
    };
  }

  connect() {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.addEventListener('message', this.handleChannelMessage);
  }

  disconnect() {
    this.channel?.removeEventListener('message', this.handleChannelMessage);
    this.channel?.close();
    this.channel = undefined;
  }

  update(partial: Partial<Pick<SharedSessionSnapshot, 'activeFrame' | 'selectionPath' | 'activeSurface'>>) {
    const nextState = {
      activeFrame: partial.activeFrame ?? this.state.activeFrame,
      selectionPath:
        'selectionPath' in partial ? partial.selectionPath : this.state.selectionPath,
      activeSurface: partial.activeSurface ?? this.state.activeSurface,
    };

    const hasChanges =
      nextState.activeFrame !== this.state.activeFrame ||
      nextState.selectionPath !== this.state.selectionPath ||
      nextState.activeSurface !== this.state.activeSurface;

    if (!hasChanges) {
      return;
    }

    const update: SharedSessionUpdate = {
      sessionId: this.state.sessionId,
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
      ...nextState,
    };

    this.applyUpdate(update, 'local');
    this.channel?.postMessage(update);
  }

  private handleChannelMessage = (event: MessageEvent<SharedSessionUpdate>) => {
    const update = event.data;
    if (!update || update.sessionId === this.state.sessionId) {
      return;
    }
    this.applyUpdate(update, 'remote');
  };

  private applyUpdate(update: SharedSessionUpdate, origin: 'local' | 'remote') {
    const currentPresence = {
      ...this.state.presence,
      [update.sessionId]: buildPresenceEntry(update, update.sessionId === this.state.sessionId),
    };

    if (!shouldApplyUpdate(update, this.state)) {
      this.state = {
        ...this.state,
        presence: prunePresence(currentPresence),
      };
      return;
    }

    const nextPresence = prunePresence(currentPresence);
    if (!nextPresence[this.state.sessionId]) {
      nextPresence[this.state.sessionId] = buildPresenceEntry(
        {
          sessionId: this.state.sessionId,
          revision: this.state.revision,
          updatedAt: this.state.updatedAt,
          activeFrame: this.state.activeFrame,
          selectionPath: this.state.selectionPath,
          activeSurface: this.state.activeSurface,
        },
        true
      );
    }

    this.state = {
      ...this.state,
      revision: update.revision,
      updatedAt: update.updatedAt,
      activeFrame: update.activeFrame,
      selectionPath: update.selectionPath,
      activeSurface: update.activeSurface,
      presence: nextPresence,
    };

    this.dispatchEvent(
      new CustomEvent<SharedSessionEventDetail>(SHARED_SESSION_UPDATE_EVENT, {
        detail: { state: this.state, origin },
      })
    );
  }
}

export const createSharedSession = (initial: {
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
}) => new SharedSession(initial);
