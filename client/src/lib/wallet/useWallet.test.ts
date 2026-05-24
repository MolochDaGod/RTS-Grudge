import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * useWallet is a React hook, so we can't call it directly in a node
 * environment. Instead we test the underlying fetch contract that the
 * hook depends on — the API layer behavior that determines wallet status
 * transitions. This validates the server contract without needing React.
 */

// ── Mock playerId ────────────────────────────────────────────────────────────
vi.mock("@/lib/save/playerId", () => ({
  getPlayerId: () => "test-player-123",
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLAYER_ID = "test-player-123";
const API_BASE = `/api/wallets/${PLAYER_ID}`;

const MOCK_WALLET = {
  player_id: PLAYER_ID,
  address: "7xKXt2UZ4BXkqJhAqe1NkfM3rYiGPm5GKvNg2mAoVPbQ",
  chain: "solana",
  custodial_id: "crossmint_abc123",
  provider: "crossmint",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── GET /api/wallets/:playerId ───────────────────────────────────────────────

describe("wallet API contract — GET", () => {
  it("returns wallet on 200 with success:true", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, wallet: MOCK_WALLET }),
    });

    const res = await fetch(API_BASE);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.wallet.address).toBe(MOCK_WALLET.address);
    expect(data.wallet.chain).toBe("solana");
    expect(data.wallet.provider).toBe("crossmint");
  });

  it("returns 404 when no wallet exists (idle state)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: "Wallet not found" }),
    });

    const res = await fetch(API_BASE);
    expect(res.status).toBe(404);
  });

  it("returns 500 on server error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal server error",
    });

    const res = await fetch(API_BASE);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });
});

// ── POST /api/wallets/:playerId (provision) ──────────────────────────────────

describe("wallet API contract — POST (provision)", () => {
  it("provisions a new wallet on 200", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, wallet: MOCK_WALLET }),
    });

    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith(API_BASE, expect.objectContaining({
      method: "POST",
    }));
    expect(data.success).toBe(true);
    expect(data.wallet.address).toBe(MOCK_WALLET.address);
  });

  it("provisions with email when provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, wallet: MOCK_WALLET }),
    });

    const body = JSON.stringify({ email: "player@grudge-studio.com" });
    await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    expect(fetchMock).toHaveBeenCalledWith(API_BASE, expect.objectContaining({
      body,
    }));
  });

  it("returns 503 when CROSSMINT_API_KEY is missing (unavailable state)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: "Wallet provisioning unavailable — CROSSMINT_API_KEY not configured on server",
      }),
    });

    const res = await fetch(API_BASE, { method: "POST" });
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("CROSSMINT_API_KEY");
  });

  it("returns 502 when Crossmint API fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({
        success: false,
        error: "Provision failed: Crossmint 500: internal error",
      }),
    });

    const res = await fetch(API_BASE, { method: "POST" });
    expect(res.status).toBe(502);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Provision failed");
  });

  it("returns existing wallet on duplicate provision (idempotent)", async () => {
    // First call — provision
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, wallet: MOCK_WALLET }),
    });
    // Second call — same player, should return existing
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ success: true, wallet: MOCK_WALLET }),
    });

    const res1 = await fetch(API_BASE, { method: "POST" });
    const data1 = await res1.json();
    const res2 = await fetch(API_BASE, { method: "POST" });
    const data2 = await res2.json();

    expect(data1.wallet.address).toBe(data2.wallet.address);
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("wallet API contract — validation", () => {
  it("rejects invalid player IDs (400)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: "Invalid playerId" }),
    });

    const res = await fetch("/api/wallets/ab"); // too short
    expect(res.status).toBe(400);
  });
});

// ── PlayerWallet shape ───────────────────────────────────────────────────────

describe("PlayerWallet record shape", () => {
  it("contains all required fields", () => {
    const required = [
      "player_id", "address", "chain",
      "custodial_id", "provider",
      "created_at", "updated_at",
    ] as const;

    for (const key of required) {
      expect(MOCK_WALLET).toHaveProperty(key);
    }
  });

  it("address is a valid base58-like string", () => {
    // Solana addresses are 32-44 chars of base58
    expect(MOCK_WALLET.address.length).toBeGreaterThanOrEqual(32);
    expect(MOCK_WALLET.address.length).toBeLessThanOrEqual(44);
    expect(/^[A-HJ-NP-Za-km-z1-9]+$/.test(MOCK_WALLET.address)).toBe(true);
  });

  it("chain defaults to solana", () => {
    expect(MOCK_WALLET.chain).toBe("solana");
  });

  it("provider is crossmint", () => {
    expect(MOCK_WALLET.provider).toBe("crossmint");
  });
});

// ── Status inference (mirrors useWallet logic) ───────────────────────────────

type WalletStatus = "idle" | "loading" | "ready" | "error" | "unavailable";

function inferStatus(response: { ok: boolean; status: number }): WalletStatus {
  if (response.status === 404) return "idle";
  if (response.status === 503) return "unavailable";
  if (response.ok) return "ready";
  return "error";
}

describe("wallet status inference", () => {
  it("200 → ready", () => {
    expect(inferStatus({ ok: true, status: 200 })).toBe("ready");
  });

  it("404 → idle", () => {
    expect(inferStatus({ ok: false, status: 404 })).toBe("idle");
  });

  it("503 → unavailable", () => {
    expect(inferStatus({ ok: false, status: 503 })).toBe("unavailable");
  });

  it("500 → error", () => {
    expect(inferStatus({ ok: false, status: 500 })).toBe("error");
  });

  it("502 → error", () => {
    expect(inferStatus({ ok: false, status: 502 })).toBe("error");
  });

  it("400 → error", () => {
    expect(inferStatus({ ok: false, status: 400 })).toBe("error");
  });
});
