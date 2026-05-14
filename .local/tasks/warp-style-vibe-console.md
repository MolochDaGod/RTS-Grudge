# Warp-style VIBE console + puter.js

## What & Why
The in-app VIBE assistant currently feels like a generic chat sidebar. Rework it into a Warp-inspired terminal/console with command blocks, an inline command palette, and agent-action blocks, available from both the editor (Admin Panel) and the running game. At the same time, wire puter.js in as a first-class option for both the LLM backend (`puter.ai.chat`) and chat/history storage (`puter.fs`), so the assistant can run with no API keys and persist sessions to the user's Puter drive.

The "skill" we're borrowing from Warp is its UX pattern, not its source code: clone `https://github.com/warpdotdev/warp.git` into `.local/research/warp/` purely as read-only reference material, distill the relevant patterns into a short notes doc, and apply them to our VIBE console. We do not vendor or ship any Warp code — Warp is a native Rust terminal and is not redistributable as a dependency here.

## Done looks like
- Opening VIBE in the Admin Panel shows a terminal-style console: each user prompt and assistant response is its own collapsible "block" with timestamp, status (running / ok / error), and per-block actions (copy, re-run, share, delete).
- `vibe-edit` and `vibe-scene` actions render as their own labeled agent blocks inside the transcript (not inline code fences), with a clear diff/summary, an Apply / Revert button, and live status while running — matching Warp's "agent step" feel.
- A command palette opens with `Ctrl/Cmd+K` from anywhere the console is mounted, offering: model picker, provider picker, slash-commands (`/scene`, `/edit`, `/clear`, `/save`, `/load`, `/help`), recent prompts, and saved "workflows" (reusable prompt templates).
- Inline suggestions: as the user types, show ghost-text completions from recent prompts and saved workflows; Tab accepts.
- The same console is reachable in-game via a hotkey (default backtick `` ` ``), sliding down as a translucent overlay that pauses input capture for the game while focused, and closes on Escape.
- Provider list includes **Puter** as an option; selecting it routes chat through `puter.ai.chat` in the browser with no server API key required, and streams tokens into the active block.
- Chat history can be saved to and loaded from Puter cloud storage (`puter.fs`) under a `vibe/sessions/` folder; sessions list shows name, date, model used, and message count. Local fallback continues to work when the user is not signed into Puter.
- The system prompt and tone are revised: shorter, more direct, action-oriented (Warp Agent style) — fewer hedges, clearer plan/apply structure, and explicit block markers so the UI can render agent steps reliably.
- A short `docs/vibe-console.md` explains the hotkeys, slash-commands, providers, and how Puter sign-in/storage works.

## Out of scope
- Replacing the existing OpenRouter / MegaLLM / AgentRouter / Routeway providers — Puter is added alongside them.
- Building a real shell/PTY inside the app. The "terminal" is purely a visual + interaction metaphor for the AI console; no arbitrary shell command execution.
- Porting any Warp Rust source. Warp is reference only.
- Changing in-game NPC dialogue AI or Meshy 3D generation flows.
- Multiplayer / shared sessions across users.

## Steps
1. **Research & notes.** Shallow-clone Warp into `.local/research/warp/` (gitignored), skim its block, command-palette, agent, and workflow UX, and write a short `.local/research/warp-notes.md` summarizing the patterns we'll mirror (blocks, palette, suggestions, workflows, agent steps, keybinds). No Warp code is copied into the app.

2. **Console UI shell.** Replace the current VIBE chat layout with a block-based transcript component: each entry is a Block with header (role, model, timestamp, status), body (markdown / streamed tokens / agent step), and footer actions. Style with a monospace-forward, dark "warp" theme that still fits the existing Admin Panel.

3. **Agent step blocks.** Detect `vibe-edit` and `vibe-scene` payloads in the stream and render them as dedicated agent-step blocks with file/object summary, diff or action list, status pill, and Apply / Revert controls wired to the existing `/api/ai-edit` and `useEditorStore` paths. Auto-Edit / Auto-Scene toggles still apply.

4. **Command palette + slash commands.** Add a `Ctrl/Cmd+K` palette (and `/` trigger inside the input) listing model picker, provider picker, slash-commands, recent prompts, and saved workflows. Add ghost-text inline suggestions from history and workflows; Tab to accept.

5. **In-game overlay.** Mount the same console as a top-down sliding overlay in `GameScene`, toggled by backtick. While focused: suspend keyboard controls used by gameplay, dim the world slightly, restore on close. Reuse the Admin Panel's console component — do not fork it.

6. **Puter as LLM provider.** Add a `puter` provider that runs in the browser using `puter.ai.chat` with streaming, model selection (the models Puter exposes), and graceful fallback when the user is not signed in. Surface it in the provider picker alongside the existing options. Server-side `chatWithFallback` is left unchanged for non-Puter providers.

7. **Puter storage for sessions.** Persist chat sessions to `puter.fs` under `vibe/sessions/{id}.json` with metadata (title, createdAt, model, provider, messageCount). Add Save / Load / Rename / Delete from the palette and a sessions list view. When the user is not signed into Puter, fall back to localStorage and offer a one-click "Sign in to Puter to sync" affordance.

8. **System-prompt + tone pass.** Tighten `GAME_SYSTEM_PROMPT` and the assistant's response style: shorter preambles, explicit plan → action → result structure, mandatory block markers for edits/scene actions, fewer hedges. Keep all existing engine context injection (config, scene, source exports).

9. **Docs.** Write `docs/vibe-console.md` covering hotkeys, slash-commands, providers (including Puter sign-in), session save/load, and the agent-step Apply / Revert flow.

## Relevant files
- `client/src/admin/VibeChat.tsx`
- `client/src/admin/AdminPanel.tsx`
- `client/src/game/GameScene.tsx`
- `client/src/game/editor/EditorStore.ts`
- `client/src/lib/auth/puter.ts`
- `client/src/lib/save/puterStorage.ts`
- `client/src/App.tsx`
- `client/src/main.tsx`
- `server/routes.ts`
