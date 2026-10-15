import {
  isGroundCategory,
  type LeaderboardCategory,
} from '../../../../../functions/api/_lib/leaderboard'
import type {
  LeaderboardBoardPayload,
  LeaderboardEntry,
  ViewerPlace,
} from '../../../../../functions/api/_services/publicLeaderboard'
import { formatNumber, type Locale } from '../../lib/format'
import { categoryUnit } from './categories'
import { CLOSE_GAP, type NarratorParams, type NarratorState } from './narrator'

export type Period = string
export type RankChange = { delta: number; celebrate: boolean }
export type RankChanges = Partial<Record<LeaderboardCategory, RankChange>>

export const viewerPlace = (
  payload: LeaderboardBoardPayload,
  category: LeaderboardCategory,
  period: Period,
): ViewerPlace | null => payload.viewer?.places[category]?.[period] ?? null

export const entryName = (entry: LeaderboardEntry, locale: Locale) =>
  entry.display_name ||
  (entry.username ? `@${entry.username}` : locale === 'ru' ? 'Участник' : 'Member')

/** The last place we know for the viewer: ranked now, or the last published one while changes are pending. */
export const shownEntry = (place: ViewerPlace | null) =>
  place?.state === 'ranked' || place?.state === 'pending' ? place.entry : null

/** Another board entry on the viewer's rank (ties share a place). */
export const sharer = (place: ViewerPlace | null) =>
  place?.state === 'ranked'
    ? (place.neighbours.find(
        (entry) => entry.user_id !== place.entry.user_id && entry.rank === place.entry.rank,
      ) ?? null)
    : null

export type TileModel =
  | { kind: 'rank'; rank: number; shared: boolean; name: string }
  | { kind: 'text'; text: string; name: string }
  | { kind: 'lock'; name: string }

/** What a category tile shows and how it is named, for the viewer (or the leader, for a guest). */
export function tileModel(
  payload: LeaderboardBoardPayload,
  category: LeaderboardCategory,
  period: Period,
  label: string,
  locale: Locale,
  rankOverride?: number,
): TileModel {
  const ru = locale === 'ru'
  const none = ru ? `${label}, места пока нет` : `${label}, no place yet`
  if (!payload.viewer) {
    const leader = payload.boards[category]?.[period]?.top[0]
    if (!leader)
      return {
        kind: 'text',
        text: '—',
        name: ru ? `${label}, лидера пока нет` : `${label}, no leader yet`,
      }
    const value = formatNumber(locale, leader.value)
    return {
      kind: 'text',
      text: value,
      name: ru ? `${label}, лидер ${value}` : `${label}, leader ${value}`,
    }
  }
  const place = viewerPlace(payload, category, period)
  if (place?.state === 'progress') {
    return {
      kind: 'text',
      text: `${place.have}/${place.need}`,
      name: ru
        ? `${label}, ${place.have} из ${place.need} для участия`
        : `${label}, ${place.have} of ${place.need} to join`,
    }
  }
  if (place?.state === 'blocked') {
    return {
      kind: 'lock',
      name: ru
        ? `${label}, закрыто до публикации всех стран`
        : `${label}, locked until all countries are published`,
    }
  }
  const entry = shownEntry(place)
  if (entry) {
    const rank = rankOverride ?? entry.rank
    return {
      kind: 'rank',
      rank,
      shared: !!sharer(place),
      name: ru ? `${label}, ваше место ${rank}` : `${label}, your place ${rank}`,
    }
  }
  return { kind: 'text', text: '—', name: none }
}

export interface NarratorChoice {
  state: NarratorState
  params: NarratorParams
}

/** The narrator state for the selected category and period; the facts are the numbers on screen. */
export function narratorChoice(
  payload: LeaderboardBoardPayload,
  category: LeaderboardCategory,
  period: Period,
  locale: Locale,
  change: { delta: number } | undefined,
): NarratorChoice {
  const slice = payload.boards[category]?.[period]
  const empty = !slice || slice.total === 0 || slice.top.length === 0
  const withUnit = (value: number) =>
    `${formatNumber(locale, value)} ${categoryUnit(category, value, locale)}`
  if (!payload.viewer) {
    const leader = slice?.top[0]
    if (empty || !leader) return { state: 'empty', params: {} }
    return {
      state: 'guest',
      params: {
        name: leader.username ?? leader.display_name ?? '',
        value: withUnit(leader.value),
      },
    }
  }
  const place = viewerPlace(payload, category, period)
  switch (place?.state) {
    case 'off':
      return { state: 'off', params: {} }
    case 'pending':
      return { state: 'pending', params: {} }
    case 'blocked':
      return { state: 'blocked', params: {} }
    case 'progress':
      return {
        state: isGroundCategory(category) ? 'progressGround' : 'progressSky',
        params: { have: formatNumber(locale, place.have), need: formatNumber(locale, place.need) },
      }
    case 'ranked': {
      if (period === 'all' && change && change.delta < 0)
        return { state: 'slipped', params: { places: formatNumber(locale, -change.delta) } }
      const other = sharer(place)
      if (!place.next && !other) return { state: 'leader', params: {} }
      if (other)
        return {
          state: 'tied',
          params: {
            place: `#${place.entry.rank}`,
            name: other.username ?? other.display_name ?? '',
          },
        }
      if (place.next)
        return {
          state: place.next.gap <= CLOSE_GAP ? 'close' : 'far',
          params: {
            name: place.next.entry.username ?? place.next.entry.display_name ?? '',
            gap: withUnit(place.next.gap),
          },
        }
      return { state: 'leader', params: {} }
    }
    default:
      return { state: empty ? 'empty' : 'unranked', params: {} }
  }
}
