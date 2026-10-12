#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const packageJsonPath = path.join(rootDir, "package.json");

// Determine target version
let version = process.argv[2];
if (!version) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    version = pkg.version;
  } catch (err) {
    version = "1.0.0";
  }
}

// Normalize version (strip leading 'v')
const cleanVersion = version.replace(/^v/, "").trim();
const outputPath = process.argv[3] || path.join(rootDir, "release_notes.md");

let changelogContent = "";
if (fs.existsSync(changelogPath)) {
  changelogContent = fs.readFileSync(changelogPath, "utf-8");
}

let releaseNotes = "";

if (changelogContent) {
  // Match heading like ## [1.0.0] or ## 1.0.0 or ## v1.0.0 with optional date suffix
  const escapedVersion = cleanVersion.replace(/\./g, "\\.");
  const headingRegex = new RegExp(
    `^##\\s*\\[?v?${escapedVersion}\\]?[^\\n]*$`,
    "m"
  );
  const match = headingRegex.exec(changelogContent);

  if (match) {
    const startIndex = match.index + match[0].length;
    const remaining = changelogContent.substring(startIndex);
    // Find next heading starting with '## '
    const nextHeadingMatch = remaining.search(/\n##\s+/);
    if (nextHeadingMatch !== -1) {
      releaseNotes = remaining.substring(0, nextHeadingMatch).trim();
    } else {
      releaseNotes = remaining.trim();
    }
    // Remove trailing horizontal rule if present
    releaseNotes = releaseNotes.replace(/[\r\n\s]*---[\r\n\s]*$/, "").trim();
  }
}

// Fallback if no matching version section found in CHANGELOG.md
if (!releaseNotes) {
  releaseNotes = `### Release v${cleanVersion}\n\nAutomated release for \`medusajs-documents-plugin\` v${cleanVersion}.\n\nRefer to [CHANGELOG.md](https://github.com/urbandevicecare/medusajs-documents-plugin/blob/main/CHANGELOG.md) for full history.`;
}

// Append quick installation & assets section
const footer = `

---

### 📦 Installation & Download

\`\`\`bash
npm install medusajs-documents-plugin@${cleanVersion}
# or
yarn add medusajs-documents-plugin@${cleanVersion}
\`\`\`

**Attached Release Assets:**
- 📦 \`medusajs-documents-plugin-v${cleanVersion}.zip\` (Compressed plugin package)
- 📦 \`medusajs-documents-plugin-v${cleanVersion}.tgz\` (Packaged npm tarball)
`;

const finalNotes = `${releaseNotes}${footer}\n`;
fs.writeFileSync(outputPath, finalNotes, "utf-8");
console.log(`Generated release notes for v${cleanVersion} at ${outputPath}`);
