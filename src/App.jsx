import React, { useEffect, useMemo, useState } from 'react'

const GRID_SIZE = 10
const TICK_MS = 250
const SEC_PER_MONTH = 1
const GAME_SECONDS = 180

const Tools = {
  BULLDOZE: 'bulldoze',
  PARK: 'park',
  RAIL: 'rail',
  STATION: 'station',
  HOUSE: 'house',
  APT: 'apt',
}

const ToolDefs = [
  { id: Tools.BULLDOZE, name: '取り壊し', icon: '🧹', cost: 0, desc: '施設を撤去' },
  { id: Tools.RAIL, name: '線路', icon: '🛤️', cost: 60, desc: '需要 +少' },
  { id: Tools.STATION, name: '駅', icon: '🚉', cost: 400, desc: '需要 大（線路隣接）' },
  { id: Tools.PARK, name: '公園', icon: '🌳', cost: 40, desc: '需要 +中' },
  { id: Tools.HOUSE, name: '住宅', icon: '🏠', cost: 100, desc: '収容 +20' },
  { id: Tools.APT, name: 'マンション', icon: '🏢', cost: 1200, desc: '収容 +200' },
]

const Tile = {
  EMPTY: 'empty',
  PARK: 'park',
  RAIL: 'rail',
  STATION: 'station',
  HOUSE: 'house',
  APT: 'apt',
}

const TileIcons = {
  [Tile.EMPTY]: '',
  [Tile.PARK]: '🌳',
  [Tile.RAIL]: '🛤️',
  [Tile.STATION]: '🚉',
  [Tile.HOUSE]: '🏠',
  [Tile.APT]: '🏢',
}

const TileClass = {
  [Tile.EMPTY]: 't-empty',
  [Tile.PARK]: 't-park',
  [Tile.RAIL]: 't-rail',
  [Tile.STATION]: 't-station',
  [Tile.HOUSE]: 't-house',
  [Tile.APT]: 't-apt',
}

function make2D(w, h, fill) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill))
}

function neighbors4(x, y) {
  return [
    [x+1, y], [x-1, y], [x, y+1], [x, y-1]
  ].filter(([cx, cy]) => cx>=0 && cx<GRID_SIZE && cy>=0 && cy<GRID_SIZE)
}

function stationConnectedToRail(grid, x, y) {
  for (const [nx, ny] of neighbors4(x, y)) {
    if (grid[ny][nx] === Tile.RAIL) return true
  }
  return false
}

function countTiles(grid) {
  const counts = { empty:0, park:0, rail:0, station:0, connectedStation:0, house:0, apt:0 }
  for (let y=0;y<GRID_SIZE;y++){
    for (let x=0;x<GRID_SIZE;x++){
      const t = grid[y][x]
      counts[t]++
      if (t === Tile.STATION && stationConnectedToRail(grid, x, y)) counts.connectedStation++
    }
  }
  return counts
}

function calcStats(grid, people) {
  const c = countTiles(grid)
  const capacity = c.house*20 + c.apt*200
  const base = 10
  const demand = Math.floor(base + c.park*6 + c.rail*2 + c.connectedStation*80 + (c.station - c.connectedStation)*8)
  return { capacity, demand, counts: c }
}

function monthlyIncome(grid, people) {
  const c = countTiles(grid)
  const maintenance = Math.floor(c.rail*1 + c.station*4 + c.park*1)
  const tax = Math.floor(people * 1)
  return tax - maintenance
}

function App() {
  const [grid, setGrid] = useState(() => make2D(GRID_SIZE, GRID_SIZE, Tile.EMPTY))
  const [money, setMoney] = useState(3000)
  const [people, setPeople] = useState(10)
  const [{capacity, demand}, setStats] = useState(() => calcStats(grid, 10))
  const [tool, setTool] = useState(Tools.HOUSE)
  const [started, setStarted] = useState(false)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [monthClock, setMonthClock] = useState(0)
  const [year, setYear] = useState(2025)
  const [month, setMonth] = useState(4)
  const [statusMsg, setStatusMsg] = useState('')
  const [tip, setTip] = useState('ツールを選んでマスをクリック')
  const [modal, setModal] = useState({ open:false, title:'', body:'' })

  // recompute stats when grid or people changes
  useEffect(() => {
    setStats(calcStats(grid, people))
  }, [grid, people])

  // game tick
  useEffect(() => {
    if (!started) return
    const id = setInterval(() => {
      setSecondsElapsed(s => s + TICK_MS/1000)
      setMonthClock(c => c + TICK_MS/1000)
      // growth
      setPeople(p => {
        const capGap = Math.max(0, capacity - p)
        const demandGap = Math.max(0, demand - Math.floor(p/5))
        const potential = Math.min(capGap, demandGap)
        const rate = 0.35
        const delta = potential * rate * (TICK_MS/1000)
        let np = p
        if (delta > 0) np = Math.min(capacity, p + delta)
        if (np > capacity) np = np - Math.min(2*(TICK_MS/1000), np - capacity)
        return np
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [started, capacity, demand])

  // month advance
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
      setStatusMsg(`${year}年${(month%12)+1}月の収支：${inc}万円`)
    }
  }, [monthClock, started])

  // game end
  useEffect(() => {
    if (!started) return
    if (secondsElapsed >= GAME_SECONDS) {
      setStarted(false)
      const score = Math.floor(people)
      setModal({
        open:true,
        title:'3分終了',
        body:`<p>おつかれさま！</p>
              <p>最終人口：<b>${score}人</b></p>
              <p>資金：<b>${money}万円</b></p>
              <p>需要：<b>${demand}</b> / 収容：<b>${capacity}</b></p>
              <p style="color:#9ca3af">ヒント：線路＋駅で需要↑、住宅/マンションで収容↑。</p>`
      })
    }
  }, [secondsElapsed, started, people, money, demand, capacity])

  const canAfford = (cost) => money >= cost

  function handlePlace(x, y) {
    setGrid(prev => {
      const current = prev[y][x]
      const def = ToolDefs.find(d => d.id === tool)
      if (!def) return prev
      if (tool === Tools.BULLDOZE) {
        if (current === Tile.EMPTY) return prev
        const ng = prev.map(row => row.slice())
        ng[y][x] = Tile.EMPTY
        setTip('更地にしました')
        return ng
      }
      if (current !== Tile.EMPTY) { setTip('ここには建てられません'); return prev }
      const ng = prev.map(row => row.slice())
      switch (tool) {
        case Tools.RAIL: ng[y][x] = Tile.RAIL; break
        case Tools.STATION: ng[y][x] = Tile.STATION; break
        case Tools.PARK: ng[y][x] = Tile.PARK; break
        case Tools.HOUSE: ng[y][x] = Tile.HOUSE; break
        case Tools.APT: ng[y][x] = Tile.APT; break
        default: return prev
      }
      if (!canAfford(def.cost)) {
        const lack = def.cost - money
        setTip(`不足分を借入れ（${lack}万円）`)
      } else {
        setTip(`${def.name}を設置（${def.cost}万円）`)
      }
      setMoney(m => m - def.cost)
      return ng
    })
  }

  function start() {
    if (started) return
    setStarted(true)
    setTip('ゲーム開始！3分で人口を伸ばそう')
  }
  function reset() {
    setGrid(make2D(GRID_SIZE, GRID_SIZE, Tile.EMPTY))
    setMoney(3000)
    setPeople(10)
    setStats(calcStats(make2D(GRID_SIZE, GRID_SIZE, Tile.EMPTY), 10))
    setTool(Tools.HOUSE)
    setStarted(false)
    setSecondsElapsed(0)
    setMonthClock(0)
    setYear(2025)
    setMonth(4)
    setStatusMsg('')
    setTip('ツールを選んでマスをクリック')
    setModal({ open:false, title:'', body:'' })
  }

  const HELP_HTML = `
    <p>3分間で人口をできるだけ増やすゲームです。</p>
    <ul>
      <li>住宅（20人）やマンション（200人）で<b>収容</b>を増やします。</li>
      <li>線路と駅を組み合わせると<b>需要</b>が大きく伸びます。駅は線路に隣接すると効果大。</li>
      <li>公園も需要を少し伸ばします。</li>
      <li>毎月、人口に応じて税収が入り、施設の維持費がかかります。</li>
      <li>3分経過で終了。最終人口がスコアです。</li>
    </ul>
  `

  return (
    <>
      <header className="topbar">
        <div className="metric"><span className="label">PEOPLE</span><span>{Math.floor(people)}人</span></div>
        <div className="metric"><span className="label">DATE</span><span>{year}年 {month}月</span></div>
        <div className={`metric ${money<0?'neg':''}`}><span className="label">MONEY</span><span>{money}万円</span></div>
        <div className="metric"><span className="label">DEMAND</span><span>{demand}</span></div>
        <div className="metric"><span className="label">CAPACITY</span><span>{capacity}</span></div>
        <div className="actions">
          <button className="btn" onClick={start}>スタート</button>
          <button className="btn" onClick={reset}>リセット</button>
          <button className="btn" onClick={() => setModal({ open:true, title:'遊び方', body: HELP_HTML })}>遊び方</button>
        </div>
      </header>

      <main className="layout">
        <section className="board" aria-label="マップ 10x10" style={{gridTemplateColumns:`repeat(${GRID_SIZE},1fr)`,gridTemplateRows:`repeat(${GRID_SIZE},1fr)`}}>
          {grid.map((row, y) => row.map((t, x) => (
            <div key={`${x}-${y}`} className={`cell ${TileClass[t]}`} onClick={()=>handlePlace(x,y)}>{TileIcons[t]}</div>
          )))}
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
                <button className={`select ${tool===def.id?'active':''}`} onClick={()=>{setTool(def.id); setTip(`${def.name}：${def.desc}（${def.cost}万円）`)}}>選択</button>
              </li>
            ))}
          </ul>
          <div className="tip">{tip}</div>
        </aside>
      </main>

      <footer className="bottombar">{statusMsg}</footer>

      <div className={`overlay ${modal.open?'':'hidden'}`} role="dialog" aria-modal="true">
        <div className="dialog">
          <h2>{modal.title}</h2>
          <div dangerouslySetInnerHTML={{ __html: modal.body }} />
          <div className="dialog-actions">
            <button className="btn" onClick={()=>setModal({open:false,title:'',body:''})}>閉じる</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
