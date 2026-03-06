# TaskMaster Pro — New Features Implementation Plan

---

## ⚠️ Current Overdue System — Diagnosis

### How It Works Today

The existing overdue mechanism is a **polling interval** registered in `App.jsx`:

```
setInterval(() => checkAndMarkOverdue(), 60_000)  // runs every 60 seconds
```

Every minute, this function iterates over every task in the Zustand store and checks if the task's `dueDate` field has passed. If `Date.now() > task.dueDate` and the task is not already "Done", it mutates the task's `status` to `"Overdue"`.

### Critical Problems with This Approach

| Problem | Impact |
|---|---|
| **No default deadline** — tasks without a manually set `dueDate` are never checked | Most tasks never become overdue |
| **Polling is imprecise** — a task due at 14:01 won't be marked until 14:02 at the earliest, sometimes 14:59 | Wrong timestamps in analytics |
| **Status mutation is destructive** — overwriting `status` to `"Overdue"` loses the previous stage (e.g. `"In Progress"`) | Kanban board column breaks; task jumps out of its column |
| **No user awareness** — no visual warning before a task goes overdue | User is blindsided |
| **No persistence of overdue state to Supabase** — only local state is mutated | On page reload, overdue status recalculates but the history is lost |
| **Subtasks are not checked** — the interval likely only covers top-level tasks | Subtask deadlines are invisible |

### The Right Mental Model Going Forward

`status` (Todo / In Progress / Done) and `overdue` (true/false) must be **two separate, orthogonal fields**. A task can be `In Progress` AND `overdue` at the same time. The new Deadline System below is designed around this principle.

---

---

# Feature #1 — Production Deadline System

## 1.1 Overview

A robust, production-grade deadline engine that replaces the fragile polling interval with a precise, event-driven approach. Every task has a deadline. The system visually communicates urgency before a task becomes overdue, and the Task Detail Modal becomes the single source of truth for editing all task properties.

---

## 1.2 Data Model Changes

### Task Schema Addition

The following fields must be added to the task object in Supabase (`tasks` table) and mirrored in the Zustand store:

```
deadline          : ISO 8601 timestamp string  (NOT NULL)
deadline_type     : "auto" | "manual"          (tracks whether user set it or it defaulted)
overdue           : boolean                    (derived field, can be computed or stored)
overdue_since     : ISO 8601 timestamp | null  (when it became overdue)
reminded_at       : ISO 8601 timestamp | null  (for notification deduplication)
```

**`deadline` is always set.** On task creation, if the user provides no deadline, the system automatically assigns `deadline = createdAt + 24 hours` and sets `deadline_type = "auto"`. This closes the gap where most tasks had no deadline at all.

**`status` is never changed to "Overdue".** Instead, `overdue: true` is set as a separate boolean. This preserves the Kanban column position (Todo / In Progress / Done) while layering urgency on top.

---

## 1.3 Deadline Engine Architecture

The current `setInterval` in `App.jsx` must be **replaced entirely** with the following two-layer architecture:

### Layer 1 — Precise Client-Side Scheduler (`useDeadlineScheduler` hook)

Instead of polling every 60 seconds, this hook calculates the **exact milliseconds** until the next task deadline and sets a single `setTimeout` that fires at precisely that moment.

**How it works step by step:**

1. On mount (and whenever the tasks array changes), the hook sorts all active tasks by their `deadline` ascending.
2. It finds the task with the nearest upcoming deadline.
3. It computes `delta = task.deadline - Date.now()`.
4. It sets `setTimeout(triggerOverdueCheck, delta)`.
5. When that timeout fires, it marks only that task as `overdue: true` in the store, then immediately reschedules for the next closest deadline.
6. The hook cleans up all timeouts on unmount.

**Why this is superior to polling:**
- A task due at 14:01:30 is marked overdue at exactly 14:01:30, not at 14:02:00.
- Zero wasted CPU cycles between deadlines.
- Still handles "tab was asleep" edge case by comparing all tasks against `Date.now()` on tab focus (`visibilitychange` event).

### Layer 2 — Server-Side Sync via Supabase Edge Function

For users who are offline or have the tab closed, a Supabase Edge Function (cron) runs every 15 minutes and updates `overdue = true` for any task where `deadline < now()` and `status != 'done'`. This ensures the database reflects reality regardless of client state.

When the user opens the app after being offline, Supabase Realtime delivers the updated state instantly and the UI reflects it without any client-side calculation needed.

---

## 1.4 Visual Urgency States

Tasks pass through four visual states as their deadline approaches. These are computed at render time from `deadline` and `overdue` fields — they are **not stored** as separate database columns.

| State | Condition | Visual Treatment |
|---|---|---|
| **Normal** | `deadline > now + 24h` | Default card styling |
| **Warning** | `deadline` is within 24 hours | Amber/yellow accent border on card, clock icon appears |
| **Critical** | `deadline` is within 2 hours | Red pulsing border, countdown timer visible on card |
| **Overdue** | `overdue === true` | Red tinted card background, "OVERDUE" badge, strike-through on deadline text |

The transition from Normal → Warning → Critical is a **pure CSS + computed class** decision in the task card component. A `useMemo` hook computes the urgency level from the deadline timestamp on each render, costing virtually zero performance.

---

## 1.5 Task Detail Modal

### Purpose

The Task Detail Modal is the **unified editing surface** for every property of a task. Clicking any task card anywhere in the app (Kanban board, Analytics list, Roadmap) opens this modal.

### Trigger Behavior

- **Mouse:** Single click on a task card
- **Keyboard:** `Enter` or `Space` when a card is focused
- **URL-driven:** The modal state is reflected in the URL as a query param (`?task=<taskId>`), enabling deep-linking and browser back-button support.

### Animation

The modal enters using a combined **scale + fade** transition (scales from 0.95 → 1.0, opacity 0 → 1 over 200ms). It uses a backdrop blur overlay. On mobile it slides up from the bottom as a bottom sheet.

### Sections of the Modal

**Section 1 — Header**
- Inline-editable task title (click to edit, auto-saves on blur)
- Status badge (Todo / In Progress / Done) — click to cycle
- Priority selector (5 levels with colored flag icons)
- Close button (also `Escape` key)

**Section 2 — Deadline Panel**
This is the core new section. It shows:
- A datetime picker rendered as a clean calendar popover. Uses native `<input type="datetime-local">` under the hood but styled to match the space-grade aesthetic.
- The `deadline_type` badge: shows "Auto-set (24h)" in muted text if no deadline was specified, or "Custom" if user set it.
- A live countdown display: "Due in 3h 24m" or "Overdue by 2 days 4h" in colored text.
- A "Reset to 24h from now" shortcut button.

**Section 3 — Description**
- Rich text area (plain textarea with markdown preview toggle initially; full rich text editor can be a Phase 2 addition).
- Auto-saves with 500ms debounce after user stops typing.

**Section 4 — Subtasks**
- Renders the existing subtask list with checkboxes.
- Inline "Add subtask" input at the bottom.
- Each subtask can also have its own deadline — clicking a subtask title opens a nested mini-deadline row.
- Progress bar at top of section shows X/Y subtasks completed.

**Section 5 — Tags**
- Multi-select tag input. User types to create or select existing tags.
- Tags stored as a `string[]` on the task. Used for filtering on the board.

**Section 6 — Meta Footer**
- Created at timestamp
- Last modified timestamp
- Assigned to (placeholder for future team feature)
- "Delete Task" button (destructive, requires confirmation click)

### Auto-save Strategy

The modal does **not** have a "Save" button. All fields auto-save individually:
- Title and Description: 500ms debounce after last keystroke.
- Deadline, Priority, Status, Tags: Immediate save on change (these are discrete selections, not free-text).
- Subtask completion: Immediate save (critical for real-time sync).

Each save triggers a Zustand store update + a Supabase `update` call. Supabase Realtime then broadcasts the change to other tabs/users.

---

## 1.6 Notification System (Optional Extension)

### Browser Push Notifications

When a task enters the "Warning" state (24h before deadline), the app requests notification permission and schedules a `Notification` via the Web Notifications API. A second notification fires at the "Critical" state (2h before).

Implementation path:
1. On task creation/deadline edit, call `Notification.requestPermission()`.
2. Store `reminded_at` on the task to prevent duplicate notifications.
3. Schedule notifications using the Deadline Scheduler (Layer 1) so they fire at exactly the right time.

### Email Notifications (Supabase Edge Function)

The cron Edge Function that marks tasks overdue can also invoke Supabase's email service to send a styled email using the existing premium HTML email template system already in the project. The email lists all tasks that became overdue in the last 15-minute window.

---

---

# Feature #2 — Year-Long Roadmap Visualization

## 2.1 Overview

A standalone page (`/roadmap`) that presents the entire year as an **immersive, scrollable 3D timeline**. Each month is a floating card. The experience feels like scrolling through a physical roadmap pinned to a wall — cards in the distance are smaller and recede in 3D space, the "active" card snaps to the center and is prominently large, and cards behind the user scroll away.

This is a **goal-planning** layer above the tactical Kanban board. Roadmap goals are high-level monthly intentions, not individual tasks.

---

## 2.2 Data Model

A new Supabase table: `roadmap_months`

```
id              : uuid (PK)
user_id         : uuid (FK → auth.users)
project_id      : uuid (FK → projects)
year            : integer        (e.g. 2025)
month           : integer        (1–12)
super_goal      : text           (the single overarching goal for the whole month)
week_1_goal     : text | null
week_2_goal     : text | null
week_3_goal     : text | null
week_4_goal     : text | null
color_accent    : hex string     (user-chosen accent color for the month card)
created_at      : timestamp
updated_at      : timestamp
```

**Design constraints enforced by schema:**
- Max 4 goals per month (one per week) + 1 super goal = 5 total items per card.
- One row per `(user_id, project_id, year, month)` — enforced by unique constraint.

---

## 2.3 Scroll Architecture — The 3D Effect

### The Core Mechanism

The 3D scroll effect is achieved entirely with **CSS 3D transforms + a custom scroll handler**. No external 3D library is needed. This keeps bundle size minimal and performance high.

The parent container has `perspective: 1200px` applied. Each month card is an absolutely-positioned element. As the user scrolls, a JavaScript handler recalculates the 3D transform for every card based on its distance from the center viewport position.

### The Transform Formula

For each card, a `distanceFromCenter` value is computed:

```
distanceFromCenter = cardIndex - scrollProgress
```

Where `scrollProgress` is a floating-point value that advances as the user scrolls (e.g. 0 = at card 0, 1.5 = halfway between card 1 and card 2).

From `distanceFromCenter`, three CSS transform values are derived:

- **`translateZ`**: Cards directly ahead (positive distance) are pushed "back" in Z space. Cards behind are pushed further back. The center card has `translateZ(0)`.
  - Formula: `translateZ = distanceFromCenter * -120px`
- **`scale`**: Center card is `scale(1)`. Cards away from center reduce in scale.
  - Formula: `scale = 1 - (|distanceFromCenter| * 0.12)`, clamped to minimum 0.6.
- **`translateY`**: Cards slightly above or below center follow a gentle arc (like a curved path).
  - Formula: `translateY = distanceFromCenter * 18px`
- **`opacity`**: Cards more than 2 positions away fade out.
  - Formula: `opacity = Math.max(0, 1 - (|distanceFromCenter| - 1) * 0.5)`

All transforms are applied in a single `transform` property string. The transition is driven by `requestAnimationFrame` for silky 60fps smoothness with no jank.

### Scroll Behavior

The page uses **scroll snapping** (`scroll-snap-type: y mandatory` on the container, `scroll-snap-align: center` on each card). This means the scroll always settles with exactly one card centered — the user never lands between two cards. The 3D math above runs during the scroll animation and resolves cleanly when snapping completes.

**Only 3 cards are rendered at a time in the DOM** (the previous, current, and next month). Cards outside the visible window are unmounted. A sliding window logic in the scroll handler swaps cards in and out of the DOM as the user moves through the months. This is critical for performance with 12 months of data.

---

## 2.4 Month Card Design

### Visual Anatomy (at rest, centered position)

```
┌──────────────────────────────────────────┐
│  ◈  MARCH 2025                    [edit] │  ← Month name + accent color stripe on left
│─────────────────────────────────────────│
│  ✦ SUPER GOAL                            │  ← Highlighted in accent color
│  "Ship the MVP and get first 10 users"  │
│─────────────────────────────────────────│
│  WK 1  ○  Auth + onboarding             │
│  WK 2  ✓  Kanban board complete         │  ← Checkmark if goal is marked done
│  WK 3  ○  Analytics page               │
│  WK 4  ○  Public launch                 │
│─────────────────────────────────────────│
│  Progress: ████░░░░  1/4 weeks done     │  ← Progress bar at bottom
└──────────────────────────────────────────┘
```

**Card dimensions:** Fixed height (approx. 280px), full width up to 560px max. Rounded corners (16px radius). Glassmorphism background (semi-transparent dark panel with subtle backdrop-blur, matching the app's space-grade aesthetic).

**Left accent stripe:** A 4px vertical bar on the card's left edge, colored with the month's `color_accent`. This is the only color element — everything else is monochrome, maintaining the minimalist aesthetic.

**Progress bar:** Shows `completed_weeks / 4` as a horizontal fill bar. A week goal is "completed" when the user marks it as done in the detail modal.

---

## 2.5 Connecting Line Between Cards

The sketch shows a connecting line that snakes between month cards. This is rendered as an **SVG element positioned behind the cards** (z-index: -1). The line is a cubic bezier path that flows from the center-right of one card to the center-left of the next. As the user scrolls, the SVG path is redrawn to connect the visible cards.

The line has a subtle animated "dash" effect — a dashed stroke whose `stroke-dashoffset` is animated continuously, giving the impression of data flowing forward along the roadmap.

---

## 2.6 Month Detail Modal

### Trigger

Single click on any month card opens the Month Detail Modal.

### Animation

The modal performs a **morphing expansion** animation: it starts at the exact bounding box position and size of the clicked card, then expands outward to its final size (covering ~70% of viewport). This uses the `FLIP` (First, Last, Invert, Play) animation technique so the expansion feels physically grounded — like the card is expanding into a panel, not a separate element appearing from nowhere.

Backdrop: the rest of the roadmap blurs and dims behind the open modal.

### Modal Sections

**Header**
- Month name + year (large typography)
- Color accent picker (user can change the month's accent color)
- Close button

**Super Goal Section**
- Large textarea for the month's singular overarching goal.
- Label: "The one thing that defines this month's success."
- Shown prominently in accent color.
- Character limit: 120 characters (forces clarity and conciseness).

**Weekly Goals Section**
Four expandable rows, one per week of the month:
- Each row shows the week's date range (e.g. "Mar 1–7")
- A text input for the week goal (max 80 characters)
- A checkbox to mark the week as "Complete"
- When checked: the text gets a strikethrough and a faint green tint, and the progress bar on the parent card updates live.

**Link to Kanban**
At the bottom of the modal, a section: "Tasks linked to this month." It queries the `tasks` table for any tasks whose deadline falls within this calendar month and renders them as a compact list. Clicking a task from this list opens the Task Detail Modal (layered on top of the Roadmap Modal). This creates a **vertical drill-down**: Roadmap → Month Detail → Task Detail.

**Notes Section**
An open freeform textarea for any planning notes, context, or brain-dump related to the month. Not structured — just a scratch pad. Auto-saves with debounce.

---

## 2.7 Performance Considerations

| Concern | Solution |
|---|---|
| 12 months of cards re-rendering on scroll | Virtual DOM windowing: only 3 cards in DOM at once |
| Scroll handler firing hundreds of times per second | `requestAnimationFrame` throttling — transform recalculation runs at most once per frame |
| SVG path recalculating on every scroll | Path is only recalculated when the active card index changes (integer snap), not on every pixel |
| Supabase fetching all 12 months on load | Fetch all 12 months in a single query on page mount and cache in Zustand; updates are real-time via subscription |
| Modal animation jank on low-end devices | FLIP animation uses `transform` and `opacity` only (GPU-composited properties); no `width/height/top/left` animation |

---

## 2.8 Integration with Existing Features

- **AI Weekly Retrospective** (existing feature): The retrospective can reference the current month's Roadmap goals to generate a contextual narrative ("You set 'Ship MVP' as your March super goal. Here's how your task velocity contributed to it...").
- **Analytics Dashboard** (existing feature): A new "Roadmap Adherence" metric can be added — percentage of weekly goals marked complete by their week's end.
- **Task Deadline System** (Feature #1): The "Linked Tasks" section in the Month Detail Modal is only possible because every task now has a reliable deadline field.

---

## 3. Implementation Order Recommendation

Given that Feature #1 (Deadline System) is a foundational data model change, it must be implemented before Feature #2 depends on it for the "Linked Tasks" section.

**Recommended sequence:**

```
Phase 1 — Data Foundation
  ├─ Add deadline, overdue, deadline_type fields to Supabase tasks table
  ├─ Write and test the DB migration
  └─ Update Zustand store shape to mirror new fields

Phase 2 — Deadline Engine
  ├─ Build useDeadlineScheduler hook (precise setTimeout approach)
  ├─ Remove the old setInterval from App.jsx
  └─ Add visibilitychange handler for tab-sleep edge case

Phase 3 — Task Detail Modal
  ├─ Build modal shell with animation (scale + fade)
  ├─ Wire up all existing fields (title, status, priority)
  ├─ Add Deadline Panel with datetime picker
  ├─ Add URL-driven modal state (?task=id)
  └─ Add Tags section

Phase 4 — Visual Urgency on Cards
  ├─ Add urgency level computation (useMemo)
  └─ Apply CSS classes for Warning / Critical / Overdue states

Phase 5 — Roadmap Data Layer
  ├─ Create roadmap_months table in Supabase
  ├─ Add /roadmap route to React Router
  └─ Build Zustand slice for roadmap state

Phase 6 — Roadmap 3D Scroll
  ├─ Build scroll container with perspective and snap
  ├─ Build transform calculation logic with rAF
  └─ Implement 3-card DOM windowing

Phase 7 — Month Card + SVG Connector
  ├─ Build card UI (glassmorphism, accent stripe, progress bar)
  └─ Build animated SVG bezier connector

Phase 8 — Month Detail Modal
  ├─ Build FLIP animation engine for card→modal expansion
  ├─ Build Super Goal, Weekly Goals, and Notes sections
  └─ Build Linked Tasks section (queries tasks by month deadline range)

Phase 9 — Notifications (Optional)
  ├─ Browser push notification scheduling
  └─ Supabase Edge Function for email overdue alerts
```

---

*Document version: 1.0 — TaskMaster Pro Feature Planning*