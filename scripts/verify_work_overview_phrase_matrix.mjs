import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = await FileBlob.load("outputs/work-overview-copy/work_overview_phrase_matrix.xlsx");
const workbook = await SpreadsheetFile.importXlsx(input);

const matrix = await workbook.inspect({
    kind: "table",
    range: "Phrase Matrix!A1:E13",
    include: "values",
    tableMaxRows: 13,
    tableMaxCols: 5,
});
console.log(matrix.ndjson);

const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 50 },
    summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "Phrase Matrix", range: "A1:E20", scale: 1 });
await workbook.render({ sheetName: "Rules", range: "A1:B8", scale: 1 });
