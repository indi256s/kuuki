import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Note, NoteContent } from '@/components/ui/note'
import { Sparkles, Map, Award, Lock, Users } from 'lucide-react'


interface WhatIsKuukiDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function WhatIsKuukiDialog({ open, onOpenChange }: WhatIsKuukiDialogProps) {
    const { t } = useTranslation()

    const features = [
        {
            key: 'import',
            icon: <Sparkles className="w-4 h-4 text-primary" />,
        },
        {
            key: 'passport',
            icon: <Map className="w-4 h-4 text-emerald-500" />,
        },
        {
            key: 'gamification',
            icon: <Award className="w-4 h-4 text-amber-500" />,
        },
        {
            key: 'privacy',
            icon: <Lock className="w-4 h-4 text-rose-500" />,
        },
        {
            key: 'community',
            icon: <Users className="w-4 h-4 text-indigo-500" />,
        },
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-white/20 shadow-2xl p-0 overflow-hidden gap-0 rounded-2xl">
                <DialogTitle className="sr-only">{t('about.title')}</DialogTitle>

                <div className="grid md:grid-cols-[200px_1fr] h-full">
                    {/* Left Column: Visual & Branding */}
                    <div className="bg-neutral-100/50 dark:bg-black/20 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-border/50 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 block" />

                        <div className="relative z-10 space-y-4">
                            <span className="text-6xl font-display font-bold text-primary/20 select-none">
                                空気
                            </span>
                            <div>
                                <h3 className="font-semibold text-lg">Kuuki</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('about.description')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Content */}
                    <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                {t('about.title')}
                            </DialogTitle>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                {t('about.meaning')} <span className="text-primary/80">{t('about.meaningDetail')}</span>
                            </p>
                        </DialogHeader>

                        <div className="space-y-4">
                            {features.map((feature) => (
                                <Note key={feature.key} variant="glass" className="p-4 border-l-4 border-l-primary/20">
                                    <NoteContent>
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 shrink-0 p-1.5 bg-background/50 rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                                                {feature.icon}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-foreground text-sm mb-1">
                                                    {t(`about.features.${feature.key}.title`)}
                                                </h4>
                                                <div className="text-xs text-muted-foreground leading-relaxed">
                                                    {/* We use dangerouslySetInnerHTML to support bold markdown in translation if simple replacement is not enough, 
                                                but here we will trust the translation string structure or use a simpler approach.
                                                Ideally i18next interpolation or a parser. For now, we assume plain text or handled by i18next Trans component.
                                                Let's stick to simple text for safety unless 'Trans' is needed.
                                            */}
                                                    {t(`about.features.${feature.key}.description`)}
                                                </div>
                                            </div>
                                        </div>
                                    </NoteContent>
                                </Note>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
