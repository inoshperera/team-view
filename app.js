const DEFAULT_CONFIG = {
    proxyUrl: "http://localhost:9000",
    activeWindowMinutes: 90,
    recentWindowMinutes: 240,
    longEntryHours: 8,
    requestTimeoutMs: 12000,
    team: [],
    teams: []
};

const STATUS_META = {
    "active": { label: "Active" },
    "recently-active": { label: "Recently active" },
    "inactive-period": { label: "Inactive" },
    "no-data": { label: "No data" },
    "needs-attention": { label: "Needs attention" }
};

const state = {
    config: DEFAULT_CONFIG,
    workPhraseConfig: {
        projectToken: "{project}",
        excludedStatuses: ["New", "Closed", "On hold", "Staged", "Testing Rejected"],
        phrases: {}
    },
    members: [],
    users: [],
    teams: [],
    auth: {
        user: null,
        ready: false
    },
    view: "planner",
    planner: {
        tasks: [],
        teams: [],
        users: [],
        projects: [],
        projectsLoadedFromRedmine: false,
        categories: [],
        priorities: [],
        statuses: [],
        filters: {
            teamId: "",
            memberId: "",
            category: "",
            priority: "",
            status: "",
            q: ""
        },
        groupMode: "priority",
        nonePriorityFirst: false,
        editorTask: null,
        linkedTicket: null
    },
    summaries: [],
    previousSummaries: [],
    issueCache: new Map(),
    workTicketsCache: new Map(),
    period: null,
    detailMemberId: null,
    settingsOpen: false,
    previousView: "planner",
    teamDraft: {
        teams: [],
        errors: [],
        openTeamId: "",
        searchQueries: {},
        expandedMemberLists: {}
    },
    teamMgmt: {
        teams: [],
        allUsers: [],
        allProjects: [],
        selectedTeamId: null,
        selectedTeam: null,
        search: "",
        loading: false,
        error: null,
        renaming: false,
        changingLead: false,
        editingProjects: false,
        addingMember: false,
        pendingProjectIds: null,
        projectSearch: "",
        wizard: null,
    },
    work: {
        mode: "team",
        teamId: "",
        memberIds: [],
        searchQuery: "",
        showDetailedTickets: false,
        summary: null,
        previousSummary: null
    },
    refresh: {
        state: "idle",
        startedAt: null,
        lastSuccessfulAt: null,
        message: ""
    },
    refreshSeq: 0,
    statusFilter: "all"
};

const KNOWN_WORK_STATUSES = new Set([
    "On hold",
    "New",
    "Development Ready",
    "Design",
    "Implementation",
    "Review",
    "Testing",
    "Staged",
    "Testing Ready",
    "Testing Rejected",
    "Closed",
    "In Progress"
]);

const EXCLUDED_WORK_STATUSES = new Set(["New", "Closed", "On hold", "Staged", "Testing Rejected"]);
const NON_WORKING_COUNT_STATUSES = new Set(["New", "On hold"]);

const els = {
    loginShell: document.getElementById("loginShell"),
    loginForm: document.getElementById("loginForm"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    loginError: document.getElementById("loginError"),
    board: document.getElementById("teamBoard"),
    workBoard: document.getElementById("workBoard"),
    plannerBoard: document.getElementById("plannerBoard"),
    emptyState: document.getElementById("emptyState"),
    notice: document.getElementById("globalNotice"),
    noticeBar: document.getElementById("noticeBar"),
    refreshButton: document.getElementById("refreshButton"),
    logoutButton: null,
    addPlannerTaskButton: document.getElementById("addPlannerTaskButton"),
    plannerDrilldownButton: null,
    plannerUserChip: document.getElementById("plannerUserChip"),
    settingsButton: null,
    freshnessLabel: null,
    workingDayLabel: document.getElementById("workingDayLabel"),
    viewSelect: document.getElementById("viewSelect"),
    periodPanel: document.getElementById("periodPanel"),
    periodSelect: document.getElementById("periodSelect"),
    customRange: document.getElementById("customRange"),
    customStart: document.getElementById("customStart"),
    customEnd: document.getElementById("customEnd"),
    applyRangeButton: document.getElementById("applyRangeButton"),
    periodError: document.getElementById("periodError"),
    workControls: document.getElementById("workControls"),
    workScopeMode: document.getElementById("workScopeMode"),
    teamSelectField: document.getElementById("teamSelectField"),
    workTeamSelect: document.getElementById("workTeamSelect"),
    userSearchField: document.getElementById("userSearchField"),
    workUserSearch: document.getElementById("workUserSearch"),
    workUserPicker: document.getElementById("workUserPicker"),
    showDetailedTickets: document.getElementById("showDetailedTickets"),
    plannerControls: document.getElementById("plannerControls"),
    plannerTeamField: document.getElementById("plannerTeamField"),
    plannerTeamFilter: document.getElementById("plannerTeamFilter"),
    plannerMemberFilter: document.getElementById("plannerMemberFilter"),
    plannerCategoryFilter: document.getElementById("plannerCategoryFilter"),
    plannerPriorityFilter: document.getElementById("plannerPriorityFilter"),
    plannerSearch: document.getElementById("plannerSearch"),
    plannerGroupPriority: document.getElementById("plannerGroupPriority"),
    plannerGroupCategory: document.getElementById("plannerGroupCategory"),
    settingsPanel: document.getElementById("settingsPanel"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    saveTeamsButton: null,
    newTeamName: null,
    addTeamButton: null,
    teamSettingsList: null,
    teamConfigJson: null,
    settingsError: null,
    teamMgmtShell: document.getElementById("teamMgmtShell"),
    syncBadge: document.getElementById("syncBadge"),
    newTeamButton: null,
    timeSummaryStrip: document.getElementById("timeSummaryStrip"),
    workSummaryStrip: document.getElementById("workSummaryStrip"),
    workTicketCount: document.getElementById("workTicketCount"),
    workActivePeopleCount: document.getElementById("workActivePeopleCount"),
    workSelectedPeopleCount: document.getElementById("workSelectedPeopleCount"),
    workExcludedCount: document.getElementById("workExcludedCount"),
    plannerSummaryStrip: document.getElementById("plannerSummaryStrip"),
    plannerTeamCount: document.getElementById("plannerTeamCount"),
    plannerOpenCount: document.getElementById("plannerOpenCount"),
    plannerCriticalCount: document.getElementById("plannerCriticalCount"),
    plannerOverdueCount: document.getElementById("plannerOverdueCount"),
    plannerNoneCount: document.getElementById("plannerNoneCount"),
    plannerNonePriorityTile: document.getElementById("plannerNonePriorityTile"),
    detailPanel: document.getElementById("detailPanel"),
    detailTitle: document.getElementById("detailTitle"),
    detailPeriod: document.getElementById("detailPeriod"),
    detailSummary: document.getElementById("detailSummary"),
    detailRows: document.getElementById("detailRows"),
    closeDetailButton: document.getElementById("closeDetailButton"),
    countAll: document.getElementById("countAll"),
    countActive: document.getElementById("countActive"),
    countRecent: document.getElementById("countRecent"),
    countInactive: document.getElementById("countInactive"),
    countAttention: document.getElementById("countAttention"),
    plannerTaskModal: document.getElementById("plannerTaskModal"),
    plannerTaskEyebrow: document.getElementById("plannerTaskEyebrow"),
    plannerTaskTitle: document.getElementById("plannerTaskTitle"),
    closePlannerTaskButton: document.getElementById("closePlannerTaskButton"),
    cancelPlannerTaskButton: document.getElementById("cancelPlannerTaskButton"),
    deletePlannerTaskButton: document.getElementById("deletePlannerTaskButton"),
    savePlannerTaskButton: document.getElementById("savePlannerTaskButton"),
    plannerTaskError: document.getElementById("plannerTaskError"),
    plannerTaskTitleInput: document.getElementById("plannerTaskTitleInput"),
    plannerTaskDescription: document.getElementById("plannerTaskDescription"),
    plannerTaskTeam: document.getElementById("plannerTaskTeam"),
    plannerTaskProjectSearch: document.getElementById("plannerTaskProjectSearch"),
    plannerTaskProject: document.getElementById("plannerTaskProject"),
    plannerProjectOptions: document.getElementById("plannerProjectOptions"),
    plannerTaskCategory: document.getElementById("plannerTaskCategory"),
    plannerTaskCategoryChoices: document.getElementById("plannerTaskCategoryChoices"),
    plannerTaskPriority: document.getElementById("plannerTaskPriority"),
    plannerTaskPriorityChoices: document.getElementById("plannerTaskPriorityChoices"),
    plannerTaskRedmineSearch: document.getElementById("plannerTaskRedmineSearch"),
    plannerTicketOptions: document.getElementById("plannerTicketOptions"),
    plannerTaskStatus: document.getElementById("plannerTaskStatus"),
    plannerTaskProgress: document.getElementById("plannerTaskProgress"),
    plannerTaskStart: document.getElementById("plannerTaskStart"),
    plannerTaskDue: document.getElementById("plannerTaskDue"),
    plannerSyncedPanel: document.getElementById("plannerSyncedPanel"),
    plannerTaskMembers: document.getElementById("plannerTaskMembers")
};

async function init() {
    await loadOptionalLocalConfig();
    state.config = normalizeConfig(window.TEAM_ACTIVITY_CONFIG || {});
    state.members = validateTeam(state.config.team);
    state.users = state.members;
    state.teams = validateTeams(state.config.teams, state.users);
    state.teamDraft = createTeamDraft(state.teams);
    state.work.teamId = state.teams[0]?.id || "";
    state.work.memberIds = [];
    state.period = buildPeriod("last-week");
    bindEvents();
    syncPeriodControls();
    syncWorkControls();
    renderStaticHeader();

    await loadPublicProxyConfig();
    await restoreSession();
    if (!state.auth.user) {
        showLogin();
        return;
    }
    await bootstrapAuthenticatedApp();
}

async function bootstrapAuthenticatedApp() {
    await loadPlannerBootstrap();
    await loadPlannerProjects();
    await loadWorkPhraseConfig();
    await loadTeamConfigFromFile();
    syncPlannerControls();
    syncWorkControls();

    await refreshActiveView();
}

async function loadPublicProxyConfig() {
    if (state.config.redmineUrl) {
        return;
    }
    try {
        const payload = await fetchJson("/proxy-config.json");
        state.config.redmineUrl = String(payload.redmineUrl || "").replace(/\/$/, "");
    } catch {
        state.config.redmineUrl = "";
    }
}

async function loadRedmineUsersForWorkOverview() {
    try {
        const redmineUsers = await fetchAllPages("/users.json", { status: 1 }, "users");
        const normalizedUsers = validateTeam(redmineUsers.map(normalizeRedmineUser));
        if (normalizedUsers.length > 0) {
            state.users = normalizedUsers;
        }
    } catch {
        state.users = state.members;
    }
}

async function loadTeamConfigFromFile() {
    let fileTeams = [];
    try {
        const payload = await fetchJson("/team-config.json");
        fileTeams = Array.isArray(payload.teams) ? payload.teams : [];
    } catch {
        fileTeams = [];
    }

    if (fileTeams.length === 0) {
        fileTeams = await loadStaticTeamConfigFile();
    }

    state.teams = validateTeams(fileTeams.length > 0 ? fileTeams : state.config.teams, state.users);
    state.teamDraft = createTeamDraft(state.teams);
    state.work.teamId = state.teams[0]?.id || "";
    state.work.memberIds = [];
    syncWorkControls();
}

async function loadWorkPhraseConfig() {
    try {
        const response = await fetch(`data/work-overview-phrases.json?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Phrase JSON was not available.");
        }
        const payload = await response.json();
        const excludedStatuses = Array.isArray(payload.excludedStatuses)
            ? payload.excludedStatuses.map((status) => String(status || "").trim()).filter(Boolean)
            : [...EXCLUDED_WORK_STATUSES];
        state.workPhraseConfig = {
            projectToken: String(payload.projectToken || "{project}"),
            excludedStatuses,
            phrases: payload.phrases && typeof payload.phrases === "object" ? payload.phrases : {}
        };
    } catch {
        state.workPhraseConfig = {
            projectToken: "{project}",
            excludedStatuses: [...EXCLUDED_WORK_STATUSES],
            phrases: {}
        };
    }
}

async function loadStaticTeamConfigFile() {
    try {
        const response = await fetch(`team-config.local.json?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
            return [];
        }
        const payload = await response.json();
        return Array.isArray(payload.teams) ? payload.teams : [];
    } catch {
        return [];
    }
}

function normalizeRedmineUser(user) {
    const first = String(user.firstname || "").trim();
    const last = String(user.lastname || "").trim();
    const fallbackName = String(user.name || user.login || "").trim();
    return {
        id: user.id,
        name: `${first} ${last}`.trim() || fallbackName,
        login: user.login || "",
        active: user.status === undefined || Number(user.status) === 1
    };
}

function loadOptionalLocalConfig() {
    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "config.local.js";
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
    });
}

function normalizeConfig(input) {
    return {
        ...DEFAULT_CONFIG,
        ...input,
        redmineUrl: String(input.redmineUrl || input.redmine_url || "").replace(/\/$/, ""),
        proxyUrl: String(input.proxyUrl || DEFAULT_CONFIG.proxyUrl).replace(/\/$/, ""),
        activeWindowMinutes: Number(input.activeWindowMinutes || DEFAULT_CONFIG.activeWindowMinutes),
        recentWindowMinutes: Number(input.recentWindowMinutes || DEFAULT_CONFIG.recentWindowMinutes),
        longEntryHours: Number(input.longEntryHours || DEFAULT_CONFIG.longEntryHours),
        requestTimeoutMs: Number(input.requestTimeoutMs || DEFAULT_CONFIG.requestTimeoutMs),
        team: Array.isArray(input.team) ? input.team : [],
        teams: Array.isArray(input.teams) ? input.teams : []
    };
}

function validateTeam(team) {
    const seen = new Set();
    const valid = [];

    for (const member of team) {
        const id = Number(member.id);
        const name = String(member.name || "").trim();
        const active = member.active !== false;

        if (!active || !Number.isFinite(id) || id <= 0 || !name || seen.has(id)) {
            continue;
        }

        seen.add(id);
        valid.push({
            id,
            name,
            login: member.login || "",
            active
        });
    }

    return valid;
}

function validateTeams(teams, members) {
    const memberIds = new Set(members.map((member) => member.id));
    const seenIds = new Set();
    const seenNames = new Set();
    const valid = [];

    for (const team of teams) {
        const id = String(team.id || "").trim();
        const name = String(team.name || "").trim();
        const normalizedName = name.toLowerCase();
        if (!id || !name || seenIds.has(id) || seenNames.has(normalizedName)) {
            continue;
        }
        const teamMemberIds = Array.isArray(team.memberIds)
            ? [...new Set(team.memberIds.map(Number).filter((idValue) => memberIds.has(idValue)))]
            : [];
        seenIds.add(id);
        seenNames.add(normalizedName);
        valid.push({ id, name, memberIds: teamMemberIds });
    }

    return valid;
}

function cloneTeams(teams) {
    return teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberIds: [...team.memberIds]
    }));
}

function createTeamDraft(teams, openTeamId = "") {
    const clonedTeams = cloneTeams(teams);
    const resolvedOpenTeamId = openTeamId && clonedTeams.some((team) => team.id === openTeamId)
        ? openTeamId
        : clonedTeams[0]?.id || "";
    return {
        teams: clonedTeams,
        errors: [],
        openTeamId: resolvedOpenTeamId,
        searchQueries: {},
        expandedMemberLists: {}
    };
}

function bindEvents() {
    els.loginForm.addEventListener("submit", handleLoginSubmit);
    els.addPlannerTaskButton.addEventListener("click", () => openPlannerEditor(null));

    els.refreshButton.addEventListener("click", refreshActiveView);
    els.viewSelect.addEventListener("change", handleViewChange);
    els.periodSelect.addEventListener("change", handlePeriodPresetChange);
    els.applyRangeButton.addEventListener("click", applyCustomRange);
    els.closeDetailButton.addEventListener("click", closeDetailView);
    els.closeSettingsButton.addEventListener("click", closeSettings);
    els.workScopeMode.addEventListener("change", handleWorkScopeModeChange);
    els.workTeamSelect.addEventListener("change", handleWorkTeamChange);
    els.workUserSearch.addEventListener("input", handleWorkUserSearch);
    els.showDetailedTickets.addEventListener("change", handleShowDetailedTicketsChange);
    els.plannerTeamFilter.addEventListener("change", () => updatePlannerFilter("teamId", els.plannerTeamFilter.value));
    els.plannerMemberFilter.addEventListener("change", () => updatePlannerFilter("memberId", els.plannerMemberFilter.value));
    els.plannerCategoryFilter.addEventListener("change", () => updatePlannerFilter("category", els.plannerCategoryFilter.value));
    els.plannerPriorityFilter.addEventListener("change", () => updatePlannerFilter("priority", els.plannerPriorityFilter.value));
    els.plannerSearch.addEventListener("input", () => updatePlannerFilter("q", els.plannerSearch.value));
    els.plannerGroupPriority.addEventListener("click", () => setPlannerGroup("priority"));
    els.plannerGroupCategory.addEventListener("click", () => setPlannerGroup("category"));
    els.plannerNonePriorityTile.addEventListener("click", toggleNonePriorityTasksFirst);
    els.closePlannerTaskButton.addEventListener("click", closePlannerEditor);
    els.cancelPlannerTaskButton.addEventListener("click", closePlannerEditor);
    els.deletePlannerTaskButton.addEventListener("click", deletePlannerTask);
    els.plannerTaskModal.addEventListener("submit", savePlannerTask);
    els.plannerTaskTeam.addEventListener("change", () => renderPlannerMemberPicker());
    els.plannerTaskProjectSearch.addEventListener("input", handlePlannerProjectSearch);
    els.plannerTaskProjectSearch.addEventListener("change", handlePlannerProjectSearch);
    els.plannerTaskRedmineSearch.addEventListener("input", debounce(loadPlannerTicketOptions, 250));
    els.plannerTaskProgress.addEventListener("input", clampPlannerProgressInput);
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.statusFilter = button.dataset.statusFilter;
            render();
        });
    });
    document.addEventListener("click", () => {
        const menu = document.getElementById("userMenu");
        if (menu) menu.classList.add("is-hidden");
        const toggle = document.getElementById("userChipToggle");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
}

async function restoreSession() {
    try {
        const payload = await apiJson("/api/auth/me");
        state.auth.user = payload.user;
        hideLogin();
    } catch {
        state.auth.user = null;
    }
}

function showLogin() {
    els.loginShell.classList.remove("is-hidden");
    document.querySelector(".app-shell").classList.add("is-hidden");
}

function hideLogin() {
    els.loginShell.classList.add("is-hidden");
    document.querySelector(".app-shell").classList.remove("is-hidden");
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    els.loginError.classList.add("is-hidden");
    try {
        const payload = await apiJson("/api/auth/login", {
            method: "POST",
            body: {
                username: els.loginUsername.value.trim(),
                password: els.loginPassword.value
            }
        });
        state.auth.user = payload.user;
        els.loginPassword.value = "";
        hideLogin();
        await bootstrapAuthenticatedApp();
    } catch (error) {
        els.loginError.textContent = error.message || "Unable to sign in.";
        els.loginError.classList.remove("is-hidden");
    }
}

async function handleLogout() {
    await apiJson("/api/auth/logout", { method: "POST" }).catch(() => {});
    state.auth.user = null;
    state.planner.tasks = [];
    showLogin();
}

async function loadPlannerBootstrap() {
    const payload = await apiJson("/api/bootstrap");
    state.auth.user = payload.user;
    state.planner.teams = payload.teams || [];
    state.planner.users = payload.users || [];
    state.planner.projects = payload.projects || [];
    state.planner.categories = payload.categories || [];
    state.planner.priorities = payload.priorities || [];
    state.planner.statuses = payload.statuses || [];
    state.teams = (payload.teams || []).map((team) => ({
        id: team.id,
        name: team.name,
        memberIds: (payload.users || []).filter((user) => user.teamIds?.includes(team.id)).map((user) => user.redmineUserId || user.id)
    }));
    state.users = (payload.users || []).map((user) => ({
        id: user.redmineUserId || user.id,
        name: user.name,
        login: "",
        active: true,
        dbId: user.id
    }));
    state.members = state.users.map((user) => ({ id: user.redmineUserId || user.id, name: user.name, active: true }));
    if (state.auth.user?.role === "lead") {
        const validTeamIds = new Set(state.planner.teams.map((t) => t.id));
        if (!validTeamIds.has(state.planner.filters.teamId)) {
            state.planner.filters.teamId = state.auth.user.teamId || state.planner.teams[0]?.id || "";
        }
    } else if (!state.planner.filters.teamId) {
        state.planner.filters.teamId = "";
    }
    state.work.teamId = state.planner.filters.teamId || state.teams[0]?.id || "";
}

async function loadPlannerProjects() {
    try {
        const payload = await apiJson("/api/redmine/projects");
        if (payload.projects?.length) {
            state.planner.projects = payload.projects;
            state.planner.projectsLoadedFromRedmine = true;
        }
    } catch {
        state.planner.projectsLoadedFromRedmine = false;
    }
}

async function refreshPlanner() {
    const params = new URLSearchParams();
    Object.entries(state.planner.filters).forEach(([key, value]) => {
        if (!value) {
            return;
        }
        const mapped = key === "teamId" ? "team_id" : key === "memberId" ? "member_id" : key;
        params.set(mapped, value);
    });
    setRefreshState("loading", "Loading high-level tasks.");
    render();
    try {
        const payload = await apiJson(`/api/tasks${params.toString() ? `?${params}` : ""}`);
        state.planner.tasks = payload.tasks || [];
        setRefreshState("success", "High-level planner loaded.");
        state.refresh.lastSuccessfulAt = new Date();
    } catch (error) {
        setRefreshState("failed", error.message || "Unable to load high-level tasks.");
    }
    render();
}

function syncPlannerControls() {
    const canSeeAllTeams = ["manager", "admin"].includes(state.auth.user?.role);
    els.plannerTeamField.classList.toggle("is-hidden", !canSeeAllTeams);
    els.plannerTeamFilter.innerHTML = `<option value="">All teams</option>${state.planner.teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("")}`;
    els.plannerTeamFilter.value = state.planner.filters.teamId;
    const users = filteredPlannerUsersForTeam(state.planner.filters.teamId);
    els.plannerMemberFilter.innerHTML = `<option value="">All members</option>${users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}`;
    els.plannerMemberFilter.value = state.planner.filters.memberId;
    els.plannerCategoryFilter.innerHTML = `<option value="">All categories</option>${state.planner.categories.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("")}`;
    els.plannerCategoryFilter.value = state.planner.filters.category;
    els.plannerPriorityFilter.innerHTML = `<option value="">All priorities</option>${state.planner.priorities.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("")}`;
    els.plannerPriorityFilter.value = state.planner.filters.priority;
    els.plannerSearch.value = state.planner.filters.q;
    els.plannerGroupPriority.classList.toggle("is-selected", state.planner.groupMode === "priority");
    els.plannerGroupCategory.classList.toggle("is-selected", state.planner.groupMode === "category");
}

function filteredPlannerUsersForTeam(teamId) {
    if (!teamId) {
        return state.planner.users;
    }
    return state.planner.users.filter((user) => user.teamIds?.includes(teamId));
}

function updatePlannerFilter(key, value) {
    state.planner.filters[key] = value;
    if (key === "teamId") {
        state.planner.filters.memberId = "";
    }
    syncPlannerControls();
    refreshPlanner();
}

function setPlannerGroup(groupMode) {
    state.planner.groupMode = groupMode;
    syncPlannerControls();
    renderPlanner();
}

function toggleNonePriorityTasksFirst() {
    if (state.planner.nonePriorityFirst) {
        closeNonePriorityTasksFirst();
        return;
    }
    state.planner.nonePriorityFirst = true;
    syncPlannerControls();
    renderPlanner();
    els.plannerBoard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeNonePriorityTasksFirst() {
    state.planner.nonePriorityFirst = false;
    syncPlannerControls();
    renderPlanner();
}

function handleViewChange() {
    state.view = els.viewSelect.value;
    state.settingsOpen = false;
    closeDetailView();
    render();
    if (state.view === "planner" && state.planner.tasks.length === 0) {
        refreshPlanner();
    }
    if (state.view === "work-overview" && !state.work.summary && state.members.length > 0) {
        refreshWorkOverview();
    }
}

function handlePeriodPresetChange() {
    const preset = els.periodSelect.value;
    els.customRange.classList.toggle("is-hidden", preset !== "custom");

    if (preset !== "custom") {
        state.period = buildPeriod(preset);
        closeDetailView();
        clearPeriodError();
        syncPeriodControls();
        refreshDashboard();
    }
}

function applyCustomRange() {
    const period = buildPeriod("custom", els.customStart.value, els.customEnd.value);
    if (!period.isValid) {
        showPeriodError(period.error);
        return;
    }

    state.period = period;
    closeDetailView();
    clearPeriodError();
    renderStaticHeader();
    refreshActiveView();
}

async function refreshActiveView() {
    if (!state.auth.user) {
        return;
    }
    if (state.view === "planner") {
        await refreshPlanner();
        return;
    }
    if (state.view === "work-overview") {
        await refreshWorkOverview();
        return;
    }
    await refreshDashboard();
}

function buildPeriod(preset, customStart = "", customEnd = "") {
    const today = startOfDay(new Date());
    let start = today;
    let end = today;
    let label = "Last week";

    if (preset === "last-week") {
        const thisWeekStart = startOfWeek(today);
        start = addDays(thisWeekStart, -7);
        end = addDays(thisWeekStart, -1);
        label = "Last week";
    } else if (preset === "last-month") {
        const thisMonthStart = startOfMonth(today);
        start = startOfMonth(addDays(thisMonthStart, -1));
        end = addDays(thisMonthStart, -1);
        label = "Last month";
    } else if (preset === "this-month") {
        start = startOfMonth(today);
        end = today;
        label = "This month";
    } else if (preset === "custom") {
        if (!customStart || !customEnd) {
            return { preset, startDate: customStart, endDate: customEnd, label: "Custom range", isValid: false, error: "Select both custom range dates." };
        }
        start = parseLocalDate(customStart);
        end = parseLocalDate(customEnd);
        if (!start || !end || start > end) {
            return { preset, startDate: customStart, endDate: customEnd, label: "Custom range", isValid: false, error: "Custom range start must be on or before end date." };
        }
        label = `${formatDateForDisplay(start)} to ${formatDateForDisplay(end)}`;
    } else {
        const thisWeekStart = startOfWeek(today);
        start = addDays(thisWeekStart, -7);
        end = addDays(thisWeekStart, -1);
        preset = "last-week";
    }

    return {
        preset,
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(end),
        label,
        isValid: true,
        error: ""
    };
}

function syncPeriodControls() {
    els.periodSelect.value = state.period.preset;
    els.customRange.classList.toggle("is-hidden", state.period.preset !== "custom");
    if (state.period.preset === "custom") {
        els.customStart.value = state.period.startDate;
        els.customEnd.value = state.period.endDate;
    } else {
        const today = formatLocalDate(new Date());
        els.customStart.value = state.period.startDate || today;
        els.customEnd.value = state.period.endDate || today;
    }
}

function showPeriodError(message) {
    els.periodError.textContent = message;
    els.periodError.classList.remove("is-hidden");
}

function clearPeriodError() {
    els.periodError.textContent = "";
    els.periodError.classList.add("is-hidden");
}

function renderStaticHeader() {
    if (state.view === "planner") {
        const teamName = state.planner.teams.find((team) => team.id === state.planner.filters.teamId)?.name;
        els.workingDayLabel.textContent = state.auth.user?.role === "lead"
            ? `High-level work · ${teamName || "Team"}`
            : `Management view · ${state.planner.teams.length} teams`;
        return;
    }
    els.workingDayLabel.textContent = state.view === "work-overview"
        ? `Redmine Overview · ${describeWorkScope()}`
        : `Period ${state.period.label}`;
}

async function refreshDashboard() {
    if (!state.period?.isValid) {
        showPeriodError(state.period?.error || "Select a valid period.");
        return;
    }

    const token = ++state.refreshSeq;
    const period = { ...state.period };
    setRefreshState("loading", `Loading Redmine activity for ${period.label}.`);
    render();

    try {
        state.issueCache = new Map();
        const summaries = await loadTeamSummaries(period);
        if (token !== state.refreshSeq) {
            return;
        }
        state.previousSummaries = summaries;
        state.summaries = summaries;
        const allInactive = summaries.length > 0 && summaries.every((summary) => summary.status === "inactive-period");
        const allNoData = summaries.length > 0 && summaries.every((summary) => summary.status === "no-data");
        const hasPartial = summaries.some((summary) => summary.warnings.length > 0 || summary.remainingEstimate.state === "partial" || summary.remainingEstimate.state === "unknown");
        setRefreshState(allNoData ? "failed" : allInactive ? "empty" : hasPartial ? "partial" : "success", allNoData
            ? "Unable to load Redmine data through the local proxy."
            : allInactive
            ? `No Redmine activity found for ${state.period.label}.`
            : hasPartial
            ? "Activity data loaded with partial estimate information."
            : "Activity data loaded.");
        if (!allNoData) {
            state.refresh.lastSuccessfulAt = new Date();
        }
    } catch (error) {
        if (token !== state.refreshSeq) {
            return;
        }
        state.summaries = state.previousSummaries.map((summary) => ({ ...summary, stale: true }));
        setRefreshState("failed", error.message || "Unable to load Redmine activity.");
    }

    render();
}

async function refreshWorkOverview() {
    const token = ++state.refreshSeq;
    const selectedMembers = resolveWorkMembers();
    setRefreshState("loading", `Loading assigned Redmine issues for ${describeWorkScope()}.`);
    render();

    try {
        state.workTicketsCache = new Map();
        const summary = await loadWorkOverviewSummary(selectedMembers);
        if (token !== state.refreshSeq) {
            return;
        }
        state.work.previousSummary = summary;
        state.work.summary = summary;
        setRefreshState(summary.warnings.length > 0 ? "partial" : "success", "Work overview loaded.");
        state.refresh.lastSuccessfulAt = new Date();
    } catch (error) {
        if (token !== state.refreshSeq) {
            return;
        }
        if (state.work.previousSummary) {
            state.work.summary = { ...state.work.previousSummary, stale: true };
        }
        setRefreshState("failed", error.message || "Unable to load Redmine Overview.");
    }

    render();
}

function setRefreshState(nextState, message) {
    state.refresh.state = nextState;
    state.refresh.message = message;
    if (nextState === "loading") {
        state.refresh.startedAt = new Date();
    }
}

function handleWorkScopeModeChange() {
    state.work.mode = els.workScopeMode.value;
    if (state.work.mode === "users") {
        state.work.memberIds = [];
        state.work.searchQuery = "";
    }
    syncWorkControls();
    refreshWorkOverview();
}

function handleWorkTeamChange() {
    state.work.teamId = els.workTeamSelect.value;
    refreshWorkOverview();
}

function handleWorkUserSearch() {
    state.work.searchQuery = els.workUserSearch.value;
    renderUserPicker();
}

function handleShowDetailedTicketsChange() {
    state.work.showDetailedTickets = !els.showDetailedTickets.checked;
    renderWorkOverview();
}

function syncWorkControls() {
    if (!["team", "users"].includes(state.work.mode)) {
        state.work.mode = "team";
    }
    els.workScopeMode.value = state.work.mode;
    els.teamSelectField.classList.toggle("is-hidden", state.work.mode !== "team");
    els.userSearchField.classList.toggle("is-hidden", state.work.mode !== "users");
    els.workUserPicker.classList.toggle("is-hidden", state.work.mode !== "users");
    els.showDetailedTickets.checked = !state.work.showDetailedTickets;
    renderTeamOptions();
    renderUserPicker();
}

function renderTeamOptions() {
    els.workTeamSelect.innerHTML = state.teams.length
        ? state.teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("")
        : `<option value="">No teams configured</option>`;
    if (state.work.teamId && state.teams.some((team) => team.id === state.work.teamId)) {
        els.workTeamSelect.value = state.work.teamId;
    } else {
        state.work.teamId = state.teams[0]?.id || "";
        els.workTeamSelect.value = state.work.teamId;
    }
}

function renderUserPicker() {
    const query = state.work.searchQuery.trim().toLowerCase();
    els.workUserSearch.value = state.work.searchQuery;
    const selectedIds = new Set(state.work.memberIds);
    const selectedMembers = state.users.filter((member) => selectedIds.has(member.id));
    const matchedMembers = query
        ? state.users.filter((member) => member.name.toLowerCase().includes(query))
        : [];
    const pickerMembers = [...selectedMembers, ...matchedMembers.filter((member) => !selectedIds.has(member.id))];
    els.workUserPicker.innerHTML = pickerMembers.length
        ? pickerMembers.map((member) => `
            <label class="check-row">
                <input type="checkbox" value="${member.id}" ${state.work.memberIds.includes(member.id) ? "checked" : ""}>
                <span>${escapeHtml(member.name)}</span>
            </label>
        `).join("")
        : `<div class="empty-mini">${query ? "No users match the search." : "Search to add users. Selected users will stay visible here."}</div>`;

    els.workUserPicker.querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.addEventListener("change", () => {
            const memberId = Number(input.value);
            if (input.checked && !state.work.memberIds.includes(memberId)) {
                state.work.memberIds.push(memberId);
            }
            if (!input.checked) {
                state.work.memberIds = state.work.memberIds.filter((id) => id !== memberId);
            }
            refreshWorkOverview();
        });
    });
}

function resolveWorkMembers() {
    if (state.work.mode === "team") {
        const team = state.teams.find((item) => item.id === state.work.teamId);
        const teamIds = new Set(team?.memberIds || []);
        return state.users.filter((member) => teamIds.has(member.id));
    }
    if (state.work.mode === "users") {
        const selectedIds = new Set(state.work.memberIds);
        return state.users.filter((member) => selectedIds.has(member.id));
    }
    return [];
}

function describeWorkScope() {
    if (state.work.mode === "team") {
        return state.teams.find((team) => team.id === state.work.teamId)?.name || "selected team";
    }
    if (state.work.mode === "users") {
        return `${state.work.memberIds.length} selected user${state.work.memberIds.length === 1 ? "" : "s"}`;
    }
    return "selected team";
}

function openSettings() {
    if (state.view !== "settings") {
        state.previousView = state.view;
    }
    state.view = "settings";
    state.settingsOpen = true;
    render();
    loadTeamMgmt();
}

function closeSettings() {
    state.settingsOpen = false;
    state.view = state.previousView || "planner";
    render();
}

// ─── Team management (new split-list + detail + wizard) ──────────────

const WIZARD_COLORS = ["#22d3ee", "#818cf8", "#4ade80", "#f87171", "#2dd4bf", "#f472b6"];
const WIZARD_STEPS = [
    { num: 1, label: "Team details" },
    { num: 2, label: "Owning projects" },
    { num: 3, label: "Add members" },
    { num: 4, label: "Assign lead" },
    { num: 5, label: "Review" },
];

function teamBadgeInitials(teamId) {
    const parts = String(teamId || "").split("-").filter(Boolean);
    if (parts.length >= 2) {
        return parts.slice(0, 3).map((p) => p[0]).join("").toUpperCase();
    }
    return String(teamId || "T").slice(0, 2).toUpperCase();
}

function teamBadgeHtml(team, small) {
    const cls = small ? "team-badge team-badge-sm" : "team-badge";
    const color = team.color || "#818cf8";
    const initText = teamBadgeInitials(team.id);
    return `<span class="${cls}" style="background:${escapeHtml(color)}">${escapeHtml(initText)}</span>`;
}

function userAvatarHtml(user, size) {
    size = size || 32;
    const color = user.avatarColor || "av-a";
    const initText = user.initials || initialsFromName(user.name);
    return `<span class="planner-avatar ${escapeHtml(color)}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${escapeHtml(initText)}</span>`;
}

async function loadTeamMgmt() {
    state.teamMgmt.loading = true;
    state.teamMgmt.error = null;
    renderTeamMgmt();
    try {
        const [teamsPayload, usersPayload, projectsPayload] = await Promise.all([
            apiJson("/api/teams"),
            apiJson("/api/users"),
            apiJson("/api/projects").catch(() => ({ projects: [] })),
        ]);
        state.teamMgmt.teams = teamsPayload.teams || [];
        state.teamMgmt.allUsers = usersPayload.users || [];
        state.teamMgmt.allProjects = projectsPayload.projects || [];
        // update sync badge
        const userCount = state.teamMgmt.allUsers.length;
        if (els.syncBadge) {
            els.syncBadge.textContent = `Synced with directory · ${userCount} user${userCount === 1 ? "" : "s"}`;
        }
    } catch (err) {
        state.teamMgmt.error = err.message || "Failed to load teams.";
    }
    state.teamMgmt.loading = false;
    renderTeamMgmt();
}

function renderTeamMgmt() {
    const shell = els.teamMgmtShell;
    if (!shell) return;
    // bind new team button each render
    const newBtn = document.getElementById("newTeamButton");
    if (newBtn && !newBtn._bound) {
        newBtn._bound = true;
        newBtn.addEventListener("click", startNewTeamWizard);
    }
    if (state.teamMgmt.loading) {
        shell.innerHTML = `<div style="padding:24px;color:var(--muted)">Loading teams…</div>`;
        return;
    }
    if (state.teamMgmt.error) {
        shell.innerHTML = `<div style="padding:24px;color:var(--attention)">${escapeHtml(state.teamMgmt.error)}</div>`;
        return;
    }
    if (state.teamMgmt.wizard) {
        shell.innerHTML = renderTeamWizardHtml();
        bindWizardEvents();
        return;
    }
    shell.innerHTML = `
        <div class="team-list-panel">
            ${renderTeamListHtml()}
        </div>
        <div class="team-detail-panel" id="teamDetailPanel">
            ${renderTeamDetailHtml()}
        </div>
    `;
    bindTeamListEvents();
    bindTeamDetailEvents();
}

function renderTeamListHtml() {
    const search = state.teamMgmt.search.toLowerCase();
    const teams = state.teamMgmt.teams.filter((t) =>
        !search || t.name.toLowerCase().includes(search) || t.id.toLowerCase().includes(search)
    );
    const items = teams.map((t) => {
        const selected = t.id === state.teamMgmt.selectedTeamId ? "is-selected" : "";
        const memberUsers = state.teamMgmt.allUsers
            .filter((u) => (u.teamIds || []).includes(t.id))
            .slice(0, 3);
        const bubbles = memberUsers.map((u) => {
            const color = u.avatarColor || "av-a";
            const init = u.initials || initialsFromName(u.name);
            return `<span class="team-bubble ${escapeHtml(color)}">${escapeHtml(init)}</span>`;
        }).join("");
        return `
            <div class="team-list-item ${selected}" data-team-id="${escapeHtml(t.id)}">
                ${teamBadgeHtml(t, false)}
                <div class="team-list-meta">
                    <span class="team-list-name">${escapeHtml(t.name)}</span>
                    ${t.description ? `<span class="team-list-desc">${escapeHtml(t.description)}</span>` : ""}
                    <div class="team-list-foot">
                        <div class="team-member-bubbles">${bubbles}</div>
                        <span class="team-list-count">${t.memberCount} member${t.memberCount === 1 ? "" : "s"} · ${t.projectCount} project${t.projectCount === 1 ? "" : "s"}</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");
    return `
        <div class="team-list-search">
            <input type="search" placeholder="Search teams…" value="${escapeHtml(state.teamMgmt.search)}" id="teamSearchInput">
        </div>
        <div class="team-list-items">
            ${items || `<div style="padding:16px;color:var(--muted);font-size:0.88rem">No teams found.</div>`}
        </div>
    `;
}

function renderTeamDetailHtml() {
    const team = state.teamMgmt.selectedTeam;
    if (!team) {
        return `
            <div class="team-detail-empty">
                <h3>Select a team to view details</h3>
                <p>Or click <strong>+ New team</strong> to create one.</p>
            </div>
        `;
    }
    const renaming = state.teamMgmt.renaming;
    const nameHtml = renaming
        ? `<input class="team-rename-input" id="teamRenameInput" value="${escapeHtml(team.name)}" type="text">`
        : `<h2>${escapeHtml(team.name)}</h2>`;
    const editingProjects = state.teamMgmt.editingProjects;
    const projectsHtml = editingProjects
        ? renderEditProjectsHtml(team)
        : ((team.projects || []).length
            ? `<div class="project-chips">${(team.projects || []).map((p) => `
                <span class="project-chip">
                    <span class="project-chip-badge">${escapeHtml(p.badge)}</span>
                    ${escapeHtml(p.name)}
                </span>`).join("")}</div>`
            : `<span style="color:var(--muted);font-size:0.88rem">No projects assigned.</span>`);

    const changingLead = state.teamMgmt.changingLead;
    const leadHtml = changingLead
        ? renderChangeLeadHtml(team)
        : (team.leadUser
            ? `<div class="team-lead-card">
                ${userAvatarHtml(team.leadUser, 40)}
                <div class="team-lead-info">
                    <div class="team-lead-name">${escapeHtml(team.leadUser.name)}</div>
                    <div class="team-lead-title">${escapeHtml(team.leadUser.role || "Lead")}</div>
                    <div class="team-lead-email">${escapeHtml(team.leadUser.email || "")}</div>
                </div>
                <button class="btn-yellow" id="changeLeadBtn" type="button">Change lead</button>
              </div>`
            : `<div class="team-lead-empty">No lead assigned. <button class="btn-yellow" id="changeLeadBtn" type="button">Assign lead</button></div>`);

    const membersRows = (team.members || []).map((m) => `
        <tr>
            <td>
                <div class="member-name-cell">
                    ${userAvatarHtml(m, 32)}
                    <div>
                        <div class="member-name-text">${escapeHtml(m.name)}</div>
                        <div class="member-email-text">${escapeHtml(m.email || "")}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(m.role || "member")}</td>
            <td><span class="position-chip ${m.position === "Lead" ? "position-chip-lead" : "position-chip-member"}">${escapeHtml(m.position)}</span></td>
            <td><button class="table-action-btn danger" data-remove-member="${m.id}" type="button">Remove</button></td>
        </tr>
    `).join("");
    return `
        <div class="team-detail-header">
            ${teamBadgeHtml(team, false)}
            <div class="team-detail-header-main">
                ${nameHtml}
                <div class="team-detail-header-meta">
                    <span class="team-id-chip">team_id: ${escapeHtml(team.id)}</span>
                    <span>Updated ${escapeHtml(team.updatedAt ? team.updatedAt.split("T")[0] : "—")}</span>
                    <span>${(team.members || []).length} member${(team.members || []).length === 1 ? "" : "s"}</span>
                    <span>${(team.projects || []).length} project${(team.projects || []).length === 1 ? "" : "s"}</span>
                </div>
            </div>
            <div class="team-detail-header-actions">
                ${renaming
                    ? `<button class="btn-primary" id="saveRenameBtn" type="button">Save</button>
                       <button class="secondary-button" id="cancelRenameBtn" type="button">Cancel</button>`
                    : `<button class="secondary-button" id="renameTeamBtn" type="button">Rename</button>
                       <button class="secondary-button danger-button" id="deleteTeamBtn" type="button">Delete</button>`
                }
            </div>
        </div>
        ${team.description ? `<div class="team-section"><p class="team-section-desc">${escapeHtml(team.description)}</p></div>` : ""}
        <div class="team-section">
            <div class="team-section-head">
                <span class="team-section-title">OWNING PROJECTS ${(team.projects || []).length}</span>
                ${!editingProjects ? `<button class="secondary-button team-section-action" id="editProjectsBtn" type="button">Edit projects</button>` : ""}
            </div>
            ${projectsHtml}
        </div>
        <div class="team-section">
            <div class="team-section-title">TEAM LEAD</div>
            ${leadHtml}
        </div>
        <div class="team-section">
            <div class="team-section-head">
                <span class="team-section-title">MEMBERS ${(team.members || []).length}</span>
                <button class="secondary-button team-section-action" id="addMemberBtn" type="button">+ Add member</button>
            </div>
            ${membersRows
                ? `<table class="members-table">
                    <thead><tr><th>NAME</th><th>ROLE</th><th>POSITION</th><th></th></tr></thead>
                    <tbody>${membersRows}</tbody>
                   </table>`
                : `<span style="color:var(--muted);font-size:0.88rem">No members yet.</span>`
            }
        </div>
    `;
}

function bindTeamListEvents() {
    const searchInput = document.getElementById("teamSearchInput");
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.teamMgmt.search = searchInput.value;
            renderTeamMgmt();
        });
    }
    document.querySelectorAll("[data-team-id]").forEach((el) => {
        el.addEventListener("click", () => selectTeam(el.dataset.teamId));
    });
}

async function selectTeam(teamId) {
    state.teamMgmt.selectedTeamId = teamId;
    state.teamMgmt.selectedTeam = null;
    state.teamMgmt.renaming = false;
    state.teamMgmt.changingLead = false;
    state.teamMgmt.editingProjects = false;
    state.teamMgmt.pendingProjectIds = null;
    state.teamMgmt.projectSearch = "";
    renderTeamMgmt();
    try {
        const payload = await apiJson(`/api/teams/${teamId}`);
        state.teamMgmt.selectedTeam = payload.team;
    } catch (err) {
        state.teamMgmt.selectedTeam = null;
    }
    renderTeamMgmt();
}

function bindTeamDetailEvents() {
    const renameBtn = document.getElementById("renameTeamBtn");
    if (renameBtn) {
        renameBtn.addEventListener("click", () => {
            state.teamMgmt.renaming = true;
            renderTeamMgmt();
            document.getElementById("teamRenameInput")?.focus();
        });
    }
    const saveRenameBtn = document.getElementById("saveRenameBtn");
    if (saveRenameBtn) {
        saveRenameBtn.addEventListener("click", async () => {
            const input = document.getElementById("teamRenameInput");
            const newName = input?.value.trim();
            if (!newName || !state.teamMgmt.selectedTeamId) return;
            try {
                const payload = await apiJson(`/api/teams/${state.teamMgmt.selectedTeamId}`, {
                    method: "PATCH",
                    body: { name: newName }
                });
                state.teamMgmt.selectedTeam = payload.team;
                state.teamMgmt.renaming = false;
                await loadTeamMgmt();
            } catch (err) {
                alert(err.message || "Failed to rename team.");
            }
        });
    }
    const cancelRenameBtn = document.getElementById("cancelRenameBtn");
    if (cancelRenameBtn) {
        cancelRenameBtn.addEventListener("click", () => {
            state.teamMgmt.renaming = false;
            renderTeamMgmt();
        });
    }
    const deleteBtn = document.getElementById("deleteTeamBtn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            const team = state.teamMgmt.selectedTeam;
            if (!team) return;
            if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
            try {
                await apiJson(`/api/teams/${team.id}`, { method: "DELETE" });
                state.teamMgmt.selectedTeamId = null;
                state.teamMgmt.selectedTeam = null;
                await loadTeamMgmt();
            } catch (err) {
                alert(err.message || "Failed to delete team.");
            }
        });
    }
    // Change lead
    const changeLeadBtn = document.getElementById("changeLeadBtn");
    if (changeLeadBtn) {
        changeLeadBtn.addEventListener("click", () => {
            state.teamMgmt.changingLead = true;
            renderTeamMgmt();
        });
    }
    const saveLeadBtn = document.getElementById("saveLeadBtn");
    if (saveLeadBtn) {
        saveLeadBtn.addEventListener("click", async () => {
            const sel = document.getElementById("changeLeadSelect");
            const uid = sel ? Number(sel.value) : null;
            if (!uid || !state.teamMgmt.selectedTeamId) return;
            try {
                const payload = await apiJson(`/api/teams/${state.teamMgmt.selectedTeamId}/lead`, {
                    method: "POST", body: { userId: uid }
                });
                state.teamMgmt.selectedTeam = payload.team;
                state.teamMgmt.changingLead = false;
                renderTeamMgmt();
            } catch (err) { alert(err.message || "Failed."); }
        });
    }
    const cancelChangeLeadBtn = document.getElementById("cancelChangeLeadBtn");
    if (cancelChangeLeadBtn) {
        cancelChangeLeadBtn.addEventListener("click", () => {
            state.teamMgmt.changingLead = false;
            renderTeamMgmt();
        });
    }

    // Edit projects
    const editProjectsBtn = document.getElementById("editProjectsBtn");
    if (editProjectsBtn) {
        editProjectsBtn.addEventListener("click", () => {
            const team = state.teamMgmt.selectedTeam;
            state.teamMgmt.pendingProjectIds = (team?.projects || []).map((p) => p.id);
            state.teamMgmt.editingProjects = true;
            state.teamMgmt.projectSearch = "";
            renderTeamMgmt();
        });
    }
    document.querySelectorAll("[data-proj-pick]").forEach((cb) => {
        cb.addEventListener("change", () => {
            const pid = Number(cb.value);
            if (!state.teamMgmt.pendingProjectIds) state.teamMgmt.pendingProjectIds = [];
            if (cb.checked) {
                if (!state.teamMgmt.pendingProjectIds.includes(pid)) state.teamMgmt.pendingProjectIds.push(pid);
            } else {
                state.teamMgmt.pendingProjectIds = state.teamMgmt.pendingProjectIds.filter((id) => id !== pid);
            }
        });
    });
    const projectSearchInput = document.getElementById("projectSearchInput");
    if (projectSearchInput) {
        projectSearchInput.addEventListener("input", () => {
            state.teamMgmt.projectSearch = projectSearchInput.value;
            // re-render just the project list without losing checked state
            const editPanel = projectSearchInput.closest(".team-section")?.querySelector(".edit-projects-list");
            if (editPanel) {
                const team = state.teamMgmt.selectedTeam;
                const q = state.teamMgmt.projectSearch.toLowerCase();
                const filtered = q
                    ? state.teamMgmt.allProjects.filter((p) => p.name.toLowerCase().includes(q))
                    : state.teamMgmt.allProjects;
                const pending = state.teamMgmt.pendingProjectIds || [];
                editPanel.innerHTML = filtered.map((p) => {
                    const checked = pending.includes(p.id) ? "checked" : "";
                    return `<label class="wizard-check-row compact-check-row">
                        <input type="checkbox" value="${p.id}" ${checked} data-proj-pick="${p.id}">
                        <span>${escapeHtml(p.name)}</span>
                    </label>`;
                }).join("") || `<span style="color:var(--muted);font-size:0.88rem">No projects found.</span>`;
                editPanel.querySelectorAll("[data-proj-pick]").forEach((cb) => {
                    cb.addEventListener("change", () => {
                        const pid = Number(cb.value);
                        if (!state.teamMgmt.pendingProjectIds) state.teamMgmt.pendingProjectIds = [];
                        if (cb.checked) {
                            if (!state.teamMgmt.pendingProjectIds.includes(pid)) state.teamMgmt.pendingProjectIds.push(pid);
                        } else {
                            state.teamMgmt.pendingProjectIds = state.teamMgmt.pendingProjectIds.filter((id) => id !== pid);
                        }
                    });
                });
            }
        });
    }
    const saveProjectsBtn = document.getElementById("saveProjectsBtn");
    if (saveProjectsBtn) {
        saveProjectsBtn.addEventListener("click", async () => {
            const ids = state.teamMgmt.pendingProjectIds || [];
            try {
                const payload = await apiJson(`/api/teams/${state.teamMgmt.selectedTeamId}/projects`, {
                    method: "PATCH", body: { projectIds: ids }
                });
                state.teamMgmt.selectedTeam = payload.team;
                state.teamMgmt.editingProjects = false;
                state.teamMgmt.pendingProjectIds = null;
                await loadTeamMgmt();
            } catch (err) { alert(err.message || "Failed to save projects."); }
        });
    }
    const cancelProjectsBtn = document.getElementById("cancelProjectsBtn");
    if (cancelProjectsBtn) {
        cancelProjectsBtn.addEventListener("click", () => {
            state.teamMgmt.editingProjects = false;
            state.teamMgmt.pendingProjectIds = null;
            state.teamMgmt.projectSearch = "";
            renderTeamMgmt();
        });
    }

    // Add member
    const addMemberBtn = document.getElementById("addMemberBtn");
    if (addMemberBtn) {
        addMemberBtn.addEventListener("click", () => openAddMemberPanel());
    }

    document.querySelectorAll("[data-remove-member]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const userId = btn.dataset.removeMember;
            if (!state.teamMgmt.selectedTeamId) return;
            if (!confirm("Remove this member from the team?")) return;
            try {
                const payload = await apiJson(`/api/teams/${state.teamMgmt.selectedTeamId}/members/${userId}`, { method: "DELETE" });
                state.teamMgmt.selectedTeam = payload.team;
                renderTeamMgmt();
            } catch (err) {
                alert(err.message || "Failed to remove member.");
            }
        });
    });
}

function openAddMemberPanel() {
    const team = state.teamMgmt.selectedTeam;
    if (!team) return;
    const memberIds = new Set((team.members || []).map((m) => m.id));
    const eligible = state.teamMgmt.allUsers.filter((u) => !memberIds.has(u.id));
    if (!eligible.length) { alert("All users are already members of this team."); return; }
    const options = eligible.map((u) =>
        `<option value="${u.id}">${escapeHtml(u.name)}${u.email ? ` (${u.email})` : ""}</option>`
    ).join("");
    // Show a simple inline select — rendered in a micro-panel appended to detail
    const panel = document.createElement("div");
    panel.className = "add-member-inline";
    panel.innerHTML = `
        <select id="addMemberSelect" style="min-height:36px;border:1px solid var(--line);border-radius:var(--radius);padding:4px 8px;font:inherit">${options}</select>
        <button class="btn-primary" id="confirmAddMember" type="button">Add</button>
        <button class="secondary-button" id="cancelAddMember" type="button">Cancel</button>
    `;
    const membersSection = document.querySelector(".team-section:last-child");
    if (membersSection) membersSection.appendChild(panel);
    panel.querySelector("#cancelAddMember").addEventListener("click", () => panel.remove());
    panel.querySelector("#confirmAddMember").addEventListener("click", async () => {
        const sel = panel.querySelector("#addMemberSelect");
        const uid = Number(sel?.value);
        if (!uid) return;
        try {
            const payload = await apiJson(`/api/teams/${team.id}/members`, { method: "POST", body: { userId: uid } });
            state.teamMgmt.selectedTeam = payload.team;
            renderTeamMgmt();
        } catch (err) { alert(err.message || "Failed to add member."); }
    });
}

function renderChangeLeadHtml(team) {
    const members = team.members || [];
    if (!members.length) {
        return `<p style="color:var(--muted);font-size:0.88rem">Add members first before assigning a lead.
            <button class="secondary-button" id="cancelChangeLeadBtn" type="button" style="margin-left:8px">Cancel</button></p>`;
    }
    const options = members.map((m) =>
        `<option value="${m.id}" ${team.leadUser && team.leadUser.id === m.id ? "selected" : ""}>${escapeHtml(m.name)}</option>`
    ).join("");
    return `
        <div class="change-lead-row">
            <select class="change-lead-select" id="changeLeadSelect">${options}</select>
            <button class="btn-primary" id="saveLeadBtn" type="button">Save lead</button>
            <button class="secondary-button" id="cancelChangeLeadBtn" type="button">Cancel</button>
        </div>
    `;
}

function renderEditProjectsHtml(team) {
    const allProjects = state.teamMgmt.allProjects;
    const assignedIds = new Set((team.projects || []).map((p) => p.id));
    const pending = state.teamMgmt.pendingProjectIds || [...assignedIds];
    const q = (state.teamMgmt.projectSearch || "").toLowerCase();
    const filtered = q ? allProjects.filter((p) => p.name.toLowerCase().includes(q)) : allProjects;
    const rows = filtered.map((p) => {
        const checked = pending.includes(p.id) ? "checked" : "";
        return `<label class="wizard-check-row compact-check-row">
            <input type="checkbox" value="${p.id}" ${checked} data-proj-pick="${p.id}">
            <span>${escapeHtml(p.name)}</span>
        </label>`;
    }).join("");
    return `
        <input class="wizard-search" id="projectSearchInput" type="search" placeholder="Search projects…" value="${escapeHtml(state.teamMgmt.projectSearch)}">
        <div class="edit-projects-list">${rows || `<span style="color:var(--muted);font-size:0.88rem">No projects found.</span>`}</div>
        <div class="edit-projects-actions">
            <button class="btn-primary" id="saveProjectsBtn" type="button">Save</button>
            <button class="secondary-button" id="cancelProjectsBtn" type="button">Cancel</button>
        </div>
    `;
}

// ─── Wizard ───────────────────────────────────────────────────────────

function startNewTeamWizard() {
    state.teamMgmt.wizard = {
        step: 1,
        name: "",
        shortCode: "",
        color: "#818cf8",
        description: "",
        selectedProjectIds: [],
        selectedMemberIds: [],
        leadUserId: null,
        saving: false,
        errors: {},
        memberSearch: "",
    };
    renderTeamMgmt();
}

function renderTeamWizardHtml() {
    const w = state.teamMgmt.wizard;
    const sidebarItems = WIZARD_STEPS.map((s) => {
        const cls = s.num === w.step ? "is-active" : s.num < w.step ? "is-done" : "";
        return `<div class="wizard-step-item ${cls}">
            <span class="wizard-step-num">${s.num < w.step ? "✓" : s.num}</span>
            <span>${s.label}</span>
        </div>`;
    }).join("");
    const stepHtml = renderWizardStepContent(w);
    const backLabel = w.step > 1 ? "← Back" : "Cancel";
    const nextLabel = w.step < 5 ? "Continue →" : (w.saving ? "Creating…" : "Create team");
    return `
        <div class="wizard-shell">
            <div class="wizard-sidebar">
                <div class="wizard-sidebar-title">Create team</div>
                ${sidebarItems}
            </div>
            <div class="wizard-content" id="wizardContent">
                ${stepHtml}
            </div>
            <div class="wizard-footer">
                <button class="secondary-button" id="wizardBackBtn" type="button">${escapeHtml(backLabel)}</button>
                <button class="btn-primary" id="wizardNextBtn" type="button" ${w.saving ? "disabled" : ""}>${escapeHtml(nextLabel)}</button>
            </div>
        </div>
    `;
}

function renderWizardStepContent(w) {
    if (w.step === 1) {
        const colorSwatches = WIZARD_COLORS.map((c) => `
            <span class="color-swatch ${c === w.color ? "is-selected" : ""}"
                  style="background:${escapeHtml(c)}"
                  data-color="${escapeHtml(c)}"
                  title="${escapeHtml(c)}"></span>
        `).join("");
        return `
            <div class="wizard-step-title">Team details</div>
            <p class="wizard-step-sub">Give your team a name, short code and color.</p>
            <div class="wizard-field">
                <label for="wizardName">Team name *</label>
                <input id="wizardName" type="text" value="${escapeHtml(w.name)}" placeholder="e.g. Infrastructure">
                ${w.errors.name ? `<span class="period-error">${escapeHtml(w.errors.name)}</span>` : ""}
            </div>
            <div class="wizard-field">
                <label for="wizardShortCode">Short code (max 5 chars)</label>
                <input id="wizardShortCode" type="text" maxlength="5" value="${escapeHtml(w.shortCode)}" placeholder="e.g. INFRA">
                <span class="wizard-field-hint">Auto-derived from name. Becomes the team ID.</span>
            </div>
            <div class="wizard-field">
                <label>Color</label>
                <div class="color-picker-row">${colorSwatches}</div>
            </div>
            <div class="wizard-field">
                <label for="wizardDesc">Description (optional)</label>
                <textarea id="wizardDesc" rows="3" placeholder="What does this team own?">${escapeHtml(w.description)}</textarea>
            </div>
        `;
    }
    if (w.step === 2) {
        const projects = state.teamMgmt.allProjects;
        const rows = projects.map((p) => {
            const checked = w.selectedProjectIds.includes(p.id) ? "checked" : "";
            return `<label class="wizard-check-row">
                <input type="checkbox" value="${p.id}" ${checked} data-proj-id="${p.id}">
                <span>${escapeHtml(p.name)}</span>
            </label>`;
        }).join("");
        return `
            <div class="wizard-step-title">Owning projects</div>
            <p class="wizard-step-sub">Select projects this team will own. You can change this later.</p>
            <div class="wizard-check-list">
                ${rows || `<span style="color:var(--muted)">No projects available.</span>`}
            </div>
        `;
    }
    if (w.step === 3) {
        const query = w.memberSearch.toLowerCase();
        const users = state.teamMgmt.allUsers.filter((u) =>
            !query || u.name.toLowerCase().includes(query) || (u.email || "").toLowerCase().includes(query)
        );
        const rows = users.map((u) => {
            const checked = w.selectedMemberIds.includes(u.id) ? "checked" : "";
            return `<label class="wizard-check-row">
                <input type="checkbox" value="${u.id}" ${checked} data-member-id="${u.id}">
                ${userAvatarHtml(u, 28)}
                <span>${escapeHtml(u.name)}${u.email ? `<span style="color:var(--muted);font-size:0.78rem;display:block">${escapeHtml(u.email)}</span>` : ""}</span>
            </label>`;
        }).join("");
        return `
            <div class="wizard-step-title">Add members</div>
            <p class="wizard-step-sub">Choose who belongs to this team.</p>
            <input class="wizard-search" type="search" id="wizardMemberSearch" placeholder="Search users…" value="${escapeHtml(w.memberSearch)}">
            <div class="wizard-check-list">${rows || `<span style="color:var(--muted)">No users found.</span>`}</div>
        `;
    }
    if (w.step === 4) {
        const eligibleLeads = state.teamMgmt.allUsers.filter((u) =>
            w.selectedMemberIds.includes(u.id) && (u.role === "lead" || u.role === "manager" || u.role === "admin")
        );
        if (!eligibleLeads.length) {
            return `
                <div class="wizard-step-title">Assign lead</div>
                <p class="wizard-step-sub">No lead-role members selected.</p>
                <div class="wizard-lead-empty">
                    None of the selected members have the <strong>lead</strong> role. Go back and include at least one user with the lead, manager, or admin role.
                </div>
            `;
        }
        const rows = eligibleLeads.map((u) => {
            const checked = w.leadUserId === u.id ? "checked" : "";
            return `<label class="wizard-check-row">
                <input type="radio" name="wizardLead" value="${u.id}" ${checked} data-lead-id="${u.id}">
                ${userAvatarHtml(u, 28)}
                <div>
                    <span>${escapeHtml(u.name)}</span>
                    <span class="wizard-lead-role-tag">${escapeHtml(u.role)}</span>
                </div>
            </label>`;
        }).join("");
        return `
            <div class="wizard-step-title">Assign lead</div>
            <p class="wizard-step-sub">Pick the team lead from the selected members.</p>
            <div class="wizard-check-list">${rows}</div>
            ${w.errors?.lead ? `<div class="wizard-error">${escapeHtml(w.errors.lead)}</div>` : ""}
        `;
    }
    if (w.step === 5) {
        const selectedProjects = state.teamMgmt.allProjects.filter((p) => w.selectedProjectIds.includes(p.id));
        const selectedMembers = state.teamMgmt.allUsers.filter((u) => w.selectedMemberIds.includes(u.id));
        const leadUser = state.teamMgmt.allUsers.find((u) => u.id === w.leadUserId);
        const previewColor = w.color || "#818cf8";
        return `
            <div class="wizard-step-title">Review</div>
            <p class="wizard-step-sub">Confirm your new team before creating it.</p>
            <div class="wizard-review-grid">
                <div class="wizard-review-row">
                    <span class="wizard-review-label">Name</span>
                    <span class="wizard-review-value">${escapeHtml(w.name || "—")}</span>
                </div>
                <div class="wizard-review-row">
                    <span class="wizard-review-label">Short code</span>
                    <span class="wizard-review-value">${escapeHtml(w.shortCode || "—")}</span>
                </div>
                <div class="wizard-review-row">
                    <span class="wizard-review-label">Color</span>
                    <span class="wizard-review-value"><span class="color-swatch" style="background:${escapeHtml(previewColor)};width:20px;height:20px;border-radius:5px;display:inline-block"></span></span>
                </div>
                ${w.description ? `<div class="wizard-review-row">
                    <span class="wizard-review-label">Description</span>
                    <span class="wizard-review-value">${escapeHtml(w.description)}</span>
                </div>` : ""}
                <div class="wizard-review-row">
                    <span class="wizard-review-label">Projects</span>
                    <span class="wizard-review-value">${selectedProjects.length ? selectedProjects.map((p) => escapeHtml(p.name)).join(", ") : "None"}</span>
                </div>
                <div class="wizard-review-row">
                    <span class="wizard-review-label">Members</span>
                    <span class="wizard-review-value">${selectedMembers.length ? selectedMembers.map((u) => escapeHtml(u.name)).join(", ") : "None"}</span>
                </div>
                <div class="wizard-review-row">
                    <span class="wizard-review-label">Lead</span>
                    <span class="wizard-review-value">${leadUser ? escapeHtml(leadUser.name) : "None"}</span>
                </div>
            </div>
            ${w.errors.save ? `<div style="margin-top:12px;color:var(--attention);font-weight:700">${escapeHtml(w.errors.save)}</div>` : ""}
        `;
    }
    return "";
}

function bindWizardEvents() {
    const w = state.teamMgmt.wizard;
    if (!w) return;
    const backBtn = document.getElementById("wizardBackBtn");
    const nextBtn = document.getElementById("wizardNextBtn");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (w.step > 1) {
                w.step -= 1;
                renderTeamMgmt();
            } else {
                state.teamMgmt.wizard = null;
                renderTeamMgmt();
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => nextWizardStep());
    }
    // Step-specific bindings
    if (w.step === 1) {
        const nameInput = document.getElementById("wizardName");
        const codeInput = document.getElementById("wizardShortCode");
        const descInput = document.getElementById("wizardDesc");
        if (nameInput) {
            nameInput.addEventListener("input", () => {
                w.name = nameInput.value;
                if (!w._codeManuallyEdited) {
                    w.shortCode = nameInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
                    if (codeInput) codeInput.value = w.shortCode;
                }
            });
        }
        if (codeInput) {
            codeInput.addEventListener("input", () => {
                w._codeManuallyEdited = true;
                w.shortCode = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
                codeInput.value = w.shortCode;
            });
        }
        if (descInput) {
            descInput.addEventListener("input", () => { w.description = descInput.value; });
        }
        document.querySelectorAll("[data-color]").forEach((swatch) => {
            swatch.addEventListener("click", () => {
                w.color = swatch.dataset.color;
                document.querySelectorAll("[data-color]").forEach((s) => s.classList.toggle("is-selected", s.dataset.color === w.color));
            });
        });
    }
    if (w.step === 2) {
        document.querySelectorAll("[data-proj-id]").forEach((cb) => {
            cb.addEventListener("change", () => {
                const pid = Number(cb.value);
                if (cb.checked) {
                    if (!w.selectedProjectIds.includes(pid)) w.selectedProjectIds.push(pid);
                } else {
                    w.selectedProjectIds = w.selectedProjectIds.filter((id) => id !== pid);
                }
            });
        });
    }
    if (w.step === 3) {
        const bindMemberCheckboxes = () => {
            document.querySelectorAll("[data-member-id]").forEach((cb) => {
                cb.addEventListener("change", () => {
                    const uid = Number(cb.value);
                    if (cb.checked) {
                        if (!w.selectedMemberIds.includes(uid)) w.selectedMemberIds.push(uid);
                    } else {
                        w.selectedMemberIds = w.selectedMemberIds.filter((id) => id !== uid);
                        if (w.leadUserId === uid) w.leadUserId = null;
                    }
                });
            });
        };
        bindMemberCheckboxes();
        const searchInput = document.getElementById("wizardMemberSearch");
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                w.memberSearch = searchInput.value;
                const list = document.querySelector("#wizardContent .wizard-check-list");
                if (!list) return;
                const q = w.memberSearch.toLowerCase();
                const filtered = state.teamMgmt.allUsers.filter((u) =>
                    !q || u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
                );
                list.innerHTML = filtered.map((u) => {
                    const checked = w.selectedMemberIds.includes(u.id) ? "checked" : "";
                    return `<label class="wizard-check-row">
                        <input type="checkbox" value="${u.id}" ${checked} data-member-id="${u.id}">
                        ${userAvatarHtml(u, 28)}
                        <span>${escapeHtml(u.name)}${u.email ? `<span style="color:var(--muted);font-size:0.78rem;display:block">${escapeHtml(u.email)}</span>` : ""}</span>
                    </label>`;
                }).join("") || `<span style="color:var(--muted)">No users found.</span>`;
                bindMemberCheckboxes();
            });
        }
    }
    if (w.step === 4) {
        document.querySelectorAll("[data-lead-id]").forEach((rb) => {
            rb.addEventListener("change", () => {
                w.leadUserId = Number(rb.value);
            });
        });
    }
}

async function nextWizardStep() {
    const w = state.teamMgmt.wizard;
    if (!w) return;
    w.errors = {};
    if (w.step === 1) {
        if (!w.name.trim()) { w.errors.name = "Team name is required."; renderTeamMgmt(); return; }
    }
    if (w.step === 4) {
        if (!w.leadUserId) { w.errors.lead = "Please select a team lead before continuing."; renderTeamMgmt(); return; }
    }
    if (w.step < 5) {
        w.step += 1;
        renderTeamMgmt();
        return;
    }
    // Step 5: create team
    w.saving = true;
    renderTeamMgmt();
    try {
        const payload = await apiJson("/api/teams", {
            method: "POST",
            body: {
                name: w.name.trim(),
                id: w.shortCode.toLowerCase() || undefined,
                color: w.color,
                description: w.description,
                memberIds: w.selectedMemberIds,
                leadUserId: w.leadUserId,
                projectIds: w.selectedProjectIds,
            }
        });
        state.teamMgmt.wizard = null;
        state.teamMgmt.selectedTeamId = payload.team.id;
        state.teamMgmt.selectedTeam = payload.team;
        await loadTeamMgmt();
    } catch (err) {
        w.saving = false;
        w.errors.save = err.message || "Failed to create team.";
        renderTeamMgmt();
    }
}

// ─────────────────────────────────────────────────────────────────────

function addDraftTeam() {
    // legacy stub — new teams are created via wizard
}

function renderTeamSettings() {
    // legacy stub — new UI is rendered by renderTeamMgmt()
}

function renderAllUsersPreview() {
    const users = state.users.length > 0 ? state.users : state.members;
    if (users.length === 0) {
        return `<div class="empty-mini">No users loaded yet.</div>`;
    }
    return `
        <div class="all-users-preview">
            <div class="meta-label">Loaded users (${users.length})</div>
            <div class="team-member-list">
                ${users.map((member) => `
                    <div class="check-row">
                        <span>${escapeHtml(member.name)}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function renderTeamSettingsItem(team) {
    const isOpen = state.teamDraft.openTeamId === team.id;
    const sortedUsers = sortedUsersForTeam(team);
    const isExpanded = state.teamDraft.expandedMemberLists[team.id] === true;
    const visibleLimit = 7;
    const selectedCount = sortedUsers.filter((member) => team.memberIds.includes(member.id)).length;
    const collapsedCount = Math.max(visibleLimit, selectedCount);
    const visibleUsers = isExpanded ? sortedUsers : sortedUsers.slice(0, collapsedCount);
    const hiddenCount = Math.max(0, sortedUsers.length - visibleUsers.length);
    const searchQuery = state.teamDraft.searchQueries[team.id] || "";
    return `
        <article class="team-settings-card ${isOpen ? "is-open" : ""}" data-team-card="${escapeHtml(team.id)}">
            <div class="team-settings-header">
                <button class="team-toggle-button" data-open-team="${escapeHtml(team.id)}" type="button" aria-expanded="${isOpen ? "true" : "false"}">
                    ${isOpen ? "Hide" : "Edit"}
                </button>
                <input data-team-name="${escapeHtml(team.id)}" type="text" value="${escapeHtml(team.name)}" aria-label="Team name">
                <button class="secondary-button" data-remove-team="${escapeHtml(team.id)}" type="button">Remove</button>
            </div>
            <div class="team-member-list ${isOpen ? "" : "is-hidden"}">
                <label class="field team-search-field">
                    <span>User search</span>
                    <input data-team-search="${escapeHtml(team.id)}" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search users">
                </label>
                ${visibleUsers.map((member) => `
                    <label class="check-row">
                        <input data-team-member="${escapeHtml(team.id)}" type="checkbox" value="${member.id}" ${team.memberIds.includes(member.id) ? "checked" : ""}>
                        <span>${escapeHtml(member.name)}</span>
                    </label>
                `).join("")}
                ${hiddenCount > 0 || isExpanded ? `
                    <button class="member-list-toggle" data-expand-team-members="${escapeHtml(team.id)}" type="button" aria-expanded="${isExpanded ? "true" : "false"}">
                        ${isExpanded ? "Show less ^" : `Show ${hiddenCount} more v`}
                    </button>
                ` : ""}
            </div>
        </article>
    `;
}

function sortedUsersForTeam(team) {
    const selectedIds = new Set(team.memberIds);
    const query = String(state.teamDraft.searchQueries[team.id] || "").trim().toLowerCase();
    return [...state.users]
        .filter((member) => selectedIds.has(member.id) || !query || member.name.toLowerCase().includes(query))
        .sort((a, b) => {
        const selectedSort = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
        if (selectedSort !== 0) {
            return selectedSort;
        }
        return a.name.localeCompare(b.name);
    });
}

function updateDraftTeamSearch(teamId, query) {
    state.teamDraft.searchQueries[teamId] = query;
    state.teamDraft.openTeamId = teamId;
    state.teamDraft.expandedMemberLists[teamId] = false;
    renderTeamSettings();
}

function openDraftTeam(teamId) {
    state.teamDraft.openTeamId = state.teamDraft.openTeamId === teamId ? "" : teamId;
    renderTeamSettings();
}

function toggleDraftTeamMemberList(teamId) {
    state.teamDraft.openTeamId = teamId;
    state.teamDraft.expandedMemberLists[teamId] = !state.teamDraft.expandedMemberLists[teamId];
    renderTeamSettings();
}

function syncJsonTeamClicks() { /* legacy stub */ }

function teamIndexFromTextareaClick(event) {
    const textarea = event.currentTarget;
    const textBeforeCursor = textarea.value.slice(0, textarea.selectionStart || 0);
    const matches = textBeforeCursor.match(/"id":/g);
    return matches ? matches.length - 1 : -1;
}

function updateDraftTeamName(teamId, name) {
    const team = state.teamDraft.teams.find((item) => item.id === teamId);
    if (team) {
        team.name = name.trim();
        state.teamDraft.openTeamId = team.id;
        validateTeamDraft();
        applyValidTeamDraft();
        renderTeamSettings();
        syncWorkControls();
    }
}

function removeDraftTeam(teamId) {
    state.teamDraft.teams = state.teamDraft.teams.filter((team) => team.id !== teamId);
    if (state.teamDraft.openTeamId === teamId) {
        state.teamDraft.openTeamId = state.teamDraft.teams[0]?.id || "";
    }
    validateTeamDraft();
    applyValidTeamDraft();
    renderTeamSettings();
    syncWorkControls();
}

function toggleDraftTeamMember(teamId, memberId, checked) {
    const team = state.teamDraft.teams.find((item) => item.id === teamId);
    if (!team) {
        return;
    }
    state.teamDraft.openTeamId = team.id;
    if (checked && !team.memberIds.includes(memberId)) {
        team.memberIds.push(memberId);
    }
    if (!checked) {
        team.memberIds = team.memberIds.filter((id) => id !== memberId);
    }
    validateTeamDraft();
    applyValidTeamDraft();
    renderTeamSettings();
}

async function saveTeamConfigToFile() {
    // legacy stub — kept for backward compat with /team-config.json endpoint
    // New UI uses createTeam() which calls POST /api/teams directly
}

async function postJson(path, payload) {
    const url = new URL(`${state.config.proxyUrl}${path}`);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), state.config.requestTimeoutMs);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
            signal: controller.signal
        });
        const text = await response.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(formatProxyError(response.status, parsed));
        }
        return parsed;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("Saving team config timed out.");
        }
        if (error instanceof TypeError) {
            throw new Error("Unable to reach the local proxy to save team config.");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

function setSettingsMessage(_message) { /* legacy stub */ }

function validateTeamDraft() {
    const errors = [];
    const seenNames = new Set();
    const seenIds = new Set();
    const validMemberIds = new Set(state.users.map((member) => member.id));

    for (const team of state.teamDraft.teams) {
        if (!team.id || seenIds.has(team.id)) {
            errors.push("Team IDs must be unique.");
        }
        seenIds.add(team.id);
        const name = team.name.trim();
        const key = name.toLowerCase();
        if (!name) {
            errors.push("Team names cannot be empty.");
        } else if (seenNames.has(key)) {
            errors.push("Team names must be unique.");
        }
        seenNames.add(key);
        if (team.memberIds.some((id) => !validMemberIds.has(id))) {
            errors.push(`${team.name || "Team"} includes an unknown user.`);
        }
    }

    state.teamDraft.errors = [...new Set(errors)];
    return state.teamDraft.errors.length === 0;
}

function applyValidTeamDraft() {
    if (!validateTeamDraft()) {
        return;
    }
    state.teams = cloneTeams(state.teamDraft.teams);
    state.work.teamId = state.teams.some((team) => team.id === state.work.teamId)
        ? state.work.teamId
        : state.teams[0]?.id || "";
}

function slugify(value) {
    const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    let candidate = slug || "team";
    let index = 2;
    const existing = new Set(state.teamDraft.teams.map((team) => team.id));
    while (existing.has(candidate)) {
        candidate = `${slug || "team"}-${index}`;
        index += 1;
    }
    return candidate;
}

async function loadTeamSummaries(period) {
    const summaries = [];

    for (const member of state.members) {
        try {
            const rawEntries = await fetchAllPages("/time_entries.json", {
                user_id: member.id,
                from: period.startDate,
                to: period.endDate
            }, "time_entries");
            const entries = rawEntries.map((entry) => normalizeTimeEntry(entry, member.id));
            summaries.push(await createPeriodSummary(member, entries, period));
        } catch (error) {
            summaries.push(createFailureSummary(member, error, period));
        }
    }

    return summaries;
}

async function loadWorkOverviewSummary(selectedMembers) {
    const ticketsByMember = {};
    const excludedStatusCounts = {};
    const warnings = [];
    let totalWorkingTickets = 0;
    let activePeopleCount = 0;

    for (const member of selectedMembers) {
        try {
            const rawIssues = await fetchAllPages("/issues.json", {
                assigned_to_id: member.id,
                status_id: "*"
            }, "issues");
            const tickets = rawIssues.map((issue) => normalizeWorkTicket(issue, member.id));
            const workingTickets = [];
            for (const ticket of tickets) {
                if (ticket.isWorking) {
                    workingTickets.push(ticket);
                } else {
                    excludedStatusCounts[ticket.status] = (excludedStatusCounts[ticket.status] || 0) + 1;
                }
                warnings.push(...ticket.warnings.map((warning) => `#${ticket.issueId}: ${warning}`));
            }
            ticketsByMember[member.id] = workingTickets.sort(sortWorkTickets);
            totalWorkingTickets += workingTickets.length;
            if (workingTickets.length > 0) {
                activePeopleCount += 1;
            }
        } catch (error) {
            ticketsByMember[member.id] = [];
            warnings.push(`${member.name}: ${error.message || "Unable to load assigned issues"}`);
        }
    }

    return {
        scope: {
            mode: state.work.mode,
            teamId: state.work.teamId,
            memberIds: selectedMembers.map((member) => member.id),
            searchQuery: state.work.searchQuery
        },
        members: selectedMembers,
        totalWorkingTickets,
        activePeopleCount,
        ticketsByMember,
        excludedStatusCounts,
        warnings,
        stale: false
    };
}

function normalizeWorkTicket(issue, fallbackAssigneeId) {
    const status = issue.status?.name || "Unknown";
    const warnings = [];
    if (!KNOWN_WORK_STATUSES.has(status)) {
        warnings.push(`Unrecognized status ${status}`);
    }

    return {
        issueId: Number(issue.id),
        subject: issue.subject || "Untitled issue",
        projectName: issue.project?.name || "Unknown project",
        tracker: issue.tracker?.name || "No tracker",
        status,
        priority: issue.priority?.name || "No priority",
        assigneeId: Number(issue.assigned_to?.id || fallbackAssigneeId),
        startDate: issue.start_date || "",
        dueDate: issue.due_date || "",
        estimatedHours: Number.isFinite(Number(issue.estimated_hours)) ? Number(issue.estimated_hours) : null,
        spentHours: Number.isFinite(Number(issue.spent_hours)) ? Number(issue.spent_hours) : null,
        isWorking: !getExcludedWorkStatuses().has(status),
        warnings
    };
}

function getExcludedWorkStatuses() {
    const configured = state.workPhraseConfig?.excludedStatuses;
    if (Array.isArray(configured) && configured.length > 0) {
        return new Set(configured);
    }
    return EXCLUDED_WORK_STATUSES;
}

function sortWorkTickets(a, b) {
    const statusSort = a.status.localeCompare(b.status);
    if (statusSort !== 0) {
        return statusSort;
    }
    return String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31"));
}

async function fetchAllPages(path, params = {}, collectionKey) {
    const limit = 100;
    let offset = 0;
    const items = [];

    while (true) {
        const page = await fetchJson(path, { ...params, limit, offset });
        const entries = Array.isArray(page[collectionKey]) ? page[collectionKey] : [];
        items.push(...entries);

        const total = Number(page.total_count || entries.length);
        offset += Number(page.limit || limit);

        if (offset >= total || entries.length === 0) {
            break;
        }
    }

    return items;
}

async function fetchJson(path, params = {}) {
    const url = new URL(`${state.config.proxyUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), state.config.requestTimeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal, credentials: "include" });
        const text = await response.text();
        let payload;

        try {
            payload = text ? JSON.parse(text) : {};
        } catch {
            throw new Error("The proxy returned a non-JSON response.");
        }

        if (!response.ok) {
            throw new Error(formatProxyError(response.status, payload));
        }

        return payload;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The Redmine request timed out.");
        }
        if (error instanceof TypeError) {
            throw new Error("Unable to reach the local proxy. Check that proxy.py is running.");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function apiJson(path, options = {}) {
    const url = new URL(`${state.config.proxyUrl}${path}`);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), state.config.requestTimeoutMs);
    try {
        const response = await fetch(url, {
            method: options.method || "GET",
            headers: options.body ? { "Content-Type": "application/json" } : {},
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal,
            credentials: "include"
        });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(formatProxyError(response.status, payload));
        }
        return payload;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("The backend request timed out.");
        }
        if (error instanceof TypeError) {
            throw new Error("Unable to reach the local backend.");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

function debounce(callback, wait) {
    let timer = 0;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => callback(...args), wait);
    };
}

function formatProxyError(status, payload) {
    if (status === 401 || status === 403) {
        return "Redmine authentication or proxy authorization failed.";
    }
    if (payload && payload.error) {
        return payload.error;
    }
    return `Redmine request failed with HTTP ${status}.`;
}

function normalizeTimeEntry(entry, fallbackUserId) {
    const spentOn = entry.spent_on || "";
    const updatedOn = entry.updated_on || "";
    const createdOn = entry.created_on || "";
    const projectName = entry.project?.name || "Unknown project";
    const issueId = entry.issue?.id || null;
    const activityName = entry.activity?.name || "";
    const comments = String(entry.comments || "").trim();

    return {
        id: entry.id || null,
        userId: entry.user?.id || fallbackUserId,
        spentOn,
        hours: Number(entry.hours || 0),
        projectName,
        issueId,
        issueSubject: entry.issue?.subject || "",
        activityName,
        comments,
        createdOn,
        updatedOn,
        observedAt: updatedOn || createdOn || spentOn
    };
}

async function createPeriodSummary(member, entries, period) {
    const warnings = [];
    const usableEntries = entries.filter((entry) => {
        if (!entry.spentOn) {
            warnings.push("Missing spent date");
            return false;
        }
        return entry.spentOn >= period.startDate && entry.spentOn <= period.endDate;
    });

    const activityRows = await createActivityRows(member, usableEntries);
    const totalSpentHours = roundHours(activityRows.reduce((sum, row) => sum + row.spentHours, 0));
    const latestRow = chooseLatestRow(activityRows);
    const remainingEstimate = createRemainingEstimate(activityRows);
    const status = deriveStatus(latestRow, totalSpentHours, warnings, remainingEstimate);

    return {
        member,
        period,
        status,
        activityRows,
        visibleActivityRows: activityRows.slice(0, 5),
        hiddenActivityCount: Math.max(0, activityRows.length - 5),
        totalSpentHours,
        remainingEstimate,
        lastActivityAt: latestRow?.latestActivityAt || "",
        warnings,
        stale: false
    };
}

function createFailureSummary(member, error, period = state.period) {
    return {
        member,
        period,
        status: "no-data",
        activityRows: [],
        visibleActivityRows: [],
        hiddenActivityCount: 0,
        totalSpentHours: 0,
        remainingEstimate: {
            label: "Remaining unknown",
            knownRemainingHours: null,
            knownEstimatedHours: null,
            unknownRowCount: 0,
            state: "unknown",
            basis: "Member data could not be loaded"
        },
        lastActivityAt: "",
        warnings: [error.message || "Unable to load member data"],
        stale: false
    };
}

async function createActivityRows(member, entries) {
    const groups = new Map();

    for (const entry of entries) {
        const key = entry.issueId
            ? `issue:${entry.issueId}`
            : `fallback:${entry.projectName}:${entry.activityName}:${entry.comments}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(entry);
    }

    const rows = [];
    for (const [key, groupEntries] of groups.entries()) {
        const first = groupEntries[0];
        const issue = first.issueId ? await fetchIssueDetails(first.issueId) : null;
        const spentHours = roundHours(groupEntries.reduce((sum, entry) => sum + entry.hours, 0));
        const latestActivityAt = chooseLatestEntry(groupEntries)?.observedAt || first.spentOn;
        const subject = issue?.subject || first.issueSubject || "";
        const summary = subject || first.activityName || first.comments || "Redmine time entry";
        const estimate = calculateRowEstimate(spentHours, issue);
        rows.push({
            key,
            memberId: member.id,
            projectName: first.projectName,
            issueId: first.issueId,
            issueSubject: subject,
            activityName: first.activityName,
            summary,
            spentHours,
            latestActivityAt,
            estimatedHours: issue?.estimatedHours ?? null,
            remainingHours: estimate.remainingHours,
            estimateState: estimate.state,
            entryCount: groupEntries.length,
            warnings: estimate.warnings
        });
    }

    return rows.sort((a, b) => {
        const byTime = timestampValue(b.latestActivityAt) - timestampValue(a.latestActivityAt);
        if (byTime !== 0) {
            return byTime;
        }
        return b.spentHours - a.spentHours;
    });
}

async function fetchIssueDetails(issueId) {
    if (state.issueCache.has(issueId)) {
        return state.issueCache.get(issueId);
    }

    try {
        const payload = await fetchJson(`/issues/${issueId}.json`);
        const issue = payload.issue || {};
        const result = {
            issueId,
            subject: issue.subject || "",
            statusName: issue.status?.name || "",
            estimatedHours: Number.isFinite(Number(issue.estimated_hours)) ? Number(issue.estimated_hours) : null,
            loaded: true,
            error: ""
        };
        state.issueCache.set(issueId, result);
        return result;
    } catch (error) {
        const result = {
            issueId,
            subject: "",
            statusName: "",
            estimatedHours: null,
            loaded: false,
            error: error.message || "Issue estimate unavailable"
        };
        state.issueCache.set(issueId, result);
        return result;
    }
}

function calculateRowEstimate(spentHours, issue) {
    if (!issue || !issue.loaded) {
        return { remainingHours: null, state: "unknown", warnings: ["Issue estimate unavailable"] };
    }
    if (!Number.isFinite(issue.estimatedHours) || issue.estimatedHours <= 0) {
        return { remainingHours: null, state: "unknown", warnings: ["Missing estimate"] };
    }
    if (spentHours > issue.estimatedHours) {
        return { remainingHours: 0, state: "over-estimate", warnings: ["Spent exceeds estimate"] };
    }
    return { remainingHours: roundHours(issue.estimatedHours - spentHours), state: "known", warnings: [] };
}

function createRemainingEstimate(rows) {
    const knownRows = rows.filter((row) => Number.isFinite(row.remainingHours));
    const unknownRowCount = rows.length - knownRows.length;
    const hasOverEstimate = rows.some((row) => row.estimateState === "over-estimate");
    const knownRemainingHours = roundHours(knownRows.reduce((sum, row) => sum + row.remainingHours, 0));
    const knownEstimatedHours = roundHours(rows.reduce((sum, row) => sum + (Number(row.estimatedHours) || 0), 0));

    if (rows.length === 0) {
        return {
            label: "Remaining unknown",
            knownRemainingHours: null,
            knownEstimatedHours: null,
            unknownRowCount: 0,
            state: "unknown",
            basis: "No period activity"
        };
    }
    if (knownRows.length === 0) {
        return {
            label: "Remaining unknown",
            knownRemainingHours: null,
            knownEstimatedHours,
            unknownRowCount,
            state: "unknown",
            basis: "No usable issue estimates"
        };
    }
    if (hasOverEstimate) {
        return {
            label: `${formatHours(knownRemainingHours)} remaining, over estimate`,
            knownRemainingHours,
            knownEstimatedHours,
            unknownRowCount,
            state: "over-estimate",
            basis: "Some spent time exceeds issue estimate"
        };
    }
    if (unknownRowCount > 0) {
        return {
            label: `${formatHours(knownRemainingHours)} known remaining, partial`,
            knownRemainingHours,
            knownEstimatedHours,
            unknownRowCount,
            state: "partial",
            basis: `${unknownRowCount} row(s) missing estimates`
        };
    }
    return {
        label: `${formatHours(knownRemainingHours)} remaining`,
        knownRemainingHours,
        knownEstimatedHours,
        unknownRowCount,
        state: "known",
        basis: "Redmine issue estimates"
    };
}

function chooseLatestEntry(entries) {
    return [...entries].sort((a, b) => {
        const aTime = timestampValue(a.observedAt);
        const bTime = timestampValue(b.observedAt);
        if (bTime !== aTime) {
            return bTime - aTime;
        }
        return Number(b.id || 0) - Number(a.id || 0);
    })[0] || null;
}

function chooseLatestRow(rows) {
    return [...rows].sort((a, b) => timestampValue(b.latestActivityAt) - timestampValue(a.latestActivityAt))[0] || null;
}

function deriveStatus(latestRow, totalSpentHours, warnings, remainingEstimate) {
    if (warnings.length > 0 && totalSpentHours === 0 && !latestRow) {
        return "no-data";
    }
    if (!latestRow) {
        return "inactive-period";
    }
    if (hasSuspiciousTiming(latestRow) || remainingEstimate.state === "over-estimate") {
        return "needs-attention";
    }

    const ageMinutes = minutesSince(latestRow.latestActivityAt);
    if (ageMinutes <= state.config.activeWindowMinutes) {
        return "active";
    }
    if (ageMinutes <= state.config.recentWindowMinutes) {
        return "recently-active";
    }
    return "recently-active";
}

function hasSuspiciousTiming(row) {
    const observed = parseDate(row.latestActivityAt);
    if (!observed) {
        return false;
    }
    return observed.getTime() > Date.now() + 60 * 1000;
}

function render() {
    renderViewShell();
    renderRefreshState();
    if (state.view === "settings") {
        // team mgmt renders itself once data is loaded via loadTeamMgmt / renderTeamMgmt
    } else if (state.view === "planner") {
        renderPlanner();
    } else if (state.view === "work-overview") {
        renderWorkOverview();
    } else {
        renderCounts();
        renderFilterButtons();
        renderBoard();
        renderDetailView();
    }
}

function renderViewShell() {
    const isSettings = state.view === "settings";
    const isWork = state.view === "work-overview";
    const isPlanner = state.view === "planner";

    els.viewSelect.value = isSettings ? (state.previousView || "planner") : state.view;

    els.periodPanel.classList.toggle("is-hidden", isWork || isPlanner || isSettings);
    els.workControls.classList.toggle("is-hidden", !isWork);
    els.plannerControls.classList.toggle("is-hidden", !isPlanner);
    els.addPlannerTaskButton.classList.toggle("is-hidden", !isPlanner);

    els.plannerUserChip.classList.toggle("is-hidden", !state.auth.user);

    els.timeSummaryStrip.classList.toggle("is-hidden", isWork || isPlanner || isSettings);
    els.workSummaryStrip.classList.toggle("is-hidden", !isWork);
    els.plannerSummaryStrip.classList.toggle("is-hidden", !isPlanner);
    els.board.classList.toggle("is-hidden", isWork || isPlanner || isSettings);
    els.workBoard.classList.toggle("is-hidden", !isWork);
    els.plannerBoard.classList.toggle("is-hidden", !isPlanner);
    els.settingsPanel.classList.toggle("is-hidden", !isSettings);
    els.noticeBar.classList.toggle("is-hidden", isSettings);
    renderPlannerUserChip();
    if (isPlanner) {
        syncPlannerControls();
    }
    if (isWork) {
        syncWorkControls();
    }
}

function renderRefreshState() {
    const isLoading = state.refresh.state === "loading";
    els.refreshButton.disabled = isLoading;
    els.refreshButton.classList.toggle("is-spinning", isLoading);
    renderStaticHeader();

    if (!state.refresh.message) {
        els.notice.classList.add("is-hidden");
        return;
    }

    els.notice.innerHTML = state.refresh.state === "loading"
        ? `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(state.refresh.message)}</span>`
        : escapeHtml(state.refresh.message);
    els.notice.dataset.tone = state.refresh.state === "failed"
        ? "error"
        : state.refresh.state === "loading"
            ? "loading"
            : state.refresh.state === "empty"
                ? "empty"
                : state.refresh.state === "partial"
                    ? "partial"
                    : "success";
    els.notice.classList.remove("is-hidden");
}

function renderCounts() {
    const counts = countStatuses(state.summaries);
    els.countAll.textContent = state.summaries.length;
    els.countActive.textContent = counts.active || 0;
    els.countRecent.textContent = counts["recently-active"] || 0;
    els.countInactive.textContent = counts["inactive-period"] || 0;
    els.countAttention.textContent = counts["needs-attention"] || 0;
}

function renderFilterButtons() {
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.statusFilter === state.statusFilter);
    });
}

function renderBoard() {
    const visibleSummaries = state.statusFilter === "all"
        ? state.summaries
        : state.summaries.filter((summary) => summary.status === state.statusFilter);

    els.emptyState.classList.toggle("is-hidden", state.members.length > 0);
    els.board.innerHTML = "";

    for (const summary of visibleSummaries) {
        els.board.appendChild(renderMemberCard(summary));
    }
}

function renderPlannerUserChip() {
    if (!state.auth.user) {
        els.plannerUserChip.innerHTML = "";
        return;
    }
    const user = state.auth.user;
    const initialsText = initialsFromName(user.displayName || user.username);
    const avatarColor = user.avatarColor || "av-a";
    const roleLabel = user.role === "admin" ? "Admin" : user.role;
    els.plannerUserChip.innerHTML = `
        <button class="planner-user-chip" type="button" aria-haspopup="true" aria-expanded="false" id="userChipToggle">
            <span class="planner-avatar ${escapeHtml(avatarColor)}">${escapeHtml(initialsText)}</span>
            <span class="planner-user-name">${escapeHtml(user.displayName || user.username)}</span>
            <span class="planner-user-role">${escapeHtml(roleLabel)}</span>
        </button>
        <div class="user-menu is-hidden" id="userMenu">
            <button class="user-menu-item" type="button" id="userMenuSettings">Settings</button>
            <button class="user-menu-item" type="button" id="userMenuLogout">Sign out</button>
        </div>
    `;
    document.getElementById("userChipToggle").addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = document.getElementById("userMenu");
        const isOpen = !menu.classList.contains("is-hidden");
        menu.classList.toggle("is-hidden", isOpen);
        e.currentTarget.setAttribute("aria-expanded", String(!isOpen));
    });
    document.getElementById("userMenuSettings").addEventListener("click", () => {
        document.getElementById("userMenu").classList.add("is-hidden");
        openSettings();
    });
    document.getElementById("userMenuLogout").addEventListener("click", () => {
        document.getElementById("userMenu").classList.add("is-hidden");
        handleLogout();
    });
}

function renderPlanner() {
    syncPlannerControls();
    const tasks = state.planner.tasks;
    const openTasks = tasks.filter((task) => task.statusId !== "done");
    const teamsInScope = new Set(tasks.map((task) => task.teamId));
    els.plannerTeamCount.textContent = state.auth.user?.role === "lead" ? 1 : (teamsInScope.size || state.planner.teams.length);
    els.plannerOpenCount.textContent = openTasks.length;
    els.plannerCriticalCount.textContent = openTasks.filter((task) => task.priorityId === "critical").length;
    els.plannerOverdueCount.textContent = openTasks.filter((task) => isOverdue(task.dueDate)).length;
    const nonePriorityCount = openTasks.filter((task) => task.priorityId === "none").length;
    els.plannerNoneCount.textContent = nonePriorityCount;
    els.plannerNonePriorityTile.classList.toggle("has-warning", nonePriorityCount > 0);
    els.plannerNonePriorityTile.classList.toggle("is-selected", state.planner.nonePriorityFirst);
    els.plannerBoard.innerHTML = "";

    if (tasks.length === 0) {
        els.plannerBoard.innerHTML = `<div class="empty-state planner-empty"><h2>No high-level tasks yet</h2><p>Create a task and optionally link it to a Redmine ticket.</p></div>`;
        return;
    }

    if (state.planner.nonePriorityFirst) {
        els.plannerBoard.classList.add("is-list");
        els.plannerBoard.classList.remove("is-lanes");
        const listTasks = nonePrioritySortedTasks(tasks);
        els.plannerBoard.innerHTML = `
            <div class="planner-none-list-banner">
                <div>
                    <strong>None priority tasks</strong>
                    <span>Shown first so they can be triaged into a real priority.</span>
                </div>
                <button class="secondary-button" id="closeNonePriorityListButton" type="button">Close</button>
            </div>
            ${listTasks.map(renderPlannerTaskCard).join("")}
        `;
    } else {
        els.plannerBoard.classList.add("is-lanes");
        els.plannerBoard.classList.remove("is-list");
        els.plannerBoard.innerHTML = plannerLaneItems().map((lane) => {
            const laneTasks = tasks.filter((task) => state.planner.groupMode === "priority" ? task.priorityId === lane.id : task.categoryId === lane.id);
            return `
                <section class="planner-lane ${escapeHtml(lane.colorClass || "")}">
                    <div class="planner-lane-title">
                        <span>${escapeHtml(lane.label)}</span>
                        <span class="lane-count">${laneTasks.length}</span>
                    </div>
                    <div class="planner-lane-stack">
                        ${laneTasks.length ? laneTasks.map(renderPlannerTaskCard).join("") : `<div class="empty-mini">No tasks</div>`}
                    </div>
                </section>
            `;
        }).join("");
    }

    els.plannerBoard.querySelector("#closeNonePriorityListButton")?.addEventListener("click", closeNonePriorityTasksFirst);
    els.plannerBoard.querySelectorAll("[data-planner-edit]").forEach((button) => {
        button.addEventListener("click", () => {
            const task = state.planner.tasks.find((item) => String(item.id) === button.dataset.plannerEdit);
            openPlannerEditor(task);
        });
    });
    els.plannerBoard.querySelectorAll("[data-planner-delete]").forEach((button) => {
        button.addEventListener("click", async () => {
            const taskId = button.dataset.plannerDelete;
            const task = state.planner.tasks.find((item) => String(item.id) === taskId);
            if (!task) return;
            if (!confirm(`Delete "${task.title}"?`)) return;
            try {
                await apiJson(`/api/tasks/${taskId}`, { method: "DELETE" });
                await refreshPlanner();
            } catch (error) {
                alert(error.message || "Failed to delete task.");
            }
        });
    });
}

function nonePrioritySortedTasks(tasks) {
    return [...tasks].sort((a, b) => {
        const aNone = a.priorityId === "none" ? 0 : 1;
        const bNone = b.priorityId === "none" ? 0 : 1;
        if (aNone !== bNone) {
            return aNone - bNone;
        }
        return String(a.dueDate || "9999-99-99").localeCompare(String(b.dueDate || "9999-99-99"));
    });
}

function plannerLaneItems() {
    return state.planner.groupMode === "priority"
        ? state.planner.priorities.filter((priority) => priority.id !== "none")
        : state.planner.categories;
}

function renderPlannerTaskCard(task) {
    const priority = lookup(state.planner.priorities, task.priorityId);
    const category = lookup(state.planner.categories, task.categoryId);
    const status = lookup(state.planner.statuses, task.statusId);
    const team = lookup(state.planner.teams, task.teamId);
    const due = dueLabel(task.dueDate);
    const linkedChip = task.redmineLinked
        ? `<span class="planner-chip chip-synced" title="${escapeHtml(task.issueKey || "")}">
               <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
           </span>`
        : "";
    return `
        <article class="planner-task-card ${escapeHtml(priority?.colorClass || "")}">
            <div class="planner-task-head">
                <div class="planner-chip-row">
                    <span class="planner-chip ${escapeHtml(category?.colorClass || "")}">${escapeHtml(category?.label || task.categoryId)}</span>
                    ${team ? `<span class="planner-chip chip-team">${escapeHtml(team.name)}</span>` : ""}
                    ${linkedChip}
                    <span class="status-pill">${escapeHtml(status?.label || task.statusId)}</span>
                </div>
            </div>
            <h2>${escapeHtml(task.title)}</h2>
            ${task.description ? `<p class="card-desc">${escapeHtml(task.description)}</p>` : ""}
            <div class="planner-card-grid">
                <div><span>Project</span><strong>${escapeHtml(task.projectName || "Project")}</strong></div>
                <div><span>Priority</span><strong class="priority-val">${escapeHtml(priority?.label || task.priorityId)}</strong></div>
                <div><span>Due</span><strong class="${due.className}">${escapeHtml(task.dueDate || "Not set")}</strong><small>${escapeHtml(due.label)}</small></div>
                <div><span>Linked issue</span><strong class="issue-key-val">${task.issueKey ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> ${escapeHtml(task.issueKey)}` : "Not linked"}</strong></div>
            </div>
            <div class="planner-members">
                <span>MEMBERS (${task.members?.length || 0})</span>
                <div>${(task.members || []).map((member) => `<span class="member-pill"><span class="mini-avatar ${escapeHtml(member.avatarColor || "")}">${escapeHtml(member.initials || initialsFromName(member.name))}</span>${escapeHtml(member.name)}</span>`).join("") || `<span class="no-members">No members assigned</span>`}</div>
            </div>
            <div class="card-actions">
                <button class="card-action-btn" type="button" data-planner-edit="${task.id}" aria-label="Edit task" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="card-action-btn card-action-delete" type="button" data-planner-delete="${task.id}" aria-label="Delete task" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </article>
    `;
}

function lookup(items, id) {
    return (items || []).find((item) => String(item.id) === String(id));
}

function isOverdue(value) {
    const date = parseLocalDate(value);
    return date && date < startOfDay(new Date());
}

function dueLabel(value) {
    const date = parseLocalDate(value);
    if (!date) {
        return { label: "No due date", className: "" };
    }
    if (date < startOfDay(new Date())) {
        return { label: "Overdue", className: "overdue" };
    }
    if (date <= addDays(startOfDay(new Date()), 7)) {
        return { label: "Due this week", className: "duesoon" };
    }
    return { label: "Upcoming", className: "" };
}

function initialsFromName(name) {
    return String(name || "U").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function renderWorkOverview() {
    const summary = state.work.summary || {
        members: resolveWorkMembers(),
        ticketsByMember: {},
        totalWorkingTickets: 0,
        activePeopleCount: 0,
        excludedStatusCounts: {},
        warnings: []
    };
    const excludedCount = Object.entries(summary.excludedStatusCounts || {})
        .filter(([status]) => NON_WORKING_COUNT_STATUSES.has(status))
        .reduce((sum, [, count]) => sum + count, 0);
    els.workTicketCount.textContent = summary.totalWorkingTickets || 0;
    els.workActivePeopleCount.textContent = summary.activePeopleCount || 0;
    els.workSelectedPeopleCount.textContent = summary.members?.length || 0;
    els.workExcludedCount.textContent = excludedCount;
    els.emptyState.classList.toggle("is-hidden", state.members.length > 0);
    els.workBoard.innerHTML = "";

    if (summary.warnings?.length) {
        const warning = document.createElement("div");
        warning.className = "work-warning";
        warning.textContent = summary.warnings.slice(0, 4).join(" ");
        els.workBoard.appendChild(warning);
    }

    for (const member of summary.members || []) {
        els.workBoard.appendChild(renderWorkMemberCard(member, summary.ticketsByMember?.[member.id] || []));
    }
}

function renderWorkMemberCard(member, tickets) {
    const card = document.createElement("article");
    card.className = "work-member-card";
    card.innerHTML = `
        <div class="card-top">
            <div>
                <h2 class="member-name">${escapeHtml(member.name)}</h2>
                <div class="period-label">${tickets.length} working ticket${tickets.length === 1 ? "" : "s"}</div>
            </div>
            <span class="status-badge ${tickets.length ? "status-active" : "status-inactive-period"}">${tickets.length ? "Working" : "No active work"}</span>
        </div>
        <div class="work-ticket-list">
            ${tickets.length ? tickets.map(renderWorkTicket).join("") : `<div class="activity-row empty-row">No working tickets assigned.</div>`}
        </div>
    `;
    return card;
}

function renderWorkTicket(ticket) {
    const priorityClass = priorityClassName(ticket.priority);
    const dueMeta = getDueMeta(ticket.dueDate);
    const issueUrl = buildIssueUrl(ticket.issueId);
    const ticketClass = `work-ticket ${state.work.showDetailedTickets ? "is-detailed" : "is-compact"} ${dueMeta.className}`;
    const detailMarkup = `
            <div class="work-ticket-project">Project: ${escapeHtml(ticket.projectName)}</div>
            <div class="work-ticket-fields">
                <div class="work-ticket-field">
                    <span class="work-ticket-label">▣ Tracker</span>
                    <span class="work-ticket-value">${escapeHtml(ticket.tracker)}</span>
                </div>
                <div class="work-ticket-field">
                    <span class="work-ticket-label">● Status</span>
                    <span class="work-ticket-value">${escapeHtml(ticket.status)}</span>
                </div>
                <div class="work-ticket-field priority-field ${priorityClass}">
                    <span class="work-ticket-label">◆ Priority</span>
                    <span class="work-ticket-value">${escapeHtml(ticket.priority)}</span>
                </div>
            </div>
        `;
    const dateMarkup = `
            <div class="work-ticket-fields work-ticket-date-fields">
                <div class="work-ticket-field">
                    <span class="work-ticket-label">↦ Start</span>
                    <span class="work-ticket-value">${escapeHtml(ticket.startDate || "Not set")}</span>
                </div>
                <div class="work-ticket-field ${dueMeta.className}">
                    <span class="work-ticket-label">◷ Due</span>
                    <span class="work-ticket-value">${escapeHtml(ticket.dueDate || "Not set")}</span>
                    <span class="due-hint">${escapeHtml(dueMeta.label)}</span>
                </div>
            </div>
        `;
    const compactMarkup = `
            <div class="work-ticket-phrase">${escapeHtml(compactTicketPhrase(ticket))}</div>
        `;
    const compactMetaMarkup = `
            <div class="compact-ticket-meta">
                <div class="work-ticket-field priority-field ${priorityClass}">
                    <span class="work-ticket-label">◆ Priority</span>
                    <span class="work-ticket-value">${escapeHtml(ticket.priority)}</span>
                </div>
                <div class="compact-date-stack">
                    <div class="work-ticket-field">
                        <span class="work-ticket-label">↦ Start</span>
                        <span class="work-ticket-value">${escapeHtml(ticket.startDate || "Not set")}</span>
                    </div>
                    <div class="work-ticket-field ${dueMeta.className}">
                        <span class="work-ticket-label">◷ Due</span>
                        <span class="work-ticket-value">${escapeHtml(ticket.dueDate || "Not set")}</span>
                        <span class="due-hint">${escapeHtml(dueMeta.label)}</span>
                    </div>
                </div>
            </div>
        `;
    return `
        <article class="${ticketClass}">
            ${!state.work.showDetailedTickets ? compactMarkup : ""}
            <div class="work-ticket-title-row">
                <div class="work-ticket-title">${escapeHtml(ticket.subject)}</div>
                <a class="issue-link" href="${escapeHtml(issueUrl)}" target="_blank" rel="noreferrer" title="Open Redmine ticket #${ticket.issueId}">#${ticket.issueId}</a>
            </div>
            ${state.work.showDetailedTickets ? detailMarkup : ""}
            ${state.work.showDetailedTickets ? dateMarkup : compactMetaMarkup}
            <div class="estimate-bar ${isEstimateOverrun(ticket) ? "is-overrun" : ""}">
                <div class="estimate-bar-top">
                    <span>Logged vs estimated</span>
                    <strong>${formatEstimateVsSpent(ticket)}</strong>
                </div>
                <div class="estimate-track">
                    <span style="width: ${estimateProgress(ticket)}%"></span>
                </div>
            </div>
            ${ticket.warnings.length ? `<div class="warning-list">${ticket.warnings.map((warning) => `<span class="warning-badge">${escapeHtml(warning)}</span>`).join("")}</div>` : ""}
        </article>
    `;
}

function compactTicketPhrase(ticket) {
    const phrases = state.workPhraseConfig?.phrases || {};
    const tracker = normalizeTrackerForPhrase(ticket.tracker);
    const template = phrases[ticket.status]?.[tracker] || phrases[ticket.status]?.None;
    if (!template) {
        return `${ticket.status || "Working"} in project ${ticket.projectName || "Unknown project"}`;
    }
    return template.replaceAll(state.workPhraseConfig.projectToken || "{project}", ticket.projectName || "Unknown project");
}

function normalizeTrackerForPhrase(tracker) {
    const trackerName = String(tracker || "").trim();
    if (!trackerName || trackerName.toLowerCase() === "no tracker") {
        return "None";
    }
    const phrases = state.workPhraseConfig?.phrases || {};
    for (const statusPhrases of Object.values(phrases)) {
        if (statusPhrases?.[trackerName]) {
            return trackerName;
        }
    }
    return "None";
}

function buildIssueUrl(issueId) {
    if (!state.config.redmineUrl) {
        return `#issue-${issueId}`;
    }
    return `${state.config.redmineUrl}/issues/${issueId}`;
}

function priorityClassName(priority) {
    const normalized = String(priority || "none").trim().toLowerCase();
    if (normalized.includes("critical")) {
        return "priority-critical";
    }
    if (normalized.includes("high")) {
        return "priority-high";
    }
    if (normalized.includes("medium")) {
        return "priority-medium";
    }
    if (normalized.includes("low")) {
        return "priority-low";
    }
    return "priority-none";
}

function getDueMeta(dueDate) {
    const date = parseLocalDate(dueDate);
    if (!date) {
        return { label: "No due date", className: "due-none" };
    }
    const today = startOfDay(new Date());
    const weekEnd = addDays(startOfWeek(today), 6);
    if (date < today) {
        return { label: "Overdue", className: "due-overdue" };
    }
    if (date <= weekEnd) {
        return { label: "Due this week", className: "due-this-week" };
    }
    return { label: "Not due this week", className: "due-later" };
}

function formatEstimateVsSpent(ticket) {
    const spent = Number.isFinite(ticket.spentHours) ? formatHours(ticket.spentHours) : "0h";
    const estimated = Number.isFinite(ticket.estimatedHours) ? formatHours(ticket.estimatedHours) : "No estimate";
    return `${spent} / ${estimated}`;
}

function estimateProgress(ticket) {
    if (!Number.isFinite(ticket.estimatedHours) || ticket.estimatedHours <= 0) {
        return 0;
    }
    const spent = Number.isFinite(ticket.spentHours) ? ticket.spentHours : 0;
    return Math.min(100, Math.round((spent / ticket.estimatedHours) * 100));
}

function isEstimateOverrun(ticket) {
    return Number.isFinite(ticket.estimatedHours)
        && ticket.estimatedHours > 0
        && Number.isFinite(ticket.spentHours)
        && ticket.spentHours > ticket.estimatedHours;
}

function renderMemberCard(summary) {
    const card = document.createElement("article");
    card.className = `member-card ${summary.stale ? "is-stale" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open details for ${summary.member.name}`);
    card.addEventListener("click", () => openDetailView(summary.member.id));
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetailView(summary.member.id);
        }
    });

    const statusMeta = STATUS_META[summary.status] || STATUS_META["no-data"];
    card.innerHTML = `
        <div class="card-top">
            <div>
                <h2 class="member-name">${escapeHtml(summary.member.name)}</h2>
                <div class="period-label">${escapeHtml(summary.period.label)}</div>
            </div>
            <span class="status-badge status-${summary.status}">${statusMeta.label}</span>
        </div>
        <div class="card-body">
            <div class="metric-row">
                <div class="metric-box">
                    <span class="meta-label">Total spent</span>
                    <span class="metric-value">${formatHours(summary.totalSpentHours)}</span>
                </div>
                <div class="metric-box estimate-state-${summary.remainingEstimate.state}">
                    <span class="meta-label">Remaining</span>
                    <span class="metric-value">${escapeHtml(summary.remainingEstimate.label)}</span>
                </div>
            </div>
            <div class="activity-list">
                ${renderActivityRows(summary)}
            </div>
            ${summary.hiddenActivityCount > 0 ? `<div class="more-rows">+${summary.hiddenActivityCount} more in detail</div>` : ""}
            ${renderWarnings(summary)}
        </div>
    `;

    return card;
}

function renderActivityRows(summary) {
    if (summary.visibleActivityRows.length === 0) {
        return `<div class="activity-row empty-row">No activity in period</div>`;
    }

    return summary.visibleActivityRows.map((row) => `
        <div class="activity-row">
            <div class="activity-main">
                <span class="activity-title">${escapeHtml(row.issueId ? `#${row.issueId} ${row.summary}` : row.summary)}</span>
                <span class="activity-sub">${escapeHtml(row.projectName)} · ${escapeHtml(row.activityName || "Redmine time entry")}</span>
            </div>
            <div class="activity-hours">${formatHours(row.spentHours)}</div>
        </div>
    `).join("");
}

function renderWarnings(summary) {
    const warnings = [...summary.warnings];
    if (summary.stale) {
        warnings.unshift("Stale data");
    }
    if (summary.remainingEstimate.state === "partial") {
        warnings.push(summary.remainingEstimate.basis);
    }
    if (summary.remainingEstimate.state === "unknown" && summary.activityRows.length > 0) {
        warnings.push("Remaining estimate unknown");
    }
    if (warnings.length === 0) {
        return "";
    }
    return `<div class="warning-list">${warnings
        .map((warning) => `<span class="warning-badge">${escapeHtml(warning)}</span>`)
        .join("")}</div>`;
}

function openDetailView(memberId) {
    state.detailMemberId = memberId;
    renderDetailView();
    els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeDetailView() {
    state.detailMemberId = null;
    renderDetailView();
}

function renderDetailView() {
    const summary = state.summaries.find((item) => item.member.id === state.detailMemberId);
    if (!summary) {
        els.detailPanel.classList.add("is-hidden");
        return;
    }

    els.detailPanel.classList.remove("is-hidden");
    els.detailTitle.textContent = `${summary.member.name} details`;
    els.detailPeriod.textContent = summary.period.label;
    els.detailSummary.innerHTML = `
        <div class="metric-box"><span class="meta-label">Total spent</span><span class="metric-value">${formatHours(summary.totalSpentHours)}</span></div>
        <div class="metric-box estimate-state-${summary.remainingEstimate.state}"><span class="meta-label">Remaining</span><span class="metric-value">${escapeHtml(summary.remainingEstimate.label)}</span></div>
        <div class="metric-box"><span class="meta-label">Rows</span><span class="metric-value">${summary.activityRows.length}</span></div>
    `;
    els.detailRows.innerHTML = summary.activityRows.length
        ? summary.activityRows.map(renderDetailRow).join("")
        : `<div class="detail-row">No activity in selected period.</div>`;
}

function renderDetailRow(row) {
    return `
        <div class="detail-row">
            <div>
                <strong>${escapeHtml(row.issueId ? `#${row.issueId} ${row.summary}` : row.summary)}</strong>
                <div class="activity-sub">${escapeHtml(row.projectName)} · ${escapeHtml(row.activityName || "Redmine time entry")} · ${row.entryCount} entr${row.entryCount === 1 ? "y" : "ies"}</div>
                ${row.warnings.length ? `<div class="warning-list">${row.warnings.map((warning) => `<span class="warning-badge">${escapeHtml(warning)}</span>`).join("")}</div>` : ""}
            </div>
            <div class="detail-metrics">
                <span>${formatHours(row.spentHours)} spent</span>
                <span>${Number.isFinite(row.estimatedHours) ? `${formatHours(row.estimatedHours)} est.` : "Estimate unknown"}</span>
                <span>${Number.isFinite(row.remainingHours) ? `${formatHours(row.remainingHours)} remaining` : "Remaining unknown"}</span>
            </div>
        </div>
    `;
}

async function openPlannerEditor(task) {
    if (!state.planner.projectsLoadedFromRedmine) {
        await loadPlannerProjects();
    }
    state.planner.editorTask = task ? { ...task } : null;
    state.planner.linkedTicket = task?.redmineLinked ? task : null;
    els.plannerTaskEyebrow.textContent = task ? `Edit task · ${task.teamId}` : "New task";
    els.plannerTaskTitle.textContent = task ? "Edit high-level task" : "Add high-level task";
    els.savePlannerTaskButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>${task ? " Save changes" : " Create task"}`;
    els.deletePlannerTaskButton.classList.toggle("is-hidden", !task);
    fillPlannerEditorOptions(task);
    els.plannerTaskTitleInput.value = task?.title || "";
    els.plannerTaskDescription.value = task?.description || "";
    els.plannerTaskTeam.value = task?.teamId || state.planner.filters.teamId || state.auth.user?.teamId || state.planner.teams[0]?.id || "";
    setPlannerProjectValue(task?.projectId || state.planner.projects[0]?.id || "");
    setPlannerChoiceValue("category", task?.categoryId || "dev");
    setPlannerChoiceValue("priority", task?.priorityId || "medium");
    els.plannerTaskStatus.value = task?.statusId || "working";
    els.plannerTaskProgress.value = task?.progress || 0;
    els.plannerTaskStart.value = task?.startDate || formatLocalDate(new Date());
    els.plannerTaskDue.value = task?.dueDate || "";
    els.plannerTaskRedmineSearch.value = task?.issueKey || task?.redmineIssueId || "";
    renderPlannerSyncedPanel();
    renderPlannerMemberPicker(task?.memberIds || []);
    els.plannerTaskError.classList.add("is-hidden");
    els.plannerTaskModal.classList.remove("is-hidden");
    await loadPlannerTicketOptions();
}

function closePlannerEditor() {
    state.planner.editorTask = null;
    state.planner.linkedTicket = null;
    els.plannerTaskModal.classList.add("is-hidden");
}

function fillPlannerEditorOptions(task) {
    const canPickTeam = ["manager", "admin"].includes(state.auth.user?.role);
    els.plannerTaskTeam.disabled = !canPickTeam;
    const teamWrap = document.getElementById("teamFieldWrap");
    if (teamWrap) teamWrap.classList.toggle("is-hidden", !canPickTeam);
    els.plannerTaskTeam.innerHTML = state.planner.teams.map((team) => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join("");
    els.plannerProjectOptions.innerHTML = state.planner.projects.map((project) => `<option value="${escapeHtml(project.name)}">${escapeHtml(project.redmineIdentifier || project.source || "")}</option>`).join("");
    renderPlannerChoiceGroup("category");
    renderPlannerChoiceGroup("priority");
    els.plannerTaskStatus.innerHTML = state.planner.statuses.map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join("");
}

function renderPlannerChoiceGroup(kind) {
    const isPriority = kind === "priority";
    const items = isPriority ? state.planner.priorities : state.planner.categories;
    const container = isPriority ? els.plannerTaskPriorityChoices : els.plannerTaskCategoryChoices;
    const input = isPriority ? els.plannerTaskPriority : els.plannerTaskCategory;
    container.innerHTML = items.map((item) => {
        const dot = isPriority ? `<span class="priority-dot ${escapeHtml(item.colorClass || "")}"></span>` : "";
        return `
            <button class="planner-choice" type="button" role="radio" aria-checked="false" data-${kind}-choice="${escapeHtml(item.id)}">
                ${dot}${escapeHtml(item.label)}
            </button>
        `;
    }).join("");
    container.querySelectorAll(`[data-${kind}-choice]`).forEach((button) => {
        button.addEventListener("click", () => setPlannerChoiceValue(kind, button.dataset[`${kind}Choice`]));
    });
    setPlannerChoiceValue(kind, input.value || items[0]?.id || "");
}

function setPlannerChoiceValue(kind, value) {
    const isPriority = kind === "priority";
    const input = isPriority ? els.plannerTaskPriority : els.plannerTaskCategory;
    const container = isPriority ? els.plannerTaskPriorityChoices : els.plannerTaskCategoryChoices;
    input.value = value || "";
    container?.querySelectorAll(".planner-choice").forEach((button) => {
        const selected = button.dataset[`${kind}Choice`] === input.value;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-checked", selected ? "true" : "false");
    });
}

function setPlannerProjectValue(projectId) {
    const project = state.planner.projects.find((item) => Number(item.id) === Number(projectId)) || state.planner.projects[0];
    els.plannerTaskProject.value = project?.id || "";
    els.plannerTaskProjectSearch.value = project?.name || "";
}

function findPlannerProject(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) {
        return null;
    }
    return state.planner.projects.find((project) => String(project.name || "").trim().toLowerCase() === text)
        || state.planner.projects.find((project) => String(project.redmineIdentifier || "").trim().toLowerCase() === text)
        || state.planner.projects.find((project) => String(project.id) === text)
        || null;
}

function renderPlannerMemberPicker(selectedIds = []) {
    if (!Array.isArray(selectedIds)) {
        selectedIds = state.planner.editorTask?.memberIds || [];
    }
    const selected = new Set(selectedIds.map(Number));
    const teamId = els.plannerTaskTeam.value;
    const users = filteredPlannerUsersForTeam(teamId);
    const locked = Boolean(state.planner.linkedTicket || state.planner.editorTask?.redmineLinked);
    const ids = locked && state.planner.linkedTicket?.memberIds?.length
        ? state.planner.linkedTicket.memberIds
        : selectedIds;
    els.plannerTaskMembers.classList.toggle("is-locked", locked);
    els.plannerTaskMembers.innerHTML = locked
        ? (ids || []).map((id) => {
            const user = state.planner.users.find((item) => Number(item.id) === Number(id));
            return user ? `<div class="member-picker-row"><span class="mini-avatar ${escapeHtml(user.avatarColor || "")}">${escapeHtml(user.initials || initialsFromName(user.name))}</span>${escapeHtml(user.name)}<small>Synced from Redmine</small></div>` : "";
        }).join("") || `<div class="empty-mini">No assignees on this Redmine ticket.</div>`
        : users.map((user) => `
            <label class="member-picker-row">
                <input type="checkbox" value="${user.id}" ${selected.has(Number(user.id)) ? "checked" : ""}>
                <span class="mini-avatar ${escapeHtml(user.avatarColor || "")}">${escapeHtml(user.initials || initialsFromName(user.name))}</span>
                <span class="member-picker-name">${escapeHtml(user.name)}</span>
                <span class="member-team-badge">${escapeHtml((user.teamIds || [user.teamId]).filter(Boolean).join(", ").toUpperCase())}</span>
            </label>
        `).join("") || `<div class="empty-mini">No members in this team.</div>`;
}

function renderPlannerSyncedPanel() {
    const ticket = state.planner.linkedTicket;
    const synced = !!ticket;

    els.plannerSyncedPanel.classList.toggle("is-hidden", !synced);
    document.querySelectorAll(".synced-hideable").forEach((el) => el.classList.toggle("is-hidden", synced));
    const membersBadge = document.getElementById("membersSyncedBadge");
    if (membersBadge) membersBadge.classList.toggle("is-hidden", !synced);

    if (!synced) return;

    const statusLabel = (state.planner.statuses.find((s) => s.id === (ticket.statusId || "working"))?.label) || ticket.statusId || "—";
    const startVal = ticket.startDate || "Not set";
    const dueVal = ticket.dueDate || "Not set";
    const progressVal = ticket.progress ?? els.plannerTaskProgress.value ?? 0;

    const syncedIcon = `<svg class="synced-icon" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Synced from Redmine`;

    els.plannerSyncedPanel.innerHTML = `
        <div class="synced-panel-head">
            <div>
                <strong class="synced-panel-title">SYNCED FIELDS</strong>
                <p class="synced-panel-desc">Status, progress, dates and assignees are kept in sync with <strong>${escapeHtml(ticket.issueKey || String(ticket.redmineIssueId))}</strong> and its sub-tickets by the backend. Update them in Redmine to change them here.</p>
            </div>
            <button type="button" class="synced-unlink-btn" id="unlinkPlannerTicketButton">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Unlink
            </button>
        </div>
        <div class="synced-fields-grid">
            <div class="synced-field-box">
                <div class="synced-field-label"><span>Status</span><span class="synced-badge">${syncedIcon}</span></div>
                <div class="synced-field-value">${escapeHtml(statusLabel)}</div>
            </div>
            <div class="synced-field-box">
                <div class="synced-field-label"><span>Progress</span><span class="synced-badge">${syncedIcon}</span></div>
                <div class="synced-field-value synced-progress-wrap">
                    <div class="synced-progress-bar"><i style="width:${progressVal}%"></i></div>
                    <span>${progressVal}%</span>
                </div>
            </div>
            <div class="synced-field-box">
                <div class="synced-field-label"><span>Start date</span><span class="synced-badge">${syncedIcon}</span></div>
                <div class="synced-field-value">${escapeHtml(startVal)}</div>
            </div>
            <div class="synced-field-box">
                <div class="synced-field-label"><span>Due date</span><span class="synced-badge">${syncedIcon}</span></div>
                <div class="synced-field-value">${escapeHtml(dueVal)}</div>
            </div>
        </div>
    `;
    els.plannerSyncedPanel.querySelector("#unlinkPlannerTicketButton").addEventListener("click", () => {
        state.planner.linkedTicket = null;
        els.plannerTaskRedmineSearch.value = "";
        renderPlannerSyncedPanel();
        renderPlannerMemberPicker(state.planner.editorTask?.memberIds || []);
    });
}

async function handlePlannerProjectChange() {
    state.planner.linkedTicket = null;
    els.plannerTaskRedmineSearch.value = "";
    renderPlannerSyncedPanel();
    await loadPlannerTicketOptions();
}

async function handlePlannerProjectSearch() {
    const project = findPlannerProject(els.plannerTaskProjectSearch.value);
    els.plannerTaskProject.value = project?.id || "";
    if (project) {
        await handlePlannerProjectChange();
    }
}

async function loadPlannerTicketOptions() {
    const query = els.plannerTaskRedmineSearch.value.trim();
    const projectId = els.plannerTaskProject.value;
    if (!projectId && !query) {
        return;
    }
    try {
        const payload = await apiJson(`/api/redmine/recent-tickets?projectId=${encodeURIComponent(projectId)}&q=${encodeURIComponent(query)}`);
        els.plannerTicketOptions.innerHTML = (payload.tickets || []).map((ticket) => `<option value="${escapeHtml(ticket.issueKey || ticket.redmineIssueId)}">${escapeHtml(ticket.title)}</option>`).join("");
        const exact = (payload.tickets || []).find((ticket) => String(ticket.issueKey) === query || String(ticket.redmineIssueId) === query || query.includes(`/issues/${ticket.redmineIssueId}`));
        if (exact) {
            applyPlannerLinkedTicket(exact);
        }
    } catch {
        els.plannerTicketOptions.innerHTML = "";
    }
}

function applyPlannerLinkedTicket(ticket) {
    state.planner.linkedTicket = {
        ...ticket,
        memberIds: ticket.assigneeIds || []
    };
    els.plannerTaskStatus.value = ticket.statusId || "working";
    setPlannerChoiceValue("priority", ticket.priorityId || els.plannerTaskPriority.value);
    els.plannerTaskProgress.value = ticket.progress || 0;
    els.plannerTaskStart.value = ticket.startDate || "";
    els.plannerTaskDue.value = ticket.dueDate || "";
    renderPlannerSyncedPanel();
    renderPlannerMemberPicker(ticket.assigneeIds || []);
}

function clampPlannerProgressInput() {
    const raw = els.plannerTaskProgress.value;
    if (raw === "") {
        return;
    }
    const clamped = clampProgress(raw);
    if (String(clamped) !== raw) {
        els.plannerTaskProgress.value = clamped;
    }
}

function clampProgress(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(numeric)));
}

async function savePlannerTask(event) {
    event.preventDefault();
    const selectedProject = findPlannerProject(els.plannerTaskProjectSearch.value);
    if (selectedProject) {
        els.plannerTaskProject.value = selectedProject.id;
    }
    if (!els.plannerTaskProject.value) {
        els.plannerTaskError.textContent = "Select a Redmine project from the project list.";
        els.plannerTaskError.classList.remove("is-hidden");
        return;
    }
    clampPlannerProgressInput();
    const memberIds = [...els.plannerTaskMembers.querySelectorAll("input[type='checkbox']:checked")].map((input) => Number(input.value));
    const body = {
        teamId: els.plannerTaskTeam.value,
        projectId: Number(els.plannerTaskProject.value),
        categoryId: els.plannerTaskCategory.value,
        priorityId: els.plannerTaskPriority.value,
        statusId: els.plannerTaskStatus.value,
        title: els.plannerTaskTitleInput.value,
        description: els.plannerTaskDescription.value,
        progress: clampProgress(els.plannerTaskProgress.value),
        startDate: els.plannerTaskStart.value,
        dueDate: els.plannerTaskDue.value,
        memberIds
    };
    const task = state.planner.editorTask;
    try {
        const saved = await apiJson(task ? `/api/tasks/${task.id}` : "/api/tasks", {
            method: task ? "PATCH" : "POST",
            body
        });
        const linkValue = els.plannerTaskRedmineSearch.value.trim();
        if (linkValue && (!task?.redmineLinked || linkValue !== task.issueKey)) {
            await apiJson(`/api/tasks/${saved.task.id}/link`, { method: "POST", body: { value: linkValue } });
        }
        closePlannerEditor();
        await refreshPlanner();
    } catch (error) {
        els.plannerTaskError.textContent = error.message || "Unable to save task.";
        els.plannerTaskError.classList.remove("is-hidden");
    }
}

async function deletePlannerTask() {
    const task = state.planner.editorTask;
    if (!task || !window.confirm("Delete this high-level task?")) {
        return;
    }
    await apiJson(`/api/tasks/${task.id}`, { method: "DELETE" });
    closePlannerEditor();
    await refreshPlanner();
}

function countStatuses(summaries) {
    return summaries.reduce((counts, summary) => {
        counts[summary.status] = (counts[summary.status] || 0) + 1;
        return counts;
    }, {});
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return startOfDay(next);
}

function startOfDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function startOfWeek(date) {
    const next = startOfDay(date);
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(next, diff);
}

function startOfMonth(date) {
    const next = startOfDay(date);
    next.setDate(1);
    return next;
}

function parseLocalDate(value) {
    if (!value) {
        return null;
    }
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
        return null;
    }
    return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date) {
    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function formatTime(value) {
    const date = value instanceof Date ? value : parseDate(value);
    if (!date) {
        return "No activity";
    }
    return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function formatHours(hours) {
    return `${roundHours(hours)}h`;
}

function roundHours(hours) {
    return Math.round(Number(hours || 0) * 100) / 100;
}

function minutesSince(value) {
    const date = parseDate(value);
    if (!date) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function timestampValue(value) {
    const date = parseDate(value);
    return date ? date.getTime() : 0;
}

function parseDate(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

init();
