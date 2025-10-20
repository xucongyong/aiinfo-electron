// 这个文件用来统一处理与后端 API 的交互

// 获取保存在本地的 Token
const getToken = () => localStorage.getItem('jwt_token');

// 基础请求函数，自动添加认证头
const request = async (url, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`https://aiinfo-api.hackx.dpdns.org${url}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            // 如果是401未授权，可能是token过期，直接登出
            if (response.status === 401) {
                console.warn('Authentication error, logging out.');
                localStorage.removeItem('jwt_token');
                window.location.reload(); // 刷新页面，自动跳转到登录页
            }
            // 尝试解析错误信息
            const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }
        return response.json();
    } catch (error) {
        console.error(`API request to ${url} failed:`, error);
        // 为了保持一致性，也返回一个带 error 的对象
        return { success: false, error: error.message };
    }
};

const apiClient = {
    // --- Auth ---
    login: (username, password) => request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    }),
    register: (username, password) => request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    }),

    // --- Browsers (现在会自动带上Token) ---
    getBrowsers: () => request('/api/browsers'),
    createBrowser: (data) => request('/api/browsers', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateBrowser: (data) => request(`/api/browsers?browser_id=${data.browser_id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    deleteBrowser: (browserId) => request(`/api/browsers`, { // 注意：DELETE方法通常把ID放在URL或请求体中
        method: 'DELETE',
        body: JSON.stringify({ browser_id: browserId }),
    }),
};

export default apiClient;