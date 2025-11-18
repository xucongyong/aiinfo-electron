var it = Object.defineProperty;
var at = (l, c, s) => c in l ? it(l, c, { enumerable: !0, configurable: !0, writable: !0, value: s }) : l[c] = s;
var h = (l, c, s) => at(l, typeof c != "symbol" ? c + "" : c, s);
import ct, { ipcMain as F, app as j, BrowserWindow as Je } from "electron";
import { fileURLToPath as lt } from "node:url";
import O from "node:path";
import { firefox as ut } from "playwright-core";
import { launchOptions as ft } from "camoufox-js";
import x from "path";
import pt from "child_process";
import C from "os";
import R from "fs";
import ht from "util";
import Ve from "events";
import dt from "http";
import gt from "https";
const yt = "https://aiinfo-api.hackx.dpdns.org", de = async (l, c, s = {}) => {
  if (!c)
    throw new Error("未提供身份验证令牌 (token)");
  const i = {
    "Content-Type": "application/json",
    ...s.headers,
    Authorization: `Bearer ${c}`
  }, o = await fetch(`${yt}${l}`, {
    ...s,
    headers: i
  });
  if (!o.ok) {
    if (o.status === 401)
      throw new Error("身份验证失败 (Token 无效或已过期)");
    const r = await o.text();
    throw new Error(`API 请求失败: ${o.status} - ${r}`);
  }
  return o.json();
}, He = {
  /**
   * 获取单个浏览器配置
   * @param {string} browserId 
   * @param {string} token 
   * @returns {Promise<object | null>}
   */
  getBrowserProfile: async (l, c) => {
    try {
      return (await de("/api/browsers", c, { method: "GET" })).data.find((i) => i.browser_id === l) || null;
    } catch (s) {
      throw console.error(`[MainApiClient] 获取 ${l} 配置失败:`, s.message), s;
    }
  },
  /**
   * 更新浏览器 Cookie
   * @param {string} browserId 
   * @param {Array} cookies 
   * @param {string} token 
   * @returns {Promise<object>}
   */
  updateBrowserCookies: async (l, c, s) => {
    try {
      console.log(`[MainApiClient] 正在为 ${l} 保存 ${c.length} 个 Cookie...`);
      const i = await de(`/api/browsers?browser_id=${l}`, s, {
        method: "PUT",
        body: JSON.stringify({
          cookies: JSON.stringify(c)
          // 确保后端接收的是字符串
        })
      });
      return console.log(`[MainApiClient] ✅ 成功为 ${l} 保存 Cookie。`), i;
    } catch (i) {
      throw console.error(`[MainApiClient] ❌ 为 ${l} 保存 Cookie 时出错:`, i.message), i;
    }
  }
}, D = /* @__PURE__ */ new Map();
let $ = null;
var ge = [];
function mt() {
  F.on("auth:set-token", (l, c) => {
    console.log("[Main] 成功接收并存储了 Auth Token"), $ = c;
  }), F.on("auth:clear-token", () => {
    console.log("[Main] 已清除 Auth Token (用户登出)"), $ = null;
  }), F.handle("browser:launch", async (l, c) => {
    if (console.log("[主进程] 收到浏览器启动请求:", { browserId: c }), !$)
      return console.error("[主进程] 启动失败: 主进程未收到认证 Token。"), { success: !1, error: "主进程未认证，请重新登录。" };
    try {
      return await ye(c, $);
    } catch (s) {
      return console.error("[主进程] 浏览器启动异常:", s), { success: !1, error: `主进程异常: ${s.message}` };
    }
  }), F.handle("browser:close", async (l, c) => {
    try {
      return await vt(c);
    } catch (s) {
      return console.error("[主进程] 浏览器关闭异常:", s), { success: !1, error: `主进程异常: ${s.message}` };
    }
  }), F.handle("browser:getRunningInstances", async () => {
    try {
      return wt();
    } catch (l) {
      return console.error("[主进程] 获取运行实例异常:", l), { success: !1, error: `主进程异常: ${l.message}` };
    }
  }), F.handle("playwright:launch", async (l, c) => await ye((c == null ? void 0 : c.browserId) || Date.now().toString(), null));
}
const ye = async (l, c = null) => {
  let s;
  try {
    var i = {};
    try {
      if (!c) throw new Error("Token is null in playwrightManager");
      const n = await He.getBrowserProfile(l, c);
      i = JSON.parse(n.launch_config), console.log(i);
    } catch (n) {
      throw console.error("JSON 解析失败！原始值:", n.configValue), console.error("解析错误详情:", n.message), n;
    }
    s = await ut.launch({
      ...await ft({
        /* Camoufox options */
      }),
      headless: !1,
      proxy: {
        server: i.proxy
      }
    });
    var o = await s.newContext();
    ge.length > 0 && (await o.addCookies(ge), console.log("[主进程] 注入 Cookie 完成。"));
    const r = {
      browser: s,
      // 存储浏览器实例
      context: o,
      // 存储上下文实例
      startTime: /* @__PURE__ */ new Date(),
      accountId: l,
      token: c,
      saveInterval: null
      // 稍后赋值
    };
    await (await o.newPage()).goto("https://abrahamjuliot.github.io/creepjs/", {
      waitUntil: "domcontentloaded",
      timeout: 3e4
    }), D.set(l, r);
    const t = setInterval(() => {
      Ge(l);
    }, 60 * 1e3);
    return r.saveInterval = t, console.log(`🎉 [主进程] 浏览器 ${l} 完全启动成功!`), {
      success: !0
      /* ... */
    };
  } catch (r) {
    return console.log(r), {
      success: !1
      /* ... */
    };
  }
}, Ge = async (l) => {
  const c = D.get(l);
  if (!c || !c.token) {
    console.log(`[主进程] 保存Cookie失败: 找不到 ID 为 ${l} 的实例或 token。`);
    return;
  }
  const s = c.token;
  try {
    const i = c.browser.contexts()[0];
    if (!i) {
      console.warn(`[主进程] 找不到 ID 为 ${l} 的浏览器上下文。`);
      return;
    }
    const o = await i.cookies();
    await He.updateBrowserCookies(l, o, s);
  } catch (i) {
    console.log(i);
  }
}, vt = async (l) => {
  try {
    const c = D.get(l);
    return c ? (c.saveInterval && clearInterval(c.saveInterval), console.log(`[主进程] 正在为 ${l} 执行最后一次 Cookie 保存...`), await Ge(l), await c.browser.close(), D.delete(l), { success: !0, message: `浏览器 ${l} 已关闭` }) : { success: !1, error: "实例未找到" };
  } catch (c) {
    return console.error(`[主进程] 关闭浏览器 ${l} 异常:`, c.message), { success: !1, error: c.message };
  }
}, wt = () => ({
  success: !0,
  data: Array.from(D.values()).map((c) => ({
    accountId: c.accountId,
    accountName: `浏览器 ${c.accountId}`,
    startTime: c.startTime
  }))
});
function bt(l) {
  return l && l.__esModule && Object.prototype.hasOwnProperty.call(l, "default") ? l.default : l;
}
var _ = { exports: {} }, I = { exports: {} }, me;
function Ye() {
  return me || (me = 1, function(l) {
    let c = {};
    try {
      c = require("electron");
    } catch {
    }
    c.ipcRenderer && s(c), l.exports = s;
    function s({ contextBridge: i, ipcRenderer: o }) {
      if (!o)
        return;
      o.on("__ELECTRON_LOG_IPC__", (e, t) => {
        window.postMessage({ cmd: "message", ...t });
      }), o.invoke("__ELECTRON_LOG__", { cmd: "getOptions" }).catch((e) => console.error(new Error(
        `electron-log isn't initialized in the main process. Please call log.initialize() before. ${e.message}`
      )));
      const r = {
        sendToMain(e) {
          try {
            o.send("__ELECTRON_LOG__", e);
          } catch (t) {
            console.error("electronLog.sendToMain ", t, "data:", e), o.send("__ELECTRON_LOG__", {
              cmd: "errorHandler",
              error: { message: t == null ? void 0 : t.message, stack: t == null ? void 0 : t.stack },
              errorName: "sendToMain"
            });
          }
        },
        log(...e) {
          r.sendToMain({ data: e, level: "info" });
        }
      };
      for (const e of ["error", "warn", "info", "verbose", "debug", "silly"])
        r[e] = (...t) => r.sendToMain({
          data: t,
          level: e
        });
      if (i && process.contextIsolated)
        try {
          i.exposeInMainWorld("__electronLog", r);
        } catch {
        }
      typeof window == "object" ? window.__electronLog = r : __electronLog = r;
    }
  }(I)), I.exports;
}
var q = { exports: {} }, k, ve;
function Et() {
  if (ve) return k;
  ve = 1, k = l;
  function l(c) {
    return Object.defineProperties(s, {
      defaultLabel: { value: "", writable: !0 },
      labelPadding: { value: !0, writable: !0 },
      maxLabelLength: { value: 0, writable: !0 },
      labelLength: {
        get() {
          switch (typeof s.labelPadding) {
            case "boolean":
              return s.labelPadding ? s.maxLabelLength : 0;
            case "number":
              return s.labelPadding;
            default:
              return 0;
          }
        }
      }
    });
    function s(i) {
      s.maxLabelLength = Math.max(s.maxLabelLength, i.length);
      const o = {};
      for (const r of c.levels)
        o[r] = (...e) => c.logData(e, { level: r, scope: i });
      return o.log = o.info, o;
    }
  }
  return k;
}
var M, we;
function St() {
  if (we) return M;
  we = 1;
  class l {
    constructor({ processMessage: s }) {
      this.processMessage = s, this.buffer = [], this.enabled = !1, this.begin = this.begin.bind(this), this.commit = this.commit.bind(this), this.reject = this.reject.bind(this);
    }
    addMessage(s) {
      this.buffer.push(s);
    }
    begin() {
      this.enabled = [];
    }
    commit() {
      this.enabled = !1, this.buffer.forEach((s) => this.processMessage(s)), this.buffer = [];
    }
    reject() {
      this.enabled = !1, this.buffer = [];
    }
  }
  return M = l, M;
}
var z, be;
function Qe() {
  if (be) return z;
  be = 1;
  const l = Et(), c = St(), i = class i {
    constructor({
      allowUnknownLevel: r = !1,
      dependencies: e = {},
      errorHandler: t,
      eventLogger: n,
      initializeFn: a,
      isDev: u = !1,
      levels: f = ["error", "warn", "info", "verbose", "debug", "silly"],
      logId: p,
      transportFactories: d = {},
      variables: b
    } = {}) {
      h(this, "dependencies", {});
      h(this, "errorHandler", null);
      h(this, "eventLogger", null);
      h(this, "functions", {});
      h(this, "hooks", []);
      h(this, "isDev", !1);
      h(this, "levels", null);
      h(this, "logId", null);
      h(this, "scope", null);
      h(this, "transports", {});
      h(this, "variables", {});
      this.addLevel = this.addLevel.bind(this), this.create = this.create.bind(this), this.initialize = this.initialize.bind(this), this.logData = this.logData.bind(this), this.processMessage = this.processMessage.bind(this), this.allowUnknownLevel = r, this.buffering = new c(this), this.dependencies = e, this.initializeFn = a, this.isDev = u, this.levels = f, this.logId = p, this.scope = l(this), this.transportFactories = d, this.variables = b || {};
      for (const y of this.levels)
        this.addLevel(y, !1);
      this.log = this.info, this.functions.log = this.log, this.errorHandler = t, t == null || t.setOptions({ ...e, logFn: this.error }), this.eventLogger = n, n == null || n.setOptions({ ...e, logger: this });
      for (const [y, g] of Object.entries(d))
        this.transports[y] = g(this, e);
      i.instances[p] = this;
    }
    static getInstance({ logId: r }) {
      return this.instances[r] || this.instances.default;
    }
    addLevel(r, e = this.levels.length) {
      e !== !1 && this.levels.splice(e, 0, r), this[r] = (...t) => this.logData(t, { level: r }), this.functions[r] = this[r];
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
      return typeof r == "string" && (r = { logId: r }), new i({
        dependencies: this.dependencies,
        errorHandler: this.errorHandler,
        initializeFn: this.initializeFn,
        isDev: this.isDev,
        transportFactories: this.transportFactories,
        variables: { ...this.variables },
        ...r
      });
    }
    compareLevels(r, e, t = this.levels) {
      const n = t.indexOf(r), a = t.indexOf(e);
      return a === -1 || n === -1 ? !0 : a <= n;
    }
    initialize(r = {}) {
      this.initializeFn({ logger: this, ...this.dependencies, ...r });
    }
    logData(r, e = {}) {
      this.buffering.enabled ? this.buffering.addMessage({ data: r, date: /* @__PURE__ */ new Date(), ...e }) : this.processMessage({ data: r, ...e });
    }
    processMessage(r, { transports: e = this.transports } = {}) {
      if (r.cmd === "errorHandler") {
        this.errorHandler.handle(r.error, {
          errorName: r.errorName,
          processType: "renderer",
          showDialog: !!r.showDialog
        });
        return;
      }
      let t = r.level;
      this.allowUnknownLevel || (t = this.levels.includes(r.level) ? r.level : "info");
      const n = {
        date: /* @__PURE__ */ new Date(),
        logId: this.logId,
        ...r,
        level: t,
        variables: {
          ...this.variables,
          ...r.variables
        }
      };
      for (const [a, u] of this.transportEntries(e))
        if (!(typeof u != "function" || u.level === !1) && this.compareLevels(u.level, r.level))
          try {
            const f = this.hooks.reduce((p, d) => p && d(p, u, a), n);
            f && u({ ...f, data: [...f.data] });
          } catch (f) {
            this.processInternalErrorFn(f);
          }
    }
    processInternalErrorFn(r) {
    }
    transportEntries(r = this.transports) {
      return (Array.isArray(r) ? r : Object.entries(r)).map((t) => {
        switch (typeof t) {
          case "string":
            return this.transports[t] ? [t, this.transports[t]] : null;
          case "function":
            return [t.name, t];
          default:
            return Array.isArray(t) ? t : null;
        }
      }).filter(Boolean);
    }
  };
  h(i, "instances", {});
  let s = i;
  return z = s, z;
}
var W, Ee;
function At() {
  if (Ee) return W;
  Ee = 1;
  const l = console.error;
  class c {
    constructor({ logFn: i = null } = {}) {
      h(this, "logFn", null);
      h(this, "onError", null);
      h(this, "showDialog", !1);
      h(this, "preventDefault", !0);
      this.handleError = this.handleError.bind(this), this.handleRejection = this.handleRejection.bind(this), this.startCatching = this.startCatching.bind(this), this.logFn = i;
    }
    handle(i, {
      logFn: o = this.logFn,
      errorName: r = "",
      onError: e = this.onError,
      showDialog: t = this.showDialog
    } = {}) {
      try {
        (e == null ? void 0 : e({ error: i, errorName: r, processType: "renderer" })) !== !1 && o({ error: i, errorName: r, showDialog: t });
      } catch {
        l(i);
      }
    }
    setOptions({ logFn: i, onError: o, preventDefault: r, showDialog: e }) {
      typeof i == "function" && (this.logFn = i), typeof o == "function" && (this.onError = o), typeof r == "boolean" && (this.preventDefault = r), typeof e == "boolean" && (this.showDialog = e);
    }
    startCatching({ onError: i, showDialog: o } = {}) {
      this.isActive || (this.isActive = !0, this.setOptions({ onError: i, showDialog: o }), window.addEventListener("error", (r) => {
        var e;
        this.preventDefault && ((e = r.preventDefault) == null || e.call(r)), this.handleError(r.error || r);
      }), window.addEventListener("unhandledrejection", (r) => {
        var e;
        this.preventDefault && ((e = r.preventDefault) == null || e.call(r)), this.handleRejection(r.reason || r);
      }));
    }
    handleError(i) {
      this.handle(i, { errorName: "Unhandled" });
    }
    handleRejection(i) {
      const o = i instanceof Error ? i : new Error(JSON.stringify(i));
      this.handle(o, { errorName: "Unhandled rejection" });
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
    message: s,
    transport: i,
    initialData: o = (s == null ? void 0 : s.data) || [],
    transforms: r = i == null ? void 0 : i.transforms
  }) {
    return r.reduce((e, t) => typeof t == "function" ? t({ data: e, logger: c, message: s, transport: i }) : e, o);
  }
  return U;
}
var B, Ae;
function Ot() {
  if (Ae) return B;
  Ae = 1;
  const { transform: l } = L();
  B = s;
  const c = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    verbose: console.info,
    debug: console.debug,
    silly: console.debug,
    log: console.log
  };
  function s(o) {
    return Object.assign(r, {
      format: "{h}:{i}:{s}.{ms}{scope} › {text}",
      transforms: [i],
      writeFn({ message: { level: e, data: t } }) {
        const n = c[e] || c.info;
        setTimeout(() => n(...t));
      }
    });
    function r(e) {
      r.writeFn({
        message: { ...e, data: l({ logger: o, message: e, transport: r }) }
      });
    }
  }
  function i({
    data: o = [],
    logger: r = {},
    message: e = {},
    transport: t = {}
  }) {
    if (typeof t.format == "function")
      return t.format({
        data: o,
        level: (e == null ? void 0 : e.level) || "info",
        logger: r,
        message: e,
        transport: t
      });
    if (typeof t.format != "string")
      return o;
    o.unshift(t.format), typeof o[1] == "string" && o[1].match(/%[1cdfiOos]/) && (o = [`${o[0]}${o[1]}`, ...o.slice(2)]);
    const n = e.date || /* @__PURE__ */ new Date();
    return o[0] = o[0].replace(/\{(\w+)}/g, (a, u) => {
      var f, p;
      switch (u) {
        case "level":
          return e.level;
        case "logId":
          return e.logId;
        case "scope": {
          const d = e.scope || ((f = r.scope) == null ? void 0 : f.defaultLabel);
          return d ? ` (${d})` : "";
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
          return ((p = e.variables) == null ? void 0 : p[u]) || a;
      }
    }).trim(), o;
  }
  return B;
}
var J, Oe;
function Lt() {
  if (Oe) return J;
  Oe = 1;
  const { transform: l } = L();
  J = s;
  const c = /* @__PURE__ */ new Set([Promise, WeakMap, WeakSet]);
  function s(r) {
    return Object.assign(e, {
      depth: 5,
      transforms: [o]
    });
    function e(t) {
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
          initialData: t,
          logger: r,
          message: t,
          transport: e
        });
        __electronLog.sendToMain(n);
      } catch (n) {
        r.transports.console({
          data: ["electronLog.transports.ipc", n, "data:", t.data],
          level: "error"
        });
      }
    }
  }
  function i(r) {
    return Object(r) !== r;
  }
  function o({
    data: r,
    depth: e,
    seen: t = /* @__PURE__ */ new WeakSet(),
    transport: n = {}
  } = {}) {
    const a = e || n.depth || 5;
    return t.has(r) ? "[Circular]" : a < 1 ? i(r) ? r : Array.isArray(r) ? "[Array]" : `[${typeof r}]` : ["function", "symbol"].includes(typeof r) ? r.toString() : i(r) ? r : c.has(r.constructor) ? `[${r.constructor.name}]` : Array.isArray(r) ? r.map((u) => o({
      data: u,
      depth: a - 1,
      seen: t
    })) : r instanceof Date ? r.toISOString() : r instanceof Error ? r.stack : r instanceof Map ? new Map(
      Array.from(r).map(([u, f]) => [
        o({ data: u, depth: a - 1, seen: t }),
        o({ data: f, depth: a - 1, seen: t })
      ])
    ) : r instanceof Set ? new Set(
      Array.from(r).map(
        (u) => o({ data: u, depth: a - 1, seen: t })
      )
    ) : (t.add(r), Object.fromEntries(
      Object.entries(r).map(
        ([u, f]) => [
          u,
          o({ data: f, depth: a - 1, seen: t })
        ]
      )
    ));
  }
  return J;
}
var Le;
function Pt() {
  return Le || (Le = 1, function(l) {
    const c = Qe(), s = At(), i = Ot(), o = Lt();
    typeof process == "object" && process.type === "browser" && console.warn(
      "electron-log/renderer is loaded in the main process. It could cause unexpected behaviour."
    ), l.exports = r(), l.exports.Logger = c, l.exports.default = l.exports;
    function r() {
      const e = new c({
        allowUnknownLevel: !0,
        errorHandler: new s(),
        initializeFn: () => {
        },
        logId: "default",
        transportFactories: {
          console: i,
          ipc: o
        },
        variables: {
          processType: "renderer"
        }
      });
      return e.errorHandler.setOptions({
        logFn({ error: t, errorName: n, showDialog: a }) {
          e.transports.console({
            data: [n, t].filter(Boolean),
            level: "error"
          }), e.transports.ipc({
            cmd: "errorHandler",
            error: {
              cause: t == null ? void 0 : t.cause,
              code: t == null ? void 0 : t.code,
              name: t == null ? void 0 : t.name,
              message: t == null ? void 0 : t.message,
              stack: t == null ? void 0 : t.stack
            },
            errorName: n,
            logId: e.logId,
            showDialog: a
          });
        }
      }), typeof window == "object" && window.addEventListener("message", (t) => {
        const { cmd: n, logId: a, ...u } = t.data || {}, f = c.getInstance({ logId: a });
        n === "message" && f.processMessage(u, { transports: ["console"] });
      }), new Proxy(e, {
        get(t, n) {
          return typeof t[n] < "u" ? t[n] : (...a) => e.logData(a, { level: n });
        }
      });
    }
  }(q)), q.exports;
}
var V, Pe;
function Ft() {
  if (Pe) return V;
  Pe = 1;
  const l = R, c = x;
  V = {
    findAndReadPackageJson: s,
    tryReadJsonAt: i
  };
  function s() {
    return i(e()) || i(r()) || i(process.resourcesPath, "app.asar") || i(process.resourcesPath, "app") || i(process.cwd()) || { name: void 0, version: void 0 };
  }
  function i(...t) {
    if (t[0])
      try {
        const n = c.join(...t), a = o("package.json", n);
        if (!a)
          return;
        const u = JSON.parse(l.readFileSync(a, "utf8")), f = (u == null ? void 0 : u.productName) || (u == null ? void 0 : u.name);
        return !f || f.toLowerCase() === "electron" ? void 0 : f ? { name: f, version: u == null ? void 0 : u.version } : void 0;
      } catch {
        return;
      }
  }
  function o(t, n) {
    let a = n;
    for (; ; ) {
      const u = c.parse(a), f = u.root, p = u.dir;
      if (l.existsSync(c.join(a, t)))
        return c.resolve(c.join(a, t));
      if (a === f)
        return null;
      a = p;
    }
  }
  function r() {
    const t = process.argv.filter((a) => a.indexOf("--user-data-dir=") === 0);
    return t.length === 0 || typeof t[0] != "string" ? null : t[0].replace("--user-data-dir=", "");
  }
  function e() {
    var t;
    try {
      return (t = require.main) == null ? void 0 : t.filename;
    } catch {
      return;
    }
  }
  return V;
}
var H, Fe;
function Xe() {
  if (Fe) return H;
  Fe = 1;
  const l = pt, c = C, s = x, i = Ft();
  class o {
    constructor() {
      h(this, "appName");
      h(this, "appPackageJson");
      h(this, "platform", process.platform);
    }
    getAppLogPath(e = this.getAppName()) {
      return this.platform === "darwin" ? s.join(this.getSystemPathHome(), "Library/Logs", e) : s.join(this.getAppUserDataPath(e), "logs");
    }
    getAppName() {
      var t;
      const e = this.appName || ((t = this.getAppPackageJson()) == null ? void 0 : t.name);
      if (!e)
        throw new Error(
          "electron-log can't determine the app name. It tried these methods:\n1. Use `electron.app.name`\n2. Use productName or name from the nearest package.json`\nYou can also set it through log.transports.file.setAppName()"
        );
      return e;
    }
    /**
     * @private
     * @returns {undefined}
     */
    getAppPackageJson() {
      return typeof this.appPackageJson != "object" && (this.appPackageJson = i.findAndReadPackageJson()), this.appPackageJson;
    }
    getAppUserDataPath(e = this.getAppName()) {
      return e ? s.join(this.getSystemPathAppData(), e) : void 0;
    }
    getAppVersion() {
      var e;
      return (e = this.getAppPackageJson()) == null ? void 0 : e.version;
    }
    getElectronLogPath() {
      return this.getAppLogPath();
    }
    getMacOsVersion() {
      const e = Number(c.release().split(".")[0]);
      return e <= 19 ? `10.${e - 4}` : e - 9;
    }
    /**
     * @protected
     * @returns {string}
     */
    getOsVersion() {
      let e = c.type().replace("_", " "), t = c.release();
      return e === "Darwin" && (e = "macOS", t = this.getMacOsVersion()), `${e} ${t}`;
    }
    /**
     * @return {PathVariables}
     */
    getPathVariables() {
      const e = this.getAppName(), t = this.getAppVersion(), n = this;
      return {
        appData: this.getSystemPathAppData(),
        appName: e,
        appVersion: t,
        get electronDefaultDir() {
          return n.getElectronLogPath();
        },
        home: this.getSystemPathHome(),
        libraryDefaultDir: this.getAppLogPath(e),
        libraryTemplate: this.getAppLogPath("{appName}"),
        temp: this.getSystemPathTemp(),
        userData: this.getAppUserDataPath(e)
      };
    }
    getSystemPathAppData() {
      const e = this.getSystemPathHome();
      switch (this.platform) {
        case "darwin":
          return s.join(e, "Library/Application Support");
        case "win32":
          return process.env.APPDATA || s.join(e, "AppData/Roaming");
        default:
          return process.env.XDG_CONFIG_HOME || s.join(e, ".config");
      }
    }
    getSystemPathHome() {
      var e;
      return ((e = c.homedir) == null ? void 0 : e.call(c)) || process.env.HOME;
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
    onAppEvent(e, t) {
    }
    onAppReady(e) {
      e();
    }
    onEveryWebContentsEvent(e, t) {
    }
    /**
     * Listen to async messages sent from opposite process
     * @param {string} channel
     * @param {function} listener
     */
    onIpc(e, t) {
    }
    onIpcInvoke(e, t) {
    }
    /**
     * @param {string} url
     * @param {Function} [logFunction]
     */
    openUrl(e, t = console.error) {
      const a = { darwin: "open", win32: "start", linux: "xdg-open" }[process.platform] || "xdg-open";
      l.exec(`${a} ${e}`, {}, (u) => {
        u && t(u);
      });
    }
    setAppName(e) {
      this.appName = e;
    }
    setPlatform(e) {
      this.platform = e;
    }
    setPreloadFileForSessions({
      filePath: e,
      // eslint-disable-line no-unused-vars
      includeFutureSession: t = !0,
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
    sendIpc(e, t) {
    }
    showErrorBox(e, t) {
    }
  }
  return H = o, H;
}
var G, xe;
function xt() {
  if (xe) return G;
  xe = 1;
  const l = x, c = Xe();
  class s extends c {
    /**
     * @param {object} options
     * @param {typeof Electron} [options.electron]
     */
    constructor({ electron: r } = {}) {
      super();
      /**
       * @type {typeof Electron}
       */
      h(this, "electron");
      this.electron = r;
    }
    getAppName() {
      var e, t;
      let r;
      try {
        r = this.appName || ((e = this.electron.app) == null ? void 0 : e.name) || ((t = this.electron.app) == null ? void 0 : t.getName());
      } catch {
      }
      return r || super.getAppName();
    }
    getAppUserDataPath(r) {
      return this.getPath("userData") || super.getAppUserDataPath(r);
    }
    getAppVersion() {
      var e;
      let r;
      try {
        r = (e = this.electron.app) == null ? void 0 : e.getVersion();
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
      var e;
      try {
        return (e = this.electron.app) == null ? void 0 : e.getPath(r);
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
    onAppEvent(r, e) {
      var t;
      return (t = this.electron.app) == null || t.on(r, e), () => {
        var n;
        (n = this.electron.app) == null || n.off(r, e);
      };
    }
    onAppReady(r) {
      var e, t, n;
      (e = this.electron.app) != null && e.isReady() ? r() : (t = this.electron.app) != null && t.once ? (n = this.electron.app) == null || n.once("ready", r) : r();
    }
    onEveryWebContentsEvent(r, e) {
      var n, a, u;
      return (a = (n = this.electron.webContents) == null ? void 0 : n.getAllWebContents()) == null || a.forEach((f) => {
        f.on(r, e);
      }), (u = this.electron.app) == null || u.on("web-contents-created", t), () => {
        var f, p;
        (f = this.electron.webContents) == null || f.getAllWebContents().forEach((d) => {
          d.off(r, e);
        }), (p = this.electron.app) == null || p.off("web-contents-created", t);
      };
      function t(f, p) {
        p.on(r, e);
      }
    }
    /**
     * Listen to async messages sent from opposite process
     * @param {string} channel
     * @param {function} listener
     */
    onIpc(r, e) {
      var t;
      (t = this.electron.ipcMain) == null || t.on(r, e);
    }
    onIpcInvoke(r, e) {
      var t, n;
      (n = (t = this.electron.ipcMain) == null ? void 0 : t.handle) == null || n.call(t, r, e);
    }
    /**
     * @param {string} url
     * @param {Function} [logFunction]
     */
    openUrl(r, e = console.error) {
      var t;
      (t = this.electron.shell) == null || t.openExternal(r).catch(e);
    }
    setPreloadFileForSessions({
      filePath: r,
      includeFutureSession: e = !0,
      getSessions: t = () => {
        var n;
        return [(n = this.electron.session) == null ? void 0 : n.defaultSession];
      }
    }) {
      for (const a of t().filter(Boolean))
        n(a);
      e && this.onAppEvent("session-created", (a) => {
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
    sendIpc(r, e) {
      var t, n;
      (n = (t = this.electron.BrowserWindow) == null ? void 0 : t.getAllWindows()) == null || n.forEach((a) => {
        var u, f;
        ((u = a.webContents) == null ? void 0 : u.isDestroyed()) === !1 && ((f = a.webContents) == null ? void 0 : f.isCrashed()) === !1 && a.webContents.send(r, e);
      });
    }
    showErrorBox(r, e) {
      var t;
      (t = this.electron.dialog) == null || t.showErrorBox(r, e);
    }
  }
  return G = s, G;
}
var Y, De;
function Dt() {
  if (De) return Y;
  De = 1;
  const l = R, c = C, s = x, i = Ye();
  let o = !1, r = !1;
  Y = {
    initialize({
      externalApi: n,
      getSessions: a,
      includeFutureSession: u,
      logger: f,
      preload: p = !0,
      spyRendererConsole: d = !1
    }) {
      n.onAppReady(() => {
        try {
          p && e({
            externalApi: n,
            getSessions: a,
            includeFutureSession: u,
            logger: f,
            preloadOption: p
          }), d && t({ externalApi: n, logger: f });
        } catch (b) {
          f.warn(b);
        }
      });
    }
  };
  function e({
    externalApi: n,
    getSessions: a,
    includeFutureSession: u,
    logger: f,
    preloadOption: p
  }) {
    let d = typeof p == "string" ? p : void 0;
    if (o) {
      f.warn(new Error("log.initialize({ preload }) already called").stack);
      return;
    }
    o = !0;
    try {
      d = s.resolve(
        __dirname,
        "../renderer/electron-log-preload.js"
      );
    } catch {
    }
    if (!d || !l.existsSync(d)) {
      d = s.join(
        n.getAppUserDataPath() || c.tmpdir(),
        "electron-log-preload.js"
      );
      const b = `
      try {
        (${i.toString()})(require('electron'));
      } catch(e) {
        console.error(e);
      }
    `;
      l.writeFileSync(d, b, "utf8");
    }
    n.setPreloadFileForSessions({
      filePath: d,
      includeFutureSession: u,
      getSessions: a
    });
  }
  function t({ externalApi: n, logger: a }) {
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
      (f, p, d) => {
        a.processMessage({
          data: [d],
          level: u[p],
          variables: { processType: "renderer" }
        });
      }
    );
  }
  return Y;
}
var Q, Re;
function Rt() {
  if (Re) return Q;
  Re = 1;
  class l {
    constructor({
      externalApi: i,
      logFn: o = void 0,
      onError: r = void 0,
      showDialog: e = void 0
    } = {}) {
      h(this, "externalApi");
      h(this, "isActive", !1);
      h(this, "logFn");
      h(this, "onError");
      h(this, "showDialog", !0);
      this.createIssue = this.createIssue.bind(this), this.handleError = this.handleError.bind(this), this.handleRejection = this.handleRejection.bind(this), this.setOptions({ externalApi: i, logFn: o, onError: r, showDialog: e }), this.startCatching = this.startCatching.bind(this), this.stopCatching = this.stopCatching.bind(this);
    }
    handle(i, {
      logFn: o = this.logFn,
      onError: r = this.onError,
      processType: e = "browser",
      showDialog: t = this.showDialog,
      errorName: n = ""
    } = {}) {
      var a;
      i = c(i);
      try {
        if (typeof r == "function") {
          const u = ((a = this.externalApi) == null ? void 0 : a.getVersions()) || {}, f = this.createIssue;
          if (r({
            createIssue: f,
            error: i,
            errorName: n,
            processType: e,
            versions: u
          }) === !1)
            return;
        }
        n ? o(n, i) : o(i), t && !n.includes("rejection") && this.externalApi && this.externalApi.showErrorBox(
          `A JavaScript error occurred in the ${e} process`,
          i.stack
        );
      } catch {
        console.error(i);
      }
    }
    setOptions({ externalApi: i, logFn: o, onError: r, showDialog: e }) {
      typeof i == "object" && (this.externalApi = i), typeof o == "function" && (this.logFn = o), typeof r == "function" && (this.onError = r), typeof e == "boolean" && (this.showDialog = e);
    }
    startCatching({ onError: i, showDialog: o } = {}) {
      this.isActive || (this.isActive = !0, this.setOptions({ onError: i, showDialog: o }), process.on("uncaughtException", this.handleError), process.on("unhandledRejection", this.handleRejection));
    }
    stopCatching() {
      this.isActive = !1, process.removeListener("uncaughtException", this.handleError), process.removeListener("unhandledRejection", this.handleRejection);
    }
    createIssue(i, o) {
      var r;
      (r = this.externalApi) == null || r.openUrl(
        `${i}?${new URLSearchParams(o).toString()}`
      );
    }
    handleError(i) {
      this.handle(i, { errorName: "Unhandled" });
    }
    handleRejection(i) {
      const o = i instanceof Error ? i : new Error(JSON.stringify(i));
      this.handle(o, { errorName: "Unhandled rejection" });
    }
  }
  function c(s) {
    if (s instanceof Error)
      return s;
    if (s && typeof s == "object") {
      if (s.message)
        return Object.assign(new Error(s.message), s);
      try {
        return new Error(JSON.stringify(s));
      } catch (i) {
        return new Error(`Couldn't normalize error ${String(s)}: ${i}`);
      }
    }
    return new Error(`Can't normalize error ${String(s)}`);
  }
  return Q = l, Q;
}
var X, $e;
function $t() {
  if ($e) return X;
  $e = 1;
  class l {
    constructor(s = {}) {
      h(this, "disposers", []);
      h(this, "format", "{eventSource}#{eventName}:");
      h(this, "formatters", {
        app: {
          "certificate-error": ({ args: s }) => this.arrayToObject(s.slice(1, 4), [
            "url",
            "error",
            "certificate"
          ]),
          "child-process-gone": ({ args: s }) => s.length === 1 ? s[0] : s,
          "render-process-gone": ({ args: [s, i] }) => i && typeof i == "object" ? { ...i, ...this.getWebContentsDetails(s) } : []
        },
        webContents: {
          "console-message": ({ args: [s, i, o, r] }) => {
            if (!(s < 3))
              return { message: i, source: `${r}:${o}` };
          },
          "did-fail-load": ({ args: s }) => this.arrayToObject(s, [
            "errorCode",
            "errorDescription",
            "validatedURL",
            "isMainFrame",
            "frameProcessId",
            "frameRoutingId"
          ]),
          "did-fail-provisional-load": ({ args: s }) => this.arrayToObject(s, [
            "errorCode",
            "errorDescription",
            "validatedURL",
            "isMainFrame",
            "frameProcessId",
            "frameRoutingId"
          ]),
          "plugin-crashed": ({ args: s }) => this.arrayToObject(s, ["name", "version"]),
          "preload-error": ({ args: s }) => this.arrayToObject(s, ["preloadPath", "error"])
        }
      });
      h(this, "events", {
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
      h(this, "externalApi");
      h(this, "level", "error");
      h(this, "scope", "");
      this.setOptions(s);
    }
    setOptions({
      events: s,
      externalApi: i,
      level: o,
      logger: r,
      format: e,
      formatters: t,
      scope: n
    }) {
      typeof s == "object" && (this.events = s), typeof i == "object" && (this.externalApi = i), typeof o == "string" && (this.level = o), typeof r == "object" && (this.logger = r), (typeof e == "string" || typeof e == "function") && (this.format = e), typeof t == "object" && (this.formatters = t), typeof n == "string" && (this.scope = n);
    }
    startLogging(s = {}) {
      this.setOptions(s), this.disposeListeners();
      for (const i of this.getEventNames(this.events.app))
        this.disposers.push(
          this.externalApi.onAppEvent(i, (...o) => {
            this.handleEvent({ eventSource: "app", eventName: i, handlerArgs: o });
          })
        );
      for (const i of this.getEventNames(this.events.webContents))
        this.disposers.push(
          this.externalApi.onEveryWebContentsEvent(
            i,
            (...o) => {
              this.handleEvent(
                { eventSource: "webContents", eventName: i, handlerArgs: o }
              );
            }
          )
        );
    }
    stopLogging() {
      this.disposeListeners();
    }
    arrayToObject(s, i) {
      const o = {};
      return i.forEach((r, e) => {
        o[r] = s[e];
      }), s.length > i.length && (o.unknownArgs = s.slice(i.length)), o;
    }
    disposeListeners() {
      this.disposers.forEach((s) => s()), this.disposers = [];
    }
    formatEventLog({ eventName: s, eventSource: i, handlerArgs: o }) {
      var f;
      const [r, ...e] = o;
      if (typeof this.format == "function")
        return this.format({ args: e, event: r, eventName: s, eventSource: i });
      const t = (f = this.formatters[i]) == null ? void 0 : f[s];
      let n = e;
      if (typeof t == "function" && (n = t({ args: e, event: r, eventName: s, eventSource: i })), !n)
        return;
      const a = {};
      return Array.isArray(n) ? a.args = n : typeof n == "object" && Object.assign(a, n), i === "webContents" && Object.assign(a, this.getWebContentsDetails(r == null ? void 0 : r.sender)), [this.format.replace("{eventSource}", i === "app" ? "App" : "WebContents").replace("{eventName}", s), a];
    }
    getEventNames(s) {
      return !s || typeof s != "object" ? [] : Object.entries(s).filter(([i, o]) => o).map(([i]) => i);
    }
    getWebContentsDetails(s) {
      if (!(s != null && s.loadURL))
        return {};
      try {
        return {
          webContents: {
            id: s.id,
            url: s.getURL()
          }
        };
      } catch {
        return {};
      }
    }
    handleEvent({ eventName: s, eventSource: i, handlerArgs: o }) {
      var e;
      const r = this.formatEventLog({ eventName: s, eventSource: i, handlerArgs: o });
      if (r) {
        const t = this.scope ? this.logger.scope(this.scope) : this.logger;
        (e = t == null ? void 0 : t[this.level]) == null || e.call(t, ...r);
      }
    }
  }
  return X = l, X;
}
var Z, _e;
function Ze() {
  if (_e) return Z;
  _e = 1;
  const { transform: l } = L();
  Z = {
    concatFirstStringElements: c,
    formatScope: i,
    formatText: r,
    formatVariables: o,
    timeZoneFromOffset: s,
    format({ message: e, logger: t, transport: n, data: a = e == null ? void 0 : e.data }) {
      switch (typeof n.format) {
        case "string":
          return l({
            message: e,
            logger: t,
            transforms: [o, i, r],
            transport: n,
            initialData: [n.format, ...a]
          });
        case "function":
          return n.format({
            data: a,
            level: (e == null ? void 0 : e.level) || "info",
            logger: t,
            message: e,
            transport: n
          });
        default:
          return a;
      }
    }
  };
  function c({ data: e }) {
    return typeof e[0] != "string" || typeof e[1] != "string" || e[0].match(/%[1cdfiOos]/) ? e : [`${e[0]} ${e[1]}`, ...e.slice(2)];
  }
  function s(e) {
    const t = Math.abs(e), n = e > 0 ? "-" : "+", a = Math.floor(t / 60).toString().padStart(2, "0"), u = (t % 60).toString().padStart(2, "0");
    return `${n}${a}:${u}`;
  }
  function i({ data: e, logger: t, message: n }) {
    const { defaultLabel: a, labelLength: u } = (t == null ? void 0 : t.scope) || {}, f = e[0];
    let p = n.scope;
    p || (p = a);
    let d;
    return p === "" ? d = u > 0 ? "".padEnd(u + 3) : "" : typeof p == "string" ? d = ` (${p})`.padEnd(u + 3) : d = "", e[0] = f.replace("{scope}", d), e;
  }
  function o({ data: e, message: t }) {
    let n = e[0];
    if (typeof n != "string")
      return e;
    n = n.replace("{level}]", `${t.level}]`.padEnd(6, " "));
    const a = t.date || /* @__PURE__ */ new Date();
    return e[0] = n.replace(/\{(\w+)}/g, (u, f) => {
      var p;
      switch (f) {
        case "level":
          return t.level || "info";
        case "logId":
          return t.logId;
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
          return s(a.getTimezoneOffset());
        case "iso":
          return a.toISOString();
        default:
          return ((p = t.variables) == null ? void 0 : p[f]) || u;
      }
    }).trim(), e;
  }
  function r({ data: e }) {
    const t = e[0];
    if (typeof t != "string")
      return e;
    if (t.lastIndexOf("{text}") === t.length - 6)
      return e[0] = t.replace(/\s?{text}/, ""), e[0] === "" && e.shift(), e;
    const a = t.split("{text}");
    let u = [];
    return a[0] !== "" && u.push(a[0]), u = u.concat(e.slice(1)), a[1] !== "" && u.push(a[1]), u;
  }
  return Z;
}
var K = { exports: {} }, je;
function T() {
  return je || (je = 1, function(l) {
    const c = ht;
    l.exports = {
      serialize: i,
      maxDepth({ data: o, transport: r, depth: e = (r == null ? void 0 : r.depth) ?? 6 }) {
        if (!o)
          return o;
        if (e < 1)
          return Array.isArray(o) ? "[array]" : typeof o == "object" && o ? "[object]" : o;
        if (Array.isArray(o))
          return o.map((n) => l.exports.maxDepth({
            data: n,
            depth: e - 1
          }));
        if (typeof o != "object" || o && typeof o.toISOString == "function")
          return o;
        if (o === null)
          return null;
        if (o instanceof Error)
          return o;
        const t = {};
        for (const n in o)
          Object.prototype.hasOwnProperty.call(o, n) && (t[n] = l.exports.maxDepth({
            data: o[n],
            depth: e - 1
          }));
        return t;
      },
      toJSON({ data: o }) {
        return JSON.parse(JSON.stringify(o, s()));
      },
      toString({ data: o, transport: r }) {
        const e = (r == null ? void 0 : r.inspectOptions) || {}, t = o.map((n) => {
          if (n !== void 0)
            try {
              const a = JSON.stringify(n, s(), "  ");
              return a === void 0 ? void 0 : JSON.parse(a);
            } catch {
              return n;
            }
        });
        return c.formatWithOptions(e, ...t);
      }
    };
    function s(o = {}) {
      const r = /* @__PURE__ */ new WeakSet();
      return function(e, t) {
        if (typeof t == "object" && t !== null) {
          if (r.has(t))
            return;
          r.add(t);
        }
        return i(e, t, o);
      };
    }
    function i(o, r, e = {}) {
      const t = (e == null ? void 0 : e.serializeMapAndSet) !== !1;
      return r instanceof Error ? r.stack : r && (typeof r == "function" ? `[function] ${r.toString()}` : r instanceof Date ? r.toISOString() : t && r instanceof Map && Object.fromEntries ? Object.fromEntries(r) : t && r instanceof Set && Array.from ? Array.from(r) : r);
    }
  }(K)), K.exports;
}
var ee, Ce;
function pe() {
  if (Ce) return ee;
  Ce = 1, ee = {
    transformStyles: i,
    applyAnsiStyles({ data: o }) {
      return i(o, c, s);
    },
    removeStyles({ data: o }) {
      return i(o, () => "");
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
  function c(o) {
    const r = o.replace(/color:\s*(\w+).*/, "$1").toLowerCase();
    return l[r] || "";
  }
  function s(o) {
    return o + l.unset;
  }
  function i(o, r, e) {
    const t = {};
    return o.reduce((n, a, u, f) => {
      if (t[u])
        return n;
      if (typeof a == "string") {
        let p = u, d = !1;
        a = a.replace(/%[1cdfiOos]/g, (b) => {
          if (p += 1, b !== "%c")
            return b;
          const y = f[p];
          return typeof y == "string" ? (t[p] = !0, d = !0, r(y, a)) : b;
        }), d && e && (a = e(a));
      }
      return n.push(a), n;
    }, []);
  }
  return ee;
}
var te, Te;
function _t() {
  if (Te) return te;
  Te = 1;
  const {
    concatFirstStringElements: l,
    format: c
  } = Ze(), { maxDepth: s, toJSON: i } = T(), {
    applyAnsiStyles: o,
    removeStyles: r
  } = pe(), { transform: e } = L(), t = {
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
        d,
        l,
        s,
        i
      ],
      useStyles: process.env.FORCE_STYLES,
      writeFn({ message: w }) {
        (t[w.level] || t.info)(...w.data);
      }
    });
    function g(w) {
      const E = e({ logger: y, message: w, transport: g });
      g.writeFn({
        message: { ...w, data: E }
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
    const E = g === "error" || g === "warn" ? process.stderr : process.stdout;
    return E && E.isTTY;
  }
  function d(y) {
    const { message: g, transport: w } = y;
    return (p(w.useStyles, g.level) ? o : r)(y);
  }
  function b(y, g) {
    return g.colorMap[y] || g.colorMap.default;
  }
  return te;
}
var re, Ne;
function Ke() {
  if (Ne) return re;
  Ne = 1;
  const l = Ve, c = R, s = C;
  class i extends l {
    constructor({
      path: t,
      writeOptions: n = { encoding: "utf8", flag: "a", mode: 438 },
      writeAsync: a = !1
    }) {
      super();
      h(this, "asyncWriteQueue", []);
      h(this, "bytesWritten", 0);
      h(this, "hasActiveAsyncWriting", !1);
      h(this, "path", null);
      h(this, "initialSize");
      h(this, "writeOptions", null);
      h(this, "writeAsync", !1);
      this.path = t, this.writeOptions = n, this.writeAsync = a;
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
      } catch (t) {
        return t.code === "ENOENT" ? !0 : (this.emit("error", t, this), !1);
      }
    }
    crop(t) {
      try {
        const n = o(this.path, t || 4096);
        this.clear(), this.writeLine(`[log cropped]${s.EOL}${n}`);
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
          const t = c.statSync(this.path);
          this.initialSize = t.size;
        } catch {
          this.initialSize = 0;
        }
      return this.initialSize + this.bytesWritten;
    }
    increaseBytesWrittenCounter(t) {
      this.bytesWritten += Buffer.byteLength(t, this.writeOptions.encoding);
    }
    isNull() {
      return !1;
    }
    nextAsyncWrite() {
      const t = this;
      if (this.hasActiveAsyncWriting || this.asyncWriteQueue.length === 0)
        return;
      const n = this.asyncWriteQueue.join("");
      this.asyncWriteQueue = [], this.hasActiveAsyncWriting = !0, c.writeFile(this.path, n, this.writeOptions, (a) => {
        t.hasActiveAsyncWriting = !1, a ? t.emit(
          "error",
          new Error(`Couldn't write to ${t.path}. ${a.message}`),
          this
        ) : t.increaseBytesWrittenCounter(n), t.nextAsyncWrite();
      });
    }
    reset() {
      this.initialSize = void 0, this.bytesWritten = 0;
    }
    toString() {
      return this.path;
    }
    writeLine(t) {
      if (t += s.EOL, this.writeAsync) {
        this.asyncWriteQueue.push(t), this.nextAsyncWrite();
        return;
      }
      try {
        c.writeFileSync(this.path, t, this.writeOptions), this.increaseBytesWrittenCounter(t);
      } catch (n) {
        this.emit(
          "error",
          new Error(`Couldn't write to ${this.path}. ${n.message}`),
          this
        );
      }
    }
  }
  re = i;
  function o(r, e) {
    const t = Buffer.alloc(e), n = c.statSync(r), a = Math.min(n.size, e), u = Math.max(0, n.size - e), f = c.openSync(r, "r"), p = c.readSync(f, t, 0, a, u);
    return c.closeSync(f), t.toString("utf8", 0, p);
  }
  return re;
}
var ne, Ie;
function jt() {
  if (Ie) return ne;
  Ie = 1;
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
var se, qe;
function Ct() {
  if (qe) return se;
  qe = 1;
  const l = Ve, c = R, s = x, i = Ke(), o = jt();
  class r extends l {
    constructor() {
      super();
      h(this, "store", {});
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
        if (n = s.resolve(n), this.store[n])
          return this.store[n];
        f = this.createFile({ filePath: n, writeOptions: a, writeAsync: u });
      } catch (p) {
        f = new o({ path: n }), this.emitError(p, f);
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
      return this.testFileWriting({ filePath: n, writeOptions: a }), new i({ path: n, writeOptions: a, writeAsync: u });
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
      c.mkdirSync(s.dirname(n), { recursive: !0 }), c.writeFileSync(n, "", { flag: "a", mode: a.mode });
    }
  }
  return se = r, se;
}
var oe, ke;
function Tt() {
  if (ke) return oe;
  ke = 1;
  const l = R, c = C, s = x, i = Ct(), { transform: o } = L(), { removeStyles: r } = pe(), {
    format: e,
    concatFirstStringElements: t
  } = Ze(), { toString: n } = T();
  oe = u;
  const a = new i();
  function u(p, { registry: d = a, externalApi: b } = {}) {
    let y;
    return d.listenerCount("error") < 1 && d.on("error", (v, m) => {
      E(`Can't write to ${m}`, v);
    }), Object.assign(g, {
      fileName: f(p.variables.processType),
      format: "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}",
      getFile: N,
      inspectOptions: { depth: 5 },
      level: "silly",
      maxSize: 1024 ** 2,
      readAllLogs: st,
      sync: !0,
      transforms: [r, e, t, n],
      writeOptions: { flag: "a", mode: 438, encoding: "utf8" },
      archiveLogFn(v) {
        const m = v.toString(), S = s.parse(m);
        try {
          l.renameSync(m, s.join(S.dir, `${S.name}.old${S.ext}`));
        } catch (P) {
          E("Could not rotate log", P);
          const ot = Math.round(g.maxSize / 4);
          v.crop(Math.min(ot, 256 * 1024));
        }
      },
      resolvePathFn(v) {
        return s.join(v.libraryDefaultDir, v.fileName);
      },
      setAppName(v) {
        p.dependencies.externalApi.setAppName(v);
      }
    });
    function g(v) {
      const m = N(v);
      g.maxSize > 0 && m.size > g.maxSize && (g.archiveLogFn(m), m.reset());
      const P = o({ logger: p, message: v, transport: g });
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
      ), typeof g.archiveLog == "function" && (g.archiveLogFn = g.archiveLog, E("archiveLog is deprecated. Use archiveLogFn instead")), typeof g.resolvePath == "function" && (g.resolvePathFn = g.resolvePath, E("resolvePath is deprecated. Use resolvePathFn instead")));
    }
    function E(v, m = null, S = "error") {
      const P = [`electron-log.transports.file: ${v}`];
      m && P.push(m), p.transports.console({ data: P, date: /* @__PURE__ */ new Date(), level: S });
    }
    function N(v) {
      w();
      const m = g.resolvePathFn(y, v);
      return d.provide({
        filePath: m,
        writeAsync: !g.sync,
        writeOptions: g.writeOptions
      });
    }
    function st({ fileFilter: v = (m) => m.endsWith(".log") } = {}) {
      w();
      const m = s.dirname(g.resolvePathFn(y));
      return l.existsSync(m) ? l.readdirSync(m).map((S) => s.join(m, S)).filter(v).map((S) => {
        try {
          return {
            path: S,
            lines: l.readFileSync(S, "utf8").split(c.EOL)
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
  return oe;
}
var ie, Me;
function Nt() {
  if (Me) return ie;
  Me = 1;
  const { maxDepth: l, toJSON: c } = T(), { transform: s } = L();
  ie = i;
  function i(o, { externalApi: r }) {
    return Object.assign(e, {
      depth: 3,
      eventId: "__ELECTRON_LOG_IPC__",
      level: o.isDev ? "silly" : !1,
      transforms: [c, l]
    }), r != null && r.isElectron() ? e : void 0;
    function e(t) {
      var n;
      ((n = t == null ? void 0 : t.variables) == null ? void 0 : n.processType) !== "renderer" && (r == null || r.sendIpc(e.eventId, {
        ...t,
        data: s({ logger: o, message: t, transport: e })
      }));
    }
  }
  return ie;
}
var ae, ze;
function It() {
  if (ze) return ae;
  ze = 1;
  const l = dt, c = gt, { transform: s } = L(), { removeStyles: i } = pe(), { toJSON: o, maxDepth: r } = T();
  ae = e;
  function e(t) {
    return Object.assign(n, {
      client: { name: "electron-application" },
      depth: 6,
      level: !1,
      requestOptions: {},
      transforms: [i, o, r],
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
        t.processMessage(
          {
            data: [`electron-log: can't POST ${n.url}`, a],
            level: "warn"
          },
          { transports: ["console", "file"] }
        );
      },
      sendRequestFn({ serverUrl: a, requestOptions: u, body: f }) {
        const d = (a.startsWith("https:") ? c : l).request(a, {
          method: "POST",
          ...u,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": f.length,
            ...u.headers
          }
        });
        return d.write(f), d.end(), d;
      }
    });
    function n(a) {
      if (!n.url)
        return;
      const u = n.makeBodyFn({
        logger: t,
        message: { ...a, data: s({ logger: t, message: a, transport: n }) },
        transport: n
      }), f = n.sendRequestFn({
        serverUrl: n.url,
        requestOptions: n.requestOptions,
        body: Buffer.from(u, "utf8")
      });
      f.on("error", (p) => n.processErrorFn({
        error: p,
        logger: t,
        message: a,
        request: f,
        transport: n
      }));
    }
  }
  return ae;
}
var ce, We;
function et() {
  if (We) return ce;
  We = 1;
  const l = Qe(), c = Rt(), s = $t(), i = _t(), o = Tt(), r = Nt(), e = It();
  ce = t;
  function t({ dependencies: n, initializeFn: a }) {
    var f;
    const u = new l({
      dependencies: n,
      errorHandler: new c(),
      eventLogger: new s(),
      initializeFn: a,
      isDev: (f = n.externalApi) == null ? void 0 : f.isDev(),
      logId: "default",
      transportFactories: {
        console: i,
        file: o,
        ipc: r,
        remote: e
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
var le, Ue;
function qt() {
  if (Ue) return le;
  Ue = 1;
  const l = ct, c = xt(), { initialize: s } = Dt(), i = et(), o = new c({ electron: l }), r = i({
    dependencies: { externalApi: o },
    initializeFn: s
  });
  le = r, o.onIpc("__ELECTRON_LOG__", (t, n) => {
    n.scope && r.Logger.getInstance(n).scope(n.scope);
    const a = new Date(n.date);
    e({
      ...n,
      date: a.getTime() ? a : /* @__PURE__ */ new Date()
    });
  }), o.onIpcInvoke("__ELECTRON_LOG__", (t, { cmd: n = "", logId: a }) => {
    switch (n) {
      case "getOptions":
        return {
          levels: r.Logger.getInstance({ logId: a }).levels,
          logId: a
        };
      default:
        return e({ data: [`Unknown cmd '${n}'`], level: "error" }), {};
    }
  });
  function e(t) {
    var n;
    (n = r.Logger.getInstance(t)) == null || n.processMessage(t);
  }
  return le;
}
var ue, Be;
function kt() {
  if (Be) return ue;
  Be = 1;
  const l = Xe(), c = et(), s = new l();
  return ue = c({
    dependencies: { externalApi: s }
  }), ue;
}
const Mt = typeof process > "u" || process.type === "renderer" || process.type === "worker", zt = typeof process == "object" && process.type === "browser";
Mt ? (Ye(), _.exports = Pt()) : zt ? _.exports = qt() : _.exports = kt();
var Wt = _.exports;
const he = /* @__PURE__ */ bt(Wt), tt = O.dirname(lt(import.meta.url));
he.transports.file.level = "info";
he.transports.file.fileName = "main.log";
Object.assign(console, he.functions);
process.env.APP_ROOT = O.join(tt, "..");
const fe = process.env.VITE_DEV_SERVER_URL, nr = O.join(process.env.APP_ROOT, "dist-electron"), rt = O.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = fe ? O.join(process.env.APP_ROOT, "public") : rt;
let A;
function nt() {
  A = new Je({
    icon: O.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: O.join(tt, "preload.mjs")
    }
  }), A.webContents.on("did-finish-load", () => {
    A == null || A.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), fe ? A.loadURL(fe) : A.loadFile(O.join(rt, "index.html"));
}
j.on("window-all-closed", () => {
  process.platform !== "darwin" && (j.quit(), A = null);
});
j.on("activate", () => {
  Je.getAllWindows().length === 0 && nt();
});
j.whenReady().then(() => {
  mt(), nt();
});
export {
  nr as MAIN_DIST,
  rt as RENDERER_DIST,
  fe as VITE_DEV_SERVER_URL
};
