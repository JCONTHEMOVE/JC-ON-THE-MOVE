/**
 * Update package.json to use drizzle.config.mjs instead of default config
 */
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Update the db:push script to use the .mjs config
packageJson.scripts['db:push'] = 'drizzle-kit push --config=drizzle.config.mjs';

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated db:push command to use drizzle.config.mjs');
