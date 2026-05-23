# Audit: Receipts

---

## 1. localStorage Failures

### What happens if localStorage is full?

`App.jsx:59` — `localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))` will throw a `QuotaExceededError` if the store is full. The `useEffect` has no try/catch. Once the error fires, no subsequent save will succeed on that same page session either (the effect keeps running, keeps failing).

**Blast radius:** The user adds an expense, sees it appear, then refreshes — and the expense is gone. They won't know why.

**How full is too full?** The localStorage quota is typically 5–10 MB. A single expense object is roughly 100 bytes. That gives us roughly 50,000–100,000 expenses before the quota is hit. But if the user has other sites using localStorage heavily (or if Receipts is one of many apps sharing the origin), the limit can be reached much sooner.

**Edge case — corrupted `JSON.parse`:** `App.jsx:47` is wrapped in try/catch and falls back to `[]`. Good. But a silent data loss is still data loss — no console warning, no UI feedback that old data was wiped. The user refreshes and finds their expenses gone.

### What happens if localStorage is unavailable?

- **Private/incognito mode in some browsers:** `localStorage` exists but throws on `setItem` after the quota is reached (Safari private mode gives 0 bytes). The `useEffect` at line 58 will crash silently — no try/catch.
- **Storage events:** The app does not listen for `storage` events from other tabs. If the user opens two tabs, adds expenses in tab A, then acts in tab B, tab B's `expenses` state is stale. Tab B will overwrite tab A's data on the next save (last-write-wins).

### Line references

| Risk | Location | Severity |
|---|---|---|
| `setItem` throws with no try/catch | `App.jsx:59` | High |
| Corrupt data silently resets to `[]` | `App.jsx:47-49` | Medium |
| No cross-tab sync (last-write-wins) | Missing `window.addEventListener('storage', ...)` | Medium |
| No UI feedback on storage failure | Missing anywhere | Medium |

### Recommendations

- Wrap `setItem` in try/catch; on failure, set a `storageError` flag and show a warning banner.
- Listen for the `storage` event to sync state across tabs.
- On `JSON.parse` failure, consider showing an alert rather than silently wiping data.
- Estimate or measure the byte size of the serialized list before saving; warn the user if they're approaching the quota.

---

## 2. Empty State Design

### What the user sees with zero expenses

The app currently shows:

1. **Header + form** — Full form, ready to use. This is fine — the form is the primary action.
2. **Filter buttons** — Three buttons, "This Week" highlighted. Fine.
3. **Total card** — Displays `$0.00`. This is clear.
4. **Donut chart** — Shows "No data" in the center of the card. The empty chart area still takes up ~260px of vertical space. The legend is hidden because no categories have spending.
5. **Bar chart** — Shows "No data." Same ~260px of empty space.
6. **Expense list** — Shows "No expenses yet." Clear and friendly.

### Assessment

The empty states are handled but **passive** — the user sees gray "No data" text inside blank chart cards. There's no onboarding, no sample data, no call to action beyond the form itself.

**What's missing:**
- No guidance for a first-time user (e.g., "Add your first expense above!")
- No illustration or visual hint in the empty charts — just text
- When switching to a filter with no data (e.g., "Last Week" with no expenses), "No data" appears. This is technically correct but could be more helpful: "No expenses last week. Try adding one or switching to All Time."

### Line references

| State | What renders | Location |
|---|---|---|
| Zero expenses total | `$0.00` | `App.jsx:173` |
| Zero category totals | `<p>No data</p>` | `App.jsx:200` |
| Zero daily totals | `<p>No data</p>` | `App.jsx:226` |
| Zero filtered expenses | `<p>No expenses yet</p>` | `App.jsx:234` |

### Recommendations

- Differentiate between "app just launched (no expenses ever)" and "filter returned nothing." Show onboarding for the former, a contextual message for the latter.
- Consider showing a brief getting-started hint below the form when `expenses.length === 0`.
- Replace bare "No data" with filter-aware messages: "No expenses this week" vs "No expenses last week."

---

## 3. Performance at 1,000 Expenses

### What the app does with every expense

Each expense object is roughly:
```json
{"id":"abc123","amount":5,"category":"food","date":"2026-05-19"}
```
~70 bytes. 1,000 expenses = ~70 KB. Fine.

### The O(n) operations

Every filter change or expense add/delete triggers these passes:

| Pass | Operation | Complexity |
|---|---|---|
| `filteredExpenses` | `.filter()` over all expenses | O(n) |
| `categoryTotals` | `.forEach()` over filtered list + `CATEGORIES.filter().map()` | O(n + 5) |
| `dailyTotals` | 7 iterations × (`.filter()` + `.reduce()` over filtered list) | O(7n) |
| `totalSpend` | `.reduce()` over filtered list | O(n) |
| Expense list render | `.map()` over filtered list | O(n) |

**Total per change:** roughly 10 passes over the filtered list. At 1,000 expenses, each pass is ~1,000 iterations — trivially fast. JavaScript does ~50 million simple ops per second, so 10,000 iterations is ~0.2 ms.

### Where it could slow down

- **Recharts rendering:** The bottleneck is DOM rendering, not data computation. A `PieChart` with 5 slices and a `BarChart` with 7 bars is negligible at any data size.
- **`.filter(e => e.date === key)` in dailyTotals loop:** This runs `filter` once per day (7 times). Each pass walks the entire filtered list. At 1,000 expenses, that's 7,000 comparisons. Still under 1 ms.
- **JSON serialization on every save:** `JSON.stringify(expenses)` for 1,000 items is ~70 KB. A modern browser can serialize that in under 1 ms. Even at 10,000 expenses (700 KB), it's ~5-10 ms.

### The real risk: localStorage quota, not speed

Performance is fine at 1,000. The real concern is hitting the localStorage quota long before the UI slows down. At 100 bytes per expense, 50,000 expenses would be ~5 MB — right at the boundary of the 5-10 MB limit. At that point `setItem` throws, and there's no error handling (see section 1).

### Judgment

**1,000 expenses is safe.** No virtualization, debouncing, or pagination is needed at this scale. The app could comfortably handle 10,000+ before any JS-side slowness. The localStorage quota is the earlier constraint.

### Recommendations

- If the app grows past ~5,000 expenses, consider paginating the expense list (show 50 at a time, load more on scroll).
- Monitor localStorage usage and warn before hitting the quota.
- Consider IndexedDB for larger datasets (it has higher quotas and supports partial reads).

---

## 4. Category Typos / Unknown Categories

### How categories are stored

`App.jsx:111` — A new expense stores `category` directly from the `<select>` element. The select limits choices to the five known values (`'food'`, `'transport'`, `'data'`, `'fun'`, `'other'`). As long as the select is used, unknown categories cannot be created through normal use.

### Attack vectors for unknown categories

1. **Direct localStorage manipulation:** A user edits `localStorage` in DevTools and sets `category: 'groceries'`. On reload, `categoryTotals` at line 76 does `map[e.category]` where map has no `'groceries'` key, so `map['groceries']` is `undefined`. The `|| 0` fallback kicks in: `(undefined || 0) + Number(e.amount)` → `0 + amount` → the amount is counted under... nowhere. The expense is effectively invisible in the donut chart.

2. **The expense list renders it anyway:** At `App.jsx:237`, `CATEGORIES.find(c => c.value === e.category)` returns `undefined` for `'groceries'`. Then:
   - `cat?.color` → `undefined` → the badge has no background color (white on white — invisible text)
   - `cat?.label` → `undefined` → the badge shows nothing

3. **The category total is silently lost.** The money was spent but doesn't appear in any chart slice. The total at line 100 still counts it, so the sum of all visible slices will be less than the displayed total. A user comparing "total = $50" vs "donut slices sum to $45" would see a discrepancy they can't explain.

### Data integrity issue

The category total map at line 73 initializes all known categories to 0:
```js
const map = {}
CATEGORIES.forEach(c => (map[c.value] = 0))
```

Then at line 76:
```js
map[e.category] = (map[e.category] || 0) + Number(e.amount)
```

For an unknown category, `map['groceries']` is `undefined`. The `|| 0` converts it to 0, then the amount is added. But this result is stored in `map['groceries']` — a key that is never read by the `CATEGORIES.filter(...)` at line 78. The money accumulates in a dead key.

### Defensive fixes

- At `App.jsx:78`, change `CATEGORIES.filter(c => map[c.value] > 0)` to include an "Unknown" bucket for any leftover amounts.
- Or, in `handleSubmit`, validate `category` against `CATEGORIES.map(c => c.value)` before saving.
- When rendering, add a fallback for unknown categories:
  ```js
  const cat = CATEGORIES.find(c => c.value === e.category) || { label: 'Unknown', color: '#ccc' }
  ```

### Line references

| Risk | Location |
|---|---|
| Category stored directly from select (trusted input) | `App.jsx:111` |
| Unknown category totals accumulate in dead map key | `App.jsx:76` |
| Unknown categories render invisible badge | `App.jsx:237, 240-241` |
| Category filter skips unknown keys | `App.jsx:78` |

### Recommendations

- Validate `category` against known values in `handleSubmit`.
- Add an "Unknown" fallback in the render path.
- Sum the category map values and the donut chart values independently; if they don't match, flag the discrepancy.

---

## 5. Currency Assumptions

### Hardcoded dollar sign

`App.jsx:173` — `${totalSpend.toFixed(2)}` — hardcoded `$` prefix.
`App.jsx:248` — `${Number(e.amount).toFixed(2)}` — also hardcoded `$`.

The app assumes USD in three ways:
1. **Symbol:** `$` is hardcoded as a string. Users in the UK (£), Europe (€), Japan (¥), or anywhere else see the wrong currency symbol.
2. **Format:** `toFixed(2)` always shows two decimal places. This is correct for USD but wrong for currencies like JPY (0 decimals) or KWD (3 decimals).
3. **Locale:** `toLocaleDateString` for dates is hardcoded to `'en-US'` at `App.jsx:36` and `App.jsx:244`. This is consistent but doesn't respect the user's regional settings.

### Why this matters

Even if the user thinks of their spending in dollars, the hardcoded `$` is fine for an English-speaking US audience. But the app has no mechanism to switch currencies or regions. If someone enters amounts in euros, the chart says `$` but the data is in € — misleading if shown to anyone else.

### Deeper issue: no currency information in the data model

The expense object at `App.jsx:111` stores `amount` as a bare number:
```json
{ "amount": 5, "category": "food", "date": "2026-05-19" }
```

There's no `currency` field. If the user travels or switches currencies, there's no way to know which currency a given expense was in.

### What would need to change

- Replace `$` with `Intl.NumberFormat` for proper locale-aware currency formatting.
- Remove the hardcoded `'en-US'` from date formatting so it uses the browser's default locale.
- Optionally, add a currency selector and store the currency with each expense.

### Line references

| Assumption | Location |
|---|---|
| Hardcoded `$` prefix in total card | `App.jsx:173` |
| Hardcoded `$` prefix in expense list | `App.jsx:248` |
| Hardcoded `'en-US'` locale in date formatting | `App.jsx:36` |
| Hardcoded `'en-US'` locale for expense dates | `App.jsx:244` |
| `toFixed(2)` assumes 2-decimal currency | `App.jsx:173, 248` |
| No currency field in data model | `App.jsx:111` |

### Recommendations

- Use `Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })` — or better, make the currency configurable.
- Use `date.toLocaleDateString(undefined, ...)` to respect the user's browser locale.
- Consider adding a `currency` property to each expense and a top-level currency default setting.

---

## Summary of Issues by Severity

| Issue | Severity | Impact |
|---|---|---|
| `setItem` can throw silently — data loss | High | User adds expenses, refreshes, they're gone |
| Cross-tab overwrite (last-write-wins) | High | Concurrent tabs corrupt each other's data |
| Corrupt localStorage silently resets to `[]` | Medium | User loses all data, no explanation |
| Unknown category amounts are invisible | Medium | Money disappears from charts; total doesn't match |
| Hardcoded `$` and `en-US` | Low | Wrong format for non-US users |
| Empty states are functional but bare | Low | No onboarding for new users |
| No quota monitoring or warning | Low | User hits limit without warning |
| Performance is fine at 1,000 expenses | None | No action needed at current scale |
