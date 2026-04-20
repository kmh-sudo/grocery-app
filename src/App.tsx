import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseEnabled, supabase } from './lib/supabase'
import './App.css'

type Filter = 'all' | 'pending' | 'bought'

type GroceryItem = {
  id: string
  name: string
  note: string
  bought: boolean
}

const STORAGE_KEY = 'grocery-items'
const INITIAL_ITEMS: GroceryItem[] = [
  { id: 'sample-1', name: 'Milk', note: '2 liters', bought: false },
  { id: 'sample-2', name: 'Eggs', note: '1 dozen', bought: false },
  { id: 'sample-3', name: 'Rice', note: '5 kg bag', bought: false },
]
const SHARED_FAMILY_ID = 'family-shared'

const loadItems = (): GroceryItem[] => {
  const storedValue = localStorage.getItem(STORAGE_KEY)
  if (!storedValue) return INITIAL_ITEMS

  try {
    const parsed = JSON.parse(storedValue) as GroceryItem[]
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item) => typeof item?.name === 'string')
  } catch {
    return []
  }
}

function App() {
  const [items, setItems] = useState<GroceryItem[]>(() => loadItems())
  const [session, setSession] = useState<Session | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [appLoading, setAppLoading] = useState(Boolean(isSupabaseEnabled))
  const [statusMessage, setStatusMessage] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingNote, setEditingNote] = useState('')

  const filteredItems = useMemo(() => {
    if (filter === 'pending') {
      return items.filter((item) => !item.bought)
    }

    if (filter === 'bought') {
      return items.filter((item) => item.bought)
    }

    return items
  }, [items, filter])

  const hasBoughtItems = items.some((item) => item.bought)
  const pendingCount = items.filter((item) => !item.bought).length
  const boughtCount = items.length - pendingCount

  const saveItems = (nextItems: GroceryItem[]) => {
    setItems(nextItems)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems))
  }

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return
    const client = supabase

    let ignore = false

    const boot = async () => {
      const { data, error } = await client.auth.getSession()
      if (ignore) return

      if (error) {
        setStatusMessage(error.message)
      } else {
        setSession(data.session)
      }
      setAppLoading(false)
    }

    void boot()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase || !session) return
    const client = supabase

    let ignore = false

    const fetchItems = async () => {
      setAppLoading(true)
      const { data, error } = await client
        .from('grocery_items')
        .select('id, name, note, bought')
        .eq('family_id', SHARED_FAMILY_ID)
        .order('created_at', { ascending: false })

      if (ignore) return

      if (error) {
        setStatusMessage(error.message)
      } else if (data) {
        setItems(data)
      }
      setAppLoading(false)
    }

    void fetchItems()

    return () => {
      ignore = true
    }
  }, [session])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setAuthLoading(true)
    setStatusMessage('')
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    })
    if (error) setStatusMessage(error.message)
    setAuthLoading(false)
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setItems([])
  }

  const handleAddItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedNote = note.trim()

    if (!trimmedName) return

    if (!isSupabaseEnabled || !supabase || !session) {
      const newItem: GroceryItem = {
        id: crypto.randomUUID(),
        name: trimmedName,
        note: trimmedNote,
        bought: false,
      }
      saveItems([newItem, ...items])
      setName('')
      setNote('')
      return
    }

    void (async () => {
      const { error } = await supabase.from('grocery_items').insert({
        name: trimmedName,
        note: trimmedNote,
        bought: false,
        family_id: SHARED_FAMILY_ID,
        created_by: session.user.id,
      })

      if (error) {
        setStatusMessage(error.message)
        return
      }

      setItems((prev) => [
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          note: trimmedNote,
          bought: false,
        },
        ...prev,
      ])
      setName('')
      setNote('')

      const { data } = await supabase
        .from('grocery_items')
        .select('id, name, note, bought')
        .eq('family_id', SHARED_FAMILY_ID)
        .order('created_at', { ascending: false })
      if (data) setItems(data)
    })()
  }

  const handleToggleBought = (id: string) => {
    if (isSupabaseEnabled && supabase && session) {
      const target = items.find((item) => item.id === id)
      if (!target) return
      void (async () => {
        const { error } = await supabase
          .from('grocery_items')
          .update({ bought: !target.bought })
          .eq('id', id)
          .eq('family_id', SHARED_FAMILY_ID)
        if (error) {
          setStatusMessage(error.message)
          return
        }
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, bought: !item.bought } : item,
          ),
        )
      })()
      return
    }

    const nextItems = items.map((item) =>
      item.id === id ? { ...item, bought: !item.bought } : item,
    )
    saveItems(nextItems)
  }

  const handleDeleteItem = (id: string) => {
    if (isSupabaseEnabled && supabase && session) {
      void (async () => {
        const { error } = await supabase
          .from('grocery_items')
          .delete()
          .eq('id', id)
          .eq('family_id', SHARED_FAMILY_ID)
        if (error) {
          setStatusMessage(error.message)
          return
        }
        setItems((current) => current.filter((item) => item.id !== id))
      })()
      if (editingId === id) setEditingId(null)
      return
    }

    const nextItems = items.filter((item) => item.id !== id)
    saveItems(nextItems)
    if (editingId === id) {
      setEditingId(null)
    }
  }

  const handleStartEdit = (item: GroceryItem) => {
    setEditingId(item.id)
    setEditingName(item.name)
    setEditingNote(item.note)
  }

  const handleSaveEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingId) return

    const trimmedName = editingName.trim()
    if (!trimmedName) return

    const trimmedNote = editingNote.trim()
    if (isSupabaseEnabled && supabase && session) {
      void (async () => {
        const { error } = await supabase
          .from('grocery_items')
          .update({ name: trimmedName, note: trimmedNote })
          .eq('id', editingId)
          .eq('family_id', SHARED_FAMILY_ID)
        if (error) {
          setStatusMessage(error.message)
          return
        }
        setItems((current) =>
          current.map((item) =>
            item.id === editingId
              ? { ...item, name: trimmedName, note: trimmedNote }
              : item,
          ),
        )
        setEditingId(null)
      })()
      return
    }

    const nextItems = items.map((item) =>
      item.id === editingId
        ? { ...item, name: trimmedName, note: trimmedNote }
        : item,
    )
    saveItems(nextItems)
    setEditingId(null)
  }

  const clearBoughtItems = () => {
    if (isSupabaseEnabled && supabase && session) {
      void (async () => {
        const { error } = await supabase
          .from('grocery_items')
          .delete()
          .eq('bought', true)
          .eq('family_id', SHARED_FAMILY_ID)
        if (error) {
          setStatusMessage(error.message)
          return
        }
        setItems((current) => current.filter((item) => !item.bought))
      })()
      return
    }

    const nextItems = items.filter((item) => !item.bought)
    saveItems(nextItems)
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Shopping Planner</p>
        <h1>Grocery Items</h1>
        <p className="subtitle">Add things right away so shopping day is easy.</p>
        <div className="stats" aria-label="List stats">
          <span className="stat-chip">Total: {items.length}</span>
          <span className="stat-chip">Pending: {pendingCount}</span>
          <span className="stat-chip">Bought: {boughtCount}</span>
        </div>
      </section>

      {isSupabaseEnabled ? (
        <section className="auth-panel">
          {session ? (
            <div className="auth-row">
              <div className="auth-user">
                <span className="auth-avatar">{session.user.email?.[0]?.toUpperCase() ?? '?'}</span>
                <p className="auth-info">{session.user.email}</p>
              </div>
              <button type="button" className="btn-logout" onClick={signOut}>
                Log out
              </button>
            </div>
          ) : (
            <div className="signin-card">
              <div className="signin-icon">🔐</div>
              <h2 className="signin-title">Welcome back</h2>
              <p className="signin-subtitle">Sign in to sync your grocery list across devices</p>
              <form className="auth-form" onSubmit={signIn}>
                <div className="input-group">
                  <label className="input-label" htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    aria-label="Email"
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="family@email.com"
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    aria-label="Password"
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button type="submit" className="btn-signin" disabled={authLoading}>
                  {authLoading ? (
                    <span className="signin-loading">
                      <span className="spinner" /> Signing in…
                    </span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>
          )}
        </section>
      ) : (
        <p className="status-note">
          Running in local mode. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
          to enable family shared login.
        </p>
      )}

      {statusMessage ? <p className="status-note">{statusMessage}</p> : null}
      {appLoading ? <p className="status-note">Loading...</p> : null}

      {isSupabaseEnabled && !session ? null : (
        <>
          <form className="add-form" onSubmit={handleAddItem}>
            <input
              aria-label="Item name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Milk"
              required
            />
            <input
              aria-label="Item note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note (e.g. 2 liters)"
            />
            <button type="submit">Add item</button>
          </form>

          <section className="controls" aria-label="Filters">
            <div className="filters">
              {(['all', 'pending', 'bought'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value)}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearBoughtItems}
              disabled={!hasBoughtItems}
              className="clear-button"
            >
              Clear bought
            </button>
          </section>

          {items.length === 0 ? (
            <p className="empty-state">
              Your list is empty. Add your first grocery item above.
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="empty-state">No items found for this filter.</p>
          ) : (
            <ul className="items-list">
              {filteredItems.map((item) => {
                const isEditing = editingId === item.id
                return (
                  <li key={item.id} className={item.bought ? 'item bought' : 'item'}>
                    {isEditing ? (
                      <form className="edit-form" onSubmit={handleSaveEdit}>
                        <input
                          aria-label="Edit item name"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          required
                        />
                        <input
                          aria-label="Edit item note"
                          value={editingNote}
                          onChange={(event) => setEditingNote(event.target.value)}
                          placeholder="Optional note"
                        />
                        <div className="actions">
                          <button type="submit">Save</button>
                          <button type="button" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <label className="item-main">
                          <input
                            type="checkbox"
                            checked={item.bought}
                            onChange={() => handleToggleBought(item.id)}
                          />
                          <span className="item-text">
                            <strong>{item.name}</strong>
                            {item.note ? <small>{item.note}</small> : null}
                          </span>
                        </label>
                        <div className="actions">
                          <button type="button" onClick={() => handleStartEdit(item)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </main>
  )
}

export default App
