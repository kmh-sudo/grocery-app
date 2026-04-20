import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const STORAGE_KEY = 'grocery-items'

describe('Grocery App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-1111-1111-111111111111',
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  it('adds an item with optional note', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    render(<App />)

    await user.type(screen.getByLabelText(/item name/i), 'Milk')
    await user.type(screen.getByLabelText(/item note/i), '2 liters')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('2 liters')).toBeInTheDocument()
  })

  it('toggles item bought state and can filter', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', name: 'Eggs', note: '', bought: false }]),
    )

    render(<App />)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /^bought$/i }))

    expect(screen.getByText('Eggs')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /pending/i }))
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument()
  })

  it('edits and deletes an item', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', name: 'Bread', note: 'Whole grain', bought: false }]),
    )

    render(<App />)

    await user.click(screen.getByRole('button', { name: /edit/i }))
    const editName = screen.getByLabelText(/edit item name/i)
    await user.clear(editName)
    await user.type(editName, 'Bread loaf')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByText('Bread loaf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.queryByText('Bread loaf')).not.toBeInTheDocument()
  })

  it('persists updates to local storage', async () => {
    const user = userEvent.setup()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
    render(<App />)

    await user.type(screen.getByLabelText(/item name/i), 'Bananas')
    await user.click(screen.getByRole('button', { name: /add item/i }))

    const storedItems = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<{
      name: string
    }>

    expect(storedItems.some((item) => item.name === 'Bananas')).toBe(true)
  })
})
