import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage'; // 引入登录页
import BrowserManager from './pages/BrowserManager'; // 引入你之前的浏览器管理页

function App() {
    const [token, setToken] = useState(localStorage.getItem('jwt_token'));
    const [user, setUser] = useState(null); // 可以存储一些用户信息

    // 应用加载时检查 token
    useEffect(() => {
        const storedToken = localStorage.getItem('jwt_token');
        if (storedToken) {
            setToken(storedToken);
            // 你可以在这里加一个API调用来验证token并获取用户信息
        }
    }, []);

    // 登录成功的回调
    const handleLoginSuccess = (newToken) => {
        localStorage.setItem('jwt_token', newToken);
        setToken(newToken);
    };
    
    // 登出的处理
    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        setToken(null);
    }

    if (!token) {
        return <LoginPage onLoginSuccess={handleLoginSuccess} />;
    }

    // 传入一个 onLogout 函数给 BrowserManager
    return <BrowserManager onLogout={handleLogout} />;
}

export default App;