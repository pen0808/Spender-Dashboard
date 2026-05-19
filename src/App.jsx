import { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts'
import './App.css'

const CATEGORIES = [
  { value: 'food', label: 'Food', color: '#FF6384' },
  { value: 'transport', label: 'Transport', color: '#36A2EB' },
  { value: 'data', label: 'Data', color: '#FFCE56' },
  { value: 'fun', label: 'Fun', color: '#4BC0C0' },
  { value: 'other', label: 'Other', color: '#9966FF' },
]

const STORAGE_KEY = 'receipts_expenses'

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isInWeek(dateStr, weekStart) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return d >= start && d < end
}

function formatShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function App() {
  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(todayStr())
  const [filter, setFilter] = useState('this-week')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
  }, [expenses])

  const filteredExpenses = useMemo(() => {
    const thisMonday = getMonday(new Date())
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(lastMonday.getDate() - 7)

    if (filter === 'this-week') return expenses.filter(e => isInWeek(e.date, thisMonday))
    if (filter === 'last-week') return expenses.filter(e => isInWeek(e.date, lastMonday))
    return expenses
  }, [expenses, filter])

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

  const totalSpend = useMemo(
    () => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [filteredExpenses],
  )

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

  function handleDelete(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const filterLabel =
    filter === 'this-week' ? 'This Week' :
    filter === 'last-week' ? 'Last Week' : 'All Time'

  const allZero = dailyTotals.every(d => d.value === 0)

  return (
    <div className="app">
      <header className="header">
        <h1>Receipts</h1>
        <p className="subtitle">Track your spending</p>
      </header>

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

      <div className="total-card">
        <span className="total-label">{filterLabel} Total</span>
        <span className="total-amount">${totalSpend.toFixed(2)}</span>
      </div>

      <div className="charts">
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
      </div>

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
    </div>
  )
}
