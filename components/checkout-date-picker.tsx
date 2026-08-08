"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiCalendar, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import {
  addDaysToIsoDate,
  formatDispatchDate,
  getIsoDateWeekday,
  getLondonTodayIso,
} from "@/lib/dispatch";
import styles from "@/components/checkout-date-picker.module.css";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function getMonthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function addMonthsToIsoMonth(monthDate: string, delta: number) {
  const parsed = new Date(`${monthDate}T00:00:00Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + delta);
  return parsed.toISOString().slice(0, 10);
}

function getMonthDays(monthDate: string) {
  const monthStart = getMonthStart(monthDate);
  const firstDay = new Date(`${monthStart}T00:00:00Z`);
  const nextMonth = new Date(firstDay);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);

  const leadingDays = (getIsoDateWeekday(monthStart) + 6) % 7;
  const daysInMonth = nextMonth.getUTCDate();
  const days: Array<{ date: string; inMonth: boolean }> = [];

  for (let index = leadingDays; index > 0; index -= 1) {
    days.push({ date: addDaysToIsoDate(monthStart, -index), inMonth: false });
  }

  for (let day = 0; day < daysInMonth; day += 1) {
    days.push({ date: addDaysToIsoDate(monthStart, day), inMonth: true });
  }

  while (days.length % 7 !== 0) {
    days.push({
      date: addDaysToIsoDate(days.at(-1)?.date ?? monthStart, 1),
      inMonth: false,
    });
  }

  return days;
}

export default function CheckoutDatePicker({
  availableDates,
  selectedDate,
  onSelect,
  purpose,
}: {
  availableDates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  purpose: "dispatch" | "collection";
}) {
  const firstAvailableDate = availableDates[0] ?? getLondonTodayIso();
  const lastAvailableDate = availableDates.at(-1) ?? firstAvailableDate;
  const selectedAvailableDate = availableDates.includes(selectedDate) ? selectedDate : "";
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(getMonthStart(selectedAvailableDate || firstAvailableDate));
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);
  const monthDays = useMemo(() => getMonthDays(visibleMonth), [visibleMonth]);
  const minMonth = getMonthStart(firstAvailableDate);
  const maxMonth = getMonthStart(lastAvailableDate);
  const hasDates = availableDates.length > 0;

  useEffect(() => {
    setVisibleMonth(getMonthStart(selectedAvailableDate || firstAvailableDate));
  }, [firstAvailableDate, selectedAvailableDate]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && pickerRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className={styles.picker} ref={pickerRef}>
      <span className={styles.label}>{purpose === "collection" ? "Collection date" : "Dispatch date"}</span>
      <button
        type="button"
        className={styles.dateButton}
        onClick={() => setIsOpen((current) => !current)}
        disabled={!hasDates}
        aria-expanded={isOpen}
      >
        <FiCalendar aria-hidden="true" />
        <span>{selectedAvailableDate ? formatDispatchDate(selectedAvailableDate) : `Choose a ${purpose} date`}</span>
      </button>

      {isOpen && hasDates ? (
        <div className={styles.calendar} role="dialog" aria-label={`Choose a ${purpose} date`}>
          <div className={styles.header}>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonthsToIsoMonth(current, -1))}
              disabled={visibleMonth <= minMonth}
              aria-label="Previous month"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <strong>{monthFormatter.format(new Date(`${visibleMonth}T00:00:00Z`))}</strong>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => addMonthsToIsoMonth(current, 1))}
              disabled={visibleMonth >= maxMonth}
              aria-label="Next month"
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAY_LABELS.map((day) => <span key={day}>{day}</span>)}
          </div>

          <div className={styles.days}>
            {monthDays.map((day) => {
              const isAvailable = day.inMonth && availableDateSet.has(day.date);
              const isSelected = day.date === selectedAvailableDate;

              return (
                <button
                  key={day.date}
                  type="button"
                  className={[styles.day, !day.inMonth ? styles.muted : "", isSelected ? styles.selected : ""]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!isAvailable}
                  onClick={() => {
                    onSelect(day.date);
                    setIsOpen(false);
                  }}
                  aria-pressed={isSelected}
                >
                  {Number.parseInt(day.date.slice(-2), 10)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
