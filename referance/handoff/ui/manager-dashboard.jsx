/* eslint-disable */
// Manager dashboard — cross-team priority/category lanes view.

const ManagerDashboard = ({ user, tasks, onCreate, onEdit, onDelete, onLogout, onDrilldown, layout, groupMode, onLayoutChange, onGroupChange }) => {
  const [teamFilter, setTeamFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [memberFilter, setMemberFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const filtered = tasks.filter(t => {
    if (teamFilter !== "all" && t.teamId !== teamFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (memberFilter !== "all" && !(t.members || []).includes(memberFilter)) return false;
    if (search && !((t.title + " " + (t.description || "")).toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  // Members list — narrowed to the picked team when one is selected.
  const memberPool = teamFilter === "all"
    ? PEOPLE
    : PEOPLE.filter(p => p.teamId === teamFilter);

  // Stats — aggregated across teams (or the filtered team)
  const scope = teamFilter === "all" ? tasks : tasks.filter(t => t.teamId === teamFilter);
  const totals = {
    teams: TEAMS.length,
    open: scope.filter(t => t.status !== "done").length,
    critical: scope.filter(t => t.priority === "critical" && t.status !== "done").length,
    overdue: scope.filter(t => t.dueDate && dayDiff(TODAY, t.dueDate) < 0 && t.status !== "done").length,
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Management view · {TEAMS.length} teams</p>
          <h1>Cross-team Activity Planner</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <span className="avatar lg av-h">{user.name.split(/\s+/).map(s=>s[0]).slice(0,2).join("")}</span>
            <div className="who">
              <span className="name">{user.name}</span>
              <span className="role">{user.displayRole}</span>
            </div>
          </div>
          {teamFilter !== "all" && (
            <button className="btn" onClick={() => onDrilldown(teamFilter)}>
              <Icon name="external" size={14}/> Drill-down · {TEAMS.find(t => t.id === teamFilter)?.name}
            </button>
          )}
          <button className="btn" onClick={onLogout}><Icon name="logout" size={14}/> Sign out</button>
          <button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={14}/> Add task</button>
        </div>
      </header>

      <div className="controls-row">
        <label className="field">
          <span>Team</span>
          <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setMemberFilter("all"); }}>
            <option value="all">All teams</option>
            {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Member</span>
          <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
            <option value="all">All members</option>
            {memberPool.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}{teamFilter === "all" ? ` · ${TEAMS.find(t => t.id === m.teamId)?.name || ""}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="all">All</option>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 200 }}>
          <span>Search</span>
          <input type="search" placeholder="Search title or description" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <div className="spacer"/>
        <div className="actions">
          <div className="segmented" style={{ width: "auto" }}>
            <button className={groupMode === "priority" ? "active" : ""} onClick={() => onGroupChange("priority")}>
              <Icon name="flag" size={14}/> By priority
            </button>
            <button className={groupMode === "category" ? "active" : ""} onClick={() => onGroupChange("category")}>
              <Icon name="list" size={14}/> By category
            </button>
          </div>
          <div className="segmented" style={{ width: "auto" }}>
            <button className={layout === "lanes" ? "active" : ""} onClick={() => onLayoutChange("lanes")}>Lanes</button>
            <button className={layout === "list" ? "active" : ""} onClick={() => onLayoutChange("list")}>List</button>
          </div>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-tile"><span className="summary-value">{totals.teams}</span><span className="summary-label">Teams</span></div>
        <div className="summary-tile"><span className="summary-value">{totals.open}</span><span className="summary-label">Open high-level tasks</span></div>
        <div className="summary-tile"><span className="summary-value" style={{ color: "var(--pri-critical-text)" }}>{totals.critical}</span><span className="summary-label">Critical</span></div>
        <div className="summary-tile"><span className="summary-value" style={{ color: "var(--pri-critical-text)" }}>{totals.overdue}</span><span className="summary-label">Overdue</span></div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="title">No tasks match your filters</div>
          <div>Try clearing filters, or <a className="link" href="#" onClick={(e) => { e.preventDefault(); onCreate(); }}>add a new high-level task</a>.</div>
        </div>
      ) : groupMode === "priority" ? (
        <Lanes
          buckets={PRIORITIES.filter(p => p.id !== "none").map(p => ({ key: p.id, label: p.label, dot: p.dot, items: filtered.filter(t => t.priority === p.id) }))}
          onOpen={onEdit} onEdit={onEdit} onDelete={onDelete} layout={layout} canEdit showTeam
        />
      ) : (
        <Lanes
          buckets={CATEGORIES.map(c => ({ key: c.id, label: c.label, dot: null, items: filtered.filter(t => t.category === c.id), chipCls: c.cls }))}
          onOpen={onEdit} onEdit={onEdit} onDelete={onDelete} layout={layout} canEdit showTeam
        />
      )}
    </main>
  );
};

Object.assign(window, { ManagerDashboard });
