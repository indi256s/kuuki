import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

const accents = [
    { name: 'Indigo', value: 'indigo', color: '#5E6AD2' },
    { name: 'Teal', value: 'teal', color: '#2EB88A' },
    { name: 'Amber', value: 'amber', color: '#E5A000' },
    { name: 'Rose', value: 'rose', color: '#E5484D' },
    { name: 'Blue', value: 'blue', color: '#0091FF' },
]

export function AccentPicker() {
    const [activeAccent, setActiveAccent] = useState('indigo')

    useEffect(() => {
        // On mount, check if there's a stored accent or default to indigo
        const saved = localStorage.getItem('kuuki-accent') || 'indigo'
        setActiveAccent(saved)
        document.documentElement.dataset.accent = saved
    }, [])

    const handleAccentChange = (accent: string) => {
        setActiveAccent(accent)
        localStorage.setItem('kuuki-accent', accent)
        document.documentElement.dataset.accent = accent
    }

    return (
        <div className="flex items-center gap-2 p-1 bg-white/50 backdrop-blur-sm rounded-full border border-black/5 shadow-sm">
            {accents.map((accent) => (
                <button
                    key={accent.value}
                    onClick={() => handleAccentChange(accent.value)}
                    className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110",
                        "border border-transparent hover:border-black/10",
                        activeAccent === accent.value && "ring-2 ring-offset-2 ring-offset-white ring-black/10 scale-105"
                    )}
                    style={{ backgroundColor: accent.color }}
                    aria-label={`Set accent to ${accent.name}`}
                >
                    {activeAccent === accent.value && (
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                    )}
                </button>
            ))}
        </div>
    )
}
