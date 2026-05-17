/* eslint-disable */
// Login screen.

const LoginScreen = ({ onLogin, defaultRole }) => {
  const [role, setRole] = React.useState(defaultRole || "lead");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  // Prefill convenience
  React.useEffect(() => {
    if (role === "lead") { setUsername("uem.lead"); setPassword("lead"); }
    else { setUsername("manager"); setPassword("manager"); }
    setError("");
  }, [role]);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setTimeout(() => {
      if (role === "manager") {
        if (username === MANAGER.username && password === MANAGER.password) {
          onLogin({ role: "manager", username, name: MANAGER.name, displayRole: MANAGER.role });
        } else {
          setError("Invalid manager credentials. Try manager / manager.");
          setSubmitting(false);
        }
        return;
      }
      const t = TEAMS.find(tm => tm.lead.username === username && tm.lead.password === password);
      if (t) {
        onLogin({ role: "lead", teamId: t.id, username, name: t.lead.name, displayRole: `Team Lead · ${t.name}` });
      } else {
        setError("Invalid team-lead credentials. Try uem.lead / lead.");
        setSubmitting(false);
      }
    }, 280);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand">
          <div className="logo">TA</div>
          <div>
            <div className="product-name">Team Activity</div>
            <div className="product-sub">Work Overview · UEM</div>
          </div>
        </div>
        <h1>Sign in</h1>
        <p className="lead">Sign in as a team lead to plan high-level work, or as a manager to see across teams.</p>

        <div className="segmented" style={{ width: "100%", marginBottom: 14 }}>
          <button type="button" className={role === "lead" ? "active" : ""} onClick={() => setRole("lead")}>
            <Icon name="user" size={14}/> Team Lead
          </button>
          <button type="button" className={role === "manager" ? "active" : ""} onClick={() => setRole("manager")}>
            <Icon name="shield" size={14}/> Manager
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="field">
            <span>Username</span>
            <input type="text" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          </label>

          {error && <div className="err">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Icon name="lock" size={14}/> {submitting ? "Signing in…" : "Sign in"}
          </button>

          <div className="hint">
            <div style={{ marginBottom: 4, fontWeight: 800, color: "var(--text)" }}>Demo credentials</div>
            <div className="row"><span>Team lead</span> <span className="kbd">uem.lead / lead</span></div>
            <div className="row"><span>&nbsp;</span> <span className="kbd">iot.lead / lead</span></div>
            <div className="row"><span>&nbsp;</span> <span className="kbd">rems.lead / lead</span></div>
            <div className="row"><span>Manager</span> <span className="kbd">manager / manager</span></div>
          </div>
        </form>
      </div>
    </div>
  );
};

Object.assign(window, { LoginScreen });
