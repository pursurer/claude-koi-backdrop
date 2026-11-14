/*
 * The backdrop as one SVG document that animates by CSS alone: the app draws
 * it once and the koi swim inside it. (A document sent anew for every frame
 * would blink while the app loads the next.)
 *
 * Every koi is drawn by pond.js, ASCII Koi's own pond, unchanged. At load
 * this file poses each koi along its own lane, in a gentle curve, lets
 * pond.js paint it into a stand-in canvas, and reads the painted cells back.
 *
 * The swimming follows the way of Anthropic's theme-examples plugin (its
 * koi-mosaic scene): a koi is a train of slices, mostly one column of cells
 * each, every cell upright. The whole koi glides along its lane. Every slice
 * follows two motions of pond.js's koi, each a little later than on the
 * slice ahead of it:
 * - the body wave: about a second and a half a beat, low at the head and
 *   highest at the tail, running down the body as pond.js's does;
 * - the bend of the path: a slow, small swing that reaches each slice as
 *   late as the koi takes to swim there.
 * Both stay smooth between neighbours: a slice is never more than GAP
 * pixels off the next. Each slice carries its own shadow.
 *
 * The light on the scales is pond.js's too. Where its caustic net crosses a
 * koi's back a scale glints. The koi is painted at more than one place of
 * the pond, under different pieces of that net; the scales that glint at
 * each place are kept as a set, and each set flashes in turn, from the head
 * back to the tail, as the net would pass over a koi that swims under it.
 *
 * The style sheet keeps to the form of Anthropic's scenes: class selectors,
 * each slice's delays in its own style attribute.
 */
import './pond.js'

export const LOOKS = ['blue', 'black', 'white']

/* ASCII Koi's three waters, as pond.js reads them */
export const WATERS = {
  blue: { water: '#0e2a32', ink: '#ebe6dc', accent: '#e8784f', koiLight: '#ece6da', koiDark: '#3a3632', dark: true },
  black: { water: '#0d1315', ink: '#ebe6dc', accent: '#e8784f', koiLight: '#ece6da', koiDark: '#3a3632', dark: true },
  white: { water: '#e9e4da', ink: '#1c1a17', accent: '#9e3214', koiLight: '#f7f2e8', koiDark: '#2b2723', dark: false },
}

/*
 * The app refuses an Svg source of more than 131072 characters; the scene
 * keeps some room below that. (Its real limits are that size, its check of
 * the source and the time a frame takes to draw, not a count of animations.)
 */
const ROOM = 128000
/* ASCII Koi's cells at full width: 10 by 13 pixels, koi at 1.85 */
const CW = 10, CH = 13, K = 1.85
const N = 10
/*
 * Koi drawn each in its own right. Each costs some 13K characters, so 8 and
 * the water's net fill the room; more koi are mirror images of these.
 */
const UNIQUE = 8
/* colours a step apart look the same on a cell, and cells of one colour share one element */
const STEP = 12
/*
 * Two neighbouring slices sit about this many pixels apart at most, under the
 * body wave and the bend of the path together. That keeps most slices one
 * column wide, so the body bends smoothly, no slice is seen to jump, and
 * the rows of cells stay nearly in line along the koi's edges.
 */
const GAP = 2
/* each koi's heading off the level, in radians: lanes that cross, up to about 24 degrees */
const TILTS = [-0.3, 0.4, 0.12, -0.42, 0.34, -0.1, 0.22, -0.36]
/*
 * Each koi's bend at every joint of its spine, in radians: some to one side,
 * some to the other, the whole body 23 to 36 degrees from head to tail.
 * ASCII Koi's koi are seldom straight; that curve and the slant of their
 * lanes is what makes them look round, where a straight koi on a level lane
 * looks like a brick. Much more and the tail fan stands up like a fence.
 */
const CURVES = [0.06, -0.045, 0.07, -0.06, 0.045, -0.07, 0.055, -0.05]
/*
 * Three ways of swimming, after pond.js:
 * - speed: pixels a second along the level, about pond.js's cruise (24 to
 *   36, times 0.65 to 1.35 with the beat);
 * - beat: seconds of one body wave (pond.js's phase turns at 2.6 to 7.6 a
 *   second, 0.8 to 2.4 s a wave), and tail: its height in pixels at the tail;
 * - bend: seconds of one slow swing of the path to and fro.
 */
const GAITS = [
  { speed: 26, beat: 1.7, tail: 10, bend: 18 },
  { speed: 31, beat: 1.45, tail: 9.5, bend: 16 },
  { speed: 37, beat: 1.25, tail: 9, bend: 14 },
]
/*
 * The path swings off the lane by at most this slope. A slice is a column of
 * upright cells, so the body follows a bend by sliding its columns, not by
 * turning, and the head never turns to where it goes. A big swing reads as a
 * koi carried sideways, so the swing stays small.
 */
const SLOPE = 0.1
/*
 * Power and glide, after pond.js: there a koi's beat rises and falls over
 * about 14 s, and it swims faster and swings its tail wider as the beat
 * rises. Here a cycle is BEATS waves long; the wave's height runs from LOW of
 * its full height at the glide to all of it at the power stroke, and the koi
 * swims SURGE faster or slower than its gait's speed, fastest at the power.
 */
const BEATS = 8, LOW = 0.45, SURGE = 0.3
/*
 * Where else in the pond a koi is painted to see how the light falls on it
 * there, in cells from its first place, and the seconds from one flash of a
 * set of glints to its next.
 */
const LIGHTS = [[0, 0], [41, -17]]
const GLINT = 3.2
/* pond.js's body wave runs 4.6 radians from head to tail */
const WAVE = 4.6
/* a sine as CSS eases it: easeInOutSine, played to and fro */
const SINE = 'cubic-bezier(.37,0,.63,1)'

const hash = (a, b) => {
  let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35)

  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}
const num = v => {
  const s = String(Math.round(v * 100) / 100)

  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s
}
const hex2 = v => (v < 16 ? '0' : '') + v.toString(16)
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const KEY = 4096, HALF = 2048
const keyOf = (col, row) => (row + HALF) * KEY + (col + HALF)
const cellOf = key => [(key % KEY) - HALF, Math.floor(key / KEY) - HALF]

/*
 * The canvas pond.js paints into. It keeps what each cell got, by the order of
 * pond.js render(): the water, the shadows, the koi's tiles, the water's own
 * glyphs, then the glyphs pressed into the koi.
 */
class Cells {
  constructor() {
    this.width = 0
    this.height = 0
    this.begin()
  }

  begin() {
    this.shade = new Map()
    this.tile = new Map()
    this.net = []
    this.ink = new Map()
    this.stage = 0
    this.seq = 0
    this.netSeq = 0
  }

  getContext() {
    const c = this
    let style = '#000'
    const alpha = a => Math.round(Math.min(1, a) * 10) / 10
    const colour = () => {
      const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(style)
      const q = v => Math.min(255, Math.round(v / STEP) * STEP)

      return m ? '#' + hex2(q(+m[1])) + hex2(q(+m[2])) + hex2(q(+m[3])) : '#000000'
    }

    return {
      globalAlpha: 1, strokeStyle: '#000', lineWidth: 1, lineCap: 'round', font: '', textAlign: 'center', textBaseline: 'middle',
      get fillStyle() { return style },
      set fillStyle(v) { style = String(v); c.seq++ },
      setTransform() {}, clearRect() {}, beginPath() {}, rect() {}, arc() {}, stroke() {}, fill() {},
      fillRect(x, y, w, h) {
        if (c.seq === 1 || c.stage >= 2) return
        const a = alpha(this.globalAlpha), key = keyOf(Math.round((x + w / 2 - CW / 2) / CW), Math.round((y + h / 2 - CH / 2) / CH))
        if (a <= 0) return
        if (c.seq === 2) c.shade.set(key, 'stroke-opacity:' + num(a))
        else c.tile.set(key, `stroke:${colour()}${a < 1 ? ';stroke-opacity:' + num(a) : ''}`)
      },
      fillText(s, x, y) {
        if (c.stage < 2) { c.stage = 2; c.netSeq = c.seq }
        else if (c.stage === 2 && c.seq !== c.netSeq) c.stage = 3
        if (!s) return
        const col = Math.floor(x / CW), row = Math.floor(y / CH)
        if (c.stage === 2) c.net.push([col, row, s, Math.round(Math.min(1, this.globalAlpha) * 20) / 20])
        else { const a = alpha(this.globalAlpha); if (a > 0) c.ink.set(keyOf(col, row), `${s}fill:${colour()}${a < 1 ? ';fill-opacity:' + num(a) : ''}`) }
      },
    }
  }
}

const makePond = (width, height, palette) => {
  const canvas = new Cells()
  const pond = globalThis.AsciiKoi.createPond({ canvas, palette: () => palette, dpr: () => 1 })
  pond.size(width, height)
  canvas.width = width
  canvas.height = height
  pond.reset()

  return { canvas, pond }
}

/*
 * Paints that many cells share get a short class name; the style sheet says
 * once what each means. The paints used most get the shortest names. A name
 * is a capital that no other class starts with, then digits or small
 * letters, so no two names are the same even where case is ignored.
 */
const FIRST = 'CDEFGHIJKLOPRSTUXYZ'
/*
 * The desktop app plays a mod's animation only if the whole document passes
 * its check; otherwise it strips every animation and shows the still picture.
 * One rule of that check refuses viewport units, and it reads any dot or digit
 * followed by vw, vh, vi, vb, vmin, vmax (or cqw and the like) as one: a class
 * named `.Vb` was enough to stop every koi. So no name starts with V or Q, and
 * each name is tried against the app's own pattern.
 */
const UNIT = /(?:\d|\.)(?:[dsl]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))(?![a-z0-9_-])/i
function makePaints() {
  const ids = new Map(), uses = []

  return {
    /* a stand-in for the name, until every use is counted */
    name(paint) {
      let id = ids.get(paint)
      if (id === undefined) { ids.set(paint, id = uses.length); uses.push(0) }
      uses[id]++

      return `\u0001${id}\u0002`
    },
    /* the document with every stand-in named, and the style sheet's rule for each name where it says `\u0003` */
    finish(svg) {
      const names = []
      uses.map((n, id) => [n, id]).sort((a, b) => b[0] - a[0]).forEach(([, id], rank) => {
        const r = rank - FIRST.length
        names[id] = r < 0 ? FIRST[rank] : FIRST[r % FIRST.length] + Math.floor(r / FIRST.length).toString(36)
        if (UNIT.test(`.${names[id]}{`) || UNIT.test(`0${names[id]} `)) names[id] = 'P_' + id
      })
      const css = [...ids].map(([paint, id]) => `.${names[id]}{${paint}}`).join('')

      return svg.replace('\u0003', css).replace(/\u0001(\d+)\u0002/g, (_, id) => names[id])
    },
  }
}

/*
 * Cells as strokes, in pixels from the head's cell: a run of one paint down a
 * column is one stroke through the column's middle, dashed into tiles by the
 * koi layer. Down a column, because a slice is mostly one column wide. `kind`
 * is a shadow's paint: a solid band a whole cell wide and high.
 */
function runs(cells, paints, kind = '') {
  const by = new Map()
  const down = ([a], [b]) => { const [ca, ra] = cellOf(a), [cb, rb] = cellOf(b); return ca - cb || ra - rb }
  for (const [key, v] of [...cells].sort(down)) {
    let g = by.get(v)
    if (!g) by.set(v, g = [])
    const [col, row] = cellOf(key), last = g[g.length - 1]
    if (last && last[0] === col && last[1] + last[2] === row) last[2]++
    else g.push([col, row, 1])
  }
  let out = ''
  /* a tile leaves a pixel to the next one, a shadow none */
  const top = kind ? -CH / 2 : 0.5 - CH / 2, gap = kind ? 0 : 1
  for (const [v, g] of by) {
    /* each run starts from where the last one ended, if that is shorter to say */
    let d = '', x = 0, y = 0
    for (const [c, r, n] of g) {
      const to = [c * CW + CW / 2, r * CH + top], step = `m${num(to[0] - x)} ${num(to[1] - y)}`, jump = `M${num(to[0])} ${num(to[1])}`
      d += (d && step.length < jump.length ? step : jump) + `v${n * CH - gap}`
      x = to[0]; y = to[1] + n * CH - gap
    }
    out += `<path class="${paints.name(kind + v)}" d="${d}"/>`
  }

  return out
}
/*
 * The glyphs pond.js presses into a koi, drawn as strokes: for each, where
 * its stroke starts from the cell's middle, the stroke, and where it ends.
 * They follow ASCII Koi's font (a 600 weight monospace at 74 % of a cell's
 * height) closely enough at this size. Text would be truer, but the app
 * draws the whole scene again every frame and stops a scene for good when a
 * frame costs too much; some 1600 glyphs of text cost it as much as
 * everything else together.
 */
const GLYPHS = {
  '-': [-2.5, 0, 'h5', 2.5, 0],
  '=': [-2.5, -1.5, 'h5m-5 3h5', 2.5, 1.5],
  '|': [0, -5, 'v10', 0, 5],
  '/': [-2.5, 4.5, 'l5-9', 2.5, -4.5],
  '\\': [-2.5, -4.5, 'l5 9', 2.5, 4.5],
  '.': [-0.8, 3, 'h1.6', 0.8, 3],
  ':': [-0.8, -2, 'h1.6m-1.6 5h1.6', 0.8, 3],
  '+': [-2.5, 0, 'h5m-2.5-2.5v5', 0, 2.5],
  '*': [0, -4, 'v5m-2.2-3.75 4.4 2.5m0-2.5-4.4 2.5', -2.2, -0.25],
  'o': [-2.2, 0.5, 'a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0', -2.2, 0.5],
  '#': [-1.2, -3.5, 'v7m2.4-7v7m-4.2-5h6m-6 3h6', 3, 1.5],
}
/* a glyph's stroke as thick as the font's */
const GLYPH_STROKE = 1.2
/*
 * Glyphs, in pixels from the head's cell: one stroke path per paint, glyph
 * after glyph row by row, each starting from where the last one ended. A
 * glyph with no strokes above stays text (the style sheet moves every text
 * to its cell's middle).
 */
function glyphs(cells, paints) {
  const by = new Map(), text = new Map()
  for (const [key, v] of [...cells].sort((a, b) => a[0] - b[0])) {
    const [col, row] = cellOf(key), paint = v.slice(1)
    if (GLYPHS[v[0]]) {
      let g = by.get(paint)
      if (!g) by.set(paint, g = [])
      g.push([col * CW + CW / 2, row * CH, GLYPHS[v[0]]])
      continue
    }
    let g = text.get(paint)
    if (!g) text.set(paint, g = { x: [], y: [], t: '' })
    g.x.push(col * CW); g.y.push(row * CH); g.t += v[0]
  }
  let out = ''
  for (const [paint, marks] of by) {
    let d = '', x = 0, y = 0
    for (const [cx, cy, [sx, sy, draw, ex, ey]] of marks) {
      const to = [cx + sx, cy + sy], step = `m${num(to[0] - x)} ${num(to[1] - y)}`, jump = `M${num(to[0])} ${num(to[1])}`
      d += (d && step.length < jump.length ? step : jump) + draw
      x = cx + ex; y = cy + ey
    }
    /* the glyph's fill becomes the stroke's paint, one stroke wide, not dashed into tiles */
    const stroke = paint.replace(/fill/g, 'stroke') + `;stroke-width:${GLYPH_STROKE};stroke-dasharray:none`
    out += `<path class="${paints.name(stroke)}" d="${d}"/>`
  }
  /* the first glyph's row, then how far each glyph is below the one before: mostly nothing, so short to say */
  const below = y => y.slice(1).map((v, i) => v - y[i]).join(' ').replace(/( 0)+$/, '')
  for (const [paint, g] of text) {
    const dy = g.y.length > 1 ? below(g.y) : ''
    out += `<text class="${paints.name(paint)}" x="${g.x.join(' ')}" y="${g.y[0]}"${dy && dy !== '0' ? ` dy="0 ${dy}"` : ''}>${esc(g.t)}</text>`
  }

  return out
}

/*
 * How far a slice sways, in half pixels, `s` of the way from head to tail:
 * pond.js's own reach (rasterize: 0.05 + 0.95 s^2.2), so the head and the
 * front of the body stay nearly still and the tail does the work; a body
 * that sways all along ripples like a ribbon. Whole pixels only: half as
 * many keyframes, room for more of the water's net.
 */
const height = (s, gait) => 2 * Math.round(gait.tail * (0.05 + 0.95 * Math.min(1, s) ** 2.2))
/* the most two sines of heights a and b, d radians apart, ever differ */
const apart = (a, b, d) => Math.sqrt(Math.max(0, a * a + b * b - 2 * a * b * Math.cos(d)))

/*
 * One koi of the pond as a train of slices, straight along `angle`. Cells are
 * counted from the head's cell; slice 0 holds the head. Each slice holds its
 * own shadow under its own cells, so a koi is one train and not two. Every
 * slice, the tail fan's too, follows two motions: the body wave, which runs
 * from head to tail as in pond.js, and the bend of the path, which reaches a
 * slice as late as the koi takes to swim there.
 */
function sprite({ canvas, pond }, index, angle, gait, paints, shade, curve = 0) {
  const f = pond.fish[index]
  let HC = 0, HR = 0
  for (const o of pond.fish) o.seen = o === f ? 1 : 0
  /* a little off the cell's centre: a sample that lands exactly on the snout has no width to divide by */
  const place = (dc, dr) => {
    HC = Math.round(canvas.width / 2 / CW) + dc; HR = Math.round(canvas.height / 2 / CH) + dr
    f.nx = (HC * CW + CW * 0.3) / canvas.width
    f.ny = (HR * CH + CH * 0.4) / canvas.height
  }
  place(0, 0)
  f.turn = 0; f.rise = 0
  const ux = Math.cos(angle), uy = Math.sin(angle), ahead = ux > 0 ? 1 : -1
  /*
   * The spine runs back from the head along `angle`, turning by `curve` at
   * every joint, so the body lies in a gentle C as ASCII Koi's koi do when
   * they turn (pond.js lets a joint turn up to 0.42). A koi laid straight
   * reads as a flat slab: its edges run along whole rows of cells.
   */
  for (let j = 0, x = 0, y = 0; j < N; j++) {
    f.nodes[j * 2] = x; f.nodes[j * 2 + 1] = y
    const a = angle + curve * (j + 0.5)
    x -= Math.cos(a) * f.seg; y -= Math.sin(a) * f.seg
  }
  /* pond.js swings the body by 0.25 + 0.9 * beat: at this beat it paints no wave on the spine */
  const shot = (beat, phase) => {
    f.beat = beat; f.phase = phase
    canvas.begin()
    pond.render()
    const local = map => new Map([...map].map(([key, v]) => { const [col, row] = cellOf(key); return [keyOf(col - HC, row - HR), v] }))

    return { shade: local(canvas.shade), tile: local(canvas.tile), ink: local(canvas.ink) }
  }
  /*
   * The same straight koi under each piece of the light. A glint is pond.js's
   * star on a brighter tile. The koi itself keeps, cell by cell, a painting
   * with no glint; each place's glints become a set that lies over it.
   */
  const lit = LIGHTS.map(([dc, dr]) => { place(dc, dr); return shot(-0.25 / 0.9, 0) })
  const isGlint = v => v !== undefined && v[0] === '*'
  const straight = { shade: lit[0].shade, tile: new Map(lit[0].tile), ink: new Map(lit[0].ink) }
  const glints = lit.map(() => ({ tile: new Map(), ink: new Map() }))
  for (const key of lit[0].ink.keys()) {
    const calm = lit.find(l => l.ink.has(key) && !isGlint(l.ink.get(key)))
    if (!calm) continue
    straight.ink.set(key, calm.ink.get(key))
    if (calm.tile.has(key)) straight.tile.set(key, calm.tile.get(key))
    lit.forEach((l, n) => {
      if (!isGlint(l.ink.get(key))) return
      glints[n].ink.set(key, l.ink.get(key))
      if (l.tile.has(key)) glints[n].tile.set(key, l.tile.get(key))
    })
  }
  const length = f.L0 * K, columns = c => Math.max(0, -c * ahead)
  /* how far along the koi a column is, 0 at the head and 1 at the tail's end */
  const along = k => (k * CW) / (length * Math.abs(ux))
  let last = 0
  for (const map of [straight.tile, straight.ink, straight.shade]) for (const key of map.keys()) last = Math.max(last, columns(cellOf(key)[0]))
  /*
   * At a column the body wave is `lag` of a wave later than at the head, and
   * the bend `late` seconds later. The widest slices whose middles stay
   * within GAP of the slice ahead under both; mostly that is one column.
   */
  const u = CW / gait.speed, bendA = (SLOPE * gait.speed * gait.bend) / (2 * Math.PI)
  const at = k => ({ rise: height(along(k), gait), lag: (WAVE * along(k)) / (2 * Math.PI), late: k * u })
  const off = (p, q) => apart(p.rise / 2, q.rise / 2, 2 * Math.PI * (q.lag - p.lag)) + 2 * bendA * Math.abs(Math.sin((Math.PI * (q.late - p.late)) / gait.bend))
  const cuts = []
  for (let from = 0, prev = at(0); from <= last;) {
    let w = 1
    while (from + w <= last && off(prev, at(from + w / 2)) <= GAP) w++
    cuts.push([from, from + w])
    prev = at(from + (w - 1) / 2)
    from += w
  }
  /* the shadow first, the skin over it: a shadow is a solid band a whole cell wide */
  const shadePaint = `stroke:${shade};stroke-width:${CW};stroke-dasharray:none;`
  const part = (map, from, to) => new Map([...map].filter(([key]) => { const k = columns(cellOf(key)[0]); return k >= from && k < to }))
  const draw = (s, from, to) => runs(part(s.shade, from, to), paints, shadePaint) + runs(part(s.tile, from, to), paints) + glyphs(part(s.ink, from, to), paints)
  const spark = (s, from, to) => runs(part(s.tile, from, to), paints) + glyphs(part(s.ink, from, to), paints)
  const slices = cuts.map(([from, to]) => ({ ...at(from + (to - from - 1) / 2), html: draw(straight, from, to), glints: glints.map(s => spark(s, from, to)) })).filter(s => s.html)

  /* how far the koi reaches back from its head's cell, tail fan and shadow included, in pixels along the level */
  return { index, angle, depth: f.depth, length, reach: (last + 2) * CW, slices }
}

/*
 * The water's own glyphs, as pond.js paints them at one moment: the caustic
 * net (`·`, `-` and `~` where two drifting noise fields meet) and the sparks.
 * Glyphs fainter than FAINT are left out; in ASCII Koi they are barely seen.
 */
const FAINT = 0.12
/* seconds of one slide of the net, one way */
const DRIFT = 23
/*
 * The net is painted for a view at most NET_VIEW pixels wide and stretched
 * to fill a wider one: its size in characters grows with the water's area,
 * and a wide view's whole net does not fit beside the koi. Stretched, its
 * cells are a little bigger than the koi's (a tenth at 1890).
 */
const NET_VIEW = 1700
function waterGlyphs(palette, W, H) {
  const { canvas, pond } = makePond(W, H, palette)
  /* sized again, the pond forgets the wakes its koi left while it warmed up */
  pond.size(W, H)
  for (const f of pond.fish) f.seen = 0
  canvas.begin()
  pond.render()

  return canvas.net.filter(([, , s, a]) => s && a >= FAINT)
}
/*
 * ASCII Koi's net drifts and folds as its two fields slide across each other.
 * One document cannot paint it anew, so here the net's glyphs fall into SWAYS
 * sets by how bright pond.js paints them (0.1, 0.15, 0.2 and 0.25), each set
 * growing brighter and dimmer on a clock of its own, and the whole net slides
 * slowly to and fro. The bright middles of the net's strands and their faint
 * edges swell at different times, so the strands seem to gather and part as
 * they do in ASCII Koi. A set is one stroke path, mostly a few short steps
 * along each row. `share` thins the net to fit the room.
 *
 * Its glyphs are drawn as strokes in the shape of pond.js's `·`, `-` and `~`,
 * not as text: the app draws the scene again every frame, and some 2700
 * glyphs of text cost it about 4 ms a frame, past its limit, where strokes
 * cost about 1 ms. The strokes are drawn in cells (the group scales a cell to
 * 10 by 13 pixels), so a step along a row is a short whole number. A dash
 * and a wave are centred in their cell as the glyph is, about as long and as
 * thin as a glyph of ASCII Koi's font; a dot sits 2 px left of the middle,
 * which keeps every step whole.
 */
const SWAYS = 4
/* a mark's path from its cell's left edge, and how far along the cell it ends */
const MARKS = {
  '·': ['h.15', 0.15],
  ':': ['h.15', 0.15],
  '-': ['h.5', 0.5],
  '~': ['q.12-.1.25 0t.25 0', 0.5],
}
function net(list, share) {
  const sets = Array.from({ length: SWAYS }, () => [])
  for (const [col, row, s, a] of list) {
    if (hash(col, row * 7 + 3) > share || !MARKS[s]) continue
    sets[Math.max(0, Math.min(SWAYS - 1, Math.round(a / 0.05) - 2))].push([col, row, MARKS[s]])
  }
  /* pond.js paints the water row by row, so each mark starts from where the last one ended, if that is shorter to say */
  const path = marks => {
    let d = '', x = 0, y = 0
    for (const [col, row, [draw, wide]] of marks) {
      const step = `m${num(col - x)} ${row - y}`, jump = `M${col} ${row}`
      d += (d && step.length < jump.length ? step : jump) + draw
      x = col + wide; y = row
    }

    return d
  }

  return sets.map((marks, n) => (marks.length ? `<path class="n${n}" opacity="${num(0.1 + 0.05 * n)}" d="${path(marks)}"/>` : '')).join('')
}

/* ASCII Koi's shadow on light water: the water's own colour at 55 % */
function shadeOf(water) {
  const n = parseInt(water.slice(1), 16)

  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => hex2(Math.round(v * 0.55))).join('')
}

/*
 * The body wave a slice follows over one cycle of power and glide: BEATS
 * waves, a stop at each end of each half wave, eased as a sine between them,
 * so no slice jumps by itself. The waves are highest at the start and end of
 * the cycle (the power stroke) and lowest in its middle (the glide). The
 * cycle reads the same backwards, so stops k and 2*BEATS-k share one rule and
 * playing it to and fro changes nothing. One keyframe for each height (in half
 * pixels) that some slice uses. It moves the slice by `transform`; the bend of
 * the path moves the same slice by the separate `translate` property, which
 * adds to it, so one element carries both.
 */
const weave = rise => {
  let stops = ''
  for (let k = 0, n = 2 * BEATS; k <= BEATS; k++) {
    const a = LOW + (1 - LOW) * (0.5 + 0.5 * Math.cos((2 * Math.PI * k) / n))
    const at = k === 0 ? 'from,to' : k === BEATS ? '50%' : `${num((100 * k) / n)}%,${num((100 * (n - k)) / n)}%`
    stops += `${at}{transform:translateY(${num(((k % 2 ? 1 : -1) * a * rise) / 2)}px)}`
  }

  return `@keyframes y${rise.toString(36)}{${stops}}`
}

/*
 * The whole backdrop for one water. `width` is how many of ASCII Koi's
 * pixels the view is wide: a wider view shows more water and makes the koi
 * smaller.
 */
export function bakeScene(look, { width = 1890, koi = 12 } = {}) {
  const palette = WATERS[look] ?? WATERS.blue
  const W = Math.round(width / CW) * CW, H = Math.round((W * 0.625) / CH) * CH
  const dot = palette.dark ? palette.koiLight : palette.ink
  /* a dark water's shadow is black, a light one's the water darker */
  const shade = palette.dark ? '#000' : shadeOf(palette.water)
  const grow = Math.max(1, W / NET_VIEW)
  const glyphsOfWater = waterGlyphs(palette, Math.round(W / grow / CW) * CW, Math.round(H / grow / CH) * CH)
  const build = (count, share) => {
    const paints = makePaints(), bed = makePond(1600, 1001, palette)
    const sprites = []
    for (let i = 0; i < Math.min(count, UNIQUE); i++) {
      /* even koi swim to the right and odd ones to the left, as in the pond, each a little up or down */
      const tilt = TILTS[i % TILTS.length]
      sprites.push(sprite(bed, i, i % 2 === 0 ? tilt : Math.PI + tilt, GAITS[i % GAITS.length], paints, shade, CURVES[i % CURVES.length]))
    }
    /*
     * Koi past UNIQUE are mirror images of the first ones, one of each colour
     * scheme in turn: a <use> of that koi turned left for right, on a lane of
     * its own, so it swims the other way. Its wave and bend keep its first's
     * timing (they are the same slices), its lane and surge are its own.
     */
    const all = []
    for (let i = 0; i < count; i++) {
      const s = sprites[i < UNIQUE ? i : (i - UNIQUE) % sprites.length]
      all.push({ s, index: i, angle: i < UNIQUE ? s.angle : Math.PI - s.angle, twin: i >= UNIQUE })
    }
    const twinned = new Set(all.filter(k => k.twin).map(k => k.s.index))
    all.sort((a, b) => a.s.depth - b.s.depth || a.index - b.index)
    const at = (x, y) => `translate(${num(x)}px,${num(y)}px)`
    /* the style sheet says each slice's height and speeds by a plain class; the slice says its own delays, as Anthropic's koi do */
    const rises = new Set(), weaves = new Set()
    let fish = '', lanes = ''
    for (const { s, index: i, angle, twin } of all) {
      const o = s.index, g = o % GAITS.length, gait = GAITS[g], ux = Math.cos(angle), uy = Math.sin(angle)
      /* a lane through a point spread over the water; the koi enters and leaves out of sight */
      const px = (0.15 + 0.7 * hash(i, 23)) * W, py = (0.1 + 0.8 * ((i * 0.618 + 0.21) % 1)) * H
      /*
       * It starts with its head 80 px out of sight, its body further out
       * still, and ends only when its tail too is 80 px out of sight, plus
       * the most its surge carries it back; then it starts again, so no koi
       * vanishes in view.
       */
      const back = (ux > 0 ? px : W - px) / Math.abs(ux) + 80
      const on = (ux > 0 ? W - px : px) / Math.abs(ux) + s.reach / Math.abs(ux) + 80 + (SURGE * gait.speed * BEATS * gait.beat) / (Math.abs(ux) * 2 * Math.PI)
      /* the gait's speed is along the level, where the slices count their columns */
      const cross = ((back + on) * Math.abs(ux)) / gait.speed
      /*
       * A slice bends as the head did when the head was where the slice is
       * now: later by the time the koi takes to swim its columns. Its body
       * wave is later by its share of the wave's way down the body. Each koi
       * starts at its own point of both, and of its cycle of power and glide.
       */
      const cycle = BEATS * gait.beat
      const start = hash(o, 11) * gait.bend, first = hash(o, 13) * cycle, flash = hash(o, 17) * GLINT
      const delay = (t, period) => num((((t % period) + period) % period) - period)
      /*
       * With no motion a koi rests on its lane, in view. Along its lane the
       * koi runs ahead and falls back by `surge`, so it swims fastest at the power
       * stroke and slowest in the glide: the surge is -cos of its own clock,
       * a quarter cycle ahead of the head's wave.
       */
      const surge = (SURGE * gait.speed * cycle) / (Math.abs(ux) * 2 * Math.PI)
      lanes += `.m${i}{transform:${at(px, py)};animation:m${i} ${num(cross)}s linear ${num(-hash(i, 7) * cross)}s infinite,s${i} ${num(cycle)}s ${SINE} ${delay(first + (s.slices[0]?.lag ?? 0) * gait.beat - cycle / 4, cycle)}s infinite}`
        + `@keyframes m${i}{from{transform:${at(px - ux * back, py - uy * back)}}to{transform:${at(px + ux * on, py + uy * on)}}}`
        + `@keyframes s${i}{from,to{translate:${num(-ux * surge)}px ${num(-uy * surge)}px}50%{translate:${num(ux * surge)}px ${num(uy * surge)}px}}`
      if (twin) { fish += `<g class="m${i}"><use href="#k${o}" transform="scale(-1 1)"/></g>`; continue }
      let train = ''
      for (const slice of s.slices) {
        const name = `w${g}${slice.rise.toString(36)}`
        rises.add(slice.rise)
        weaves.add(`.${name}{animation:y${slice.rise.toString(36)} ${num(cycle)}s,p${g} ${num(gait.bend / 2)}s}`)
        /* each set of glints flashes in its turn, and later the further back the slice is: the net passes from head to tail at the koi's own speed */
        const sparks = slice.glints.map((html, n) => (html ? `<g class="i" style="animation-delay:${delay(flash + (n * GLINT) / LIGHTS.length + GLINT * 64 - slice.late, GLINT)}s">${html}</g>` : '')).join('')
        train += `<g class="${name}" style="animation-delay:${delay(first + slice.lag * gait.beat, cycle)}s,${delay(start + slice.late, gait.bend)}s">${slice.html}${sparks}</g>`
      }
      fish += twinned.has(o) ? `<g class="m${i}"><g id="k${o}">${train}</g></g>` : `<g class="m${i}">${train}</g>`
    }
    const size = Math.round(CH * 0.74)
    /* a glyph sits on its cell's middle: half a cell along, and its baseline a third of the letter's height below */
    const css = `text{font:600 ${size}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-anchor:middle;transform:translate(${CW / 2}px,${num(size * 0.34)}px)}`
      + lanes + [...rises].map(weave).join('') + [...weaves].join('')
      /* every slice has a style attribute: each of its two motions eases as a sine, to and fro */
      + `[style]{animation-timing-function:${SINE};animation-iteration-count:infinite;animation-direction:alternate}`
      /* a set of glints is dark, flashes for about a third of a second and is dark again; with no motion it stays dark. After the rule above, so this one's own pace holds. */
      + `.i{opacity:0;animation:i ${GLINT}s linear infinite}@keyframes i{0%,74%{opacity:0}80%,88%{opacity:1}94%,to{opacity:0}}`
      /* the bend of each gait's path, as high as SLOPE lets it be */
      + GAITS.map((gait, g) => { const a = (SLOPE * gait.speed * gait.bend) / (2 * Math.PI); return `@keyframes p${g}{from{translate:0 ${num(-a)}px}to{translate:0 ${num(a)}px}}` }).join('')
      /* the net slides a cell or two to and fro over most of a minute; each of its sets brightens and dims on its own clock */
      + (share > 0 ? `.n{animation:n ${DRIFT}s ${SINE} infinite alternate}@keyframes n{from{translate:-14px -9px}to{translate:14px 9px}}@keyframes o{from{opacity:.25}to{opacity:1}}`
        + Array.from({ length: SWAYS }, (_, n) => `.n${n}{animation:o ${num(4.6 + 1.7 * n)}s ${SINE} ${num(-2.3 * n)}s infinite alternate}`).join('') : '')
      + `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`
    const water = share > 0 ? `<g class="n" fill="none" stroke="${dot}" stroke-width="${num(1.1 / CH / grow)}" transform="translate(${num(2.5 * grow)} ${num((CH / 2) * grow)}) scale(${num(CW * grow)} ${num(CH * grow)})">${net(glyphsOfWater, share)}</g>` : ''

    /* width and height of 100 %: without them the app's frame gives the drawing no room */
    return {
      svg: paints.finish(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" font-family="monospace"><style>${css}\u0003</style>`
        + `<rect width="${W}" height="${H}" fill="${palette.water}"/>${water}`
        /* a tile is a dash of its column's stroke, a pixel short of the next; a shadow's paint undoes the dashes */
        + `<g fill="none" stroke-width="${CW - 1}" stroke-dasharray="${CH - 1} 1">${fish}</g></svg>`),
    }
  }
  /*
   * All the koi with the water's net, thinned until the picture fits; only if
   * even a thin net leaves no room, fewer koi on bare water.
   */
  let svg = ''
  for (const share of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
    svg = build(Math.max(1, koi), share).svg
    if (svg.length <= ROOM) break
  }
  for (let n = Math.max(1, koi); svg.length > ROOM && n >= 1; n--) svg = build(n, 0).svg

  return { svg, alt: `ASCII Koi: koi drawn in text characters swimming in ${look} water` }
}
