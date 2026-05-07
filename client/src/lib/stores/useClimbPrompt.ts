import { create } from "zustand";

// Tiny store that mirrors two pieces of climb-controller state into
// React land so the HUD can render the "Press Space to climb" prompt
// reactively without polling.
//
// `near` is written by the climb sensor proximity tracker
// (see `nearClimbable.ts::publish`) — true whenever the player's
// capsule is inside the trigger volume of a climbable wall or ladder.
//
// `climbing` is written by the climb controller in Player.tsx — true
// from the frame the mount latches until dismount / topout. We keep
// it separate from `near` because the sensor often stays engaged
// while the player is mid-climb, and the prompt should hide in that
// case (otherwise it would read as if the action hadn't happened).
interface ClimbPromptState {
  near: boolean;
  climbing: boolean;
  setNear: (near: boolean) => void;
  setClimbing: (climbing: boolean) => void;
}

export const useClimbPrompt = create<ClimbPromptState>((set) => ({
  near: false,
  climbing: false,
  setNear: (near: boolean) => set({ near }),
  setClimbing: (climbing: boolean) => set({ climbing }),
}));
