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
    view: "work-overview",
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
    board: document.getElementById("teamBoard"),
    workBoard: document.getElementById("workBoard"),
    emptyState: document.getElementById("emptyState"),
    notice: document.getElementById("globalNotice"),
    refreshButton: document.getElementById("refreshButton"),
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
    countAttention: document.getElementById("countAttention")
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

    await loadRedmineUsersForWorkOverview();
    await loadPublicProxyConfig();
    await loadWorkPhraseConfig();
    await loadTeamConfigFromFile();

    if (state.members.length === 0 && state.users.length === 0) {
        setRefreshState("empty", "No selected team members are configured.");
        render();
        return;
    }

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
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            state.statusFilter = button.dataset.statusFilter;
            render();
        });
    });
}

function handleViewChange() {
    state.view = els.viewSelect.value;
    closeDetailView();
    closeSettings();
    render();
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
        const response = await fetch(url, { signal: controller.signal });
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
    if (state.view === "work-overview") {
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
    els.periodPanel.classList.toggle("is-hidden", isWork);
    els.workControls.classList.toggle("is-hidden", !isWork);
    els.settingsButton.classList.toggle("is-hidden", !isWork);
    els.timeSummaryStrip.classList.toggle("is-hidden", isWork);
    els.workSummaryStrip.classList.toggle("is-hidden", !isWork);
    els.board.classList.toggle("is-hidden", isWork);
    els.workBoard.classList.toggle("is-hidden", !isWork);
    els.settingsPanel.classList.toggle("is-hidden", !isWork || !state.settingsOpen);
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
