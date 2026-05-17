/* eslint-disable */
// Team Lead dashboard — high-level tasks for the lead's team.

const groupBy = (arr, key) => arr.reduce((acc, x) => { (acc[x[key]] ||= []).push(x); return acc; }, {});

const TeamLeadDashboard = ({ user, tasks, onCreate, onEdit, onDelete, onLogout, onDrilldown, layout, groupMode, onLayoutChange, onGroupChange }) => {
  const team = TEAMS.find(t => t.id === user.teamId);
  const teamTasks = tasks.filter(t => t.teamId === user.teamId);
  const teamMembers = PEOPLE_FOR_TEAM(user.teamId);

  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [memberFilter, setMemberFilter] = React.useState("all");

  const filtered = teamTasks.filter(t => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (memberFilter !== "all" && !(t.members || []).includes(memberFilter)) return false;
    if (search && !((t.title + " " + (t.description || "")).toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  // Stats
  const totals = {
    open: teamTasks.filter(t => t.status !== "done").length,
    critical: teamTasks.filter(t => t.priority === "critical").length,
    dueThisWeek: teamTasks.filter(t => t.dueDate && dayDiff(TODAY, t.dueDate) >= 0 && dayDiff(TODAY, t.dueDate) <= 7).length,
    overdue: teamTasks.filter(t => t.dueDate && dayDiff(TODAY, t.dueDate) < 0 && t.status !== "done").length,
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">High-level work · {team?.name}</p>
          <h1>Team Activity Planner</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-chip">
            <span className="avatar lg av-a">{user.name.split(/\s+/).map(s=>s[0]).slice(0,2).join("")}</span>
            <div className="who">
              <span className="name">{user.name}</span>
              <span className="role">{user.displayRole}</span>
            </div>
          </div>
          <button className="btn" onClick={() => onDrilldown(user.teamId)}>
            <Icon name="external" size={14}/> Drill-down to Work Overview
          </button>
          <button className="btn" onClick={onLogout}><Icon name="logout" size={14}/> Sign out</button>
          <button className="btn btn-primary" onClick={onCreate}><Icon name="plus" size={14}/> Add task</button>
        </div>
      </header>

      <div className="controls-row">
        <label className="field">
          <span>Member</span>
          <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
            <option value="all">All members</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 220 }}>
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
        <div className="summary-tile"><span className="summary-value">{totals.open}</span><span className="summary-label">Open high-level tasks</span></div>
        <div className="summary-tile"><span className="summary-value" style={{ color: "var(--pri-critical-text)" }}>{totals.critical}</span><span className="summary-label">Critical priority</span></div>
        <div className="summary-tile"><span className="summary-value" style={{ color: "var(--pri-medium-text)" }}>{totals.dueThisWeek}</span><span className="summary-label">Due this week</span></div>
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
          onOpen={onEdit} onEdit={onEdit} onDelete={onDelete} layout={layout} canEdit
        />
      ) : (
        <Lanes
          buckets={CATEGORIES.map(c => ({ key: c.id, label: c.label, dot: null, items: filtered.filter(t => t.category === c.id), chipCls: c.cls }))}
          onOpen={onEdit} onEdit={onEdit} onDelete={onDelete} layout={layout} canEdit
        />
      )}
    </main>
  );
};

const Lanes = ({ buckets, onOpen, onEdit, onDelete, layout, canEdit, showTeam }) => {
  if (layout === "list") {
    return (
      <div style={{ display: "grid", gap: 22 }}>
        {buckets.map(b => (
          <section key={b.key}>
            <div className="lane-head" style={{ paddingLeft: 0 }}>
              <div className="lane-title">
                {b.dot && <span className={"priority-dot " + b.dot}/>}
                {b.chipCls && <span className={"chip " + b.chipCls}>{b.label}</span>}
                {!b.chipCls && b.label}
              </div>
              <span className="lane-count">{b.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {b.items.length === 0 && <div className="empty">No tasks in this {b.label.toLowerCase()} bucket.</div>}
              {b.items.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} showTeam={showTeam} layout="list" />)}
            </div>
          </section>
        ))}
      </div>
    );
  }
  // lanes layout
  return (
    <div className="lanes">
      {buckets.map(b => (
        <div className="lane" key={b.key}>
          <div className="lane-head">
            <div className="lane-title">
              {b.dot && <span className={"priority-dot " + b.dot}/>}
              {b.chipCls ? <span className={"chip " + b.chipCls}>{b.label}</span> : b.label}
            </div>
            <span className="lane-count">{b.items.length}</span>
          </div>
          {b.items.length === 0 && <div className="empty" style={{ padding: "16px 12px" }}>—</div>}
          {b.items.map(t => <TaskCard key={t.id} task={t} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} showTeam={showTeam} layout="lanes"/>)}
        </div>
      ))}
    </div>
  );
};

Object.assign(window, { TeamLeadDashboard, Lanes });
