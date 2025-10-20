// src/main/mainApiClient.js

const API_BASE_URL = 'https://aiinfo-api.hackx.dpdns.org';

/**
 * 封装主进程的 fetch 请求
 * @param {string} url - 目标 URL
 * @param {string} token - 认证 Token
 * @param {object} options - Fetch 选项
 * @returns {Promise<object>} - 解析后的 JSON 结果
 */
const mainFetch = async (url, token, options = {}) => {
    if (!token) {
        throw new Error('未提供身份验证令牌 (token)');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('身份验证失败 (Token 无效或已过期)');
        }
        const errorBody = await response.text();
        throw new Error(`API 请求失败: ${response.status} - ${errorBody}`);
    }

    return response.json();
}

// 统一的 API 接口
export const mainApiClient = {
    /**
     * 获取单个浏览器配置
     * @param {string} browserId 
     * @param {string} token 
     * @returns {Promise<object | null>}
     */
    getBrowserProfile: async (browserId, token) => {
        try {
            const result = await mainFetch('/api/browsers', token, { method: 'GET' });
            return result.data.find(b => b.browser_id === browserId) || null;
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
                method: 'PUT',
                body: JSON.stringify({
                    cookies: JSON.stringify(cookies) // 确保后端接收的是字符串
                })
            });
            console.log(`[MainApiClient] ✅ 成功为 ${browserId} 保存 Cookie。`);
            return result;
        } catch (error) {
            console.error(`[MainApiClient] ❌ 为 ${browserId} 保存 Cookie 时出错:`, error.message);
            throw error;
        }
    }
}