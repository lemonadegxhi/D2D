import { AVAILABLE_THEMES } from "../lib/theme";

export default function SettingsPanel({
  authUser,
  isOpen,
  isWorking,
  passwordForm,
  setPasswordForm,
  theme,
  onChangePassword,
  onClose,
  onThemeChange,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-overlay" role="presentation">
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="settings-close-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            Close
          </button>
        </div>

        <section className="settings-section">
          <h3>Profile</h3>
          <p className="status">Username: {authUser?.username}</p>
          <form className="password-form" onSubmit={onChangePassword} autoComplete="off">
            <input
              type="password"
              name="current-day2day-password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
              placeholder="Current password"
              autoComplete="current-password"
            />
            <input
              type="password"
              name="new-day2day-password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
              placeholder="New password"
              autoComplete="new-password"
            />
            <input
              type="password"
              name="confirm-day2day-password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            <button type="submit" disabled={isWorking}>
              {isWorking ? "Working..." : "Change password"}
            </button>
          </form>
        </section>

        <section className="settings-section">
          <h3>Theme</h3>
          <div className="settings-theme-options">
            {AVAILABLE_THEMES.map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                className={`settings-theme-button ${theme === themeOption ? "active" : ""}`}
                onClick={() => onThemeChange(themeOption)}
              >
                {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
              </button>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
