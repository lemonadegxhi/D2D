import { useState } from "react";

import MainMenu from "./MainMenu";
import SettingsPanel from "./SettingsPanel";
import { formatDate } from "../lib/formatters";

export default function AdminPage({
  authUser,
  error,
  isLoading,
  isMenuOpen,
  isSettingsOpen,
  isWorking,
  onChangePassword,
  onLoadUsers,
  onLogout,
  onOpenSettings,
  onRoleChange,
  onThemeChange,
  passwordForm,
  setIsMenuOpen,
  setIsSettingsOpen,
  setPage,
  setPasswordForm,
  status,
  theme,
  updatingUserId,
  users,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const visibleUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [user.username, user.email, user.role, formatDate(user.created_at)]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  return (
    <main className="app">
      <div className="container admin-page">
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
            <h1>Admin Accounts</h1>
          </div>
          <div className="top-actions">
            <button type="button" onClick={() => setPage("dashboard")}>
              Main Page
            </button>
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

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Signed-up Users</h2>
              <p className="status">
                {visibleUsers.length} of {users.length} account{users.length === 1 ? "" : "s"} shown.
              </p>
            </div>
            <div className="admin-panel-actions">
              <div className="user-search">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search users"
                  aria-label="Search users"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="search-clear-button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear user search"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={onLoadUsers} disabled={isLoading}>
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="users-table">
            <div className="users-table-head">
              <span>Username</span>
              <span>Email</span>
              <span>Role</span>
              <span>Created</span>
            </div>
            <div className="users-table-body">
              {isLoading && users.length === 0 ? (
                <div className="empty-state">
                  <p>Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="empty-state">
                  <p>No users found.</p>
                </div>
              ) : visibleUsers.length === 0 ? (
                <div className="empty-state">
                  <p>No users match "{searchQuery}".</p>
                </div>
              ) : (
                visibleUsers.map((user) => (
                  <div key={user.id} className="users-row">
                    <span>{user.username}</span>
                    <span>{user.email || "No email"}</span>
                    <span>
                      {user.role === "owner" ? (
                        <strong>owner</strong>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(event) => onRoleChange(user.id, event.target.value)}
                          disabled={updatingUserId === user.id}
                          aria-label={`Change role for ${user.username}`}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </span>
                    <span>{formatDate(user.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
