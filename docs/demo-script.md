# Verbum Launch Demo

## Goal

Make the audience feel one idea viscerally: Claude Code, Codex, your terminals, memory, and you are all in one observable conversation.

## Setup

- Native app on the main display
- Claude Code in one terminal
- Codex in a second terminal or managed by the app
- A third terminal for a plain shell task
- Repo already open with one small failing test and one obvious fix path

## The 60-second cut

### 1. Open with the punchline

Say:

> "Most agent tooling hides the interesting part. Verbum makes the whole machine talk in public."

Visual:

- Start on the native app graph
- Claude Code, Codex, `zsh`, `python`, Search, and Inbox are already visible as nodes
- The message bus is moving before you touch anything

### 2. Give the task

In the app inbox, send:

> "Fix the failing router test, but have Codex explain the root cause before Claude patches anything."

Visual:

- The Inbox node lights up
- A new edge fires to Verbum App
- Verbum App fans the request out to Claude Code and Codex

### 3. Show orchestration, not chat

Say:

> "Claude is editing. Codex is verifying. The shell is running the suite. And I can see all of it."

Visual:

- Codex explains the failure in one pane
- Claude Code starts a patch
- `zsh` runs `npm test`
- Search returns a citation from a previous run or doc note

### 4. Land the search moment

In the native app search, ask:

> "What pattern are we using here?"

Expected answer:

> "Claude Code is responsible for the patch, Codex is the verifier, terminals are the execution layer, and the human interrupt stays in the inbox."

Say:

> "The graph is not just pretty. It becomes memory."

### 5. Close with the product thesis

Say:

> "This is Verbum. Everything is a conversation."

Visual:

- Zoom out to show the full graph again
- Leave the message bus and inbox visible
- End with the repo URL and `npm install verbum`

## Recording notes

- Keep terminal fonts large enough to read in an autoplaying X clip
- Do not show empty waiting states
- Script the task so the edges fire immediately
- End before the audience has time to think "dashboard"

## Strong demo tasks

- Fix one failing test while citing the cause before patching
- Ask Claude Code to implement while Codex reviews
- Run the build in one shell and snapshot assets in another
- Save the pattern to memory and retrieve it with search

