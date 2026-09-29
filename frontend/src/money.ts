/**
 * Money and counts, formatted the way a bill in an Indian shop reads:
 * lakh grouping, two decimals, and no currency symbol in table columns where the
 * header has already said what the numbers are.
 */

export const amount = (n: number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const rupees = (n: number) => `₹${amount(n)}`

/** Quantities are stored to three decimals for fabric by the metre; pieces are whole. */
export const qty = (n: number) => String(Number(n))

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
