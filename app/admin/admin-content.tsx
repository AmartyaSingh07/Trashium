"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ClipboardList,
  Clock,
  CheckCircle,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import MarketplaceAdmin from "@/components/admin/marketplace-admin";
import CrewHubAssignment from "@/components/admin/crew-hub-assignment";
import PayoutOverride from "@/components/admin/payout-override";
import PriceGrid from "@/components/admin/price-grid";
import { Reveal } from "@/components/motion";
import { OPERATIONAL_SECTORS, PICKUP_PROOFS_BUCKET } from "@/lib/constants";
import type {
  PickupRequest,
  PriceEstimate,
  PickupStatus,
  MarketplaceItem,
  RedemptionOrder,
} from "@/lib/types";

const PICKUP_STATUSES: PickupStatus[] = ["pending", "accepted", "collected", "completed", "cancelled"];

// Proofs live in the PRIVATE pickup-proofs bucket — rendered via short-lived signed URLs
// (never a public URL). The read is authorized by the crew/admin storage.objects policy.
function ProofThumb({
  path,
  verified,
  distanceM,
}: {
  path: string;
  verified?: boolean | null;
  distanceM?: number | null;
}) {
  const [supabase] = useState(() => createClient());
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.storage
      .from(PICKUP_PROOFS_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [supabase, path]);

  const meters = Math.round(Number(distanceM ?? 0));
  const title =
    verified === true
      ? `Verified · ${meters} m from booked location`
      : verified === false
      ? `Flagged · ${meters} m from booked location`
      : "Proof captured (no booked coordinates to verify)";

  if (!url) return <span className="text-[10px] text-smoke">…</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 t-focus-ring rounded"
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Collection proof"
        className="h-9 w-9 rounded object-cover border border-sand/40"
      />
      {verified === true ? (
        <span className="text-[10px] font-mono font-bold text-sage-deep whitespace-nowrap">✓ {meters}m</span>
      ) : verified === false ? (
        <span className="text-[10px] font-mono font-bold text-destructive whitespace-nowrap">⚠ {meters}m</span>
      ) : (
        <span className="text-[10px] font-mono text-smoke">📷</span>
      )}
    </a>
  );
}

// Row shape from the PostgREST embed: '*, profiles!pickup_requests_user_id_fkey(full_name, email)'
type AdminPickup = PickupRequest & {
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

type AdminOrder = RedemptionOrder & {
  profiles?: { full_name: string | null; email: string | null } | null;
};

const normalizeSectorName = (zone: string) => {
  if (zone === 'Bally' || zone === 'Belur') return 'Howrah';
  return zone;
};

const getDisplayWeight = (weightNum: number | string) => {
  const num = typeof weightNum === 'string' ? parseFloat(weightNum) : weightNum;
  if (num === 7.5) return "5-10 kg";
  if (num === 12.5) return "10-15 kg";
  if (num === 17.5) return "15-20 kg";
  if (num === 25.0) return "20+ kg";
  return `${num} kg`; // Fallback for historical precise records
};

interface AdminContentProps {
  priceEstimates: PriceEstimate[];
  marketItems: MarketplaceItem[];
  orders: AdminOrder[];
  users: { id: string; full_name: string | null; email: string | null }[];
  badges: { id: string; title: string; unlock_type: string }[];
}

export default function AdminContent({
  priceEstimates,
  marketItems,
  orders,
  users,
  badges,
}: AdminContentProps) {
  const router = useRouter();
  const supabase = createClient();

  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const setRequests = (data: PickupRequest[]) => setPickups(data);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchFullFledgedData = async () => {
    const { data, error } = await supabase
      .from('pickup_requests')
      // Disambiguate the FK: pickup_requests now has TWO refs to profiles (user_id + override_by),
      // so PostgREST needs the explicit constraint name to embed the household profile.
      .select('*, profiles!pickup_requests_user_id_fkey(full_name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Error:", error.message);
      return;
    }

    const normalizedData = (data || []).map((p: AdminPickup) => ({
      ...p,
      location: normalizeSectorName(p.location)
    }));
    setRequests(normalizedData);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          if (profile) {
            setUserRole(profile.role);
          }
        }
        await fetchFullFledgedData();
      } catch (err) {
        console.error("Unexpected fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Real-time table subscription for live data bindings
  useEffect(() => {
    const channel = supabase
      .channel("admin_realtime_pickups")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pickup_requests" },
        () => {
          fetchFullFledgedData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Evaluates crew arrival metrics against user-selected time slots
  const isTimeDiscrepancy = (pickup: PickupRequest) => {
    if (!pickup.time_slot || (pickup.status !== "collected" && pickup.status !== "completed")) {
      return false;
    }
    try {
      // time_slot format is e.g. "08:00 AM - 09:00 AM" -> endTimeStr is "09:00 AM"
      const parts = pickup.time_slot.split("-");
      if (parts.length < 2) return false;
      const endTimeStr = parts[1].trim();
      
      const scheduledDate = new Date(pickup.scheduled_date);
      const dateString = scheduledDate.toISOString().split("T")[0];
      
      const [time, modifier] = endTimeStr.split(" ");
      const [hoursRaw, minutes] = time.split(":").map(Number);
      let hours = hoursRaw;
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
      
      const scheduledEnd = new Date(`${dateString}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
      const actualTime = new Date(pickup.updated_at);
      
      const diffMs = actualTime.getTime() - scheduledEnd.getTime();
      return diffMs > 30 * 60 * 1000; // 30 minutes threshold
    } catch (e) {
      return false;
    }
  };

  // Performance Audit Desk summary CSV exporter
  const handleExportSectorSummary = () => {
    const sectors = ["Rishra", "Howrah", "Shyamnagar", "Tarakeswar", "Hugli-Chinsura"];
    const headers = "Sector Zone,Total Pickups,Completed Pickups,Total Weight (kg),Discrepancy Count\n";
    
    const rows = sectors.map(sector => {
      const sectorPickups = pickups.filter(p => p.location === sector);
      const total = sectorPickups.length;
      const completed = sectorPickups.filter(p => p.status === "completed").length;
      const weight = sectorPickups.reduce((sum, p) => sum + Number(p.estimated_weight || 0), 0);
      const discrepancies = sectorPickups.filter(isTimeDiscrepancy).length;
      return `${sector},${total},${completed},${weight},${discrepancies}`;
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sector_Performance_Summary_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sector Performance Summary exported successfully!");
  };

  const handleStatusFilterChange = (value: string | null) => {
    if (value !== null) setStatusFilter(value);
  };

  // NOTE: the admin price estimator was dead code (hardcoded rates, never rendered). Removed.
  // The shared estimateQuote() contract (lib/estimate.ts) is the canonical estimator now.
  // TODO(admin-override): if admin needs a supervisory override estimator, build it on estimateQuote().

  const pendingCount = pickups.filter((p) => p.status === "pending").length;
  const todayCount = pickups.filter(
    (p) => p.scheduled_date === new Date().toISOString().split("T")[0]
  ).length;

  // --- Real aggregates (replace former hardcoded analytics; no fabricated numbers) ---
  const isDone = (s: string) => s === "completed";
  const isActive = (s: string) => s === "accepted" || s === "collected";
  const authoritativePayout = (p: PickupRequest) => Number(p.payout_override ?? p.estimated_price ?? 0);

  const totalPayoutCommitted = pickups.reduce((sum, p) => sum + authoritativePayout(p), 0);
  const distinctUsers = new Set(pickups.map((p) => p.user_id)).size;
  const avgPickupsPerUser = distinctUsers ? pickups.length / distinctUsers : 0;

  const sectorStats = OPERATIONAL_SECTORS.map((sector) => {
    const inSector = pickups.filter((p) => p.location === sector);
    return {
      sector,
      total: inSector.length,
      pending: inSector.filter((p) => p.status === "pending").length,
      active: inSector.filter((p) => isActive(p.status as string)).length,
      done: inSector.filter((p) => isDone(p.status as string)).length,
      kg: inSector
        .filter((p) => isDone(p.status as string))
        .reduce((s, p) => s + Number(p.estimated_weight || 0), 0),
    };
  });

  // Override saved → reflect new authoritative payout locally without a full refetch.
  const handleOverrideSaved = (id: string, override: number | null) => {
    setPickups((prev) =>
      prev.map((p) => (p.id === id ? { ...p, payout_override: override } : p))
    );
  };

  // Filter pickups
  const filtered = pickups.filter((p) => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const name = (p as AdminPickup).profiles?.full_name || p.full_name || "";
    const matchesSearch =
      !searchTerm ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.waste_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleStatusUpdate = async (selectedPickupId: string, newStatus: PickupStatus) => {
    const mappedStatusValue: string = newStatus; // canonical values already

    let error;
    if (mappedStatusValue === "cancelled") {
      const { error: cancelError } = await supabase
        .from('pickup_requests')
        .update({ status: 'cancelled' })
        .eq('id', selectedPickupId);
      error = cancelError;
    } else {
      const { error: normalError } = await supabase
        .from("pickup_requests")
        .update({ status: mappedStatusValue })
        .eq("id", selectedPickupId);
      error = normalError;
    }

    if (error) {
      console.error(
        "Database Update Failure Details:",
        error.message,
        error.hint,
        error.details
      );
      toast.error("Failed to update status");
    } else {
      toast.success(`Status updated to ${newStatus}`);
      
      // Update local client data state directly
      if (mappedStatusValue === "cancelled") {
        setPickups(prev => prev.map(p => p.id === selectedPickupId ? { ...p, status: 'cancelled' } : p));
      } else {
        setPickups(prev => prev.map(p => p.id === selectedPickupId ? { ...p, status: mappedStatusValue as PickupStatus } : p));
      }

      router.refresh();
      await fetchFullFledgedData();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-10 relative z-10 font-[family-name:var(--font-dm)]">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full">
        <div className="t-glass-card p-6 transition-all duration-300 hover:shadow-[var(--t-shadow-md)]">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-terra/10 text-terra">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold tracking-tight text-bark">{pickups.length}</p>
              <p className="t-label text-smoke mt-0.5">Total Requests</p>
            </div>
          </div>
        </div>
        <div className="t-glass-card p-6 transition-all duration-300 hover:shadow-[var(--t-shadow-md)]">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sand/20 text-clay">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold tracking-tight text-bark">{pendingCount}</p>
              <p className="t-label text-smoke mt-0.5">Pending</p>
            </div>
          </div>
        </div>
        <div className="t-glass-card p-6 transition-all duration-300 hover:shadow-[var(--t-shadow-md)]">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage/10 text-sage-deep">
              <CheckCircle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="font-[family-name:var(--font-jetbrains)] text-2xl font-bold tracking-tight text-bark">{todayCount}</p>
              <p className="t-label text-smoke mt-0.5">
                Today&apos;s Pickups
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Analytical Overview and Monitoring Desk Panel */}
      {userRole === "admin" && (
        <Reveal className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 w-full max-w-7xl mx-auto mb-10">
          {/* MOUNT THE ECOSYSTEM OVERVIEW DECK (Left Block) */}
          <div className="w-full t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.15)] backdrop-blur-md shadow-sm">
            <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-4">
              Ecosystem Overview Analysis
            </h2>
            
            {/* Performance Analytics Table */}
            <div className="mb-6">
              <h3 className="font-syne font-bold text-xs uppercase tracking-wider text-[#6B5744] mb-2">
                Performance Analytics Matrix
              </h3>
              <div className="rounded-xl border border-sand/25 overflow-x-auto">
                <table className="border-collapse w-full">
                  <thead>
                    <tr className="bg-[#EDE5D8]/50 border-b border-[#D4C5B0] text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
                      <th className="py-2.5 px-3 text-left">KPI Parameter</th>
                      <th className="py-2.5 px-3 text-left">Current Value</th>
                      <th className="py-2.5 px-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-linen/60 transition-colors duration-150 border-b border-sand/15 text-xs text-[#6B5744]">
                      <td className="py-2.5 px-3 font-semibold text-bark">
                        Total Payout Committed
                      </td>
                      <td className="py-2.5 px-3 font-medium text-clay font-mono">
                        ₹{totalPayoutCommitted.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-sage-deep font-semibold">
                        {pickups.length} requests
                      </td>
                    </tr>
                    <tr className="hover:bg-linen/60 transition-colors duration-150 border-b border-sand/15 text-xs text-[#6B5744]">
                      <td className="py-2.5 px-3 font-semibold text-bark">
                        Avg Pickups per Household
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-bark font-mono">
                        {avgPickupsPerUser.toFixed(1)} / user
                      </td>
                      <td className="py-2.5 px-3 text-sage-deep font-semibold">
                        {distinctUsers} households
                      </td>
                    </tr>
                    <tr className="hover:bg-linen/60 transition-colors duration-150 text-xs text-[#6B5744]">
                      <td className="py-2.5 px-3 font-semibold text-bark">
                        Pending Approval
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-bark font-mono">
                        {pendingCount} pending
                      </td>
                      <td className={`py-2.5 px-3 font-semibold ${pendingCount > 0 ? "text-terra" : "text-sage-deep"}`}>
                        {pendingCount > 0 ? "Needs review" : "Clear"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sector processing throughput */}
            <div className="border-t border-[rgba(194,112,61,0.12)] pt-5">
              <h3 className="font-syne font-bold text-xs uppercase tracking-wider text-[#6B5744] mb-3">
                Sector-wise Pipeline &amp; Processed Throughput
              </h3>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                {sectorStats.map((s) => (
                  <div key={s.sector} className="p-3 rounded-lg bg-white/50 border border-sand/20 text-xs">
                    <p className="text-[10px] text-smoke font-bold font-syne uppercase tracking-wider mb-1">
                      {s.sector}
                    </p>
                    <div className="flex flex-col gap-0.5 text-[#6B5744]">
                      <p className="text-[11px]">Processed: <span className="font-mono font-bold text-[#2A2218]">{s.kg.toFixed(0)} kg</span></p>
                      <p className="text-[11px] font-mono">
                        <span className="text-terra">{s.pending} pending</span>
                        {" · "}
                        <span className="text-clay">{s.active} active</span>
                        {" · "}
                        <span className="text-sage-deep">{s.done} done</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MOUNT THE REAL-TIME OPERATIONS MONITORING TERMINAL (Right Block) */}
          <div className="w-full t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.18)] backdrop-blur-md shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218]">
                Operations Live Monitoring Stream
              </h2>
              <button
                onClick={handleExportSectorSummary}
                className="bg-[#C2703D] hover:bg-[#A0522D] text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer border-0 flex items-center gap-1 shadow-sm t-focus-ring"
              >
                📥 Export Summary
              </button>
            </div>
            
            {/* Real-time pickup status stream table */}
            <div className="rounded-xl border border-sand/25 overflow-hidden bg-white/20 backdrop-blur-xs max-h-[360px] overflow-y-auto">
              <table className="border-collapse w-full">
                <thead className="sticky top-0 bg-[#EDE5D8] z-10">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-[#6B5744] border-b border-sand/25">
                    <th className="py-2.5 px-3 text-left">Request ID</th>
                    <th className="py-2.5 px-3 text-left">Sector Zone</th>
                    <th className="py-2.5 px-3 text-left">Target Window</th>
                    <th className="py-2.5 px-3 text-left">Actual Collection</th>
                    <th className="py-2.5 px-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pickups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-smoke italic">
                        No active logistics logs found.
                      </td>
                    </tr>
                  ) : (
                    pickups.map((p) => {
                      const hasDelay = isTimeDiscrepancy(p);
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-sand/15 transition-all text-xs ${
                            hasDelay
                              ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse text-xs font-semibold px-2 py-1 rounded"
                              : "hover:bg-linen/60 text-[#6B5744]"
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-semibold">
                            {p.id.substring(0, 8)}
                          </td>
                          <td className="py-2 px-3 font-semibold">
                            {p.location}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {p.time_slot || "08:00 AM - 09:00 AM"}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {p.status === "collected" || p.status === "completed"
                              ? new Date(p.updated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
                              : "Awaiting Crew..."}
                          </td>
                          <td className="py-2 px-3">
                            <span className="uppercase font-mono font-bold text-[10px]">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      )}

      {/* Pickup management: search/status filters + per-row status mutation */}
      {userRole === "admin" && (
        <Card className="mt-8 w-full max-w-7xl mx-auto">
          <CardHeader>
            <CardTitle className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218]">
              Pickup Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                placeholder="Search household, sector, or waste type…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["all", ...PICKUP_STATUSES].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-sand/25 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
                    <TableHead>Household</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Waste</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <TableCell key={j}>
                            <div className="h-4 rounded bg-sand/40 motion-safe:animate-pulse" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-xs text-smoke italic">
                        No pickups match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id} className="text-xs text-[#6B5744]">
                        <TableCell className="font-semibold">
                          {(p as AdminPickup).profiles?.full_name ?? p.full_name ?? "—"}
                        </TableCell>
                        <TableCell>{p.location}</TableCell>
                        <TableCell>{p.waste_type}</TableCell>
                        <TableCell className="font-mono">{Number(p.estimated_weight || 0)} kg</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell>
                          {p.proof_photo_path ? (
                            <ProofThumb
                              path={p.proof_photo_path}
                              verified={p.proof_verified}
                              distanceM={p.proof_distance_m}
                            />
                          ) : (
                            <span className="text-[10px] text-smoke">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={p.status}
                            onValueChange={(v: string | null) => {
                              if (v && v !== p.status) handleStatusUpdate(p.id, v as PickupStatus);
                            }}
                          >
                            <SelectTrigger size="sm" className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PICKUP_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout estimator + override (left) and price-grid monitor (right) */}
      {userRole === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 w-full max-w-7xl mx-auto mb-10">
          <PayoutOverride pickups={pickups} onSaved={handleOverrideSaved} />
          <PriceGrid estimates={priceEstimates} />
        </div>
      )}

      {/* Crew hub assignment (admin only) */}
      {userRole === "admin" && <CrewHubAssignment />}

      {/* Marketplace management (admin only) */}
      {userRole === "admin" && (
        <MarketplaceAdmin
          initialItems={marketItems}
          initialOrders={orders}
          users={users}
          badges={badges}
        />
      )}
    </div>
  );
}
