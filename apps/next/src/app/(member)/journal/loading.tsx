import { getRequestLocale } from '../../../server/locale'

export default async function Loading() {
  const ru = (await getRequestLocale()) === 'ru'
  return <><div className="page-heading"><h1>{ru ? 'Журнал' : 'Journal'}</h1></div><p className="loading" role="status">{ru ? 'Загружаем…' : 'Loading…'}</p></>
}
