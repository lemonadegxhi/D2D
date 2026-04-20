export default function MainMenu({ onOpenSettings, onLogout }) {
  return (
    <div className="menu-dropdown">
      <button type="button" className="menu-item" onClick={onOpenSettings}>
        Settings
      </button>
      <button type="button" className="menu-item" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
