"use client"

import * as React from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  RefreshCcw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  StreakCalendar,
  type StreakPeriod,
} from "@/components/ui/streak-calendar"
import { StreakBadge } from "@/components/ui/streak-badge"

interface StreakCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Streak periods passed through to StreakCalendar */
  streak: StreakPeriod[]
  /** Current streak value in days */
  currentStreak: number
  /** Longest streak value in days */
  longestStreak: number
  /** Secondary total metric value */
  total: number
  /** Optional heading text */
  title?: string
  /** Label for the action button */
  actionLabel?: string
  /** Callback for action click */
  onActionClick?: () => void
  /** Show "How streaks work" dropdown section */
  showHowItWorks?: boolean
  /** Title for the dropdown trigger */
  howItWorksTitle?: string
  /** Content rows shown when the dropdown is expanded */
  howItWorksItems?: string[]
  /** Initial expanded state for dropdown */
  defaultHowItWorksOpen?: boolean
  /** Theme overrides */
  primaryColor?: string
  accentColor?: string
  textColor?: string
  theme?: string
  onLaunchQuiz?: () => void
  hasPickupToday?: boolean
  isWasteSegregated?: boolean
  onLogWasteSegregation?: () => void
  /** True if any streak-eligible activity is already done today (pickup/segregation/quiz). Drives the at-risk vs secured banner. */
  activityDoneToday?: boolean
  /** Show the "Today's Eligible Activities" action tiles (default true). DailyRitual hides them and supplies its own combo row. */
  showActivities?: boolean
}

const StreakCard = React.forwardRef<HTMLDivElement, StreakCardProps>(
  (
    {
      className,
      streak,
      currentStreak,
      longestStreak,
      total,
      title = "Streak",
      actionLabel = "View Details",
      onActionClick,
      showHowItWorks = true,
      howItWorksTitle = "How do streaks work?",
      howItWorksItems = [
        "Complete at least one activity each day to build your streak.",
        "Each day you do an activity, your streak increases.",
        "Missing a day will reset your streak to 0.",
      ],
      defaultHowItWorksOpen = false,
      primaryColor,
      accentColor,
      textColor,
      theme: componentTheme,
      onLaunchQuiz,
      hasPickupToday = false,
      isWasteSegregated = false,
      onLogWasteSegregation,
      activityDoneToday,
      showActivities = true,
      ...props
    },
    ref
  ) => {
    const [isHowItWorksOpen, setIsHowItWorksOpen] = React.useState(
      defaultHowItWorksOpen
    )
    const [isStreakDetailOpen, setIsStreakDetailOpen] = React.useState(false)
    const howItWorksContentId = React.useId()

    // ── Streak intensity + milestones (ember grows dormant → leaf-green → terra as it climbs) ──
    const MILESTONES = [3, 7, 14, 30]
    const intensity =
      currentStreak >= 30 ? 3 : currentStreak >= 14 ? 2 : currentStreak >= 7 ? 1 : 0
    const flameColor = ["#9A8C7A", "#7A9E7E", "#C4704A", "#B35E39"][intensity]
    const flameScale = Math.min(1, currentStreak / 30) // 0→1, drives ember size + glow via CSS var
    const nextMilestone = MILESTONES.find((m) => currentStreak < m) ?? null
    const reachedMilestone =
      [...MILESTONES].reverse().find((m) => currentStreak >= m) ?? null
    // Fall back to the existing pickup/segregation signals if the parent didn't pass an explicit flag.
    const doneToday = activityDoneToday ?? (hasPickupToday || isWasteSegregated)

    return (
      <>
      <section
        ref={ref}
        aria-label="Streak summary card"
        className={cn("bg-card rounded-2xl border p-6 shadow-sm", className)}
        style={{
          color: textColor,
          "--primary": primaryColor,
          "--accent-color": accentColor,
        } as React.CSSProperties}
        {...props}
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn("t-flame", currentStreak === 0 && "t-flame-dormant")}
              style={{
                "--t-flame-color": flameColor,
                "--t-flame-intensity": String(flameScale),
              } as React.CSSProperties}
              aria-hidden="true"
            >
              <Flame className="h-6 w-6" style={{ color: flameColor }} />
            </span>
            <h3 className="text-2xl leading-none font-semibold">{title}</h3>
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={onActionClick || (() => setIsStreakDetailOpen(true))}
            aria-label={actionLabel}
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            {actionLabel}
          </Button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-5xl leading-none font-semibold tracking-tight">
            {currentStreak}
            <span className="text-muted-foreground ml-2 text-2xl font-medium">
              days
            </span>
          </p>

          {/* Milestone flare — reuses the StreakBadge chip at 3 / 7 / 14 / 30 days */}
          {reachedMilestone && (
            <StreakBadge
              size="sm"
              length={reachedMilestone}
              subtitle="milestone"
              className="t-rise border-[#C4704A]/30 bg-[#C4704A]/5"
              style={{ color: flameColor, animationDelay: "140ms" } as React.CSSProperties}
            />
          )}
        </div>

        {nextMilestone && (
          <p className="mt-2 text-xs text-muted-foreground">
            {nextMilestone - currentStreak} day{nextMilestone - currentStreak === 1 ? "" : "s"} to your {nextMilestone}-day milestone
          </p>
        )}

        {/* streak status: at-risk before midnight vs secured for today */}
        {currentStreak > 0 && !doneToday && (
          <div className="t-pulse mt-3 mb-1 flex items-start gap-2 rounded-lg border border-[#C4704A]/30 bg-[#C4704A]/5 p-3" role="status">
            <Flame className="mt-0.5 h-4 w-4 shrink-0 text-[#C4704A]" aria-hidden="true" />
            <p className="text-xs text-[#6B5744]">
              Your {currentStreak}-day streak is at risk — log segregation or take the quiz before midnight to keep it.
            </p>
          </div>
        )}
        {currentStreak > 0 && doneToday && (
          <div className="mt-3 mb-1 flex items-center gap-2 rounded-lg border border-[#7A9E7E]/30 bg-[#7A9E7E]/10 p-3" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4A6741]" aria-hidden="true" />
            <p className="text-xs text-[#4A6741]">Streak secured for today — nice work!</p>
          </div>
        )}
        {currentStreak === 0 && (
          <div className="mt-3 mb-1 flex items-start gap-2 rounded-lg border border-[#D4C5B0]/50 bg-[#EDE5D8]/40 p-3" role="status">
            <Flame className="mt-0.5 h-4 w-4 shrink-0 text-[#9A8C7A]" aria-hidden="true" />
            <p className="text-xs text-[#6B5744]">Start your streak today — complete any activity below.</p>
          </div>
        )}

        <div className="mt-4" />

        <StreakCalendar
          streak={streak}
          view="week"
          startOfWeek={1}
          className="max-w-none"
        />

        <div
          className="mt-4 grid grid-cols-2 gap-4 border-t border-dashed pt-4"
          aria-label="Streak stats"
        >
          <div>
            <p className="text-muted-foreground text-sm">Longest Streak</p>
            <p className="text-3xl leading-tight font-semibold">
              {longestStreak}
              <span className="ml-1 text-2xl font-medium">days</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-sm">Total</p>
            <p className="text-3xl leading-tight font-semibold">{total}</p>
          </div>
        </div>

        {showHowItWorks && (
          <div className="mt-4 border-t pt-4">
            <button
              type="button"
              className="bg-muted flex w-full items-center justify-between rounded-xl px-4 py-3 text-left"
              onClick={() => setIsHowItWorksOpen((prev) => !prev)}
              aria-expanded={isHowItWorksOpen}
              aria-controls={howItWorksContentId}
            >
              <span className="text-lg font-semibold">{howItWorksTitle}</span>
              <ChevronDown
                className={cn(
                  "text-muted-foreground h-5 w-5 transition-transform",
                  isHowItWorksOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>

            {isHowItWorksOpen && (
              <div id={howItWorksContentId} className="space-y-4 px-2 pt-4">
                {howItWorksItems.map((item, index) => {
                  const Icon =
                    index === 0
                      ? CheckCircle2
                      : index === 1
                        ? Flame
                        : RefreshCcw
                  return (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-start gap-3"
                    >
                      <Icon
                        className="text-primary mt-0.5 h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      <p className="text-muted-foreground text-lg leading-snug">
                        {item}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {showActivities && (<>
        {/* Today's Eligible Activities */}
        <span className="font-syne font-bold text-xs uppercase tracking-wider text-[#2C1F14] mt-4 mb-2 block">
          Today&apos;s Eligible Activities
        </span>
        <div className="flex flex-col gap-2 text-left">
          {/* Task 1: Schedule Doorstep Pickup */}
          <div 
            onClick={() => {
              if (hasPickupToday) return;
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-schedule-pickup"));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className={cn(
              "flex items-center p-3 bg-[#EDE5D8]/40 border border-[#D4C5B0]/50 rounded-lg transition-all hover:bg-[#EDE5D8]/70 hover:border-[#C4704A]/30",
              hasPickupToday ? "cursor-default" : "cursor-pointer"
            )}
          >
            <div>
              <span className="font-dm text-sm font-semibold text-[#2C1F14] block">Schedule Doorstep Pickup</span>
              <span className="font-dm text-xs text-[#6B5744] font-normal mt-0.5">Book your dry waste aggregation slot for the week</span>
            </div>
            {hasPickupToday ? (
              <span className="bg-[#7A9E7E]/10 text-[#4A6741] border border-[#7A9E7E]/30 font-medium text-[11px] rounded px-2 py-0.5 ml-auto flex items-center gap-1">
                <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                  <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                </svg>
                Completed
              </span>
            ) : (
              <span className="bg-[#7A9E7E]/10 text-[#4A6741] border border-[#7A9E7E]/30 font-medium text-[11px] rounded px-2 py-0.5 ml-auto">
                Schedule
              </span>
            )}
          </div>

          {/* Task 2: Log Waste Segregation */}
          <div 
            onClick={() => {
              if (onLogWasteSegregation) {
                onLogWasteSegregation();
              }
            }}
            className={cn(
              "flex items-center p-3 bg-[#EDE5D8]/40 border border-[#D4C5B0]/50 rounded-lg transition-all hover:bg-[#EDE5D8]/70 hover:border-[#C4704A]/30",
              isWasteSegregated ? "cursor-default" : "cursor-pointer"
            )}
          >
            <div>
              <span className="font-dm text-sm font-semibold text-[#2C1F14] block">Log Waste Segregation</span>
              <span className="font-dm text-xs text-[#6B5744] font-normal mt-0.5">Perform your daily home source-sorting checklist</span>
            </div>
            <div className="ml-auto flex items-center pr-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isWasteSegregated}
                disabled={isWasteSegregated}
                onChange={() => {
                  if (onLogWasteSegregation) {
                    onLogWasteSegregation();
                  }
                }}
                className="h-4 w-4 rounded border-2 border-[#D4C5B0] text-[#7A9E7E] focus:ring-[#7A9E7E] focus:ring-opacity-50 cursor-pointer accent-[#7A9E7E] disabled:cursor-default"
              />
            </div>
          </div>

          {/* Task 3: Eco-Knowledge Micro-Quiz */}
          <div 
            onClick={onLaunchQuiz}
            className="flex items-center p-3 bg-[#EDE5D8]/40 border border-[#D4C5B0]/50 rounded-lg transition-all hover:bg-[#EDE5D8]/70 hover:border-[#C4704A]/30 cursor-pointer"
          >
            <div>
              <span className="font-dm text-sm font-semibold text-[#2C1F14] block">Eco-Knowledge Micro-Quiz</span>
              <span className="font-dm text-xs text-[#6B5744] font-normal mt-0.5">Complete today&apos;s fast recycling trivia check to earn +5 bonus credits</span>
            </div>
          </div>
        </div>
        </>)}
      </section>

      {isStreakDetailOpen && (
        <div className="fixed inset-0 bg-[#2C1F14]/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" style={{ margin: 0 }}>
          <div className="bg-[#F4EFE6] border border-[#C4704A]/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl text-[#2C1F14] relative">
            <h3 className="text-xl font-bold font-[family-name:var(--font-syne)] mb-3 text-[#2C1F14]">Streak Verification Details</h3>
            <p className="text-sm mb-4 leading-relaxed text-smoke font-[family-name:var(--font-dm)]">
              Your consecutive counter tracks everyday pickup schedules successfully completed. 
              Keep recycling consistently to grow your green record and eco-rewards!
            </p>
            <div className="space-y-2.5 mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-smoke font-[family-name:var(--font-syne)]">Streak Periods History</p>
              <div className="bg-[#EDE5D8] rounded-xl p-4 border border-[#D4C5B0] font-mono text-xs max-h-32 overflow-y-auto space-y-2">
                {streak && streak.length > 0 ? (
                  streak.map((p, idx) => (
                    <div key={idx} className="flex justify-between border-b border-[#D4C5B0]/40 pb-1.5 last:border-0 last:pb-0">
                      <span className="font-semibold">Period {idx + 1}:</span>
                      <span>{p.periodStart} to {p.periodEnd}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-smoke text-center py-2">No completed pickup streaks recorded.</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsStreakDetailOpen(false)}
              className="w-full bg-[#C4704A] hover:bg-[#B35E39] text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm border-0 cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
      </>
    )
  }
)
StreakCard.displayName = "StreakCard"

export { StreakCard }
export type { StreakCardProps }
