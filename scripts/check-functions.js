const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "netlify", "functions");
const files = fs.readdirSync(root).filter((file) => file.endsWith(".js"));
for (const file of files) require(path.join(root, file));
console.log(`Loaded ${files.length} Netlify functions successfully.`);

