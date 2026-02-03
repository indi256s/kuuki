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

    const features = ['import', 'passport', 'gamification', 'privacy', 'community']

    // Helper to parse markdown-like bold syntax (**text**)
    // Supports multiple bold segments and Unicode (Cyrillic, etc.)
    const renderWithBold = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g)
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} className="font-semibold text-foreground">
                        {part.slice(2, -2)}
                    </strong>
                )
            }
            return part
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="max-w-2xl p-0 gap-0 overflow-hidden bg-transparent border-none shadow-none sm:max-w-xl">
                <DialogTitle className="sr-only">{t('about.title')}</DialogTitle>

                <Note variant="glass" className="w-full relative overflow-hidden">
                    {/* Close button - positioned inside the rounded area */}
                    <DialogClose className="absolute right-2 top-2 p-2 rounded-full bg-muted/50 hover:bg-muted opacity-70 hover:opacity-100 transition-all z-10">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>

                    <NoteContent className="pr-10">
                        <ul className="space-y-4">
                            {features.map((key) => (
                                <li key={key}>
                                    {renderWithBold(t(`about.features.${key}.description`))}
                                </li>
                            ))}
                        </ul>
                    </NoteContent>
                </Note>
            </DialogContent>
        </Dialog>
    )
}
