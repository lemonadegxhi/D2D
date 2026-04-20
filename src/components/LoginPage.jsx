export default function LoginPage({
  credentials,
  error,
  healthStatus,
  isSignupOpen,
  isWorking,
  onCloseSignup,
  onLogin,
  onOpenSignup,
  onSignup,
  setCredentials,
  setSignupForm,
  signupForm,
  status,
}) {
  return (
    <main className="app">
      <div className="container login-page">
        <h1>DAY2DAY Login</h1>
        <p className="health">{healthStatus}</p>
        <form className="login" onSubmit={onLogin} autoComplete="off">
          <input
            type="text"
            name="day2day-username"
            value={credentials.username}
            onChange={(event) =>
              setCredentials((current) => ({
                ...current,
                username: event.target.value,
              }))
            }
            placeholder="Username"
            autoComplete="off"
          />
          <input
            type="password"
            name="day2day-password"
            value={credentials.password}
            onChange={(event) =>
              setCredentials((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="Password"
            autoComplete="new-password"
          />
          <div className="login-actions">
            <button type="submit" disabled={isWorking}>
              {isWorking ? "Working..." : "Log in"}
            </button>
            <button type="button" disabled={isWorking} onClick={onOpenSignup}>
              Sign up
            </button>
          </div>
        </form>
        <p className="status">{status}</p>
        {error ? <p className="error">{error}</p> : null}
        {isSignupOpen ? (
          <div className="auth-overlay" role="presentation">
            <section
              className="auth-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="signup-title"
            >
              <div className="settings-header">
                <h2 id="signup-title">Sign up</h2>
                <button
                  type="button"
                  className="settings-close-button"
                  onClick={onCloseSignup}
                  aria-label="Close signup"
                  disabled={isWorking}
                >
                  Close
                </button>
              </div>
              <form className="signup-form" onSubmit={onSignup} autoComplete="off">
                <input
                  type="email"
                  name="signup-email"
                  value={signupForm.email}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Email"
                  autoComplete="email"
                  required
                />
                <input
                  type="text"
                  name="signup-username"
                  value={signupForm.username}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  placeholder="Username"
                  autoComplete="username"
                  required
                />
                <input
                  type="password"
                  name="signup-password"
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Password"
                  autoComplete="new-password"
                  required
                />
                <button type="submit" disabled={isWorking}>
                  {isWorking ? "Working..." : "Create account"}
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
