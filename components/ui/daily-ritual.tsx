"use client"

import * as React from "react"
import {
  Check,
  Gift,
  HelpCircle,
  Lock,
  LogIn,
  Recycle,
  Snowflake,
  Sparkles,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { StreakCard } from "@/components/ui/streak-card"
import { CountUp } from "@/components/ui/count-up"
import type { StreakPeriod } from "@/components/ui/streak-calendar"

interface DailyRitualProps {
  currentStreak: number
  longestStreak: number
  totalPickups: number
  /** Live daily-action state (authoritative, from log_daily_action / get_daily_status). */
  loggedIn: boolean
  segregated: boolean
  quizzesCorrect: number
  quizStrikes: number
  freezes: number
  weeklyActiveDays: number
  hasPickupToday: boolean
  onLaunchQuiz: () => void
  onLogSegregation: () => void
}

const MILESTONES = [
  { days: 3, reward: 10 },
  { days: 7, reward: 20 },
  { days: 14, reward: 40 },
  { days: 30, reward: 100 },
]
const WEEKLY_TARGET = 7

const streakMultiplier = (streak: number) => Math.min(2, 1 + 0.05 * streak)

// A streak of N = N consecutive active days ending today. Matches StreakCalendar's YYYY-MM-DD keys
// so the heatmap finally reflects the authoritative streak (not the stale pickup-date approximation).
function streakToPeriods(streak: number): StreakPeriod[] {
  if (streak <= 0) return []
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (streak - 1))
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return [{ periodStart: fmt(start), periodEnd: fmt(end) }]
}

function useMidnightCountdown() {
  const [label, setLabel] = React.useState("")
  React.useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const ms = midnight.getTime() - now.getTime()
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      setLabel(`${h}h ${m}m`)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return label
}

function WeeklyRing({ active }: { active: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const progress = Math.min(1, active / WEEKLY_TARGET)
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg width={64} height={64} viewBox="0 0 64 64" className="t-ring-fill -rotate-90">
        <circle cx={32} cy={32} r={r} fill="none" stroke="#EDE5D8" strokeWidth={7} />
        <circle
          cx={32}
          cy={32}
          r={r}
          fill="none"
          stroke="#7A9E7E"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-jetbrains)] text-sm font-bold text-bark">
        {active}/{WEEKLY_TARGET}
      </span>
    </div>
  )
}

export function DailyRitual({
  currentStreak,
  longestStreak,
  totalPickups,
  loggedIn,
  segregated,
  quizzesCorrect,
  quizStrikes,
  freezes,
  weeklyActiveDays,
  hasPickupToday,
  onLaunchQuiz,
  onLogSegregation,
}: DailyRitualProps) {
  const countdown = useMidnightCountdown()
  const mult = streakMultiplier(currentStreak)
  const award = (base: number) => Math.round(base * mult)

  const steps = [
    { label: "Daily Check-in", sub: "Auto when you visit", value: award(1), done: loggedIn, icon: LogIn, onClick: undefined as (() => void) | undefined },
    { label: "Log Segregation", sub: "Sort your home waste", value: award(2), done: segregated, icon: Recycle, onClick: segregated ? undefined : onLogSegregation },
    { label: "Eco Quiz", sub: `${quizzesCorrect}/5 correct today`, value: award(1), done: quizzesCorrect > 0, icon: HelpCircle, onClick: quizStrikes >= 2 || quizzesCorrect >= 5 ? undefined : onLaunchQuiz },
  ]
  const comboCount = steps.filter((s) => s.done).length
  const perfectDay = comboCount === 3
  const nextMilestone = MILESTONES.find((m) => currentStreak < m.days) ?? null

  return (
    <section
      aria-label="Daily Grove Ritual"
      className="t-glass-card animate-fade-up-delay-2 flex flex-col gap-5 rounded-xl border border-[rgba(196,112,74,0.18)] p-6 shadow-sm"
    >
      {/* Header — title + live streak multiplier + midnight countdown / perfect-day state */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark">Daily Grove Ritual</h3>
          <p className="text-xs text-smoke">Return every day — grow your streak, multiply your credits.</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full border border-[#C4704A]/30 bg-[#C4704A]/10 px-2.5 py-1 font-[family-name:var(--font-jetbrains)] text-sm font-bold text-[#C4704A]"
            title={`Streak bonus: every daily-action credit is multiplied by ${mult.toFixed(2)}`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> ×{mult.toFixed(2)}
          </span>
          {perfectDay ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4A6741]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Perfect Day secured
            </span>
          ) : (
            <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-[#6B5744]">
              {countdown} to finish today
            </span>
          )}
        </div>
      </div>

      {/* Streak hero — reuse StreakCard for flame, number, secured banner, calendar (activities hidden) */}
      <StreakCard
        streak={streakToPeriods(currentStreak)}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        total={totalPickups}
        title="Grove Streak"
        primaryColor="#C4704A"
        accentColor="#7A9E7E"
        textColor="#2C1F14"
        theme="light"
        showHowItWorks={false}
        showActivities={false}
        hasPickupToday={hasPickupToday}
        isWasteSegregated={segregated}
        activityDoneToday={loggedIn || segregated || quizzesCorrect > 0}
        className="!border-0 !bg-transparent !p-0 !shadow-none"
      />

      {/* Today's Ritual — 3-action combo row */}
      <div className="relative flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="font-syne text-xs font-bold uppercase tracking-wider text-bark">Today&apos;s Ritual</span>
          <span className="font-[family-name:var(--font-jetbrains)] text-xs font-bold text-[#C4704A]">{comboCount}/3 combo</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand/35">
          <div className="h-full rounded-full bg-gradient-to-r from-sage to-terra transition-all duration-500" style={{ width: `${(comboCount / 3) * 100}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {steps.map((s) => {
            const Icon = s.icon
            const clickable = Boolean(s.onClick)
            return (
              <button
                key={s.label}
                type="button"
                onClick={s.onClick}
                disabled={!clickable}
                aria-label={`${s.label}${s.done ? " — done" : ""}`}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all",
                  s.done
                    ? "border-[#7A9E7E]/40 bg-[#7A9E7E]/10"
                    : "border-[#D4C5B0]/50 bg-[#EDE5D8]/40",
                  clickable && "cursor-pointer hover:border-[#C4704A]/40 hover:bg-[#EDE5D8]/70",
                  !clickable && !s.done && "cursor-default opacity-70",
                )}
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", s.done ? "bg-[#7A9E7E]/20 text-[#4A6741]" : "bg-[#C4704A]/10 text-[#C4704A]")}>
                  {s.done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="font-dm text-[11px] font-semibold leading-tight text-bark">{s.label}</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] font-bold text-[#C4704A]">+{s.value}</span>
                <span className="font-dm text-[9px] text-[#6B5744]">{s.sub}</span>
              </button>
            )
          })}
        </div>

        {perfectDay && (
          <div className="t-leaf-burst pointer-events-none absolute -top-1 right-2 text-[#4A6741]" aria-hidden="true">
            <Sparkles className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Shield + weekly canopy ring */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="flex items-center gap-3 rounded-xl border border-[#7A9E7E]/30 bg-[#7A9E7E]/8 p-3"
          title="A shield protects your streak through one missed day. Earn more from milestone chests."
        >
          <Snowflake className="h-7 w-7 shrink-0 text-[#5E7C8A]" aria-hidden="true" />
          <div>
            <p className="font-[family-name:var(--font-jetbrains)] text-lg font-bold leading-none text-bark">
              <CountUp value={freezes} className="t-countup" /> <span className="text-xs font-medium text-[#6B5744]">{freezes === 1 ? "shield" : "shields"}</span>
            </p>
            <p className="font-dm text-[10px] text-[#6B5744]">Protects a missed day</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#D4C5B0]/50 bg-[#EDE5D8]/40 p-3">
          <WeeklyRing active={weeklyActiveDays} />
          <div>
            <p className="font-syne text-xs font-bold uppercase tracking-wider text-bark">Weekly Canopy</p>
            <p className="font-dm text-[10px] text-[#6B5744]">
              {weeklyActiveDays >= WEEKLY_TARGET ? "Full canopy — bonus unlocked!" : `${WEEKLY_TARGET - weeklyActiveDays} more active days this week`}
            </p>
          </div>
        </div>
      </div>

      {/* Milestone chests */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-syne text-xs font-bold uppercase tracking-wider text-bark">Milestone Chests</span>
          {nextMilestone && (
            <span className="font-dm text-[11px] text-[#6B5744]">
              Next in <span className="font-[family-name:var(--font-jetbrains)] font-bold text-[#C4704A]">{nextMilestone.days - currentStreak}d</span> → +{nextMilestone.reward}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MILESTONES.map((m, i) => {
            const unlocked = currentStreak >= m.days
            return (
              <div
                key={m.days}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2.5",
                  unlocked ? "t-chest-pop border-[#C4704A]/35 bg-[#C4704A]/8" : "border-[#D4C5B0]/50 bg-[#EDE5D8]/30",
                )}
                style={unlocked ? ({ animationDelay: `${i * 90}ms` } as React.CSSProperties) : undefined}
                title={unlocked ? `${m.days}-day chest unlocked` : `Reach a ${m.days}-day streak`}
              >
                <span className={cn("relative flex h-9 w-9 items-center justify-center rounded-full", unlocked ? "bg-[#C4704A]/15 text-[#C4704A]" : "bg-[#D4C5B0]/30 text-[#9A8C7A]")}>
                  <Gift className="h-4 w-4" aria-hidden="true" />
                  {!unlocked && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-[#F4EFE6] bg-[#6B5744] p-0.5">
                      <Lock className="h-2.5 w-2.5 text-[#F4EFE6]" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] font-bold text-bark">{m.days}d</span>
                <span className={cn("font-[family-name:var(--font-jetbrains)] text-[10px] font-bold", unlocked ? "text-[#C4704A]" : "text-[#9A8C7A]")}>+{m.reward}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
