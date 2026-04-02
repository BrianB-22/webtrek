export interface Position {
  quad: { x: number; y: number }  // col, row 0-7
  sect: { x: number; y: number }  // col, row 0-7
}

export enum CellType {
  Empty = 0,
  Ship,
  Star,
  Planet,
  BlackHole,
  EnemyBattleship,   // light blue
  EnemyCommand,      // red
  EnemyScout,        // purple
  EnemySupply,       // green
  EnemyBase,
  StarBase,          // base type 1
  ResearchStation,   // base type 2
  SupplyDepot,       // base type 3
  Nova,
}

export enum ShipSystem {
  MAMConverter  = 'M/A-M Converter',
  Shields       = 'Shields',
  WarpEngines   = 'Warp Engines',
  ImpulseEngines = 'Impulse Engines',
  Phasers       = 'Phasers',
  PhoTorpTubes  = 'PhoTorp Tubes',
  SRScanner     = 'S.R. Scanner',
  LRScanner     = 'L.R. Scanner',
  Computer      = 'Computer',
  LifeSupport   = 'Life Support',
  Transporter   = 'Transporter',
  Shuttlecraft  = 'Shuttlecraft',
}

export type SystemsStatus = Record<ShipSystem, number>  // 0-100 integrity %

export const enum BaseType {
  None     = 0,
  StarBase = 1,
  Research = 2,
  Supply   = 3,
}

export const ENEMY_CELL_TYPES = [
  CellType.EnemyBattleship,
  CellType.EnemyCommand,
  CellType.EnemyScout,
  CellType.EnemySupply,
]

export interface QuadrantData {
  cells: CellType[][]  // [row][col], 8x8
  enemies: EnemyShip[]
  baseType: BaseType
  stars: number
}

export interface EnemyShip {
  sect: { x: number; y: number }
  type: CellType
  energy: number
}

export interface GalaxyCell {
  enemies: number
  baseType: BaseType
  stars: number
  scanned: boolean
}

export interface PlayerShip {
  name: string
  registry: string
  org: string
  energy: number
  maxEnergy: number
  shields: number
  maxShields: number
  warp: number          // currently set warp speed
  phoTorps: number
  phaserEff: number     // 0-100, drops with heat and damage
  phaserTemp: number    // 0-1500
  systems: SystemsStatus
  lifeSupportDays: number  // reserve days remaining when life support damaged
}

export interface GameState {
  date: number
  player: PlayerShip
  position: Position
  galaxy: GalaxyCell[][]   // [row][col], 8x8
  quadrant: QuadrantData
  totalEnemies: number
  alert: boolean
  log: LogEntry[]
  phase: GamePhase
  difficulty: number  // 1-5
  selfDestructPassword: string
  commanderName: string
}

export interface LogEntry {
  date: number
  text: string
}

export enum GamePhase {
  Title,
  Setup,
  Briefing,
  Playing,
  Docked,
  Orbiting,
  GameOver,
  Victory,
}
