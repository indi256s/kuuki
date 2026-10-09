/** Additive canonical-write acknowledgement; contains no UI or runtime dependencies. */
export interface DerivedAck {
  derived_state?: 'ready' | 'pending'
  revision?: number
}
