# Court shell, slice 3: implementation plan

**Goal:** An open matter is answered in "Kräver dig", and the person card carries out the panel's actions that name its person.

**Spec:** `docs/superpowers/specs/2026-11-15-court-shell-design.md`, "Slice 3: answer and act in place".

**Architecture:** `courtShell.js` gains three pure functions that read an answer, a card's actions and a notice out of the court's presentation. One hook sends a command with the panel's own entry (`submitCharacterCommand`) under one lock. Two new components draw the open matter and the card's actions. The court is read again through `useCourtView` when the revision moves; nothing is read that slice 1 does not read.

## Global constraints

- The shell sends what the panel sends: the same command type, the same payload keys, the revision of the view it shows.
- Every label is the panel's own Swedish string where the panel has one. New Swedish text goes through `build-native-catalog` and `check-native-pack`.
- One command at a time: a second press while one is written does nothing.
- No gradients (`src/noGradients.test.js`).

## Task 1: what an answer, a card and a notice hold

**Files:** `src/Game/Characters/courtShell.js`, new `src/Game/Characters/courtAnswer.test.js`, `CharactersPanel.jsx` (imports the notice).

- `answerOf(view, matterId): Answer | null`, `Answer = { id, title, chainTitle, stepNumber, description, triggerDescription, deadlineText, fallbackDescription, choices }`, `choices: Array<{ id, label, description, actorName, cost, stress, disabledReason, odds }>`. The fields carry the story's own names, so the shell's sentences are the panel's catalog entries.
  - `null` for a matter that is not open.
  - `chainTitle` and `stepNumber` only for an `event_chain`; `stepNumber` is `null` unless the story's is a positive integer.
  - `fallbackDescription` is empty when the story has a `deadlineText`.
  - A choice with odds has no description (the panel shows the odds in its place). `actorName` is `undefined` when the choice names nobody (`scope: "none"` or no `actorName` key), `null` when nobody may carry it out.
- `decisionNotice(story, choiceId, events): string` moves here from `CharactersPanel.jsx` unchanged; the panel imports it.
- `commandNotice(events): string`: the last two event titles joined by " · ", or "Beslutet har sparats i kampanjen.".
- `actionsOf(view, personId): Array<{ type, label, description, cost, stress, actorName, field, value, fields }>`.
  - An action is listed when it has no `disabledReason` and one of its fields has an option whose value is the person's id, or the id of the prisoner entry whose `personId` is the person.
  - `field` and `value` are that field's key and that option's value (the first such field).
  - `fields` are the other fields as `{ key, label, options: Array<{ value, label }> }`, without the person; an action with an other field left empty is not listed.
- `cardOf` gains `canTalk`: the person is among `view.conversationTargets`.

Tests: each bullet above, with an open ransom, a chain step, a choice with odds, a choice nobody may carry out, a resolved and an unknown matter; the gift, the appointment (one other field), the marriage (the person is taken out of the partners), a disabled action, an action naming nobody, the prisoner's release, an unknown person.

## Task 2: the command

**Files:** new `src/Game/Characters/useCourtCommand.js`.

`useCourtCommand(revision): { busy, at, error, notice, run, clear }`.

- `run({ type, payload, at, noticeOf }): Promise<result | undefined>` sends `submitCharacterCommand({ type, payload, expectedRevision: revision, id: "ui-<uuid>" })`, imported on demand as `useCourtView` imports the engine. `undefined` when a command is already being written.
- A refusal's text goes through `playerText` with the panel's fallback "Handlingen kunde inte genomföras."; `at` says where the feedback belongs (`"matter"` or `"card"`).
- `clear()` drops the notice and the error.

## Task 3: the open matter

**Files:** new `src/Game/Characters/CourtMatter.jsx`; `CourtShell.jsx`, `courtShell.css`.

- `CourtShell` keeps `openMatterId` beside `selectedId`, in the same remembered record. A matter that is no longer open has no answer, so it closes with the view.
- `CourtMatter({ matter, answer, busy, error, updates, onToggle, onAnswer })`: the row is a button with `aria-expanded`; under it, when `answer` is given, the description, the background, the deadline's consequence, the choices and the refusal (`role="alert"`).
- A choice's press calls `run({ type: "resolve_story", payload: { storyId, choiceId }, at: "matter", noticeOf: (events) => decisionNotice(story, choiceId, events) })`. On success the matter closes and focus goes to the list's heading; the notice stands over the list with `role="status"`.
- Under the list, one button opens the panel at the decisions ("Ärenden och handlingar").
- The list is wider and taller while a matter is open.

## Task 4: the card's actions and the conversation

**Files:** new `src/Game/Characters/CourtCardActions.jsx`; `CourtPersonCard.jsx`, `CourtShell.jsx`, `courtShell.css`, `src/Game/GameUI/main.jsx`, `CharactersPanel.jsx`.

- `CourtCardActions({ actions, busy, error, notice, updates, onAct })`: one row per action with its label and cost; a press unfolds its description, who carries it out, its stress, a select per other field and the button that sends it. `onAct(action, values)` sends `{ [action.field]: action.value, ...values }`.
- `CourtPersonCard` gets "Samtala" when `card.canTalk`: the event `oh:open-characters` with `{ tab: "people", personId, talk: true }`.
- `main.jsx` carries `talk` in `charactersRequest`; `CharactersPanel` hands it to `PeopleView` once, and `PeopleView` opens the conversation when the person can be talked to.

## Task 5: evidence

Targeted tests, the text checks, eslint, the build, the full suite alone, and a browser run on a copy of the Charlemagne campaign: unfold the ransom, answer it, the notice, the list one shorter, the treasury 40 higher; a refusal; a gift from a card; an appointment with its office chosen; the prisoner's release from his card; "Samtala"; Escape; 2560 by 1440 and 1600 by 900; English.

## Review focus

- A command sent with a revision the court has left (two presses, or a year turn in between).
- The open matter or the selected person leaves the court while its form is open.
- A select whose chosen option is gone after the court is read again.
- Keyboard: `aria-expanded`, focus after an answer and after Escape, Escape inside a select.
- A window where the open matter and the card would meet.

## Review outcome

An independent review of the first build found no command sent twice or with a revision the court had left, and these, fixed in the same change:

- While a command was written the player could select another person or open another matter, and the command's notice or refusal then stood on the wrong card or under the wrong matter. The selection, the open matter and the open action now stay until the command is written.
- An action that left the card while its form was open (a second gift in a year) was found open when it came back. What leaves the court now leaves no state behind.
- A conversation's ask that the people tab never showed, because the player went to another tab first, opened a conversation on a later visit. It is now forgotten with its tab.
- The id that ties a matter's row to its answer was built from the story's id as it stood. It is now one token whatever the id holds.
