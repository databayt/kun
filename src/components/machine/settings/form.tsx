"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { DriverStatus } from "../driver/types"
import { saveSettings } from "./actions"
import type { Settings } from "./types"
import { settingsSchema } from "./validation"

interface Props {
  isAr: boolean
  initial: Settings
  drivers: DriverStatus[]
  departments: string[]
  /** The machine profile's agent: shown, not chosen. */
  lockedDriver?: DriverStatus["kind"]
}

export function SettingsForm({ isAr, initial, drivers, departments, lockedDriver }: Props) {
  const [values, setValues] = useState<Settings>(initial)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = settingsSchema.safeParse(lockedDriver ? { ...values, driver: lockedDriver } : values)
    if (!parsed.success) {
      setMessage({ ok: false, text: isAr ? "تحقق من الحقول." : "Check the fields." })
      return
    }
    setBusy(true)
    try {
      setValues(await saveSettings(parsed.data))
      setMessage({ ok: true, text: isAr ? "تم الحفظ." : "Saved." })
    } catch (err) {
      setMessage({ ok: false, text: String(err) })
    } finally {
      setBusy(false)
    }
  }

  const deptOptions = departments.includes(values.department) ? departments : [values.department, ...departments]

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="person">{isAr ? "الاسم" : "Your name"}</Label>
        <Input id="person" className="h-12 rounded-full bg-muted px-5 text-base shadow-none" value={values.person} maxLength={80} onChange={(e) => setValues({ ...values, person: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department">{isAr ? "القسم" : "Department"}</Label>
        {departments.length > 0 ? (
          <select
            id="department"
            value={values.department}
            onChange={(e) => setValues({ ...values, department: e.target.value })}
            className="bg-muted h-12 w-full rounded-full px-5 text-base"
          >
            {deptOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : (
          <Input id="department" className="h-12 rounded-full bg-muted px-5 text-base shadow-none" value={values.department} onChange={(e) => setValues({ ...values, department: e.target.value })} />
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{isAr ? "الوكيل" : "Agent"}</legend>
        {lockedDriver ? (
          <p dir="ltr" className="bg-muted/70 rounded-2xl p-3 text-sm font-medium">
            {lockedDriver} <span className="text-muted-foreground text-xs">· {isAr ? "يحدده ملف جهازك" : "set by this machine's profile"}</span>
          </p>
        ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {drivers.map((d) => (
            <button
              key={d.kind}
              type="button"
              disabled={!d.installed}
              onClick={() => setValues({ ...values, driver: d.kind })}
              aria-pressed={values.driver === d.kind}
              className={cn(
                "bg-muted/70 rounded-2xl p-3 text-start text-sm transition-colors hover:bg-muted disabled:opacity-50",
                values.driver === d.kind && "bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              <div className="font-medium">{d.kind}</div>
              <div className={cn("mt-0.5 text-xs", values.driver === d.kind ? "text-background/70" : "text-muted-foreground")}>
                {d.installed ? (isAr ? "مثبّت" : "Installed") : isAr ? "غير مثبّت" : "Not installed"}
              </div>
            </button>
          ))}
        </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} className="h-12 rounded-full px-6 text-base">{isAr ? "حفظ" : "Save"}</Button>
        {message && <span className={cn("text-sm", message.ok ? "text-muted-foreground" : "text-destructive")}>{message.text}</span>}
      </div>
    </form>
  )
}
