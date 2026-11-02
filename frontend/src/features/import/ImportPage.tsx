import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../api/client'
import type { AddArticleBatchRequest, Lookups, PaymentMode } from '../../api/types'

type Kind = 'inventory' | 'sales'
type Row = Record<string, string>

const INVENTORY_COLUMNS = ['Article Type', 'Brand', 'Material', 'Colour', 'Size', 'Buying Price', 'Selling Price', 'Quantity', 'Wholesaler', 'Added By', 'Note']
const SALES_COLUMNS = ['Bill Number', 'Sale Date', 'Customer Name', 'Customer Phone', 'Article Code', 'Quantity', 'Unit Price', 'Payment Mode', 'Staff', 'Discount', 'Note']

const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const value = (row: Row, name: string) => row[key(name)]?.trim() ?? ''
const idempotency = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export function ImportPage({ kind, onBack }: { kind: Kind; onBack: () => void }) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [headers, setHeaders] = useState<string[]>(kind === 'inventory' ? INVENTORY_COLUMNS : SALES_COLUMNS)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [historicalOnly, setHistoricalOnly] = useState(true)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => { api.lookups().then(setLookups).catch((e: Error) => setError(e.message)) }, [])

  const required = kind === 'inventory'
    ? ['Article Type', 'Brand', 'Material', 'Colour', 'Size', 'Buying Price', 'Selling Price', 'Quantity', 'Wholesaler', 'Added By']
    : ['Bill Number', 'Sale Date', 'Article Code', 'Quantity', 'Unit Price', 'Payment Mode', 'Staff']

  const validation = useMemo(() => rows.map((row, index) => {
    const missing = required.filter(column => !value(row, column))
    return missing.length ? `Row ${index + 2}: missing ${missing.join(', ')}` : null
  }).filter(Boolean) as string[], [rows, required])

  async function readFile(file: File) {
    setError(null); setResult(null); setFileName(file.name)
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, { header: 1, defval: '' })
      if (matrix.length < 2) throw new Error('The first sheet needs a header row and at least one data row.')
      const sourceHeaders = matrix[0].map(cell => String(cell).trim()).filter(Boolean)
      const parsed = matrix.slice(1).filter(row => row.some(cell => String(cell).trim() !== '')).map(row => {
        const item: Row = {}
        sourceHeaders.forEach((header, index) => {
          const cell = row[index]
          item[key(header)] = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? '').trim()
        })
        return item
      })
      setHeaders(sourceHeaders)
      setRows(parsed)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this workbook') }
  }

  function updateRow(index: number, header: string, next: string) {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key(header)]: next } : row))
  }

  async function saveInventory() {
    if (!lookups || validation.length) return
    const groups = new Map<string, AddArticleBatchRequest>()
    for (const row of rows) {
      const type = lookups.articleTypes.find(x => x.name.toLowerCase() === value(row, 'Article Type').toLowerCase() || x.code.toLowerCase() === value(row, 'Article Type').toLowerCase())
      const brand = lookups.brands.find(x => x.name.toLowerCase() === value(row, 'Brand').toLowerCase() || x.code.toLowerCase() === value(row, 'Brand').toLowerCase())
      const material = lookups.materials.find(x => x.name.toLowerCase() === value(row, 'Material').toLowerCase() || x.code.toLowerCase() === value(row, 'Material').toLowerCase())
      const colour = lookups.colours.find(x => x.name.toLowerCase() === value(row, 'Colour').toLowerCase() || x.code.toLowerCase() === value(row, 'Colour').toLowerCase())
      const size = lookups.sizes.find(x => x.name.toLowerCase() === value(row, 'Size').toLowerCase() || x.code.toLowerCase() === value(row, 'Size').toLowerCase())
      const wholesaler = lookups.wholesalers.find(x => x.name.toLowerCase() === value(row, 'Wholesaler').toLowerCase())
      const staff = lookups.staff.find(x => x.name.toLowerCase() === value(row, 'Added By').toLowerCase())
      if (!type || !brand || !material || !colour || !size || !wholesaler || !staff) throw new Error(`Could not match a lookup in row for ${value(row, 'Article Type')} / ${value(row, 'Colour')} / ${value(row, 'Size')}`)
      const buyingPrice = Number(value(row, 'Buying Price')), sellingPrice = Number(value(row, 'Selling Price'))
      const groupKey = [type.id, brand.id, material.id, wholesaler.id, staff.id, buyingPrice, sellingPrice].join(':')
      const group = groups.get(groupKey) ?? { articleTypeId: type.id, brandId: brand.id, materialId: material.id, buyingPrice, sellingPrice, wholesalerId: wholesaler.id, staffId: staff.id, note: value(row, 'Note') || undefined, sizes: [] }
      const preview = await api.previewCode({ articleTypeId: type.id, brandId: brand.id, materialId: material.id, colourId: colour.id, sizeId: size.id })
      group.sizes.push({ colourId: colour.id, sizeId: size.id, quantity: Number(value(row, 'Quantity')), mode: preview.exists ? 'ADD_STOCK' : 'CREATE', updateSellingPrice: false })
      groups.set(groupKey, group)
    }
    for (const group of groups.values()) await api.addArticleBatch(group, idempotency())
    setResult(`Imported ${rows.length} inventory rows successfully.`)
  }

  async function saveSales() {
    if (!lookups || validation.length) return
    const articleCache = new Map<string, number>()
    const bills = new Map<string, Row[]>()
    rows.forEach(row => { const bill = value(row, 'Bill Number'); bills.set(bill, [...(bills.get(bill) ?? []), row]) })
    for (const [billNo, billRows] of bills) {
      const first = billRows[0]
      const staff = lookups.staff.find(x => x.name.toLowerCase() === value(first, 'Staff').toLowerCase())
      if (!staff) throw new Error(`Could not match staff in bill ${billNo}`)
      const lines = []
      for (const row of billRows) {
        const articleCode = value(row, 'Article Code')
        let variantId = articleCache.get(articleCode)
        if (!variantId) {
          const found = (await api.listArticles({ q: articleCode })).content.find(article => article.articleCode.toLowerCase() === articleCode.toLowerCase())
          if (!found) throw new Error(`Article ${articleCode} was not found for bill ${billNo}`)
          variantId = found.variantId; articleCache.set(articleCode, variantId)
        }
        lines.push({ variantId, qty: Number(value(row, 'Quantity')), unitPrice: Number(value(row, 'Unit Price')) })
      }
      const payment = value(first, 'Payment Mode').toUpperCase() as PaymentMode
      if (!['CASH', 'UPI', 'CARD'].includes(payment)) throw new Error(`Invalid payment mode in bill ${billNo}`)
      await api.checkout({ billNo, lines, staffId: staff.id, customerName: value(first, 'Customer Name') || undefined, customerPhone: value(first, 'Customer Phone') || undefined, discount: Number(value(first, 'Discount') || 0), paymentMode: payment, note: value(first, 'Note') || `Imported bill ${billNo}`, createdAt: new Date(`${value(first, 'Sale Date')}T12:00:00`).toISOString(), affectInventory: !historicalOnly }, idempotency())
    }
    setResult(`Imported ${bills.size} sales bills successfully.`)
  }

  async function save() { setBusy(true); setError(null); try { if (kind === 'inventory') await saveInventory(); else await saveSales() } catch (e) { setError(e instanceof Error ? e.message : 'Import failed') } finally { setBusy(false) } }

  return <div className="page">
    <header className="page-head"><button type="button" className="link" onClick={onBack}>&larr; Dashboard</button><h1>Import {kind === 'inventory' ? 'inventory' : 'sales'}</h1><p className="muted">Upload an Excel workbook, review every row, correct errors, then save the import.</p></header>
    {error && <div className="banner err">{error}</div>}{result && <div className="banner ok">{result}</div>}
    <section className="card import-card">
      <div className="import-toolbar"><label className="primary file-button">Choose Excel file<input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && void readFile(e.target.files[0])} /></label><span className="muted small">{fileName || 'No file selected'}</span><a className="link" href={`data:text/csv;charset=utf-8,${encodeURIComponent((kind === 'inventory' ? INVENTORY_COLUMNS : SALES_COLUMNS).join(',') + '\n')}`} download={`${kind}-template.csv`}>Download template</a></div>
      {kind === 'sales' && <label className="import-option"><input type="checkbox" checked={historicalOnly} onChange={e => setHistoricalOnly(e.target.checked)} /> Historical import: record sales without reducing current stock</label>}
      {rows.length === 0 ? <p className="muted">Upload a file to preview its rows here.</p> : <div className="table-scroll"><table className="import-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{headers.map(header => <td key={header}><input value={value(row, header)} onChange={e => updateRow(index, header, e.target.value)} /></td>)}</tr>)}</tbody></table></div>}
      {validation.length > 0 && <div className="import-errors">{validation.slice(0, 5).map(message => <p key={message}>{message}</p>)}{validation.length > 5 && <p>…and {validation.length - 5} more rows.</p>}</div>}
      <div className="actions"><button type="button" className="primary" disabled={!rows.length || validation.length > 0 || busy || !lookups} onClick={() => void save()}>{busy ? 'Saving import…' : 'Validate and save'}</button><button type="button" className="ghost" onClick={onBack}>Cancel</button></div>
    </section>
  </div>
}
