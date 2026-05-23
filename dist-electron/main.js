var st = Object.defineProperty;
var it = (l, c, o) => c in l ? st(l, c, { enumerable: !0, configurable: !0, writable: !0, value: o }) : l[c] = o;
var d = (l, c, o) => it(l, typeof c != "symbol" ? c + "" : c, o);
import at, { ipcMain as F, app as $, BrowserWindow as Je } from "electron";
import { fileURLToPath as ct } from "node:url";
import A from "node:path";
import { firefox as lt } from "playwright-core";
import { launchOptions as ut } from "camoufox-js";
import C from "path";
import ft from "child_process";
import j from "os";
import D from "fs";
import pt from "util";
import Ve from "events";
import ht from "http";
import dt from "https";
const gt = "https://aiinfo-api.hackx.dpdns.org", de = async (l, c, o = {}) => {
  if (!c)
    throw new Error("未提供身份验证令牌 (token)");
  const s = {
    "Content-Type": "application/json",
    ...o.headers,
    Authorization: `Bearer ${c}`
  }, i = await fetch(`${gt}${l}`, {
    ...o,
    headers: s
  });
  if (!i.ok) {
    if (i.status === 401)
      throw new Error("身份验证失败 (Token 无效或已过期)");
    const r = await i.text();
    throw new Error(`API 请求失败: ${i.status} - ${r}`);
  }
  return i.json();
}, He = {
  /**
   * 获取单个浏览器配置
   * @param {string} browserId 
   * @param {string} token 
   * @returns {Promise<object | null>}
   */
  getBrowserProfile: async (l, c) => {
    try {
      return (await de("/api/browsers", c, { method: "GET" })).data.find((s) => s.browser_id === l) || null;
    } catch (o) {
      throw console.error(`[MainApiClient] 获取 ${l} 配置失败:`, o.message), o;
    }
  },
  /**
   * 更新浏览器 Cookie
   * @param {string} browserId 
   * @param {Array} cookies 
   * @param {string} token 
   * @returns {Promise<object>}
   */
  updateBrowserCookies: async (l, c, o) => {
    try {
      console.log(`[MainApiClient] 正在为 ${l} 保存 ${c.length} 个 Cookie...`);
      const s = await de(`/api/browsers?browser_id=${l}`, o, {
        method: "PUT",
        body: JSON.stringify({
          cookies: JSON.stringify(c)
          // 确保后端接收的是字符串
        })
      });
      return console.log(`[MainApiClient] ✅ 成功为 ${l} 保存 Cookie。`), s;
    } catch (s) {
      throw console.error(`[MainApiClient] ❌ 为 ${l} 保存 Cookie 时出错:`, s.message), s;
    }
  }
}, x = /* @__PURE__ */ new Map();
let R = null;
const yt = (l, c) => {
  let o = null;
  return (...s) => {
    o && clearTimeout(o), o = setTimeout(() => {
      l(...s);
    }, c);
  };
}, mt = async (l, c) => {
  const o = typeof c == "string" ? JSON.parse(c) : c;
  if (o && o.length > 0) {
    const s = o.filter((i) => i.expires && i.expires !== -1 ? i.expires * 1e3 > Date.now() : !0);
    return s.length > 0 ? (await l.context().addCookies(s), console.log(`[load_cookie] Loaded ${s.length} valid cookies.`), !0) : (console.log("[load_cookie] All cookies were expired. Starting fresh."), !1);
  }
};
function vt() {
  F.on("auth:set-token", (l, c) => {
    console.log("[Main] 成功接收并存储了 Auth Token"), R = c;
  }), F.on("auth:clear-token", () => {
    console.log("[Main] 已清除 Auth Token (用户登出)"), R = null;
  }), F.handle("browser:launch", async (l, c) => {
    if (console.log("[主进程] 收到浏览器启动请求:", { browserId: c }), !R)
      return console.error("[主进程] 启动失败: 主进程未收到认证 Token。"), { success: !1, error: "主进程未认证，请重新登录。" };
    try {
      return await ge(c, R);
    } catch (o) {
      return console.error("[主进程] 浏览器启动异常:", o), { success: !1, error: `主进程异常: ${o.message}` };
    }
  }), F.handle("browser:close", async (l, c) => {
    try {
      return await wt(c);
    } catch (o) {
      return console.error("[主进程] 浏览器关闭异常:", o), { success: !1, error: `主进程异常: ${o.message}` };
    }
  }), F.handle("browser:getRunningInstances", async () => {
    try {
      return bt();
    } catch (l) {
      return console.error("[主进程] 获取运行实例异常:", l), { success: !1, error: `主进程异常: ${l.message}` };
    }
  }), F.handle("playwright:launch", async (l, c) => await ge((c == null ? void 0 : c.browserId) || Date.now().toString(), null));
}
const ge = async (l, c = null) => {
  var t;
  let o;
  var s;
  try {
    var i = {};
    let e = [];
    try {
      if (console.log("init start playwrightManager!"), !c) throw new Error("Token is null in playwrightManager");
      if (s = await He.getBrowserProfile(l, c), console.log("browserProfile:", s), i = JSON.parse(s.launch_config), s.cookies)
        try {
          e = typeof s.cookies == "string" ? JSON.parse(s.cookies) : s.cookies, console.log(`[主进程] 获取到 ${e.length} 个 Cookie 准备注入`);
        } catch (p) {
          console.error("[主进程] Cookie 解析失败:", p);
        }
    } catch (p) {
      throw console.error("JSON 解析失败！原始值:", p.configValue), console.error("解析错误详情:", p.message), p;
    }
    const n = await ut({
      /* Camoufox options */
    });
    o = await lt.launch({
      ...n,
      headless: !1,
      humanize: !0,
      // Enable human-like mouse movement
      geoip: !1,
      // ⚠️ DISABLE to fix mmdb crash
      locale: "zh-CN",
      os: "macos",
      // Or 'windows' depending on preference, sticking to macos for consistency
      fonts: [
        "SimSun",
        // Windows 宋体
        "Microsoft YaHei",
        // Windows 微软雅黑
        "PingFang SC",
        // macOS 苹方
        "Hiragino Sans GB",
        // macOS 冬青黑体
        "sans-serif"
        // 最终回退
      ],
      proxy: {
        server: i.proxy
      },
      firefoxUserPrefs: {
        ...n.firefoxUserPrefs,
        // 关键修复：关闭隔离以允许 Tab 间共享 Cookie
        "privacy.firstparty.isolate": !1,
        "privacy.userContext.enabled": !1,
        "network.cookie.cookieBehavior": 0,
        // --- 增强修改：更激进地关闭隐私隔离 ---
        "privacy.resistFingerprinting": !1,
        "privacy.trackingprotection.enabled": !1,
        "browser.privatebrowsing.autostart": !1,
        "dom.storage.enabled": !0,
        // --- Round 3: The Hammer ---
        "privacy.partition.network_state": !1,
        "privacy.partition.serviceWorkers": !1,
        "browser.cache.disk.enable": !1
      }
    });
    var r = await o.newContext();
    e && e.length > 0 && (await r.addCookies(e), console.log(`[主进程] 注入 Cookie 完成。Sample: ${(t = e[0]) == null ? void 0 : t.name}`));
    const a = {
      browser: o,
      // 存储浏览器实例
      context: r,
      // 存储上下文实例
      startTime: /* @__PURE__ */ new Date(),
      accountId: l,
      token: c,
      saveInterval: null,
      lastCookieStr: "",
      // 新增：用于比对
      // 新增：防抖保存函数 (2秒防抖)
      triggerSave: yt(() => Ge(l), 2e3)
    };
    x.set(l, a);
    const u = async () => {
      try {
        const p = await r.cookies();
        p && p.length > 0 && (e = p), a.triggerSave();
      } catch (p) {
        console.error("[主进程] Failed to update cookie cache:", p);
      }
    };
    r.on("page", async (p) => {
      if (console.log("[主进程] New page created in context."), e && e.length > 0)
        try {
          console.log(`[主进程] Attempting re-injection of ${e.length} cookies...`), await r.addCookies(e), console.log("[主进程] 🔨 Forced cookie re-injection for new page.");
        } catch (h) {
          console.error(`[主进程] Re-injection failed: ${h.message}`);
        }
      else
        console.log("[主进程] No cookies to re-inject. (cookiesToInject is empty or null)");
      p.context().cookies().then((h) => {
        console.log(`[主进程] New page sees ${h.length} cookies.`), h.length > 0 && console.log(`[主进程] First cookie seen: ${h[0].name}`);
      }), p.on("framenavigated", () => {
        u();
      }), p.on("close", () => {
        u();
      });
    });
    const f = await r.newPage();
    return await mt(f, e), await f.goto("https://abrahamjuliot.github.io/creepjs/", {
      waitUntil: "domcontentloaded",
      timeout: 3e4
    }), x.set(l, a), a.saveInterval = setInterval(() => {
      u();
    }, 5 * 60 * 1e3), console.log(`🎉 [主进程] 浏览器 ${l} 完全启动成功!`), {
      success: !0
      /* ... */
    };
  } catch (e) {
    return console.log(e), {
      success: !1
      /* ... */
    };
  }
}, Ge = async (l) => {
  const c = x.get(l);
  if (!(!c || !c.token))
    try {
      const o = c.browser.contexts()[0];
      if (!o) return;
      const s = await o.cookies();
      s.sort((r, t) => r.name > t.name ? 1 : -1);
      const i = JSON.stringify(s);
      if (c.lastCookieStr === i)
        return;
      await He.updateBrowserCookies(l, s, c.token), c.lastCookieStr = i, console.log(`[主进程] ♻️ Cookie 发生变动，已同步至服务器 - ${l}`);
    } catch (o) {
      console.error(`[主进程] 保存 Cookie 失败 ${l}:`, o.message);
    }
}, wt = async (l) => {
  try {
    const c = x.get(l);
    return c ? (c.saveInterval && clearInterval(c.saveInterval), console.log(`[主进程] 正在为 ${l} 执行最后一次 Cookie 保存...`), await Ge(l), await c.browser.close(), x.delete(l), { success: !0, message: `浏览器 ${l} 已关闭` }) : { success: !1, error: "实例未找到" };
  } catch (c) {
    return console.error(`[主进程] 关闭浏览器 ${l} 异常:`, c.message), { success: !1, error: c.message };
  }
}, bt = () => ({
  success: !0,
  data: Array.from(x.values()).map((c) => ({
    accountId: c.accountId,
    accountName: `浏览器 ${c.accountId}`,
    startTime: c.startTime
  }))
});
function St(l) {
  return l && l.__esModule && Object.prototype.hasOwnProperty.call(l, "default") ? l.default : l;
}
var k = { exports: {} }, N = { exports: {} }, ye;
function Ye() {
  return ye || (ye = 1, function(l) {
    let c = {};
    try {
      c = require("electron");
    } catch {
    }
    c.ipcRenderer && o(c), l.exports = o;
    function o({ contextBridge: s, ipcRenderer: i }) {
      if (!i)
        return;
      i.on("__ELECTRON_LOG_IPC__", (t, e) => {
        window.postMessage({ cmd: "message", ...e });
      }), i.invoke("__ELECTRON_LOG__", { cmd: "getOptions" }).catch((t) => console.error(new Error(
        `electron-log isn't initialized in the main process. Please call log.initialize() before. ${t.message}`
      )));
      const r = {
        sendToMain(t) {
          try {
            i.send("__ELECTRON_LOG__", t);
          } catch (e) {
            console.error("electronLog.sendToMain ", e, "data:", t), i.send("__ELECTRON_LOG__", {
              cmd: "errorHandler",
              error: { message: e == null ? void 0 : e.message, stack: e == null ? void 0 : e.stack },
              errorName: "sendToMain"
            });
          }
        },
        log(...t) {
          r.sendToMain({ data: t, level: "info" });
        }
      };
      for (const t of ["error", "warn", "info", "verbose", "debug", "silly"])
        r[t] = (...e) => r.sendToMain({
          data: e,
          level: t
        });
      if (s && process.contextIsolated)
        try {
          s.exposeInMainWorld("__electronLog", r);
        } catch {
        }
      typeof window == "object" ? window.__electronLog = r : __electronLog = r;
    }
  }(N)), N.exports;
}
var I = { exports: {} }, M, me;
function Et() {
  if (me) return M;
  me = 1, M = l;
  function l(c) {
    return Object.defineProperties(o, {
      defaultLabel: { value: "", writable: !0 },
      labelPadding: { value: !0, writable: !0 },
      maxLabelLength: { value: 0, writable: !0 },
      labelLength: {
        get() {
          switch (typeof o.labelPadding) {
            case "boolean":
              return o.labelPadding ? o.maxLabelLength : 0;
            case "number":
              return o.labelPadding;
            default:
              return 0;
          }
        }
      }
    });
    function o(s) {
      o.maxLabelLength = Math.max(o.maxLabelLength, s.length);
      const i = {};
      for (const r of c.levels)
        i[r] = (...t) => c.logData(t, { level: r, scope: s });
      return i.log = i.info, i;
    }
  }
  return M;
}
var q, ve;
function At() {
  if (ve) return q;
  ve = 1;
  class l {
    constructor({ processMessage: o }) {
      this.processMessage = o, this.buffer = [], this.enabled = !1, this.begin = this.begin.bind(this), this.commit = this.commit.bind(this), this.reject = this.reject.bind(this);
    }
    addMessage(o) {
      this.buffer.push(o);
    }
    begin() {
      this.enabled = [];
    }
    commit() {
      this.enabled = !1, this.buffer.forEach((o) => this.processMessage(o)), this.buffer = [];
    }
    reject() {
      this.enabled = !1, this.buffer = [];
    }
  }
  return q = l, q;
}
var z, we;
function Qe() {
  if (we) return z;
  we = 1;
  const l = Et(), c = At(), s = class s {
    constructor({
      allowUnknownLevel: r = !1,
      dependencies: t = {},
      errorHandler: e,
      eventLogger: n,
      initializeFn: a,
      isDev: u = !1,
      levels: f = ["error", "warn", "info", "verbose", "debug", "silly"],
      logId: p,
      transportFactories: h = {},
      variables: b
    } = {}) {
      d(this, "dependencies", {});
      d(this, "errorHandler", null);
      d(this, "eventLogger", null);
      d(this, "functions", {});
      d(this, "hooks", []);
      d(this, "isDev", !1);
      d(this, "levels", null);
      d(this, "logId", null);
      d(this, "scope", null);
      d(this, "transports", {});
      d(this, "variables", {});
      this.addLevel = this.addLevel.bind(this), this.create = this.create.bind(this), this.initialize = this.initialize.bind(this), this.logData = this.logData.bind(this), this.processMessage = this.processMessage.bind(this), this.allowUnknownLevel = r, this.buffering = new c(this), this.dependencies = t, this.initializeFn = a, this.isDev = u, this.levels = f, this.logId = p, this.scope = l(this), this.transportFactories = h, this.variables = b || {};
      for (const y of this.levels)
        this.addLevel(y, !1);
      this.log = this.info, this.functions.log = this.log, this.errorHandler = e, e == null || e.setOptions({ ...t, logFn: this.error }), this.eventLogger = n, n == null || n.setOptions({ ...t, logger: this });
      for (const [y, g] of Object.entries(h))
        this.transports[y] = g(this, t);
      s.instances[p] = this;
    }
    static getInstance({ logId: r }) {
      return this.instances[r] || this.instances.default;
    }
    addLevel(r, t = this.levels.length) {
      t !== !1 && this.levels.splice(t, 0, r), this[r] = (...e) => this.logData(e, { level: r }), this.functions[r] = this[r];
    }
    catchErrors(r) {
      return this.processMessage(
        {
          data: ["log.catchErrors is deprecated. Use log.errorHandler instead"],
          level: "warn"
        },
        { transports: ["console"] }
      ), this.errorHandler.startCatching(r);
    }
    create(r) {
      return typeof r == "string" && (r = { logId: r }), new s({
        dependencies: this.dependencies,
        errorHandler: this.errorHandler,
        initializeFn: this.initializeFn,
        isDev: this.isDev,
        transportFactories: this.transportFactories,
        variables: { ...this.variables },
        ...r
      });
    }
    compareLevels(r, t, e = this.levels) {
      const n = e.indexOf(r), a = e.indexOf(t);
      return a === -1 || n === -1 ? !0 : a <= n;
    }
    initialize(r = {}) {
      this.initializeFn({ logger: this, ...this.dependencies, ...r });
    }
    logData(r, t = {}) {
      this.buffering.enabled ? this.buffering.addMessage({ data: r, date: /* @__PURE__ */ new Date(), ...t }) : this.processMessage({ data: r, ...t });
    }
    processMessage(r, { transports: t = this.transports } = {}) {
      if (r.cmd === "errorHandler") {
        this.errorHandler.handle(r.error, {
          errorName: r.errorName,
          processType: "renderer",
          showDialog: !!r.showDialog
        });
        return;
      }
      let e = r.level;
      this.allowUnknownLevel || (e = this.levels.includes(r.level) ? r.level : "info");
      const n = {
        date: /* @__PURE__ */ new Date(),
        logId: this.logId,
        ...r,
        level: e,
        variables: {
          ...this.variables,
          ...r.variables
        }
      };
      for (const [a, u] of this.transportEntries(t))
        if (!(typeof u != "function" || u.level === !1) && this.compareLevels(u.level, r.level))
          try {
            const f = this.hooks.reduce((p, h) => p && h(p, u, a), n);
            f && u({ ...f, data: [...f.data] });
          } catch (f) {
            this.processInternalErrorFn(f);
          }
    }
    processInternalErrorFn(r) {
    }
    transportEntries(r = this.transports) {
      return (Array.isArray(r) ? r : Object.entries(r)).map((e) => {
        switch (typeof e) {
          case "string":
            return this.transports[e] ? [e, this.transports[e]] : null;
          case "function":
            return [e.name, e];
          default:
            return Array.isArray(e) ? e : null;
        }
      }).filter(Boolean);
    }
  };
  d(s, "instances", {});
  let o = s;
  return z = o, z;
}
var W, be;
function Ot() {
  if (be) return W;
  be = 1;
  const l = console.error;
  class c {
    constructor({ logFn: s = null } = {}) {
      d(this, "logFn", null);
      d(this, "onError", null);
      d(this, "showDialog", !1);
      d(this, "preventDefault", !0);
      this.handleError = this.handleError.bind(this), this.handleRejection = this.handleRejection.bind(this), this.startCatching = this.startCatching.bind(this), this.logFn = s;
    }
    handle(s, {
      logFn: i = this.logFn,
      errorName: r = "",
      onError: t = this.onError,
      showDialog: e = this.showDialog
    } = {}) {
      try {
        (t == null ? void 0 : t({ error: s, errorName: r, processType: "renderer" })) !== !1 && i({ error: s, errorName: r, showDialog: e });
      } catch {
        l(s);
      }
    }
    setOptions({ logFn: s, onError: i, preventDefault: r, showDialog: t }) {
      typeof s == "function" && (this.logFn = s), typeof i == "function" && (this.onError = i), typeof r == "boolean" && (this.preventDefault = r), typeof t == "boolean" && (this.showDialog = t);
    }
    startCatching({ onError: s, showDialog: i } = {}) {
      this.isActive || (this.isActive = !0, this.setOptions({ onError: s, showDialog: i }), window.addEventListener("error", (r) => {
        var t;
        this.preventDefault && ((t = r.preventDefault) == null || t.call(r)), this.handleError(r.error || r);
      }), window.addEventListener("unhandledrejection", (r) => {
        var t;
        this.preventDefault && ((t = r.preventDefault) == null || t.call(r)), this.handleRejection(r.reason || r);
      }));
    }
    handleError(s) {
      this.handle(s, { errorName: "Unhandled" });
    }
    handleRejection(s) {
      const i = s instanceof Error ? s : new Error(JSON.stringify(s));
      this.handle(i, { errorName: "Unhandled rejection" });
    }
  }
  return W = c, W;
}
var U, Se;
function L() {
  if (Se) return U;
  Se = 1, U = { transform: l };
  function l({
    logger: c,
    message: o,
    transport: s,
    initialData: i = (o == null ? void 0 : o.data) || [],
    transforms: r = s == null ? void 0 : s.transforms
  }) {
    return r.reduce((t, e) => typeof e == "function" ? e({ data: t, logger: c, message: o, transport: s }) : t, i);
  }
  return U;
}
var B, Ee;
function Lt() {
  if (Ee) return B;
  Ee = 1;
  const { transform: l } = L();
  B = o;
  const c = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    verbose: console.info,
    debug: console.debug,
    silly: console.debug,
    log: console.log
  };
  function o(i) {
    return Object.assign(r, {
      format: "{h}:{i}:{s}.{ms}{scope} › {text}",
      transforms: [s],
      writeFn({ message: { level: t, data: e } }) {
        const n = c[t] || c.info;
        setTimeout(() => n(...e));
      }
    });
    function r(t) {
      r.writeFn({
        message: { ...t, data: l({ logger: i, message: t, transport: r }) }
      });
    }
  }
  function s({
    data: i = [],
    logger: r = {},
    message: t = {},
    transport: e = {}
  }) {
    if (typeof e.format == "function")
      return e.format({
        data: i,
        level: (t == null ? void 0 : t.level) || "info",
        logger: r,
        message: t,
        transport: e
      });
    if (typeof e.format != "string")
      return i;
    i.unshift(e.format), typeof i[1] == "string" && i[1].match(/%[1cdfiOos]/) && (i = [`${i[0]}${i[1]}`, ...i.slice(2)]);
    const n = t.date || /* @__PURE__ */ new Date();
    return i[0] = i[0].replace(/\{(\w+)}/g, (a, u) => {
      var f, p;
      switch (u) {
        case "level":
          return t.level;
        case "logId":
          return t.logId;
        case "scope": {
          const h = t.scope || ((f = r.scope) == null ? void 0 : f.defaultLabel);
          return h ? ` (${h})` : "";
        }
        case "text":
          return "";
        case "y":
          return n.getFullYear().toString(10);
        case "m":
          return (n.getMonth() + 1).toString(10).padStart(2, "0");
        case "d":
          return n.getDate().toString(10).padStart(2, "0");
        case "h":
          return n.getHours().toString(10).padStart(2, "0");
        case "i":
          return n.getMinutes().toString(10).padStart(2, "0");
        case "s":
          return n.getSeconds().toString(10).padStart(2, "0");
        case "ms":
          return n.getMilliseconds().toString(10).padStart(3, "0");
        case "iso":
          return n.toISOString();
        default:
          return ((p = t.variables) == null ? void 0 : p[u]) || a;
      }
    }).trim(), i;
  }
  return B;
}
var J, Ae;
function Pt() {
  if (Ae) return J;
  Ae = 1;
  const { transform: l } = L();
  J = o;
  const c = /* @__PURE__ */ new Set([Promise, WeakMap, WeakSet]);
  function o(r) {
    return Object.assign(t, {
      depth: 5,
      transforms: [i]
    });
    function t(e) {
      if (!window.__electronLog) {
        r.processMessage(
          {
            data: ["electron-log: logger isn't initialized in the main process"],
            level: "error"
          },
          { transports: ["console"] }
        );
        return;
      }
      try {
        const n = l({
          initialData: e,
          logger: r,
          message: e,
          transport: t
        });
        __electronLog.sendToMain(n);
      } catch (n) {
        r.transports.console({
          data: ["electronLog.transports.ipc", n, "data:", e.data],
          level: "error"
        });
      }
    }
  }
  function s(r) {
    return Object(r) !== r;
  }
  function i({
    data: r,
    depth: t,
    seen: e = /* @__PURE__ */ new WeakSet(),
    transport: n = {}
  } = {}) {
    const a = t || n.depth || 5;
    return e.has(r) ? "[Circular]" : a < 1 ? s(r) ? r : Array.isArray(r) ? "[Array]" : `[${typeof r}]` : ["function", "symbol"].includes(typeof r) ? r.toString() : s(r) ? r : c.has(r.constructor) ? `[${r.constructor.name}]` : Array.isArray(r) ? r.map((u) => i({
      data: u,
      depth: a - 1,
      seen: e
    })) : r instanceof Date ? r.toISOString() : r instanceof Error ? r.stack : r instanceof Map ? new Map(
      Array.from(r).map(([u, f]) => [
        i({ data: u, depth: a - 1, seen: e }),
        i({ data: f, depth: a - 1, seen: e })
      ])
    ) : r instanceof Set ? new Set(
      Array.from(r).map(
        (u) => i({ data: u, depth: a - 1, seen: e })
      )
    ) : (e.add(r), Object.fromEntries(
      Object.entries(r).map(
        ([u, f]) => [
          u,
          i({ data: f, depth: a - 1, seen: e })
        ]
      )
    ));
  }
  return J;
}
var Oe;
function Ft() {
  return Oe || (Oe = 1, function(l) {
    const c = Qe(), o = Ot(), s = Lt(), i = Pt();
    typeof process == "object" && process.type === "browser" && console.warn(
      "electron-log/renderer is loaded in the main process. It could cause unexpected behaviour."
    ), l.exports = r(), l.exports.Logger = c, l.exports.default = l.exports;
    function r() {
      const t = new c({
        allowUnknownLevel: !0,
        errorHandler: new o(),
        initializeFn: () => {
        },
        logId: "default",
        transportFactories: {
          console: s,
          ipc: i
        },
        variables: {
          processType: "renderer"
        }
      });
      return t.errorHandler.setOptions({
        logFn({ error: e, errorName: n, showDialog: a }) {
          t.transports.console({
            data: [n, e].filter(Boolean),
            level: "error"
          }), t.transports.ipc({
            cmd: "errorHandler",
            error: {
              cause: e == null ? void 0 : e.cause,
              code: e == null ? void 0 : e.code,
              name: e == null ? void 0 : e.name,
              message: e == null ? void 0 : e.message,
              stack: e == null ? void 0 : e.stack
            },
            errorName: n,
            logId: t.logId,
            showDialog: a
          });
        }
      }), typeof window == "object" && window.addEventListener("message", (e) => {
        const { cmd: n, logId: a, ...u } = e.data || {}, f = c.getInstance({ logId: a });
        n === "message" && f.processMessage(u, { transports: ["console"] });
      }), new Proxy(t, {
        get(e, n) {
          return typeof e[n] < "u" ? e[n] : (...a) => t.logData(a, { level: n });
        }
      });
    }
  }(I)), I.exports;
}
var V, Le;
function xt() {
  if (Le) return V;
  Le = 1;
  const l = D, c = C;
  V = {
    findAndReadPackageJson: o,
    tryReadJsonAt: s
  };
  function o() {
    return s(t()) || s(r()) || s(process.resourcesPath, "app.asar") || s(process.resourcesPath, "app") || s(process.cwd()) || { name: void 0, version: void 0 };
  }
  function s(...e) {
    if (e[0])
      try {
        const n = c.join(...e), a = i("package.json", n);
        if (!a)
          return;
        const u = JSON.parse(l.readFileSync(a, "utf8")), f = (u == null ? void 0 : u.productName) || (u == null ? void 0 : u.name);
        return !f || f.toLowerCase() === "electron" ? void 0 : f ? { name: f, version: u == null ? void 0 : u.version } : void 0;
      } catch {
        return;
      }
  }
  function i(e, n) {
    let a = n;
    for (; ; ) {
      const u = c.parse(a), f = u.root, p = u.dir;
      if (l.existsSync(c.join(a, e)))
        return c.resolve(c.join(a, e));
      if (a === f)
        return null;
      a = p;
    }
  }
  function r() {
    const e = process.argv.filter((a) => a.indexOf("--user-data-dir=") === 0);
    return e.length === 0 || typeof e[0] != "string" ? null : e[0].replace("--user-data-dir=", "");
  }
  function t() {
    var e;
    try {
      return (e = require.main) == null ? void 0 : e.filename;
    } catch {
      return;
    }
  }
  return V;
}
var H, Pe;
function Xe() {
  if (Pe) return H;
  Pe = 1;
  const l = ft, c = j, o = C, s = xt();
  class i {
    constructor() {
      d(this, "appName");
      d(this, "appPackageJson");
      d(this, "platform", process.platform);
    }
    getAppLogPath(t = this.getAppName()) {
      return this.platform === "darwin" ? o.join(this.getSystemPathHome(), "Library/Logs", t) : o.join(this.getAppUserDataPath(t), "logs");
    }
    getAppName() {
      var e;
      const t = this.appName || ((e = this.getAppPackageJson()) == null ? void 0 : e.name);
      if (!t)
        throw new Error(
          "electron-log can't determine the app name. It tried these methods:\n1. Use `electron.app.name`\n2. Use productName or name from the nearest package.json`\nYou can also set it through log.transports.file.setAppName()"
        );
      return t;
    }
    /**
     * @private
     * @returns {undefined}
     */
    getAppPackageJson() {
      return typeof this.appPackageJson != "object" && (this.appPackageJson = s.findAndReadPackageJson()), this.appPackageJson;
    }
    getAppUserDataPath(t = this.getAppName()) {
      return t ? o.join(this.getSystemPathAppData(), t) : void 0;
    }
    getAppVersion() {
      var t;
      return (t = this.getAppPackageJson()) == null ? void 0 : t.version;
    }
    getElectronLogPath() {
      return this.getAppLogPath();
    }
    getMacOsVersion() {
      const t = Number(c.release().split(".")[0]);
      return t <= 19 ? `10.${t - 4}` : t - 9;
    }
    /**
     * @protected
     * @returns {string}
     */
    getOsVersion() {
      let t = c.type().replace("_", " "), e = c.release();
      return t === "Darwin" && (t = "macOS", e = this.getMacOsVersion()), `${t} ${e}`;
    }
    /**
     * @return {PathVariables}
     */
    getPathVariables() {
      const t = this.getAppName(), e = this.getAppVersion(), n = this;
      return {
        appData: this.getSystemPathAppData(),
        appName: t,
        appVersion: e,
        get electronDefaultDir() {
          return n.getElectronLogPath();
        },
        home: this.getSystemPathHome(),
        libraryDefaultDir: this.getAppLogPath(t),
        libraryTemplate: this.getAppLogPath("{appName}"),
        temp: this.getSystemPathTemp(),
        userData: this.getAppUserDataPath(t)
      };
    }
    getSystemPathAppData() {
      const t = this.getSystemPathHome();
      switch (this.platform) {
        case "darwin":
          return o.join(t, "Library/Application Support");
        case "win32":
          return process.env.APPDATA || o.join(t, "AppData/Roaming");
        default:
          return process.env.XDG_CONFIG_HOME || o.join(t, ".config");
      }
    }
    getSystemPathHome() {
      var t;
      return ((t = c.homedir) == null ? void 0 : t.call(c)) || process.env.HOME;
    }
    getSystemPathTemp() {
      return c.tmpdir();
    }
    getVersions() {
      return {
        app: `${this.getAppName()} ${this.getAppVersion()}`,
        electron: void 0,
        os: this.getOsVersion()
      };
    }
    isDev() {
      return process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "1";
    }
    isElectron() {
      return !!process.versions.electron;
    }
    onAppEvent(t, e) {
    }
    onAppReady(t) {
      t();
    }
    onEveryWebContentsEvent(t, e) {
    }
    /**
     * Listen to async messages sent from opposite process
     * @param {string} channel
     * @param {function} listener
     */
    onIpc(t, e) {
    }
    onIpcInvoke(t, e) {
    }
    /**
     * @param {string} url
     * @param {Function} [logFunction]
     */
    openUrl(t, e = console.error) {
      const a = { darwin: "open", win32: "start", linux: "xdg-open" }[process.platform] || "xdg-open";
      l.exec(`${a} ${t}`, {}, (u) => {
        u && e(u);
      });
    }
    setAppName(t) {
      this.appName = t;
    }
    setPlatform(t) {
      this.platform = t;
    }
    setPreloadFileForSessions({
      filePath: t,
      // eslint-disable-line no-unused-vars
      includeFutureSession: e = !0,
      // eslint-disable-line no-unused-vars
      getSessions: n = () => []
      // eslint-disable-line no-unused-vars
    }) {
    }
    /**
     * Sent a message to opposite process
     * @param {string} channel
     * @param {any} message
     */
    sendIpc(t, e) {
    }
    showErrorBox(t, e) {
    }
  }
  return H = i, H;
}
var G, Fe;
function Ct() {
  if (Fe) return G;
  Fe = 1;
  const l = C, c = Xe();
  class o extends c {
    /**
     * @param {object} options
     * @param {typeof Electron} [options.electron]
     */
    constructor({ electron: r } = {}) {
      super();
      /**
       * @type {typeof Electron}
       */
      d(this, "electron");
      this.electron = r;
    }
    getAppName() {
      var t, e;
      let r;
      try {
        r = this.appName || ((t = this.electron.app) == null ? void 0 : t.name) || ((e = this.electron.app) == null ? void 0 : e.getName());
      } catch {
      }
      return r || super.getAppName();
    }
    getAppUserDataPath(r) {
      return this.getPath("userData") || super.getAppUserDataPath(r);
    }
    getAppVersion() {
      var t;
      let r;
      try {
        r = (t = this.electron.app) == null ? void 0 : t.getVersion();
      } catch {
      }
      return r || super.getAppVersion();
    }
    getElectronLogPath() {
      return this.getPath("logs") || super.getElectronLogPath();
    }
    /**
     * @private
     * @param {any} name
     * @returns {string|undefined}
     */
    getPath(r) {
      var t;
      try {
        return (t = this.electron.app) == null ? void 0 : t.getPath(r);
      } catch {
        return;
      }
    }
    getVersions() {
      return {
        app: `${this.getAppName()} ${this.getAppVersion()}`,
        electron: `Electron ${process.versions.electron}`,
        os: this.getOsVersion()
      };
    }
    getSystemPathAppData() {
      return this.getPath("appData") || super.getSystemPathAppData();
    }
    isDev() {
      var r;
      return ((r = this.electron.app) == null ? void 0 : r.isPackaged) !== void 0 ? !this.electron.app.isPackaged : typeof process.execPath == "string" ? l.basename(process.execPath).toLowerCase().startsWith("electron") : super.isDev();
    }
    onAppEvent(r, t) {
      var e;
      return (e = this.electron.app) == null || e.on(r, t), () => {
        var n;
        (n = this.electron.app) == null || n.off(r, t);
      };
    }
    onAppReady(r) {
      var t, e, n;
      (t = this.electron.app) != null && t.isReady() ? r() : (e = this.electron.app) != null && e.once ? (n = this.electron.app) == null || n.once("ready", r) : r();
    }
    onEveryWebContentsEvent(r, t) {
      var n, a, u;
      return (a = (n = this.electron.webContents) == null ? void 0 : n.getAllWebContents()) == null || a.forEach((f) => {
        f.on(r, t);
      }), (u = this.electron.app) == null || u.on("web-contents-created", e), () => {
        var f, p;
        (f = this.electron.webContents) == null || f.getAllWebContents().forEach((h) => {
          h.off(r, t);
        }), (p = this.electron.app) == null || p.off("web-contents-created", e);
      };
      function e(f, p) {
        p.on(r, t);
      }
    }
    /**
     * Listen to async messages sent from opposite process
     * @param {string} channel
     * @param {function} listener
     */
    onIpc(r, t) {
      var e;
      (e = this.electron.ipcMain) == null || e.on(r, t);
    }
    onIpcInvoke(r, t) {
      var e, n;
      (n = (e = this.electron.ipcMain) == null ? void 0 : e.handle) == null || n.call(e, r, t);
    }
    /**
     * @param {string} url
     * @param {Function} [logFunction]
     */
    openUrl(r, t = console.error) {
      var e;
      (e = this.electron.shell) == null || e.openExternal(r).catch(t);
    }
    setPreloadFileForSessions({
      filePath: r,
      includeFutureSession: t = !0,
      getSessions: e = () => {
        var n;
        return [(n = this.electron.session) == null ? void 0 : n.defaultSession];
      }
    }) {
      for (const a of e().filter(Boolean))
        n(a);
      t && this.onAppEvent("session-created", (a) => {
        n(a);
      });
      function n(a) {
        typeof a.registerPreloadScript == "function" ? a.registerPreloadScript({
          filePath: r,
          id: "electron-log-preload",
          type: "frame"
        }) : a.setPreloads([...a.getPreloads(), r]);
      }
    }
    /**
     * Sent a message to opposite process
     * @param {string} channel
     * @param {any} message
     */
    sendIpc(r, t) {
      var e, n;
      (n = (e = this.electron.BrowserWindow) == null ? void 0 : e.getAllWindows()) == null || n.forEach((a) => {
        var u, f;
        ((u = a.webContents) == null ? void 0 : u.isDestroyed()) === !1 && ((f = a.webContents) == null ? void 0 : f.isCrashed()) === !1 && a.webContents.send(r, t);
      });
    }
    showErrorBox(r, t) {
      var e;
      (e = this.electron.dialog) == null || e.showErrorBox(r, t);
    }
  }
  return G = o, G;
}
var Y, xe;
function $t() {
  if (xe) return Y;
  xe = 1;
  const l = D, c = j, o = C, s = Ye();
  let i = !1, r = !1;
  Y = {
    initialize({
      externalApi: n,
      getSessions: a,
      includeFutureSession: u,
      logger: f,
      preload: p = !0,
      spyRendererConsole: h = !1
    }) {
      n.onAppReady(() => {
        try {
          p && t({
            externalApi: n,
            getSessions: a,
            includeFutureSession: u,
            logger: f,
            preloadOption: p
          }), h && e({ externalApi: n, logger: f });
        } catch (b) {
          f.warn(b);
        }
      });
    }
  };
  function t({
    externalApi: n,
    getSessions: a,
    includeFutureSession: u,
    logger: f,
    preloadOption: p
  }) {
    let h = typeof p == "string" ? p : void 0;
    if (i) {
      f.warn(new Error("log.initialize({ preload }) already called").stack);
      return;
    }
    i = !0;
    try {
      h = o.resolve(
        __dirname,
        "../renderer/electron-log-preload.js"
      );
    } catch {
    }
    if (!h || !l.existsSync(h)) {
      h = o.join(
        n.getAppUserDataPath() || c.tmpdir(),
        "electron-log-preload.js"
      );
      const b = `
      try {
        (${s.toString()})(require('electron'));
      } catch(e) {
        console.error(e);
      }
    `;
      l.writeFileSync(h, b, "utf8");
    }
    n.setPreloadFileForSessions({
      filePath: h,
      includeFutureSession: u,
      getSessions: a
    });
  }
  function e({ externalApi: n, logger: a }) {
    if (r) {
      a.warn(
        new Error("log.initialize({ spyRendererConsole }) already called").stack
      );
      return;
    }
    r = !0;
    const u = ["debug", "info", "warn", "error"];
    n.onEveryWebContentsEvent(
      "console-message",
      (f, p, h) => {
        a.processMessage({
          data: [h],
          level: u[p],
          variables: { processType: "renderer" }
        });
      }
    );
  }
  return Y;
}
var Q, Ce;
function Dt() {
  if (Ce) return Q;
  Ce = 1;
  class l {
    constructor({
      externalApi: s,
      logFn: i = void 0,
      onError: r = void 0,
      showDialog: t = void 0
    } = {}) {
      d(this, "externalApi");
      d(this, "isActive", !1);
      d(this, "logFn");
      d(this, "onError");
      d(this, "showDialog", !0);
      this.createIssue = this.createIssue.bind(this), this.handleError = this.handleError.bind(this), this.handleRejection = this.handleRejection.bind(this), this.setOptions({ externalApi: s, logFn: i, onError: r, showDialog: t }), this.startCatching = this.startCatching.bind(this), this.stopCatching = this.stopCatching.bind(this);
    }
    handle(s, {
      logFn: i = this.logFn,
      onError: r = this.onError,
      processType: t = "browser",
      showDialog: e = this.showDialog,
      errorName: n = ""
    } = {}) {
      var a;
      s = c(s);
      try {
        if (typeof r == "function") {
          const u = ((a = this.externalApi) == null ? void 0 : a.getVersions()) || {}, f = this.createIssue;
          if (r({
            createIssue: f,
            error: s,
            errorName: n,
            processType: t,
            versions: u
          }) === !1)
            return;
        }
        n ? i(n, s) : i(s), e && !n.includes("rejection") && this.externalApi && this.externalApi.showErrorBox(
          `A JavaScript error occurred in the ${t} process`,
          s.stack
        );
      } catch {
        console.error(s);
      }
    }
    setOptions({ externalApi: s, logFn: i, onError: r, showDialog: t }) {
      typeof s == "object" && (this.externalApi = s), typeof i == "function" && (this.logFn = i), typeof r == "function" && (this.onError = r), typeof t == "boolean" && (this.showDialog = t);
    }
    startCatching({ onError: s, showDialog: i } = {}) {
      this.isActive || (this.isActive = !0, this.setOptions({ onError: s, showDialog: i }), process.on("uncaughtException", this.handleError), process.on("unhandledRejection", this.handleRejection));
    }
    stopCatching() {
      this.isActive = !1, process.removeListener("uncaughtException", this.handleError), process.removeListener("unhandledRejection", this.handleRejection);
    }
    createIssue(s, i) {
      var r;
      (r = this.externalApi) == null || r.openUrl(
        `${s}?${new URLSearchParams(i).toString()}`
      );
    }
    handleError(s) {
      this.handle(s, { errorName: "Unhandled" });
    }
    handleRejection(s) {
      const i = s instanceof Error ? s : new Error(JSON.stringify(s));
      this.handle(i, { errorName: "Unhandled rejection" });
    }
  }
  function c(o) {
    if (o instanceof Error)
      return o;
    if (o && typeof o == "object") {
      if (o.message)
        return Object.assign(new Error(o.message), o);
      try {
        return new Error(JSON.stringify(o));
      } catch (s) {
        return new Error(`Couldn't normalize error ${String(o)}: ${s}`);
      }
    }
    return new Error(`Can't normalize error ${String(o)}`);
  }
  return Q = l, Q;
}
var X, $e;
function Rt() {
  if ($e) return X;
  $e = 1;
  class l {
    constructor(o = {}) {
      d(this, "disposers", []);
      d(this, "format", "{eventSource}#{eventName}:");
      d(this, "formatters", {
        app: {
          "certificate-error": ({ args: o }) => this.arrayToObject(o.slice(1, 4), [
            "url",
            "error",
            "certificate"
          ]),
          "child-process-gone": ({ args: o }) => o.length === 1 ? o[0] : o,
          "render-process-gone": ({ args: [o, s] }) => s && typeof s == "object" ? { ...s, ...this.getWebContentsDetails(o) } : []
        },
        webContents: {
          "console-message": ({ args: [o, s, i, r] }) => {
            if (!(o < 3))
              return { message: s, source: `${r}:${i}` };
          },
          "did-fail-load": ({ args: o }) => this.arrayToObject(o, [
            "errorCode",
            "errorDescription",
            "validatedURL",
            "isMainFrame",
            "frameProcessId",
            "frameRoutingId"
          ]),
          "did-fail-provisional-load": ({ args: o }) => this.arrayToObject(o, [
            "errorCode",
            "errorDescription",
            "validatedURL",
            "isMainFrame",
            "frameProcessId",
            "frameRoutingId"
          ]),
          "plugin-crashed": ({ args: o }) => this.arrayToObject(o, ["name", "version"]),
          "preload-error": ({ args: o }) => this.arrayToObject(o, ["preloadPath", "error"])
        }
      });
      d(this, "events", {
        app: {
          "certificate-error": !0,
          "child-process-gone": !0,
          "render-process-gone": !0
        },
        webContents: {
          // 'console-message': true,
          "did-fail-load": !0,
          "did-fail-provisional-load": !0,
          "plugin-crashed": !0,
          "preload-error": !0,
          unresponsive: !0
        }
      });
      d(this, "externalApi");
      d(this, "level", "error");
      d(this, "scope", "");
      this.setOptions(o);
    }
    setOptions({
      events: o,
      externalApi: s,
      level: i,
      logger: r,
      format: t,
      formatters: e,
      scope: n
    }) {
      typeof o == "object" && (this.events = o), typeof s == "object" && (this.externalApi = s), typeof i == "string" && (this.level = i), typeof r == "object" && (this.logger = r), (typeof t == "string" || typeof t == "function") && (this.format = t), typeof e == "object" && (this.formatters = e), typeof n == "string" && (this.scope = n);
    }
    startLogging(o = {}) {
      this.setOptions(o), this.disposeListeners();
      for (const s of this.getEventNames(this.events.app))
        this.disposers.push(
          this.externalApi.onAppEvent(s, (...i) => {
            this.handleEvent({ eventSource: "app", eventName: s, handlerArgs: i });
          })
        );
      for (const s of this.getEventNames(this.events.webContents))
        this.disposers.push(
          this.externalApi.onEveryWebContentsEvent(
            s,
            (...i) => {
              this.handleEvent(
                { eventSource: "webContents", eventName: s, handlerArgs: i }
              );
            }
          )
        );
    }
    stopLogging() {
      this.disposeListeners();
    }
    arrayToObject(o, s) {
      const i = {};
      return s.forEach((r, t) => {
        i[r] = o[t];
      }), o.length > s.length && (i.unknownArgs = o.slice(s.length)), i;
    }
    disposeListeners() {
      this.disposers.forEach((o) => o()), this.disposers = [];
    }
    formatEventLog({ eventName: o, eventSource: s, handlerArgs: i }) {
      var f;
      const [r, ...t] = i;
      if (typeof this.format == "function")
        return this.format({ args: t, event: r, eventName: o, eventSource: s });
      const e = (f = this.formatters[s]) == null ? void 0 : f[o];
      let n = t;
      if (typeof e == "function" && (n = e({ args: t, event: r, eventName: o, eventSource: s })), !n)
        return;
      const a = {};
      return Array.isArray(n) ? a.args = n : typeof n == "object" && Object.assign(a, n), s === "webContents" && Object.assign(a, this.getWebContentsDetails(r == null ? void 0 : r.sender)), [this.format.replace("{eventSource}", s === "app" ? "App" : "WebContents").replace("{eventName}", o), a];
    }
    getEventNames(o) {
      return !o || typeof o != "object" ? [] : Object.entries(o).filter(([s, i]) => i).map(([s]) => s);
    }
    getWebContentsDetails(o) {
      if (!(o != null && o.loadURL))
        return {};
      try {
        return {
          webContents: {
            id: o.id,
            url: o.getURL()
          }
        };
      } catch {
        return {};
      }
    }
    handleEvent({ eventName: o, eventSource: s, handlerArgs: i }) {
      var t;
      const r = this.formatEventLog({ eventName: o, eventSource: s, handlerArgs: i });
      if (r) {
        const e = this.scope ? this.logger.scope(this.scope) : this.logger;
        (t = e == null ? void 0 : e[this.level]) == null || t.call(e, ...r);
      }
    }
  }
  return X = l, X;
}
var Z, De;
function Ze() {
  if (De) return Z;
  De = 1;
  const { transform: l } = L();
  Z = {
    concatFirstStringElements: c,
    formatScope: s,
    formatText: r,
    formatVariables: i,
    timeZoneFromOffset: o,
    format({ message: t, logger: e, transport: n, data: a = t == null ? void 0 : t.data }) {
      switch (typeof n.format) {
        case "string":
          return l({
            message: t,
            logger: e,
            transforms: [i, s, r],
            transport: n,
            initialData: [n.format, ...a]
          });
        case "function":
          return n.format({
            data: a,
            level: (t == null ? void 0 : t.level) || "info",
            logger: e,
            message: t,
            transport: n
          });
        default:
          return a;
      }
    }
  };
  function c({ data: t }) {
    return typeof t[0] != "string" || typeof t[1] != "string" || t[0].match(/%[1cdfiOos]/) ? t : [`${t[0]} ${t[1]}`, ...t.slice(2)];
  }
  function o(t) {
    const e = Math.abs(t), n = t > 0 ? "-" : "+", a = Math.floor(e / 60).toString().padStart(2, "0"), u = (e % 60).toString().padStart(2, "0");
    return `${n}${a}:${u}`;
  }
  function s({ data: t, logger: e, message: n }) {
    const { defaultLabel: a, labelLength: u } = (e == null ? void 0 : e.scope) || {}, f = t[0];
    let p = n.scope;
    p || (p = a);
    let h;
    return p === "" ? h = u > 0 ? "".padEnd(u + 3) : "" : typeof p == "string" ? h = ` (${p})`.padEnd(u + 3) : h = "", t[0] = f.replace("{scope}", h), t;
  }
  function i({ data: t, message: e }) {
    let n = t[0];
    if (typeof n != "string")
      return t;
    n = n.replace("{level}]", `${e.level}]`.padEnd(6, " "));
    const a = e.date || /* @__PURE__ */ new Date();
    return t[0] = n.replace(/\{(\w+)}/g, (u, f) => {
      var p;
      switch (f) {
        case "level":
          return e.level || "info";
        case "logId":
          return e.logId;
        case "y":
          return a.getFullYear().toString(10);
        case "m":
          return (a.getMonth() + 1).toString(10).padStart(2, "0");
        case "d":
          return a.getDate().toString(10).padStart(2, "0");
        case "h":
          return a.getHours().toString(10).padStart(2, "0");
        case "i":
          return a.getMinutes().toString(10).padStart(2, "0");
        case "s":
          return a.getSeconds().toString(10).padStart(2, "0");
        case "ms":
          return a.getMilliseconds().toString(10).padStart(3, "0");
        case "z":
          return o(a.getTimezoneOffset());
        case "iso":
          return a.toISOString();
        default:
          return ((p = e.variables) == null ? void 0 : p[f]) || u;
      }
    }).trim(), t;
  }
  function r({ data: t }) {
    const e = t[0];
    if (typeof e != "string")
      return t;
    if (e.lastIndexOf("{text}") === e.length - 6)
      return t[0] = e.replace(/\s?{text}/, ""), t[0] === "" && t.shift(), t;
    const a = e.split("{text}");
    let u = [];
    return a[0] !== "" && u.push(a[0]), u = u.concat(t.slice(1)), a[1] !== "" && u.push(a[1]), u;
  }
  return Z;
}
var K = { exports: {} }, Re;
function _() {
  return Re || (Re = 1, function(l) {
    const c = pt;
    l.exports = {
      serialize: s,
      maxDepth({ data: i, transport: r, depth: t = (r == null ? void 0 : r.depth) ?? 6 }) {
        if (!i)
          return i;
        if (t < 1)
          return Array.isArray(i) ? "[array]" : typeof i == "object" && i ? "[object]" : i;
        if (Array.isArray(i))
          return i.map((n) => l.exports.maxDepth({
            data: n,
            depth: t - 1
          }));
        if (typeof i != "object" || i && typeof i.toISOString == "function")
          return i;
        if (i === null)
          return null;
        if (i instanceof Error)
          return i;
        const e = {};
        for (const n in i)
          Object.prototype.hasOwnProperty.call(i, n) && (e[n] = l.exports.maxDepth({
            data: i[n],
            depth: t - 1
          }));
        return e;
      },
      toJSON({ data: i }) {
        return JSON.parse(JSON.stringify(i, o()));
      },
      toString({ data: i, transport: r }) {
        const t = (r == null ? void 0 : r.inspectOptions) || {}, e = i.map((n) => {
          if (n !== void 0)
            try {
              const a = JSON.stringify(n, o(), "  ");
              return a === void 0 ? void 0 : JSON.parse(a);
            } catch {
              return n;
            }
        });
        return c.formatWithOptions(t, ...e);
      }
    };
    function o(i = {}) {
      const r = /* @__PURE__ */ new WeakSet();
      return function(t, e) {
        if (typeof e == "object" && e !== null) {
          if (r.has(e))
            return;
          r.add(e);
        }
        return s(t, e, i);
      };
    }
    function s(i, r, t = {}) {
      const e = (t == null ? void 0 : t.serializeMapAndSet) !== !1;
      return r instanceof Error ? r.stack : r && (typeof r == "function" ? `[function] ${r.toString()}` : r instanceof Date ? r.toISOString() : e && r instanceof Map && Object.fromEntries ? Object.fromEntries(r) : e && r instanceof Set && Array.from ? Array.from(r) : r);
    }
  }(K)), K.exports;
}
var ee, ke;
function pe() {
  if (ke) return ee;
  ke = 1, ee = {
    transformStyles: s,
    applyAnsiStyles({ data: i }) {
      return s(i, c, o);
    },
    removeStyles({ data: i }) {
      return s(i, () => "");
    }
  };
  const l = {
    unset: "\x1B[0m",
    black: "\x1B[30m",
    red: "\x1B[31m",
    green: "\x1B[32m",
    yellow: "\x1B[33m",
    blue: "\x1B[34m",
    magenta: "\x1B[35m",
    cyan: "\x1B[36m",
    white: "\x1B[37m",
    gray: "\x1B[90m"
  };
  function c(i) {
    const r = i.replace(/color:\s*(\w+).*/, "$1").toLowerCase();
    return l[r] || "";
  }
  function o(i) {
    return i + l.unset;
  }
  function s(i, r, t) {
    const e = {};
    return i.reduce((n, a, u, f) => {
      if (e[u])
        return n;
      if (typeof a == "string") {
        let p = u, h = !1;
        a = a.replace(/%[1cdfiOos]/g, (b) => {
          if (p += 1, b !== "%c")
            return b;
          const y = f[p];
          return typeof y == "string" ? (e[p] = !0, h = !0, r(y, a)) : b;
        }), h && t && (a = t(a));
      }
      return n.push(a), n;
    }, []);
  }
  return ee;
}
var te, je;
function kt() {
  if (je) return te;
  je = 1;
  const {
    concatFirstStringElements: l,
    format: c
  } = Ze(), { maxDepth: o, toJSON: s } = _(), {
    applyAnsiStyles: i,
    removeStyles: r
  } = pe(), { transform: t } = L(), e = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    verbose: console.info,
    debug: console.debug,
    silly: console.debug,
    log: console.log
  };
  te = u;
  const a = `%c{h}:{i}:{s}.{ms}{scope}%c ${process.platform === "win32" ? ">" : "›"} {text}`;
  Object.assign(u, {
    DEFAULT_FORMAT: a
  });
  function u(y) {
    return Object.assign(g, {
      colorMap: {
        error: "red",
        warn: "yellow",
        info: "cyan",
        verbose: "unset",
        debug: "gray",
        silly: "gray",
        default: "unset"
      },
      format: a,
      level: "silly",
      transforms: [
        f,
        c,
        h,
        l,
        o,
        s
      ],
      useStyles: process.env.FORCE_STYLES,
      writeFn({ message: w }) {
        (e[w.level] || e.info)(...w.data);
      }
    });
    function g(w) {
      const S = t({ logger: y, message: w, transport: g });
      g.writeFn({
        message: { ...w, data: S }
      });
    }
  }
  function f({ data: y, message: g, transport: w }) {
    return typeof w.format != "string" || !w.format.includes("%c") ? y : [
      `color:${b(g.level, w)}`,
      "color:unset",
      ...y
    ];
  }
  function p(y, g) {
    if (typeof y == "boolean")
      return y;
    const S = g === "error" || g === "warn" ? process.stderr : process.stdout;
    return S && S.isTTY;
  }
  function h(y) {
    const { message: g, transport: w } = y;
    return (p(w.useStyles, g.level) ? i : r)(y);
  }
  function b(y, g) {
    return g.colorMap[y] || g.colorMap.default;
  }
  return te;
}
var re, _e;
function Ke() {
  if (_e) return re;
  _e = 1;
  const l = Ve, c = D, o = j;
  class s extends l {
    constructor({
      path: e,
      writeOptions: n = { encoding: "utf8", flag: "a", mode: 438 },
      writeAsync: a = !1
    }) {
      super();
      d(this, "asyncWriteQueue", []);
      d(this, "bytesWritten", 0);
      d(this, "hasActiveAsyncWriting", !1);
      d(this, "path", null);
      d(this, "initialSize");
      d(this, "writeOptions", null);
      d(this, "writeAsync", !1);
      this.path = e, this.writeOptions = n, this.writeAsync = a;
    }
    get size() {
      return this.getSize();
    }
    clear() {
      try {
        return c.writeFileSync(this.path, "", {
          mode: this.writeOptions.mode,
          flag: "w"
        }), this.reset(), !0;
      } catch (e) {
        return e.code === "ENOENT" ? !0 : (this.emit("error", e, this), !1);
      }
    }
    crop(e) {
      try {
        const n = i(this.path, e || 4096);
        this.clear(), this.writeLine(`[log cropped]${o.EOL}${n}`);
      } catch (n) {
        this.emit(
          "error",
          new Error(`Couldn't crop file ${this.path}. ${n.message}`),
          this
        );
      }
    }
    getSize() {
      if (this.initialSize === void 0)
        try {
          const e = c.statSync(this.path);
          this.initialSize = e.size;
        } catch {
          this.initialSize = 0;
        }
      return this.initialSize + this.bytesWritten;
    }
    increaseBytesWrittenCounter(e) {
      this.bytesWritten += Buffer.byteLength(e, this.writeOptions.encoding);
    }
    isNull() {
      return !1;
    }
    nextAsyncWrite() {
      const e = this;
      if (this.hasActiveAsyncWriting || this.asyncWriteQueue.length === 0)
        return;
      const n = this.asyncWriteQueue.join("");
      this.asyncWriteQueue = [], this.hasActiveAsyncWriting = !0, c.writeFile(this.path, n, this.writeOptions, (a) => {
        e.hasActiveAsyncWriting = !1, a ? e.emit(
          "error",
          new Error(`Couldn't write to ${e.path}. ${a.message}`),
          this
        ) : e.increaseBytesWrittenCounter(n), e.nextAsyncWrite();
      });
    }
    reset() {
      this.initialSize = void 0, this.bytesWritten = 0;
    }
    toString() {
      return this.path;
    }
    writeLine(e) {
      if (e += o.EOL, this.writeAsync) {
        this.asyncWriteQueue.push(e), this.nextAsyncWrite();
        return;
      }
      try {
        c.writeFileSync(this.path, e, this.writeOptions), this.increaseBytesWrittenCounter(e);
      } catch (n) {
        this.emit(
          "error",
          new Error(`Couldn't write to ${this.path}. ${n.message}`),
          this
        );
      }
    }
  }
  re = s;
  function i(r, t) {
    const e = Buffer.alloc(t), n = c.statSync(r), a = Math.min(n.size, t), u = Math.max(0, n.size - t), f = c.openSync(r, "r"), p = c.readSync(f, e, 0, a, u);
    return c.closeSync(f), e.toString("utf8", 0, p);
  }
  return re;
}
var ne, Te;
function jt() {
  if (Te) return ne;
  Te = 1;
  const l = Ke();
  class c extends l {
    clear() {
    }
    crop() {
    }
    getSize() {
      return 0;
    }
    isNull() {
      return !0;
    }
    writeLine() {
    }
  }
  return ne = c, ne;
}
var oe, Ne;
function _t() {
  if (Ne) return oe;
  Ne = 1;
  const l = Ve, c = D, o = C, s = Ke(), i = jt();
  class r extends l {
    constructor() {
      super();
      d(this, "store", {});
      this.emitError = this.emitError.bind(this);
    }
    /**
     * Provide a File object corresponding to the filePath
     * @param {string} filePath
     * @param {WriteOptions} [writeOptions]
     * @param {boolean} [writeAsync]
     * @return {File}
     */
    provide({ filePath: n, writeOptions: a = {}, writeAsync: u = !1 }) {
      let f;
      try {
        if (n = o.resolve(n), this.store[n])
          return this.store[n];
        f = this.createFile({ filePath: n, writeOptions: a, writeAsync: u });
      } catch (p) {
        f = new i({ path: n }), this.emitError(p, f);
      }
      return f.on("error", this.emitError), this.store[n] = f, f;
    }
    /**
     * @param {string} filePath
     * @param {WriteOptions} writeOptions
     * @param {boolean} async
     * @return {File}
     * @private
     */
    createFile({ filePath: n, writeOptions: a, writeAsync: u }) {
      return this.testFileWriting({ filePath: n, writeOptions: a }), new s({ path: n, writeOptions: a, writeAsync: u });
    }
    /**
     * @param {Error} error
     * @param {File} file
     * @private
     */
    emitError(n, a) {
      this.emit("error", n, a);
    }
    /**
     * @param {string} filePath
     * @param {WriteOptions} writeOptions
     * @private
     */
    testFileWriting({ filePath: n, writeOptions: a }) {
      c.mkdirSync(o.dirname(n), { recursive: !0 }), c.writeFileSync(n, "", { flag: "a", mode: a.mode });
    }
  }
  return oe = r, oe;
}
var se, Ie;
function Tt() {
  if (Ie) return se;
  Ie = 1;
  const l = D, c = j, o = C, s = _t(), { transform: i } = L(), { removeStyles: r } = pe(), {
    format: t,
    concatFirstStringElements: e
  } = Ze(), { toString: n } = _();
  se = u;
  const a = new s();
  function u(p, { registry: h = a, externalApi: b } = {}) {
    let y;
    return h.listenerCount("error") < 1 && h.on("error", (v, m) => {
      S(`Can't write to ${m}`, v);
    }), Object.assign(g, {
      fileName: f(p.variables.processType),
      format: "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}",
      getFile: T,
      inspectOptions: { depth: 5 },
      level: "silly",
      maxSize: 1024 ** 2,
      readAllLogs: nt,
      sync: !0,
      transforms: [r, t, e, n],
      writeOptions: { flag: "a", mode: 438, encoding: "utf8" },
      archiveLogFn(v) {
        const m = v.toString(), E = o.parse(m);
        try {
          l.renameSync(m, o.join(E.dir, `${E.name}.old${E.ext}`));
        } catch (P) {
          S("Could not rotate log", P);
          const ot = Math.round(g.maxSize / 4);
          v.crop(Math.min(ot, 256 * 1024));
        }
      },
      resolvePathFn(v) {
        return o.join(v.libraryDefaultDir, v.fileName);
      },
      setAppName(v) {
        p.dependencies.externalApi.setAppName(v);
      }
    });
    function g(v) {
      const m = T(v);
      g.maxSize > 0 && m.size > g.maxSize && (g.archiveLogFn(m), m.reset());
      const P = i({ logger: p, message: v, transport: g });
      m.writeLine(P);
    }
    function w() {
      y || (y = Object.create(
        Object.prototype,
        {
          ...Object.getOwnPropertyDescriptors(
            b.getPathVariables()
          ),
          fileName: {
            get() {
              return g.fileName;
            },
            enumerable: !0
          }
        }
      ), typeof g.archiveLog == "function" && (g.archiveLogFn = g.archiveLog, S("archiveLog is deprecated. Use archiveLogFn instead")), typeof g.resolvePath == "function" && (g.resolvePathFn = g.resolvePath, S("resolvePath is deprecated. Use resolvePathFn instead")));
    }
    function S(v, m = null, E = "error") {
      const P = [`electron-log.transports.file: ${v}`];
      m && P.push(m), p.transports.console({ data: P, date: /* @__PURE__ */ new Date(), level: E });
    }
    function T(v) {
      w();
      const m = g.resolvePathFn(y, v);
      return h.provide({
        filePath: m,
        writeAsync: !g.sync,
        writeOptions: g.writeOptions
      });
    }
    function nt({ fileFilter: v = (m) => m.endsWith(".log") } = {}) {
      w();
      const m = o.dirname(g.resolvePathFn(y));
      return l.existsSync(m) ? l.readdirSync(m).map((E) => o.join(m, E)).filter(v).map((E) => {
        try {
          return {
            path: E,
            lines: l.readFileSync(E, "utf8").split(c.EOL)
          };
        } catch {
          return null;
        }
      }).filter(Boolean) : [];
    }
  }
  function f(p = process.type) {
    switch (p) {
      case "renderer":
        return "renderer.log";
      case "worker":
        return "worker.log";
      default:
        return "main.log";
    }
  }
  return se;
}
var ie, Me;
function Nt() {
  if (Me) return ie;
  Me = 1;
  const { maxDepth: l, toJSON: c } = _(), { transform: o } = L();
  ie = s;
  function s(i, { externalApi: r }) {
    return Object.assign(t, {
      depth: 3,
      eventId: "__ELECTRON_LOG_IPC__",
      level: i.isDev ? "silly" : !1,
      transforms: [c, l]
    }), r != null && r.isElectron() ? t : void 0;
    function t(e) {
      var n;
      ((n = e == null ? void 0 : e.variables) == null ? void 0 : n.processType) !== "renderer" && (r == null || r.sendIpc(t.eventId, {
        ...e,
        data: o({ logger: i, message: e, transport: t })
      }));
    }
  }
  return ie;
}
var ae, qe;
function It() {
  if (qe) return ae;
  qe = 1;
  const l = ht, c = dt, { transform: o } = L(), { removeStyles: s } = pe(), { toJSON: i, maxDepth: r } = _();
  ae = t;
  function t(e) {
    return Object.assign(n, {
      client: { name: "electron-application" },
      depth: 6,
      level: !1,
      requestOptions: {},
      transforms: [s, i, r],
      makeBodyFn({ message: a }) {
        return JSON.stringify({
          client: n.client,
          data: a.data,
          date: a.date.getTime(),
          level: a.level,
          scope: a.scope,
          variables: a.variables
        });
      },
      processErrorFn({ error: a }) {
        e.processMessage(
          {
            data: [`electron-log: can't POST ${n.url}`, a],
            level: "warn"
          },
          { transports: ["console", "file"] }
        );
      },
      sendRequestFn({ serverUrl: a, requestOptions: u, body: f }) {
        const h = (a.startsWith("https:") ? c : l).request(a, {
          method: "POST",
          ...u,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": f.length,
            ...u.headers
          }
        });
        return h.write(f), h.end(), h;
      }
    });
    function n(a) {
      if (!n.url)
        return;
      const u = n.makeBodyFn({
        logger: e,
        message: { ...a, data: o({ logger: e, message: a, transport: n }) },
        transport: n
      }), f = n.sendRequestFn({
        serverUrl: n.url,
        requestOptions: n.requestOptions,
        body: Buffer.from(u, "utf8")
      });
      f.on("error", (p) => n.processErrorFn({
        error: p,
        logger: e,
        message: a,
        request: f,
        transport: n
      }));
    }
  }
  return ae;
}
var ce, ze;
function et() {
  if (ze) return ce;
  ze = 1;
  const l = Qe(), c = Dt(), o = Rt(), s = kt(), i = Tt(), r = Nt(), t = It();
  ce = e;
  function e({ dependencies: n, initializeFn: a }) {
    var f;
    const u = new l({
      dependencies: n,
      errorHandler: new c(),
      eventLogger: new o(),
      initializeFn: a,
      isDev: (f = n.externalApi) == null ? void 0 : f.isDev(),
      logId: "default",
      transportFactories: {
        console: s,
        file: i,
        ipc: r,
        remote: t
      },
      variables: {
        processType: "main"
      }
    });
    return u.default = u, u.Logger = l, u.processInternalErrorFn = (p) => {
      u.transports.console.writeFn({
        message: {
          data: ["Unhandled electron-log error", p],
          level: "error"
        }
      });
    }, u;
  }
  return ce;
}
var le, We;
function Mt() {
  if (We) return le;
  We = 1;
  const l = at, c = Ct(), { initialize: o } = $t(), s = et(), i = new c({ electron: l }), r = s({
    dependencies: { externalApi: i },
    initializeFn: o
  });
  le = r, i.onIpc("__ELECTRON_LOG__", (e, n) => {
    n.scope && r.Logger.getInstance(n).scope(n.scope);
    const a = new Date(n.date);
    t({
      ...n,
      date: a.getTime() ? a : /* @__PURE__ */ new Date()
    });
  }), i.onIpcInvoke("__ELECTRON_LOG__", (e, { cmd: n = "", logId: a }) => {
    switch (n) {
      case "getOptions":
        return {
          levels: r.Logger.getInstance({ logId: a }).levels,
          logId: a
        };
      default:
        return t({ data: [`Unknown cmd '${n}'`], level: "error" }), {};
    }
  });
  function t(e) {
    var n;
    (n = r.Logger.getInstance(e)) == null || n.processMessage(e);
  }
  return le;
}
var ue, Ue;
function qt() {
  if (Ue) return ue;
  Ue = 1;
  const l = Xe(), c = et(), o = new l();
  return ue = c({
    dependencies: { externalApi: o }
  }), ue;
}
const zt = typeof process > "u" || process.type === "renderer" || process.type === "worker", Wt = typeof process == "object" && process.type === "browser";
zt ? (Ye(), k.exports = Ft()) : Wt ? k.exports = Mt() : k.exports = qt();
var Ut = k.exports;
const he = /* @__PURE__ */ St(Ut), tt = A.dirname(ct(import.meta.url));
he.transports.file.level = "info";
he.transports.file.fileName = "main.log";
Object.assign(console, he.functions);
process.env.APP_ROOT = A.join(tt, "..");
const fe = process.env.VITE_DEV_SERVER_URL, or = A.join(process.env.APP_ROOT, "dist-electron"), rt = A.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = fe ? A.join(process.env.APP_ROOT, "public") : rt;
let O;
function Be() {
  O = new Je({
    icon: A.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: A.join(tt, "preload.mjs")
    }
  }), process.platform === "darwin" && $.dock.setIcon(A.join(process.env.VITE_PUBLIC, "icon.png")), O.webContents.on("did-finish-load", () => {
    O == null || O.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), fe ? O.loadURL(fe) : O.loadFile(A.join(rt, "index.html"));
}
$.on("window-all-closed", () => {
  process.platform !== "darwin" && ($.quit(), O = null);
});
$.whenReady().then(() => {
  vt(), Be(), $.on("activate", () => {
    Je.getAllWindows().length === 0 && Be();
  });
});
export {
  or as MAIN_DIST,
  rt as RENDERER_DIST,
  fe as VITE_DEV_SERVER_URL
};
