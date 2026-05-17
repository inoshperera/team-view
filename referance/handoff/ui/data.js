/* eslint-disable */
/* ============================================================================
 * !!!  DEMO-ONLY DATA  — REMOVE BEFORE PRODUCTION  !!!
 * ============================================================================
 * Every constant in this file is hardcoded for the standalone prototype.
 *
 * When wiring to the real backend you MUST replace each of these with fetched
 * data and DELETE this file from production:
 *
 *   TEAMS, MANAGER, PEOPLE
 *       → GET /api/teams   (returns teams w/ lead + members)
 *       → GET /api/auth/me (returns the current user incl. role + teamId)
 *
 *   PROJECTS
 *       → GET /api/projects?active=true
 *
 *   CATEGORIES, PRIORITIES, STATUSES
 *       → GET /api/categories | /api/priorities | /api/statuses
 *         (or inline as constants — they map 1:1 to the DB lookup tables)
 *
 *   REDMINE_TICKETS
 *       → GET /api/projects/{id}/redmine-tickets
 *
 *   SEED_TASKS
 *       → GET /api/tasks?team_id=…  (or seed via real CRUD calls)
 *
 *   DRILL_TICKETS
 *       → existing /api/work-overview?team_id=… in your proxy.py
 *
 *   TODAY (in components.jsx)
 *       → remove the pinned date and use `new Date()`
 *
 * Demo credentials (uem.lead/lead, manager/manager) are bypassed entirely once
 * the LDAP login route is in place — see INTEGRATION_GUIDE.md § Auth.
 * ============================================================================
 */
// Mock data for the Highlevel Tasks prototype.
// In a real backend this would come from the Redmine proxy.

const TEAMS = [
  { id: "uem",      name: "UEM",       lead: { username: "uem.lead",     password: "lead",     name: "Arshana Atapattu" } },
  { id: "iot",      name: "IoT",       lead: { username: "iot.lead",     password: "lead",     name: "Navod Zoysa" } },
  { id: "rems",     name: "REMS",      lead: { username: "rems.lead",    password: "lead",     name: "Nipuni Kavindya" } },
  { id: "platform", name: "Platform",  lead: { username: "plat.lead",    password: "lead",     name: "Kavin Prathaban" } },
];

const MANAGER = { username: "manager", password: "manager", name: "Dilani Perera", role: "Engineering Manager" };

// People (used both for assignment, and to mimic the existing per-user board)
const PEOPLE = [
  { id: "p1", name: "Arshana Atapattu",  teamId: "uem",      av: "av-a" },
  { id: "p2", name: "Navod Zoysa",       teamId: "iot",      av: "av-b" },
  { id: "p3", name: "Nipuni Kavindya",   teamId: "rems",     av: "av-c" },
  { id: "p4", name: "Kavin Prathaban",   teamId: "platform", av: "av-d" },
  { id: "p5", name: "Sahan Wickrama",    teamId: "uem",      av: "av-e" },
  { id: "p6", name: "Tharushi Senanayake",teamId: "uem",     av: "av-f" },
  { id: "p7", name: "Ishan Rathnayake",  teamId: "iot",      av: "av-g" },
  { id: "p8", name: "Hashini Jayawardena", teamId: "rems",   av: "av-h" },
  { id: "p9", name: "Buddhika Senarathna", teamId: "platform", av: "av-a" },
  { id: "p10",name: "Lakmal de Silva",   teamId: "platform", av: "av-b" },
];

const PROJECTS = [
  { id: "product-uem", name: "product-uem 5.2.0 GA" },
  { id: "product-iots", name: "Product IOTS" },
  { id: "rems-core",   name: "REMS Core" },
  { id: "backlog",     name: "Backlog" },
  { id: "internal-hr", name: "Internal · HR" },
  { id: "internal-ops",name: "Internal · Operations" },
  { id: "customer-acme", name: "Customer · ACME Roll-out" },
];

const CATEGORIES = [
  { id: "dev",  label: "Development",  cls: "chip-dev",  segCls: "cat-dev",  short: "Dev" },
  { id: "cust", label: "Customer",     cls: "chip-cust", segCls: "cat-cust", short: "Cust" },
  { id: "ops",  label: "Operations",   cls: "chip-ops",  segCls: "cat-ops",  short: "Ops" },
  { id: "hr",   label: "HR",           cls: "chip-hr",   segCls: "cat-hr",   short: "HR" },
];

const PRIORITIES = [
  { id: "critical", label: "Critical", order: 0, cls: "pri-critical", dot: "dot-critical" },
  { id: "high",     label: "High",     order: 1, cls: "pri-high",     dot: "dot-high" },
  { id: "medium",   label: "Medium",   order: 2, cls: "pri-medium",   dot: "dot-medium" },
  { id: "low",      label: "Low",      order: 3, cls: "pri-low",      dot: "dot-low" },
  { id: "none",     label: "None",     order: 4, cls: "pri-none",     dot: "dot-none" },
];

const STATUSES = [
  { id: "working", label: "In progress", cls: "pill-working" },
  { id: "blocked", label: "Blocked",     cls: "pill-blocked" },
  { id: "onhold",  label: "On hold",     cls: "pill-onhold" },
  { id: "done",    label: "Done",        cls: "pill-done" },
];

// Mock Redmine tickets per project. In a real backend these come from the
// Redmine proxy and are kept in sync by a periodic job.
const REDMINE_TICKETS = {
  "product-uem": [
    { id: "PRODUCT-12410", title: "Sprint 23 — UEM 5.2.0 GA bug burn-down", status: "working", progress: 60, startDate: "2026-05-11", dueDate: "2026-05-22", assignees: ["p1", "p5", "p6"] },
    { id: "PRODUCT-12489", title: "ACME UEM agent enrolment failure",       status: "working", progress: 35, startDate: "2026-05-13", dueDate: "2026-05-18", assignees: ["p1", "p5"] },
    { id: "PRODUCT-12490", title: "Fix REMS dashboard UX regression",       status: "working", progress: 75, startDate: "2026-05-13", dueDate: "2026-05-17", assignees: ["p3", "p8"] },
    { id: "PRODUCT-12515", title: "Investigate gateway disconnect 3.4.1",   status: "working", progress: 50, startDate: "2026-05-13", dueDate: "2026-05-16", assignees: ["p2", "p7"] },
    { id: "PRODUCT-12522", title: "Agent telemetry — battery drain audit",   status: "onhold",  progress: 10, startDate: "2026-05-15", dueDate: "2026-06-01", assignees: ["p5"] },
  ],
  "product-iots": [
    { id: "PRODUCT-12515", title: "Investigate gateway disconnect 3.4.1",   status: "working", progress: 50, startDate: "2026-05-13", dueDate: "2026-05-16", assignees: ["p2", "p7"] },
    { id: "PRODUCT-12540", title: "Add MQTT TLS fallback",                  status: "working", progress: 20, startDate: "2026-05-14", dueDate: "2026-05-28", assignees: ["p7"] },
  ],
  "rems-core": [
    { id: "PRODUCT-12490", title: "Fix REMS dashboard UX regression",       status: "working", progress: 75, startDate: "2026-05-13", dueDate: "2026-05-17", assignees: ["p3", "p8"] },
    { id: "REMS-2210",     title: "Drill-down chart Safari fix",            status: "working", progress: 65, startDate: "2026-05-12", dueDate: "2026-05-19", assignees: ["p3"] },
  ],
  "backlog": [
    { id: "BL-901",        title: "UI not loading on first paint",          status: "working", progress: 40, startDate: "2026-05-11", dueDate: "2026-05-12", assignees: ["p2"] },
  ],
  "internal-ops": [
    { id: "OPS-882",       title: "Migrate CI runners to ARM pool",         status: "onhold",  progress: 5,  startDate: "2026-05-20", dueDate: "2026-06-10", assignees: ["p6"] },
    { id: "OPS-901",       title: "Renew SSL certificates — staging",       status: "working", progress: 10, startDate: "2026-05-14", dueDate: "2026-05-17", assignees: ["p4", "p9"] },
    { id: "OPS-845",       title: "Migrate observability stack to Grafana 11", status: "working", progress: 45, startDate: "2026-05-10", dueDate: "2026-06-05", assignees: ["p4", "p10"] },
  ],
  "internal-hr": [],
  "customer-acme": [],
};

// Seed high-level tasks
const SEED_TASKS = [
  {
    id: "t-1001",
    teamId: "uem",
    title: "Customer escalation – ACME UEM agent rollout",
    description: "Joint debugging session with ACME ops; expedite hotfix for the agent enrolment failure observed at 200+ devices.",
    category: "cust",
    priority: "critical",
    projectId: "customer-acme",
    redmineIssue: "PRODUCT-12489", redmineLinked: true,
    members: ["p1", "p5"],
    status: "working",
    startDate: "2026-05-13",
    dueDate: "2026-05-18",
    created: "2026-05-12",
    progress: 35,
  },
  {
    id: "t-1002",
    teamId: "uem",
    title: "Sprint 23 — UEM 5.2.0 GA bug burn-down",
    description: "Coordinate fixes for blockers tagged GA-blocker. Daily sync at 10:00.",
    category: "dev",
    priority: "high",
    projectId: "product-uem",
    redmineIssue: "PRODUCT-12410", redmineLinked: true,
    members: ["p1", "p5", "p6"],
    status: "working",
    startDate: "2026-05-11",
    dueDate: "2026-05-22",
    created: "2026-05-08",
    progress: 60,
  },
  {
    id: "t-1003",
    teamId: "uem",
    title: "Q3 hiring — Senior QA engineer",
    description: "Two open positions. Coordinate with TA on shortlist by Friday.",
    category: "hr",
    priority: "medium",
    projectId: "internal-hr",
    redmineIssue: "",
    members: ["p1"],
    status: "working",
    startDate: "2026-05-04",
    dueDate: "2026-05-30",
    created: "2026-05-04",
    progress: 40,
  },
  {
    id: "t-1004",
    teamId: "uem",
    title: "Migrate CI runners to ARM pool",
    description: "Saves ~30% build time. Owned by platform team but UEM needs to validate the build images.",
    category: "ops",
    priority: "low",
    projectId: "internal-ops",
    redmineIssue: "OPS-882", redmineLinked: true,
    members: ["p6"],
    status: "onhold",
    startDate: "2026-05-20",
    dueDate: "2026-06-10",
    created: "2026-05-02",
    progress: 5,
  },
  {
    id: "t-1005",
    teamId: "iot",
    title: "Investigate gateway disconnect on firmware 3.4.1",
    description: "Affecting ~12% of staging fleet. Reproduce locally then patch.",
    category: "dev",
    priority: "critical",
    projectId: "product-iots",
    redmineIssue: "PRODUCT-12515", redmineLinked: true,
    members: ["p2", "p7"],
    status: "working",
    startDate: "2026-05-13",
    dueDate: "2026-05-16",
    created: "2026-05-13",
    progress: 50,
  },
  {
    id: "t-1006",
    teamId: "iot",
    title: "Quarterly performance review cycle",
    description: "Self-reviews due 2026-05-25, manager reviews due 2026-06-02.",
    category: "hr",
    priority: "medium",
    projectId: "internal-hr",
    redmineIssue: "",
    members: ["p2"],
    status: "working",
    startDate: "2026-05-12",
    dueDate: "2026-05-25",
    created: "2026-05-12",
    progress: 20,
  },
  {
    id: "t-1007",
    teamId: "rems",
    title: "Fix REMS dashboard UX regression",
    description: "Drill-down chart breaks on Safari. Reported by 3 customers.",
    category: "dev",
    priority: "high",
    projectId: "rems-core",
    redmineIssue: "PRODUCT-12490", redmineLinked: true,
    members: ["p3", "p8"],
    status: "working",
    startDate: "2026-05-13",
    dueDate: "2026-05-17",
    created: "2026-05-11",
    progress: 75,
  },
  {
    id: "t-1008",
    teamId: "rems",
    title: "Customer training — REMS for ACME ops team",
    description: "1-hour live session + recording. Materials in shared drive.",
    category: "cust",
    priority: "medium",
    projectId: "customer-acme",
    redmineIssue: "",
    members: ["p3"],
    status: "working",
    startDate: "2026-05-19",
    dueDate: "2026-05-19",
    created: "2026-05-09",
    progress: 30,
  },
  {
    id: "t-1009",
    teamId: "platform",
    title: "Renew SSL certificates across staging clusters",
    description: "Expiring next week. Use the automation playbook, not manual rotation.",
    category: "ops",
    priority: "critical",
    projectId: "internal-ops",
    redmineIssue: "OPS-901", redmineLinked: true,
    members: ["p4", "p9"],
    status: "working",
    startDate: "2026-05-14",
    dueDate: "2026-05-17",
    created: "2026-05-14",
    progress: 10,
  },
  {
    id: "t-1010",
    teamId: "platform",
    title: "Migrate observability stack to Grafana 11",
    description: "Test in pre-prod first. Coordinate with all teams for dashboard validation.",
    category: "ops",
    priority: "medium",
    projectId: "internal-ops",
    redmineIssue: "OPS-845", redmineLinked: true,
    members: ["p4", "p10"],
    status: "working",
    startDate: "2026-05-10",
    dueDate: "2026-06-05",
    created: "2026-05-10",
    progress: 45,
  },
  {
    id: "t-1011",
    teamId: "platform",
    title: "Team offsite planning — June",
    description: "Venue shortlist due by 2026-05-21. Budget approved.",
    category: "hr",
    priority: "low",
    projectId: "internal-hr",
    redmineIssue: "",
    members: ["p4"],
    status: "onhold",
    startDate: "2026-05-18",
    dueDate: "2026-06-15",
    created: "2026-05-05",
    progress: 0,
  },
];

// Drilldown — work-ticket data mimicking the existing screenshot
const DRILL_TICKETS = {
  uem: [
    {
      personId: "p1", working: true,
      ticket: {
        phrase: "Designing the fix for a bug in project PRODUCT IOTS",
        title: "Under Investigation\nDelete and move to New iot",
        start: "2026-05-13", due: "2026-05-14",
        priority: "none", priorityLabel: "None",
        dueLabel: "Overdue", dueState: "due-overdue",
        logged: 14, estimated: 10, overrun: true,
      }
    },
  ],
  iot: [
    {
      personId: "p2", working: true,
      ticket: {
        phrase: "Testing a bug fix in project Backlog",
        title: "UI not loading",
        start: "2026-05-11", due: "2026-05-12",
        priority: "medium", priorityLabel: "Medium",
        dueLabel: "Overdue", dueState: "due-overdue",
        logged: 45, estimated: 40, overrun: true,
      }
    },
  ],
  rems: [
    {
      personId: "p3", working: true,
      ticket: {
        phrase: "Designing the fix for a bug in project product-uem 5.2.0 GA",
        title: "Fix REMS dashboard",
        start: "2026-05-13", due: "2026-05-17",
        priority: "medium", priorityLabel: "Medium",
        dueLabel: "Due this week", dueState: "due-this-week",
        logged: 15, estimated: 40, overrun: false,
      }
    },
    {
      personId: "p3", working: true,
      ticket: {
        phrase: "Fixing a bug in project product-uem 5.2.0 GA",
        title: "Fixing the UX of REMS",
        start: "2026-05-13", due: "2026-05-16",
        priority: "critical", priorityLabel: "Critical",
        dueLabel: "Due this week", dueState: "due-this-week",
        logged: 10, estimated: 10, overrun: false,
      }
    },
  ],
  platform: [
    { personId: "p4", working: false, ticket: null }
  ],
};

// Person -> assigned working tickets count (for drill-down board)
const PEOPLE_FOR_TEAM = (teamId) => PEOPLE.filter(p => p.teamId === teamId);

Object.assign(window, {
  TEAMS, MANAGER, PEOPLE, PROJECTS, CATEGORIES, PRIORITIES, STATUSES,
  REDMINE_TICKETS, SEED_TASKS, DRILL_TICKETS, PEOPLE_FOR_TEAM,
});
