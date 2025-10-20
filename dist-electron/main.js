import { ipcMain as i, app as g, BrowserWindow as d } from "electron";
import { fileURLToPath as E } from "node:url";
import a from "node:path";
import { firefox as A } from "playwright-core";
import { launchOptions as P } from "camoufox-js";
const R = "https://aiinfo-api.hackx.dpdns.org", p = async (o, e, r = {}) => {
  if (!e)
    throw new Error("未提供身份验证令牌 (token)");
  const t = {
    "Content-Type": "application/json",
    ...r.headers,
    Authorization: `Bearer ${e}`
  }, n = await fetch(`${R}${o}`, {
    ...r,
    headers: t
  });
  if (!n.ok) {
    if (n.status === 401)
      throw new Error("身份验证失败 (Token 无效或已过期)");
    const c = await n.text();
    throw new Error(`API 请求失败: ${n.status} - ${c}`);
  }
  return n.json();
}, v = {
  /**
   * 获取单个浏览器配置
   * @param {string} browserId 
   * @param {string} token 
   * @returns {Promise<object | null>}
   */
  getBrowserProfile: async (o, e) => {
    try {
      return (await p("/api/browsers", e, { method: "GET" })).data.find((t) => t.browser_id === o) || null;
    } catch (r) {
      throw console.error(`[MainApiClient] 获取 ${o} 配置失败:`, r.message), r;
    }
  },
  /**
   * 更新浏览器 Cookie
   * @param {string} browserId 
   * @param {Array} cookies 
   * @param {string} token 
   * @returns {Promise<object>}
   */
  updateBrowserCookies: async (o, e, r) => {
    try {
      console.log(`[MainApiClient] 正在为 ${o} 保存 ${e.length} 个 Cookie...`);
      const t = await p(`/api/browsers?browser_id=${o}`, r, {
        method: "PUT",
        body: JSON.stringify({
          cookies: JSON.stringify(e)
          // 确保后端接收的是字符串
        })
      });
      return console.log(`[MainApiClient] ✅ 成功为 ${o} 保存 Cookie。`), t;
    } catch (t) {
      throw console.error(`[MainApiClient] ❌ 为 ${o} 保存 Cookie 时出错:`, t.message), t;
    }
  }
}, u = /* @__PURE__ */ new Map();
let w = null;
var f = [];
function _() {
  i.on("auth:set-token", (o, e) => {
    console.log("[Main] 成功接收并存储了 Auth Token"), w = e;
  }), i.on("auth:clear-token", () => {
    console.log("[Main] 已清除 Auth Token (用户登出)"), w = null;
  }), i.handle("browser:launch", async (o, e) => {
    if (console.log("[主进程] 收到浏览器启动请求:", { browserId: e }), !w)
      return console.error("[主进程] 启动失败: 主进程未收到认证 Token。"), { success: !1, error: "主进程未认证，请重新登录。" };
    try {
      return await m(e, w);
    } catch (r) {
      return console.error("[主进程] 浏览器启动异常:", r), { success: !1, error: `主进程异常: ${r.message}` };
    }
  }), i.handle("browser:close", async (o, e) => {
    try {
      return await B(e);
    } catch (r) {
      return console.error("[主进程] 浏览器关闭异常:", r), { success: !1, error: `主进程异常: ${r.message}` };
    }
  }), i.handle("browser:getRunningInstances", async () => {
    try {
      return D();
    } catch (o) {
      return console.error("[主进程] 获取运行实例异常:", o), { success: !1, error: `主进程异常: ${o.message}` };
    }
  }), i.handle("playwright:launch", async (o, e) => await m((e == null ? void 0 : e.browserId) || Date.now().toString(), null));
}
const m = async (o, e = null) => {
  let r;
  try {
    var t = {};
    try {
      if (!e) throw new Error("Token is null in playwrightManager");
      const l = await v.getBrowserProfile(o, e);
      t = JSON.parse(l.launch_config), console.log(t);
    } catch (l) {
      throw console.error("JSON 解析失败！原始值:", l.configValue), console.error("解析错误详情:", l.message), l;
    }
    r = await A.launch({
      ...await P({
        /* Camoufox options */
      }),
      headless: !1,
      proxy: {
        server: t.proxy
      }
    });
    var n = await r.newContext();
    f.length > 0 && (await n.addCookies(f), console.log("[主进程] 注入 Cookie 完成。"));
    const c = {
      browser: r,
      // 存储浏览器实例
      context: n,
      // 存储上下文实例
      startTime: /* @__PURE__ */ new Date(),
      accountId: o,
      token: e,
      saveInterval: null
      // 稍后赋值
    };
    await (await n.newPage()).goto("https://abrahamjuliot.github.io/creepjs/", {
      waitUntil: "domcontentloaded",
      timeout: 3e4
    }), u.set(o, c);
    const $ = setInterval(() => {
      y(o);
    }, 60 * 1e3);
    return c.saveInterval = $, console.log(`🎉 [主进程] 浏览器 ${o} 完全启动成功!`), {
      success: !0
      /* ... */
    };
  } catch (c) {
    return console.log(c), {
      success: !1
      /* ... */
    };
  }
}, y = async (o) => {
  const e = u.get(o);
  if (!e || !e.token) {
    console.log(`[主进程] 保存Cookie失败: 找不到 ID 为 ${o} 的实例或 token。`);
    return;
  }
  const r = e.token;
  try {
    const t = e.browser.contexts()[0];
    if (!t) {
      console.warn(`[主进程] 找不到 ID 为 ${o} 的浏览器上下文。`);
      return;
    }
    const n = await t.cookies();
    await v.updateBrowserCookies(o, n, r);
  } catch (t) {
    console.log(t);
  }
}, B = async (o) => {
  try {
    const e = u.get(o);
    return e ? (e.saveInterval && clearInterval(e.saveInterval), console.log(`[主进程] 正在为 ${o} 执行最后一次 Cookie 保存...`), await y(o), await e.browser.close(), u.delete(o), { success: !0, message: `浏览器 ${o} 已关闭` }) : { success: !1, error: "实例未找到" };
  } catch (e) {
    return console.error(`[主进程] 关闭浏览器 ${o} 异常:`, e.message), { success: !1, error: e.message };
  }
}, D = () => ({
  success: !0,
  data: Array.from(u.values()).map((e) => ({
    accountId: e.accountId,
    accountName: `浏览器 ${e.accountId}`,
    startTime: e.startTime
  }))
}), k = a.dirname(E(import.meta.url));
process.env.APP_ROOT = a.join(k, "..");
const h = process.env.VITE_DEV_SERVER_URL, x = a.join(process.env.APP_ROOT, "dist-electron"), T = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = h ? a.join(process.env.APP_ROOT, "public") : T;
let s;
function C() {
  s = new d({
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(k, "preload.mjs")
    }
  }), s.webContents.on("did-finish-load", () => {
    s == null || s.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), h ? s.loadURL(h) : s.loadFile(a.join(T, "index.html"));
}
g.on("window-all-closed", () => {
  process.platform !== "darwin" && (g.quit(), s = null);
});
g.on("activate", () => {
  d.getAllWindows().length === 0 && C();
});
g.whenReady().then(() => {
  _(), C();
});
export {
  x as MAIN_DIST,
  T as RENDERER_DIST,
  h as VITE_DEV_SERVER_URL
};
