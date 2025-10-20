import { useState, useEffect } from 'react'
import apiClient from '@/services/apiClient.js'

const BrowserManager = () => {
  const [browsers, setBrowsers] = useState([])
  const [runningInstances, setRunningInstances] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingBrowser, setEditingBrowser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    userAgent: '',
    viewport: '1920x1080',
    proxy: '',
    notes: ''
  })

  // --- 关键修复 ---
  // 使用 useEffect 来确保组件加载时自动获取数据
  useEffect(() => {
    // 这个函数会在组件第一次渲染到屏幕上后自动运行
    console.log("Component mounted, fetching initial data...");
    getBrowsers();
    getRunningInstances();

    // 设置一个定时器，每 5 秒钟刷新一次正在运行的实例列表
    const interval = setInterval(() => {
        getRunningInstances();
    }, 5000);

    // 组件卸载时清除定时器，防止内存泄漏
    return () => clearInterval(interval);
  }, []); // 空数组 [] 意味着这个 effect 只会在组件挂载时运行一次


// 获取所有浏览器配置
const getBrowsers = async () => {
    try {
      // 优先从后端 API 获取
      const response = await apiClient.getBrowsers();
      if (response.success) {
        setBrowsers(response.data || []);
        // 可选：将后端数据同步到本地，作为缓存
        localStorage.setItem('browserProfiles', JSON.stringify(response.data || []));
      } else {
        console.error('获取浏览器列表失败:', response.error);
        // 如果后端失败，再尝试从本地存储获取
        const savedBrowsers = localStorage.getItem('browserProfiles');
        if (savedBrowsers) setBrowsers(JSON.parse(savedBrowsers));
      }
    } catch (error) {
      console.error('获取浏览器配置网络错误:', error);
      // 如果网络错误，也尝试从本地存储获取
      const savedBrowsers = localStorage.getItem('browserProfiles');
      if (savedBrowsers) setBrowsers(JSON.parse(savedBrowsers));
    }
};

  // 获取运行中的实例
  const getRunningInstances = async () => {
    try {
      if (window.api && window.api.browser) {
        const result = await window.api.browser.getRunningInstances()
        if (result.success) {
          setRunningInstances(result.data || [])
        }
      }
    } catch (error) {
      console.error('获取运行实例失败:', error)
    }
  }


// 保存浏览器配置
const saveBrowser = async () => {
    if (!formData.name.trim()) {
      alert('请输入浏览器名称');
      return;
    }

    setLoading(true);
    try {
        const isEditing = !!editingBrowser;
        
        // 准备要发送到后端的数据
        const browserPayload = {
            // 如果是编辑，使用旧的 ID；如果是新增，生成新的唯一 ID
            browser_id: isEditing ? editingBrowser.browser_id : `browser_${Date.now()}`,
            name: formData.name,
            launch_config: JSON.stringify({
              userAgent: formData.userAgent,
              viewport: formData.viewport,
              proxy: formData.proxy,
              notes: formData.notes
            }),
            // 如果需要保存 cookies，也在这里处理
            cookies: isEditing ? (editingBrowser.cookies || '[]') : '[]' 
        };

        // 添加日志方便调试
        if (isEditing) {
            console.log("🚀 [前端] 正在更新浏览器, 发送的数据:", browserPayload);
        } else {
            console.log("🚀 [前端] 正在创建新浏览器, 发送的数据:", browserPayload);
        }
        
        // 调用后端 API
        const response = isEditing
            ? await apiClient.updateBrowser(browserPayload)
            : await apiClient.createBrowser(browserPayload);

            
        if (response.success) {
            alert(isEditing ? '浏览器配置更新成功' : '浏览器配置创建成功');
            // 操作成功后，重新从服务器获取最新列表，确保数据同步
            await getBrowsers();
            setShowModal(false);
            setEditingBrowser(null);
            resetForm();
        } else {
            throw new Error(response.error || '保存失败');
        }

    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
};

 // 删除浏览器配置
const deleteBrowser = async (browserId) => {
    if (!confirm('确定要删除这个浏览器配置吗？')) return;

    try {
      
      const response = await apiClient.deleteBrowser(browserId);
      if (response.success) {
          alert('浏览器配置删除成功');
          // 删除成功后，重新获取列表
          await getBrowsers();
      } else {
          throw new Error(response.error || '删除失败');
      }
    } catch (error)
    {
      console.error('删除失败:', error);
      alert('删除失败: ' + error.message);
    }
};


  // 启动浏览器
  const launchBrowser = async (browserId) => {
    console.log('🚀 [前端] 开始启动浏览器:', { browserId });
    setLoading(true)
    try {
      if (window.api && window.api.browser && window.api.browser.launch) {
        const result = await window.api.browser.launch(browserId)
        if (result && result.success) {
          alert(result.message || '浏览器启动成功');
          await getRunningInstances();
        } else {
          const errorMsg = result?.error || '未知错误';
          alert(`启动失败: ${errorMsg}`);
        }
      } else {
        alert('启动 API 不可用，请检查应用状态');
      }
    } catch (error) {
      console.error('💥 [前端] 启动浏览器异常:', error);
      alert(`启动异常: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  // 关闭浏览器
  const closeBrowser = async (accountId) => {
    if (!confirm('确定要关闭这个浏览器实例吗？')) return

    setLoading(true)
    try {
      if (window.api && window.api.browser) {
        const result = await window.api.browser.close(accountId)
        if (result.success) {
          alert('浏览器已关闭');
          getRunningInstances();
        } else {
          alert('关闭失败: ' + result.error);
        }
      }
    } catch (error) {
      console.error('关闭浏览器失败:', error);
      alert('关闭失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  // 编辑浏览器配置
  const editBrowser = (browser) => {
    setEditingBrowser(browser);
    // 解析 launch_config 来填充表单
    let launchConfig = {};
    try {
        launchConfig = typeof browser.launch_config === 'string' ? JSON.parse(browser.launch_config) : (browser.launch_config || {});
    } catch(e) {
        console.error("Failed to parse launch_config:", browser.launch_config);
    }

    setFormData({
      name: browser.name || '',
      userAgent: launchConfig.userAgent || '',
      viewport: launchConfig.viewport || '1920x1080',
      proxy: launchConfig.proxy || '',
      notes: launchConfig.notes || ''
    });
    setShowModal(true);
  }

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      userAgent: '',
      viewport: '1920x1080',
      proxy: '',
      notes: ''
    })
  }

  // 打开新增模态框
  const openAddModal = () => {
    setEditingBrowser(null)
    resetForm()
    setShowModal(true)
  }

  // 检查浏览器是否运行中
  const isBrowserRunning = (browserId) => {
    return runningInstances.some(instance => instance.accountId === browserId)
  }

  // 从 launch_config 解析数据用于显示
  const getDisplayData = (browser) => {
      let config = {};
      try {
        config = typeof browser.launch_config === 'string' ? JSON.parse(browser.launch_config) : (browser.launch_config || {});
      } catch (e) {
        // 解析失败则返回默认值
      }
      return {
          viewport: config.viewport || 'N/A',
          proxy: config.proxy || '-'
      };
  }

  return (
    <div>
       <div className="page-header">
        <h1 className="page-title">🌐 指纹浏览器管理</h1>
        <button
          onClick={openAddModal}
          className="btn btn-primary"
        >
          ➕ 新增浏览器配置
        </button>
        {/* 新增的登出按钮 */}
            <button
              className="btn btn-secondary"
            >
              登出
            </button>
      </div>

      <div className="card">
        <h2 className="card-title">
          浏览器配置 ({browsers.length} 个)
        </h2>

        {browsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🌐</div>
            <div className="empty-state-text">暂无浏览器配置</div>
            <div className="empty-state-hint">点击"新增浏览器配置"开始</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>分辨率</th>
                <th>代理</th>
                <th>创建时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {browsers.map(browser => {
                const isRunning = isBrowserRunning(browser.browser_id);
                const displayData = getDisplayData(browser);
                return (
                  <tr key={browser.browser_id}>
                    <td><strong>{browser.name}</strong></td>
                    <td>{displayData.viewport}</td>
                    <td>{displayData.proxy}</td>
                    <td>{new Date(browser.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${isRunning ? 'status-running' : 'status-stopped'}`}>
                        {isRunning ? '运行中' : '已停止'}
                      </span>
                    </td>
                    <td>
                      <div className="button-group">
                        <button
                          onClick={() => launchBrowser(browser.browser_id)}
                          disabled={loading || isRunning}
                          className="btn btn-success"
                        >
                          {isRunning ? '🟢 运行中' : '▶️ 启动'}
                        </button>
                        <button
                          onClick={() => editBrowser(browser)}
                          className="btn btn-secondary"
                        >
                          ✏️ 编辑
                        </button>
                        <button
                          onClick={() => deleteBrowser(browser.browser_id)}
                          disabled={isRunning}
                          className="btn btn-danger"
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {/* 运行中的实例 */}
      <div className="card">
        <h2 className="card-title">
          运行中的浏览器实例 ({runningInstances.length} 个)
        </h2>

        {runningInstances.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🌐</div>
            <div className="empty-state-text">暂无运行的浏览器实例</div>
            <div className="empty-state-hint">选择一个浏览器配置并点击"启动"开始</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>实例ID</th>
                <th>配置名称</th>
                <th>状态</th>
                <th>启动时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {runningInstances.map(instance => (
                <tr key={instance.accountId}>
                  <td><strong>{instance.accountId}</strong></td>
                  <td>
                    {browsers.find(b => b.browser_id === instance.accountId)?.name || '未知配置'}
                  </td>
                  <td>
                    <span className="status-badge status-running">运行中</span>
                  </td>
                  <td>{instance.startTime ? new Date(instance.startTime).toLocaleString() : '-'}</td>
                  <td>
                    <button
                      onClick={() => closeBrowser(instance.accountId)}
                      disabled={loading}
                      className="btn btn-danger"
                    >
                      ❌ 关闭
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- 关键修复 --- */}
      {/* 新增/编辑模态框 */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">
              {editingBrowser ? '编辑浏览器配置' : '新增浏览器配置'}
            </h3>

            <div className="form-group">
              <label className="form-label">配置名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="form-input"
                placeholder="例如：营销账号1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">User Agent</label>
              <input
                type="text"
                value={formData.userAgent}
                onChange={(e) => setFormData({...formData, userAgent: e.target.value})}
                className="form-input"
                placeholder="留空使用默认 User Agent"
              />
            </div>

            <div className="form-group">
              <label className="form-label">分辨率</label>
              <select
                value={formData.viewport}
                onChange={(e) => setFormData({...formData, viewport: e.target.value})}
                className="form-select"
              >
                <option value="1920x1080">1920x1080</option>
                <option value="1366x768">1366x768</option>
                <option value="1440x900">1440x900</option>
                <option value="1536x864">1536x864</option>
                <option value="1280x720">1280x720</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">代理设置</label>
              <input
                type="text"
                value={formData.proxy}
                onChange={(e) => setFormData({...formData, proxy: e.target.value})}
                className="form-input"
                placeholder="例如：http://127.0.0.1:8080"
              />
            </div>

            <div className="form-group">
              <label className="form-label">备注</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="form-textarea"
                placeholder="添加备注信息..."
              />
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={saveBrowser}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? '保存中...' : (editingBrowser ? '更新' : '保存')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BrowserManager

