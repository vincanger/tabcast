import { useEffect, useRef, useState } from "react";
import { getSchedule, updateSchedule, useQuery } from "wasp/client/operations";
import { Button } from "./ui/button";

// One line under the generate row. Collapsed it is a link or a summary;
// clicking opens the schedule as a sentence with inline selects, and Save
// closes it again. Episode length comes from the panel's slider.
type Form = {
  everyDays: number;
  localSlot: number; // 0..47, half hours since local midnight
  minArticles: number;
};

const DEFAULTS: Form = { everyDays: 1, localSlot: slotFromUtc(7, 0), minArticles: 3 };

export function ScheduleToggle({ minutes, fullRead }: { minutes: number; fullRead: boolean }) {
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
      setError(e instanceof Error ? e.message : "Could not save the schedule.");
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

  // Keep the saved length in step with the slider while the schedule is on,
  // so the summary never says one thing and the job does another.
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

  if (isLoading) return null;

  if (!editing) {
    return (
      <p className="kicker mt-4">
        {enabled ? (
          <>
            Checks {schedule!.everyDays === 7 ? "weekly" : "daily"} at {slotLabel(form.localSlot)} ·{" "}
            {schedule!.mode === "full" ? "in full" : `${schedule!.targetMinutes} min`} ·{" "}
            {schedule!.minArticles}+ article
            {schedule!.minArticles === 1 ? "" : "s"}
            {schedule!.nextRunAt && <> · next {formatLocal(schedule!.nextRunAt)}</>}
            {" · "}
            <button type="button" onClick={() => setEditing(true)} className="py-1 hover:text-rubric">
              Edit
            </button>
            {" · "}
            <button type="button" onClick={turnOff} disabled={busy} className="py-1 hover:text-rubric">
              Turn off
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="py-1 hover:text-rubric">
            Set a schedule →
          </button>
        )}
        {error && <span className="text-destructive"> {error}</span>}
      </p>
    );
  }

  return (
    <div className="mt-6 border-t pt-4">
      <p className="font-serif text-lg leading-relaxed">
        Check{" "}
        <InlineSelect label="How often" value={form.everyDays} onChange={(v) => setForm({ ...form, everyDays: v })}>
          <option value={1}>every day</option>
          <option value={7}>every week</option>
        </InlineSelect>{" "}
        at{" "}
        <InlineSelect label="Time of day" value={form.localSlot} onChange={(v) => setForm({ ...form, localSlot: v })}>
          {Array.from({ length: 48 }, (_, slot) => (
            <option key={slot} value={slot}>
              {slotLabel(slot)}
            </option>
          ))}
        </InlineSelect>{" "}
        and {fullRead ? "read them in full" : `generate a ${minutes} minute episode`} if there are at least{" "}
        <InlineSelect label="Minimum articles" value={form.minArticles} onChange={(v) => setForm({ ...form, minArticles: v })}>
          {Array.from({ length: 20 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </InlineSelect>{" "}
        article{form.minArticles === 1 ? "" : "s"}.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <Button size="sm" onClick={save} disabled={busy} className="kicker text-primary-foreground">
          {busy ? "Saving…" : "Save"}
        </Button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="kicker py-1 hover:text-rubric"
        >
          Cancel
        </button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}

// A native select dressed as an underlined word in the sentence. The browser
// still supplies the dropdown, so it works with keyboard and screen readers.
function InlineSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="cursor-pointer appearance-none border-0 border-b border-input bg-transparent px-0 py-0 font-serif text-lg text-foreground transition hover:border-rubric hover:text-rubric focus:border-rubric focus:outline-none"
    >
      {children}
    </select>
  );
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
