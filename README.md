ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" npm run build


~/Library/Logs/<你的应用名称>/main.log


# bug

# Debugging Build Issue: Missing Native Bindings & SQLite Error

## Issues Resolved

### 1. Missing Native Bindings (`impit`)
The built application failed to start with `Error: impit couldn't load native bindings`.
**Fix:** Explicitly installed the missing `impit-darwin-arm64` dependency.
```bash
pnpm add impit-darwin-arm64
```

### 2. SQLite Error (`unable to open database file`)
The application crashed with `SqliteError: unable to open database file` in `camoufox-js`.
**Cause:**
1.  `camoufox-js` database file was packed inside `app.asar` (initially).
2.  Even after unpacking, `camoufox-js` code was resolving the database path relative to its location in `app.asar` (virtual path), causing `better-sqlite3` to fail as it cannot open files inside ASAR.

**Fix:**
1.  **Unpacking:** Added `asarUnpack` configuration to [electron-builder.json5](file:///Users/xucongyong/mathematics/120code/aiinfo/aiinfo-electron/electron-builder.json5) to ensure `camoufox-js` is unpacked.
    ```json5
    "asarUnpack": [
      "**/node_modules/camoufox-js/**",
      // ...
    ]
    ```
2.  **Path Patching:** Created a patch script [scripts/fix-camoufox.cjs](file:///Users/xucongyong/mathematics/120code/aiinfo/aiinfo-electron/scripts/fix-camoufox.cjs) that modifies [node_modules/camoufox-js/dist/webgl/sample.js](file:///Users/xucongyong/mathematics/120code/aiinfo/aiinfo-electron/node_modules/camoufox-js/dist/webgl/sample.js). It replaces `app.asar` with `app.asar.unpacked` in the database path resolution logic.
    ```javascript
    // Patched code in sample.js
    const DB_PATH = path.join(import.meta.dirname, '..', 'data-files', 'webgl_data.db').replace('app.asar', 'app.asar.unpacked');
    ```
3.  **Automation:** Added this script to [package.json](file:///Users/xucongyong/mathematics/120code/aiinfo/aiinfo-electron/package.json) `postinstall` so it runs automatically after installation.
    ```json
    "postinstall": "electron-builder install-app-deps && node scripts/fix-camoufox.cjs"
    ```

## Next Steps
1.  **Rebuild the application**:
    ```bash
    npm run build
    ```
2.  **Verify**: Run the generated app. The application should now start correctly with access to the SQLite database.
