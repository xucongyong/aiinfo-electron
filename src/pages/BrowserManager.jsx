import { useState, useEffect } from 'react'
import apiClient from './apiClient.js' // 你的 API 客户端
import {
  Button
} from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog" // 替换你的 Modal
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select" // 替换你的 select
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge" // 替换你的 status-badge
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  Play,
  X,
  LogOut,
  Loader2
} from "lucide-react" // 引入图标

// 假设你从父组件传入 onLogout 函数
const BrowserManager = ({ onLogout }) => {
  const [browsers, setBrowsers] = useState([])
  const [runningInstances, setRunningInstances] = useState([])
  const [loading, setLoading] = useState(false)
  
  // --- shadcn/ui 弹窗状态管理 ---
  // 我们仍然使用你原有的 showModal 状态来控制 Dialog
  const [showModal, setShowModal] = useState(false)
  const [editingBrowser, setEditingBrowser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    userAgent: '',
    viewport: '1920x1080',
    proxy: '',
    notes: ''
  })

  // --- 你的所有逻辑函数 (useEffect, getBrowsers, saveBrowser, etc.) ---
  // --- 保持不变，这里省略了，因为它们功能完好 ---

  // [从你文件中复制 useEffect, getBrowsers, getRunningInstances, 
  //  saveBrowser, deleteBrowser, launchBrowser, closeBrowser]
  // ... (逻辑代码和你的文件一样)

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
    window.electron.ipcRenderer.send('ping')
    console.log('🚀 [前端] 开始启动浏览器:', { browserId });
    console.log(window.electron)
    console.log(window.ipcRenderer)
    console.log(window.api)
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


  // --- 以下是全新的 shadcn/ui 视图 ---
  return (
    <div className="p-6 space-y-6">
       <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🌐 指纹浏览器管理</h1>
        <div className="flex items-center gap-2">
            <Button onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-2" /> 新增浏览器配置
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" /> 登出
            </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>浏览器配置 ({browsers.length} 个)</CardTitle>
          <CardDescription>管理你所有的浏览器环境配置</CardDescription>
        </CardHeader>
        <CardContent>
          {browsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Globe className="w-16 h-16 text-muted-foreground" />
              <p className="mt-4 text-lg text-muted-foreground">暂无浏览器配置</p>
              <p className="text-sm text-muted-foreground">点击"新增浏览器配置"来创建第一个</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>分辨率</TableHead>
                  <TableHead>代理</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {browsers.map(browser => {
                  const isRunning = isBrowserRunning(browser.browser_id);
                  const displayData = getDisplayData(browser);
                  return (
                    <TableRow key={browser.browser_id}>
                      <TableCell className="font-medium">{browser.name}</TableCell>
                      <TableCell>{displayData.viewport}</TableCell>
                      <TableCell>{displayData.proxy}</TableCell>
                      <TableCell>{new Date(browser.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={isRunning ? "default" : "outline"} className={isRunning ? "bg-green-600 text-white" : ""}>
                          {isRunning ? '运行中' : '已停止'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          onClick={() => launchBrowser(browser.browser_id)}
                          disabled={loading || isRunning}
                          variant="secondary"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {isRunning ? '运行中' : '启动'}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => editBrowser(browser)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => deleteBrowser(browser.browser_id)}
                          disabled={isRunning}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* 运行中的实例 */}
      <Card>
        <CardHeader>
          <CardTitle>运行中的浏览器实例 ({runningInstances.length} 个)</CardTitle>
          <CardDescription>查看和管理当前正在运行的浏览器</CardDescription>
        </CardHeader>
        <CardContent>
          {runningInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Globe className="w-16 h-16 text-muted-foreground" />
              <p className="mt-4 text-lg text-muted-foreground">暂无运行的浏览器实例</p>
              <p className="text-sm text-muted-foreground">从上方配置列表启动一个浏览器</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>实例ID</TableHead>
                  <TableHead>配置名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>启动时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runningInstances.map(instance => (
                  <TableRow key={instance.accountId}>
                    <TableCell className="font-medium">{instance.accountId}</TableCell>
                    <TableCell>
                      {browsers.find(b => b.browser_id === instance.accountId)?.name || '未知配置'}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-600 text-white">运行中</Badge>
                    </TableCell>
                    <TableCell>{instance.startTime ? new Date(instance.startTime).toLocaleString() : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => closeBrowser(instance.accountId)}
                        disabled={loading}
                      >
                        <X className="w-4 h-4 mr-2" />
                        关闭
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑模态框 (使用 Dialog) */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingBrowser ? '编辑浏览器配置' : '新增浏览器配置'}
            </DialogTitle>
            <DialogDescription>
              {editingBrowser ? '修改配置详情' : '创建一个新的浏览器环境配置'}
            </DialogDescription>
          </DialogHeader>
          
          {/* 表单内容 */}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                配置名称 *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="col-span-3"
                placeholder="例如：营销账号1"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="userAgent" className="text-right">
                User Agent
              </Label>
              <Input
                id="userAgent"
                value={formData.userAgent}
                onChange={(e) => setFormData({...formData, userAgent: e.target.value})}
                className="col-span-3"
                placeholder="留空使用默认 User Agent"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="viewport" className="text-right">
                分辨率
              </Label>
              <Select
                value={formData.viewport}
                onValueChange={(value) => setFormData({...formData, viewport: value})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择分辨率" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1920x1080">1920x1080</SelectItem>
                  <SelectItem value="1366x768">1366x768</SelectItem>
                  <SelectItem value="1440x900">1440x900</SelectItem>
                  <SelectItem value="1536x864">1536x864</SelectItem>
                  <SelectItem value="1280x720">1280x720</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="proxy" className="text-right">
                代理设置
              </Label>
              <Input
                id="proxy"
                value={formData.proxy}
                onChange={(e) => setFormData({...formData, proxy: e.target.value})}
                className="col-span-3"
                placeholder="例如：http://127.0.0.1:8080"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                备注
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="col-span-3"
                placeholder="添加备注信息..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              取消
            </Button>
            <Button
              onClick={saveBrowser}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? '保存中...' : (editingBrowser ? '更新' : '保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BrowserManager