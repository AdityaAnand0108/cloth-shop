import type { Bill } from '../../api/types'
import { dateTime, qty, rupees } from '../../money'

/** WhatsApp expects a country code and digits only. Local Indian numbers get +91. */
export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.length === 10
    ? `91${digits}`
    : digits.length === 11 && digits.startsWith('0')
      ? `91${digits.slice(1)}`
      : digits
  return normalized.length >= 11 && normalized.length <= 15 ? normalized : null
}

export function whatsappBillText(bill: Bill): string {
  return [
    `Hello${bill.customerName ? ` ${bill.customerName}` : ''},`,
    '',
    'Thank you for shopping with BFlex. Here is your bill:',
    `Bill: ${bill.billNo}`,
    `Date: ${dateTime(bill.createdAt)}`,
    '',
    ...bill.lines.map(line =>
      `${line.description} (${line.articleCode}) · ${qty(line.qty)} × ${rupees(line.unitPrice)} = ${rupees(line.lineTotal)}`),
    '',
    `Subtotal: ${rupees(bill.subtotal)}`,
    ...(bill.discount > 0 ? [`Discount: −${rupees(bill.discount)}`] : []),
    `Total paid: ${rupees(bill.total)}`,
    `Payment: ${bill.paymentMode}`,
    '',
    'Please keep this message for exchanges. Exchange within 7 days with this bill; no exchange on altered garments.',
    'Thank you,\nBFlex',
  ].join('\n')
}

export function whatsappBillUrl(bill: Bill): string | null {
  const phone = whatsappNumber(bill.customerPhone)
  if (!phone) return null

  return `https://wa.me/${phone}?text=${encodeURIComponent(whatsappBillText(bill))}`
}
