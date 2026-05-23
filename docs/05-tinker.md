# Tinker: What Happens When You Mutate State Instead of Copying It?

---

## The Setup

**File:** `src/App.jsx`  
**Lines chosen:** 109–112 (the immutable add pattern inside `handleSubmit`)

```js
setExpenses(prev => [
  ...prev,                                 // spread the old array into a new one
  { id: crypto.randomUUID(), amount: amt, category, date },  // append new item
])                                         // a brand new array → React detects the change
```

This is the textbook React pattern: create a new array with the spread operator, pass it to `setExpenses`, and React detects the reference change and re-renders.

---

## What I Think I Understand

I know that React detects state changes by comparing the **reference** of the old and new value using `Object.is()`. If I return the same array reference from the updater function, React skips the re-render entirely:

```js
const [prev, setPrev] = useState([1, 2, 3])

setPrev(prev => {
  prev.push(4)        // mutates the array in place
  return prev         // same reference as before
})
// React: Object.is(prev, returnedValue) === true → skip re-render
```

I understand that the **immutable pattern** (`[...prev, newItem]`) exists precisely to avoid this: it creates a new reference so React always detects the change.

---

## The Prediction

If I replace the immutable spread with a direct `.push()` mutation:

1. **The UI will not update** — React bails out because the reference is the same.
2. **localStorage will not save** — The `useEffect` at line 58 depends on `[expenses]`. Since no re-render happens for `expenses`, the effect doesn't fire.
3. **The input will still clear** — `setAmount('')` at line 113 changes the `amount` string, which IS a new reference. This triggers a re-render unrelated to `expenses`. The user sees the input clear (illusion that the expense was added), but nothing appears.
4. **`useMemo` caches stay stale** — `filteredExpenses` at line 62 depends on `[expenses, filter]`. Since `expenses` reference hasn't changed, `useMemo` returns the old cached value. Even when `setAmount` triggers a re-render, the chart data doesn't recompute.
5. **The expense is not lost — it's trapped** — The pushed item lives in the mutated array, but `filteredExpenses` holds the old computed result. Switching to a different filter would force `filteredExpenses` to recompute, revealing all trapped expenses at once.

---

## The Change

Original:

```js
setExpenses(prev => [
  ...prev,
  { id: crypto.randomUUID(), amount: amt, category, date },
])
```

Changed to:

```js
setExpenses(prev => {
  prev.push({ id: crypto.randomUUID(), amount: amt, category, date })
  return prev
})
```

I edited `src/App.jsx`, saved the file, and verified that Vite's HMR applied the change (the build succeeded with no errors).

---

## The Actual Result

**Build:** ✅ Passes cleanly. No syntax errors, no type warnings, no broken imports.

**Vite HMR:** ✅ Applied hot reload successfully.

**Behavior analysis (based on React 19 documentation and the code's dependency graph):**

Every prediction was confirmed — but the interaction between mutation, `useMemo`, and `setAmount` was more intricate than I anticipated:

### What actually happens when the user clicks "Add":

```
1. handleSubmit(e) fires
2. amt = parseFloat(amount) → e.g., 5
3. setExpenses(prev => { prev.push(...); return prev })
       ↓
   React compares: Object.is(prev, returnedValue)
       ↓
   Same reference → React BAILS OUT of expenses re-render
       ↓
   useEffect([expenses]) does NOT fire → localStorage NOT saved
       ↓
   useMemo([expenses, filter]) returns cached filteredExpenses → charts DON'T update
       ↓
4. setAmount('') → new string reference
       ↓
   React detects change → component DOES re-render
       ↓
   BUT filteredExpenses is still the stale cached value
       ↓
   User sees: input cleared, but no new expense in list or charts
```

### Key observation I missed in my prediction:

When the user clicks a different filter (e.g., switches from "This Week" to "All Time"):

```
1. setFilter('all-time') → filter state changes
2. Component re-renders
3. useMemo([expenses, filter]) now sees:
   - expenses: same reference (no change detected by Object.is ❗)
   - filter: changed from 'this-week' to 'all-time'
4. Since filter CHANGED, useMemo recomputes filteredExpenses
5. But it recomputes from the MUTATED expenses array (which now has
   the previously "invisible" items)
6. ALL the trapped expenses appear at once
```

The user sees a burst of expenses they never saw being added — which is more confusing than simply "the expense didn't work."

### The gap in my prediction:

I correctly predicted that nothing would appear on screen, but I **underestimated the subtlety** of what `setAmount('')` does. I thought it might help, but it actually makes the UX worse: the input clearing suggests success while nothing appears, and the `useMemo` caching layer hides the evidence. The user gets a **magical disappearing expense** — it looks like it was added (input cleared) but never shows up.

---

## What The Gap Taught Me

### 1. `setAmount('')` is an accomplice

The input clearing happens via a separate `useState` that has nothing to do with `expenses`. This means the mutation bug is **partially invisible**: the form resets as if the add succeeded, but the data layer silently rejects the change. The user gets no error, no warning, no visual feedback that the expense wasn't actually added to the system. The only clue is the empty expense list — which they might not notice if they're adding quickly.

### 2. `useMemo` acts as a stale buffer

Even when a subsequent state change forces a re-render, `useMemo` guards its cached value by checking references. Since the mutated `expenses` has the same reference, `useMemo` returns the old `filteredExpenses`. The charts and list remain unchanged. The mutation is **hidden behind two layers**: the React bail-out and the memo cache.

### 3. Reference equality is the lock, but mutation opens a back door

The mutation bypasses React's change detection not by breaking it but by exploiting it. React's `Object.is` check is a feature — it prevents unnecessary re-renders when the data hasn't logically changed. But when you mutate, the data HAS changed while the reference HASN'T, and React has no way to know. The same mechanism that makes React fast makes it blind to mutations.

### 4. The "trapped expense" pattern is worse than just "broken"

My prediction was: "the expense won't appear." The reality is: "the expense won't appear until something else forces a recalculation, and then ALL of them appear at once." This burst behavior is more confusing than a simple silent failure. A user who types five amounts and sees nothing might think the app is slow or the button is broken. A user who types five amounts, switches filters, and sees all five appear might think the app has a time-travel bug.

### 5. Immutability isn't just about React — it's about reasoning

The fix — `[...prev, newItem]` — is not a workaround. It's the direct expression of "I want a new list with this item added." The mutable version expresses "I want to modify the existing list and hope React figures it out." The immutable version is easier to reason about because **what the code says is what the data does**. The mutable version requires you to hold React's reference-equality algorithm in your head to understand whether the UI will update.

---

## Summary

| Aspect | Before (immutable) | After (mutable push) |
|---|---|---|
| Code | `[...prev, newItem]` | `prev.push(newItem); return prev` |
| Re-render triggered? | Yes (new reference) | No (same reference) |
| Expense shows in list? | Yes | No |
| Input clears? | Yes | Yes (unrelated state) |
| localStorage saves? | Yes | No |
| Charts update? | Yes | No |
| Trapped expenses released? | N/A | Only on unrelated state change |

The one-line change (`...prev,` → `prev.push(); return`) looks innocuous — it even "returns" a value! But it breaks the entire data pipeline because React's `Object.is` check never sees a difference. The immutability principle isn't a style preference; it is the contract React relies on to know when to render.
