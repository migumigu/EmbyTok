
import React, { useState, useEffect } from 'react';
import { ServerConfig, ServerType } from '../types';
import { ClientFactory } from '../services/clientFactory';
import { Server, User, Key, Loader2, Info, Smartphone, CheckCircle2, Globe } from 'lucide-react';

interface LoginProps {
  onLogin: (config: ServerConfig) => void;
}

const CyberRabbitIcon = () => {
  return (
    <img src="/icons/icon-512x512.png" alt="EmbyTok" className="w-full h-full object-contain" />
  );
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [serverType, setServerType] = useState<ServerType>('emby');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [isTV, setIsTV] = useState(false);
  const [language, setLanguage] = useState<'zh' | 'en'>(() => (localStorage.getItem('embyLanguage') as any) || 'zh');
  
  // 扫码登录相关状态
  const [deviceId] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'waiting' | 'success'>('idle');

  const toggleLanguage = () => {
    const next = language === 'zh' ? 'en' : 'zh';
    setLanguage(next);
    localStorage.setItem('embyLanguage', next);
  };

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const tvMode = ua.includes('tv') || ua.includes('googletv') || ua.includes('smarttv');
    setIsTV(tvMode);
    
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 关键优化：仅在 TV 设备上开启同步监听
  useEffect(() => {
    if (!isTV || syncStatus === 'success') return;

    const controller = new AbortController();
    const TOPIC = `embytok_sync_${deviceId}`;
    const listenToSync = async () => {
        try {
            const response = await fetch(`https://ntfy.sh/${TOPIC}/json`, { signal: controller.signal });
            const reader = response.body?.getReader();
            if (!reader) return;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = new TextDecoder().decode(value).split('\n').filter(Boolean);
                for (const line of lines) {
                    const event = JSON.parse(line);
                    if (event.event === 'message') {
                        const config = JSON.parse(event.message);
                        setServerUrl(config.url);
                        setUsername(config.username);
                        setPassword(config.password || '');
                        setServerType(config.type || 'emby');
                        setSyncStatus('success');
                        setTimeout(() => document.getElementById('login-submit-btn')?.click(), 1000);
                    }
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') setTimeout(listenToSync, 3000);
        }
    };
    listenToSync();
    return () => controller.abort();
  }, [deviceId, syncStatus, isTV]);

  const handleLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    let formattedUrl = serverUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `http://${formattedUrl}`;
    }
    try {
      const config = await ClientFactory.authenticate(serverType, formattedUrl, username, password);
      onLogin(config);
    } catch (err: any) {
      setError(serverType === 'plex' ? 'Plex 登录失败' : '连接失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  const t = {
    zh: {
      serverAddress: '服务器地址',
      username: '用户名',
      password: '密码',
      plexToken: 'X-Plex-Token',
      plexTokenPlaceholder: 'Plex Token',
      submit: '立即连接',
      embyError: '连接失败，请检查账号密码',
      plexError: 'Plex 登录失败',
      language: '语言',
      chinese: '中文',
      english: 'English'
    },
    en: {
      serverAddress: 'Server Address',
      username: 'Username',
      password: 'Password',
      plexToken: 'X-Plex-Token',
      plexTokenPlaceholder: 'Plex Token',
      submit: 'Connect Now',
      embyError: 'Connection failed, please check username and password',
      plexError: 'Plex login failed',
      language: 'Language',
      chinese: '中文',
      english: 'English'
    }
  }[language];

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://embytok.vercel.app/setup?id=${deviceId}`)}`;

  return (
    <div className={`h-[100dvh] w-full ${serverType === 'emby' ? 'bg-[#080810]' : 'bg-[#0a0908]'} flex flex-col items-center justify-center p-4 text-white overflow-hidden relative transition-colors duration-700`}>
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${serverType === 'emby' ? 'bg-indigo-600/20' : 'bg-orange-600/20'} blur-[120px] rounded-full`}></div>
      
      <div className={`w-full max-w-6xl flex ${isLandscape ? 'flex-row items-center gap-16' : 'flex-col items-center'} animate-in fade-in zoom-in duration-700 relative z-10 flex-1`}>
        <div className={`flex flex-col items-center ${isLandscape ? 'w-2/5' : 'mb-8 text-center'}`}>
            <div className="relative w-24 h-24 md:w-32 md:h-32 mb-6 drop-shadow-[0_12px_36px_rgba(0,0,0,0.55)]">
                <CyberRabbitIcon />
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-2">EmbyTok</h1>
            {isLandscape && isTV && (
                <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-[40px] flex flex-col items-center gap-4">
                    <div className="w-40 h-40 bg-white rounded-3xl p-3">
                        {syncStatus === 'success' ? <CheckCircle2 className="w-full h-full text-green-500" /> : <img src={qrCodeUrl} className="w-full h-full" />}
                    </div>
                    <div className="bg-white/10 px-3 py-1 rounded-full text-[12px] font-mono text-indigo-300">CODE: {deviceId}</div>
                </div>
            )}
        </div>

        <form onSubmit={handleLogin} className={`${isLandscape ? 'w-3/5 max-w-md' : 'w-full max-w-sm'} space-y-4 bg-white/[0.04] backdrop-blur-3xl p-8 rounded-[40px] border border-white/10 shadow-2xl`}>
          <div className="flex bg-black/60 rounded-2xl p-1.5 border border-white/5">
              {['emby', 'plex'].map((type) => (
                  <button key={type} type="button" onClick={() => setServerType(type as ServerType)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${serverType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500'}`}>
                      {type.toUpperCase()}
                  </button>
              ))}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t.serverAddress}</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://..." className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 ring-indigo-500" />
          </div>
          {serverType === 'emby' ? (
              <div className={`grid gap-4 ${isLandscape ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t.username}</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 ring-indigo-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t.password}</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 ring-indigo-500" />
                  </div>
              </div>
          ) : (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">{t.plexToken}</label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.plexTokenPlaceholder} className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:ring-2 ring-indigo-500" />
              </div>
          )}
          {error && <div className="text-red-400 text-xs">{serverType === 'plex' ? t.plexError : t.embyError}</div>}
          <button id="login-submit-btn" type="submit" disabled={loading} className="w-full bg-indigo-600 text-white text-sm font-black py-5 rounded-2xl active:scale-95 transition-all">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.submit}
          </button>
        </form>
      </div>
      
      {/* 语言切换按钮 */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
        <button onClick={toggleLanguage} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm font-bold transition-all hover:bg-white/10">
          <Globe size={16} />
          <span>{language === 'zh' ? t.english : t.chinese}</span>
        </button>
      </div>
    </div>
  );
};

export default Login;
