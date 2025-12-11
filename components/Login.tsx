
import React, { useState } from 'react';
import { ServerConfig, ServerType } from '../types';
import { ClientFactory } from '../services/clientFactory';
import { Server, User, Key, Loader2, Info, MonitorPlay } from 'lucide-react';

interface LoginProps {
  onLogin: (config: ServerConfig) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [serverType, setServerType] = useState<ServerType>('emby');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    let formattedUrl = serverUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `http://${formattedUrl}`;
    }

    try {
      const config = await ClientFactory.authenticate(serverType, formattedUrl, username, password);
      onLogin(config);
    } catch (err: any) {
      console.error(err);
      setError(serverType === 'plex' 
        ? 'Plex连接失败。请尝试使用X-Plex-Token作为密码。'
        : '连接失败。请检查地址、账号密码，并确保服务端允许跨域访问（CORS）。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 mb-2">
            EmbyTok
            </h1>
            <p className="text-zinc-400">竖屏媒体中心客户端</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          
          {/* Server Type Selector */}
          <div className="flex bg-zinc-800 rounded-lg p-1 mb-4">
              <button 
                type="button"
                onClick={() => setServerType('emby')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all focus:ring-2 focus:ring-indigo-500 outline-none ${serverType === 'emby' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                  Emby / Jellyfin
              </button>
              <button 
                type="button"
                onClick={() => setServerType('plex')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all focus:ring-2 focus:ring-indigo-500 outline-none ${serverType === 'plex' ? 'bg-yellow-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                  Plex
              </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase">服务器地址</label>
            <div className="relative">
                <Server className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder={serverType === 'plex' ? 'http://192.168.1.10:32400' : 'http://192.168.1.100:8096'}
                className="w-full bg-zinc-800 border-none rounded-xl py-3 pl-10 text-white placeholder-zinc-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
                />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase">用户名</label>
            <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={serverType === 'plex' ? '可选 (默认 User)' : 'User'}
                className="w-full bg-zinc-800 border-none rounded-xl py-3 pl-10 text-white placeholder-zinc-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                required={serverType === 'emby'}
                />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase">{serverType === 'plex' ? 'X-Plex-Token / 密码' : '密码'}</label>
             <div className="relative">
                <Key className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
                <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={serverType === 'plex' ? '必填' : '可选'}
                className="w-full bg-zinc-800 border-none rounded-xl py-3 pl-10 text-white placeholder-zinc-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm flex gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-white outline-none ${serverType === 'plex' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '连接'}
          </button>
        </form>
        
        <div className="text-center text-xs text-zinc-600 px-4">
            <p>EmbyTok 是非官方客户端。支持 Emby、Jellyfin 和 Plex 服务端。</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
