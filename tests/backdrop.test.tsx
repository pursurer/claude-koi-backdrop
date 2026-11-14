import { expect, test } from 'claude-code/testing'

const BACKDROP = {
  plugin: 'koi-backdrop',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'koi', plugin: 'koi-backdrop', glass: { blur: 4, opacity: 0.55 } },
} as const

test('the backdrop is one SVG document the app can draw', async ($, on) => {
  const sets: unknown[] = []
  on('command.register', () => ({ value: { command: 'koi' } }))
  on('store.get', () => ({ value: undefined }))
  on('theme.set', (_, e) => { sets.push(e); return { value: { isDrawn: true, requestId: 'backdrop' } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(sets.length).toBe(1)

  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source ?? '')
  expect(source.startsWith('<svg')).toBe(true)
  // the Svg refuses a source of more than 131072 characters; the scene keeps some room below that
  expect(source.length).toBeLessThan(128001)
  // what the app's frame needs to give the drawing room, and nothing a stricter frame might drop
  expect(source).toContain('width="100%" height="100%"')
  expect(source).toContain('@keyframes')
  expect(source.includes('var(--')).toBe(false)
  // the style sheet in the form of Anthropic's scenes: class selectors, each slice's delays on the slice itself
  const style = /<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? ''
  expect(style.length > 0).toBe(true)
  expect(style.includes('nth-child')).toBe(false)
  expect(style.includes('>')).toBe(false)
  expect(source).toContain('style="animation-delay:')
  // each slice carries two motions: the body wave by transform, the bend of the path by the translate property
  expect(/@keyframes p\d\{from\{translate:0 /.test(style)).toBe(true)
  expect(svg?.props.isInteractive).toBe(true)
  // The app plays a mod's animation only if the document passes its check. One rule reads a dot or digit followed
  // by vw, vh, vi, vb, vmin, vmax (or cqw and the like) as a viewport unit and refuses it: a class named .Vb did that.
  expect(/(?:\d|\.)(?:[dsl]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))(?![a-z0-9_-])/i.test(source)).toBe(false)
  // a backslash is refused in the style sheet and in attributes; the fins' ray glyphs are text, which the check leaves alone
  expect(style.includes('\\')).toBe(false)
  expect(/shape-rendering|vector-effect|data:|url\(/i.test(source)).toBe(false)
  await ui.unmount()
})
