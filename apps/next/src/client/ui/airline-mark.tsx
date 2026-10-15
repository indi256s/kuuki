'use client'

import Image from 'next/image'
import { useState } from 'react'
import { airlineColor, airlineIdentity } from '../../lib/airline'
import './ui.css'

/** The row supplies the airline name and flight number; this mark is decorative. */
export function AirlineMark({ iata }: { iata: string | null }) {
  const airline = airlineIdentity(iata ?? '')
  const [failedLogo, setFailedLogo] = useState<string>()
  const [failedDarkLogo, setFailedDarkLogo] = useState<string>()
  const logo = airline?.logoUrl
  const darkLogo = airline?.logoDarkUrl
  const showDarkLogo = darkLogo && darkLogo !== failedDarkLogo
  const showLogo = logo && logo !== failedLogo
  return (
    <span
      className="ui-airline-mark"
      data-logo={showLogo || undefined}
      data-dark-logo={(showLogo && showDarkLogo) || undefined}
      aria-hidden="true"
      title={airline?.name ?? iata ?? undefined}
    >
      {showLogo ? (
        <>
          <Image
            className="ui-airline-logo-default"
            src={logo}
            alt=""
            width={48}
            height={24}
            unoptimized
            onError={() => setFailedLogo(logo)}
          />
          {showDarkLogo && (
            <Image
              className="ui-airline-logo-dark"
              src={darkLogo}
              alt=""
              width={48}
              height={24}
              unoptimized
              onError={() => setFailedDarkLogo(darkLogo)}
            />
          )}
        </>
      ) : (
        <i style={{ backgroundColor: airlineColor(iata ?? '') }} />
      )}
    </span>
  )
}
