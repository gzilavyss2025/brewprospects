// The packed snapshot format (docs/adr/0015). Each club is stored once in
// `clubs`, and a row is an array whose columns the file names in `columns`,
// so the file explains itself. Used by every packed file: careers.json
// (docs/adr/0006) and mlb.json.

// Packs rows into one shared club table. `row(group, r)` returns the array;
// `clubs` is the table so far. A field with no column throws, so a new field
// in a slim function cannot be dropped in silence (docs/adr/0003).
export function packer({ columns, clubColumns }) {
  const clubs = []
  const clubIndex = new Map()
  const club = (r) => {
    const values = clubColumns.map((k) => r[k] ?? null)
    const key = JSON.stringify(values)
    if (!clubIndex.has(key)) clubIndex.set(key, clubs.push(values) - 1)
    return clubIndex.get(key)
  }
  const row = (group, r) => {
    const known = new Set([...columns[group], ...clubColumns])
    for (const k of Object.keys(r)) {
      if (!known.has(k)) throw new Error(`No column for the ${group} field "${k}".`)
    }
    return columns[group].map((k) => (k === 'club' ? club(r) : (r[k] ?? null)))
  }
  return { row, clubs }
}

// The reverse. It reads the column names from the file, not from a module.
export function unpacker({ columns, clubColumns, clubs }) {
  return (group, values) => {
    const r = {}
    columns[group].forEach((name, i) => {
      if (name !== 'club') {
        r[name] = values[i]
        return
      }
      const c = clubs[values[i]]
      if (!c) throw new Error(`A ${group} row points at club ${values[i]}, which is not in the club table.`)
      clubColumns.forEach((k, j) => { r[k] = c[j] })
    })
    return r
  }
}
