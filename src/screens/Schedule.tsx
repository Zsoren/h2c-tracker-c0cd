import { useEffect, useRef } from 'react'
import { LEGS, runnerShort, type Snapshot } from '../state/store'
import { useNow } from '../state/hooks'
import { go } from '../state/router'
import { fmtClock, fmtTimeRel, localMinutes } from '../model/time'
import { difficultyLabel } from '../model/helpers'
import { gearLabel } from '../model/projection'

export function Schedule({ snap }: { snap: Snapshot }) {
  const now = useNow(30000)
  const { proj } = snap
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.item.current')
    el?.scrollIntoView({ block: 'center' })
  }, [])
  const sunrise = 6 * 60 + 25, sunset = 19 * 60 + 55
  return (
    <div className="page" ref={ref}>
      <h1 className="title">Schedule</h1>
      <div className="muted small" style={{ marginBottom: 10 }}>
        <span className="dotk actual" /> entered · <span className="dotk" /> projected · <span className="dotk est" /> estimated · Finish <b>{fmtTimeRel(proj.finish, now)}</b>
      </div>
      <div className="list">
        {proj.legs.map((lp, i) => {
          const leg = LEGS[i]
          const prev = i > 0 ? proj.legs[i - 1] : null
          const m0 = prev ? localMinutes(prev.end) : -1, m1 = localMinutes(lp.end)
          const crosses = (mark: number) => prev != null && ((m0 < mark && m1 >= mark) || (m0 > m1 && (m1 >= mark || m0 < mark)))
          const isCur = proj.phase === 'racing' && proj.currentLeg === lp.n
          const done = lp.endKind !== 'projected' && lp.n < proj.currentLeg
          return (
            <div key={lp.n}>
              {crosses(sunrise) && <div className="sunmark">☀︎ sunrise ~6:25 AM</div>}
              {crosses(sunset) && <div className="sunmark">☾ sunset ~7:55 PM</div>}
              <button className={'item' + (isCur ? ' current' : '') + (done ? ' done' : '')} onClick={() => go(`leg/${lp.n}`)}>
                <div className="n">{lp.n}</div>
                <div>
                  <div className="t">{runnerShort(lp.runnerId)} · {leg.miles} mi · {difficultyLabel(leg.difficulty)}</div>
                  <div className="s">
                    <span className={'badge gear' + (lp.gear === 'NIGHT' ? ' night' : '')}>{gearLabel(lp.gear)}</span>
                    {leg.majorExchange && <span className="badge">MAJOR EXCH {lp.n}</span>}
                    {leg.vanSupport === 'no' && <span className="badge">NO VAN</span>}
                    {leg.notes.map(x => <span key={x} className="badge">{x.replace('Little/No Shade', 'NO SHADE').replace(' (Poss Dust)', '').toUpperCase()}</span>)}
                  </div>
                </div>
                <div className="r">
                  <div><span className={'dotk ' + lp.startKind} />{fmtClock(lp.start)}{lp.startKind === 'est' ? <span className="s"> est.</span> : null}</div>
                  <div><span className={'dotk ' + lp.endKind} />{fmtClock(lp.end)}{lp.endKind === 'est' ? <span className="s"> est.</span> : null}</div>
                  <div className="s">leave {lp.leaveBy === 'now' ? 'now' : fmtClock(lp.leaveBy as number)}</div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
