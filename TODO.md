# WebTrek — EGA Trek Gap Analysis & TODO

Mapped by playing original EGA Trek (Revision 3.1, playdosgames.com).
Items ordered roughly by gameplay impact.

---

## Missing Commands

| Priority | Command | Original | Notes |
|----------|---------|----------|-------|
| HIGH | `fix` | `F)ix` | Repair individual systems at a cost; distinct from `repair` (which just shows status) |
| HIGH | `self` | `S)elf` | Self-destruct with password confirmation |
| MED | `msgs` | `MSGS` | Replay old messages/log entries |
| MED | `hail` | `HAIL` | Hail a StarBase (communication before/without docking) |
| MED | `ray` | `RAY` | Fire Death Ray weapon |
| MED | `orbit` | `O)rbit` | Enter standard orbit around a planet |
| MED | `land` | `LAND` | Send landing party to planet surface |
| MED | `use` | `USE` | Use a miscellaneous item (picked up on planet) |
| MED | `ack` / `a#` | `A#` | Acknowledge incoming message by number |
| LOW | `quit` / `q` | `Q)uit` | Graceful quit with confirm prompt |
| LOW | `save` | `SAVE` | Save game to disk (Supabase stub already planned) |
| LOW | `snd` | `SND` | Toggle sound on/off |

**Naming note:** Original calls the energy weapon "Lasers" (command `L)`); WebTrek uses "Phasers". Original uses arrow keys for shields up/down; WebTrek uses `shup`/`shdn`.

---

## Missing UI Panels / HUD Elements

| Priority | Element | Description |
|----------|---------|-------------|
| HIGH | **Laser/Phaser panel** | Shows `Eff` (0–100) and `Temp` (0–1500) as horizontal bar gauges — currently these stats exist in code but aren't visually displayed |
| HIGH | **Circular Energy/Shield gauges** | Original uses analog dial meters, not just numbers |
| HIGH | **Color-coded Status badge** | `Green` / `Yellow` / `Red` alert shown as a colored label in the HUD |
| HIGH | **Damage Report panel** | Dedicated lower-right box that shows incoming hit/damage events |
| MED | **Ship badge panel** | Lower-left panel with ship name, registry, org emblem (star cluster graphic) |
| MED | **Galaxy chart codes** | Scanned quadrants show `NNN` (enemies/bases/stars count); unscanned show `...`; current quad highlighted |
| MED | **Warp factor in HUD** | Current warp setting shown persistently in center panel |
| MED | **Enemy counter in HUD** | "Mongols: 40" style count shown persistently |
| MED | **Stardate in HUD** | Always-visible date display |
| LOW | **Main Viewer graphic** | The center panel shows a visual scene (planet, stars) rather than text output |

---

## Missing Ship Systems

Original has 12 systems; WebTrek `ShipSystem` enum is missing two:

| Missing System | Notes |
|----------------|-------|
| `Transporter` | Used for `land` command (beam party to planet) |
| `Shuttlecraft` | Used as backup transport when transporter offline |

Full original system list (numbered 1–12 in `fix` command):
`EnergyConverter`, `Shields`, `Life Support`, `Lasers`, `EnTorp Tubes`, `Warp Engines`, `Impulse Engine`, `S.R. Scanner`, `L.R. Scanner`, `Computer`, `Transporter`, `Shuttlecraft`

---

## Missing Game Systems / Mechanics

| Priority | Feature | Notes |
|----------|---------|-------|
| HIGH | **Incoming message system** | Timestamped messages appear in right-side panel by department (NAVIGATION, SCIENCE, COMMUNICATIONS, DAMAGE REPORT); player must `A#` to acknowledge; `MSGS` replays |
| HIGH | **Alert status logic** | Green/Yellow/Red based on enemies present, shields down, damage level |
| HIGH | **Progressive system failure** | Damaged systems (e.g. EnergyConverter) continue degrading each stardate until repaired — not just static damage |
| HIGH | **FIX command** | ENGINEERING modal: numbered list of 12 systems → pick system → "Docked or in space?" → "How many stardates?" → advances clock, repairs proportionally. Docked repairs faster (0.5x time vs 1.0x undocked) |
| MED | **Power distribution system** | Three power groups with PMAX/PAVL/PPCT columns (max/available/percent); shown in main viewer on certain commands — entirely absent from WebTrek |
| MED | **Planet system** | Planets visible in sector map (orange sphere); `o` to enter orbit (requires orthogonal adjacency, dist=1); `land` to beam party down; `use` for found items |
| MED | **Planet list display** | Main viewer shows named planet list on arrival in a quadrant (e.g. "Xevious-7", "Andromeda-6") with sector coordinates |
| MED | **Death Ray weapon** | Separate from lasers/torpedoes; different energy profile |
| MED | **HAIL command** | Radio comms with a base in-quadrant; separate from docking |
| MED | **Self-destruct flow** | Password set at game start; `self` → confirms password → counts down → ship destroyed |
| MED | **Score / rank screen** | End-of-game screen showing performance rating, rank, mission score |
| LOW | **Sound effects** | Phasers, torpedo, hit, warp, docking sounds |
| LOW | **Save / Restore** | Wire up Supabase (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) for save states |

---

## Startup Flow (Missing Entirely)

The original has a full onboarding sequence before the game begins:

1. Title screen → press key
2. "Will you require a briefing? (Y/N)" — shows command tutorial if Y
3. "Restore a saved game? (Y/N)"
4. "Please enter your name:" — captain name used in log/messages
5. "Enter your command level (1–5):" — difficulty selector
6. "Enter self-destruct password:" — used later by `self` command

WebTrek jumps straight to gameplay with hardcoded difficulty=3.

---

## Main Viewer Modes (Observed)

The original main viewer is a graphical context panel that changes based on the last command. WebTrek uses it for text output only.

| Mode | Triggered by | Shows |
|------|-------------|-------|
| Space scene | Default / move | Stars + planet (if nearby) with angle/dist readout |
| System status | `repair` / move | System list with % values |
| Grav field scan | `info` | Scattered dot field labeled "GRAV FIELD NNN" |
| Ship side-view | Power commands | Wire-frame ship graphic + power distribution table (PMAX/PAVL/PPCT) |
| Planet list | Arrival in quadrant | Named planets in quadrant with sector coords |
| Weapons control | `l` (lasers) | Target selection / fire confirmation |

---

## Minor / Polish Items

- [ ] `?` / `help` output should match original's categorized format more closely
- [ ] `repair` / "State of Repair" should show `Docked` and `Undocked` repair time columns alongside % for each damaged system
- [ ] Torpedo miss should show a path trace in the main viewer, not just "Torpedo missed."
- [ ] Galaxy chart: highlight current quadrant position distinctly; unscanned quads show `...`, scanned show `NNN` (enemies/bases/stars)
- [ ] Ship name/registry currently hardcoded (`U.S.S. Enterprise NCC-1701`) — should come from startup name entry
- [ ] `move` command: original uses interactive "Quad, Sector:" prompt; WebTrek uses space-separated args — functionally equivalent but worth matching
- [ ] Enemy types currently named "Klingon" — original uses "Mongol" (intentional tribute divergence, keep as-is or make configurable)
- [ ] Message panel: original shows department prefix (NAVIGATION:, SCIENCE:, COMMUNICATIONS:, DAMAGE REPORT:) with per-message stardate timestamps

---

## Still Mapping (In Progress)

- [ ] `land` flow after orbit — what prompts appear, what items can be found on surface
- [ ] `use` command — item types and effects
- [ ] Death Ray targeting, energy cost, damage profile
- [ ] `hail` response dialog options and base communication content
- [ ] Message acknowledgment flow (`a#`) and what messages look like queued
- [ ] Score/rank calculation at game end
- [ ] Briefing text content (what shows when Y at "require a briefing?")
