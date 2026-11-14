/*
 * Koi backdrop: the ASCII Koi pond behind the conversation.
 *
 * At session start the mod sets a theme whose backdrop is one SVG document
 * that animates by itself, as Anthropic's theme-examples plugin does. Nothing
 * is sent again until the water changes: a document sent anew for every
 * frame blinks.
 *
 *   /koi                          says which water is on
 *   /koi black|blue|white         changes the water
 *   /koi size <50-160>            how large the koi are, in percent
 *   /koi glass <blur> <opacity>   how the app's panels frost over the pond
 *   /koi off, /koi on
 */
import type { EngineInterface, Register } from 'claude-code'

import type { Look } from './bake'
import { bakeScene, LOOKS, WATERS } from './bake.js'

const SCENE = 'koi'
/*
 * The view's width, in ASCII Koi's pixels, at size 100. ASCII Koi draws its
 * koi at full size on any window over 1000 px wide; on a window about 1500
 * wide, a view 1890 wide shows them at about 0.8 of that.
 */
const WIDTH = 1890

type Glass = { blur: number; opacity: number }
type Settings = { look: Look; glass: Glass; size: number }

/* How the app's panels frost over the pond: a light blur in the water's own colour, so the koi stay koi under the words. */
const GLASS: Glass = { blur: 3, opacity: 0.5 }

const isLook = (v: unknown): v is Look => typeof v === 'string' && (LOOKS as readonly string[]).includes(v)

/* The document of this load: a reload bakes it again, and the store says which water it was. */
let scene: { svg: string; alt: string } | null = null
let isOn = true

const stored = async ($: EngineInterface): Promise<Settings> => {
  const [l, g, s] = await Promise.all([$.store.get('look'), $.store.get('glass'), $.store.get('size')])
  const glass = g && typeof g === 'object' ? (g as Partial<Glass>) : {}

  return {
    look: isLook(l) ? l : 'black',
    glass: { blur: typeof glass.blur === 'number' ? glass.blur : GLASS.blur, opacity: typeof glass.opacity === 'number' ? glass.opacity : GLASS.opacity },
    size: typeof s === 'number' && s >= 50 && s <= 160 ? s : 100,
  }
}

const bake = (now: Settings) => bakeScene(now.look, { width: (WIDTH * 100) / now.size })

async function show($: EngineInterface, now: Settings) {
  scene = bake(now)
  isOn = true
  /* the scene, its glass and the kind of window it is made for; the app keeps its own colours */
  const set = await $.theme.set({
    overrideColorScheme: now.look === 'white' ? 'light' : 'dark',
    backdrop: { scene: SCENE, glass: { ...now.glass, tint: WATERS[now.look].water } },
  })
  $.ui.invalidate('ui.render')

  return set
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'koi',
      description: 'The koi pond behind the conversation: change the water or the size',
      argumentHint: '[black|blue|white|size <50-160>|glass <blur> <opacity>|off|on]',
    })
    /* neither a reload nor --resume keeps a theme, so it is set here every time */
    await show($, await stored($))

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.plugin !== $.plugin.name || e.props.scene !== SCENE) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    /* a load that lost the document (the module's own variables start over) draws it again from what is stored */
    if (!scene) scene = bake(await stored($))
    const { Svg } = $.ui.resolve(e)

    /* isInteractive: the app draws the document in a frame of its own, where its CSS animation runs */
    return <Svg isInteractive source={scene.svg} alt={scene.alt} />
  })

  on('command.run', { command: 'koi' }, async ($, e) => {
    const [word = '', ...rest] = e.args.trim().toLowerCase().split(/\s+/)
    const now = await stored($)
    const nothing = (reason: string) => `Saved. Nothing draws it here: ${reason}`

    if (isLook(word)) {
      await $.store.set('look', word)
      const set = await show($, { ...now, look: word })

      return { text: set.isDrawn ? `The koi swim in ${word} water.` : nothing(set.reason) }
    }
    if (word === 'size') {
      const size = Number(rest[0])
      if (!(size >= 50 && size <= 160)) return { text: `The koi are at size ${now.size}. Set it with /koi size <50-160>: smaller numbers make smaller koi.` }
      await $.store.set('size', size)
      const set = await show($, { ...now, size })

      return { text: set.isDrawn ? `The koi are at size ${size}.` : nothing(set.reason) }
    }
    if (word === 'glass') {
      const blur = Number(rest[0]), opacity = Number(rest[1])
      if (!(blur >= 0 && blur <= 64) || !(opacity >= 0 && opacity <= 1)) return { text: `Glass is blur ${now.glass.blur}, opacity ${now.glass.opacity}. Set it with /koi glass <blur 0-64> <opacity 0-1>.` }
      await $.store.set('glass', { blur, opacity })
      const set = await show($, { ...now, glass: { blur, opacity } })

      return { text: set.isDrawn ? `Glass: blur ${blur}, opacity ${opacity}.` : nothing(set.reason) }
    }
    if (word === 'off') {
      /* the person asked: the one case that clears the session's theme */
      isOn = false
      await $.theme.clear()

      return { text: 'The pond is off. /koi on brings it back.' }
    }
    if (word === 'on') {
      const set = await show($, now)

      return { text: set.isDrawn ? 'The pond is back.' : `Nothing draws it here: ${set.reason}` }
    }

    return { text: `Water: ${now.look}${isOn ? '' : ' (off)'}, size ${now.size}. /koi black, blue or white changes the water; /koi size <50-160> the koi's size; /koi off takes the pond away.` }
  })
}
