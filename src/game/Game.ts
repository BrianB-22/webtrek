import {
  GameState, GamePhase, PlayerShip, ShipSystem, SystemsStatus,
  CellType, QuadrantData, BaseType,
} from './types'
import { generateGalaxy, countTotalEnemies, GALAXY_SIZE, SECTOR_SIZE, isEnemyCell } from './Galaxy'

const STARDATE_START = 3500.0
const MAM_REGEN_PER_DAY = 400
const MAX_WARP = 8

function defaultSystems(): SystemsStatus {
  const s = {} as SystemsStatus
  for (const key of Object.values(ShipSystem)) s[key] = 100
  return s
}

function defaultShip(): PlayerShip {
  return {
    name: 'U.S.S. Enterprise',
    registry: 'NCC-1701',
    org: 'Starfleet Command',
    energy: 5000,
    maxEnergy: 5000,
    shields: 0,
    maxShields: 2500,
    warp: 5.0,
    phoTorps: 10,
    phaserEff: 100,
    phaserTemp: 0,
    systems: defaultSystems(),
    lifeSupportDays: 2,
  }
}

export class Game {
  state: GameState
  private _quadrants: QuadrantData[][] = []

  constructor(difficulty = 3) {
    this.state = this.newGame(difficulty)
  }

  newGame(difficulty = 3): GameState {
    const { galaxy, quadrants, startPos } = generateGalaxy(difficulty)
    this._quadrants = quadrants
    const quadrant = quadrants[startPos.quad.y][startPos.quad.x]

    return {
      date: STARDATE_START,
      player: defaultShip(),
      position: startPos,
      galaxy,
      quadrant,
      totalEnemies: countTotalEnemies(galaxy),
      alert: quadrant.enemies.length > 0,
      log: [{ date: STARDATE_START, text: 'Starfleet orders: eliminate all Klingon forces.' }],
      phase: GamePhase.Playing,
      difficulty,
    }
  }

  addLog(text: string): void {
    this.state.log.unshift({ date: this.state.date, text })
    if (this.state.log.length > 100) this.state.log.pop()
  }

  // Called once per stardate tick (advance time by dt days)
  private advanceTime(days: number): void {
    this.state.date += days
    const { player } = this.state

    // M/A-M energy regeneration
    const regen = MAM_REGEN_PER_DAY * (player.systems[ShipSystem.MAMConverter] / 100) * days
    player.energy = Math.min(player.maxEnergy, player.energy + regen)

    // Phaser temp cools down
    player.phaserTemp = Math.max(0, player.phaserTemp - 200 * days)

    // Life support check
    if (player.systems[ShipSystem.LifeSupport] < 100) {
      player.lifeSupportDays -= days
      if (player.lifeSupportDays <= 0) {
        this.state.phase = GamePhase.GameOver
        this.addLog('Life support failed. Crew dead.')
      }
    } else {
      player.lifeSupportDays = 2
    }

    // Update phaser efficiency (drops with heat)
    player.phaserEff = Math.min(
      player.systems[ShipSystem.Phasers],
      100 - Math.floor(player.phaserTemp / 15)
    )
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  // Move to absolute coordinates: quad (qx,qy) sector (sx,sy), all 0-indexed.
  // Pass qx/qy = current to use impulse only.
  cmdMove(qx: number, qy: number, sx: number, sy: number): string {
    const { position, player } = this.state
    const crossingQuadrant = qx !== position.quad.x || qy !== position.quad.y

    if (crossingQuadrant) {
      if (player.systems[ShipSystem.WarpEngines] < 10) return 'Warp engines offline.'
      const maxWarp = 1 + 0.09 * player.systems[ShipSystem.WarpEngines]
      if (player.warp > maxWarp) return `Warp limited to ${maxWarp.toFixed(1)} by engine damage.`
    } else {
      if (player.systems[ShipSystem.ImpulseEngines] < 50) return 'Impulse engines offline.'
    }

    // Energy cost
    const quadDist = crossingQuadrant
      ? Math.sqrt(Math.pow(qx - position.quad.x, 2) + Math.pow(qy - position.quad.y, 2))
      : 0
    const sectDist = Math.sqrt(Math.pow(sx - position.sect.x, 2) + Math.pow(sy - position.sect.y, 2))
    const shieldMult = player.shields > 0 ? 2 : 1
    const energyCost = crossingQuadrant
      ? Math.ceil((quadDist + sectDist / SECTOR_SIZE) * player.warp * player.warp * 10 * shieldMult)
      : Math.ceil(sectDist * 5 * shieldMult)

    if (player.energy < energyCost) return `Insufficient energy. Need ${energyCost}.`

    // Check target sector is not blocked
    const targetQ = this._quadrants[qy][qx]
    const targetCell = targetQ.cells[sy][sx]
    if (targetCell !== CellType.Empty) {
      const landing = this.findEmpty(targetQ, sx, sy)
      sx = landing.x; sy = landing.y
    }

    // Clear old position
    this.state.quadrant.cells[position.sect.y][position.sect.x] = CellType.Empty

    // Move quadrant if needed
    if (crossingQuadrant) {
      this.state.position.quad = { x: qx, y: qy }
      this.state.quadrant = targetQ
      this.state.galaxy[qy][qx].scanned = true
      // Auto long-range scan adjacent quadrants
      this.scanAdjacent(qx, qy)
    }

    const dest = this.findEmpty(this.state.quadrant, sx, sy)
    this.state.quadrant.cells[dest.y][dest.x] = CellType.Ship
    this.state.position.sect = dest

    player.energy -= energyCost
    const days = crossingQuadrant ? quadDist / player.warp : sectDist / 100
    this.advanceTime(days)
    this.state.alert = this.state.quadrant.enemies.length > 0

    const docked = this.state.phase === GamePhase.Docked
    this.state.phase = GamePhase.Playing
    const msg = `Arrived at quad ${qx + 1}-${qy + 1} sec ${dest.x + 1},${dest.y + 1}. Energy: ${Math.round(player.energy)}.`
    this.addLog(msg)
    if (!docked) this.enemyAttack()
    this.checkVictory()
    return msg
  }

  // ── Phasers ───────────────────────────────────────────────────────────────

  // energyPerTarget: array of energy amounts, one per enemy in quadrant (in order)
  cmdPhasers(energyPerTarget: number[]): string {
    const { player } = this.state
    if (player.systems[ShipSystem.Phasers] < 10) return 'Phasers offline.'
    if (player.phaserTemp > 1200) return 'Phasers overheated. Wait to cool.'

    const enemies = this.state.quadrant.enemies
    if (enemies.length === 0) return 'No enemy vessels in this quadrant.'

    const totalEnergy = energyPerTarget.reduce((a, b) => a + b, 0)
    if (totalEnergy > player.energy) return 'Insufficient energy.'

    player.energy -= totalEnergy
    const heatGenerated = totalEnergy * 0.4
    player.phaserTemp = Math.min(1500, player.phaserTemp + heatGenerated)

    const results: string[] = []
    const toDestroy: typeof enemies[number][] = []

    enemies.forEach((enemy, i) => {
      const allocated = energyPerTarget[i] ?? 0
      if (allocated <= 0) return
      const dist = this.distToEnemy(enemy.sect)
      const hit = Math.floor(allocated * (player.phaserEff / 100) * (1 / dist))
      enemy.energy -= hit
      results.push(`Enemy at ${enemy.sect.x + 1},${enemy.sect.y + 1}: ${hit} hit.`)
      if (enemy.energy <= 0) toDestroy.push(enemy)
    })

    for (const e of toDestroy) this.destroyEnemy(e.sect)

    const msg = results.join(' ')
    this.addLog(msg)
    this.advanceTime(0.01)
    this.enemyAttack()
    this.checkVictory()
    return msg || 'Phasers fired.'
  }

  // ── Torpedoes ─────────────────────────────────────────────────────────────

  cmdTorpedo(targets: Array<{ x: number; y: number }>): string {
    const { player } = this.state
    if (player.systems[ShipSystem.PhoTorpTubes] < 34) return 'All torpedo tubes offline.'

    const tubeRepair = player.systems[ShipSystem.PhoTorpTubes]
    const activeTubes = tubeRepair >= 100 ? 3 : tubeRepair >= 67 ? 2 : 1
    const canFire = Math.min(activeTubes, player.phoTorps, targets.length)
    if (canFire <= 0) return 'No photon torpedoes remaining.'

    const results: string[] = []
    for (let i = 0; i < canFire; i++) {
      const target = targets[i]
      player.phoTorps--
      const hit = this.traceTorpedo(target.x, target.y)
      results.push(hit)
    }

    const msg = results.join(' ')
    this.addLog(msg)
    this.advanceTime(0.01)
    this.enemyAttack()
    this.checkVictory()
    return msg
  }

  private traceTorpedo(targetX: number, targetY: number): string {
    const { position } = this.state
    const dx = targetX - position.sect.x
    const dy = targetY - position.sect.y
    const steps = Math.max(Math.abs(dx), Math.abs(dy))
    if (steps === 0) return 'Torpedo fired at own position!'

    const vx = dx / steps, vy = dy / steps
    let x = position.sect.x + 0.5, y = position.sect.y + 0.5

    for (let s = 0; s < steps + 1; s++) {
      x += vx; y += vy
      const cx = Math.floor(x), cy = Math.floor(y)
      if (cx < 0 || cx >= SECTOR_SIZE || cy < 0 || cy >= SECTOR_SIZE) break
      const cell = this.state.quadrant.cells[cy][cx]
      if (isEnemyCell(cell)) {
        const enemy = this.state.quadrant.enemies.find(e => e.sect.x === cx && e.sect.y === cy)
        if (enemy) {
          this.destroyEnemy(enemy.sect)
          return `Torpedo direct hit at ${cx + 1},${cy + 1}! Enemy destroyed.`
        }
      } else if (cell === CellType.Star || cell === CellType.StarBase || cell === CellType.ResearchStation || cell === CellType.SupplyDepot) {
        return `Torpedo impacted object at ${cx + 1},${cy + 1}.`
      }
    }
    return 'Torpedo missed.'
  }

  // ── Shields ───────────────────────────────────────────────────────────────

  cmdShieldsUp(): string {
    const { player } = this.state
    if (player.systems[ShipSystem.Shields] < 10) return 'Shield generator offline.'
    if (player.shields > 0) return 'Shields already up.'
    const xfer = Math.min(player.maxShields, player.energy)
    player.shields = xfer
    player.energy -= xfer
    this.addLog(`Shields up: ${player.shields} units.`)
    return `Shields raised to ${player.shields}.`
  }

  cmdShieldsDown(): string {
    if (this.state.player.shields === 0) return 'Shields already down.'
    // No energy change when lowering
    this.state.player.shields = 0
    this.addLog('Shields lowered.')
    return 'Shields lowered.'
  }

  cmdMaxShields(): string {
    const { player } = this.state
    if (player.systems[ShipSystem.Shields] < 10) return 'Shield generator offline.'
    const total = player.energy + player.shields
    const newShields = Math.min(player.maxShields, total)
    player.energy = total - newShields
    player.shields = newShields
    this.addLog(`MAX shields: ${player.shields}.`)
    return `Shields at maximum: ${player.shields}.`
  }

  cmdSetWarp(speed: number): string {
    if (speed < 0.1 || speed > MAX_WARP) return `Warp must be 0.1–${MAX_WARP}.`
    const maxWarp = 1 + 0.09 * this.state.player.systems[ShipSystem.WarpEngines]
    if (speed > maxWarp) return `Engine damage limits warp to ${maxWarp.toFixed(1)}.`
    this.state.player.warp = speed
    return `Warp set to ${speed.toFixed(1)}.`
  }

  // ── Scanners ──────────────────────────────────────────────────────────────

  cmdShortRangeScan(): string {
    const srRepair = this.state.player.systems[ShipSystem.SRScanner]
    if (srRepair < 50) return 'Short range scanners offline.'
    if (srRepair < 90) return 'SR scanner degraded: only large objects visible.'
    this.state.galaxy[this.state.position.quad.y][this.state.position.quad.x].scanned = true
    return 'Short range scan complete.'
  }

  cmdLongRangeScan(): string {
    const lrRepair = this.state.player.systems[ShipSystem.LRScanner]
    if (lrRepair < 50) return 'Long range scanners offline.'
    const { quad } = this.state.position
    const canSeeEnemies = lrRepair >= 100
    if (!canSeeEnemies) this.addLog('LR scanner damaged: enemy counts unavailable.')
    this.scanAdjacent(quad.x, quad.y)
    return 'Long range scan complete.'
  }

  private scanAdjacent(qx: number, qy: number): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy
        if (nx >= 0 && nx < GALAXY_SIZE && ny >= 0 && ny < GALAXY_SIZE) {
          this.state.galaxy[ny][nx].scanned = true
        }
      }
    }
  }

  // ── Docking ───────────────────────────────────────────────────────────────

  cmdDock(): string {
    const { quadrant, position } = this.state
    if (quadrant.baseType === BaseType.None) return 'No base in this quadrant.'

    const baseCells: CellType[] = [CellType.StarBase, CellType.ResearchStation, CellType.SupplyDepot]
    let base: { x: number; y: number } | null = null
    for (const bt of baseCells) {
      base = this.findCellType(bt)
      if (base) break
    }
    if (!base) return 'Base not found on scanner.'

    const dist = Math.abs(position.sect.x - base.x) + Math.abs(position.sect.y - base.y)
    if (dist > 2) return `Must be adjacent to base. Move to within 1 sector. (Currently ${dist} away)`

    const { player } = this.state
    const baseType = quadrant.baseType

    if (baseType === BaseType.StarBase) {
      player.energy = player.maxEnergy
      player.phoTorps = 10
      player.phaserTemp = 0
      for (const key of Object.values(ShipSystem)) player.systems[key] = 100
      this.state.phase = GamePhase.Docked
      this.addLog('Docked at StarBase. Full resupply and repairs.')
      return 'Docked at StarBase. All systems repaired, energy and torpedoes restored.'
    } else if (baseType === BaseType.Supply) {
      player.phoTorps = 10
      player.systems[ShipSystem.LifeSupport] = 100
      this.state.phase = GamePhase.Docked
      this.addLog('Docked at Supply Depot. Torpedoes and life support restored.')
      return 'Docked at Supply Depot. Torpedoes and life support replenished.'
    } else {
      player.systems[ShipSystem.LifeSupport] = 100
      this.state.phase = GamePhase.Docked
      this.addLog('Docked at Research Station. Life support restored.')
      return 'Docked at Research Station. Life support replenished.'
    }
  }

  cmdUndock(): string {
    if (this.state.phase !== GamePhase.Docked) return 'Not docked.'
    this.state.phase = GamePhase.Playing
    return 'Undocked from base.'
  }

  // ── Energy Management ─────────────────────────────────────────────────────

  cmdEnergy(): string {
    const { player } = this.state
    return [
      `Main energy:  ${Math.round(player.energy)}/${player.maxEnergy}`,
      `Shields:      ${Math.round(player.shields)}/${player.maxShields}`,
      `PhoTorps:     ${player.phoTorps}`,
      `Phaser temp:  ${Math.round(player.phaserTemp)}/1500`,
      `Phaser eff:   ${player.phaserEff}%`,
    ].join('\n')
  }

  cmdTransferEnergy(toShields: number): string {
    const { player } = this.state
    if (player.systems[ShipSystem.Shields] < 10) return 'Shield generator offline.'
    const total = player.energy + player.shields
    if (toShields > player.maxShields) toShields = player.maxShields
    if (toShields > total) return 'Insufficient total energy.'
    if (toShields < 0) toShields = 0
    player.shields = toShields
    player.energy = total - toShields
    return `Shields: ${player.shields}. Energy: ${Math.round(player.energy)}.`
  }

  // ── Info / Repair ─────────────────────────────────────────────────────────

  cmdRepairStatus(): string {
    return Object.entries(this.state.player.systems)
      .map(([k, v]) => `${k.padEnd(18)} ${v}%`)
      .join('\n')
  }

  cmdInfo(): string {
    const enemies = this.state.quadrant.enemies
    if (enemies.length === 0) return 'No enemy vessels in quadrant.'
    return enemies.map((e, i) => {
      const dist = this.distToEnemy(e.sect).toFixed(1)
      const typeName = this.enemyTypeName(e.type)
      return `${i + 1}. ${typeName} at ${e.sect.x + 1},${e.sect.y + 1}  dist:${dist}  shlds:~${Math.round(e.energy / 4)}`
    }).join('\n')
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private enemyAttack(): void {
    for (const enemy of this.state.quadrant.enemies) {
      const dist = this.distToEnemy(enemy.sect)
      const baseDamage = enemy.energy * 0.08 / dist
      const hit = Math.floor(baseDamage * (0.8 + Math.random() * 0.4))
      if (hit <= 0) continue

      if (this.state.player.shields > 0) {
        const shieldEff = this.state.player.systems[ShipSystem.Shields] / 100
        const absorbed = Math.min(hit, Math.floor(this.state.player.shields * shieldEff))
        this.state.player.shields -= absorbed
        const bleed = hit - absorbed
        if (bleed > 0) {
          this.state.player.energy -= bleed
          this.damageSystem()
        }
        this.addLog(`Shields absorb ${absorbed} unit hit from ${this.enemyTypeName(enemy.type)} at ${enemy.sect.x + 1}-${enemy.sect.y + 1}.`)
      } else {
        this.state.player.energy -= hit
        this.damageSystem()
        this.addLog(`${hit} unit hit from ${this.enemyTypeName(enemy.type)} at ${enemy.sect.x + 1}-${enemy.sect.y + 1}.`)
      }

      if (this.state.player.energy <= 0) {
        this.state.phase = GamePhase.GameOver
        this.addLog('Ship destroyed. Mission failed.')
        return
      }
    }
  }

  private damageSystem(): void {
    const systems = Object.values(ShipSystem)
    const target = systems[Math.floor(Math.random() * systems.length)]
    const damage = 5 + Math.floor(Math.random() * 20)
    this.state.player.systems[target] = Math.max(0, this.state.player.systems[target] - damage)
    this.addLog(`${target} damaged. Now at ${this.state.player.systems[target]}%.`)
  }

  private destroyEnemy(sect: { x: number; y: number }): void {
    this.state.quadrant.cells[sect.y][sect.x] = CellType.Empty
    this.state.quadrant.enemies = this.state.quadrant.enemies.filter(
      e => !(e.sect.x === sect.x && e.sect.y === sect.y)
    )
    const { quad } = this.state.position
    this.state.galaxy[quad.y][quad.x].enemies = Math.max(0, this.state.galaxy[quad.y][quad.x].enemies - 1)
    this.state.totalEnemies = Math.max(0, this.state.totalEnemies - 1)
    this.state.alert = this.state.quadrant.enemies.length > 0
  }

  private checkVictory(): void {
    if (this.state.totalEnemies <= 0 && this.state.phase !== GamePhase.GameOver) {
      this.state.phase = GamePhase.Victory
      this.addLog('All enemy vessels destroyed. Mission accomplished!')
    }
  }

  private distToEnemy(sect: { x: number; y: number }): number {
    const { position } = this.state
    const dx = sect.x - position.sect.x
    const dy = sect.y - position.sect.y
    return Math.max(1, Math.sqrt(dx * dx + dy * dy))
  }

  private findEmpty(q: QuadrantData, preferX: number, preferY: number): { x: number; y: number } {
    if (q.cells[preferY]?.[preferX] === CellType.Empty) return { x: preferX, y: preferY }
    for (let r = 1; r < SECTOR_SIZE; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = preferX + dx, ny = preferY + dy
          if (nx >= 0 && nx < SECTOR_SIZE && ny >= 0 && ny < SECTOR_SIZE &&
              q.cells[ny][nx] === CellType.Empty) {
            return { x: nx, y: ny }
          }
        }
      }
    }
    return { x: 0, y: 0 }
  }

  private findCellType(type: CellType): { x: number; y: number } | null {
    const cells = this.state.quadrant.cells
    for (let y = 0; y < SECTOR_SIZE; y++) {
      for (let x = 0; x < SECTOR_SIZE; x++) {
        if (cells[y][x] === type) return { x, y }
      }
    }
    return null
  }

  private enemyTypeName(type: CellType): string {
    switch (type) {
      case CellType.EnemyCommand: return 'Klingon Command'
      case CellType.EnemyScout:   return 'Klingon Scout'
      case CellType.EnemySupply:  return 'Klingon Supply'
      default:                    return 'Klingon Battleship'
    }
  }
}
