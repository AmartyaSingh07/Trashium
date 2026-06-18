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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  MoreHorizontal,
  Calculator,
  TrendingUp,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import MarketplaceAdmin from "@/components/admin/marketplace-admin";
import CrewHubAssignment from "@/components/admin/crew-hub-assignment";
import type {
  PickupRequest,
  PriceEstimate,
  PickupStatus,
  WasteType,
  AreaType,
  MarketplaceItem,
  RedemptionOrder,
} from "@/lib/types";

type AdminOrder = RedemptionOrder & {
  profiles?: { full_name: string | null; email: string | null } | null;
};

const wasteTypes: WasteType[] = [
  "Plastic", "Paper", "Glass", "Metal", "E-Waste", "Organic", "Mixed",
];
const areas: AreaType[] = ["Urban", "Suburban", "Rural"];

const OPERATIONAL_SECTORS = ['Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura'];

const normalizeSectorName = (zone: string) => {
  if (zone === 'Bally' || zone === 'Belur') return 'Howrah';
  return zone;
};

const mapSectorToArea = (sector: string): AreaType => {
  if (sector === "Rishra" || sector === "Howrah") return "Urban";
  if (sector === "Shyamnagar") return "Suburban";
  if (sector === "Tarakeswar" || sector === "Hugli-Chinsura") return "Rural";
  return "Urban";
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
  const setRequests = (data: any) => setPickups(data);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState("Rishra");

  const fetchFullFledgedData = async () => {
    const { data, error } = await supabase
      .from('pickup_requests')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Fetch Error:", error.message);
      return;
    }

    console.log("Success! Data received:", data);
    const normalizedData = (data || []).map((p: any) => ({
      ...p,
      location: normalizeSectorName(p.location)
    }));
    setRequests(normalizedData);
  };

  const getSectorRankings = (sector: string) => {
    const sectorMocks: { [key: string]: Array<{ name: string; email: string; value: number }> } = {
      Rishra: [
        { name: "Amartya Singh", email: "amartya.singh@gmail.com", value: 145 },
        { name: "Sam Sulek", email: "sam.sulek@gmail.com", value: 120 },
        { name: "Priya Das", email: "priya.das@outlook.com", value: 95 },
        { name: "Rahul Sen", email: "rahul.sen@gmail.com", value: 80 },
        { name: "Ananya Roy", email: "ananya.roy@yahoo.com", value: 65 },
      ],
      Howrah: [
        { name: "Vikram Malhotra", email: "vikram.m@gmail.com", value: 180 },
        { name: "Sneha Chatterjee", email: "sneha.c@gmail.com", value: 110 },
        { name: "Amit Ghosh", email: "amit.ghosh@hotmail.com", value: 85 },
        { name: "Riya Paul", email: "riya.p@gmail.com", value: 75 },
      ],
      Shyamnagar: [
        { name: "Debabrata Dey", email: "debabrata.d@gmail.com", value: 210 },
        { name: "Tanmoy Bose", email: "tanmoy.bose@gmail.com", value: 150 },
        { name: "Soma Mukherjee", email: "soma.m@gmail.com", value: 130 },
        { name: "Kushal Mitra", email: "kushal.mitra@gmail.com", value: 90 },
      ],
      Tarakeswar: [
        { name: "Ayan Saha", email: "ayan.saha@gmail.com", value: 115 },
        { name: "Payel Sen", email: "payel.sen@gmail.com", value: 90 },
        { name: "Subhadip Roy", email: "subhadip.roy@gmail.com", value: 70 },
      ],
      "Hugli-Chinsura": [
        { name: "Pritha Dey", email: "pritha.dey@gmail.com", value: 125 },
        { name: "Sourav Kar", email: "sourav.kar@gmail.com", value: 105 },
        { name: "Mimi Das", email: "mimi.das@gmail.com", value: 85 },
      ],
    };

    const mocks = sectorMocks[sector] || [];
    const userTotals: { [userId: string]: { name: string; email: string; totalWeight: number } } = {};
    
    pickups.forEach((p) => {
      const isCompleted = (p.status as string) === "completed" || (p.status as string) === "processed" || (p.status as string) === "collected";
      const matchesSector = p.location.toLowerCase().includes(sector.toLowerCase()) || 
                            p.address.toLowerCase().includes(sector.toLowerCase());
      
      if (isCompleted && matchesSector) {
        const userId = p.user_id;
        const name = (p as any).profiles?.full_name || p.full_name || "User";
        const email = (p as any).profiles?.email || "User";
        const weight = Number(p.estimated_weight || 0);

        if (!userTotals[userId]) {
          userTotals[userId] = { name, email, totalWeight: 0 };
        }
        userTotals[userId].totalWeight += weight;
      }
    });

    const mergedList: Array<{ userId: string; userName: string; byline: string; value: number }> = [];
    
    Object.entries(userTotals).forEach(([userId, info]) => {
      mergedList.push({
        userId,
        userName: info.name,
        byline: info.email,
        value: Math.round(info.totalWeight),
      });
    });

    mocks.forEach((mock, idx) => {
      if (!mergedList.some(item => item.userName.toLowerCase() === mock.name.toLowerCase())) {
        mergedList.push({
          userId: `mock-user-${sector}-${idx}`,
          userName: mock.name,
          byline: mock.email,
          value: mock.value,
        });
      }
    });

    const sorted = mergedList.sort((a, b) => b.value - a.value);

    const rankings = sorted.map((item, index) => ({
      userId: item.userId,
      userName: item.userName,
      byline: item.byline,
      value: item.value,
      rank: index + 1,
      displayed: true,
      rankChange: index === 0 ? 0 : index === 1 ? 1 : -1,
    }));

    const podiumRankings = rankings.slice(0, 3);

    return { rankings, podiumRankings };
  };

  const { rankings: sectorRankings, podiumRankings: sectorPodium } = getSectorRankings(selectedSector);

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
    if (!pickup.time_slot || (pickup.status !== "collected" && pickup.status !== "processed")) {
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
      const completed = sectorPickups.filter(p => p.status === "processed").length;
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

  // Price estimator state
  const [estimatorWaste, setEstimatorWaste] = useState<WasteType | "">("");
  const [estimatorArea, setEstimatorArea] = useState<AreaType | "">("");
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const handleEstimatorWasteChange = (value: string | null) => {
    if (value !== null) {
      setEstimatorWaste(value as WasteType);
      setEstimatedPrice(null);
    }
  };
  const handleEstimatorAreaChange = (value: string | null) => {
    if (value !== null) {
      setEstimatorArea(value as AreaType);
      setEstimatedPrice(null);
    }
  };
  const weightRanges = [
    { label: "5-10 kg", value: "5-10 kg", midpoint: 7.5 },
    { label: "10-15 kg", value: "10-15 kg", midpoint: 12.5 },
    { label: "15-20 kg", value: "15-20 kg", midpoint: 17.5 },
    { label: "20+ kg", value: "20+ kg", midpoint: 25.0 },
  ];
  const [estimatorWeight, setEstimatorWeight] = useState("");
  const handleWeightChange = (value: string | null) => {
    if (value !== null) {
      setEstimatorWeight(value);
      setEstimatedPrice(null);
    }
  };

  const handleCalculate = () => {
    if (!estimatorWaste || !estimatorWeight) {
      toast.error("Please select a waste type and weight range");
      return;
    }
    const selectedRange = weightRanges.find(r => r.value === estimatorWeight);
    if (!selectedRange) {
      toast.error("Please select a valid weight range");
      return;
    }
    const weight = selectedRange.midpoint;

    // Base rates per kg: Plastic = ₹12, Paper = ₹8, Metal = ₹45, Fabric = ₹5.
    let baseRate = 10;
    switch (estimatorWaste) {
      case "Plastic":
        baseRate = 12;
        break;
      case "Paper":
        baseRate = 8;
        break;
      case "Metal":
        baseRate = 45;
        break;
      case "Glass":
        baseRate = 10;
        break;
      case "E-Waste":
        baseRate = 30;
        break;
      case "Organic":
        baseRate = 3;
        break;
      case "Mixed":
        baseRate = 6;
        break;
      default:
        if ((estimatorWaste as string).toLowerCase() === "fabric") {
          baseRate = 5;
        }
        break;
    }

    let total = weight * baseRate;

    // Adjust total based on Area / Zone (+5% or -5%)
    const mappedArea = mapSectorToArea(estimatorArea);
    if (mappedArea === "Urban") {
      total *= 1.05;
    } else if (mappedArea === "Rural") {
      total *= 0.95;
    }

    setEstimatedPrice(parseFloat(total.toFixed(2)));
  };

  const pendingCount = pickups.filter((p) => p.status === "pending").length;
  const todayCount = pickups.filter(
    (p) => p.scheduled_date === new Date().toISOString().split("T")[0]
  ).length;

  // Filter pickups
  const filtered = pickups.filter((p) => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const name = (p as any).profiles?.full_name || p.full_name || "";
    const matchesSearch =
      !searchTerm ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.waste_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Price estimation
  const getEstimatedPrice = () => {
    if (!estimatorWaste || !estimatorArea) return null;
    const mappedArea = mapSectorToArea(estimatorArea);
    const match = priceEstimates.find(
      (pe) => pe.waste_type === estimatorWaste && pe.area === mappedArea
    );
    return match?.price_per_kg ?? null;
  };

  const pricePerKg = getEstimatedPrice();
  const selectedEstimatorRange = weightRanges.find(r => r.value === estimatorWeight);
  const totalEstimate =
    pricePerKg && selectedEstimatorRange
      ? pricePerKg * selectedEstimatorRange.midpoint
      : null;

  const handleStatusUpdate = async (selectedPickupId: string, newStatus: PickupStatus) => {
    let mappedStatusValue = newStatus as string;
    if (newStatus === "confirmed") {
      mappedStatusValue = "accepted";
    } else if (newStatus === "collected") {
      mappedStatusValue = "collected";
    } else if (newStatus === "processed") {
      mappedStatusValue = "completed";
    } else if (newStatus === "cancelled") {
      mappedStatusValue = "cancelled";
    }

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
        setPickups(prev => prev.map(p => p.id === selectedPickupId ? { ...p, status: mappedStatusValue as any } : p));
      }

      router.refresh();
      await fetchFullFledgedData();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 relative z-10 font-[family-name:var(--font-dm)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[rgba(194,112,61,0.15)] pb-2 mb-4 w-full">
        <div className="flex items-center gap-3 mb-4 select-none">
          <div className="w-10 h-10 rounded-xl bg-[#EDE5D8]/80 border border-[rgba(194,112,61,0.18)] p-2 flex items-center justify-center shadow-sm">
            <img 
              src="https://fqbjjcbrxrokvdwkydze.supabase.co/storage/v1/object/public/gamification-levels/logo.png" 
              className="w-full h-full object-contain" 
              alt="Trashium Admin Logo" 
            />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase text-[#8FA37E] font-bold block leading-none">Ecosystem Console</span>
            <span className="font-syne font-bold text-xl text-[#2A2218] tracking-tight mt-0.5 block">Trashium Terminal</span>
          </div>
        </div>
      </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8 w-full max-w-7xl mx-auto mb-10">
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
              <div className="rounded-xl border border-sand/25 overflow-hidden">
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
                        Points Issuance Velocity
                      </td>
                      <td className="py-2.5 px-3 font-medium text-clay font-mono">
                        2,450 / Month
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                        Optimal
                      </td>
                    </tr>
                    <tr className="hover:bg-linen/60 transition-colors duration-150 border-b border-sand/15 text-xs text-[#6B5744]">
                      <td className="py-2.5 px-3 font-semibold text-bark">
                        Average Active Streak Velocity
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-bark font-mono">
                        3.4 pickups/user
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 font-semibold">
                        Active
                      </td>
                    </tr>
                    <tr className="hover:bg-linen/60 transition-colors duration-150 text-xs text-[#6B5744]">
                      <td className="py-2.5 px-3 font-semibold text-bark">
                        Municipal Approval Clearing Requests
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-bark font-mono">
                        5 Pending Approval
                      </td>
                      <td className="py-2.5 px-3 text-amber-700 font-semibold">
                        Awaiting Signature
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sector processing throughput */}
            <div className="border-t border-[rgba(194,112,61,0.12)] pt-5">
              <h3 className="font-syne font-bold text-xs uppercase tracking-wider text-[#6B5744] mb-3">
                Sector-wise Processing Throughput & Minting Summary
              </h3>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                {[
                  { sector: "Rishra", throughput: "1,450 kg/mo", minted: "1,120 credits" },
                  { sector: "Howrah", throughput: "1,180 kg/mo", minted: "890 credits" },
                  { sector: "Shyamnagar", throughput: "1,820 kg/mo", minted: "1,480 credits" },
                  { sector: "Tarakeswar", throughput: "850 kg/mo", minted: "620 credits" },
                  { sector: "Hugli-Chinsura", throughput: "1,020 kg/mo", minted: "780 credits" }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white/50 border border-sand/20 text-xs">
                    <p className="text-[10px] text-smoke font-bold font-syne uppercase tracking-wider mb-1">
                      {item.sector}
                    </p>
                    <div className="flex flex-col gap-0.5 text-[#6B5744]">
                      <p className="text-[11px]">Throughput: <span className="font-mono font-bold text-[#2A2218]">{item.throughput}</span></p>
                      <p className="text-[11px]">Minted: <span className="font-mono font-semibold text-clay">{item.minted}</span></p>
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
                className="bg-[#C2703D] hover:bg-[#A0522D] text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer border-0 flex items-center gap-1 shadow-sm"
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
                              ? "bg-red-50 text-red-700 border-red-100 animate-pulse text-xs font-semibold px-2 py-1 rounded"
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
                            {p.status === "collected" || p.status === "processed"
                              ? new Date(p.updated_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
                              : "Awaiting Crew..."}
                          </td>
                          <td className="py-2 px-3">
                            <span className="uppercase font-mono font-bold text-[10px]">
                              {p.status === "processed" ? "completed" : p.status}
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
