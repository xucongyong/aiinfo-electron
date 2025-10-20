import { useState } from 'react';
import apiClient from '@services/apiClient.js';
// We'll use these components from our new UI library
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = ({ onLoginSuccess }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            let response;
            if (isRegistering) {
                response = await apiClient.register(username, password);
                if (response.success) {
                    alert('Registration successful! Please log in.');
                    setIsRegistering(false);
                }
            } else {
                response = await apiClient.login(username, password);
                if (response.success && response.token) {
                    onLoginSuccess(response.token);
                }
            }
            if (!response.success) {
                throw new Error(response.error || 'Operation failed');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">{isRegistering ? 'Create Account' : 'Welcome Back'}</CardTitle>
                    <CardDescription>
                        {isRegistering ? 'Enter your details to get started.' : 'Enter your credentials to access your dashboard.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g., john.doe"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
                        </Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                        <Button variant="link" onClick={() => setIsRegistering(!isRegistering)}>
                            {isRegistering ? 'Login' : 'Register'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginPage;