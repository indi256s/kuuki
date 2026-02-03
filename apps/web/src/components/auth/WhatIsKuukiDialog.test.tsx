import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WhatIsKuukiDialog } from './WhatIsKuukiDialog'

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'about.title': 'What is Kuuki?',
                'about.description': 'Kuuki means Air',
                'about.meaning': 'Reading the air',
                'about.meaningDetail': 'Context without words',
                'about.features.import.title': 'Smart Import',
                'about.features.import.description': 'AI extraction',
                'about.features.passport.title': 'Digital Impressions',
                'about.features.passport.description': 'Unique stamps',
                'about.features.gamification.title': 'Stress-free Gamification',
                'about.features.gamification.description': 'Badges',
                'about.features.privacy.title': 'Privacy by Design',
                'about.features.privacy.description': 'Hidden routes',
                'about.features.community.title': 'Community Driven',
                'about.features.community.description': 'Feedback',
            }
            return translations[key] || key
        },
    }),
}))

// Mock Dialog components from shadcn/ui to avoid complex portal issues in unit tests
// We blindly trust Radix UI's behavior, we just want to test our content integration
vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
        open ? <div>{children}</div> : null
    ),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogClose: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock('@/components/ui/note', () => ({
    Note: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
    NoteContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    NoteHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))


describe('WhatIsKuukiDialog', () => {
    it('does not render when open is false', () => {
        render(<WhatIsKuukiDialog open={false} onOpenChange={vi.fn()} />)
        expect(screen.queryByText('What is Kuuki?')).not.toBeInTheDocument()
    })

    it('renders correctly when open is true', () => {
        render(<WhatIsKuukiDialog open={true} onOpenChange={vi.fn()} />)

        // Check header
        expect(screen.getAllByText('What is Kuuki?')[0]).toBeInTheDocument()



        // Check features
        expect(screen.getByText('1. Smart Import')).toBeInTheDocument()
        expect(screen.getByText('AI extraction')).toBeInTheDocument()

        expect(screen.getByText('2. Digital Impressions')).toBeInTheDocument()
        expect(screen.getByText('Unique stamps')).toBeInTheDocument()

        expect(screen.getByText('3. Stress-free Gamification')).toBeInTheDocument()
        expect(screen.getByText('Badges')).toBeInTheDocument()

        expect(screen.getByText('4. Privacy by Design')).toBeInTheDocument()
        expect(screen.getByText('Hidden routes')).toBeInTheDocument()

        expect(screen.getByText('5. Community Driven')).toBeInTheDocument()
        expect(screen.getByText('Feedback')).toBeInTheDocument()
    })
})
