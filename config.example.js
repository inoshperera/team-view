window.TEAM_ACTIVITY_CONFIG = {
    proxyUrl: "http://localhost:9000",
    activeWindowMinutes: 90,
    recentWindowMinutes: 240,
    longEntryHours: 8,
    requestTimeoutMs: 60000,
    redmineMutationTimeoutMs: 900000,
    team: [
        { id: 14, name: "Arshana" },
        { id: 142, name: "Chathumini" },
        { id: 141, name: "Himesh" },
        { id: 11, name: "Kavin" },
        { id: 20, name: "Navod" }
    ],
    teams: [
        { id: "organization", name: "Organization", parentTeamId: "", memberIds: [] },
        { id: "core-team", name: "Core Team", parentTeamId: "organization", memberIds: [14, 142, 141, 11, 20] }
    ]
};
