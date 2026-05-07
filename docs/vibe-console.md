# VIBE Console

VIBE is the in-engine AI agent for the Grudge Game Engine. It runs as a
Warp-style terminal-flavoured console that's available in two places:

- **Admin Panel → VIBE AI tab** (or the side-dock VIBE button)
- **In-game overlay** — press `` ` `` (backtick) anywhere in the game

Both surfaces mount the **same** component (`client/src/admin/vibe/VibeConsole.tsx`),
so any improvement to one shows up in the other.

## Anatomy

Each user prompt and assistant response is a self-contained **block** in the
transcript with:

- a header (role, model, status pill, timestamp)
- a body (the response text, with code/scene action fences extracted)
- a footer with **collapse / copy / share / re-run / delete** per block
  (Share uses the Web Share API when available and falls back to copying
  a markdown snippet to the clipboard)

When the assistant emits a `vibe-edit` or `vibe-scene` fence, it renders as
its own labelled **agent step block** *inside* the assistant block — not as
an inline code fence — with a diff/summary, a status pill (queued → running
→ ok / error), and `Apply` / `Revert` buttons.

## Hotkeys

| Key                | Action                                  |
| ------------------ | --------------------------------------- |
| `` ` `` (backtick) | Toggle in-game console overlay          |
| `Esc`              | Close palette / overlay                 |
| `Ctrl/Cmd + K`     | Open command palette                    |
| `Ctrl/Cmd + L`     | Clear transcript                        |
| `Enter`            | Send prompt                             |
| `Shift + Enter`    | Newline                                 |
| `Tab`              | Accept ghost-text suggestion            |
| `↑` / `↓`          | Recall previous / next prompt (when input is empty) |

## Slash commands

Type `/` as the first character to use one of these:

- `/scene <prompt>` — request a scene mutation
- `/edit <prompt>` — request a source edit
- `/clear` — clear the transcript
- `/save [name]` — save the current session
- `/load` — open the sessions list
- `/help` — show all commands
- `/model <name>` — switch active model
- `/provider <name>` — switch active provider

## Command palette

`Ctrl/Cmd + K` opens a fuzzy search palette with sections for:

- Slash commands
- Models (across all providers)
- Providers
- Workflows (reusable prompt templates)
- Recent prompts (your last ~30)

Picking a model/provider sets it as active. Picking a workflow or recent
prompt drops it into the input ready to edit and run.

Typing `/` as the first character of the input also opens the palette,
pre-filtered to slash commands — pick one with the mouse or keep typing
to narrow the list. Closing the input's slash dismisses the palette.

### Saving your own workflows

Type a prompt you want to reuse, open the palette (`Ctrl/Cmd + K`), and
click **+ save current** in the **Your workflows** section. Give it a
name — it's stored in `localStorage` under `vibe.userWorkflows` and
appears in the palette and ghost suggestions from then on. Each row has
a **delete** button next to it.

## Inline ghost suggestions

While typing, a faded completion appears for matching recent prompts and
workflows. Press **Tab** to accept; keep typing to dismiss.

## Providers

VIBE routes prompts through one of:

- **Puter** — runs in the browser via `puter.ai.chat`. **No API key
  required**, but the user must sign into Puter for the pricing/usage to
  attach to their own account. Sign in via the `Sign in to Puter` button
  in the header (or via the sessions panel). Streams tokens directly into
  the active block.
- **OpenRouter / MegaLLM / AgentRouter / Routeway** — server-side
  fallback chain (`/api/ai-chat`). Uses the project's existing API keys
  and the `chatWithFallback` cascade if the primary errors.

When Puter is selected and the user is *not* signed in, you'll see an
amber "Sign in to Puter" pill in the header — click it to authenticate
in a popup. The console keeps working with the other providers in the
meantime.

## Sessions

Sessions are saved to **Puter cloud storage** (`puter.fs`) under
`vibe/sessions/<id>.json` when the user is signed in, and to
**localStorage** otherwise.

Open the sessions list from `Sessions` in the header or `/load`. Each
entry shows title, model, message count, last-modified date, and a green
dot if the session is in the cloud.

- `Load` replaces the current transcript.
- `Rename` swaps the title in-line; press `Enter` to save or `Esc` to
  cancel. The new title is written back to the same storage tier
  (Puter cloud or local).
- `Delete` removes the session from both Puter and local storage.

The header has both `Save` (overwrites the current session id) and
`Save As` (allocates a fresh id so the previous entry is preserved).
`/save` and `/saveas` mirror these from the keyboard. Clearing the
transcript (`/clear` or the **Clear** button) also rolls a new session
id, so the next save creates a new row instead of overwriting.

If you save while signed out and later sign in, future saves go to the
cloud — the local copy stays as a backup.

## Auto-Apply toggles

In the header:

- `Config` — include current `useGameConfig` JSON in the system prompt
- `Scene` — include a summary of the current scene state
- `Auto-Edit` — automatically apply `vibe-edit` agent steps as they arrive
- `Auto-Scene` — automatically apply `vibe-scene` agent steps

With both auto-toggles off, every step requires a click on its `Apply`
button before it touches the project. `Revert` does the true inverse
where it can:

- `vibe-scene add-object` / `add-prefab` — removes the exact object the
  step created, using the id captured at Apply time (not by name match).
- `vibe-scene save-prefab` — removes the prefab from the custom prefab
  library by id.
- `vibe-edit ACTION=replace` — re-sends the edit with `OLD` and `NEW`
  swapped, restoring the prior text.
- `vibe-edit ACTION=write` — there's no pre-edit snapshot yet, so
  Revert just marks the step un-applied and asks you to verify the
  file. Capturing prior content for true write-revert is tracked as a
  follow-up task.

## In-game overlay

`` ` `` slides the console down as a translucent overlay over the active
scene. While focused:

- The world is dimmed (`rgba(5,5,12,0.35)` veil).
- All keystrokes are swallowed at the window-capture phase so movement,
  combat, and other gameplay keybinds don't fire while you're typing.
- `Esc` closes the overlay and restores input.

The overlay uses the same component as the admin tab, so model
selection, sessions, and slash commands all work identically.
