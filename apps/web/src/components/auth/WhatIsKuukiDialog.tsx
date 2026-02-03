import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog'
import { Note, NoteContent } from '@/components/ui/note'
import { X } from 'lucide-react'


interface WhatIsKuukiDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function WhatIsKuukiDialog({ open, onOpenChange }: WhatIsKuukiDialogProps) {
    const { t } = useTranslation()

    const features = [
        {
            key: 'import',
        },
        {
            key: 'passport',
        },
        {
            key: 'gamification',
        },
        {
            key: 'privacy',
        },
        {
            key: 'community',
        },
    ]

    // Helper to parse markdown-like bold syntax (**text**)
    const renderDescription = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g)
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={index} className="font-bold text-foreground">{part.slice(2, -2)}</span>
            }
            return part
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="max-w-2xl p-0 gap-0 overflow-hidden bg-transparent border-none shadow-none sm:max-w-xl">
                <DialogTitle className="sr-only">{t('about.title')}</DialogTitle>

                <Note variant="glass" className="w-full relative">
                    <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>

                    <NoteContent className="space-y-6 pt-6">
                        {features.map((feature, index) => (
                            <div key={feature.key}>
                                <h3 className="font-semibold text-foreground text-base mb-1">
                                    {index + 1}. {t(`about.features.${feature.key}.title`)}
                                </h3>
                                <ul>
                                    <li className="text-foreground/90">
                                        {renderDescription(t(`about.features.${feature.key}.description`))}
                                    </li>
                                </ul>
                            </div>
                        ))}
                    </NoteContent>
                </Note>
            </DialogContent>
        </Dialog>
    )
}
