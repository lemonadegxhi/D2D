export function buildCalendarDays(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  const today = new Date();

  for (let index = 0; index < startWeekday; index += 1) {
    cells.push({
      key: `empty-start-${index}`,
      label: "",
      dateKey: null,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isToday =
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    cells.push({
      key: `day-${day}`,
      label: String(day),
      dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      isCurrentMonth: true,
      isToday,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `empty-end-${cells.length}`,
      label: "",
      dateKey: null,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  return {
    monthLabel: new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(firstDay),
    weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    cells,
  };
}

export function getMonthDateKey(value) {
  return String(value || "").slice(0, 10);
}

export function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function formatCalendarTimeRange(eventItem) {
  if (eventItem.startTime && eventItem.endTime) {
    return `${eventItem.startTime}-${eventItem.endTime}`;
  }

  if (eventItem.startTime) {
    return eventItem.startTime;
  }

  return "All day";
}
