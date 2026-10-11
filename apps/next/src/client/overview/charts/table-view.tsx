'use client'

import { useLocale } from '../../preferences'
import { Disclosure } from '../../ui/disclosure'
import { t } from '../copy'
import './chart-theme.css'

export type ChartTable = {
  caption: string
  columns: readonly { key: string; label: string; numeric?: boolean }[]
  rows: readonly Record<string, string | number>[]
}

export function TableView({ table }: { table: ChartTable }) {
  const locale = useLocale()
  return (
    <div className="kc-table">
      <Disclosure summary={t({ en: 'View as table', ru: 'Показать таблицу' }, locale)}>
        <div className="kc-table-scroll">
          <table>
            <caption>{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column.key} scope="col" data-numeric={column.numeric || undefined}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {table.columns.map((column) => (
                    <td key={column.key} data-numeric={column.numeric || undefined}>
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </div>
  )
}
