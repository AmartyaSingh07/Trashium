"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { OPERATIONAL_SECTORS, resolveHubSectors } from "@/lib/constants";

type Crew = {
  id: string;
  full_name: string | null;
  email: string | null;
  operating_zone: string | null;
};

const inputCls =
  "bg-linen/60 border border-sand/55 rounded-lg text-[11px] p-1.5 text-bark cursor-pointer focus:outline-none focus:border-terra";

export default function CrewHubAssignment() {
  const supabase = createClient();
  const [crew, setCrew] = useState<Crew[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email, operating_zone")
      .in("role", ["crew", "collector"])
      .then(({ data, error }) => {
        if (error) return toast.error("Failed to load crew.");
        setCrew((data as Crew[]) ?? []);
      });
  }, [supabase]);

  const setZone = async (member: Crew, zone: string) => {
    setSaving(member.id);
    const { data, error } = await supabase.rpc("set_crew_zone", {
      p_user_id: member.id,
      p_zone: zone,
    });
    setSaving(null);
    if (error || !(data as { ok?: boolean })?.ok) {
      return toast.error("Failed to set zone.");
    }
    setCrew((prev) => prev.map((c) => (c.id === member.id ? { ...c, operating_zone: zone } : c)));
    toast.success("Zone updated.");
  };

  return (
    <div className="w-full max-w-7xl mx-auto mb-10">
      <div className="t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.15)]">
        <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" /> Crew Hub Assignment
        </h2>
        <div className="rounded-xl border border-sand/25 overflow-x-auto">
          <table className="border-collapse w-full text-xs">
            <thead>
              <tr className="bg-[#EDE5D8]/50 border-b border-[#D4C5B0] text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
                <th className="py-2.5 px-3 text-left">Crew</th>
                <th className="py-2.5 px-3 text-left">Zone</th>
                <th className="py-2.5 px-3 text-left">Visible Sectors</th>
              </tr>
            </thead>
            <tbody>
              {crew.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-smoke italic">
                    No crew members yet.
                  </td>
                </tr>
              ) : (
                crew.map((m) => {
                  const visible = resolveHubSectors(m.operating_zone);
                  const shared = visible.length > 1;
                  return (
                    <tr key={m.id} className="border-b border-sand/15 text-[#6B5744]">
                      <td className="py-2 px-3 font-semibold text-bark">
                        {m.full_name || m.email || m.id.substring(0, 8)}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={m.operating_zone ?? ""}
                          disabled={saving === m.id}
                          onChange={(e) => setZone(m, e.target.value)}
                          className={inputCls}
                        >
                          <option value="" disabled>
                            Unassigned
                          </option>
                          {OPERATIONAL_SECTORS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[11px]">{visible.join(", ")}</span>
                        {shared && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Shared Fleet
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
