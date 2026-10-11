/** In-memory viewer sessions — max N devices can view at once. */

const HEARTBEAT_MS = 45_000;

class SessionManager {
  constructor(maxDevices = 3) {
    this.maxDevices = maxDevices;
    /** @type {Map<string, { deviceId: string, label: string, role: string, lastSeen: number }>} */
    this.sessions = new Map();
  }

  prune() {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.lastSeen > HEARTBEAT_MS) this.sessions.delete(id);
    }
  }

  list() {
    this.prune();
    return [...this.sessions.values()];
  }

  /**
   * Register or refresh a device. Viewers are capped; host/admin always allowed.
   */
  join({ deviceId, label, role = "viewer" }) {
    this.prune();
    if (!deviceId) {
      return { ok: false, error: "deviceId required" };
    }
    const existing = this.sessions.get(deviceId);
    if (existing) {
      existing.lastSeen = Date.now();
      existing.label = label || existing.label;
      existing.role = role || existing.role;
      return { ok: true, session: existing, devices: this.list() };
    }
    if (role !== "host") {
      const viewers = [...this.sessions.values()].filter((s) => s.role !== "host");
      if (viewers.length >= this.maxDevices) {
        return {
          ok: false,
          error: `View limit reached (${this.maxDevices} devices). Disconnect another device first.`,
          devices: this.list(),
        };
      }
    }
    const session = {
      deviceId,
      label: label || `Device ${this.sessions.size + 1}`,
      role,
      lastSeen: Date.now(),
    };
    this.sessions.set(deviceId, session);
    return { ok: true, session, devices: this.list() };
  }

  heartbeat(deviceId) {
    this.prune();
    const s = this.sessions.get(deviceId);
    if (!s) return { ok: false, error: "not registered" };
    s.lastSeen = Date.now();
    return { ok: true, session: s, devices: this.list() };
  }

  leave(deviceId) {
    this.sessions.delete(deviceId);
    return { ok: true, devices: this.list() };
  }
}

module.exports = { SessionManager, HEARTBEAT_MS };
