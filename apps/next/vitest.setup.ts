import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Component tests opt into jsdom with a docblock; node-environment tests have no document to clean.
afterEach(() => { if (typeof document !== 'undefined') cleanup() })
