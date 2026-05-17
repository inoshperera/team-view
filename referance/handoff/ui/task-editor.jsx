/* eslint-disable */
// Task editor and task card.

const TaskCard = ({ task, onOpen, onEdit, onDelete, showTeam, canEdit, layout }) => {
  const p = pri(task.priority);
  const projectName = proj(task.projectId)?.name || "—";
  const ds = dueState(task.dueDate);
  const isWide = layout === "list";
  const members = (task.members || []).map(id => person(id)).filter(Boolean);

  return (
    <div className={"task-card " + p.cls + (isWide ? " task-card-wide" : "")}
         onClick={() => onOpen && onOpen(task)} role="button" tabIndex="0"
         onKeyDown={(e) => { if (e.key === "Enter") onOpen && onOpen(task); }}>
      <div className="head">
        <div className="head-left">
          <div className="chip-row">
            <CategoryChip id={task.category} />
            {showTeam && task.teamId && <span className="chip chip-team">{TEAMS.find(t => t.id === task.teamId)?.name || task.teamId}</span>}
            {task.redmineLinked && (
              <span className="chip chip-synced chip-icon" title="Synced from Redmine"
                    aria-label="Synced from Redmine">
                <Icon name="link" size={11}/>
              </span>
            )}
          </div>
          <h4>{task.title}</h4>
          {isWide && task.description && <div className="desc">{task.description}</div>}
        </div>
        <div className="head-meta">
          <StatusPill id={task.status} />
          {canEdit && (
            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-xs" title="Edit" onClick={() => onEdit && onEdit(task)}>
                <Icon name="edit" size={12}/>
              </button>
              <button className="btn btn-xs btn-danger" title="Delete" onClick={() => onDelete && onDelete(task)}>
                <Icon name="trash" size={12}/>
              </button>
            </div>
          )}
        </div>
      </div>

      {!isWide && task.description && (
        <div className="desc desc-clamp">{task.description}</div>
      )}

      <div className="meta-grid">
        <div className="meta">
          <span className="lbl">Project</span>
          <span className="val val-sm">{projectName}</span>
        </div>
        <div className="meta">
          <span className="lbl">Priority</span>
          <span className="val">
            <span className={"priority-dot " + p.dot} style={{ marginRight: 6 }}/>
            {p.label}
          </span>
        </div>
        <div className="meta">
          <span className="lbl">Due</span>
          <span className={"val " + ds.cls}>{formatDate(task.dueDate)}</span>
          <span className="sub">{ds.label}</span>
        </div>
        <div className="meta">
          <span className="lbl">Linked issue</span>
          {task.redmineIssue ? (
            <a className="redmine-link inline" href="#"
               onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen && onOpen(task); }}>
              <Icon name="link" size={11}/> {task.redmineIssue}
            </a>
          ) : (
            <span className="no-redmine">Not linked</span>
          )}
        </div>
        {isWide && (
          <div className="meta">
            <span className="lbl">Progress</span>
            <span className="val">
              <span className="inline-bar"><span style={{ width: (task.progress || 0) + "%" }}/></span>
              <span className="val-sub">{task.progress || 0}%</span>
            </span>
          </div>
        )}
      </div>

      <div className="member-strip">
        <span className="member-strip-label">Members ({members.length})</span>
        <div className="member-strip-list">
          {members.length === 0 ? (
            <span className="no-members">No members assigned</span>
          ) : (
            members.map(m => {
              const initials = m.name.split(/\s+/).map(s => s[0]).slice(0, 2).join("");
              return (
                <span key={m.id} className="member-pill" title={m.name}>
                  <span className={"avatar avatar-xs " + m.av}>{initials}</span>
                  <span className="member-name">{m.name}</span>
                </span>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------
// Task Editor (Create + Edit)
// --------------------------------------------------------
const TaskEditor = ({ open, onClose, onSave, onDelete, initial, teamId, teamName }) => {
  const [task, setTask] = React.useState(null);
  const isEdit = !!(initial && initial.id);

  React.useEffect(() => {
    if (!open) return;
    setTask(initial ? { ...initial } : {
      id: "", teamId: teamId,
      title: "", description: "",
      category: "dev",
      priority: "medium",
      projectId: PROJECTS[0].id,
      redmineIssue: "",
      redmineLinked: false,
      members: [],
      status: "working",
      startDate: new Date(TODAY).toISOString().slice(0, 10),
      dueDate: "",
      progress: 0,
    });
  }, [open, initial, teamId]);

  if (!open || !task) return null;
  const set = (patch) => setTask(t => ({ ...t, ...patch }));
  const toggleMember = (id) => {
    setTask(t => ({ ...t, members: t.members.includes(id) ? t.members.filter(m => m !== id) : [...t.members, id] }));
  };

  const teamMembers = PEOPLE_FOR_TEAM(task.teamId || teamId);
  const projectTickets = REDMINE_TICKETS[task.projectId] || [];
  const valid = task.title.trim().length > 1 && task.dueDate;

  // Selecting a Redmine ticket: pull synced fields, mark linked.
  const linkTicket = (ticketId) => {
    if (!ticketId) {
      // Unlink → keep current values but flip flag, fields become editable.
      setTask(t => ({ ...t, redmineLinked: false, redmineIssue: "" }));
      return;
    }
    const tk = projectTickets.find(t => t.id === ticketId);
    if (!tk) return;
    setTask(t => ({
      ...t,
      redmineIssue: tk.id,
      redmineLinked: true,
      status: tk.status,
      progress: tk.progress,
      startDate: tk.startDate,
      dueDate: tk.dueDate,
      members: tk.assignees ? [...tk.assignees] : (t.members || []),
    }));
  };

  const onProjectChange = (e) => {
    // Project changed → if there was a linked ticket, unlink because it
    // belonged to the old project.
    const projectId = e.target.value;
    setTask(t => ({
      ...t,
      projectId,
      redmineIssue: t.redmineLinked ? "" : t.redmineIssue,
      redmineLinked: false,
    }));
  };

  const save = () => {
    if (!valid) return;
    const id = isEdit ? task.id : ("t-" + Math.floor(Math.random() * 9000 + 1000));
    onSave({ ...task, id, teamId: task.teamId || teamId, created: task.created || new Date(TODAY).toISOString().slice(0,10) });
    onClose();
  };

  const syncedHint = (
    <span className="synced-hint">
      <Icon name="link" size={11}/> Synced from Redmine
    </span>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? `Edit task · ${teamName || ""}` : `New task · ${teamName || ""}`}
      title={isEdit ? "Edit high-level task" : "Add high-level task"}
      footer={
        <>
          {isEdit ? (
            <button className="btn btn-danger" onClick={() => { if (confirm("Delete this task?")) { onDelete(task); onClose(); } }}>
              <Icon name="trash" size={14}/> Delete
            </button>
          ) : <span />}
          <div className="actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={!valid}>
              <Icon name="check" size={14}/> {isEdit ? "Save changes" : "Create task"}
            </button>
          </div>
        </>
      }
    >
      <div className="form-grid">
        <label className="field full">
          <span className="req">Title</span>
          <input type="text" value={task.title} onChange={e => set({ title: e.target.value })}
                 placeholder="e.g. Customer escalation – ACME UEM agent rollout" autoFocus />
        </label>

        <div className="field full">
          <span>Category</span>
          <div className="segmented cat">
            {CATEGORIES.map(c => (
              <button key={c.id} type="button" className={(task.category === c.id ? "active " : "") + c.segCls}
                      onClick={() => set({ category: c.id })}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field full">
          <span>Priority</span>
          <div className="priority-bar">
            {PRIORITIES.map(p => (
              <button key={p.id} type="button" className={(task.priority === p.id ? "active " : "") + p.cls}
                      onClick={() => set({ priority: p.id })}>
                <span className={"priority-dot " + p.dot} />{p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="req">Project</span>
          <select value={task.projectId} onChange={onProjectChange}>
            {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Redmine ticket</span>
          <select value={task.redmineLinked ? task.redmineIssue : ""} onChange={e => linkTicket(e.target.value)}>
            <option value="">— Not tracked in Redmine —</option>
            {projectTickets.map(t => (
              <option key={t.id} value={t.id}>{t.id} · {t.title}</option>
            ))}
          </select>
        </label>

        {/* Synced fields panel — when a Redmine ticket is linked */}
        {task.redmineLinked && (
          <div className="full synced-panel">
            <div className="synced-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Synced fields</p>
                <p className="synced-lead">
                  Status, progress, dates and assignees are kept in sync with <strong>{task.redmineIssue}</strong> and its sub-tickets by the backend.
                  Update them in Redmine to change them here.
                </p>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => linkTicket("")}>
                <Icon name="x" size={12}/> Unlink
              </button>
            </div>
            <div className="synced-grid">
              <div className="synced-cell">
                <span className="lbl">Status {syncedHint}</span>
                <StatusPill id={task.status} />
              </div>
              <div className="synced-cell">
                <span className="lbl">Progress {syncedHint}</span>
                <div className="synced-progress">
                  <div className="inline-bar"><span style={{ width: (task.progress || 0) + "%" }}/></div>
                  <span className="val">{task.progress || 0}%</span>
                </div>
              </div>
              <div className="synced-cell">
                <span className="lbl">Start date {syncedHint}</span>
                <span className="val">{formatDate(task.startDate)}</span>
              </div>
              <div className="synced-cell">
                <span className="lbl">Due date {syncedHint}</span>
                <span className="val">{formatDate(task.dueDate)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Editable fields — when NOT linked to a Redmine ticket */}
        {!task.redmineLinked && (
          <>
            <label className="field">
              <span>Status</span>
              <select value={task.status} onChange={e => set({ status: e.target.value })}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>

            <label className="field">
              <span>Progress (%)</span>
              <input type="number" min="0" max="100" value={task.progress}
                     onChange={e => set({ progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </label>

            <label className="field">
              <span>Start date</span>
              <input type="date" value={task.startDate} onChange={e => set({ startDate: e.target.value })} />
            </label>

            <label className="field">
              <span className="req">Due date</span>
              <input type="date" value={task.dueDate} onChange={e => set({ dueDate: e.target.value })} />
            </label>
          </>
        )}

        <div className="field full">
          <span>
            Assigned members
            {task.redmineLinked && <span className="synced-hint" style={{ marginLeft: 8 }}><Icon name="link" size={11}/> Synced from Redmine</span>}
          </span>
          {task.redmineLinked ? (
            <div className="member-picker locked">
              {(task.members || []).length === 0 ? (
                <div className="empty" style={{ padding: "12px" }}>
                  <div className="title">No assignees on this Redmine ticket</div>
                </div>
              ) : (
                (task.members || []).map(id => {
                  const m = person(id); if (!m) return null;
                  return (
                    <div key={id} className="member-row member-row-locked">
                      <span className={"avatar " + m.av}>{m.name.split(/\s+/).map(s => s[0]).slice(0, 2).join("")}</span>
                      <span className="name">{m.name}</span>
                      <span className="sub">{TEAMS.find(t => t.id === m.teamId)?.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="member-picker">
              {teamMembers.map(m => (
                <label key={m.id} className="member-row">
                  <input type="checkbox" checked={task.members.includes(m.id)} onChange={() => toggleMember(m.id)} />
                  <span className={"avatar " + m.av}>{m.name.split(/\s+/).map(s => s[0]).slice(0, 2).join("")}</span>
                  <span className="name">{m.name}</span>
                  <span className="sub">{TEAMS.find(t => t.id === m.teamId)?.name}</span>
                </label>
              ))}
              {teamMembers.length === 0 && <div className="empty"><div className="title">No team members</div></div>}
            </div>
          )}
        </div>

        <label className="field full">
          <span>Description / notes</span>
          <textarea rows="3" value={task.description} onChange={e => set({ description: e.target.value })}
                    placeholder="Optional details, links, acceptance notes…" />
        </label>
      </div>
    </Modal>
  );
};

Object.assign(window, { TaskCard, TaskEditor });
