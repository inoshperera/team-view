import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/work-overview-copy";
const outputPath = `${outputDir}/work_overview_phrase_matrix.xlsx`;
const jsonOutputPath = "data/work-overview-phrases.json";

const trackers = [
    "Bug",
    "New Feature",
    "Blocker",
    "Documentation",
    "Improvement",
    "Reports",
    "None",
    "Task",
    "QA Automation",
    "Feature Request",
    "Patch",
    "Training",
];

const statuses = [
    "Development Ready",
    "Design",
    "Implementation",
    "Review",
    "Testing",
    "Testing Ready",
    "In Progress",
];

const trackerActions = {
    "Bug": {
        ready: "Queued to fix a bug",
        design: "Designing the fix for a bug",
        implementation: "Fixing a bug",
        review: "Reviewing a bug fix",
        testing: "Testing a bug fix",
        testingReady: "Bug fix queued for testing",
        inProgress: "Working on a bug fix",
    },
    "New Feature": {
        ready: "Queued to build a new feature",
        design: "Designing a new feature",
        implementation: "Building a new feature",
        review: "Reviewing a new feature",
        testing: "Testing a new feature",
        testingReady: "New feature queued for testing",
        inProgress: "Working on a new feature",
    },
    "Blocker": {
        ready: "Queued to resolve a blocking issue",
        design: "Planning a solution for a blocking issue",
        implementation: "Resolving a blocking issue",
        review: "Reviewing a blocking issue fix",
        testing: "Testing the fix for a blocking issue",
        testingReady: "Blocking issue fix queued for testing",
        inProgress: "Working on a blocking issue",
    },
    "Documentation": {
        ready: "Queued to update documentation",
        design: "Structuring documentation",
        implementation: "Updating documentation",
        review: "Reviewing documentation",
        testing: "Validating documentation",
        testingReady: "Documentation update queued for validation",
        inProgress: "Working on documentation",
    },
    "Improvement": {
        ready: "Queued to improve existing functionality",
        design: "Designing an improvement",
        implementation: "Implementing an improvement",
        review: "Reviewing an improvement",
        testing: "Testing an improvement",
        testingReady: "Improvement queued for testing",
        inProgress: "Working on an improvement",
    },
    "Reports": {
        ready: "Queued to update reporting",
        design: "Designing reporting changes",
        implementation: "Updating reports",
        review: "Reviewing reporting changes",
        testing: "Testing reporting changes",
        testingReady: "Reporting changes queued for testing",
        inProgress: "Working on reports",
    },
    "None": {
        ready: "Queued to work on a task",
        design: "Planning a task",
        implementation: "Working on a task",
        review: "Reviewing a task",
        testing: "Testing a task",
        testingReady: "Task queued for testing",
        inProgress: "Working on a task",
    },
    "Task": {
        ready: "Queued to work on a task",
        design: "Planning a task",
        implementation: "Working on a task",
        review: "Reviewing a task",
        testing: "Testing a task",
        testingReady: "Task queued for testing",
        inProgress: "Working on a task",
    },
    "QA Automation": {
        ready: "Queued to automate QA coverage",
        design: "Designing QA automation",
        implementation: "Building QA automation",
        review: "Reviewing QA automation",
        testing: "Validating QA automation",
        testingReady: "QA automation queued for validation",
        inProgress: "Working on QA automation",
    },
    "Feature Request": {
        ready: "Queued to build a requested feature",
        design: "Designing a requested feature",
        implementation: "Building a requested feature",
        review: "Reviewing a requested feature",
        testing: "Testing a requested feature",
        testingReady: "Requested feature queued for testing",
        inProgress: "Working on a requested feature",
    },
    "Patch": {
        ready: "Queued to prepare a patch",
        design: "Planning a patch",
        implementation: "Preparing a patch",
        review: "Reviewing a patch",
        testing: "Testing a patch",
        testingReady: "Patch queued for testing",
        inProgress: "Working on a patch",
    },
    "Training": {
        ready: "Queued to prepare training material",
        design: "Designing training material",
        implementation: "Preparing training material",
        review: "Reviewing training material",
        testing: "Validating training material",
        testingReady: "Training material queued for validation",
        inProgress: "Working on training material",
    },
};

const statusActionKey = {
    "Development Ready": "ready",
    "Design": "design",
    "Implementation": "implementation",
    "Review": "review",
    "Testing": "testing",
    "Testing Ready": "testingReady",
    "In Progress": "inProgress",
};

function phraseFor(status, tracker) {
    const actionKey = statusActionKey[status];
    return `${trackerActions[tracker][actionKey]} in project {project}`;
}

const rows = [];
const phraseMap = {};
for (const status of statuses) {
    phraseMap[status] = {};
    for (const tracker of trackers) {
        const phrase = phraseFor(status, tracker);
        phraseMap[status][tracker] = phrase;
        rows.push([
            tracker,
            status,
            "{project}",
            phrase,
            status === "Development Ready" || status === "Testing Ready"
                ? "Pipeline assignment; not active hands-on work yet."
                : "Compact tile phrase.",
        ]);
    }
}

const workbook = Workbook.create();
const matrix = workbook.worksheets.add("Phrase Matrix");
const notes = workbook.worksheets.add("Rules");

matrix.getRange("A1:E1").values = [["Tracker", "Status", "Project token", "Compact phrase", "Notes"]];
matrix.getRange(`A2:E${rows.length + 1}`).values = rows;

notes.getRange("A1:B1").values = [["Topic", "Rule"]];
notes.getRange("A2:B8").values = [
    ["Purpose", "Use the compact phrase above the ticket title when Show detailed ticket is unticked."],
    ["Project token", "Replace {project} with the Redmine project name."],
    ["Issue number", "Keep ticket number hidden until hover/focus as an issue link."],
    ["Removed fields", "Tracker, status, and project can be removed from compact tiles because the phrase includes them."],
    ["Development Ready", "Means assigned in the pipeline to develop; use queued language."],
    ["Testing Ready", "Means assigned in the pipeline to test; use queued language."],
    ["Excluded statuses", "New, Closed, On hold, Staged, and Testing Rejected should not appear as working tickets."],
];

for (const sheet of [matrix, notes]) {
    sheet.getRange("A1:E1").format = {
        font: { bold: true, color: "#ffffff" },
        fill: { color: "#1f2937" },
    };
}

matrix.getRange("A:E").columnWidthPx = 180;
matrix.getRange("D:D").columnWidthPx = 440;
matrix.getRange("E:E").columnWidthPx = 280;
notes.getRange("A:A").columnWidthPx = 180;
notes.getRange("B:B").columnWidthPx = 520;

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir("data", { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
await fs.writeFile(jsonOutputPath, `${JSON.stringify({
    projectToken: "{project}",
    excludedStatuses: ["New", "Closed", "On hold", "Staged", "Testing Rejected"],
    phrases: phraseMap,
}, null, 4)}\n`);
console.log(outputPath);
console.log(jsonOutputPath);
