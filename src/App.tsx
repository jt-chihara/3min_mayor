import { useEffect, useState } from 'react'

const GRID_SIZE = 10
const TICK_MS = 250
const SEC_PER_MONTH = 1
const GAME_SECONDS = 180
const START_HOUSES = 12

const Tools = {
  BULLDOZE: 'bulldoze',
  PARK: 'park',
  RAIL: 'rail',
  STATION: 'station',
  HOUSE: 'house',
  APT: 'apt',
  PUBLIC: 'public',
  NEWTOWN: 'newtown',
} as const

type ToolType = typeof Tools[keyof typeof Tools]

interface ToolDef {
  id: ToolType
  name: string
  icon: string
  cost: number
  maint: number
  desc: string
}

const ToolDefs: ToolDef[] = [
  { id: Tools.BULLDOZE, name: '取り壊し',   icon: '🧹', cost: 50,   maint: 0,    desc: '施設を撤去' },
  { id: Tools.RAIL,     name: '線路',       icon: '🛤️', cost: 100,  maint: 5,    desc: '需要 +少' },
  { id: Tools.STATION,  name: '駅',         icon: '🚉', cost: 400,  maint: 50,   desc: '需要 大（線路隣接）' },
  { id: Tools.PUBLIC,   name: '市営住宅',   icon: '🏚️', cost: 1000, maint: 250,  desc: '初期住民300人' },
  { id: Tools.APT,      name: 'マンション', icon: '🏢', cost: 2500, maint: 600,  desc: '初期住民500人' },
  { id: Tools.NEWTOWN,  name: 'ニュータウン', icon: '🏙️', cost: 8000, maint: 2000, desc: '初期住民600人×4（2×2マス）' },
]

const Tile = {
  EMPTY: 'empty',
  PARK: 'park',
  RAIL: 'rail',
  STATION: 'station',
  HOUSE: 'house',
  APT: 'apt',
  PUBLIC: 'public',
  NEWTOWN: 'newtown',
} as const

type TileType = typeof Tile[keyof typeof Tile]

const TileIcons: Record<TileType, string> = {
  [Tile.EMPTY]: '',
  [Tile.PARK]: '🌳',
  [Tile.RAIL]: '🛤️',
  [Tile.STATION]: '🚉',
  [Tile.HOUSE]: '🏠',
  [Tile.APT]: '🏢',
  [Tile.PUBLIC]: '🏚️',
  [Tile.NEWTOWN]: '🏙️',
}

const TileClass: Record<TileType, string> = {
  [Tile.EMPTY]: 't-empty',
  [Tile.PARK]: 't-park',
  [Tile.RAIL]: 't-rail',
  [Tile.STATION]: 't-station',
  [Tile.HOUSE]: 't-house',
  [Tile.APT]: 't-apt',
  [Tile.PUBLIC]: 't-public',
  [Tile.NEWTOWN]: 't-newtown',
}

type Grid = TileType[][]

interface TileCounts {
  empty: number
  park: number
  rail: number
  station: number
  connectedStation: number
  house: number
  apt: number
  public: number
  newtown: number
}

interface Stats {
  capacity: number
  demand: number
  counts: TileCounts
}

interface ModalState {
  open: boolean
  title: string
  body: string
}

function make2D(w: number, h: number, fill: TileType): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill))
}

function seedHouses(grid: Grid, count: number): Grid {
  const ng = grid.map(row => row.slice())
  const empties: [number, number][] = []
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (ng[y][x] === Tile.EMPTY) empties.push([x, y])
    }
  }
  let n = Math.min(count, empties.length)
  while (n-- > 0 && empties.length > 0) {
    const idx = Math.floor(Math.random() * empties.length)
    const [x, y] = empties.splice(idx, 1)[0]
    ng[y][x] = Tile.HOUSE
  }
  return ng
}

function neighbors4(x: number, y: number): [number, number][] {
  return (
    [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]
  ).filter(([cx, cy]) => cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE)
}

function stationConnectedToRail(grid: Grid, x: number, y: number): boolean {
  for (const [nx, ny] of neighbors4(x, y)) {
    if (grid[ny][nx] === Tile.RAIL) return true
  }
  return false
}

function countTiles(grid: Grid): TileCounts {
  const counts: TileCounts = {
    empty: 0,
    park: 0,
    rail: 0,
    station: 0,
    connectedStation: 0,
    house: 0,
    apt: 0,
    public: 0,
    newtown: 0,
  }
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const t = grid[y][x]
      counts[t]++
      if (t === Tile.STATION && stationConnectedToRail(grid, x, y)) {
        counts.connectedStation++
      }
    }
  }
  return counts
}

function calcStats(grid: Grid, _people: number): Stats {
  const c = countTiles(grid)
  const capacity = c.house * 20 + c.public * 500 + c.apt * 1000 + c.newtown * 1000
  const base = 10
  const demand = Math.floor(
    base + c.rail * 2 + c.connectedStation * 80 + (c.station - c.connectedStation) * 8
  )
  return { capacity, demand, counts: c }
}

function monthlyIncome(grid: Grid, people: number): number {
  const c = countTiles(grid)
  const maintenance = Math.floor(
    c.rail * 5 + c.station * 50 + c.public * 250 + c.apt * 600 + c.newtown * 500
  )
  const tax = Math.floor(people * 1)
  return tax - maintenance
}

function App() {
  const [grid, setGrid] = useState<Grid>(() =>
    seedHouses(make2D(GRID_SIZE, GRID_SIZE, Tile.EMPTY), START_HOUSES)
  )
  const [money, setMoney] = useState(3000)
  const [people, setPeople] = useState(10)
  const [{ capacity, demand }, setStats] = useState<Stats>(() => calcStats(grid, 10))
  const [tool, setTool] = useState<ToolType>(Tools.RAIL)
  const [started, setStarted] = useState(false)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [monthClock, setMonthClock] = useState(0)
  const [year, setYear] = useState(2025)
  const [month, setMonth] = useState(4)
  const [statusMsg, setStatusMsg] = useState('')
  const [guideMsg, setGuideMsg] = useState('')
  const [tip, setTip] = useState('ツールを選んでマスをクリック')
  const [modal, setModal] = useState<ModalState>({ open: false, title: '', body: '' })

  useEffect(() => {
    setStats(calcStats(grid, people))
  }, [grid, people])

  useEffect(() => {
    if (!started) return
    const id = setInterval(() => {
      setSecondsElapsed(s => s + TICK_MS / 1000)
      setMonthClock(c => c + TICK_MS / 1000)
      setPeople(p => {
        const capGap = Math.max(0, capacity - p)
        const demandGap = Math.max(0, demand - Math.floor(p / 5))
        const potential = Math.min(capGap, demandGap)
        const rate = 0.35
        const delta = potential * rate * (TICK_MS / 1000)
        let np = p
        if (delta > 0) np = Math.min(capacity, p + delta)
        if (np > capacity) np = np - Math.min(2 * (TICK_MS / 1000), np - capacity)
        if (Math.floor(np) === 0) {
          setGuideMsg('誰もいなくなってしまいました！　市長、責任をとってください！')
        } else if (np < p && money < 0) {
          setGuideMsg('財政が赤字で人口が減っています！　維持費を減らしましょう。')
        } else {
          setGuideMsg('')
        }
        return np
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [started, capacity, demand, money])

  useEffect(() => {
    if (!started) return
    if (monthClock >= SEC_PER_MONTH) {
      setMonthClock(c => c - SEC_PER_MONTH)
      setMonth(m => {
        const nm = m + 1
        if (nm > 12) {
          setYear(y => y + 1)
          return 1
        }
        return nm
      })
      const inc = monthlyIncome(grid, people)
      setMoney(v => v + inc)
      setStatusMsg(`${year}年${(month % 12) + 1}月の収支：${inc}万円`)

      const capGap = Math.max(0, capacity - people)
      const demandGap = Math.max(0, demand - Math.floor(people / 5))
      if (capGap > 0 && demandGap > 0) {
        const empties: [number, number][] = []
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            if (grid[y][x] === Tile.EMPTY) empties.push([x, y])
          }
        }
        if (empties.length > 0) {
          const spawn = Math.min(2, empties.length)
          const ng = grid.map(row => row.slice())
          for (let i = 0; i < spawn; i++) {
            const idx = Math.floor(Math.random() * empties.length)
            const [sx, sy] = empties.splice(idx, 1)[0]
            ng[sy][sx] = Tile.HOUSE
          }
          setGrid(ng)
          setPeople(p => {
            const free = Math.max(0, capacity + spawn * 20 - p)
            return p + Math.min(spawn * 5, free)
          })
        }
      }
    }
  }, [monthClock, started, grid, people, capacity, demand, year, month])

  useEffect(() => {
    if (!started) return
    if (secondsElapsed >= GAME_SECONDS) {
      setStarted(false)
      const score = Math.floor(people)
      setModal({
        open: true,
        title: '3分終了',
        body: `<p>おつかれさま！</p>
              <p>最終人口：<b>${score}人</b></p>
              <p>資金：<b>${money}万円</b></p>
              <p>需要：<b>${demand}</b> / 収容：<b>${capacity}</b></p>
              <p style="color:#9ca3af">ヒント：線路＋駅で需要↑、住宅/マンションで収容↑。</p>`,
      })
    }
  }, [secondsElapsed, started, people, money, demand, capacity])

  const canAfford = (cost: number): boolean => money >= cost

  function handlePlace(x: number, y: number): void {
    setGrid(prev => {
      const current = prev[y][x]
      const def = ToolDefs.find(d => d.id === tool)
      if (!def) return prev

      if (tool === Tools.BULLDOZE) {
        if (current === Tile.EMPTY) return prev
        const ng = prev.map(row => row.slice())
        ng[y][x] = Tile.EMPTY
        const bulldozeDef = ToolDefs.find(d => d.id === Tools.BULLDOZE)!
        if (!canAfford(bulldozeDef.cost)) {
          const lack = bulldozeDef.cost - money
          setTip(`不足分を借入れ（${lack}万円）`)
        } else {
          setTip(`取り壊し（${bulldozeDef.cost}万円）`)
        }
        setMoney(m => m - bulldozeDef.cost)
        return ng
      }

      if (tool === Tools.NEWTOWN) {
        if (x + 1 >= GRID_SIZE || y + 1 >= GRID_SIZE) {
          setTip('2×2マスの空き地が必要です')
          return prev
        }
        const cells: [number, number][] = [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ]
        for (const [cx, cy] of cells) {
          const tt = prev[cy][cx]
          if (!(tt === Tile.EMPTY || tt === Tile.HOUSE)) {
            setTip('2×2マスの空き地（住宅は可）が必要です')
            return prev
          }
        }
        const ng = prev.map(row => row.slice())
        for (const [cx, cy] of cells) ng[cy][cx] = Tile.NEWTOWN
        if (!canAfford(def.cost)) {
          const lack = def.cost - money
          setTip(`不足分を借入れ（${lack}万円）`)
        } else {
          setTip(`${def.name}を設置（${def.cost}万円）`)
        }
        setMoney(m => m - def.cost)
        const replacedHouses = cells.reduce(
          (acc, [cx, cy]) => acc + (prev[cy][cx] === Tile.HOUSE ? 1 : 0),
          0
        )
        const capDelta = 4000 - replacedHouses * 20
        const init = 600 * 4
        setPeople(p => {
          const free = Math.max(0, capacity + capDelta - p)
          return p + Math.min(init, free)
        })
        return ng
      }

      if (current !== Tile.EMPTY) {
        const canOverHouse =
          tool === Tools.PUBLIC ||
          tool === Tools.APT ||
          tool === Tools.RAIL ||
          tool === Tools.STATION
        if (!(canOverHouse && current === Tile.HOUSE)) {
          setTip('ここには建てられません')
          return prev
        }
      }

      const ng = prev.map(row => row.slice())
      switch (tool) {
        case Tools.RAIL:
          ng[y][x] = Tile.RAIL
          break
        case Tools.STATION:
          ng[y][x] = Tile.STATION
          break
        case Tools.PUBLIC:
          ng[y][x] = Tile.PUBLIC
          break
        case Tools.APT:
          ng[y][x] = Tile.APT
          break
        default:
          return prev
      }

      if (!canAfford(def.cost)) {
        const lack = def.cost - money
        setTip(`不足分を借入れ（${lack}万円）`)
      } else {
        setTip(`${def.name}を設置（${def.cost}万円）`)
      }
      setMoney(m => m - def.cost)

      if (tool === Tools.PUBLIC || tool === Tools.APT) {
        const baseDelta = tool === Tools.PUBLIC ? 500 : 1000
        const capDelta = baseDelta - (current === Tile.HOUSE ? 20 : 0)
        const init = tool === Tools.PUBLIC ? 300 : 500
        setPeople(p => {
          const free = Math.max(0, capacity + capDelta - p)
          return p + Math.min(init, free)
        })
      }
      return ng
    })
  }

  function start(): void {
    if (started) return
    setStarted(true)
    setTip('ゲーム開始！3分で人口を伸ばそう')
  }

  function reset(): void {
    const base = make2D(GRID_SIZE, GRID_SIZE, Tile.EMPTY)
    const seeded = seedHouses(base, START_HOUSES)
    setGrid(seeded)
    setMoney(3000)
    setPeople(10)
    setStats(calcStats(seeded, 10))
    setTool(Tools.RAIL)
    setStarted(false)
    setSecondsElapsed(0)
    setMonthClock(0)
    setYear(2025)
    setMonth(4)
    setStatusMsg('')
    setTip('ツールを選んでマスをクリック')
    setModal({ open: false, title: '', body: '' })
  }

  const HELP_HTML = `
    <p>3分間で人口をできるだけ増やすゲームです。</p>
    <ul>
      <li>空きマスには自動で<b>住宅</b>が建ちます（無料）。</li>
      <li><b>市営住宅</b>（初期住民300人）、<b>マンション</b>（初期住民500人）、<b>ニュータウン</b>（初期住民600×4, 2×2マス）を建設できます。</li>
      <li>線路と駅を組み合わせると<b>需要</b>が大きく伸びます。駅は線路に隣接すると効果大。</li>
      <li>毎月、人口に応じて税収が入り、施設の維持費がかかります。</li>
      <li>3分経過で終了。最終人口がスコアです。</li>
    </ul>
  `

  return (
    <>
      <header className="topbar">
        <div className="metric">
          <span className="label">PEOPLE</span>
          <span>{Math.floor(people)}人</span>
        </div>
        <div className="metric">
          <span className="label">DATE</span>
          <span>
            {year}年 {month}月
          </span>
        </div>
        <div className={`metric ${money < 0 ? 'neg' : ''}`}>
          <span className="label">MONEY</span>
          <span>{money}万円</span>
        </div>
        <div className="metric">
          <span className="label">DEMAND</span>
          <span>{demand}</span>
        </div>
        <div className="metric">
          <span className="label">CAPACITY</span>
          <span>{capacity}</span>
        </div>
        <div className="actions">
          <button className="btn" onClick={start}>
            スタート
          </button>
          <button className="btn" onClick={reset}>
            リセット
          </button>
          <button
            className="btn"
            onClick={() => setModal({ open: true, title: '遊び方', body: HELP_HTML })}
          >
            遊び方
          </button>
        </div>
      </header>

      {guideMsg && <div className="guidebar">{guideMsg}</div>}

      <main className="layout">
        <section
          className="board"
          aria-label="マップ 10x10"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE},1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE},1fr)`,
          }}
        >
          {grid.map((row, y) =>
            row.map((t, x) => (
              <div
                key={`${x}-${y}`}
                className={`cell ${TileClass[t]}`}
                onClick={() => handlePlace(x, y)}
              >
                {TileIcons[t]}
              </div>
            ))
          )}
        </section>
        <aside className="sidebar">
          <h2>施設</h2>
          <ul className="tools">
            {ToolDefs.map(def => (
              <li className="tool" key={def.id}>
                <div className="info">
                  <div className="icon">{def.icon}</div>
                  <div className="name">{def.name}</div>
                  <div className="meta">{def.cost}万円</div>
                </div>
                <button
                  className={`select ${tool === def.id ? 'active' : ''}`}
                  onClick={() => {
                    setTool(def.id)
                    const maint = def.maint ?? 0
                    setTip(`${def.name}：${def.desc}（${def.cost}万円）\n維持費：${maint}万円/月`)
                  }}
                >
                  選択
                </button>
              </li>
            ))}
          </ul>
          <div className="tip">{tip}</div>
        </aside>
      </main>

      <footer className="bottombar">{statusMsg}</footer>

      <div
        className={`overlay ${modal.open ? '' : 'hidden'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog">
          <h2>{modal.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: modal.body }} />
          <div className="dialog-actions">
            <button
              className="btn"
              onClick={() => setModal({ open: false, title: '', body: '' })}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
