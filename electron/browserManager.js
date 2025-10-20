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

// --- 关键修改：重构所有 IPC Handler ---
// 我们不再在 whenReady 里注册，而是导出一个函数
export function registerIpcHandlers() {
 ipcMain.on('ping', () => {
    console.log('pong')
  })

  // --- 关键新增：Token 管理的 IPC Handler ---
  ipcMain.handle('auth:setToken', (event, token) => {
    console.log('🔒 [Main] 收到并设置了全局认证 Token。');
    globalAuthToken = token;
    return { success: true };
  });

  ipcMain.handle('auth:clearToken', () => {
    console.log('🔒 [Main] 全局认证 Token 已清除。');
    globalAuthToken = null;
    return { success: true };
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

// --- 所有的 Playwright 管理函数 ---

// Playwright 管理器
const playwrightManager = async (browserId, token=null) => {
  // ... (从 main.js 完整复制 playwrightManager 的代码)
  // ... 注意：确保 import { mainApiClient } 路径正确
  let browser;

  try {
    var savedCookies = []; // 最好给个类型
    var launch_config = {};
    try {
      // 注意：这里 token 可能是 null，需要处理
      if (!token) throw new Error("Token is null in playwrightManager");
      
      const browserProfile = await mainApiClient.getBrowserProfile(browserId, token);
      console.log(' 实际获取的 launch_config 值:', browserProfile.launch_config); 
      launch_config = JSON.parse(browserProfile.launch_config);
    } catch (parseError) {
      console.error('JSON 解析失败！原始值:', (parseError).configValue); // 假设你能拿到原始值
      console.error('解析错误详情:', parseError.message);
      throw parseError; 
    }
    // ... (剩余的 playwrightManager 代码)
    
    // 确保 browserData 的类型（如果需要）
    const browserData = {
      browser,
      // page, // 译注：你的 main.js 里有 page 和 context，这里也应该有
      // context,
      startTime: new Date(),
      accountId: browserId,
      token: token,
      saveInterval: null // 稍后赋值
    };
    // ...
    // ... (剩余的 playwrightManager 代码)
  } catch (error) {
    console.error(`[主进程] 浏览器启动异常:`, error.message);
    return { success: false, error: `主进程异常: ${error.message}` };
  }
}


// 保存 Cookie 的辅助函数
const saveCookiesForBrowser = async (browserId) => {
  const browserData = runningBrowsers.get(browserId);
  // --- 关键修改 8: 从实例中获取 token ---
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
    
    // --- 关键修改 9: 使用“统一”的 API ---
    await mainApiClient.updateBrowserCookies(browserId, cookies, tokenToUse);

  } catch (error) {
    // 错误已在 mainApiClient 中打印
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



// 清理所有浏览器实例
export const cleanupAllBrowsers = async () => {
  const savePromises = [];
  for (const browserId of runningBrowsers.keys()) {
    // --- 关键修改 4: 从 browserData 中获取 token ---
    const browserData = runningBrowsers.get(browserId);
    if (browserData && browserData.token) {
      savePromises.push(saveCookiesForBrowser(browserId)); // saveCookies 会自己从 map 读
    }
  }
  await Promise.all(savePromises);

  for (const [browserId, browserData] of runningBrowsers) {
    try {
      if (browserData.saveInterval) {
          clearInterval(browserData.saveInterval);
      }
      await browserData.browser.close();
      console.log(`Browser ${browserId} closed`);
    } catch (error) {
      console.error(`Error closing browser ${browserId}:`, error.message);
    }
  }
  runningBrowsers.clear();
}