import { eq } from "drizzle-orm";
import { db } from "./db";
import { playerWallets, type PlayerWallet } from "@shared/schema";

const CROSSMINT_BASE =
  process.env.CROSSMINT_BASE_URL ||
  (process.env.CROSSMINT_ENV === "production" || process.env.VITE_CROSSMINT_ENV === "production"
    ? "https://www.crossmint.com"
    : "https://staging.crossmint.com");
const CROSSMINT_CHAIN = process.env.CROSSMINT_CHAIN || "solana";

export type WalletRecord = PlayerWallet;

export async function getWallet(playerId: string): Promise<WalletRecord | null> {
  const rows = await db.select().from(playerWallets)
    .where(eq(playerWallets.playerId, playerId))
    .limit(1);
  return rows[0] ?? null;
}

interface CrossmintWalletResponse {
  id?: string;
  address?: string;
  publicKey?: string;
  chain?: string;
}

async function createCrossmintWallet(playerId: string, email?: string): Promise<{
  address: string;
  custodialId: string | null;
}> {
  const apiKey = process.env.CROSSMINT_API_KEY || process.env.CROSSMINT_SERVER_API_KEY;
  if (!apiKey) throw new Error("CROSSMINT_API_KEY or CROSSMINT_SERVER_API_KEY not set");

  const linkedUser = email ? `email:${email}` : `userId:${playerId}`;
  const url = `${CROSSMINT_BASE}/api/2022-06-09/wallets`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ type: "solana-mpc-wallet", linkedUser }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Crossmint ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as CrossmintWalletResponse;
  const address = data.address || data.publicKey || "";
  if (!address) throw new Error("Crossmint response missing address");
  return { address, custodialId: data.id ?? null };
}

export async function getOrCreateWallet(
  playerId: string,
  email?: string,
): Promise<WalletRecord> {
  const existing = await getWallet(playerId);
  if (existing) return existing;

  const { address, custodialId } = await createCrossmintWallet(playerId, email);

  await db.insert(playerWallets).values({
    playerId,
    address,
    chain: CROSSMINT_CHAIN,
    custodialId,
    provider: "crossmint",
  }).onDuplicateKeyUpdate({
    set: { address, custodialId },
  });

  const fresh = await getWallet(playerId);
  if (!fresh) throw new Error("Wallet vanished immediately after insert");
  return fresh;
}
