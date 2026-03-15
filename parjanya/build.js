/**
 * PARJANYA AI — BUILD & OBFUSCATION PIPELINE
 * ═══════════════════════════════════════════
 * Run: node build.js
 *
 * What this does:
 * 1. Reads your source HTML/JS files
 * 2. Extracts all <script> blocks
 * 3. Obfuscates them with Terser (renames functions to _0x4a2b style)
 * 4. Re-injects into HTML and writes to /dist folder
 * 5. Removes all developer comments
 * 6. Injects HTML copyright watermark
 *
 * Install once:
 *   npm install terser html-minifier-terser
 *
 * Then run before each deploy:
 *   node build.js
 *   → Upload /dist/index.html to GitHub instead of /index.html
 */

const fs = require("fs");
const path = require("path");
const { minify } = require("terser");
const { minify: minifyHtml } = require("html-minifier-terser");

/* ══════════════════════════════════════
   OBFUSCATION OPTIONS
   These settings make code unreadable
   while keeping it fully functional
══════════════════════════════════════ */
const TERSER_OPTIONS = {
  compress: {
    // Aggressive compression
    dead_code: true,
    drop_console: true,           // Remove all console.log in production
    drop_debugger: true,
    passes: 3,                    // Multiple compression passes
    toplevel: true,
    unsafe: false,
    evaluate: true,
    booleans_as_integers: true,
    hoist_funs: true,
    hoist_vars: true,
  },
  mangle: {
    // RENAME all functions/variables to random strings
    toplevel: true,               // Rename top-level functions
    eval: false,
    properties: {
      // Rename object properties too (most aggressive)
      // Be careful — this can break if you access properties by string
      regex: /^_/,                // Only rename properties starting with _
    },
    reserved: [
      // NEVER rename these — they are used externally or in HTML attributes
      "sendMsg", "openChat", "closeChat", "toggleChat",
      "startVoice", "stopSpeaking", "toggleTTS",
      "getLiveWeather", "analyzeImage", "runVision",
      "getLocation", "quickAsk", "clearChat",
      "handleFileSelect", "handleDragOver", "handleDrop",
      "adminLogin", "doLogin", "doLogout",
      "handleRegister", "handleLogin", "logout",
      "showPage", "showAdminPage", "nav",
      "toggleVisionZone", "addVisionUploadToChat",
      // Config
      "PARJANYA_CONFIG", "PJ", "OFFLINE_DB"
    ]
  },
  format: {
    // Remove ALL comments
    comments: false,
    // Compact output
    beautify: false,
    // ASCII-only output (avoids encoding issues)
    ascii_only: true,
  },
  sourceMap: false,   // No source maps in production (reveals original code)
};

const HTML_MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,           // Remove <!-- HTML comments --> too
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  minifyJS: true,                  // Also minify inline JS
  minifyCSS: true,                 // Also minify inline CSS
  processConditionalComments: false,
};

/* ══════════════════════════════════════
   COPYRIGHT INJECTION
   Added to every built file
══════════════════════════════════════ */
const COPYRIGHT_HEADER = `<!--
  © ${new Date().getFullYear()} Parjanya AI · ak.founderr@gmail.com · Dharwad, Karnataka, India
  Protected under Indian Copyright Act 1957 & IT Act 2000
  Unauthorized copying, scraping, or reproduction is strictly prohibited
  Build: ${new Date().toISOString()} · ${Math.random().toString(36).substring(2, 10).toUpperCase()}
-->`;

/* ══════════════════════════════════════
   MAIN BUILD FUNCTION
══════════════════════════════════════ */
async function build() {
  console.log("\n🔒 PARJANYA AI — Secure Build Pipeline");
  console.log("══════════════════════════════════════\n");

  const srcDir = path.join(__dirname, "..");
  const distDir = path.join(__dirname, "../dist");

  // Create dist directory
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const htmlFiles = ["index.html", "login.html", "register.html", "farmer-dashboard.html", "admin.html", "owner-control.html"];
  const jsFiles = ["config.js", "crop-db.js", "protect.js"];

  let totalSaved = 0;
  let filesProcessed = 0;

  /* Process HTML files */
  for (const filename of htmlFiles) {
    const srcPath = path.join(srcDir, filename);
    if (!fs.existsSync(srcPath)) { console.log(`  ⏭ Skipping ${filename} (not found)`); continue; }

    console.log(`  🔧 Processing ${filename}...`);
    let html = fs.readFileSync(srcPath, "utf8");
    const originalSize = html.length;

    // Extract and obfuscate all <script> blocks
    const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
    const scriptMatches = [...html.matchAll(scriptRegex)];

    for (const match of scriptMatches) {
      const originalScript = match[1];
      if (originalScript.trim().length < 50) continue; // Skip tiny scripts

      try {
        const result = await minify(originalScript, TERSER_OPTIONS);
        if (result.code) {
          html = html.replace(match[0], `<script>${result.code}</script>`);
        }
      } catch(err) {
        console.warn(`    ⚠ JS minification failed for block: ${err.message.substring(0, 60)}`);
      }
    }

    // Minify full HTML (also minifies inline CSS)
    try {
      html = await minifyHtml(html, HTML_MINIFY_OPTIONS);
    } catch(err) {
      console.warn(`    ⚠ HTML minification failed: ${err.message.substring(0, 60)}`);
    }

    // Inject copyright header (after <!DOCTYPE>)
    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>" + COPYRIGHT_HEADER);

    // Write to dist
    const distPath = path.join(distDir, filename);
    fs.writeFileSync(distPath, html);

    const reduction = Math.round((1 - html.length / originalSize) * 100);
    totalSaved += (originalSize - html.length);
    filesProcessed++;
    console.log(`  ✓ ${filename}: ${(originalSize/1024).toFixed(1)}KB → ${(html.length/1024).toFixed(1)}KB (-${reduction}%)`);
  }

  /* Process standalone JS files */
  for (const filename of jsFiles) {
    const srcPath = path.join(srcDir, filename);
    if (!fs.existsSync(srcPath)) continue;

    console.log(`  🔧 Processing ${filename}...`);
    const source = fs.readFileSync(srcPath, "utf8");
    const originalSize = source.length;

    try {
      const result = await minify(source, TERSER_OPTIONS);
      if (result.code) {
        const output = `/* © ${new Date().getFullYear()} Parjanya AI */\n${result.code}`;
        fs.writeFileSync(path.join(distDir, filename), output);
        const reduction = Math.round((1 - result.code.length / originalSize) * 100);
        totalSaved += (originalSize - result.code.length);
        filesProcessed++;
        console.log(`  ✓ ${filename}: ${(originalSize/1024).toFixed(1)}KB → ${(result.code.length/1024).toFixed(1)}KB (-${reduction}%)`);
      }
    } catch(err) {
      console.warn(`  ⚠ Failed to minify ${filename}: ${err.message}`);
      fs.copyFileSync(srcPath, path.join(distDir, filename));
    }
  }

  /* Copy non-JS/HTML assets */
  const assetFiles = fs.readdirSync(srcDir).filter(f =>
    !htmlFiles.includes(f) &&
    !jsFiles.includes(f) &&
    !f.startsWith(".") &&
    !f.startsWith("_") &&
    !["node_modules", "dist", "build", "netlify"].includes(f) &&
    !f.endsWith(".md")
  );

  for (const asset of assetFiles) {
    const src = path.join(srcDir, asset);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(distDir, asset));
      console.log(`  📋 Copied: ${asset}`);
    }
  }

  /* Copy Netlify functions (not obfuscated — runs server-side) */
  const funcSrc = path.join(srcDir, "netlify");
  const funcDist = path.join(distDir, "netlify");
  if (fs.existsSync(funcSrc)) {
    copyDir(funcSrc, funcDist);
    console.log(`  📋 Copied: netlify/functions/`);
  }

  console.log(`\n✅ Build complete!`);
  console.log(`   ${filesProcessed} files processed`);
  console.log(`   ${(totalSaved/1024).toFixed(1)}KB total savings`);
  console.log(`   Output: ./dist/`);
  console.log(`\n📤 DEPLOY: Upload contents of /dist to GitHub → Netlify auto-deploys\n`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item), d = path.join(dest, item);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

build().catch(err => { console.error("❌ Build failed:", err); process.exit(1); });
