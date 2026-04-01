import { Game } from './game/Game'
import { GamePhase } from './game/types'
import { Renderer } from './render/Renderer'
import { parseCommand } from './input/CommandParser'
import { defaultIntroState, IntroState, RANKS } from './render/TitleScreen'
import { SECTOR_SIZE, GALAXY_SIZE } from './game/Galaxy'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const game = new Game()
const renderer = new Renderer(canvas)

let commandBuffer = ''
let intro: IntroState = defaultIntroState()

game.state.phase = GamePhase.Title

// ── Game loop ─────────────────────────────────────────────────────────────

function loop(): void {
  renderer.render(game.state, commandBuffer, intro, performance.now())
  requestAnimationFrame(loop)
}

// Wait for VT323 to load before first frame so text isn't drawn with fallback font
document.fonts.ready.then(() => requestAnimationFrame(loop))

// ── Keyboard input ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e: KeyboardEvent) => {
  const phase = game.state.phase

  if (phase === GamePhase.Title) {
    game.state.phase = GamePhase.Setup
    return
  }

  if (phase === GamePhase.Setup) {
    handleSetupKey(e)
    return
  }

  if (phase === GamePhase.Briefing) {
    handleBriefingKey(e)
    return
  }

  if (phase === GamePhase.GameOver || phase === GamePhase.Victory) {
    if (e.key.toLowerCase() === 'n') restartGame()
    return
  }

  if (phase === GamePhase.Playing || phase === GamePhase.Docked) {
    handleGameKey(e)
  }
})

function handleSetupKey(e: KeyboardEvent): void {
  const { step } = intro

  if (e.key === 'Enter') {
    const buf = intro.buffer.trim()

    if (step === 'restore') {
      // Y → would load saved game (no-op for now), N → continue
      intro.buffer = ''
      intro.step = 'name'

    } else if (step === 'name') {
      if (!buf) return
      intro.commanderName = buf
      intro.buffer = ''
      intro.step = 'level'

    } else if (step === 'level') {
      const lvl = parseInt(buf)
      if (isNaN(lvl) || lvl < 1 || lvl > 5) { intro.buffer = ''; return }
      intro.level = lvl
      intro.buffer = ''
      intro.step = 'password'

    } else if (step === 'password') {
      if (!buf) return
      intro.selfDestructPassword = buf
      intro.buffer = ''
      intro.step = 'briefingQ'

    } else if (step === 'briefingQ') {
      const ans = buf.toLowerCase()
      if (ans === 'y') {
        intro.buffer = ''
        intro.briefingPage = 0
        intro.step = 'briefing'
        game.state.phase = GamePhase.Briefing
      } else if (ans === 'n') {
        startGame()
      }
    }

  } else if (e.key === 'Backspace') {
    intro.buffer = intro.buffer.slice(0, -1)
  } else if (e.key.length === 1 && intro.buffer.length < 40) {
    // Restore game: only accept Y/N
    if (step === 'restore' && !/[yn]/i.test(e.key)) return
    intro.buffer += e.key
  }
}

function handleBriefingKey(e: KeyboardEvent): void {
  const { briefingPage } = intro

  if (e.key === 'q' || e.key === 'Q') {
    startGame()
  } else if (e.key === 'Enter') {
    if (briefingPage >= 2) {  // last page
      startGame()
    } else {
      intro.briefingPage++
    }
  }
}

function startGame(): void {
  const newState = game.newGame(intro.level || 3)
  Object.assign(game.state, newState)
  const rank = RANKS[intro.level] ?? 'Commander'
  game.addLog(`Welcome aboard, ${rank} ${intro.commanderName}.`)
  commandBuffer = ''
}

function restartGame(): void {
  intro = defaultIntroState()
  game.state.phase = GamePhase.Title
  commandBuffer = ''
}

function maybeTriggerCombatAnim(raw: string): void {
  const parts = raw.trim().toLowerCase().split(/\s+/)
  const cmd = parts[0]
  const playerSect = { ...game.state.position.sect }
  const enemySects = game.state.quadrant.enemies.map(e => ({ ...e.sect }))

  if (cmd === 'p' || cmd === 'phasers') {
    renderer.queueLaserAnim(playerSect, enemySects)
    renderer.queueEnemyFireAnim(enemySects, playerSect)
  } else if (cmd === 't' || cmd === 'torpedo') {
    // torpedo <row> <col> — 1-indexed; internally x=col-1, y=row-1
    const tRow = parseInt(parts[1]) - 1
    const tCol = parseInt(parts[2]) - 1
    if (!isNaN(tRow) && !isNaN(tCol)) {
      renderer.queueTorpedoAnim(playerSect, { x: tCol, y: tRow })
      renderer.queueEnemyFireAnim(enemySects, playerSect)
    }
  }
}

function handleGameKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    if (commandBuffer.trim()) {
      maybeTriggerCombatAnim(commandBuffer)
      const result = parseCommand(commandBuffer, game)
      game.addLog(result)
    }
    commandBuffer = ''
  } else if (e.key === 'Backspace') {
    commandBuffer = commandBuffer.slice(0, -1)
  } else if (e.key.length === 1 && commandBuffer.length < 30) {
    commandBuffer += e.key
  }
}

// ── Mouse / click support ─────────────────────────────────────────────────

canvas.addEventListener('click', (e: MouseEvent) => {
  const phase = game.state.phase
  if (phase !== GamePhase.Playing && phase !== GamePhase.Docked) return

  const { x: mx, y: my } = renderer.toLogical(e.clientX, e.clientY)

  // Hit-test sector map
  const so = renderer.getSectorOrigin()
  const CELL = renderer.CELL
  const secCol = Math.floor((mx - so.x) / CELL)
  const secRow = Math.floor((my - so.y) / CELL)

  if (secCol >= 0 && secCol < SECTOR_SIZE && secRow >= 0 && secRow < SECTOR_SIZE) {
    const { sect } = game.state.position
    if (secCol === sect.x && secRow === sect.y) return  // clicked own ship
    const { quad } = game.state.position
    const cmd = `move ${quad.y + 1} ${quad.x + 1} ${secRow + 1} ${secCol + 1}`
    commandBuffer = cmd
    const result = parseCommand(cmd, game)
    game.addLog(result)
    commandBuffer = ''
    return
  }

  // Hit-test galaxy chart
  const go = renderer.getGalaxyOrigin()
  const GCELL_W = 44
  const GCELL_H = 20
  const gCol = Math.floor((mx - go.x) / GCELL_W)
  const gRow = Math.floor((my - go.y) / GCELL_H)

  if (gCol >= 0 && gCol < GALAXY_SIZE && gRow >= 0 && gRow < GALAXY_SIZE) {
    const { quad } = game.state.position
    if (gCol === quad.x && gRow === quad.y) return  // clicked current quadrant
    const cmd = `move ${gRow + 1} ${gCol + 1} 4 4`
    commandBuffer = cmd
    const result = parseCommand(cmd, game)
    game.addLog(result)
    commandBuffer = ''
    return
  }
})

// Right-click on sector = fire torpedo at that sector
canvas.addEventListener('contextmenu', (e: MouseEvent) => {
  e.preventDefault()
  const phase = game.state.phase
  if (phase !== GamePhase.Playing && phase !== GamePhase.Docked) return

  const { x: mx, y: my } = renderer.toLogical(e.clientX, e.clientY)

  const so = renderer.getSectorOrigin()
  const CELL = renderer.CELL
  const secCol = Math.floor((mx - so.x) / CELL)
  const secRow = Math.floor((my - so.y) / CELL)

  if (secCol >= 0 && secCol < SECTOR_SIZE && secRow >= 0 && secRow < SECTOR_SIZE) {
    const playerSect = { ...game.state.position.sect }
    const enemySects = game.state.quadrant.enemies.map(e => ({ ...e.sect }))
    const cmd = `torpedo ${secRow + 1} ${secCol + 1}`
    renderer.queueTorpedoAnim(playerSect, { x: secCol, y: secRow })
    renderer.queueEnemyFireAnim(enemySects, playerSect)
    commandBuffer = cmd
    const result = parseCommand(cmd, game)
    game.addLog(result)
    commandBuffer = ''
  }
})
