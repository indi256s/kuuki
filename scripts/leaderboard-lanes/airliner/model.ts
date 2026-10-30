import type { Pt, Rings } from './surface'

/** The fields of a SCHEMA.md record the drawing reads. */
export type AircraftGeometry = {
  icao: string
  name: string
  family: string
  dims: {
    length: number
    span: number
    height: number
    fuselageWidth: number
    fuselageHeight: number
  }
  fuselage: {
    noseLength: number
    tailconeLength: number
    tailUpsweep: number
    cockpitWindowX: number
    decks: number
    end?: number
    mainDeckWindowZ?: number
    upperDeckWindowZ?: number
    noseExponent?: number
    tailEnd?: 'cone' | 'blade'
    cockpit?: { aftX: number; foreX: number; lowDeg: number; highDeg: number }
  }
  wing: {
    position: 'low' | 'high'
    rootLEx: number
    rootChord: number
    kinkY: number | null
    tipChord: number
    sweepLE: number
    dihedral: number
    leBreakY?: number
    sweepLEInboard?: number
  }
  wingtip: {
    type: 'none' | 'fence' | 'sharklet' | 'blended' | 'raked' | 'at-winglet' | 'curved'
    height: number
    below: number
    cant: number
    rootY?: number
    rakeLE?: { x: number; y: number }[]
    rakeTE?: { x: number; y: number }[]
  }
  htail: {
    position: 'fuselage' | 't-tail'
    rootY?: number
    rootLEx: number
    span: number
    rootChord: number
    tipChord: number
    sweepLE: number
    dihedral: number
    zBelowFinTop?: number
    tipLEx?: number
    tipTEx?: number
  }
  vtail: {
    rootLEx: number
    height: number
    rootChord: number
    tipChord: number
    sweepLE: number
    dorsalFin?: boolean
    dorsalLength?: number
    dorsalHeight?: number
  }
  engines: {
    y: number
    fanX: number
    nacelleDiameter: number
    nacelleLength: number
    dropBelowWing: number
    section?: 'round' | 'flat-bottom'
    prop: { diameter: number } | null
    exhaustLength?: number
  }[]
}

/** What a part is made of: each has its own tone ramp in the lane CSS. */
export type Mat = 'body' | 'livery' | 'rubber' | 'metal' | 'void' | 'glass'
/** Line inks: the silhouette, seams on a surface, and the faintest panel lines. */
export type Ink = 'line' | 'seam' | 'faint'
export type Lines = { runs: Pt[][]; ink: Ink; width: number }
export type Item =
  | {
      kind: 'solid'
      mat: Mat
      tones: Rings[]
      fill: Rings
      outline: Rings
      inner: Lines[]
      edge?: number
    }
  | { kind: 'fill'; rings: Rings; mat: Mat | 'shadow'; edge?: Ink; width?: number }
  | { kind: 'lines'; lines: Lines }
