import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // IPC invoke method for renderer
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // 账号管理
  accounts: {
    getList: (params) => ipcRenderer.invoke('accounts:getList', params),
    getById: (id) => ipcRenderer.invoke('accounts:getById', id),
    create: (data) => ipcRenderer.invoke('accounts:create', data),
    update: (id, data) => ipcRenderer.invoke('accounts:update', id, data),
    delete: (id) => ipcRenderer.invoke('accounts:delete', id),
    batch: (operation) => ipcRenderer.invoke('accounts:batch', operation),
  },

  // 浏览器管理
  browser: {
    launch: (accountId) => {
      console.log('🔗 [Preload] 调用 browser.launch:', {
        accountId,
        type: typeof accountId,
        timestamp: new Date().toISOString()
      })
      return ipcRenderer.invoke('browser:launch', accountId)
    },
    close: (accountId) => {
      console.log('🔗 [Preload] 调用 browser.close:', {
        accountId,
        type: typeof accountId,
        timestamp: new Date().toISOString()
      })
      return ipcRenderer.invoke('browser:close', accountId)
    },
    navigate: (accountId, url) => {
      console.log('🔗 [Preload] 调用 browser.navigate:', { accountId, url })
      return ipcRenderer.invoke('browser:navigate', accountId, url)
    },
    screenshot: (accountId) => {
      console.log('🔗 [Preload] 调用 browser.screenshot:', { accountId })
      return ipcRenderer.invoke('browser:screenshot', accountId)
    },
    getRunningInstances: () => {
      console.log('🔗 [Preload] 调用 browser.getRunningInstances')
      return ipcRenderer.invoke('browser:getRunningInstances')
    },
  },

  // 配置管理
  profiles: {
    getList: () => ipcRenderer.invoke('profiles:getList'),
    create: (data) => ipcRenderer.invoke('profiles:create', data),
  },

  proxies: {
    getList: () => ipcRenderer.invoke('proxies:getList'),
    create: (data) => ipcRenderer.invoke('proxies:create', data),
  },

  // 统计信息
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
  },

  // 导入导出
  data: {
    export: (type) => ipcRenderer.invoke('data:export', type),
    import: (data, type, overwrite) => ipcRenderer.invoke('data:import', data, type, overwrite),
  }
}

// 调试 preload 脚本执行
console.log('🔧 [Preload] Preload script executing...')
console.log('🔧 [Preload] contextIsolation:', process.contextIsolated)
console.log('🔧 [Preload] API object before exposure:', api)

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    console.log('���� [Preload] Using contextBridge to expose APIs')
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('🔧 [Preload] APIs exposed via contextBridge')

    // 立即验证暴露是否成功
    setTimeout(() => {
      console.log('🔧 [Preload] Verification after timeout')
    }, 100)
  } catch (error) {
    console.error('🔧 [Preload] Error exposing APIs via contextBridge:', error)
    // 降级到直接暴露
    window.electron = electronAPI
    window.api = api
    console.log('🔧 [Preload] APIs exposed directly as fallback')
  }
} else {
  console.log('🔧 [Preload] Context isolation disabled, exposing APIs directly')
  window.electron = electronAPI
  window.api = api
  console.log('🔧 [Preload] APIs exposed directly')
}

// 强制暴露到 window 对象作为备用方案
window.api = api
window.electron = electronAPI
console.log('🔧 [Preload] Force exposed APIs to window as backup')

console.log('🔧 [Preload] Preload script completed')
