import type { BadgeTier } from './badge-tracks'

export interface TierVisual {
  bg: string
  text: string
  border: string
  ring: string
  iconBg: string
}

export const TIER_VISUALS: Record<BadgeTier | 'none', TierVisual> = {
  none: {
    bg: 'bg-muted/20',
    text: 'text-muted-foreground',
    border: 'border-muted/50',
    ring: 'ring-muted/30',
    iconBg: 'bg-muted/30',
  },
  bronze: {
    bg: 'bg-amber-900/20',
    text: 'text-amber-400',
    border: 'border-amber-700/50',
    ring: 'ring-amber-700/50',
    iconBg: 'bg-amber-900/30',
  },
  silver: {
    bg: 'bg-slate-400/20',
    text: 'text-slate-300',
    border: 'border-slate-500/50',
    ring: 'ring-slate-500/50',
    iconBg: 'bg-slate-400/30',
  },
  gold: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-600/50',
    ring: 'ring-yellow-600/50',
    iconBg: 'bg-yellow-500/30',
  },
  platinum: {
    bg: 'bg-cyan-400/20',
    text: 'text-cyan-300',
    border: 'border-cyan-500/50',
    ring: 'ring-cyan-500/50',
    iconBg: 'bg-cyan-400/30',
  },
  diamond: {
    bg: 'bg-purple-400/20',
    text: 'text-purple-300',
    border: 'border-purple-500/50',
    ring: 'ring-purple-500/50',
    iconBg: 'bg-purple-400/30',
  },
}

export function getTierVisual(tier: BadgeTier | null): TierVisual {
  return TIER_VISUALS[tier ?? 'none']
}
