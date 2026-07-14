/* eslint-disable */
// Shared UI atoms: chips, pills, avatars, modal, icons.

const Icon = ({ name, size = 16, color = "currentColor", style }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: 2,
    strokeLinecap: "round", strokeLinejoin: "round",
    style,
  };
  switch (name) {
    case "plus":   return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "edit":   return <svg {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>;
    case "trash":  return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
    case "x":      return <svg {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case "calendar": return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
    case "user":   return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "users":  return <svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "external": return <svg {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
    case "chevronRight": return <svg {...props}><polyline points="9 18 15 12 9 6"/></svg>;
    case "arrowLeft": return <svg {...props}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
    case "flag":   return <svg {...props}><path d="M4 22V4a1 1 0 0 1 1-1h13l-2 4 2 4H5"/><line x1="4" y1="22" x2="4" y2="14"/></svg>;
    case "logout": return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case "filter": return <svg {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case "check":  return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case "link":   return <svg {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
    case "shield": return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case "lock":   return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "lightning": return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "alert":  return <svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "list":   return <svg {...props}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    default: return null;
  }
};

const cat = (id) => CATEGORIES.find(c => c.id === id);
const pri = (id) => PRIORITIES.find(p => p.id === id);
const stat = (id) => STATUSES.find(s => s.id === id);
const proj = (id) => PROJECTS.find(p => p.id === id);
const person = (id) => PEOPLE.find(p => p.id === id);

const CategoryChip = ({ id }) => {
  const c = cat(id); if (!c) return null;
  return <span className={`chip ${c.cls}`}>{c.label}</span>;
};

const StatusPill = ({ id }) => {
  const s = stat(id); if (!s) return null;
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
};

const AvatarStack = ({ ids, max = 3, size }) => {
  const visible = ids.slice(0, max);
  const overflow = ids.length - visible.length;
  return (
    <span className="avatars">
      {visible.map(id => {
        const p = person(id);
        if (!p) return null;
        const initials = p.name.split(/\s+/).map(s => s[0]).slice(0, 2).join("");
        return (
          <span key={id} className={`avatar ${p.av} ${size === 'lg' ? 'lg' : ''}`} title={p.name}>
            {initials}
          </span>
        );
      })}
      {overflow > 0 && <span className={`avatar more ${size === 'lg' ? 'lg' : ''}`}>+{overflow}</span>}
    </span>
  );
};

// Modal -------------------------------------------------
const Modal = ({ open, title, eyebrow, onClose, footer, children, wide }) => {
  React.useEffect(() => {
    if (!open) return;
    const k = e => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// Date helpers ---------------------------------------------
const TODAY = new Date("2026-05-17T08:36:00"); // pin to match the screenshot

const dayDiff = (a, b) => {
  const ms = 1000 * 60 * 60 * 24;
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.round((db - da) / ms);
};
const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
};
const dueState = (iso) => {
  if (!iso) return { label: "—", cls: "" };
  const diff = dayDiff(TODAY, iso);
  if (diff < 0) return { label: "Overdue", cls: "overdue" };
  if (diff <= 7) return { label: "Due this week", cls: "duesoon" };
  return { label: "Upcoming", cls: "" };
};

Object.assign(window, {
  Icon, CategoryChip, StatusPill, AvatarStack, Modal,
  cat, pri, stat, proj, person, formatDate, dueState, dayDiff, TODAY,
});
