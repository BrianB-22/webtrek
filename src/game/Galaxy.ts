import {
  CellType, GalaxyCell, QuadrantData, Position, BaseType, ENEMY_CELL_TYPES,
} from './types'

export const GALAXY_SIZE = 8
export const SECTOR_SIZE = 8

function rand(n: number): number {
  return Math.floor(Math.random() * n)
}

function emptyQuadrant(): QuadrantData {
  return {
    cells: Array.from({ length: SECTOR_SIZE }, () => Array(SECTOR_SIZE).fill(CellType.Empty)),
    enemies: [],
    baseType: BaseType.None,
    stars: 0,
  }
}

function placeRandom(cells: CellType[][], type: CellType): { x: number; y: number } {
  for (let attempts = 0; attempts < 200; attempts++) {
    const x = rand(SECTOR_SIZE)
    const y = rand(SECTOR_SIZE)
    if (cells[y][x] === CellType.Empty) {
      cells[y][x] = type
      return { x, y }
    }
  }
  // Fallback: linear scan
  for (let y = 0; y < SECTOR_SIZE; y++) {
    for (let x = 0; x < SECTOR_SIZE; x++) {
      if (cells[y][x] === CellType.Empty) {
        cells[y][x] = type
        return { x, y }
      }
    }
  }
  return { x: 0, y: 0 }
}

function enemyEnergyForType(type: CellType): number {
  switch (type) {
    case CellType.EnemyCommand:   return 400 + rand(200)
    case CellType.EnemyScout:     return 100 + rand(100)
    case CellType.EnemySupply:    return 150 + rand(100)
    default:                       return 200 + rand(200)  // Battleship
  }
}

function randomEnemyType(difficulty: number): CellType {
  const r = Math.random()
  if (difficulty >= 3 && r < 0.15) return CellType.EnemyCommand
  if (difficulty >= 2 && r < 0.25) return CellType.EnemyScout
  if (difficulty >= 4 && r < 0.35) return CellType.EnemySupply
  return CellType.EnemyBattleship
}

function baseCellType(baseType: BaseType): CellType {
  switch (baseType) {
    case BaseType.Research: return CellType.ResearchStation
    case BaseType.Supply:   return CellType.SupplyDepot
    default:                return CellType.StarBase
  }
}

export function generateGalaxy(difficulty: number): {
  galaxy: GalaxyCell[][]
  quadrants: QuadrantData[][]
  startPos: Position
} {
  const totalEnemies = 10 + difficulty * 5   // 15–35 depending on level
  const totalBases   = Math.max(2, 5 - difficulty)
  const totalStars   = 60

  const galaxy: GalaxyCell[][] = Array.from({ length: GALAXY_SIZE }, () =>
    Array.from({ length: GALAXY_SIZE }, () => ({
      enemies: 0,
      baseType: BaseType.None,
      stars: 0,
      scanned: false,
    }))
  )

  const quadrants: QuadrantData[][] = Array.from({ length: GALAXY_SIZE }, () =>
    Array.from({ length: GALAXY_SIZE }, () => emptyQuadrant())
  )

  // Place enemies
  for (let i = 0; i < totalEnemies; i++) {
    const qx = rand(GALAXY_SIZE), qy = rand(GALAXY_SIZE)
    galaxy[qy][qx].enemies++
    const q = quadrants[qy][qx]
    const type = randomEnemyType(difficulty)
    const pos = placeRandom(q.cells, type)
    q.enemies.push({ sect: pos, type, energy: enemyEnergyForType(type) })
  }

  // Place bases — ensure at least one StarBase
  for (let i = 0; i < totalBases; i++) {
    let qx: number, qy: number
    do {
      qx = rand(GALAXY_SIZE); qy = rand(GALAXY_SIZE)
    } while (galaxy[qy][qx].baseType !== BaseType.None)

    const baseType: BaseType = i === 0
      ? BaseType.StarBase
      : ([BaseType.StarBase, BaseType.Research, BaseType.Supply][rand(3)] as BaseType)

    galaxy[qy][qx].baseType = baseType
    const q = quadrants[qy][qx]
    q.baseType = baseType
    placeRandom(q.cells, baseCellType(baseType))
  }

  // Place stars
  for (let i = 0; i < totalStars; i++) {
    const qx = rand(GALAXY_SIZE), qy = rand(GALAXY_SIZE)
    galaxy[qy][qx].stars = Math.min(9, galaxy[qy][qx].stars + 1)
    placeRandom(quadrants[qy][qx].cells, CellType.Star)
  }

  // Place player — prefer a quadrant with no enemies
  let startQx: number, startQy: number
  let attempts = 0
  do {
    startQx = rand(GALAXY_SIZE); startQy = rand(GALAXY_SIZE)
    attempts++
  } while (galaxy[startQy][startQx].enemies > 0 && attempts < 50)

  const startQ = quadrants[startQy][startQx]
  const startSect = placeRandom(startQ.cells, CellType.Ship)
  galaxy[startQy][startQx].scanned = true

  return {
    galaxy,
    quadrants,
    startPos: {
      quad: { x: startQx, y: startQy },
      sect: startSect,
    },
  }
}

export function isEnemyCell(type: CellType): boolean {
  return ENEMY_CELL_TYPES.includes(type)
}

export function countTotalEnemies(galaxy: GalaxyCell[][]): number {
  return galaxy.flat().reduce((sum, cell) => sum + cell.enemies, 0)
}
