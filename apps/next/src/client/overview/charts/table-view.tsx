'use client'

export type ChartTable = {
  caption: string
  columns: readonly { key: string; label: string; numeric?: boolean }[]
  rows: readonly Record<string, string | number>[]
}

/** Semantic chart data for screen readers, without a visible duplicate of the plot. */
export function TableView({ table }: { table: ChartTable }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {table.columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
