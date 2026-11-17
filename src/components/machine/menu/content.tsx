"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Locale } from "@/components/local/config";
import type { HealthReport, TeamResponse } from "./data";
import { tr } from "../chat/config";
import { useInMachine } from "../shell/content";
import { getProfile, type MachineProfile } from "../profile/actions";
import { copy, DEPT_KEY } from "./config";
import { deptExtras, loadHealth, loadRepos, loadTasks, loadTeam, type RepoRow, type TasksView } from "./data";
import { Departments } from "./departments";
import { Footer } from "./footer";
import { Know } from "./know";
import { MorphButton } from "./morph-button";
import { Now } from "./now";
import { Run } from "./run";
import { quiet } from "./ui";

const MS = 200;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The machine's mega menu. A fixed two-line button morphs into an X; the full-screen dialog fades and
 * lifts in. Four columns centred on the screen: Departments · Now · Run · Know, over a footer strip.
 */
export function MachineMenu({ lang }: { lang: Locale }) {
  const isAr = lang === "ar";
  const t = tr(isAr);
  const inApp = useInMachine();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstDept = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [profile, setProfile] = useState<MachineProfile | null>(null);
  const [dept, setDept] = useState<string>("");
  const [tasks, setTasks] = useState<TasksView | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [health, setHealth] = useState<HealthReport | null>(null);

  const open = useCallback(() => {
    clearTimeout(timer.current);
    setMounted(true);
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);
  const close = useCallback(() => {
    setVisible(false);
    clearTimeout(timer.current);
    const done = () => {
      setMounted(false);
      document.documentElement.style.overflow = "";
    };
    if (reduced()) done();
    else timer.current = setTimeout(done, MS);
    trigger.current?.focus();
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Navigating closes it.
  useEffect(() => {
    if (mounted) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // The profile once; everything else each time it opens.
  useEffect(() => {
    if (!inApp) return;
    getProfile().then(setProfile).catch(() => setProfile(null));
  }, [inApp]);

  // Default = remembered choice if the profile still has it, else its first department.
  useEffect(() => {
    if (!profile?.departments.length) return;
    let saved = "";
    try {
      saved = localStorage.getItem(DEPT_KEY) ?? "";
    } catch {}
    const names = profile.departments.map((d) => d.name);
    setDept(names.includes(saved) ? saved : names[0]);
  }, [profile]);

  const choose = (name: string) => {
    setDept(name);
    try {
      localStorage.setItem(DEPT_KEY, name);
    } catch {}
  };

  useEffect(() => {
    if (!visible || !inApp) return;
    loadHealth().then(setHealth);
    loadRepos().then(setRepos);
  }, [visible, inApp]);

  useEffect(() => {
    if (!visible || !inApp || !dept) return;
    let live = true;
    setTasks(null);
    setTeam(null);
    setTasksLoading(true);
    loadTasks(dept).then((v) => {
      if (!live) return;
      setTasks(v);
      setTasksLoading(false);
    });
    loadTeam(dept).then((v) => live && setTeam(v));
    return () => {
      live = false;
    };
  }, [visible, inApp, dept]);

  // Focus into the dialog on open.
  useEffect(() => {
    if (visible) firstDept.current?.focus({ preventScroll: true });
  }, [visible, dept, profile]);

  // Esc closes; Tab stays inside the dialog and the button that closes it.
  useEffect(() => {
    if (!mounted) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !root.current) return;
      const items = [
        trigger.current,
        ...root.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"),
      ].filter((x): x is HTMLElement => !!x);
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next]?.focus();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [mounted, close]);

  const showCatalog = !profile || profile.access.catalog === "all" || profile.access.catalog === "profile";
  const showEngine = inApp === true && (!profile || profile.access.engine);
  const current = profile?.departments.find((d) => d.name === dept);
  const extras = current ? deptExtras(current) : { repos: [], docs: [] };

  return (
    <>
      <MorphButton
        buttonRef={trigger}
        open={visible}
        label={t(visible ? copy.close : copy.open)}
        onClick={visible ? close : open}
      />
      {mounted && (
        <div
          ref={root}
          role="dialog"
          aria-modal="true"
          aria-label={t(copy.title)}
          dir={isAr ? "rtl" : "ltr"}
          onClick={(e) => {
            const a = (e.target as HTMLElement).closest("a");
            if (a && a.target !== "_blank") close();
          }}
          className={cn(
            "fixed inset-0 z-50 flex h-dvh flex-col overflow-y-auto overscroll-contain bg-background text-foreground transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
            visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <nav
            aria-label={t(copy.title)}
            className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-8 px-6 pb-4 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))] lg:grid lg:grid-cols-4 lg:content-center lg:items-start lg:gap-x-10 lg:py-16"
          >
            {inApp && profile && profile.departments.length > 0 ? (
              <>
                <Departments
                  isAr={isAr}
                  profile={profile}
                  selected={dept}
                  onSelect={choose}
                  title={t(copy.departments)}
                  first={firstDept}
                />
                <Now lang={lang} view={tasks} loading={tasksLoading} onStarted={close} />
                <Run lang={lang} dept={current} />
                <Know lang={lang} repos={extras.repos} localRepos={repos} docs={extras.docs} team={team} />
              </>
            ) : (
              <p className={cn(quiet, "lg:col-span-4 lg:text-center")}>
                {inApp ? t(copy.noDept) : t(copy.appOnly)}
              </p>
            )}
          </nav>
          <Footer lang={lang} inApp={inApp === true} showCatalog={showCatalog} showEngine={showEngine} health={health} />
        </div>
      )}
    </>
  );
}
