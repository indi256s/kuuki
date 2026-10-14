import type { toUserBadgeWithDefinition } from '../../../../../functions/api/_lib/badges'

export type EarnedBadge = ReturnType<typeof toUserBadgeWithDefinition>
export const badgeEventId = (item: EarnedBadge) => `${item.id}:${item.badge_id}:${item.earned_at}`
