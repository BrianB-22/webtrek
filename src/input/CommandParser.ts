import { Game } from '../game/Game'
import { GamePhase } from '../game/types'
import { GALAXY_SIZE, SECTOR_SIZE } from '../game/Galaxy'

// Commands (case-insensitive, can abbreviate to first letter):
//
//   move <qrow> <qcol> <srow> <scol>  - warp to quadrant+sector
//   move <srow> <scol>                - impulse within quadrant
//   m<qrow><qcol><srow><scol>         - compact form (e.g. m6235)
//   phasers <e1> [e2] [e3]            - fire at enemies in order
//   p <e1> [e2] [e3]                  - abbreviation
//   torpedo <srow> <scol> [...]       - fire at sector(s)
//   t <srow> <scol>                   - abbreviation
//   shup                              - shields up (max)
//   shdn                              - shields down
//   max                               - max shields
//   energy [shields-amount]           - show/transfer energy
//   warp <speed>                      - set warp factor
//   repair                            - show repair status
//   info                              - enemy ship info
//   srs                               - short range scan
//   lrs                               - long range scan
//   dock                              - dock at adjacent base
//   undock / u                        - undock
//   help / ?                          - command list

export function parseCommand(input: string, game: Game): string {
  const raw = input.trim()
  const lower = raw.toLowerCase()
  const parts = lower.split(/\s+/)
  const cmd = parts[0]

  const phase = game.state.phase
  if (phase === GamePhase.GameOver) return 'Game over. Press N for new game.'
  if (phase === GamePhase.Victory)  return 'Victory! Press N for new game.'

  // Compact move: m6235 → move to quad 6,2 sec 3,5 (1-indexed)
  if (/^m\d{4}$/.test(cmd)) {
    const [qr, qc, sr, sc] = cmd.slice(1).split('').map(Number)
    return moveCmd(game, qr, qc, sr, sc)
  }
  if (/^m\d{2}$/.test(cmd)) {
    const [sr, sc] = cmd.slice(1).split('').map(Number)
    return moveCmd(game, game.state.position.quad.y + 1, game.state.position.quad.x + 1, sr, sc)
  }

  switch (cmd) {
    // ── Movement ──────────────────────────────────────────────────────────
    case 'move':
    case 'm': {
      const nums = parts.slice(1).map(Number)
      if (nums.length === 4) return moveCmd(game, nums[0], nums[1], nums[2], nums[3])
      if (nums.length === 2) return moveCmd(game,
        game.state.position.quad.y + 1,
        game.state.position.quad.x + 1,
        nums[0], nums[1])
      return 'Usage: move <qrow> <qcol> <srow> <scol>  or  move <srow> <scol>'
    }

    // ── Phasers ───────────────────────────────────────────────────────────
    case 'phasers':
    case 'p': {
      const energies = parts.slice(1).map(Number).filter(n => !isNaN(n) && n > 0)
      if (energies.length === 0) return 'Usage: phasers <energy> [energy2] [energy3]'
      return game.cmdPhasers(energies)
    }

    // ── Torpedoes ─────────────────────────────────────────────────────────
    case 'torpedo':
    case 'torp':
    case 't': {
      const nums = parts.slice(1).map(Number)
      if (nums.length < 2 || nums.length % 2 !== 0) return 'Usage: torpedo <row> <col> [row col ...]'
      const targets = []
      for (let i = 0; i < nums.length; i += 2) {
        const r = nums[i], c = nums[i + 1]
        if (r < 1 || r > SECTOR_SIZE || c < 1 || c > SECTOR_SIZE) return `Sector ${r},${c} out of range.`
        targets.push({ x: c - 1, y: r - 1 })
      }
      return game.cmdTorpedo(targets)
    }

    // ── Shields ───────────────────────────────────────────────────────────
    case 'shup':  return game.cmdShieldsUp()
    case 'shdn':  return game.cmdShieldsDown()
    case 'max':   return game.cmdMaxShields()

    // ── Energy ────────────────────────────────────────────────────────────
    case 'energy':
    case 'e': {
      if (parts.length > 1) {
        const amount = parseInt(parts[1])
        if (isNaN(amount)) return 'Usage: energy <shield-amount>'
        return game.cmdTransferEnergy(amount)
      }
      return game.cmdEnergy()
    }

    // ── Warp ──────────────────────────────────────────────────────────────
    case 'warp':
    case 'w': {
      const speed = parseFloat(parts[1])
      if (isNaN(speed)) return 'Usage: warp <speed>'
      return game.cmdSetWarp(speed)
    }

    // ── Scanners ──────────────────────────────────────────────────────────
    case 'srs': return game.cmdShortRangeScan()
    case 'lrs': return game.cmdLongRangeScan()

    // ── Base ops ──────────────────────────────────────────────────────────
    case 'dock': case 'd': return game.cmdDock()
    case 'undock': case 'u': return game.cmdUndock()

    // ── Info ──────────────────────────────────────────────────────────────
    case 'repair': case 'r': return game.cmdRepairStatus()
    case 'info':   case 'i': return game.cmdInfo()

    // ── Fix (repair systems) ──────────────────────────────────────────────
    case 'fix':
    case 'f': {
      const sysNum = parts[1] ? parseInt(parts[1]) : undefined
      const stardates = parts[2] ? parseFloat(parts[2]) : undefined
      if (parts[1] && isNaN(sysNum!)) return 'Usage: fix  or  fix <system#>  or  fix <system#> <stardates>'
      return game.cmdFix(sysNum, stardates)
    }

    // ── Orbit / Land / Use ────────────────────────────────────────────────
    case 'orbit':
    case 'o':     return game.cmdOrbit()
    case 'land':  return game.cmdLand()
    case 'use':   return 'No items available to use.'

    // ── Hail ──────────────────────────────────────────────────────────────
    case 'hail':  return game.cmdHail()

    // ── Self-Destruct ─────────────────────────────────────────────────────
    case 'self':
      return game.cmdSelf(false)

    // ── Self-Destruct confirmation ────────────────────────────────────────
    case 'y':
      if (game.state.pendingSelfDestruct) return game.cmdSelf(true)
      return `Unknown command: y. Type help for list.`

    // ── Death Ray ─────────────────────────────────────────────────────────
    case 'ray': return game.cmdDeathRay()

    // ── Message log ───────────────────────────────────────────────────────
    case 'msgs': return game.cmdMsgs()

    // ── Ack message ───────────────────────────────────────────────────────
    case 'ack':
    case 'a':
      return 'Message acknowledged.'

    // ── Quit ──────────────────────────────────────────────────────────────
    case 'quit':
    case 'q':     return game.cmdQuit()

    // ── Help ──────────────────────────────────────────────────────────────
    case 'help':
    case 'h':
    case '?':
      return [
        'NAVIGATION',
        '  move <qrow> <qcol> <srow> <scol>  warp to quadrant+sector',
        '  move <srow> <scol>                impulse within quadrant',
        '  m6235                             compact form',
        '  orbit / o                         enter orbit around nearby planet',
        '  land                              beam party to planet surface',
        '  undock / u                        leave base or orbit',
        'WEAPONS',
        '  phasers <e1> [e2] [e3]           fire phasers at enemies',
        '  torpedo <row> <col> [row col...]  fire torpedo at sector',
        '  ray                              fire Death Ray (800 energy, high risk)',
        'DEFENSE',
        '  shup / shdn / max                shields up/down/max',
        '  energy [amount]                  show or transfer energy to shields',
        '  warp <speed>                     set warp factor',
        'SHIP SYSTEMS',
        '  fix                              list systems for repair',
        '  fix <n> [stardates]              repair system n',
        '  repair                           show repair status',
        'INFORMATION',
        '  srs / lrs                        short/long range scan',
        '  info                             enemy ship info',
        '  msgs                             replay message log',
        'BASE OPS',
        '  dock / d                         dock at adjacent base',
        '  hail                             hail base in quadrant',
        'OTHER',
        '  self                             self-destruct (Y to confirm)',
        '  quit / q                         return to title screen',
      ].join('\n')

    default:
      return `Unknown command: ${cmd}. Type help for list.`
  }
}

function moveCmd(game: Game, qrow: number, qcol: number, srow: number, scol: number): string {
  // Convert from 1-indexed (user-facing) to 0-indexed
  const qy = qrow - 1, qx = qcol - 1
  const sy = srow - 1, sx = scol - 1
  if (qx < 0 || qx >= GALAXY_SIZE || qy < 0 || qy >= GALAXY_SIZE) return 'Quadrant out of range (1-8).'
  if (sx < 0 || sx >= SECTOR_SIZE || sy < 0 || sy >= SECTOR_SIZE) return 'Sector out of range (1-8).'
  return game.cmdMove(qx, qy, sx, sy)
}
