import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useSearchUsers } from '@/hooks/useProfile'
import { generateAvatarUrl, type Profile } from '@/lib/profiles'

interface UserSearchInputProps {
  onSelect: (profile: Profile) => void
  excludeUserId?: string
  placeholder?: string
}

export function UserSearchInput({ onSelect, excludeUserId, placeholder }: UserSearchInputProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: results, isLoading } = useSearchUsers(query)

  // Filter out excluded user
  const filteredResults = results?.filter(p => p.id !== excludeUserId) ?? []

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (profile: Profile) => {
    onSelect(profile)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || t('compare.searchPlaceholder', 'Search by username...')}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 py-1 bg-popover border rounded-lg shadow-lg max-h-64 overflow-auto"
        >
          {filteredResults.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              {isLoading ? (
                t('common.loading', 'Loading...')
              ) : (
                t('common.noResults', 'No results found')
              )}
            </div>
          ) : (
            filteredResults.map((profile) => {
              const avatarUrl = profile.avatar_url || generateAvatarUrl(profile.id, 'teal')
              const displayName = profile.display_name || profile.username

              return (
                <button
                  key={profile.id}
                  onClick={() => handleSelect(profile)}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-accent transition-colors text-left"
                >
                  <img
                    src={avatarUrl}
                    alt={displayName ?? ''}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium">{displayName}</p>
                    {profile.username && (
                      <p className="text-xs text-muted-foreground">@{profile.username}</p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
