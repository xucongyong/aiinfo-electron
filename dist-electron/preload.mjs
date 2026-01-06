"use strict";
const electron = require("electron");
const electronAPI = {
  ipcRenderer: {
    send(channel, ...args) {
      electron.ipcRenderer.send(channel, ...args);
    },
    sendTo(webContentsId, channel, ...args) {
      const electronVer = process.versions.electron;
      const electronMajorVer = electronVer ? parseInt(electronVer.split(".")[0]) : 0;
      if (electronMajorVer >= 28) {
        throw new Error('"sendTo" method has been removed since Electron 28.');
      } else {
        electron.ipcRenderer.sendTo(webContentsId, channel, ...args);
      }
    },
    sendSync(channel, ...args) {
      return electron.ipcRenderer.sendSync(channel, ...args);
    },
    sendToHost(channel, ...args) {
      electron.ipcRenderer.sendToHost(channel, ...args);
    },
    postMessage(channel, message, transfer) {
      electron.ipcRenderer.postMessage(channel, message, transfer);
    },
    invoke(channel, ...args) {
      return electron.ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    once(channel, listener) {
      electron.ipcRenderer.once(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener(channel, listener) {
      electron.ipcRenderer.removeListener(channel, listener);
      return this;
    },
    removeAllListeners(channel) {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  webFrame: {
    insertCSS(css) {
      return electron.webFrame.insertCSS(css);
    },
    setZoomFactor(factor) {
      if (typeof factor === "number" && factor > 0) {
        electron.webFrame.setZoomFactor(factor);
      }
    },
    setZoomLevel(level) {
      if (typeof level === "number") {
        electron.webFrame.setZoomLevel(level);
      }
    }
  },
  webUtils: {
    getPathForFile(file) {
      return electron.webUtils.getPathForFile(file);
    }
  },
  process: {
    get platform() {
      return process.platform;
    },
    get versions() {
      return process.versions;
    },
    get env() {
      return { ...process.env };
    }
  }
};
const api = {
  // IPC invoke method for renderer
  invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args),
  // 认证管理
  auth: {
    /**
     * 发送 Token 到主进程
     * 这是一个 "fire-and-forget" 操作，所以使用 .send()
     */
    setToken: (token) => {
      console.log("🔗 [Preload] 发送 Token 到主进程");
      electron.ipcRenderer.send("auth:set-token", token);
    },
    /**
     * 通知主进程清除 Token
     */
    clearToken: () => {
      console.log("🔗 [Preload] 通知主进程清除 Token");
      electron.ipcRenderer.send("auth:clear-token");
    }
  },
  // 账号管理
  accounts: {
    getList: (params) => electron.ipcRenderer.invoke("accounts:getList", params),
    getById: (id) => electron.ipcRenderer.invoke("accounts:getById", id),
    create: (data) => electron.ipcRenderer.invoke("accounts:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("accounts:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("accounts:delete", id),
    batch: (operation) => electron.ipcRenderer.invoke("accounts:batch", operation)
  },
  // 浏览器管理
  browser: {
    launch: (accountId) => {
      console.log("🔗 [Preload] 调用 browser.launch:", {
        accountId,
        type: typeof accountId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return electron.ipcRenderer.invoke("browser:launch", accountId);
    },
    close: (accountId) => {
      console.log("🔗 [Preload] 调用 browser.close:", {
        accountId,
        type: typeof accountId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return electron.ipcRenderer.invoke("browser:close", accountId);
    },
    navigate: (accountId, url) => {
      console.log("🔗 [Preload] 调用 browser.navigate:", { accountId, url });
      return electron.ipcRenderer.invoke("browser:navigate", accountId, url);
    },
    screenshot: (accountId) => {
      console.log("🔗 [Preload] 调用 browser.screenshot:", { accountId });
      return electron.ipcRenderer.invoke("browser:screenshot", accountId);
    },
    getRunningInstances: () => {
      console.log("🔗 [Preload] 调用 browser.getRunningInstances");
      return electron.ipcRenderer.invoke("browser:getRunningInstances");
    }
  },
  // 配置管理
  profiles: {
    getList: () => electron.ipcRenderer.invoke("profiles:getList"),
    create: (data) => electron.ipcRenderer.invoke("profiles:create", data)
  },
  proxies: {
    getList: () => electron.ipcRenderer.invoke("proxies:getList"),
    create: (data) => electron.ipcRenderer.invoke("proxies:create", data)
  },
  // 统计信息
  stats: {
    get: () => electron.ipcRenderer.invoke("stats:get")
  },
  // 导入导出
  data: {
    export: (type) => electron.ipcRenderer.invoke("data:export", type),
    import: (data, type, overwrite) => electron.ipcRenderer.invoke("data:import", data, type, overwrite)
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    window.electron = electronAPI;
    window.api = api;
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
