const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

const docxPath = path.join(__dirname, "..", "Lab 2.2.2026.docx");
const outputPath = path.join(__dirname, "public", "guide-content.html");

console.log(`Reading: ${docxPath}`);
console.log(`Writing to: ${outputPath}`);

mammoth.convertToHtml({ path: docxPath })
    .then(function (result) {
        var html = result.value; // The generated HTML
        var messages = result.messages; // Any messages, such as warnings during conversion
        fs.writeFileSync(outputPath, html);
        console.log("✅ Extraction successful! HTML saved to public/guide-content.html");
        if (messages.length > 0) {
            console.log("⚠️ Messages:", messages);
        }
    })
    .catch(function (error) {
        console.error("❌ Error during extraction:", error);
        process.exit(1);
    });
