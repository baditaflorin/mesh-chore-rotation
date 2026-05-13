import { useEffect, useState } from "react";
import type { MeshConfig, YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Named = { id: string; label: string };

const newId = () => Math.random().toString(36).slice(2, 10);

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function weekDate(year: number, week: number): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay() || 7;
  simple.setUTCDate(simple.getUTCDate() - dow + 1);
  return simple;
}

export function Feature({ room }: Props) {
  if (!room) {
    return (
      <div className="rot-screen">
        <h1>chore rotation</h1>
        <p className="rot-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} />;
}

function Body({ room }: { room: YRoom }) {
  const [newPersonLabel, setNewPersonLabel] = useState("");
  const [newChoreLabel, setNewChoreLabel] = useState("");
  const today = new Date();
  const todayWeek = isoWeek(today);
  const [viewYear, setViewYear] = useState(todayWeek.year);
  const [viewWeek, setViewWeek] = useState(todayWeek.week);
  const [tick, rerender] = useState(0);

  useEffect(() => {
    const people = room.doc.getArray<Named>("people");
    const chores = room.doc.getArray<Named>("chores");
    const onChange = () => rerender((n) => n + 1);
    people.observe(onChange);
    chores.observe(onChange);
    return () => {
      people.unobserve(onChange);
      chores.unobserve(onChange);
    };
  }, [room]);

  const people = room.doc.getArray<Named>("people");
  const chores = room.doc.getArray<Named>("chores");
  void tick;

  const peopleArr = people.toArray();
  const choresArr = chores.toArray();

  const seed = (viewYear * 53 + viewWeek) ^ peopleArr.length;
  const rng = mulberry32(seed);
  const shuffledChores = shuffle(choresArr, rng);
  const assignments = shuffledChores.map((c, i) => ({
    chore: c,
    person: peopleArr.length > 0 ? peopleArr[i % peopleArr.length] : null,
  }));

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    const t = newPersonLabel.trim();
    if (!t) return;
    people.push([{ id: newId(), label: t }]);
    setNewPersonLabel("");
  };

  const addChore = (e: React.FormEvent) => {
    e.preventDefault();
    const t = newChoreLabel.trim();
    if (!t) return;
    chores.push([{ id: newId(), label: t }]);
    setNewChoreLabel("");
  };

  const removePerson = (id: string) => {
    const arr = people.toArray();
    const idx = arr.findIndex((p) => p.id === id);
    if (idx >= 0) people.delete(idx, 1);
  };

  const removeChore = (id: string) => {
    const arr = chores.toArray();
    const idx = arr.findIndex((c) => c.id === id);
    if (idx >= 0) chores.delete(idx, 1);
  };

  const stepWeek = (dir: -1 | 1) => {
    const cur = weekDate(viewYear, viewWeek);
    cur.setUTCDate(cur.getUTCDate() + dir * 7);
    const w = isoWeek(cur);
    setViewYear(w.year);
    setViewWeek(w.week);
  };

  const resetWeek = () => {
    setViewYear(todayWeek.year);
    setViewWeek(todayWeek.week);
  };

  const isCurrent = viewYear === todayWeek.year && viewWeek === todayWeek.week;
  const weekStart = weekDate(viewYear, viewWeek);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  return (
    <div className="rot-screen">
      <header className="rot-header">
        <h1>chore rotation</h1>
        <p className="rot-status">
          {choresArr.length} {choresArr.length === 1 ? "chore" : "chores"} · {peopleArr.length}{" "}
          {peopleArr.length === 1 ? "person" : "people"} · {room.peerCount + 1} present
        </p>
      </header>

      <div className="rot-week">
        <button type="button" onClick={() => stepWeek(-1)} aria-label="previous week">
          ‹
        </button>
        <div className="rot-week-label">
          <strong>
            {viewYear} · week {viewWeek}
          </strong>
          <span>starts {weekStartStr}</span>
        </div>
        <button type="button" onClick={() => stepWeek(1)} aria-label="next week">
          ›
        </button>
        {!isCurrent && (
          <button type="button" className="rot-today" onClick={resetWeek}>
            today
          </button>
        )}
      </div>

      <section className="rot-assignments">
        <h2 className="rot-section-title">this week's assignments</h2>
        {peopleArr.length === 0 || choresArr.length === 0 ? (
          <p className="rot-empty">add at least one person and one chore to see assignments</p>
        ) : (
          <ul className="rot-list">
            {assignments.map(({ chore, person }) => (
              <li key={chore.id} className="rot-assign">
                <span className="rot-chore">{chore.label}</span>
                <span className="rot-arrow">→</span>
                <span className="rot-person">{person?.label ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rot-edit">
        <div className="rot-col">
          <h3>people</h3>
          <ul className="rot-tags">
            {peopleArr.map((p) => (
              <li key={p.id}>
                {p.label}
                <button
                  type="button"
                  onClick={() => removePerson(p.id)}
                  aria-label={`remove ${p.label}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addPerson}>
            <input
              value={newPersonLabel}
              onChange={(e) => setNewPersonLabel(e.target.value)}
              placeholder="add person"
              maxLength={48}
            />
            <button type="submit" disabled={!newPersonLabel.trim()}>
              +
            </button>
          </form>
        </div>

        <div className="rot-col">
          <h3>chores</h3>
          <ul className="rot-tags">
            {choresArr.map((c) => (
              <li key={c.id}>
                {c.label}
                <button
                  type="button"
                  onClick={() => removeChore(c.id)}
                  aria-label={`remove ${c.label}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addChore}>
            <input
              value={newChoreLabel}
              onChange={(e) => setNewChoreLabel(e.target.value)}
              placeholder="add chore"
              maxLength={80}
            />
            <button type="submit" disabled={!newChoreLabel.trim()}>
              +
            </button>
          </form>
        </div>
      </section>

      <p className="rot-fineprint">
        deterministic shuffle — every peer in the room sees identical assignments for a given week.
      </p>
    </div>
  );
}
