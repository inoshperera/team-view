/* eslint-disable */
// Drilldown view — mimics the existing "Team Activity Overview" Work board.

const Drilldown = ({ teamId, onClose }) => {
  const team = TEAMS.find(t => t.id === teamId);
  const people = PEOPLE_FOR_TEAM(teamId);
  const ticketsByPerson = {};
  (DRILL_TICKETS[teamId] || []).forEach(row => {
    if (!ticketsByPerson[row.personId]) ticketsByPerson[row.personId] = [];
    if (row.ticket) ticketsByPerson[row.personId].push(row.ticket);
  });

  // Aggregate stats matching the screenshot
  const totalTickets = Object.values(ticketsByPerson).reduce((n, arr) => n + arr.length, 0);
  const activePeople = Object.keys(ticketsByPerson).filter(pid => (ticketsByPerson[pid] || []).length > 0).length;
  const newOnHold = 59; // mock figure to match the screenshot

  return (
    <div>
      <div className="topbar" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Drill-down · {team?.name} · Work Overview</p>
          <h1 style={{ fontSize: "1.55rem" }}>Team Activity Overview</h1>
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={onClose}><Icon name="arrowLeft" size={14}/> Back to high-level</button>
          <button className="btn">Settings</button>
          <button className="btn btn-primary">Refresh</button>
        </div>
      </div>

      <div className="notice" data-tone="info">
        <Icon name="alert" size={16} color="#2563eb" />
        Work overview loaded · Showing Redmine work-tickets currently logged against {team?.name}.
      </div>

      <div className="controls-row">
        <label className="field"><span>Selection</span><select defaultValue="team"><option value="team">Team</option><option value="users">Users</option></select></label>
        <label className="field"><span>Team</span><select defaultValue={teamId}>{TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="check-row"><input type="checkbox" defaultChecked /> Show compact view</label>
      </div>

      <div className="drill-stats">
        <div className="summary-tile"><span className="summary-value">{totalTickets}</span><span className="summary-label">Working tickets</span></div>
        <div className="summary-tile"><span className="summary-value">{activePeople}</span><span className="summary-label">Active people</span></div>
        <div className="summary-tile"><span className="summary-value">{people.length}</span><span className="summary-label">Selected people</span></div>
        <div className="summary-tile"><span className="summary-value">{newOnHold}</span><span className="summary-label">New/on hold</span></div>
      </div>

      <div className="drill-board">
        {people.map(person => {
          const tickets = ticketsByPerson[person.id] || [];
          const isActive = tickets.length > 0;
          return (
            <div className="person-card" key={person.id}>
              <div className="person-head">
                <div>
                  <p className="person-name">{person.name}</p>
                  <p className="person-sub">{tickets.length} working ticket{tickets.length === 1 ? "" : "s"}</p>
                </div>
                <span className={"pill " + (isActive ? "pill-working" : "pill-onhold")}>{isActive ? "Working" : "No active work"}</span>
              </div>
              <div className="work-ticket-list-d">
                {tickets.length === 0 && <div className="empty" style={{ padding: "14px 12px" }}>No working tickets assigned.</div>}
                {tickets.map((t, i) => <WorkTicket key={i} t={t} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WorkTicket = ({ t }) => {
  return (
    <div className="work-ticket">
      <div className="work-ticket-phrase">{t.phrase}</div>
      <div className="work-ticket-title" style={{ whiteSpace: "pre-wrap" }}>{t.title}</div>
      <div className="work-ticket-fields">
        <div className={"work-ticket-field priority-" + t.priority}>
          <span className="work-ticket-label">◆ Priority</span>
          <span className={"work-ticket-value " + (t.priority === "critical" ? "critical" : t.priority === "medium" ? "medium" : "")}>
            {t.priorityLabel}
          </span>
        </div>
        <div className="date-stack">
          <div className="work-ticket-field">
            <span className="work-ticket-label">▷ Start</span>
            <span className="work-ticket-value">{t.start}</span>
          </div>
          <div className={"work-ticket-field " + t.dueState}>
            <span className="work-ticket-label">◷ Due</span>
            <span className={"work-ticket-value " + (t.dueState === "due-overdue" ? "critical" : t.dueState === "due-this-week" ? "medium" : "")}>{t.due}</span>
            <span className="due-hint">{t.dueLabel}</span>
          </div>
        </div>
      </div>
      <div className="progress-wrap">
        <div className="row">
          <span>Logged vs estimated</span>
          <span style={{ color: t.overrun ? "var(--attention)" : "var(--text)" }}>{t.logged}h / {t.estimated}h</span>
        </div>
        <div className="bar">
          <span className={t.overrun ? "warn" : ""} style={{ width: Math.min(100, Math.round(100 * t.logged / Math.max(1, t.estimated))) + "%" }} />
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Drilldown, WorkTicket });
