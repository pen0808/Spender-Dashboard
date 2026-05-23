# Software Engineering Principles in Receipts

## 1. Single Source of Truth

**Plain meaning:** One piece of data lives in one place. Don't copy it around — if you need a different view, compute it from the original.

**Where it appears:**
- `App.jsx:44` — `expenses` is the **only** data stored in state. Everything else — filtered list, chart data, totals — is computed from it.
- `App.jsx:58-60` — `localStorage` saves and loads only `expenses`. No cached chart data is ever persisted.
- The app has exactly one source of truth (`expenses`) and three derived views (`filteredExpenses`, `categoryTotals`, `dailyTotals`). The derivation is one-way: changes flow from source → views, never the reverse.

```
expenses (ONE source of truth)
    │
    ├── filteredExpenses  (derived — computed via .filter())
    │       │
    │       ├── categoryTotals  (derived — computed via .reduce())
    │       ├── dailyTotals     (derived — computed via .reduce())
    │       └── totalSpend      (derived — computed via .reduce())
```

If you delete an expense from the master list, all four derived values update automatically. You can never have a chart showing a total that doesn't match the list below it.

---

## 2. Derived State

**Plain meaning:** Don't store what you can calculate. If you have a list of expenses, you don't also need a separate "total" variable — add them up when you need to show the number.

**Where it appears:**

Every `useMemo` in `App.jsx` is an example of derived state. Each one takes existing data and transforms it into a new shape, recalculating only when its input changes.

- `App.jsx:62-70` — `filteredExpenses`: derived from `expenses` by applying the active `filter`.
- `App.jsx:72-83` — `categoryTotals`: derived from `filteredExpenses` by summing amounts per category.
- `App.jsx:85-98` — `dailyTotals`: derived from `filteredExpenses` by grouping by date over 7 days.
- `App.jsx:100-103` — `totalSpend`: derived from `filteredExpenses` by summing all amounts.

The dependency chain enforces correctness:
- `filteredExpenses` depends on `[expenses, filter]`
- `categoryTotals`, `dailyTotals`, `totalSpend` each depend on `[filteredExpenses]`

When `filter` changes, `filteredExpenses` recalculates, which triggers all three chart/total values to recalculate in sequence. React batches the renders, so you get one UI update with everything consistent.

**Without derived state**, the app would need separate `useState` calls for `filteredExpenses`, `categoryTotals`, `dailyTotals`, and `totalSpend` — and every add/delete/filter change would require manually keeping all four in sync. That's where bugs come from.

---

## 3. Immutability

**Plain meaning:** Never change data directly. Instead, make a copy with the change applied. Like photocopying a document with your edit rather than erasing the original.

**Where it appears:**

- `App.jsx:109-112` — Adding an expense with `[...prev, newItem]`. The spread operator creates a new array; the old array is unchanged.
- `App.jsx:117` — Deleting an expense with `prev.filter(e => e.id !== id)`. `.filter()` returns a new array; the original is untouched.
- `App.jsx:67-69` — Filtering expenses with `expenses.filter(e => isInWeek(...))`. The master list `expenses` is never modified — a new filtered copy is returned.
- `App.jsx:18-25` — `getMonday` creates a local copy with `new Date(date)` instead of mutating the input date.
- `App.jsx:62-70` — `thisMonday` and `lastMonday` are fresh Date copies; the original `new Date()` passed in is not mutated.
- `App.jsx:89` — `const d = new Date(now)` inside the dailyTotals loop creates a fresh copy to avoid mutating the shared `now` reference.

**What is avoided:**
- No `push()` (mutates array in place)
- No `splice()` (mutates array in place)
- No direct property assignment like `obj.value = x` on state
- No mutating Date methods like `setDate()` on an input parameter

Every state update creates a new array or object. This is required for React to detect changes (it uses reference equality to decide when to re-render).

---

## 4. Pure Functions for Filtering

**Plain meaning:** A pure function always returns the same output for the same input and has no side effects — it doesn't change anything outside itself. Like a vending machine: press B3 and you always get chips, and the machine doesn't rearrange your kitchen.

**Where it appears:**

- `App.jsx:18-25` — `getMonday(date)`:
  - Same input → same output: `getMonday(new Date('2026-05-19'))` always returns the Monday of that week.
  - No side effects: it creates a local `new Date(date)` copy, works on it, and returns it. The original `date` passed in is never touched.
  - No reading or writing of external state (no `localStorage`, no `useState`).

- `App.jsx:27-33` — `isInWeek(dateStr, weekStart)`:
  - Given the same date string and week start, it always returns the same boolean.
  - Does not mutate `weekStart` — it creates `start` and `end` as local copies.
  - Reads nothing from outside its parameters.

- `App.jsx:35-37` — `formatShort(date)`:
  - Same Date in → same formatted string out.
  - No side effects, no external dependencies.

- `App.jsx:39-41` — `todayStr()`:
  - Technically impure (its output depends on when you call it — tomorrow it returns a different string). But it's deterministic for a given moment in time, has no side effects, and is called only once at initialization.

**Why it matters:** Pure functions are easy to test, easy to reason about, and safe to call multiple times. `isInWeek` is called inside `.filter()` — once per expense. If it had side effects, filtering 100 expenses would cause 100 side effects. Since it's pure, it just computes a yes/no answer.

---

## 5. Separation of Concerns / Separation Between Data and Presentation

**Plain meaning:** Different parts of the code handle different kinds of work. Don't mix data logic with visual styling. Keep the "what" separate from the "how it looks."

**Where it appears:**

**File-level separation:**
- `src/App.jsx` — All logic, data flow, event handlers, and rendering structure (JSX).
- `src/App.css` — All visual styling (colors, sizes, layout, spacing, responsive breakpoints).
- `src/main.jsx` — App bootstrapping / entry point.
- `index.html` — Static HTML shell.

**Within App.jsx, data logic is separated from rendering:**

The component is organized in three clear sections:

1. **Pure helpers (lines 18–41):** Date math — `getMonday`, `isInWeek`, `formatShort`, `todayStr`. No JSX, no state, no side effects. Pure functions that could be extracted to a separate utility file.

2. **State + derived state (lines 44–124):** All the data logic — `useState` for raw data, `useMemo` for derived data, `useEffect` for persistence, event handlers for mutations. These lines handle _how the app works_, not _how it looks_.

3. **JSX return (lines 126–258):** Pure presentation. Reads from the derived state computed above but does no computation of its own. The only logic here is ternary operators for conditional rendering (e.g., "show chart or show 'No data'").

**Within the JSX, chart configuration is declarative:**
- `App.jsx:182-194` — The `<Pie>` component receives `data={categoryTotals}` and declares what to draw. It doesn't know how `categoryTotals` was computed — it just receives data and draws it.
- `App.jsx:218-222` — The `<BarChart>` receives `data={dailyTotals}` and draws bars. No knowledge of filtering, summing, or date math.

**What this enables:**
- You can change how the app looks (CSS) without touching data logic.
- You can change how data is computed (useMemo logic) without touching the JSX.
- You can swap out recharts for a different chart library by only changing the JSX — the data preparation stays the same.

---

## 6. Declarative Programming

**Plain meaning:** Tell the computer _what_ you want, not _how_ to build it. Instead of saying "create a div, set its width to 50%, then add a child..." you say "I want two charts side by side."

**Where it appears:**

- `App.jsx:126-258` — The entire JSX block declares what the UI should look like based on current state: "render a header, a form, filter buttons, a total card, two charts, and an expense list."
- `App.jsx:180-198` — The donut chart is declared declaratively: "center it, make it 100px outer radius with a 60px hole, color each slice by its category." The _how_ (SVG path generation, mouse event handling) is handled by recharts.
- `App.jsx:67-69` — `expenses.filter(e => isInWeek(e.date, thisMonday))` declares _what_ expenses belong in this week, not _how_ to iterate and collect them.

---

## 7. Encapsulation / Information Hiding

**Plain meaning:** Keep internal details private so outside code can't mess with them. You don't need to know how a microwave works to heat your food.

**Where it appears:**

- `App.jsx:44-56` — All state (`expenses`, `amount`, `category`, `date`, `filter`) is local to the component via `useState`. Nothing outside this file can read or mutate it directly.
- `App.jsx:105-118` — All event handlers are local functions inside the component. They access state through closure, not through global variables.
- `App.jsx:58-60` — The localStorage persistence is abstracted away inside `useEffect`. The rest of the code doesn't know or care _how_ data is saved — it just calls `setExpenses` and trusts that it persists.

---

## 8. Functional Core / Imperative Shell

**Plain meaning:** Keep the core logic pure (functional) and push side effects to the edges (imperative). The "thinking" part is pure; the "touching the outside world" part is isolated.

**Where it appears:**

**Functional core (pure):**
- `getMonday` — pure function
- `isInWeek` — pure function
- `formatShort` — pure function
- `filteredExpenses`, `categoryTotals`, `dailyTotals`, `totalSpend` — computed via pure array methods (`filter`, `reduce`, `map`) inside `useMemo`

**Imperative shell (side effects):**
- `App.jsx:58-60` — `useEffect` writing to `localStorage` (side effect, isolated)
- `App.jsx:44-51` — `useState` initializer reading from `localStorage` (side effect at bootstrap)
- `App.jsx:105-114` — `handleSubmit` calls `setExpenses` (state mutation, isolated)

The pure functions don't know about React, localStorage, or the DOM. They just transform data. The impure parts handle persistence and state updates and delegate the heavy lifting to the pure parts.

---

## Summary Table

| Principle | Where Found | Why It Matters |
|---|---|---|
| **Single Source of Truth** | `expenses` is the only state; everything else is derived | Prevents sync bugs — charts, total, and list always agree |
| **Derived State** | 4 `useMemo` blocks form a one-way data pipeline | No redundant state; changes propagate automatically |
| **Immutability** | `[...prev]`, `.filter()`, `.map()` — no `push`/`splice` | Enables React change detection; prevents subtle mutation bugs |
| **Pure Functions** | `getMonday`, `isInWeek`, `formatShort` | Predictable, testable, safe to call repeatedly |
| **Separation of Concerns** | `App.jsx` (logic) vs `App.css` (styles) vs helpers | Each file changes for one reason; no tangled code |
| **Declarative UI** | JSX describes _what_, not _how_ | Easier to read and modify; recharts handles complexity |
| **Encapsulation** | State and handlers are local to the component | No external code can corrupt internal state |
| **Functional Core** | Pure helpers + pure `useMemo` transforms; side effects at edges | Core logic is testable without mocking React or the DOM |
