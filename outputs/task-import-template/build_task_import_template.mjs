import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/inosh/repos/codex/team-highlevel-view/outputs/task-import-template";
const outputPath = path.join(outputDir, "high-level-task-import-template.xlsx");

const workbook = Workbook.create();
const tasks = workbook.worksheets.add("Tasks");
const lists = workbook.worksheets.add("Dropdown Lists");
const instructions = workbook.worksheets.add("Instructions");

const maxRows = 201;

tasks.showGridLines = false;
lists.showGridLines = false;
instructions.showGridLines = false;

const headers = [
  "Task ID",
  "Team",
  "Title",
  "Category",
  "Priority",
  "Project",
  "Redmine Ticket",
  "Status",
  "Progress %",
  "Start Date",
  "Due Date",
  "Assigned Member 1",
  "Assigned Member 2",
  "Assigned Member 3",
  "Assigned Member 4",
  "Assigned Member 5",
  "Depends On Task ID 1",
  "Depends On Task ID 2",
  "Depends On Task ID 3",
  "Description / Acceptance Notes",
  "Upload Notes",
];

const exampleRows = [
  [
    "TASK-001",
    "Engineering",
    "Customer escalation - ACME UEM agent rollout",
    "Customer",
    "Medium",
    "UEM",
    "12345",
    "New",
    0,
    new Date("2026-07-13T00:00:00"),
    null,
    "Inosh Perara",
    "Charitha Goonetilleke",
    null,
    null,
    null,
    null,
    null,
    null,
    "Capture rollout plan, risks, and acceptance criteria.",
    "Example row. Replace or delete before upload.",
  ],
  [
    "TASK-002",
    "Engineering",
    "Prepare rollout validation checklist",
    "Development",
    "High",
    "UEM",
    null,
    "New",
    0,
    new Date("2026-07-13T00:00:00"),
    null,
    "Kumudu Harshani",
    null,
    null,
    null,
    null,
    "TASK-001",
    null,
    null,
    "Depends on the escalation parent task.",
    "Example dependency.",
  ],
];

tasks.getRange("A1:U1").values = [headers];
tasks.getRange("A2:U3").values = exampleRows;
tasks.getRange("A4:U201").values = Array.from({ length: 198 }, () => Array(headers.length).fill(null));

const listData = [
  ["Teams", "Categories", "Priorities", "Statuses", "Members"],
  ["Engineering", "Development", "Critical", "New", "Charitha Goonetilleke"],
  ["UEM", "Customer", "High", "In progress", "Inosh Perara"],
  ["GC", "Operations", "Medium", "Blocked", "Kumudu Harshani"],
  ["Support", "HR", "Low", "Done", ""],
  ["Operations", "", "None", "Canceled", ""],
];
lists.getRange("A1:E6").values = listData;

instructions.getRange("A1").values = [["High-Level Task Import Template"]];
instructions.getRange("A3").values = [["How to use this file"]];
instructions.getRange("A4:A11").values = [
  ["1. Fill one task per row in the Tasks sheet."],
  ["2. Keep Task ID unique. Use it as the temporary ID for dependencies before Redmine tickets exist."],
  ["3. Use dropdowns wherever available. Edit Dropdown Lists if teams, members, or statuses change."],
  ["4. Use Depends On Task ID 1-3 to link a task to another local Task ID in this workbook."],
  ["5. For multiple assignees, use Assigned Member 1-5 instead of typing several names into one cell."],
  ["6. Due Date can be blank when Status is New. For other statuses, add a due date before upload."],
  ["7. Redmine Ticket can be an issue ID or a full Redmine issue link when the task already exists."],
  ["8. Leave Upload Notes for reviewer/import-script comments; it should not become ticket content unless desired."],
];
instructions.getRange("A13").values = [["Suggested required fields for upload: Task ID, Team, Title, Category, Priority, Status, Start Date, and at least one Assigned Member."]];

const headerStyle = {
  fill: { color: "#1F4E79" },
  font: { color: "#FFFFFF", bold: true },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
const lightBorder = { preset: "all", style: "thin", color: "#D9E2EF" };

tasks.getRange("A1:U1").format = headerStyle;
tasks.getRange("A1:U201").format.borders = lightBorder;
tasks.getRange("A2:U201").format.fill = { color: "#FFFFFF" };
tasks.getRange("A2:U201").format.verticalAlignment = "top";
tasks.getRange("A2:U201").format.wrapText = true;
tasks.getRange("I2:I201").setNumberFormat("0");
tasks.getRange("J2:K201").setNumberFormat("yyyy-mm-dd");
tasks.getRange("A1:U201").format.font = { name: "Aptos", size: 10 };
tasks.getRange("A1:U1").format.font = { name: "Aptos", size: 10, bold: true, color: "#FFFFFF" };

const widths = [
  13, 16, 42, 16, 14, 20, 22, 16, 12, 14, 14,
  22, 22, 22, 22, 22, 20, 20, 20, 48, 32,
];
for (let i = 0; i < widths.length; i += 1) {
  tasks.getRangeByIndexes(0, i, maxRows, 1).format.columnWidth = widths[i];
}
tasks.getRange("A1:U1").format.rowHeight = 34;
tasks.getRange("A2:U201").format.rowHeight = 42;
tasks.freezePanes.freezeRows(1);

const validations = [
  ["B2:B201", "='Dropdown Lists'!$A$2:$A$50"],
  ["D2:D201", "='Dropdown Lists'!$B$2:$B$50"],
  ["E2:E201", "='Dropdown Lists'!$C$2:$C$50"],
  ["H2:H201", "='Dropdown Lists'!$D$2:$D$50"],
  ["L2:P201", "='Dropdown Lists'!$E$2:$E$100"],
  ["Q2:S201", "=$A$2:$A$201"],
];
for (const [range, formula1] of validations) {
  tasks.getRange(range).dataValidation = {
    rule: { type: "list", formula1 },
    prompt: { showPrompt: true, title: "Select a value", message: "Choose from the dropdown list." },
    errorAlert: { showAlert: true, style: "warning", title: "Check value", message: "Use a dropdown value where possible." },
  };
}
tasks.getRange("I2:I201").dataValidation = {
  rule: { type: "whole", operator: "between", formula1: 0, formula2: 100 },
  prompt: { showPrompt: true, title: "Progress %", message: "Enter a whole number from 0 to 100." },
  errorAlert: { showAlert: true, style: "stop", title: "Invalid progress", message: "Progress must be between 0 and 100." },
};
tasks.getRange("J2:K201").dataValidation = {
  rule: { type: "date", operator: "greaterThanOrEqual", formula1: "DATE(2000,1,1)" },
  prompt: { showPrompt: true, title: "Date", message: "Use yyyy-mm-dd format." },
  errorAlert: { showAlert: true, style: "warning", title: "Check date", message: "Use a valid date." },
};

tasks.getRange("A2:A201").conditionalFormats.add("containsBlanks", {
  format: { fill: { color: "#FFF2CC" } },
});
tasks.getRange("C2:C201").conditionalFormats.add("containsBlanks", {
  format: { fill: { color: "#FFF2CC" } },
});
tasks.getRange("K2:K201").conditionalFormats.addCustom('=AND($H2<>"",$H2<>"New",$K2="")', {
  fill: { color: "#FCE4D6" },
  font: { color: "#9C0006" },
});

lists.getRange("A1:E100").format.borders = lightBorder;
lists.getRange("A1:E100").format.font = { name: "Aptos", size: 10 };
for (let i = 0; i < 5; i += 1) {
  lists.getRangeByIndexes(0, i, 100, 1).format.columnWidth = 24;
}
lists.getRange("A1:E1").format.fill = { color: "#D9EAF7" };
lists.getRange("A1:E1").format.font = { name: "Aptos", size: 10, bold: true, color: "#1F2937" };
lists.freezePanes.freezeRows(1);

instructions.getRange("A1").format.fill = { color: "#D9EAF7" };
instructions.getRange("A1").format.font = { name: "Aptos", size: 16, bold: true, color: "#1F2937" };
instructions.getRange("A3").format.fill = { color: "#EAF2F8" };
instructions.getRange("A3").format.font = { name: "Aptos", size: 12, bold: true, color: "#1F2937" };
instructions.getRange("A4:A13").format.font = { name: "Aptos", size: 10, color: "#1F2937" };
instructions.getRange("A4:A13").format.wrapText = true;
instructions.getRange("A1:A13").format.borders = { preset: "outside", style: "thin", color: "#B7C9DC" };
instructions.getRangeByIndexes(0, 0, 20, 1).format.columnWidth = 105;
for (let i = 1; i < 6; i += 1) {
  instructions.getRangeByIndexes(0, i, 20, 1).format.columnWidth = 10;
}
instructions.getRange("A4:A13").format.rowHeight = 24;

const table = tasks.tables.add("A1:U201", true, "TaskImportTable");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

const inspectTasks = await workbook.inspect({
  kind: "table",
  range: "Tasks!A1:U5",
  include: "values,formulas",
  tableMaxRows: 5,
  tableMaxCols: 21,
  maxChars: 5000,
});
console.log(inspectTasks.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 4000,
});
console.log(errors.ndjson);

const renderChecks = [
  ["Tasks", "A1:U20", "task-template-preview.png"],
  ["Dropdown Lists", "A1:E12", "dropdown-lists-preview.png"],
  ["Instructions", "A1:F14", "instructions-preview.png"],
];
for (const [sheetName, range, fileName] of renderChecks) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
