export type Look = 'blue' | 'black' | 'white'

export const LOOKS: readonly Look[]

/** ASCII Koi's water tokens for each look, as pond.js reads them. */
export const WATERS: Record<Look, { water: string; ink: string; accent: string; koiLight: string; koiDark: string; dark: boolean }>

/**
 * The whole backdrop for one water as one SVG document of at most 128000
 * characters (the app refuses more than 131072) that animates by itself by CSS
 * alone. `width` is how many of the page's pixels the view is wide: a wider
 * view makes the koi smaller on the same window.
 */
export function bakeScene(look: Look, options?: { width?: number; koi?: number }): { svg: string; alt: string }
