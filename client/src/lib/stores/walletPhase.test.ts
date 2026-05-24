import { describe, it, expect, beforeEach } from "vitest";
import { useGame } from "./useGame";

// ── Zustand store direct access (no React needed) ────────────────────────────
// The zustand store exposes getState/setState for testing outside of React.

describe("useGame — wallet phase integration", () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useGame.setState({ phase: "menu" });
  });

  it("goToWallet sets phase to 'wallet'", () => {
    useGame.getState().goToWallet();
    expect(useGame.getState().phase).toBe("wallet");
  });

  it("wallet phase persists until another navigation occurs", () => {
    useGame.getState().goToWallet();
    expect(useGame.getState().phase).toBe("wallet");

    // Phase should still be wallet after arbitrary state updates
    useGame.setState({ score: 999 });
    expect(useGame.getState().phase).toBe("wallet");
  });

  it("can navigate from wallet to home", () => {
    useGame.getState().goToWallet();
    expect(useGame.getState().phase).toBe("wallet");

    useGame.getState().goToHome();
    expect(useGame.getState().phase).toBe("home");
  });

  it("can navigate from wallet to characterSelect", () => {
    useGame.getState().goToWallet();
    useGame.getState().goToCharacterSelect();
    expect(useGame.getState().phase).toBe("characterSelect");
  });

  it("can navigate from home to wallet", () => {
    useGame.getState().goToHome();
    expect(useGame.getState().phase).toBe("home");

    useGame.getState().goToWallet();
    expect(useGame.getState().phase).toBe("wallet");
  });

  it("restart from wallet goes back to menu", () => {
    useGame.getState().goToWallet();
    useGame.getState().restart();
    expect(useGame.getState().phase).toBe("menu");
  });

  it("wallet phase does not affect gameplay state", () => {
    // Set some gameplay state
    useGame.setState({
      phase: "playing",
      score: 42,
      wave: 3,
      level: 5,
    });

    // Navigate to wallet
    useGame.getState().goToWallet();
    expect(useGame.getState().phase).toBe("wallet");
    // Gameplay state should be preserved
    expect(useGame.getState().score).toBe(42);
    expect(useGame.getState().wave).toBe(3);
    expect(useGame.getState().level).toBe(5);
  });
});

// ── GamePhase type coverage ──────────────────────────────────────────────────
// These tests verify that "wallet" is a valid GamePhase value by exercising
// every navigation action that produces a canonical URL phase.

describe("useGame — all navigable phases", () => {
  const PHASE_ACTIONS: Array<{ name: string; action: () => void; expected: string }> = [
    { name: "goToHome",            action: () => useGame.getState().goToHome(),            expected: "home" },
    { name: "goToCharacterSelect", action: () => useGame.getState().goToCharacterSelect(), expected: "characterSelect" },
    { name: "goToAdmin",           action: () => useGame.getState().goToAdmin(),           expected: "admin" },
    { name: "goToGGE",             action: () => useGame.getState().goToGGE(),             expected: "gge" },
    { name: "goToController",      action: () => useGame.getState().goToController(),      expected: "controller" },
    { name: "goToCombat2d",        action: () => useGame.getState().goToCombat2d(),        expected: "combat2d" },
    { name: "goToIslandV2",        action: () => useGame.getState().goToIslandV2(),        expected: "islandV2" },
    { name: "goToWallet",          action: () => useGame.getState().goToWallet(),          expected: "wallet" },
  ];

  for (const { name, action, expected } of PHASE_ACTIONS) {
    it(`${name} sets phase to "${expected}"`, () => {
      useGame.setState({ phase: "menu" });
      action();
      expect(useGame.getState().phase).toBe(expected);
    });
  }
});
