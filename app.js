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
    teamDraft: {
        teams: [],
        errors: [],
        openTeamId: "",
        searchQueries: {},
        expandedMemberLists: {}
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
    refreshButton: document.getElementById("refreshButton"),
    logoutButton: document.getElementById("logoutButton"),
    addPlannerTaskButton: document.getElementById("addPlannerTaskButton"),
    plannerDrilldownButton: document.getElementById("plannerDrilldownButton"),
    plannerUserChip: document.getElementById("plannerUserChip"),
    settingsButton: document.getElementById("settingsButton"),
    freshnessLabel: document.getElementById("freshnessLabel"),
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
    saveTeamsButton: document.getElementById("saveTeamsButton"),
    newTeamName: document.getElementById("newTeamName"),
    addTeamButton: document.getElementById("addTeamButton"),
    teamSettingsList: document.getElementById("teamSettingsList"),
    teamConfigJson: document.getElementById("teamConfigJson"),
    settingsError: document.getElementById("settingsError"),
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
    renderTeamSettings();
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
    renderTeamSettings();
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
    els.logoutButton.addEventListener("click", handleLogout);
    els.addPlannerTaskButton.addEventListener("click", () => openPlannerEditor(null));
    els.plannerDrilldownButton.addEventListener("click", () => {
        state.view = "work-overview";
        els.viewSelect.value = "work-overview";
        state.work.mode = "team";
        state.work.teamId = state.planner.filters.teamId || state.auth.user?.teamId || state.teams[0]?.id || "";
        syncWorkControls();
        refreshWorkOverview();
        render();
    });
    els.refreshButton.addEventListener("click", refreshActiveView);
    els.viewSelect.addEventListener("change", handleViewChange);
    els.periodSelect.addEventListener("change", handlePeriodPresetChange);
    els.applyRangeButton.addEventListener("click", applyCustomRange);
    els.closeDetailButton.addEventListener("click", closeDetailView);
    els.settingsButton.addEventListener("click", openSettings);
    els.closeSettingsButton.addEventListener("click", closeSettings);
    els.saveTeamsButton.addEventListener("click", saveTeamConfigToFile);
    els.workScopeMode.addEventListener("change", handleWorkScopeModeChange);
    els.workTeamSelect.addEventListener("change", handleWorkTeamChange);
    els.workUserSearch.addEventListener("input", handleWorkUserSearch);
    els.showDetailedTickets.addEventListener("change", handleShowDetailedTicketsChange);
    els.addTeamButton.addEventListener("click", addDraftTeam);
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
    if (!state.planner.filters.teamId) {
        state.planner.filters.teamId = state.auth.user?.role === "lead"
            ? state.auth.user.teamId || state.planner.teams[0]?.id || ""
            : "";
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
    closeDetailView();
    closeSettings();
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
        ? `Work Overview · ${describeWorkScope()}`
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
        setRefreshState("failed", error.message || "Unable to load Work Overview.");
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
    state.settingsOpen = true;
    state.teamDraft = createTeamDraft(state.teams);
    renderTeamSettings();
    render();
    els.settingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeSettings() {
    state.settingsOpen = false;
    render();
}

function addDraftTeam() {
    const name = els.newTeamName.value.trim();
    if (!name) {
        state.teamDraft.errors = ["Enter a team name."];
        renderTeamSettings();
        return;
    }
    const id = slugify(name);
    state.teamDraft.teams.push({ id, name, memberIds: [] });
    state.teamDraft.openTeamId = id;
    els.newTeamName.value = "";
    validateTeamDraft();
    applyValidTeamDraft();
    renderTeamSettings();
    syncWorkControls();
}

function renderTeamSettings() {
    validateTeamDraft();
    els.teamSettingsList.innerHTML = state.teamDraft.teams.length
        ? state.teamDraft.teams.map(renderTeamSettingsItem).join("")
        : `<div class="empty-mini">No teams configured yet. Add a team to assign users.</div>${renderAllUsersPreview()}`;

    els.teamSettingsList.querySelectorAll("[data-team-search]").forEach((input) => {
        input.addEventListener("input", () => updateDraftTeamSearch(input.dataset.teamSearch, input.value));
    });
    els.teamSettingsList.querySelectorAll("[data-expand-team-members]").forEach((button) => {
        button.addEventListener("click", () => toggleDraftTeamMemberList(button.dataset.expandTeamMembers));
    });
    els.teamSettingsList.querySelectorAll("[data-team-name]").forEach((input) => {
        input.addEventListener("input", () => updateDraftTeamName(input.dataset.teamName, input.value));
        input.addEventListener("focus", () => openDraftTeam(input.dataset.teamName));
    });
    els.teamSettingsList.querySelectorAll("[data-open-team]").forEach((button) => {
        button.addEventListener("click", () => openDraftTeam(button.dataset.openTeam));
    });
    els.teamSettingsList.querySelectorAll("[data-remove-team]").forEach((button) => {
        button.addEventListener("click", () => removeDraftTeam(button.dataset.removeTeam));
    });
    els.teamSettingsList.querySelectorAll("[data-team-member]").forEach((input) => {
        input.addEventListener("change", () => toggleDraftTeamMember(input.dataset.teamMember, Number(input.value), input.checked));
    });

    els.teamConfigJson.value = JSON.stringify({ teams: state.teamDraft.teams }, null, 4);
    syncJsonTeamClicks();
    els.settingsError.textContent = state.teamDraft.errors.join(" ");
    els.settingsError.classList.toggle("is-hidden", state.teamDraft.errors.length === 0);
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

function syncJsonTeamClicks() {
    els.teamConfigJson.onclick = (event) => {
        const index = teamIndexFromTextareaClick(event);
        if (index < 0 || !state.teamDraft.teams[index]) {
            return;
        }
        state.teamDraft.openTeamId = state.teamDraft.teams[index].id;
        renderTeamSettings();
    };
}

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
    if (!validateTeamDraft()) {
        renderTeamSettings();
        return;
    }
    const payload = { teams: state.teamDraft.teams };
    els.saveTeamsButton.disabled = true;
    els.saveTeamsButton.textContent = "Saving";
    try {
        const saved = await postJson("/team-config.json", payload);
        state.teams = validateTeams(saved.teams || payload.teams, state.users);
        state.teamDraft = createTeamDraft(state.teams);
        syncWorkControls();
        renderTeamSettings();
        setSettingsMessage("Saved to team-config.local.json.");
        if (state.view === "work-overview") {
            await refreshWorkOverview();
        }
    } catch (error) {
        state.teamDraft.errors = [error.message || "Unable to save team config file."];
        renderTeamSettings();
    } finally {
        els.saveTeamsButton.disabled = false;
        els.saveTeamsButton.textContent = "Save teams";
    }
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

function setSettingsMessage(message) {
    state.teamDraft.errors = [];
    els.settingsError.textContent = message;
    els.settingsError.classList.remove("is-hidden");
}

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
    if (state.view === "planner") {
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
    els.viewSelect.value = state.view;
    const isWork = state.view === "work-overview";
    const isPlanner = state.view === "planner";
    els.periodPanel.classList.toggle("is-hidden", isWork || isPlanner);
    els.workControls.classList.toggle("is-hidden", !isWork);
    els.plannerControls.classList.toggle("is-hidden", !isPlanner);
    els.settingsButton.classList.toggle("is-hidden", !isWork);
    els.logoutButton.classList.toggle("is-hidden", !state.auth.user);
    els.addPlannerTaskButton.classList.toggle("is-hidden", !isPlanner);
    els.plannerDrilldownButton.classList.toggle("is-hidden", !isPlanner);
    els.plannerUserChip.classList.toggle("is-hidden", !state.auth.user);
    els.refreshButton.classList.toggle("is-hidden", false);
    els.timeSummaryStrip.classList.toggle("is-hidden", isWork || isPlanner);
    els.workSummaryStrip.classList.toggle("is-hidden", !isWork);
    els.plannerSummaryStrip.classList.toggle("is-hidden", !isPlanner);
    els.board.classList.toggle("is-hidden", isWork || isPlanner);
    els.workBoard.classList.toggle("is-hidden", !isWork);
    els.plannerBoard.classList.toggle("is-hidden", !isPlanner);
    els.settingsPanel.classList.toggle("is-hidden", !isWork || !state.settingsOpen);
    renderPlannerUserChip();
    if (isPlanner) {
        syncPlannerControls();
    }
    if (isWork) {
        syncWorkControls();
    }
}

function renderRefreshState() {
    els.refreshButton.disabled = state.refresh.state === "loading";
    els.refreshButton.innerHTML = state.refresh.state === "loading"
        ? `<span class="spinner spinner-button" aria-hidden="true"></span><span>Refreshing</span>`
        : "Refresh";
    renderStaticHeader();

    if (state.refresh.lastSuccessfulAt) {
        els.freshnessLabel.textContent = `Updated ${formatTime(state.refresh.lastSuccessfulAt)}`;
    } else if (state.refresh.state === "loading") {
        els.freshnessLabel.textContent = "Refreshing";
    } else {
        els.freshnessLabel.textContent = "Not loaded yet";
    }

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
    els.plannerUserChip.innerHTML = `
        <span class="planner-avatar">${escapeHtml(initialsText)}</span>
        <span class="planner-user-name">${escapeHtml(user.displayName || user.username)}</span>
        <span class="planner-user-role">${escapeHtml(user.role === "admin" ? "Admin" : user.role)}</span>
    `;
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
        ? state.planner.priorities
        : state.planner.categories;
}

function renderPlannerTaskCard(task) {
    const priority = lookup(state.planner.priorities, task.priorityId);
    const category = lookup(state.planner.categories, task.categoryId);
    const status = lookup(state.planner.statuses, task.statusId);
    const team = lookup(state.planner.teams, task.teamId);
    const due = dueLabel(task.dueDate);
    return `
        <article class="planner-task-card ${escapeHtml(priority?.colorClass || "")}">
            <div class="planner-task-head">
                <div class="planner-chip-row">
                    <span class="planner-chip ${escapeHtml(category?.colorClass || "")}">${escapeHtml(category?.label || task.categoryId)}</span>
                    ${team ? `<span class="planner-chip chip-team">${escapeHtml(team.name)}</span>` : ""}
                    ${task.redmineLinked ? `<span class="planner-chip chip-synced">Linked</span>` : ""}
                </div>
                <span class="status-badge status-active">${escapeHtml(status?.label || task.statusId)}</span>
            </div>
            <h2>${escapeHtml(task.title)}</h2>
            <p>${escapeHtml(task.description || "")}</p>
            <div class="planner-card-grid">
                <div><span>Project</span><strong>${escapeHtml(task.projectName || "Project")}</strong></div>
                <div><span>Priority</span><strong>${escapeHtml(priority?.label || task.priorityId)}</strong></div>
                <div><span>Due</span><strong class="${due.className}">${escapeHtml(task.dueDate || "Not set")}</strong><small>${escapeHtml(due.label)}</small></div>
                <div><span>Linked issue</span><strong>${task.issueKey ? escapeHtml(task.issueKey) : "Not linked"}</strong></div>
                <div><span>Progress</span><strong>${task.progress || 0}%</strong><small class="planner-progress"><i style="width:${task.progress || 0}%"></i></small></div>
            </div>
            <div class="planner-members">
                <span>Members (${task.members?.length || 0})</span>
                <div>${(task.members || []).map((member) => `<span class="member-pill"><span class="mini-avatar ${escapeHtml(member.avatarColor || "")}">${escapeHtml(member.initials || initialsFromName(member.name))}</span>${escapeHtml(member.name)}</span>`).join("") || `<span class="no-members">No members assigned</span>`}</div>
            </div>
            <button class="secondary-button planner-edit-button" type="button" data-planner-edit="${task.id}">Edit</button>
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
    els.savePlannerTaskButton.textContent = task ? "Save changes" : "Create task";
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
    els.plannerSyncedPanel.classList.toggle("is-hidden", !ticket);
    if (!ticket) {
        return;
    }
    els.plannerSyncedPanel.innerHTML = `
        <div class="synced-head">
            <div>
                <strong>Synced fields</strong>
                <p>Status, progress, dates and assignees are kept in sync with ${escapeHtml(ticket.issueKey || ticket.redmineIssueId)}.</p>
            </div>
            <button type="button" class="secondary-button" id="unlinkPlannerTicketButton">Unlink</button>
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
