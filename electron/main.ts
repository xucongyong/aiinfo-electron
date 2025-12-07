import { app, BrowserWindow } from 'electron'
//import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

//const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { registerIpcHandlers } from './browserManager.js'

import log from 'electron-log';

// (可选) 配置日志级别和文件
log.transports.file.level = 'info'; // 'info', 'warn', 'error' 等
log.transports.file.fileName = 'main.log'; // 日志文件名

// 你甚至可以覆盖 console.log 和 console.error
// 这样你就不需要修改代码中所有的 console.log 了
Object.assign(console, log.functions);


// The built directory structure
// ├─┬─┬ dist
// │ │ └── index.html
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs

process.env.APP_ROOT = path.join(__dirname, '..')

// Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(process.env.VITE_PUBLIC, 'icon.png'));
  }

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// explicitly with Cmd + Q
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

//app.whenReady().then(createWindow)


app.whenReady().then(() => {
  registerIpcHandlers() // 注册所有 IPC 事件
  createWindow()
})