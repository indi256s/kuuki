import type {} from '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'

expect.extend(matchers)

// Component tests opt into jsdom with a docblock; node-environment tests have no document to clean.
afterEach(() => { if (typeof document !== 'undefined') cleanup() })
