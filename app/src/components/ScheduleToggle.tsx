import { useEffect, useRef, useState } from "react";
import { getSchedule, updateSchedule, useQuery } from "wasp/client/operations";
import { InlineSelect } from "./InlineSelect";

// The schedule lives inside the generate sentence as a trailing clause:
// "…, and check again every day at 07:30 if at least 3 articles are waiting."
// Reading, the values are underlined words and the actions beside the button
// are Edit and Turn off (or "Set a schedule →" when off). Editing swaps each
// value for an inline select and the actions become Save and Cancel. Nothing
// moves but the words, so the sentence never jumps between states.
type Form = {
  everyDays: number;
  localSlot: number; // 0..47, half hours since local midnight
  minArticles: number;
};

const DEFAULTS: Form = { everyDays: 1, localSlot: slotFromUtc(7, 0), minArticles: 3 };

const actionClass =
  "kicker py-1 underline decoration-border underline-offset-4 hover:text-rubric disabled:opacity-50";

export function useScheduleSentence({ minutes, fullRead }: { minutes: number; fullRead: boolean }) {
  const { data: schedule, isLoading } = useQuery(getSchedule);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = schedule?.enabled ?? false;

  useEffect(() => {
    if (!schedule) return;
    setForm({
      everyDays: schedule.everyDays,
      localSlot: slotFromUtc(schedule.hourUtc, schedule.minuteUtc),
      minArticles: schedule.minArticles,
    });
  }, [schedule]);

  async function persist(next: Form, on: boolean): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const { hourUtc, minuteUtc } = utcFromSlot(next.localSlot);
      await updateSchedule({
        enabled: on,
        everyDays: next.everyDays,
        hourUtc,
        minuteUtc,
        minArticles: next.minArticles,
        mode: fullRead ? "full" : "summary",
        targetMinutes: minutes,
      });
      return true;
    } catch (e) {
      setError("Unable to save the schedule. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (await persist(form, true)) setEditing(false);
  }

  async function turnOff() {
    if (await persist(form, false)) setEditing(false);
  }

  // Keep the saved length in step with the sentence while the schedule is on,
  // so the clause never says one thing and the job does another.
  const debounce = useRef<number | undefined>(undefined);
  useEffect(() => {
    const unchanged = fullRead
      ? schedule?.mode === "full"
      : schedule?.mode === "summary" && schedule?.targetMinutes === minutes;
    if (!enabled || unchanged) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void persist(form, true), 500);
    return () => window.clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, fullRead, enabled]);

  if (isLoading) return { clause: null, actions: null, error: null };

  const plural = form.minArticles === 1 ? "" : "s";

  const clause = editing ? (
    <>
      , and check again{" "}
      <InlineSelect label="How often" value={form.everyDays} onChange={(v) => setForm({ ...form, everyDays: Number(v) })}>
        <option value={1}>every day</option>
        <option value={7}>every week</option>
      </InlineSelect>{" "}
      at{" "}
      <InlineSelect label="Time of day" value={form.localSlot} onChange={(v) => setForm({ ...form, localSlot: Number(v) })}>
        {Array.from({ length: 48 }, (_, slot) => (
          <option key={slot} value={slot}>
            {slotLabel(slot)}
          </option>
        ))}
      </InlineSelect>{" "}
      if at least{" "}
      <InlineSelect label="Minimum articles" value={form.minArticles} onChange={(v) => setForm({ ...form, minArticles: Number(v) })}>
        {Array.from({ length: 20 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </InlineSelect>{" "}
      article{plural} {form.minArticles === 1 ? "is" : "are"} waiting
    </>
  ) : enabled ? (
    <>
      , and check again <Word>{schedule!.everyDays === 7 ? "every week" : "every day"}</Word> at{" "}
      <Word>{slotLabel(form.localSlot)}</Word> if at least{" "}
      <Word>
        {schedule!.minArticles} article{schedule!.minArticles === 1 ? "" : "s"}
      </Word>{" "}
      {schedule!.minArticles === 1 ? "is" : "are"} waiting
    </>
  ) : null;

  const actions = editing ? (
    <>
      <button type="button" onClick={save} disabled={busy} className={actionClass}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} disabled={busy} className={actionClass}>
        Cancel
      </button>
    </>
  ) : enabled ? (
    <>
      <button type="button" onClick={() => setEditing(true)} className={actionClass}>
        Edit
      </button>
      <button type="button" onClick={turnOff} disabled={busy} className={actionClass}>
        Turn off
      </button>
      {schedule!.nextRunAt && <span className="kicker">Next {formatLocal(schedule!.nextRunAt)}</span>}
    </>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className={actionClass}>
      Set a schedule →
    </button>
  );

  return { clause, actions, error };
}

// A saved value shown as prose: underlined in the accent, like the select it
// becomes when editing, so the word keeps its place and its width.
function Word({ children }: { children: React.ReactNode }) {
  return <span className="underline decoration-rubric decoration-1 underline-offset-[6px]">{children}</span>;
}

// Half hour slots since local midnight <-> UTC hour and minute. Going through
// a Date lets the browser apply the user's offset, exact for half hour zones.
function slotFromUtc(hourUtc: number, minuteUtc: number): number {
  const d = new Date();
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return d.getHours() * 2 + (d.getMinutes() >= 30 ? 1 : 0);
}

function utcFromSlot(slot: number): { hourUtc: number; minuteUtc: number } {
  const d = new Date();
  d.setHours(Math.floor(slot / 2), (slot % 2) * 30, 0, 0);
  return { hourUtc: d.getUTCHours(), minuteUtc: d.getUTCMinutes() >= 30 ? 30 : 0 };
}

function slotLabel(slot: number): string {
  return `${Math.floor(slot / 2).toString().padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
}

function formatLocal(date: Date | string): string {
  return new Date(date).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}
