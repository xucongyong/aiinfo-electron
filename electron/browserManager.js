import { ipcMain } from 'electron'
import { firefox } from 'playwright-core'
import { launchOptions } from 'camoufox-js'
// 假设 mainApiClient.js 在同一个目录下，或者调整路径
import { mainApiClient } from './mainApiClient.js'

// --- 所有核心逻辑都移到这里 ---

// 存储运行的浏览器实例
const runningBrowsers = new Map(); // 你可以稍后定义更精确的类型
// 在这个模块中存储 Token
let globalAuthToken = null;

// 1. 简单的防抖工具函数
const debounce = (fn, delay) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  }
}

const load_cookie = async (page, cookies) => {
  // 确保 cookies 是数组
  const validCookiesList = typeof cookies === 'string'
    ? JSON.parse(cookies)
    : cookies;

  if (validCookiesList && validCookiesList.length > 0) {
    // Filter out expired cookies
    const validCookies = validCookiesList.filter(cookie => {
      if (cookie.expires && cookie.expires !== -1) {
        return (cookie.expires * 1000) > Date.now();
      }
      return true; // Keep session cookies
    });

    if (validCookies.length > 0) {
      // Playwright migration: 向 context 添加 cookies
      await page.context().addCookies(validCookies);
      console.log(`[load_cookie] Loaded ${validCookies.length} valid cookies.`);
      return true;
    } else {
      console.log('[load_cookie] All cookies were expired. Starting fresh.');
      return false;
    }
  }
}

// 我们不再在 whenReady 里注册，而是导出一个函数
export function registerIpcHandlers() {

  ipcMain.on('auth:set-token', (event, token) => {
    console.log('[Main] 成功接收并存储了 Auth Token');
    globalAuthToken = token;
  });

  /**
   * 监听来自渲染器的 'auth:clear-token' 事件
   */

  ipcMain.on('auth:clear-token', () => {
    console.log('[Main] 已清除 Auth Token (用户登出)');
    globalAuthToken = null;
  });

  // --- 关键修改：browser:launch 不再接收 token 参数 ---
  ipcMain.handle('browser:launch', async (event, browserId) => {
    console.log('[主进程] 收到浏览器启动请求:', { browserId });

    // --- 关键修改：使用全局 Token ---
    if (!globalAuthToken) {
      console.error('[主进程] 启动失败: 主进程未收到认证 Token。');
      return { success: false, error: '主进程未认证，请重新登录。' };
    }

    try {
      // 将全局 Token 传递给 playwrightManager
      const result = await playwrightManager(browserId, globalAuthToken)
      return result
    } catch (error) {
      console.error('[主进程] 浏览器启动异常:', error)
      return { success: false, error: `主进程异常: ${error.message}` }
    }
  })


  ipcMain.handle('browser:close', async (event, browserId) => {
    try {
      const result = await closeBrowser(browserId)
      return result
    } catch (error) {
      console.error('[主进程] 浏览器关闭异常:', error)
      return { success: false, error: `主进程异常: ${error.message}` }
    }
  })

  ipcMain.handle('browser:getRunningInstances', async () => {
    try {
      const result = getRunningInstances()
      return result
    } catch (error) {
      console.error('[主进程] 获取运行实例异常:', error)
      return { success: false, error: `主进程异常: ${error.message}` }
    }
  })

  ipcMain.handle('playwright:launch', async (event, options) => {
    return await playwrightManager(options?.browserId || Date.now().toString(), null)
  })
}

// Playwright 管理器
const playwrightManager = async (browserId, token = null) => {
  // ... (从 main.js 完整复制 playwrightManager 的代码)
  // ... 注意：确保 import { mainApiClient } 路径正确
  let browser;
  var browserProfile;
  try {
    var launch_config = {};
    // 定义一个局部变量来存当前浏览器的 Cookie
    let cookiesToInject = [];

    try {
      console.log('init start playwrightManager!')
      if (!token) throw new Error("Token is null in playwrightManager");

      browserProfile = await mainApiClient.getBrowserProfile(browserId, token);
      console.log('browserProfile:', browserProfile)
      launch_config = JSON.parse(browserProfile.launch_config);
      // --- 修复开始: 解析并获取 Cookie ---
      if (browserProfile.cookies) {
        try {
          // 数据库里存的通常是字符串，需要 parse，如果是对象则直接用
          cookiesToInject = typeof browserProfile.cookies === 'string'
            ? JSON.parse(browserProfile.cookies)
            : browserProfile.cookies;

          console.log(`[主进程] 获取到 ${cookiesToInject.length} 个 Cookie 准备注入`);
        } catch (e) {
          console.error('[主进程] Cookie 解析失败:', e);
        }
      }
      // --- 修复结束 ---

    } catch (parseError) {
      console.error('JSON 解析失败！原始值:', (parseError).configValue); // 假设你能拿到原始值
      console.error('解析错误详情:', parseError.message);
      throw parseError;
    }


    // 1. 先启动浏览器
    const cfOptions = await launchOptions({ /* Camoufox options */ });
    browser = await firefox.launch({
      ...cfOptions,
      headless: false,
      humanize: true, // Enable human-like mouse movement
      geoip: false, // ⚠️ DISABLE to fix mmdb crash
      locale: 'zh-CN',//os: 'macos', // Or 'windows' depending on preference, sticking to macos for consistency
      fonts: [
        'SimSun',           // Windows 宋体
        'Microsoft YaHei',  // Windows 微软雅黑
        'PingFang SC',      // macOS 苹方
        'Hiragino Sans GB', // macOS 冬青黑体
        'sans-serif'        // 最终回退
      ],
      proxy: {
        server: launch_config.proxy
      },
      firefoxUserPrefs: {
        ...cfOptions.firefoxUserPrefs,
        // 关键修复：关闭隔离以允许 Tab 间共享 Cookie
        'privacy.firstparty.isolate': false,
        'privacy.userContext.enabled': false,
        'network.cookie.cookieBehavior': 0,
        // --- 增强修改：更激进地关闭隐私隔离 ---
        'privacy.resistFingerprinting': false,
        'privacy.trackingprotection.enabled': false,
        'browser.privatebrowsing.autostart': false,
        'dom.storage.enabled': true,
        // --- Round 3: The Hammer ---
        'privacy.partition.network_state': false,
        'privacy.partition.serviceWorkers': false,
        'browser.cache.disk.enable': false,
      }
    });

    // 2. 创建浏览器上下文并注入 Cookie
    var context = await browser.newContext(); // 赋值给 context
    if (cookiesToInject && cookiesToInject.length > 0) {
      await context.addCookies(cookiesToInject);
      console.log(`[主进程] 注入 Cookie 完成。Sample: ${cookiesToInject[0]?.name}`);
    }

    // 3. 在所有实例都创建完毕后，再创建 browserData 对象
    const browserData = {
      browser: browser,     // 存储浏览器实例
      context: context,     // 存储上下文实例
      startTime: new Date(),
      accountId: browserId,
      token: token,
      saveInterval: null,
      lastCookieStr: '', // 新增：用于比对
      // 新增：防抖保存函数 (2秒防抖)
      triggerSave: debounce(() => saveCookiesForBrowser(browserId), 2000)
    };
    runningBrowsers.set(browserId, browserData);

    // --- 关键修改：事件监听 ---
    // 对每一个新打开的页面 (Page) 进行监听
    context.on('page', async (page) => {
      console.log('[主进程] New page created in context.');

      // --- The Hammer: 强制重注 Cookie ---
      if (cookiesToInject && cookiesToInject.length > 0) {
        try {
          console.log(`[主进程] Attempting re-injection of ${cookiesToInject.length} cookies...`);
          await context.addCookies(cookiesToInject);
          console.log(`[主进程] 🔨 Forced cookie re-injection for new page.`);
        } catch (e) {
          console.error(`[主进程] Re-injection failed: ${e.message}`);
        }
      } else {
        console.log(`[主进程] No cookies to re-inject. (cookiesToInject is empty or null)`);
      }

      // 调试：打印当新页面打开时的 Cookie 数量
      page.context().cookies().then(cookies => {
        console.log(`[主进程] New page sees ${cookies.length} cookies.`);
        if (cookies.length > 0) {
          console.log(`[主进程] First cookie seen: ${cookies[0].name}`);
        }
      });

      // 当页面跳转/加载完成时，极大概率 Cookie 变了 (如登录成功跳转)
      page.on('framenavigated', () => {
        browserData.triggerSave();
      });

      // 如果页面关闭，也检查一次
      page.on('close', () => {
        browserData.triggerSave();
      });
    });
    const page = await context.newPage(); // 从上下文中创建新页面
    await load_cookie(page, cookiesToInject)
    await page.goto('https://abrahamjuliot.github.io/creepjs/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    runningBrowsers.set(browserId, browserData);

    // 步骤 3: 启动定时器，自动保存 Cookie (例如每 1 分钟)
    browserData.saveInterval = setInterval(() => {
      saveCookiesForBrowser(browserId);
    }, 5 * 60 * 1000);


    console.log(`🎉 [主进程] 浏览器 ${browserId} 完全启动成功!`);

    return { success: true, /* ... */ };

  } catch (error) {
    console.log(error)
    // ... (错误处理部分不变) ...
    return { success: false, /* ... */ };
  }
}

// 保存 Cookie 的辅助函数
const saveCookiesForBrowser = async (browserId) => {
  const browserData = runningBrowsers.get(browserId);
  if (!browserData || !browserData.token) return;

  try {
    const context = browserData.browser.contexts()[0];
    if (!context) return;

    const cookies = await context.cookies();

    // --- 差异对比逻辑 ---
    // 简单排序以保证序列化一致性
    cookies.sort((a, b) => (a.name > b.name) ? 1 : -1);
    const currentCookieStr = JSON.stringify(cookies);

    // 如果哈希/字符串一致，说明没变化，直接返回
    if (browserData.lastCookieStr === currentCookieStr) {
      return;
    }

    await mainApiClient.updateBrowserCookies(browserId, cookies, browserData.token);

    // 更新缓存
    browserData.lastCookieStr = currentCookieStr;
    console.log(`[主进程] ♻️ Cookie 发生变动，已同步至服务器 - ${browserId}`);

  } catch (error) {
    console.error(`[主进程] 保存 Cookie 失败 ${browserId}:`, error.message);
  }
};

// 关闭浏览器
const closeBrowser = async (browserId) => {
  try {
    const browserData = runningBrowsers.get(browserId);
    if (!browserData) {
      return { success: false, error: '实例未找到' };
    }

    if (browserData.saveInterval) {
      clearInterval(browserData.saveInterval);
    }

    console.log(`[主进程] 正在为 ${browserId} 执行最后一次 Cookie 保存...`);
    // --- 关键修改 10: saveCookies 会自己从 map 拿 token ---
    await saveCookiesForBrowser(browserId);

    await browserData.browser.close();
    runningBrowsers.delete(browserId);

    return { success: true, message: `浏览器 ${browserId} 已关闭` };

  } catch (error) {
    console.error(`[主进程] 关闭浏览器 ${browserId} 异常:`, error.message)
    return { success: false, error: error.message }
  }
}
// 获取运行中的浏览器实例
const getRunningInstances = () => {
  const instances = Array.from(runningBrowsers.values()).map(browser => ({
    accountId: browser.accountId,
    accountName: `浏览器 ${browser.accountId}`,
    startTime: browser.startTime
  }));

  return {
    success: true,
    data: instances
  };
}
