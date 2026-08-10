import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/inosh/repos/codex/team-highlevel-view/outputs/age-name-sample";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Age and Name");
sheet.showGridLines = false;

sheet.getRange("A1:D1").merge();
sheet.getRange("A1").values = [["Age and Name Sample"]];
sheet.getRange("A1").format = {
  fill: "#1F4E79",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:D1").format.rowHeightPx = 34;

sheet.getRange("A3:D3").values = [["ID", "Name", "Age", "Age Group"]];
sheet.getRange("A4:D11").values = [
  [1, "Ava Johnson", 24, "Young Adult"],
  [2, "Noah Smith", 31, "Adult"],
  [3, "Mia Chen", 19, "Young Adult"],
  [4, "Liam Brown", 45, "Adult"],
  [5, "Sophia Davis", 28, "Young Adult"],
  [6, "Ethan Wilson", 52, "Adult"],
  [7, "Isabella Martinez", 36, "Adult"],
  [8, "Lucas Garcia", 22, "Young Adult"],
];

sheet.getRange("A3:D3").format = {
  fill: "#D9EAF7",
  font: { bold: true, color: "#17365D" },
  horizontalAlignment: "center",
};
sheet.getRange("A4:A11").format.horizontalAlignment = "center";
sheet.getRange("C4:C11").format.horizontalAlignment = "center";
sheet.getRange("A3:D11").format.borders = {
  insideHorizontal: { style: "continuous", color: "#B7C9D6" },
  insideVertical: { style: "continuous", color: "#B7C9D6" },
  edgeTop: { style: "continuous", color: "#7FA6C2" },
  edgeBottom: { style: "continuous", color: "#7FA6C2" },
  edgeLeft: { style: "continuous", color: "#7FA6C2" },
  edgeRight: { style: "continuous", color: "#7FA6C2" },
};
sheet.getRange("A4:D11").format = {
  fill: "#FFFFFF",
  font: { color: "#1F2937" },
};
sheet.getRange("A4:D11").conditionalFormats.add("expression", {
  formula: "=MOD(ROW(),2)=0",
  format: { fill: "#F6FAFD" },
});

sheet.tables.add("A3:D11", true, "AgeNameSample");

sheet.getRange("F3:G6").values = [
  ["Summary", ""],
  ["People", 8],
  ["Average Age", null],
  ["Young Adults", null],
];
sheet.getRange("G5").formulas = [["=AVERAGE(C4:C11)"]];
sheet.getRange("G6").formulas = [["=COUNTIF(D4:D11,\"Young Adult\")"]];
sheet.getRange("F3:G3").merge();
sheet.getRange("F3").format = {
  fill: "#2F6F6D",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
};
sheet.getRange("F4:F6").format = {
  fill: "#E7F3F1",
  font: { bold: true, color: "#244947" },
};
sheet.getRange("G4:G6").format = {
  fill: "#FFFFFF",
  horizontalAlignment: "center",
};
sheet.getRange("G5").format.numberFormat = "0.0";
sheet.getRange("F3:G6").format.borders = {
  insideHorizontal: { style: "continuous", color: "#B8D4D1" },
  insideVertical: { style: "continuous", color: "#B8D4D1" },
  edgeTop: { style: "continuous", color: "#6EAAA5" },
  edgeBottom: { style: "continuous", color: "#6EAAA5" },
  edgeLeft: { style: "continuous", color: "#6EAAA5" },
  edgeRight: { style: "continuous", color: "#6EAAA5" },
};

sheet.freezePanes.freezeRows(3);
sheet.getRange("A:A").format.columnWidthPx = 52;
sheet.getRange("B:B").format.columnWidthPx = 160;
sheet.getRange("C:C").format.columnWidthPx = 70;
sheet.getRange("D:D").format.columnWidthPx = 120;
sheet.getRange("E:E").format.columnWidthPx = 24;
sheet.getRange("F:F").format.columnWidthPx = 120;
sheet.getRange("G:G").format.columnWidthPx = 100;
sheet.getRange("A3:G11").format.verticalAlignment = "center";

const tableCheck = await workbook.inspect({
  kind: "table",
  range: "Age and Name!A1:G11",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 8,
  maxChars: 3000,
});
console.log(tableCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
  maxChars: 2000,
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Age and Name",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/age_name_sample_preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/age_name_sample.xlsx`);
