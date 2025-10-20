import { app, shell, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// --- 关键新增：导入我们的新模块 ---
import { registerIpcHandlers, cleanupAllBrowsers } from './browserManager'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
// ... (这部分模板代码保留)
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// --- 关键修改：使用 main.js 中更完善的 createWindow ---
function createWindow() {
  // 使用 main.js 的配置
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'), // 使用模板的 icon 路径
    webPreferences: {
      // --- 关键修改：使用模板的 preload 路径 ---
      preload: path.join(__dirname, 'preload.mjs'), 
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // 注意：这个设置有安全风险，但我们暂时保留 main.js 的设置
    }
  });

  // --- 保留 main.js 的所有窗口事件 ---
  win.on('ready-to-show', () => {
    console.log('🚀 [Main] Window ready to show')
    win?.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  
  win.webContents.on('did-finish-load', () => {
    // 模板里的测试代码，可以保留
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {})
  
  // CSP 设置 (从 main.js 复制)
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' https://aiinfo-api.hackx.dpdns.org https://*.hackx.dpdns.org ws://localhost:* ws://127.0.0.1:*; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:;"]
      }
    })
  })

  // --- 关键修改：使用模板的 URL 加载逻辑 ---
  if (VITE_DEV_SERVER_URL) {
    console.log('🚀 [Main] Loading dev URL:', VITE_DEV_SERVER_URL)
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // 使用模板的 RENDERER_DIST 路径
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// --- 关键修改：从 main.js 复制退出逻辑 ---
// (这比 main.ts 模板的逻辑更健壮，因为它会清理浏览器)

app.on('window-all-closed', async () => {
  await cleanupAllBrowsers(); // 调用清理
  if (process.platform !== 'darwin') {
    app.quit()
    win = null // 模板中的代码，保留
  }
})

app.on('before-quit', async () => {
  await cleanupAllBrowsers(); // 调用清理
})

app.on('will-quit', async (event:any) => {
  event.preventDefault(); // 阻止立即退出
  await cleanupAllBrowsers(); // 等待清理完成
  app.exit(0); // 然后退出
})


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// --- 关键修改：在 whenReady 中注册 IPC ---
app.whenReady().then(() => {
  registerIpcHandlers() // 注册所有 IPC 事件
  createWindow()
})