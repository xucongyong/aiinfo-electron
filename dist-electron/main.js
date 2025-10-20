import { ipcMain, app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const API_BASE_URL = "https://aiinfo-api.hackx.dpdns.org";
const mainFetch = async (url, token, options = {}) => {
  if (!token) {
    throw new Error("未提供身份验证令牌 (token)");
  }
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    "Authorization": `Bearer ${token}`
  };
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("身份验证失败 (Token 无效或已过期)");
    }
    const errorBody = await response.text();
    throw new Error(`API 请求失败: ${response.status} - ${errorBody}`);
  }
  return response.json();
};
const mainApiClient = {
  /**
   * 获取单个浏览器配置
   * @param {string} browserId 
   * @param {string} token 
   * @returns {Promise<object | null>}
   */
  getBrowserProfile: async (browserId, token) => {
    try {
      const result = await mainFetch("/api/browsers", token, { method: "GET" });
      return result.data.find((b) => b.browser_id === browserId) || null;
    } catch (error) {
      console.error(`[MainApiClient] 获取 ${browserId} 配置失败:`, error.message);
      throw error;
    }
  },
  /**
   * 更新浏览器 Cookie
   * @param {string} browserId 
   * @param {Array} cookies 
   * @param {string} token 
   * @returns {Promise<object>}
   */
  updateBrowserCookies: async (browserId, cookies, token) => {
    try {
      console.log(`[MainApiClient] 正在为 ${browserId} 保存 ${cookies.length} 个 Cookie...`);
      const result = await mainFetch(`/api/browsers?browser_id=${browserId}`, token, {
        method: "PUT",
        body: JSON.stringify({
          cookies: JSON.stringify(cookies)
          // 确保后端接收的是字符串
        })
      });
      console.log(`[MainApiClient] ✅ 成功为 ${browserId} 保存 Cookie。`);
      return result;
    } catch (error) {
      console.error(`[MainApiClient] ❌ 为 ${browserId} 保存 Cookie 时出错:`, error.message);
      throw error;
    }
  }
};
const runningBrowsers = /* @__PURE__ */ new Map();
let globalAuthToken = null;
function registerIpcHandlers() {
  console.log("registerIpcHandlers init");
  ipcMain.on("ping", () => {
    console.log("pong");
  });
  ipcMain.on("auth:set-token", (event, token) => {
    console.log("🚀 [Main] 成功接收并存储了 Auth Token");
    globalAuthToken = token;
  });
  ipcMain.on("auth:clear-token", () => {
    console.log("🚀 [Main] 已清除 Auth Token (用户登出)");
    globalAuthToken = null;
  });
  ipcMain.handle("browser:launch", async (event, browserId) => {
    console.log("[主进程] 收到浏览器启动请求:", { browserId });
    if (!globalAuthToken) {
      console.error("[主进程] 启动失败: 主进程未收到认证 Token。");
      return { success: false, error: "主进程未认证，请重新登录。" };
    }
    try {
      const result = await playwrightManager(browserId, globalAuthToken);
      return result;
    } catch (error) {
      console.error("[主进程] 浏览器启动异常:", error);
      return { success: false, error: `主进程异常: ${error.message}` };
    }
  });
  ipcMain.handle("browser:close", async (event, browserId) => {
    try {
      const result = await closeBrowser(browserId);
      return result;
    } catch (error) {
      console.error("[主进程] 浏览器关闭异常:", error);
      return { success: false, error: `主进程异常: ${error.message}` };
    }
  });
  ipcMain.handle("browser:getRunningInstances", async () => {
    try {
      const result = getRunningInstances();
      return result;
    } catch (error) {
      console.error("[主进程] 获取运行实例异常:", error);
      return { success: false, error: `主进程异常: ${error.message}` };
    }
  });
  ipcMain.handle("playwright:launch", async (event, options) => {
    return await playwrightManager((options == null ? void 0 : options.browserId) || Date.now().toString(), null);
  });
}
const playwrightManager = async (browserId, token = null) => {
  let browser;
  try {
    var savedCookies = [];
    var launch_config = {};
    try {
      if (!token) throw new Error("Token is null in playwrightManager");
      const browserProfile = await mainApiClient.getBrowserProfile(browserId, token);
      console.log(" 实际获取的 launch_config 值:", browserProfile.launch_config);
      launch_config = JSON.parse(browserProfile.launch_config);
      console.log(launch_config);
    } catch (parseError) {
      console.error("JSON 解析失败！原始值:", parseError.configValue);
      console.error("解析错误详情:", parseError.message);
      throw parseError;
    }
    const browserData = {
      browser,
      // page, // 译注：你的 main.js 里有 page 和 context，这里也应该有
      // context,
      startTime: /* @__PURE__ */ new Date(),
      accountId: browserId,
      token,
      saveInterval: null
      // 稍后赋值
    };
  } catch (error) {
    console.error(`[主进程] 浏览器启动异常:`, error.message);
    return { success: false, error: `主进程异常: ${error.message}` };
  }
};
const saveCookiesForBrowser = async (browserId) => {
  const browserData = runningBrowsers.get(browserId);
  if (!browserData || !browserData.token) {
    console.log(`[主进程] 保存Cookie失败: 找不到 ID 为 ${browserId} 的实例或 token。`);
    return;
  }
  const tokenToUse = browserData.token;
  try {
    const context = browserData.browser.contexts()[0];
    if (!context) {
      console.warn(`[主进程] 找不到 ID 为 ${browserId} 的浏览器上下文。`);
      return;
    }
    const cookies = await context.cookies();
    await mainApiClient.updateBrowserCookies(browserId, cookies, tokenToUse);
  } catch (error) {
  }
};
const closeBrowser = async (browserId) => {
  try {
    const browserData = runningBrowsers.get(browserId);
    if (!browserData) {
      return { success: false, error: "实例未找到" };
    }
    if (browserData.saveInterval) {
      clearInterval(browserData.saveInterval);
    }
    console.log(`[主进程] 正在为 ${browserId} 执行最后一次 Cookie 保存...`);
    await saveCookiesForBrowser(browserId);
    await browserData.browser.close();
    runningBrowsers.delete(browserId);
    return { success: true, message: `浏览器 ${browserId} 已关闭` };
  } catch (error) {
    console.error(`[主进程] 关闭浏览器 ${browserId} 异常:`, error.message);
    return { success: false, error: error.message };
  }
};
const getRunningInstances = () => {
  const instances = Array.from(runningBrowsers.values()).map((browser) => ({
    accountId: browser.accountId,
    accountName: `浏览器 ${browser.accountId}`,
    startTime: browser.startTime
  }));
  return {
    success: true,
    data: instances
  };
};
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
