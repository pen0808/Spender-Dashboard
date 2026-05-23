# 🧸 Receipts — Explained Like You're 7

Imagine you have a **piggy bank** that remembers every coin you tell it about. You say "I spent $5 on food today" and it writes it down. Then it draws pictures (charts!) so you can see where your money went.

The app always works with **three layers**:

1. **The Master List** — `expenses` holds EVERY expense you've ever added (like a big box of all your receipts)
2. **The Filtered View** — `filteredExpenses` is a copy of just the receipts you asked to see (this week / last week / all time)
3. **The Charts** — `categoryTotals` and `dailyTotals` are pictures made FROM the filtered view

Crucially: **we never throw away the master list**. When you switch filters, we don't delete anything — we just look at the master list through different glasses.

---

## 📄 File: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Receipts</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Line 1:** `<!doctype html>` — Says "Hey browser, this is an HTML page!"

**Line 2:** `<html lang="en">` — The whole page starts here. The language is English.

**Lines 3–7:** The `<head>` is like the brain of the page — it holds secret info:
- **Line 4:** `charset="UTF-8"` — Lets the page show letters, emojis, and symbols properly.
- **Line 5:** `viewport` — Tells the phone/tablet how to zoom so it looks nice.
- **Line 6:** The title that shows up on the browser tab: **Receipts**.

**Line 8:** `<body>` — Everything you see on the screen goes here.

**Line 9:** `<div id="app"></div>` — An empty box. React will fill this box with all our stuff.

**Line 10:** `<script type="module" src="/src/main.jsx"></script>` — "Hey browser, go grab this JavaScript file and run it." That file will wake up React and put our app inside the `<div id="app">` box.

**Lines 11–12:** Close the body and html tags.

---

## 📄 File: `src/main.jsx`

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**Line 1:** `import { StrictMode } from 'react'` — Gets a tool from React that checks for mistakes in our code (like a strict teacher).

**Line 2:** `import { createRoot } from 'react-dom/client'` — Gets the tool that lets React paint inside our HTML page.

**Line 3:** `import App from './App'` — Gets the main **App** component (the boss of our app) from the `App.jsx` file.

**Line 5:** `createRoot(document.getElementById('app'))` — Finds the empty `<div id="app">` box from `index.html` and tells React "this is where you'll work."

**Line 6:** `.render(<StrictMode> ... </StrictMode>)` — Tells React to draw the `<App />` inside that box.

---

## 📄 File: `src/App.jsx`

This is the **heart** of the app!

---

### The Imports (Lines 1–6)

```jsx
import { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts'
import './App.css'
```

**Line 1:** `import { useState, useEffect, useMemo } from 'react'` — We bring in three magic tools from React:
- `useState` — a magic notebook. If we write something in it, React remembers it and updates the screen when it changes.
- `useEffect` — a "do this whenever that changes" button. We use it to save expenses to localStorage.
- `useMemo` — a "remember the answer so you don't recompute it" helper. We use this **a lot** — it's how we turn raw expenses into chart data without recalculating every millisecond.

**Lines 2–5:** We bring in chart pieces from a library called `recharts`. These are like LEGO blocks for drawing:
- `PieChart` and `Pie` — for the donut chart (the circle with slices)
- `Cell` — colors each slice of the donut
- `ResponsiveContainer` — makes the chart shrink/grow with the screen
- `BarChart`, `Bar`, `XAxis`, `YAxis` — for the bar chart (the rectangle towers)
- `Tooltip` — the little popup that appears when you hover over a slice or bar

**Line 6:** `import './App.css'` — Brings in the styling (colors, sizes, fonts) from `App.css`.

---

### The Category List (Lines 8–14)

```jsx
const CATEGORIES = [
  { value: 'food', label: 'Food', color: '#FF6384' },
  { value: 'transport', label: 'Transport', color: '#36A2EB' },
  { value: 'data', label: 'Data', color: '#FFCE56' },
  { value: 'fun', label: 'Fun', color: '#4BC0C0' },
  { value: 'other', label: 'Other', color: '#9966FF' },
]
```

**Lines 8–14:** We make a list called `CATEGORIES` with five buckets you can put money into. Each bucket has three things:
- `value` — a secret short name (like `'food'`) used inside the code
- `label` — the name you see on screen (like `'Food'`)
- `color` — the color of that slice in the donut chart

**Line 16:** `const STORAGE_KEY = 'receipts_expenses'` — This is the secret code we use to save and load from localStorage. Think of it as a drawer label in your magic wardrobe.

---

### Helper Functions (Lines 18–41)

These are tiny workers that do one simple job each.

```jsx
function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
```

**Lines 18–25:** `getMonday` — This helper answers the question: "What was the Monday of the week that contains this date?"

Let's break it down:
- **Line 19:** Make a copy of the date so we don't mess up the original.
- **Line 20:** `d.getDay()` asks "what day of the week is this?" It gives us a number: 0 = Sunday, 1 = Monday, 2 = Tuesday, ... 6 = Saturday.
- **Line 21:** This is the secret formula. We figure out how many days to go back to reach Monday. If today is Wednesday (day 3), we go back 2 days. If today is Sunday (day 0), we go back 6 days (to the previous Monday).
- **Line 22:** Jump back to that Monday.
- **Line 23:** Set the time to midnight (the very start of the day).
- **Line 24:** Return the Monday date.

Why do we need this? So we can figure out which expenses belong to "this week" vs "last week."

```jsx
function isInWeek(dateStr, weekStart) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return d >= start && d < end
}
```

**Lines 27–33:** `isInWeek` — This helper asks: "Does this date fall inside a particular week?"

- **Line 28:** Turn the date string (like `'2026-05-19'`) into a real Date object at midnight.
- **Line 29:** Make a copy of the week's Monday.
- **Lines 30–31:** Calculate the end of the week by adding 7 days to Monday. That gives us the NEXT Monday.
- **Line 32:** Check if the date is on or after Monday AND before next Monday. If yes, it's in that week!

Think of it like: "Is May 19 inside the week that starts Monday May 18 and ends before Monday May 25?"

```jsx
function formatShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

**Lines 35–37:** `formatShort` — Turns a Date into something readable like "May 19".

```jsx
function todayStr() {
  return new Date().toISOString().split('T')[0]
}
```

**Lines 39–41:** `todayStr` — Gets today's date as a string like `'2026-05-19'` so we can put it in the date input box.

---

### The App Component Starts (Line 43)

```jsx
export default function App() {
```

**Line 43:** We create the main function called `App`. `export default` means other files can use it. This is the big boss of our app.

---

### State Variables — The Magic Notebooks (Lines 44–56)

```jsx
  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
```

**Lines 44–51:** `expenses` — This is **THE MASTER LIST**. It holds every single expense the user has ever added. Each expense is an object with four things:
- `id` — a unique secret code so we can tell expenses apart
- `amount` — how much money (like `5.50`)
- `category` — which bucket it belongs to (like `'food'`)
- `date` — when it happened (like `'2026-05-19'`)

The special trick: the initial value of `expenses` comes from `localStorage`! Look at the function inside `useState(() => { ... })`. This function runs **once** when the app first loads:
1. It looks inside the browser's magic closet (`localStorage`) for a key called `'receipts_expenses'`
2. If it finds something, it turns it from a string back into a list (`JSON.parse`)
3. If it finds nothing (or something breaks), it starts with an empty list `[]`

**This is how expenses survive a page refresh.** The master list is loaded from localStorage when you open the page.

```jsx
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(todayStr())
  const [filter, setFilter] = useState('this-week')
```

**Lines 53–56:** Four more notebooks:
- `amount` — what the user is typing in the "Amount" box (starts empty)
- `category` — which category is selected in the dropdown (starts as `'food'`)
- `date` — the selected date (starts as today)
- `filter` — which time filter is active (starts as `'this-week'`)

---

### The Save Effect — Writing to localStorage (Lines 58–60)

```jsx
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
  }, [expenses])
```

**Lines 58–60:** `useEffect` — "Every time `expenses` changes, save it to the magic closet."

This is the **save** side of the save/load pair:
- Load happens at startup (lines 44–51)
- Save happens here (lines 58–60)

Every time you add or delete an expense, `expenses` changes, and this effect runs. It turns the whole list into a string (`JSON.stringify`) and tucks it into localStorage. 

**Important:** The `[expenses]` at the end (called the "dependency array") means "only run this when `expenses` changes." If we left it empty, it would save once and never again. If we left it out entirely, it would save on EVERY little change (even typing a letter).

---

### THE BIG IDEA: Derived State with useMemo

Now we get to the most important part of the whole app. These next blocks use `useMemo` to **derive** new information from the master list.

The pipeline looks like this:

```
expenses (master list, raw data)
    │
    ├── filteredExpenses (same data, but filtered by week)
    │       │
    │       ├── categoryTotals (for the donut chart)
    │       ├── dailyTotals (for the bar chart)
    │       └── totalSpend (for the big number display)
```

Each step is a `useMemo` that only recalculates when its input changes. This is called **derived state** — we don't store the chart data separately; we compute it fresh from `filteredExpenses` whenever it needs to change.

---

### Filtered Expenses (Lines 62–70)

```jsx
  const filteredExpenses = useMemo(() => {
    const thisMonday = getMonday(new Date())
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(lastMonday.getDate() - 7)

    if (filter === 'this-week') return expenses.filter(e => isInWeek(e.date, thisMonday))
    if (filter === 'last-week') return expenses.filter(e => isInWeek(e.date, lastMonday))
    return expenses
  }, [expenses, filter])
```

**Lines 62–70:** This is the **filtering step**. It takes the master list and picks only the expenses that match the current filter.

- **Line 63:** Figure out when this week's Monday is.
- **Lines 64–65:** Figure out when last week's Monday is (7 days before this Monday).
- **Line 67:** If filter is `'this-week'`, keep only expenses whose date is inside this week.
- **Line 68:** If filter is `'last-week'`, keep only expenses whose date is inside last week.
- **Line 69:** If filter is `'all-time'`, keep ALL expenses (don't filter at all!).

**How filtering works WITHOUT mutating the original list:**
- `expenses.filter(...)` creates a **brand new array**. It doesn't change `expenses` at all.
- The original `expenses` always stays the same — it's the master list.
- `filteredExpenses` is a new copy each time the filter changes.
- Think of it like this: you have a big box of LEGO bricks. When you want to see only the red ones, you don't throw away the blue ones. You just pick out the red ones and put them in a separate pile. The original box is still there.

**Why `useMemo`?** Without it, `filteredExpenses` would be recomputed on EVERY render — even if `expenses` and `filter` haven't changed. `useMemo` says "only recompute when `expenses` or `filter` changes." The `[expenses, filter]` at the end are the dependency array.

---

### Category Totals — The Donut Chart Data (Lines 72–83)

```jsx
  const categoryTotals = useMemo(() => {
    const map = {}
    CATEGORIES.forEach(c => (map[c.value] = 0))
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount)
    })
    return CATEGORIES.filter(c => map[c.value] > 0).map(c => ({
      name: c.label,
      value: Math.round(map[c.value] * 100) / 100,
      color: c.color,
    }))
  }, [filteredExpenses])
```

**Lines 72–83:** This turns the filtered expenses into data for the **donut chart**. Here's the step-by-step:

**Step 1 (Line 73):** Create an empty box called `map`. It will hold totals like: `{ food: 0, transport: 0, data: 0, fun: 0, other: 0 }`.

**Step 2 (Line 74):** Set each category's starting total to 0.

**Step 3 (Lines 75–77):** Go through every expense in `filteredExpenses`. For each expense, add its amount to the right category bucket. If it's a food expense, add its amount to the `food` bucket. `map[e.category]` says "get the bucket named after this expense's category."

**Step 4 (Lines 78–82):** Now turn the map into a list the chart can understand:
- `CATEGORIES.filter(c => map[c.value] > 0)` — Only keep categories that have money in them. If nobody spent on "Fun," we don't show a Fun slice.
- `.map(c => ({ name: c.label, value: Math.round(map[c.value] * 100) / 100, color: c.color }))` — For each category that has money, make an object with:
  - `name` — the label (like `'Food'`)
  - `value` — the total, rounded to 2 decimal places (`Math.round(x * 100) / 100`)
  - `color` — the category's color

**Why `Math.round(map[c.value] * 100) / 100`?** This is a trick to round to 2 decimal places. Multiply by 100 (turning $5.679 into 567.9), round it (568), divide by 100 (5.68). This prevents floating-point weirdness like $0.10000000000001.

**The chain of derivation:**
```
expenses → filteredExpenses (filtered) → categoryTotals (summed by category)
```

---

### Daily Totals — The Bar Chart Data (Lines 85–98)

```jsx
  const dailyTotals = useMemo(() => {
    const now = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const total = filteredExpenses
        .filter(e => e.date === key)
        .reduce((s, e) => s + Number(e.amount), 0)
      days.push({ date: formatShort(d), value: Math.round(total * 100) / 100 })
    }
    return days
  }, [filteredExpenses])
```

**Lines 85–98:** This turns the filtered expenses into data for the **bar chart**. The bar chart shows daily spending for the last 7 days.

- **Line 86:** Get today's date and time.
- **Line 87:** Create an empty list called `days` to hold the results.
- **Line 88:** `for (let i = 6; i >= 0; i--)` — Count down from 6 to 0. Why 6? Because we want 7 days total (today + the 6 days before today).
  - When `i = 6`, that's 6 days ago
  - When `i = 5`, that's 5 days ago
  - ...
  - When `i = 0`, that's today
- **Line 89:** Make a copy of `now` so we don't mess it up.
- **Line 90:** Go back `i` days. If `i = 2`, the date becomes "2 days ago."
- **Line 91:** Turn that date into a string key like `'2026-05-17'`.
- **Lines 92–94:** Look at all `filteredExpenses` and pick only the ones whose date matches this day. Then add up all their amounts using `reduce`. `reduce` goes through each expense, one by one, and keeps a running total (`s` starts at 0, and for each expense `e`, it adds `e.amount` to `s`).
- **Line 95:** Add an object to the `days` list with the formatted date (like `"May 17"`) and the rounded total.

After the loop, `days` looks like:
```js
[
  { date: 'May 13', value: 0 },
  { date: 'May 14', value: 12.50 },
  { date: 'May 15', value: 0 },
  { date: 'May 16', value: 8.00 },
  { date: 'May 17', value: 0 },
  { date: 'May 18', value: 25.00 },
  { date: 'May 19', value: 5.50 },
]
```

**The chain of derivation:**
```
expenses → filteredExpenses (filtered) → dailyTotals (grouped by date)
```

---

### Total Spend (Lines 100–103)

```jsx
  const totalSpend = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [filteredExpenses],
  )
```

**Lines 100–103:** This is the simplest derivation. It just adds up ALL the amounts in `filteredExpenses`. `reduce` walks through the list, starting with 0, and adds each expense's amount.

**The chain of derivation:**
```
expenses → filteredExpenses (filtered) → totalSpend (summed)
```

---

### Adding an Expense (Lines 105–114)

```jsx
  function handleSubmit(e) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0 || !date) return
    setExpenses(prev => [
      ...prev,
      { id: crypto.randomUUID(), amount: amt, category, date },
    ])
    setAmount('')
  }
```

**Lines 105–114:** When you click the "Add" button:
1. **Line 106:** `e.preventDefault()` — Stop the page from refreshing (forms love to refresh pages).
2. **Line 107:** Turn the amount text into a real number.
3. **Line 108:** If the amount is empty, zero, or negative, or if there's no date — stop! Don't add it.
4. **Lines 109–112:** `setExpenses(prev => [...prev, { ... }])` — This is the immutability pattern:
   - `prev` is the current master list
   - `...prev` spreads all existing expenses into a new array
   - We add the new expense object at the end
   - The new expense has: `id` (a unique fingerprint from `crypto.randomUUID()`), `amount`, `category`, and `date`
5. **Line 113:** Clear the amount input so you can type another one.

**Important:** We never use `.push()` (which would change the original list). Instead we `[...prev, newItem]` which creates a **brand new list** with the new item added. The old list stays unchanged.

---

### Deleting an Expense (Lines 116–118)

```jsx
  function handleDelete(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }
```

**Lines 116–118:** When you click the ❌ button on an expense:
- `prev.filter(e => e.id !== id)` creates a **brand new list** that includes every expense EXCEPT the one whose `id` matches. It's like saying "everyone except that one, stay!" 

Again, no mutation. The old list is not changed. A new list is created.

---

### Filter Label and All-Zero Check (Lines 120–124)

```jsx
  const filterLabel =
    filter === 'this-week' ? 'This Week' :
    filter === 'last-week' ? 'Last Week' : 'All Time'

  const allZero = dailyTotals.every(d => d.value === 0)
```

**Lines 120–122:** `filterLabel` — Turn the filter code into a human-readable name. If filter is `'this-week'`, show "This Week." If `'last-week'`, show "Last Week." Otherwise, "All Time."

**Line 124:** `allZero` — Check if every day in the daily chart has zero spending. We use this to decide whether to show the bar chart or the "No data" message.

---

### The Return — What You See on Screen (Lines 126–258)

Now we draw everything!

---

#### App Container and Header (Lines 127–131)

```jsx
      <header className="header">
        <h1>Receipts</h1>
        <p className="subtitle">Track your spending</p>
      </header>
```

**Lines 128–131:** The title at the top: **Receipts** with a little subtitle "Track your spending."

---

#### The Add Form (Lines 133–157)

```jsx
      <form className="add-form" onSubmit={handleSubmit}>
        <input
          className="add-input"
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        <select className="add-select" value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          className="add-input"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />
        <button className="add-btn" type="submit">Add</button>
      </form>
```

**Lines 133–157:** The form where you type your expense:
- **Amount input** — type numbers. `step="0.01"` lets you use decimals (cents). `min="0"` stops negative numbers.
- **Category select** — a dropdown with all five categories (Food, Transport, Data, Fun, Other). We generate the options by looping through `CATEGORIES` with `.map()`.
- **Date input** — a calendar picker that starts on today.
- **Add button** — when clicked, it runs `handleSubmit` which calls `setExpenses` to add the new expense to the master list.

Every time you type, select, or pick a date, the corresponding `onChange` handler updates the state (amount, category, date). The form uses `value={...}` so React controls what's shown (this is called a "controlled component").

---

#### The Filter Buttons (Lines 159–169)

```jsx
      <div className="filters">
        {['this-week', 'last-week', 'all-time'].map(f => (
          <button
            key={f}
            className={`filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'this-week' ? 'This Week' : f === 'last-week' ? 'Last Week' : 'All Time'}
          </button>
        ))}
      </div>
```

**Lines 159–169:** Three buttons: "This Week", "Last Week", "All Time."

When you click one, `setFilter(f)` changes the filter state. This triggers `useMemo` to recalculate `filteredExpenses`, which triggers `categoryTotals`, `dailyTotals`, and `totalSpend` to recalculate too.

The currently active button gets the CSS class `active`, which turns it blue. The other buttons stay white.

**The full chain when you click "Last Week":**
1. `setFilter('last-week')` — changes the filter
2. `filteredExpenses` recalculates — picks only last week's expenses
3. `categoryTotals` recalculates — sums categories from the new filtered list
4. `dailyTotals` recalculates — groups by day from the new filtered list
5. `totalSpend` recalculates — sums everything in the new filtered list
6. The screen updates with new charts and new total

All of this happens automatically because each `useMemo` depends on the previous one:
- `filteredExpenses` depends on `[expenses, filter]`
- `categoryTotals` depends on `[filteredExpenses]`
- `dailyTotals` depends on `[filteredExpenses]`
- `totalSpend` depends on `[filteredExpenses]`

---

#### The Total Card (Lines 171–174)

```jsx
      <div className="total-card">
        <span className="total-label">{filterLabel} Total</span>
        <span className="total-amount">${totalSpend.toFixed(2)}</span>
      </div>
```

**Lines 171–174:** A white card showing the total spending. `toFixed(2)` makes sure it always shows two decimal places (like `$42.50` instead of `$42.5`).

---

#### The Charts Section (Lines 176–229)

```jsx
      <div className="charts">
```

**Line 176:** A container that holds both charts side by side (or stacked on small screens).

---

##### The Donut Chart (Lines 177–212)

```jsx
        <div className="chart-card">
          <h3 className="chart-title">By Category</h3>
          {categoryTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryTotals}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {categoryTotals.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-chart">No data</p>
          )}
          <div className="legend">
            {CATEGORIES.filter(c =>
              categoryTotals.some(t => t.name === c.label && t.value > 0)
            ).map(c => (
              <span key={c.value} className="legend-item">
                <span className="legend-dot" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
          </div>
        </div>
```

**Line 179:** `{categoryTotals.length > 0 ? (...)` — If there are no expenses in the current filter, don't draw the chart. Show "No data" instead.

**Lines 180–198:** The donut chart:
- `ResponsiveContainer` — makes the chart automatically fit its container
- `PieChart` — the chart wrapper
- `Pie` — the actual donut shape
  - `data={categoryTotals}` — **THIS IS WHERE THE CHART GETS ITS DATA.** It uses the `categoryTotals` we computed in the `useMemo` above.
  - `dataKey="value"` — "Use the `value` field of each data item to determine the slice size."
  - `nameKey="name"` — "Use the `name` field for labels."
  - `cx="50%" cy="50%"` — Center the donut in the middle.
  - `innerRadius={60}` — How big the hole in the middle is. This is what makes it a DONUT instead of a PIE.
  - `outerRadius={100}` — How big the whole circle is.
  - `paddingAngle={3}` — A tiny gap between slices so they don't touch.
- `Cell` components — Each slice gets its category's color via `fill={entry.color}`.
- `Tooltip` — When you hover over a slice, a little box pops up showing the exact value.

**Lines 202–210:** The legend — colored dots with category names below the chart. We filter `CATEGORIES` to only show categories that have more than zero dollars in the current view.

---

##### The Bar Chart (Lines 214–228)

```jsx
        <div className="chart-card">
          <h3 className="chart-title">Daily Spending (7 Days)</h3>
          {!allZero ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyTotals}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#36A2EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-chart">No data</p>
          )}
        </div>
```

**Line 216:** `{!allZero ? (...)` — If ALL 7 days have zero spending, show "No data" instead of the chart.

**Lines 217–224:** The bar chart:
- `ResponsiveContainer` — auto-sizing container
- `BarChart data={dailyTotals}` — **THIS IS WHERE THE BAR CHART GETS ITS DATA.** It uses `dailyTotals` from the `useMemo` above.
- `XAxis dataKey="date"` — The labels on the bottom are from the `date` field (like "May 13", "May 14", ...)
- `YAxis` — The numbers on the left show dollar amounts
- `Tooltip` — Hover popup
- `Bar dataKey="value"` — The height of each bar comes from the `value` field. `fill="#36A2EB"` makes all bars blue. `radius={[4, 4, 0, 0]}` rounds the top corners of the bars.

---

#### The Expense List (Lines 231–256)

```jsx
      <div className="expense-list">
        <h3 className="list-title">Expenses</h3>
        {filteredExpenses.length === 0 ? (
          <p className="empty-list">No expenses yet</p>
        ) : (
          filteredExpenses.map(e => {
            const cat = CATEGORIES.find(c => c.value === e.category)
            return (
              <div key={e.id} className="expense-item">
                <span className="expense-cat" style={{ background: cat?.color }}>
                  {cat?.label}
                </span>
                <span className="expense-date">
                  {new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
                <span className="expense-amount">${Number(e.amount).toFixed(2)}</span>
                <button className="delete-btn" onClick={() => handleDelete(e.id)} title="Delete">
                  &times;
                </button>
              </div>
            )
          })
        )}
      </div>
```

**Lines 231–256:** The list of expenses at the bottom:
- **Line 233:** If there are no filtered expenses, show "No expenses yet."
- **Line 236:** `filteredExpenses.map(e => ...)` — Loop through each filtered expense and draw a row.
- **Line 237:** `CATEGORIES.find(c => c.value === e.category)` — Look up the category object by its value so we can get the label and color.
- **Line 240:** The category badge — a colored pill showing the category name (like "Food" in pink).
- **Lines 243–246:** The date, formatted nicely (like "May 19, 2026").
- **Line 248:** The amount, always with 2 decimal places.
- **Lines 249–251:** The delete button, which calls `handleDelete(e.id)` when clicked.

---

### A Complete Walkthrough

Let's trace what happens when you use the app:

**You open the page:**
1. `index.html` loads → `main.jsx` runs → `<App />` mounts
2. `useState(() => localStorage.getItem(...))` loads saved expenses from your previous session
3. If there's nothing saved, you start with an empty list
4. All the `useMemo` calculations run with the empty list → all charts show "No data"
5. The screen shows: an empty form, "This Week" filter active, total is $0.00, empty charts, "No expenses yet"

**You add "$5 for food on May 19":**
1. Type "5" in amount, select "Food", keep today's date, click Add
2. `handleSubmit` runs → `setExpenses([...prev, newExpense])` adds the new expense
3. `expenses` changes → `useEffect` saves to localStorage
4. `filteredExpenses` recalculates (May 19 is in this week, so it appears)
5. `categoryTotals` recalculates → `{ name: 'Food', value: 5, color: '#FF6384' }`
6. `dailyTotals` recalculates → May 19's bar rises to $5
7. `totalSpend` recalculates → $5.00
8. Screen updates: donut shows a pink slice, bar chart has a blue bar, total says $5.00, expense list shows your row

**You click "Last Week":**
1. `setFilter('last-week')` stores the new filter
2. `filteredExpenses` recalculates — May 19 is NOT in last week, so the list is empty
3. `categoryTotals` → empty (no expenses in last week)
4. `dailyTotals` → all zeros (no expenses in last week)
5. `totalSpend` → $0.00
6. Screen updates: donut says "No data", bar chart says "No data", total is $0.00, list says "No expenses yet"

**The master list (`expenses`) still has the $5 food expense. It never got deleted.** We're just looking at a different slice of time.

**You switch back to "This Week":**
1. `filteredExpenses` recalculates with the same filter — same result as before
2. All charts and total go back to showing the $5 food expense

**You delete the expense:**
1. Click ❌ → `handleDelete(id)` → `setExpenses(prev => prev.filter(...))`
2. The expense is removed from the master list
3. `filteredExpenses`, `categoryTotals`, `dailyTotals`, `totalSpend` all recalculate
4. Everything goes back to empty/zero
5. `useEffect` saves the empty list to localStorage

---

## 📄 File: `vite.config.js`

```jsx
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**Line 1:** Import Vite's config helper.

**Line 2:** Import the React plugin so Vite knows how to handle JSX files.

**Lines 4–6:** Tell Vite to use the React plugin. That's it — a simple config.

---

## 📄 File: `package.json`

```json
{
  "name": "receipts",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.2",
    "vite": "^8.0.12"
  },
  "dependencies": {
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "recharts": "^2.15.3"
  }
}
```

**Line 2:** The project's name is **receipts**.

**Line 3:** `"private": true` — this app is private (not published online for everyone).

**Line 4:** Version `0.0.0` — just starting out!

**Line 5:** `"type": "module"` — we use modern JavaScript `import` statements.

**Scripts:**
- **Line 7:** `"dev": "vite"` — `npm run dev` starts a dev server so you can see your app while building it.
- **Line 8:** `"build": "vite build"` — `npm run build` packages the app into a `dist/` folder ready to share.
- **Line 9:** `"preview": "vite preview"` — lets you preview the built version.

**Dependencies** (tools our app needs):
- **`vite`** — a fast tool that bundles our code and runs the dev server
- **`react`** — the library that helps us build interactive UIs easily
- **`react-dom`** — the part of React that talks to the web browser
- **`recharts`** — a library of chart LEGO blocks (PieChart, BarChart, etc.)

---

## 🎮 How It All Works Together (The Big Picture)

1. You open `index.html` in a browser.
2. It loads `src/main.jsx`, which tells React to wake up.
3. React runs `App.jsx` — the boss component.
4. `App.jsx` loads any saved expenses from localStorage (your piggy bank's memory).
5. You see an empty form, some filter buttons, two empty charts, and an empty list.
6. You type "$5 for Food on May 19" and click Add.
7. The expense gets added to the **master list** (`expenses`) with a unique ID.
8. The master list gets saved to localStorage automatically.
9. The **derived state** chain kicks off:
   - `filteredExpenses` picks expenses matching the active filter
   - `categoryTotals` sums by category → feeds the donut chart
   - `dailyTotals` groups by day → feeds the bar chart
   - `totalSpend` adds everything up → shows the total
10. The screen updates with charts, totals, and your expense in the list.
11. You can switch filters with a button click — no data is lost, just viewed differently.
12. Close the page and reopen it — your expenses are still there (thank you, localStorage!).
13. Click ❌ on an expense and it disappears forever.

And that's Receipts! 🎉

---

## 🧠 Key Concepts Summary

### Derived State
We NEVER store chart data separately. Everything is computed fresh from `filteredExpenses` using `useMemo`. The chain is:

```
expenses (master)
    → filteredExpenses (filtered copy)
        → categoryTotals (summed by category)
        → dailyTotals (grouped by day)
        → totalSpend (total sum)
```

### No Mutation
We NEVER change the original list. Every operation creates a new list:
- `[...prev, newItem]` — add (spread operator)
- `prev.filter(e => e.id !== id)` — delete (array filter)
- `expenses.filter(e => isInWeek(...))` — filter (array filter)

### Derivation vs Storage
The app stores only ONE thing: the raw expenses list (in useState + localStorage). Everything else — charts, totals, filtered views — is **derived** from that one source of truth. This means they can never become out of sync. If you add an expense, the charts update automatically because they read from the same data.
