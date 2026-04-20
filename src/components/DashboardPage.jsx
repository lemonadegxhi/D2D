import MainMenu from "./MainMenu";
import SettingsPanel from "./SettingsPanel";
import { formatCalendarTimeRange } from "../lib/calendarUtils";

export default function DashboardPage({
  authUser,
  calendar,
  calendarError,
  calendarEventMap,
  calendarForm,
  error,
  isCalendarLoading,
  isCalendarSaving,
  isMenuOpen,
  isSettingsOpen,
  isWorking,
  onChangePassword,
  onCreateCalendarEvent,
  onDeleteCalendarEvent,
  onLogout,
  onOpenSettings,
  onThemeChange,
  passwordForm,
  setCalendarForm,
  setIsMenuOpen,
  setIsSettingsOpen,
  setPage,
  setPasswordForm,
  status,
  theme,
  upcomingCalendarEvents,
}) {
  return (
    <main className="app">
      <div className="container dashboard-page">
        <div className="top-row">
          <div className="top-left">
            <div className="menu-shell">
              <button
                type="button"
                className="menu-button"
                aria-label="Open menu"
                aria-expanded={isMenuOpen}
                onClick={() => setIsMenuOpen((current) => !current)}
              >
                <span />
                <span />
                <span />
              </button>
              {isMenuOpen ? (
                <MainMenu onOpenSettings={onOpenSettings} onLogout={onLogout} />
              ) : null}
            </div>
            <h1>DAY2DAY</h1>
          </div>
        </div>

        <p className="status">Logged in as: {authUser?.username}</p>
        <p className="status">{status}</p>
        {error ? <p className="error">{error}</p> : null}
        <SettingsPanel
          authUser={authUser}
          isOpen={isSettingsOpen}
          isWorking={isWorking}
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          theme={theme}
          onChangePassword={onChangePassword}
          onClose={() => setIsSettingsOpen(false)}
          onThemeChange={onThemeChange}
        />

        <section className="dashboard-layout">
          <div className="calendar-panel">
            <div className="calendar-header">
              <h2>{calendar.monthLabel}</h2>
              <p className="status">This month at a glance</p>
            </div>
            <div className="calendar-grid calendar-weekdays">
              {calendar.weekdayLabels.map((label) => (
                <span key={label} className="calendar-weekday">
                  {label}
                </span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendar.cells.map((cell) => (
                <div
                  key={cell.key}
                  className={`calendar-cell ${cell.isCurrentMonth ? "" : "muted"} ${
                    cell.isToday ? "today" : ""
                  }`}
                >
                  <span className="calendar-day-label">{cell.label}</span>
                  {cell.isCurrentMonth ? (
                    <div className="calendar-events">
                      {(calendarEventMap.get(cell.dateKey) || []).slice(0, 3).map((eventItem) => (
                        <span
                          key={eventItem.id}
                          className="calendar-event-pill"
                          title={
                            eventItem.description
                              ? `${eventItem.title} - ${eventItem.description}`
                              : eventItem.title
                          }
                        >
                          {eventItem.startTime ? `${eventItem.startTime} ` : ""}
                          {eventItem.title}
                        </span>
                      ))}
                      {(calendarEventMap.get(cell.dateKey) || []).length > 3 ? (
                        <span className="calendar-more-events">
                          +{(calendarEventMap.get(cell.dateKey) || []).length - 3} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-actions-panel">
            <div className="dashboard-card">
              <h2>File Explorer</h2>
              <p>Open the file app to manage folders, upload documents, and preview PDFs.</p>
              <button type="button" onClick={() => setPage("files")}>
                Go to Files
              </button>
            </div>
            <div className="dashboard-card">
              <h2>Calendar Events</h2>
              <p>
                Add your own events here. They are saved to your account and shown on the monthly
                calendar.
              </p>
              {calendarError ? <p className="error">{calendarError}</p> : null}
              <form className="calendar-form" onSubmit={onCreateCalendarEvent}>
                <input
                  type="text"
                  value={calendarForm.title}
                  onChange={(event) =>
                    setCalendarForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Event title"
                  maxLength={120}
                />
                <input
                  type="date"
                  value={calendarForm.eventDate}
                  onChange={(event) =>
                    setCalendarForm((current) => ({
                      ...current,
                      eventDate: event.target.value,
                    }))
                  }
                />
                <div className="calendar-form-times">
                  <input
                    type="time"
                    value={calendarForm.startTime}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="time"
                    value={calendarForm.endTime}
                    onChange={(event) =>
                      setCalendarForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <input
                  type="text"
                  value={calendarForm.description}
                  onChange={(event) =>
                    setCalendarForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Description (optional)"
                  maxLength={240}
                />
                <button type="submit" disabled={isCalendarSaving}>
                  {isCalendarSaving ? "Saving..." : "Add event"}
                </button>
              </form>
              {isCalendarLoading ? <p className="status">Loading calendar events...</p> : null}
              <div className="calendar-list">
                {upcomingCalendarEvents.length === 0 ? (
                  <p className="status">No events added for this month yet.</p>
                ) : (
                  upcomingCalendarEvents.map((eventItem) => (
                    <div key={eventItem.id} className="calendar-list-item">
                      <div>
                        <strong>{eventItem.title}</strong>
                        <p>
                          {eventItem.eventDate} - {formatCalendarTimeRange(eventItem)}
                        </p>
                        {eventItem.description ? <p>{eventItem.description}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteCalendarEvent(eventItem.id, eventItem.title)}
                        disabled={isCalendarSaving}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
