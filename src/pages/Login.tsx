import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Toast } from '../components/ui';
import { useAuth } from '../hooks/AuthContext';
import { customColors } from '../lib/customColors';
export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, logout, isLoading } = useAuth();
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => setToast({ message: '', visible: false }), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const doctor = await login(email, password);
      if (doctor?.role !== 'doctor') {
        await logout();
        setToast({ message: 'Access denied. This portal is for doctors only. Please use the Anixi patient app.', visible: true });
        return;
      }
      navigate('/dashboard');
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('patient app')) {
        setToast({ message: msg, visible: true });
      } else {
        setError('Invalid email or password');
      }
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-anixi-beige py-12 px-4 sm:px-6 lg:px-8">
      {}
      {toast.visible && (
        <Toast
          message={toast.message}
          type="error"
          onClose={() => setToast({ message: '', visible: false })}
        />
      )}
      <div className="max-w-md w-full space-y-8">
        <div>
          <img 
            src="/anixi.png" 
            alt="Anixi Health Logo" 
            className="h-20 w-20 mx-auto mb-4 object-contain"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Anixi Doctor Portal
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[${customColors.primary}] focus:border-[${customColors.primary}] focus:z-10 sm:text-sm`}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[${customColors.primary}] focus:border-[${customColors.primary}] focus:z-10 sm:text-sm`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-anixi-green hover:bg-anixi-green hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-anixi-green disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};