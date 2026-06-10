const fs = require("fs");
const path = require("path");
const { minify: minifyHtml } = require("html-minifier-terser");
const CleanCSS = require("clean-css");
const terser = require("terser");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");
const skip = new Set([
  ".git",
  ".netlify",
  "dist",
  "node_modules",
  "supabase",
  "scripts"
]);

function copyTree(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const name = path.basename(src);
    if (skip.has(name)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  if (/activation_codes\.sqlite|npm-debug\.log/i.test(path.basename(src))) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

async function minifyFile(file) {
  const ext = path.extname(file).toLowerCase();
  const input = fs.readFileSync(file, "utf8");

  if (ext === ".html") {
    const output = await minifyHtml(input, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyCSS: true,
      minifyJS: true
    });
    fs.writeFileSync(file, output, "utf8");
    return;
  }

  if (ext === ".css") {
    const output = new CleanCSS({ level: 1 }).minify(input);
    if (!output.errors.length) fs.writeFileSync(file, output.styles, "utf8");
    return;
  }

  if (ext === ".js") {
    const output = await terser.minify(input, {
      compress: { passes: 2 },
      mangle: true,
      format: { comments: false }
    });
    if (output.code) fs.writeFileSync(file, output.code, "utf8");
  }
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const entry of fs.readdirSync(root)) {
    copyTree(path.join(root, entry), path.join(outDir, entry));
  }

  for (const file of walk(outDir)) {
    if (/\.(html|css|js)$/i.test(file)) {
      await minifyFile(file);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
