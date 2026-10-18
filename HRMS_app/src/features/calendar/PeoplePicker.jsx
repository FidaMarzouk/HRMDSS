import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "../../components/ui/avatar";
import { Input } from "../../components/ui/field";

/** Search and tick people to invite. value: array of user ids. */
export function PeoplePicker({ people, value, onChange, excludeId }) {
  const [q, setQ] = useState("");
  const selected = new Set(value.map(String));
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return people
      .filter((p) => String(p._id) !== String(excludeId))
      .filter((p) => !term || `${p.firstName} ${p.lastName} ${p.departmentId?.name || ""} ${p.position || ""}`.toLowerCase().includes(term))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [people, q, excludeId]);
  const byId = new Map(people.map((p) => [String(p._id), p]));
  const toggle = (id) => onChange(selected.has(id) ? value.filter((v) => String(v) !== id) : [...value, id]);

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Invited">
          {value.map((id) => {
            const p = byId.get(String(id));
            return (
              <li key={id} className="inline-flex items-center gap-1 rounded-full border border-line-2 bg-panel py-0.5 pl-2 pr-1 text-[12px]">
                {p ? `${p.firstName} ${p.lastName}` : "Former employee"}
                <button type="button" onClick={() => toggle(String(id))} aria-label={`Remove ${p ? p.firstName : "person"}`} className="grid h-5 w-5 place-items-center rounded-full text-ink-3 hover:bg-sunk hover:text-ink">
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, department or position" aria-label="Search people to invite" />
      <ul className="max-h-48 overflow-y-auto rounded-lg border border-line">
        {list.map((p) => {
          const id = String(p._id);
          return (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-2.5 px-2.5 py-1.5 hover:bg-sunk">
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} className="h-4 w-4 accent-[rgb(var(--teal))]" />
                <Avatar user={p} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{p.firstName} {p.lastName}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">{[p.position, p.departmentId?.name].filter(Boolean).join(" · ")}</span>
                </span>
              </label>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-3 py-3 text-[12.5px] text-ink-3">No one matches “{q}”.</li>}
      </ul>
    </div>
  );
}
