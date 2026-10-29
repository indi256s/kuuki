import type { FeatureKind } from '../../lib/airport-models/model'
export const kindNames: Record<FeatureKind, { en: string; ru: string }> = {
  runway: { en: 'Runway', ru: 'ВПП' },
  taxiway: { en: 'Taxiway', ru: 'Рулёжная дорожка' },
  apron: { en: 'Apron', ru: 'Перрон' },
  stand: { en: 'Stand', ru: 'Стоянка' },
  terminal: { en: 'Terminal', ru: 'Терминал' },
  hangar: { en: 'Hangar', ru: 'Ангар' },
  building: { en: 'Building', ru: 'Здание' },
  tower: { en: 'Control tower', ru: 'Диспетчерская вышка' },
  gate: { en: 'Gate', ru: 'Выход' },
}
