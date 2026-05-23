# Lie Detector — Receipts

## The 5 Statements

Read each one. Four are true. One is a lie.

---

**A.** The `useEffect` on lines 58-60 saves expenses to localStorage only when the `expenses` array changes, thanks to the dependency `[expenses]`.

**B.** The `categoryTotals` useMemo always includes all five categories in the pie chart, showing each with a value of $0 when there are no matching expenses.

**C.** The `getMonday` function returns the Monday of the current week, and for Sunday it subtracts 6 days to land on the prior Monday.

**D.** The `handleSubmit` function prevents adding an expense if `parseFloat(amount)` is `NaN` (e.g., empty or non-numeric input) or if the amount is `0` or negative.

**E.** The `dailyTotals` useMemo generates data for the last 7 days (including today) by iterating `i` from 6 down to 0.

---

## Investigation

### Statement A — Verdict: TRUE

```js
useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))   // line 58-60
}, [expenses])
```

- React compares the **reference** of `expenses` with its previous value using `===`.
- Every state update calls `setExpenses(prev => ...)`, which returns a **new array** via spread or filter (lines 109-110, 117). The reference always changes, so the effect runs after every legitimate mutation.
- The effect does NOT run on unrelated state changes (e.g., `amount`, `category`, `date`, `filter`) because they are not in the dependency array.

Statement A is **true**.

---

### Statement B — Verdict: LIE

```js
const categoryTotals = useMemo(() => {
  const map = {}
  CATEGORIES.forEach(c => (map[c.value] = 0))          // seed all to 0
  filteredExpenses.forEach(e => {
    map[e.category] = (map[e.category] || 0) + Number(e.amount)
  })
  return CATEGORIES
    .filter(c => map[c.value] > 0)                      // ← REMOVES zero categories
    .map(c => ({
      name: c.label,
      value: Math.round(map[c.value] * 100) / 100,
      color: c.color,
    }))
}, [filteredExpenses])                                  // lines 72-83
```

The key is the `.filter(c => map[c.value] > 0)` on the return statement. Categories whose total is exactly $0 are **removed** from the array. The returned array only contains categories with non-zero totals.

**Proof:**

```
Scenario: No expenses match the current filter
  map = { food: 0, transport: 0, data: 0, fun: 0, other: 0 }
  After filter: []  ← empty! All five were removed
  categoryTotals.length === 0
  → The JSX renders <p className="empty-chart">No data</p>  (line 199-200)
  → The PieChart is never mounted

Scenario: Only "Food" expenses match
  map = { food: 42.50, transport: 0, data: 0, fun: 0, other: 0 }
  After filter: [{ name: 'Food', value: 42.50, color: '#FF6384' }]
  → PieChart shows exactly 1 slice, not 5
```

The statement claims "always includes all five categories" and "showing each with a value of $0" — both are false. Categories are excluded when their total is $0, and the "No data" placeholder appears when all are zero.

Statement B is a **lie**.

---

### Statement C — Verdict: TRUE

```js
function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()                              // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}                                                     // lines 18-25
```

**.getDay()** returns `0` for Sunday through `6` for Saturday. The formula adjusts:

| Today | day | diff | Result |
|---|---|---|---|
| Monday | 1 | `date - 1 + 1 = date` | Same day (Monday) ✓ |
| Tuesday | 2 | `date - 2 + 1 = date - 1` | Previous Monday ✓ |
| Wednesday | 3 | `date - 3 + 1 = date - 2` | Previous Monday ✓ |
| … | … | … | … |
| Saturday | 6 | `date - 6 + 1 = date - 5` | Previous Monday ✓ |
| **Sunday** | **0** | `date - 0 + (-6) = date - 6` | **Previous Monday** ✓ |

The `day === 0 ? -6 : 1` ternary is the critical fix: without it, Sunday would calculate `diff = date - 0 + 1 = date + 1`, landing on Tuesday instead of Monday.

Statement C is **true**.

---

### Statement D — Verdict: TRUE

```js
function handleSubmit(e) {
  e.preventDefault()
  const amt = parseFloat(amount)               // line 107
  if (!amt || amt <= 0 || !date) return          // line 108
  ...
```

`parseFloat` returns `NaN` for non-numeric strings. Since `NaN` is falsy, `!amt` catches it:

| Input | `parseFloat` | `!amt` | `amt <= 0` | Blocked? |
|---|---|---|---|---|
| `""` | `NaN` | `true` | — | ✅ |
| `"abc"` | `NaN` | `true` | — | ✅ |
| `"0"` | `0` | `true` | — | ✅ |
| `"-5"` | `-5` | `false` | `true` | ✅ |
| `"12.50"` | `12.5` | `false` | `false` | ❌ Allowed |

Additionally, `!date` blocks submission when the date field is empty (even though the input has `required`, this is a JavaScript-level safety net).

Statement D is **true**.

---

### Statement E — Verdict: TRUE

```js
const dailyTotals = useMemo(() => {
  const now = new Date()
  const days = []
  for (let i = 6; i >= 0; i--) {               // i: 6, 5, 4, 3, 2, 1, 0
    const d = new Date(now)
    d.setDate(d.getDate() - i)                 // 6 days ago → today
    ...
    days.push({ date: formatShort(d), value: ... })
  }
  return days
}, [filteredExpenses])                         // lines 85-98
```

Iteration breakdown:

| i | `d` (relative to now) |
|---|---|
| 6 | 6 days ago |
| 5 | 5 days ago |
| 4 | 4 days ago |
| 3 | 3 days ago |
| 2 | 2 days ago |
| 1 | 1 day ago |
| 0 | **today** |

That's exactly 7 data points. The loop goes from `i=6` down to `i=0`, inclusive. The `dailyTotals` array has entries in chronological order (oldest first) because `i` decreases, pushing each day in sequence.

Statement E is **true**.

---

## Conclusion

| Statement | Verdict |
|---|---|
| **A** — `useEffect` saves on `expenses` change only | **True** |
| **B** — `categoryTotals` always includes all 5 categories | **Lie** |
| **C** — `getMonday` subtracts 6 for Sunday | **True** |
| **D** — `handleSubmit` blocks NaN, zero, and negative | **True** |
| **E** — `dailyTotals` iterates i=6 down to 0 (7 days) | **True** |

**The lie is Statement B.** The `categoryTotals` useMemo filters out categories whose total is $0 (line 78: `.filter(c => map[c.value] > 0)`). When no expenses match the current filter, the returned array is empty and the UI shows "No data" — not a pie chart with five zero-value slices.
