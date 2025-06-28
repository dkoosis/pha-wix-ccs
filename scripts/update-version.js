const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to your http-functions.js file
const targetFile = path.join(__dirname, '..', 'src', 'backend', 'http-functions.js');

try {
    // 1. Get the latest short Git commit hash
    const gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    
    // 2. Read the content of the target file
    let fileContent = fs.readFileSync(targetFile, 'utf8');

    // 3. Define the version string using the Git hash
    const versionString = `const CODE_VERSION = "v.${gitHash}";`;

    // 4. Replace the existing version line or add it if it doesn't exist
    if (fileContent.includes('const CODE_VERSION =')) {
        fileContent = fileContent.replace(/const CODE_VERSION = .*;/, versionString);
    } else {
        // If the line doesn't exist, you might need a more robust way to inject it.
        // For now, this assumes the line is already in the file.
        console.log('CODE_VERSION line not found. Please add it manually first.');
        process.exit(1);
    }

    // 5. Write the updated content back to the file
    fs.writeFileSync(targetFile, fileContent, 'utf8');
    
    console.log(`Successfully updated ${path.basename(targetFile)} with version: git:${gitHash}`);

    // 6. Stage the file so the change is included in the commit
    execSync(`git add ${targetFile}`);

} catch (error) {
    console.error('Failed to update version:', error);
    process.exit(1);
}