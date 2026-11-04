import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { api } from '../../api/client'
import type { CheckoutLine, CheckoutRequest, Lookups, PaymentMode } from '../../api/types'
import { NewBrandDialog } from '../articles/NewBrandDialog'

type Kind = 'inventory' | 'sales'
type Row = Record<string, string>
type SourceColumn = { id: string; label: string }
const ADD_NEW_BRAND = '__add_new_brand__'

const INVENTORY_COLUMNS = ['Article Type', 'Brand', 'Material', 'Colour', 'Size', 'Buying Price', 'Selling Price', 'Quantity', 'Wholesaler', 'Added By', 'Invoice / Reference', 'Reorder Level', 'Note']
const SALES_COLUMNS = ['Bill Number', 'Sale Date', 'Customer Name', 'Customer Phone', 'Article Code', 'Quantity', 'Unit Price', 'Unit Cost', 'Payment Mode', 'Staff', 'Discount', 'Note']
const SHARED_INVENTORY_COLUMNS = new Set(['Article Type', 'Brand', 'Material', 'Wholesaler', 'Added By'])
const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const value = (row: Row, name: string) => row[key(name)]?.trim() ?? ''
const newKey = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const aliases: Record<string, string[]> = {
  articletype: ['type', 'typeofarticle', 'producttype', 'article', 'itemtype', 'garment'],
  brand: ['brandname', 'label', 'brandofarticle'],
  material: ['materialtype', 'fabric', 'cloth'],
  colour: ['color', 'shade'], size: ['sizename'],
  buyingprice: ['buyprice', 'purchaseprice', 'cost', 'costprice', 'buyingrate'],
  sellingprice: ['sellprice', 'retailprice', 'mrp', 'sellingrate'],
  quantity: ['qty', 'pcs', 'pieces', 'units', 'stock'],
  wholesaler: ['supplier', 'vendor', 'boughtfrom'],
  addedby: ['staff', 'enteredby', 'receivedby'],
  invoicereference: ['invoice', 'invoiceno', 'reference', 'billreference'],
  billnumber: ['bill', 'billno', 'receipt', 'receiptno'],
  saledate: ['date', 'createdat', 'billdate'],
  customername: ['customer', 'name'], customerphone: ['phone', 'mobile', 'whatsapp'],
  articlecode: ['code', 'sku', 'itemcode'], unitprice: ['price', 'rate', 'saleprice', 'sellingprice'],
  unitcost: ['costprice', 'buyprice', 'buyingprice'], paymentmode: ['payment', 'mode'],
  discount: ['billdiscount'], note: ['remarks', 'comment'], reorderlevel: ['reorder', 'alertat', 'minimumstock'],
}

function columnsFor(kind: Kind) { return kind === 'inventory' ? INVENTORY_COLUMNS : SALES_COLUMNS }
function requiredFor(kind: Kind) {
  return kind === 'inventory'
    ? ['Article Type', 'Brand', 'Material', 'Colour', 'Size', 'Buying Price', 'Selling Price', 'Quantity', 'Wholesaler', 'Added By']
    : ['Sale Date', 'Article Code', 'Quantity', 'Unit Price', 'Payment Mode', 'Staff']
}
function assignMissingBillNumbers(rows: Row[]): Row[] {
  const billByGroup = new Map<string, string>()
  let next = 1
  return rows.map((row, index) => {
    if (value(row, 'Bill Number') && !/^IMP-[A-Z0-9]+-\d{3}$/.test(value(row, 'Bill Number'))) return row
    const customer = value(row, 'Customer Name').trim().toLocaleLowerCase()
    // Rows with the same customer and sale date represent lines on one bill.
    // Without a customer name there is no safe way to infer a shared bill.
    const group = customer ? `${value(row, 'Sale Date')}|${customer}` : `row-${index}`
    let billNo = billByGroup.get(group)
    if (!billNo) {
      billNo = `IMP-${Date.now().toString(36).toUpperCase()}-${String(next++).padStart(3, '0')}`
      billByGroup.set(group, billNo)
    }
    return { ...row, billnumber: billNo }
  })
}
function numberValue(text: string) {
  const clean = text.replace(/[₹,$,\s]/g, '')
  return clean === '' ? Number.NaN : Number(clean)
}
function sourceIndex(columns: SourceColumn[], target: string): string {
  const expected = key(target)
  const exact = columns.find(column => key(column.label) === expected)
  if (exact) return exact.id
  const also = aliases[expected] ?? []
  const match = columns.find(column => also.includes(key(column.label)))
  return match?.id ?? ''
}
function mapRows(raw: string[][], mapping: Record<string, string>, targets: string[]) {
  return raw.map(row => Object.fromEntries(targets.map(target => {
    const mapped = mapping[key(target)]
    const index = mapped === undefined || mapped === '' ? -1 : Number(mapped)
    return [key(target), Number.isInteger(index) && index >= 0 ? row[index] ?? '' : '']
  })))
}

export function ImportPage({ kind, onBack }: { kind: Kind; onBack: () => void }) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [sourceColumns, setSourceColumns] = useState<SourceColumn[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [historicalOnly, setHistoricalOnly] = useState(true)
  const [result, setResult] = useState<string | null>(null)
  const [addingBrandForRow, setAddingBrandForRow] = useState<number | null>(null)
  const [unknownArticleCodes, setUnknownArticleCodes] = useState<Set<string>>(new Set())
  const [articleCheck, setArticleCheck] = useState<'idle' | 'checking' | 'done'>('idle')
  const [search, setSearch] = useState('')
  const [issuesOnly, setIssuesOnly] = useState(false)
  const [page, setPage] = useState(0)

  const columns = columnsFor(kind)
  const required = requiredFor(kind)

  useEffect(() => { api.lookups().then(setLookups).catch((e: Error) => setError(e.message)) }, [])

  const optionsFor = (header: string): Array<{ id: number | string; name: string; code?: string; sizeGroupId?: number | null }> => {
    if (!lookups) return []
    if (header === 'Article Type') return lookups.articleTypes
    if (header === 'Brand') return lookups.brands
    if (header === 'Material') return lookups.materials
    if (header === 'Colour') return lookups.colours
    if (header === 'Size') return lookups.sizes
    if (header === 'Wholesaler') return lookups.wholesalers
    if (header === 'Added By' || header === 'Staff') return lookups.staff
    if (header === 'Payment Mode') return ['CASH', 'UPI', 'CARD'].map(name => ({ id: name, name }))
    return []
  }

  const missingMappings = required.filter(column => !mapping[key(column)])
  useEffect(() => {
    if (kind !== 'sales' || rows.length === 0) {
      setUnknownArticleCodes(new Set())
      setArticleCheck('idle')
      return
    }
    let cancelled = false
    const codes = [...new Set(rows.map(row => value(row, 'Article Code')).filter(Boolean))]
    if (!codes.length) {
      setUnknownArticleCodes(new Set())
      setArticleCheck('done')
      return
    }
    setArticleCheck('checking')
    const timer = window.setTimeout(() => {
      void (async () => {
        const unknown = new Set<string>()
        for (let start = 0; start < codes.length; start += 20) {
          if (cancelled) return
          const batch = await Promise.all(codes.slice(start, start + 20).map(async code => ({
            code, found: await api.articleByCode(code).catch(() => null),
          })))
          batch.filter(result => !result.found).forEach(result => unknown.add(result.code.toLowerCase()))
        }
        if (cancelled) return
        setUnknownArticleCodes(unknown)
        setArticleCheck('done')
      })()
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [rows, kind])

  const validation = useMemo(() => {
    const errors: string[] = []
    const inventoryKeys = new Set<string>()
    const billData = new Map<string, string>()
    rows.forEach((row, index) => {
      const rowNumber = index + 2
      const missing = required.filter(column => !value(row, column))
      if (missing.length) errors.push(`Row ${rowNumber}: missing ${missing.join(', ')}`)
      for (const header of ['Article Type', 'Brand', 'Material', 'Colour', 'Size', 'Wholesaler', 'Added By', 'Staff', 'Payment Mode']) {
        const current = value(row, header)
        if (!current) continue
        const options = optionsFor(header)
        if (options.length && !options.some(option => option.name.toLowerCase() === current.toLowerCase() || option.code?.toLowerCase() === current.toLowerCase())) {
          errors.push(`Row ${rowNumber}: choose a saved ${header.toLowerCase()} value.`)
        }
      }
      const quantity = numberValue(value(row, 'Quantity'))
      if (Number.isFinite(quantity) && (!Number.isInteger(quantity) || quantity <= 0)) errors.push(`Row ${rowNumber}: quantity must be a positive whole number.`)
      for (const header of kind === 'inventory' ? ['Buying Price', 'Selling Price', 'Reorder Level'] : ['Unit Price', 'Unit Cost', 'Discount']) {
        const current = value(row, header)
        if (!current) continue
        const amount = numberValue(current)
        if (!Number.isFinite(amount) || amount < 0) errors.push(`Row ${rowNumber}: ${header} must be a valid amount of zero or more.`)
      }
      if (kind === 'sales') {
        const code = value(row, 'Article Code')
        if (code && unknownArticleCodes.has(code.toLowerCase())) errors.push(`Row ${rowNumber}: article code ${code} was not found in inventory.`)
        const date = value(row, 'Sale Date')
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push(`Row ${rowNumber}: use a valid sale date.`)
        const bill = value(row, 'Bill Number')
        for (const header of ['Sale Date', 'Staff', 'Payment Mode', 'Customer Name', 'Customer Phone', 'Discount']) {
          const next = value(row, header).toLowerCase()
          const composite = `${bill}:${header}`
          if (billData.has(composite) && billData.get(composite) !== next) errors.push(`Row ${rowNumber}: ${header} differs from another row on bill ${bill}.`)
          else billData.set(composite, next)
        }
      } else {
        const found = (header: string) => optionsFor(header).find(option => option.name.toLowerCase() === value(row, header).toLowerCase() || option.code?.toLowerCase() === value(row, header).toLowerCase())
        const type = found('Article Type'), brand = found('Brand'), material = found('Material'), colour = found('Colour'), size = found('Size')
        if (type && brand && material && colour && size) {
          const composite = [type.id, brand.id, material.id, colour.id, size.id].join(':')
          if (inventoryKeys.has(composite)) errors.push(`Row ${rowNumber}: this colour and size combination appears more than once.`)
          inventoryKeys.add(composite)
          const articleType = lookups?.articleTypes.find(x => x.id === type.id)
          if (articleType?.sizeGroupId && size.sizeGroupId !== articleType.sizeGroupId) errors.push(`Row ${rowNumber}: size ${size.name} does not belong to ${articleType.name}.`)
        }
      }
    })
    return [...new Set(errors)]
  }, [rows, required, lookups, kind, unknownArticleCodes])

  const pageSize = 50
  const rowIssues = (index: number) => validation.filter(message => message.startsWith(`Row ${index + 2}:`))
  const filteredRows = rows.map((row, index) => ({ row, index })).filter(({ row, index }) => {
    if (issuesOnly && !rowIssues(index).length) return false
    return !search.trim() || Object.values(row).join(' ').toLowerCase().includes(search.trim().toLowerCase())
  })
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const visibleRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize)

  function goToIssues() {
    setIssuesOnly(true); setPage(0)
    window.setTimeout(() => {
      const firstCell = document.querySelector('.import-cell-error')
      const target = firstCell ?? document.getElementById('import-errors')
      target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 0)
  }

  function showAllRows() {
    setSearch(''); setIssuesOnly(false); setPage(0)
    window.setTimeout(() => document.getElementById('import-review-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function goToMapping() {
    document.querySelector('.column-mapping')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function issuesForCell(index: number, header: string) {
    return rowIssues(index).filter(message => {
      const text = message.toLowerCase()
      const field = header.toLowerCase()
      return text.includes(field) || (header === 'Sale Date' && text.includes('valid sale date')) ||
        (header === 'Article Code' && text.includes('article code')) ||
        (header === 'Quantity' && text.includes('quantity'))
    })
  }

  async function readFile(file: File) {
    setError(null); setResult(null); setFileName(file.name)
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, { header: 1, defval: '' })
      if (matrix.length < 2) throw new Error('The first sheet needs a header row and at least one data row.')
      const usedColumns = matrix[0].reduce<number>((last, cell, index) => String(cell).trim() ? index + 1 : last, 0)
      const headers = matrix[0].slice(0, usedColumns).map((cell, index) => ({ id: String(index), label: String(cell).trim() || `Column ${index + 1}` }))
      const raw = matrix.slice(1).filter(row => row.some(cell => String(cell).trim() !== '')).map(row => Array.from({ length: usedColumns }, (_, index) => {
        const cell = row[index]
        return cell instanceof Date
          ? `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
          : String(cell ?? '').trim()
      }))
      const nextMapping = Object.fromEntries(columns.map(column => [key(column), sourceIndex(headers, column)]))
      setSourceColumns(headers); setRawRows(raw); setMapping(nextMapping)
      setRows(kind === 'sales' ? assignMissingBillNumbers(mapRows(raw, nextMapping, columns)) : mapRows(raw, nextMapping, columns))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read this workbook') }
  }

  function changeMapping(header: string, sourceId: string) {
    const next = { ...mapping, [key(header)]: sourceId }
    setMapping(next)
    const mapped = mapRows(rawRows, next, columns)
    setRows(kind === 'sales' ? assignMissingBillNumbers(mapped) : mapped)
  }

  function updateRow(index: number, header: string, next: string) {
    setRows(current => {
      const updated = current.map((row, rowIndex) => rowIndex === index ? { ...row, [key(header)]: next } : row)
      return kind === 'sales' && ['Customer Name', 'Sale Date', 'Bill Number'].includes(header)
        ? assignMissingBillNumbers(updated) : updated
    })
  }

  function fillBlankRows(header: string) {
    const source = rows.find(row => value(row, header))
    if (!source) return
    const sharedValue = value(source, header)
    setRows(current => current.map(row => value(row, header) ? row : { ...row, [key(header)]: sharedValue }))
  }

  function fillBlankSalesRows(header: string) {
    const shared = rows.find(row => value(row, header))
    if (!shared) return
    const sharedValue = value(shared, header)
    setRows(current => assignMissingBillNumbers(current.map(row => value(row, header) ? row : { ...row, [key(header)]: sharedValue })))
  }

  function editCell(row: Row, index: number, header: string) {
    const current = value(row, header)
    const options = optionsFor(header)
    if (options.length > 0 || header === 'Brand') {
      const canonical = options.find(option => option.name.toLowerCase() === current.toLowerCase() || option.code?.toLowerCase() === current.toLowerCase())?.name ?? current
      return <select value={canonical} onChange={e => {
        if (header === 'Brand' && e.target.value === ADD_NEW_BRAND) setAddingBrandForRow(index)
        else updateRow(index, header, e.target.value)
      }}><option value="">Choose…</option>{current && !options.some(option => option.name.toLowerCase() === current.toLowerCase() || option.code?.toLowerCase() === current.toLowerCase()) && <option value={current}>Review: {current}</option>}{options.map(option => <option key={option.id} value={option.name}>{option.name}{option.code ? ` (${option.code})` : ''}</option>)}{header === 'Brand' && <option value={ADD_NEW_BRAND}>＋ Add new brand…</option>}</select>
    }
    const numeric = ['Buying Price', 'Selling Price', 'Quantity', 'Unit Price', 'Unit Cost', 'Discount', 'Reorder Level'].includes(header)
    return <input type={header === 'Sale Date' ? 'date' : numeric ? 'number' : 'text'} min={numeric ? '0' : undefined} step={['Quantity', 'Reorder Level'].includes(header) ? '1' : numeric ? '0.01' : undefined} value={current} onChange={e => updateRow(index, header, e.target.value)} />
  }

  function lookup(header: string, name: string) {
    return optionsFor(header).find(option => option.name.toLowerCase() === name.toLowerCase() || option.code?.toLowerCase() === name.toLowerCase())
  }

  async function saveInventory() {
    if (!lookups || validation.length || missingMappings.length) return
    const normalized = rows.map((row, index) => {
      const get = (header: string) => lookup(header, value(row, header))
      const type = get('Article Type'), brand = get('Brand'), material = get('Material'), colour = get('Colour'), size = get('Size'), supplier = get('Wholesaler'), staff = get('Added By')
      if (!type || !brand || !material || !colour || !size || !supplier || !staff) throw new Error(`Could not match a catalogue value in row ${index + 2}.`)
      return { row, type, brand, material, colour, size, supplier, staff }
    })
    const first = normalized[0]
    const response = await api.receiveInventory({
      wholesalerId: Number(first.supplier.id), staffId: Number(first.staff.id),
      reference: value(first.row, 'Invoice / Reference') || undefined,
      items: normalized.map(({ row, type, brand, material, colour, size, supplier, staff }) => ({
        articleTypeId: Number(type.id), brandId: Number(brand.id), materialId: Number(material.id),
        colourId: Number(colour.id), sizeId: Number(size.id), wholesalerId: Number(supplier.id), staffId: Number(staff.id),
        buyingPrice: numberValue(value(row, 'Buying Price')), sellingPrice: numberValue(value(row, 'Selling Price')),
        quantity: numberValue(value(row, 'Quantity')), reorderLevel: value(row, 'Reorder Level') ? numberValue(value(row, 'Reorder Level')) : undefined,
        updateSellingPrice: false, purchaseReference: value(row, 'Invoice / Reference') || undefined,
        note: value(row, 'Note') || undefined,
      })),
    }, newKey())
    setResult(`Saved ${response.items.length} inventory rows in one transaction${response.reference ? ` · reference ${response.reference}` : ''}.`)
  }

  async function saveSales() {
    if (!lookups || validation.length || missingMappings.length) return
    const bills = new Map<string, Row[]>()
    rows.forEach(row => { const billNo = value(row, 'Bill Number'); bills.set(billNo, [...(bills.get(billNo) ?? []), row]) })
    const variants = new Map<string, number>()
    const checkouts: CheckoutRequest[] = []
    for (const [billNo, billRows] of bills) {
      const first = billRows[0]
      const staff = lookup('Staff', value(first, 'Staff'))
      const payment = value(first, 'Payment Mode').toUpperCase() as PaymentMode
      if (!staff || !['CASH', 'UPI', 'CARD'].includes(payment)) throw new Error(`Check staff and payment mode for bill ${billNo}.`)
      const lines: CheckoutLine[] = []
      for (const row of billRows) {
        const code = value(row, 'Article Code').trim()
        let variantId = variants.get(code.toLowerCase())
        if (!variantId) {
          const found = await api.articleByCode(code).catch(() => null)
          if (!found) throw new Error(`Article code ${code} from bill ${billNo} is not in inventory. Correct the code or add the article first.`)
          variantId = found.variantId; variants.set(code.toLowerCase(), variantId)
        }
        const cost = value(row, 'Unit Cost')
        lines.push({ variantId, qty: numberValue(value(row, 'Quantity')), unitPrice: numberValue(value(row, 'Unit Price')),
          ...(historicalOnly && cost ? { historicalUnitCost: numberValue(cost) } : {}) })
      }
      checkouts.push({
        billNo, lines, staffId: Number(staff.id), customerName: value(first, 'Customer Name') || undefined,
        customerPhone: value(first, 'Customer Phone') || undefined,
        discount: value(first, 'Discount') ? numberValue(value(first, 'Discount')) : 0,
        paymentMode: payment, note: value(first, 'Note') || `Imported bill ${billNo}`,
        createdAt: new Date(`${value(first, 'Sale Date')}T12:00:00+05:30`).toISOString(),
        affectInventory: !historicalOnly,
      })
    }
    const response = await api.importSales(checkouts, newKey())
    const estimated = response.bills.filter(bill => bill.profitEstimated).length
    setResult(`Saved ${response.bills.length} sales bills in one transaction.${estimated ? ` Profit on ${estimated} bill(s) is marked estimated because historical cost was not supplied.` : ''}`)
  }

  async function save() {
    setBusy(true); setError(null); setResult(null)
    try { if (kind === 'inventory') await saveInventory(); else await saveSales() }
    catch (e) { setError(e instanceof Error ? e.message : 'Import failed. No rows were saved.') }
    finally { setBusy(false) }
  }

  function downloadTemplate() {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([columns])
    sheet['!cols'] = columns.map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(workbook, sheet, 'Import')
    const guide = kind === 'inventory'
      ? [['Inventory import guide'], ['One row per colour and size variant. Use names or saved short codes for catalogue fields.'], ['Quantity must be a whole number greater than zero.'], ['Invoice / Reference and Reorder Level are optional.']]
      : [['Sales import guide'], ['Use one row per article line. Bill Number is optional; rows with the same customer name and sale date share a generated bill number when it is blank.'], ['Repeat date, staff, payment mode and customer details on every line of a bill.'], ['Historical import leaves current stock unchanged.'], ['Unit Cost is optional; imported profit is marked estimated when it is blank.']]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guide), 'Read me')
    XLSX.writeFile(workbook, `${kind}-import-template.xlsx`)
  }

  return <div className="page import-page">
    <header className="page-head"><button type="button" className="link" onClick={onBack}>← Dashboard</button><h1>Import {kind === 'inventory' ? 'inventory' : 'sales'}</h1><p className="muted">Upload, match your columns, correct catalogue values and validate the whole workbook before saving.</p></header>
    {error && <div className="banner err">{error}</div>}{result && <div className="banner ok">{result}</div>}
    <section className="card import-card">
      <div className="import-toolbar"><label className="primary file-button">Choose Excel file<input type="file" accept=".xlsx,.xls,.csv" onChange={e => e.target.files?.[0] && void readFile(e.target.files[0])} /></label><span className="muted small">{fileName || 'No file selected'}</span><button type="button" className="link" onClick={downloadTemplate}>Download Excel template</button></div>
      {kind === 'sales' && <div className="import-mode"><label className="inline-check"><input type="checkbox" checked={historicalOnly} onChange={e => setHistoricalOnly(e.target.checked)} /> Historical sales: record bills without changing current stock</label><p className="muted small">Historical mode does not change today’s inventory. Add Unit Cost when known; missing cost means imported profit is estimated.</p></div>}
      {sourceColumns.length > 0 && <details className="column-mapping" open={missingMappings.length > 0}><summary>Review column mapping · {missingMappings.length ? `${missingMappings.length} required field(s) need a match` : 'automatic matches ready'}</summary><div className="mapping-grid">{columns.map(column => <label className="field" key={column}><span>{column}{required.includes(column) ? ' · required' : ''}</span><select value={mapping[key(column)] ?? ''} onChange={e => changeMapping(column, e.target.value)}><option value="">Not in workbook</option>{sourceColumns.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}</select></label>)}</div><p className="muted small">Automatic matching recognizes common headings such as Qty, Colour/Color, Supplier, Mobile, SKU, Rate and Remarks. Choose a source column manually whenever a heading is ambiguous.</p></details>}
      {missingMappings.length > 0 && <div className="banner err">Map these required fields before saving: {missingMappings.join(', ')}.</div>}
      {rows.length === 0 ? <p className="muted">Upload an Excel workbook to review its rows here.</p> : <>
        <div className="import-summary">
          <button type="button" className="import-summary-card" onClick={showAllRows}><strong>{rows.length}</strong><span>rows · review all</span></button>
          <button type="button" className={`import-summary-card ${validation.length || missingMappings.length ? 'has-issues' : ''}`} onClick={validation.length ? goToIssues : missingMappings.length ? goToMapping : undefined} disabled={!validation.length && !missingMappings.length}>
            <strong>{validation.length || missingMappings.length || (articleCheck === 'checking' ? '…' : '✓')}</strong><span>{validation.length ? 'issues · show affected rows' : missingMappings.length ? 'fields need mapping · review' : articleCheck === 'checking' ? 'checking article codes' : 'ready to save'}</span>
          </button>
          <button type="button" className="import-summary-card" onClick={showAllRows}>
            <strong>{kind === 'sales' ? new Set(rows.map(row => value(row, 'Bill Number')).filter(Boolean)).size : new Set(rows.map(row => `${value(row, 'Article Type')}:${value(row, 'Brand')}:${value(row, 'Colour')}:${value(row, 'Size')}`)).size}</strong>
            <span>{kind === 'sales' ? 'bills · review grouping' : 'variants · review rows'}</span>
          </button>
        </div>
        {kind === 'sales' && <div className="import-bill-help"><strong>How bills are grouped</strong><span>Rows with the same bill number are one bill. Missing numbers are generated; matching customer names on the same sale date share a bill. Rows without a customer name stay separate.</span></div>}
        {kind === 'inventory' && <p className="muted small import-help">Blank cells mean the workbook did not include a value for that field. Choose a saved catalogue item, add a new brand when needed, then use “Fill blanks” for shared article details.</p>}
        <div className="import-review-tools">
          <label className="field import-search"><span>Search rows</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder="Bill, customer, article code…" /></label>
          <label className="inline-check"><input type="checkbox" checked={issuesOnly} onChange={event => { setIssuesOnly(event.target.checked); setPage(0) }} /> Show rows with issues only</label>
          <span className="muted small">Showing {filteredRows.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filteredRows.length)} of {filteredRows.length} matching rows</span>
          <div className="import-pagination"><button type="button" className="ghost" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page + 1} of {pageCount}</span><button type="button" className="ghost" disabled={page + 1 >= pageCount} onClick={() => setPage(current => current + 1)}>Next</button></div>
        </div>
        <div className="table-scroll" id="import-review-table"><table className="import-table"><thead><tr>{columns.map(header => <th key={header}><span>{header}</span>{(SHARED_INVENTORY_COLUMNS.has(header) || (kind === 'sales' && ['Sale Date', 'Customer Name', 'Customer Phone', 'Payment Mode', 'Staff'].includes(header))) && rows.some(row => !value(row, header)) && rows.some(row => value(row, header)) && <button type="button" className="link import-fill-blanks" onClick={() => kind === 'sales' ? fillBlankSalesRows(header) : fillBlankRows(header)}>Fill blanks</button>}</th>)}</tr></thead><tbody>{visibleRows.map(({ row, index }) => <tr key={index}>{columns.map(header => {
          const cellIssues = issuesForCell(index, header)
          return <td key={header} className={cellIssues.length ? 'import-cell-error' : undefined} title={cellIssues.join(' ')}>{editCell(row, index, header)}</td>
        })}</tr>)}</tbody></table>{filteredRows.length === 0 && <p className="muted import-empty-results">No rows match these filters.</p>}</div>
      </>}
      {validation.length > 0 && <div className="import-errors" id="import-errors"><strong>Resolve these rows before saving</strong>{validation.slice(0, 8).map(message => <p key={message}>{message}</p>)}{validation.length > 8 && <p>…and {validation.length - 8} more issues. Use “Show rows with issues only” to review the affected entries.</p>}</div>}
      <div className="actions"><button type="button" className="primary" disabled={!rows.length || validation.length > 0 || articleCheck === 'checking' || missingMappings.length > 0 || busy || !lookups} onClick={() => void save()}>{busy ? 'Validating and saving…' : articleCheck === 'checking' ? 'Checking article codes…' : `Validate and save ${rows.length || ''} rows`}</button><button type="button" className="ghost" onClick={onBack}>Cancel</button></div>
    </section>
    {addingBrandForRow !== null && <NewBrandDialog
      onCancel={() => setAddingBrandForRow(null)}
      onCreated={brand => {
        setLookups(current => current ? { ...current, brands: [...current.brands, brand].sort((a, b) => a.name.localeCompare(b.name)) } : current)
        setRows(current => current.map((row, rowIndex) => rowIndex === addingBrandForRow ? { ...row, brand: brand.name } : row))
        setAddingBrandForRow(null)
      }}
    />}
  </div>
}
