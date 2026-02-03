import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog'
import { Note, NoteContent, NoteHeader } from '@/components/ui/note'


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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-transparent border-none shadow-none sm:max-w-xl">
                <DialogTitle className="sr-only">{t('about.title')}</DialogTitle>

                <Note variant="glass" className="w-full">
                    <NoteHeader className="px-2 pt-2">
                        <div className="flex items-center justify-center pb-4 text-center">
                            <span className="text-sm font-medium text-muted-foreground/60 tracking-wide">
                                {t('about.title')}...
                            </span>
                        </div>
                    </NoteHeader>
                    <NoteContent className="space-y-6">
                        {features.map((feature, index) => (
                            <div key={feature.key}>
                                <h3 className="font-semibold text-foreground text-base mb-1">
                                    {index + 1}. {t(`about.features.${feature.key}.title`)}
                                </h3>
                                <ul>
                                    <li>
                                        {t(`about.features.${feature.key}.description`)}
                                    </li>
                                </ul>
                            </div>
                        ))}

                        <div className="pt-4 mt-8 border-t border-border/10 flex justify-center text-[10px] text-muted-foreground font-mono opacity-50">
                            {t('about.footer_chars', { defaultValue: '1 246 characters' })}
                        </div>
                    </NoteContent>
                </Note>
            </DialogContent>
        </Dialog>
    )
}
