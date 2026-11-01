
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import Login from '../Login';
import TVVideoGrid from './TVVideoGrid';
import TVVideoPlayer from './TVVideoPlayer';
import TVDashboard from './TVDashboard';
import TVSettings from './TVSettings';
import { ServerConfig, EmbyLibrary, EmbyItem, FeedType, OrientationMode } from '../../types';
import { ClientFactory } from '../../services/clientFactory';
import { LayoutGrid, Library, Settings, LogOut, Clock, Star, RefreshCcw, Monitor, Eye, EyeOff, User, Info, CheckCircle2, Smartphone, Square, Search, Globe } from 'lucide-react';

interface TVRootProps {
    onToggleMode?: () => void;
}

const TVRabbitIcon = () => (
  <img src="/icons/icon-512x512.png" alt="EmbyTok" className="w-full h-full object-contain" />
);

function TVRoot({ onToggleMode }: TVRootProps) {
  const [config, setConfig] = useState<ServerConfig | null>(() => {
    try { const s = localStorage.getItem('embyConfig'); return s ? JSON.parse(s) : null; } catch(e) { return null; }
  });

  const client = useMemo(() => config ? ClientFactory.create(config) : null, [config]);
  const [videos, setVideos] = useState<EmbyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedType, setFeedType] = useState<FeedType>('latest');
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [lastFocusedIndex, setLastFocusedIndex] = useState<number>(0);
  const [libraries, setLibraries] = useState<EmbyLibrary[]>([]);
  const [selectedLib, setSelectedLib] = useState<EmbyLibrary | null>(null);
  
  const [previewLib, setPreviewLib] = useState<EmbyLibrary | null>(null);
  const [isSidebarFocused, setIsSidebarFocused] = useState(true);

  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('account');
  const [language, setLanguage] = useState<'zh' | 'en'>(() => (localStorage.getItem('embyLanguage') as any) || 'zh');
  const [hiddenLibIds, setHiddenLibIds] = useState<Set<string>>(() => {
      try { const s = localStorage.getItem('embyHiddenLibs'); return s ? new Set(JSON.parse(s)) : new Set(); } catch(e) { return new Set(); }
  });
  const [orientationMode, setOrientationMode] = useState<OrientationMode>(() => (localStorage.getItem('embyOrientationMode') as OrientationMode) || 'horizontal');
  const [appVersion, setAppVersion] = useState<string>('1.2.3');

  const visibleLibraries = useMemo(() => libraries.filter(l => !hiddenLibIds.has(l.Id)), [libraries, hiddenLibIds]);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const uiStateRef = useRef({ selectedVideoIndex, showSettings, selectedLib, previewLib, isSidebarFocused });
  const lastBackActionTime = useRef<number>(0);

  useEffect(() => {
    uiStateRef.current = { selectedVideoIndex, showSettings, selectedLib, previewLib, isSidebarFocused };
  }, [selectedVideoIndex, showSettings, selectedLib, previewLib, isSidebarFocused]);

  // 关键修复：当 config 改变（登录成功）时，同步持久化到本地存储
  useEffect(() => {
    if (config) {
        localStorage.setItem('embyConfig', JSON.stringify(config));
    }
  }, [config]);

  useEffect(() => {
      if (config && client) {
          setTimeout(() => {
              document.getElementById('nav-item-discover')?.focus();
          }, 500);
      }
  }, [!!config]);

  const handleLogout = useCallback(() => { setConfig(null); localStorage.removeItem('embyConfig'); window.location.reload(); }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      localStorage.setItem('embyLanguage', next);
      return next;
    });
  }, []);

  const handleToggleHidden = useCallback((libId: string) => {
    setHiddenLibIds(prev => {
        const next = new Set(prev);
        if (next.has(libId)) next.delete(libId);
        else next.add(libId);
        localStorage.setItem('embyHiddenLibs', JSON.stringify(Array.from(next)));
        return next;
    });
  }, []);

  const handlePreviewSwitch = useCallback((lib: EmbyLibrary | null) => {
      if (switchTimer.current) clearTimeout(switchTimer.current);
      switchTimer.current = setTimeout(() => {
          setPreviewLib(lib);
          // 移除自动设置 lastFocusedIndex 的逻辑，避免触发 TVVideoGrid 自动聚焦
          // if (lib?.Id !== previewLib?.Id) {
          //     setLastFocusedIndex(0);
          // }
      }, 150);
  }, [previewLib]);

  const enterLibrary = useCallback((lib: EmbyLibrary | null) => {
      setSelectedLib(lib);
      setPreviewLib(lib);
      setShowSettings(false);
      setTimeout(() => {
          const contentItems = document.querySelectorAll('.tv-main-canvas button, .tv-main-canvas [tabindex="0"]');
          if (contentItems.length > 0) {
              (contentItems[0] as HTMLElement).focus();
              setIsSidebarFocused(false);
          }
      }, 100);
  }, []);

  const loadContent = useCallback(async (reset = true) => {
    if (!client || (!previewLib && !libraries.length)) return;
    if (!reset && loading) return; 
    setLoading(true);
    if (reset) setVideos([]);
    
    let includeIds = !previewLib ? libraries.filter(l => !hiddenLibIds.has(l.Id)).map(l => l.Id).join(',') : undefined;
    try {
        const { items } = await client.getVideos(undefined, previewLib, feedType, 0, 100, orientationMode, includeIds);
        setVideos(items);
    } catch (e) {} finally { setLoading(false); }
  }, [client, previewLib, feedType, orientationMode, hiddenLibIds, libraries, loading]);

  useEffect(() => { loadContent(true); }, [previewLib, feedType, orientationMode, libraries.length]);

  const executeBackLogic = useCallback(() => {
      const now = Date.now();
      if (now - lastBackActionTime.current < 500) return;
      lastBackActionTime.current = now;

      const { selectedVideoIndex, showSettings, selectedLib } = uiStateRef.current;

      if (selectedVideoIndex !== null) {
          setSelectedVideoIndex(null);
      } else if (showSettings) {
          setShowSettings(false);
      } else if (selectedLib) {
          setSelectedLib(null);
          setTimeout(() => document.getElementById('nav-item-discover')?.focus(), 50);
      } else {
          // 移除 CapApp.exitApp()，让 Android 系统默认处理返回桌面逻辑
          // 这能保证应用以热启动方式保留在后台，且不会由于非正常杀进程导致数据同步问题
          console.log('App minimizing...');
      }
  }, []);

  useEffect(() => {
    const backListener = CapApp.addListener('backButton', executeBackLogic);
    return () => { backListener.then(l => l.remove()); };
  }, [executeBackLogic]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedVideoIndex !== null) return;
      
      if (e.key === 'Backspace' || e.key === 'Escape') {
          e.preventDefault();
          executeBackLogic();
          return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const activeEl = document.activeElement as HTMLElement;
        const isInSidebar = activeEl.closest('nav') !== null;
        const getFocusableIn = (s: string) => Array.from(document.querySelectorAll(`${s} button, ${s} [tabindex="0"]`)) as HTMLElement[];
        let target: HTMLElement | null = null;

        if (isInSidebar) {
            // 确保导航栏保持展开状态
            setIsSidebarFocused(true);
            const items = getFocusableIn('nav'); const idx = items.indexOf(activeEl);
            if (e.key === 'ArrowDown' && idx < items.length - 1) target = items[idx + 1];
            if (e.key === 'ArrowUp' && idx > 0) target = items[idx - 1];
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                // 检查当前是否是设置项
                const activeId = activeEl.id;
                if (activeId === 'nav-item-settings') {
                    // 如果是设置项，切换到设置页面
                    setShowSettings(true);
                    // 聚焦到设置的第一个Tab
                    setTimeout(() => {
                        const settingsTabs = document.querySelectorAll('.settings-tabs button, .settings-tabs [tabindex="0"]');
                        if (settingsTabs.length > 0) {
                            (settingsTabs[0] as HTMLElement).focus();
                        }
                    }, 50);
                } else {
                    // 其他导航项，进入对应的媒体库
                    const currentLib = uiStateRef.current.previewLib;
                    enterLibrary(currentLib);
                }
                return;
            }
        } else if (showSettings) {
            if (activeEl.closest('.settings-tabs')) {
                const tabs = getFocusableIn('.settings-tabs'); const idx = tabs.indexOf(activeEl);
                if (e.key === 'ArrowDown' && idx < tabs.length - 1) target = tabs[idx + 1];
                if (e.key === 'ArrowUp' && idx > 0) target = tabs[idx - 1];
                if (e.key === 'ArrowRight') {
                    // 确保焦点在设置内容区内，不跳转到媒体库
                    const settingsContentItems = getFocusableIn('.settings-content');
                    if (settingsContentItems.length > 0) {
                        target = settingsContentItems[0];
                    }
                }
                if (e.key === 'ArrowLeft') target = document.getElementById('nav-item-settings');
            } else {
                if (e.key === 'ArrowLeft') target = getFocusableIn('.settings-tabs').find(t => t.classList.contains('active-tab')) || getFocusableIn('.settings-tabs')[0];
                else target = findNearest(activeEl, getFocusableIn('.settings-content'), e.key);
            }
        } else if (activeEl.closest('.tv-right-rail')) {
            const items = getFocusableIn('.tv-right-rail'); const idx = items.indexOf(activeEl);
            if (e.key === 'ArrowDown' && idx < items.length - 1) target = items[idx + 1];
            if (e.key === 'ArrowUp' && idx > 0) target = items[idx - 1];
            if (e.key === 'ArrowLeft') target = findNearest(activeEl, getFocusableIn('.tv-main-canvas'), 'ArrowLeft'); 
        } else {
            target = findNearest(activeEl, getFocusableIn('.tv-main-canvas'), e.key);
            if (!target) {
                if (e.key === 'ArrowLeft') {
                    target = document.getElementById(`nav-item-${previewLib ? previewLib.Id : 'discover'}`) || getFocusableIn('nav')[0];
                } else if (e.key === 'ArrowRight' && previewLib) {
                    target = getFocusableIn('.tv-right-rail')[0];
                }
            }
        }
        
        if (target) {
            e.preventDefault();
            target.focus();
        }
      }
    };
    
    function findNearest(activeEl: HTMLElement, elements: HTMLElement[], key: string) {
        const currRect = activeEl.getBoundingClientRect();
        let best = null; let minScore = Infinity;
        elements.forEach(el => {
            if (el === activeEl) return;
            const r = el.getBoundingClientRect();
            let match = false;
            if (key === 'ArrowUp') match = r.bottom <= currRect.top + 10;
            if (key === 'ArrowDown') match = r.top >= currRect.bottom - 10;
            if (key === 'ArrowLeft') match = r.right <= currRect.left + 10;
            if (key === 'ArrowRight') match = r.left >= currRect.right - 10;
            if (match) {
                const dx = Math.abs(r.left - currRect.left); const dy = Math.abs(r.top - currRect.top);
                const score = (key === 'ArrowUp' || key === 'ArrowDown') ? dy * 10 + dx : dx * 10 + dy;
                if (score < minScore) { minScore = score; best = el; }
            }
        });
        return best;
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVideoIndex, showSettings, selectedLib, previewLib, feedType, executeBackLogic, enterLibrary]);

  useEffect(() => { if (client) client.getLibraries().then(libs => { setLibraries(libs); }); }, [client]);

  if (!config || !client) return <Login onLogin={setConfig} />;

  const t = {
      zh: { discover: '首页', settings: '设置', logout: '退出', latest: '最新', favorites: '收藏', random: '随机' },
      en: { discover: 'Home', settings: 'Settings', logout: 'Logout', latest: 'Latest', favorites: 'Favorites', random: 'Random' }
  }[language];

  const shouldSidebarExpand = isSidebarFocused;

  return (
    <div className="h-full w-full bg-[#010101] text-white flex overflow-hidden font-sans relative">
      {selectedVideoIndex === null && (
        <nav 
            onFocus={() => setIsSidebarFocused(true)}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsSidebarFocused(false);
                }
            }}
            className={`
                bg-black border-r border-white/10 flex flex-col items-start py-4 transition-all duration-500 ease-in-out z-50 group shadow-2xl shrink-0
                ${shouldSidebarExpand ? 'w-48 px-1' : 'w-12 px-0'}
            `}
        >
            <div className="w-12 flex justify-center mb-4 shrink-0"><div className="w-6 h-6 rounded-lg flex items-center justify-center shadow-lg overflow-hidden"><TVRabbitIcon /></div></div>
            <div className="flex-1 space-y-2 w-full overflow-hidden">
                <NavItem 
                    id="nav-item-discover" 
                    icon={<LayoutGrid size={16} />} 
                    label={t.discover} 
                    active={!showSettings && !previewLib} 
                    onFocus={() => handlePreviewSwitch(null)} 
                    onClick={() => enterLibrary(null)} 
                    showLabel={shouldSidebarExpand}
                />
                <div className="h-px bg-white/5 mx-2 my-2" />
                <div className="space-y-1 overflow-y-auto no-scrollbar max-h-[60vh]">
                    {visibleLibraries.map(lib => (
                        <NavItem 
                            key={lib.Id} 
                            id={`nav-item-${lib.Id}`} 
                            icon={<div className="w-5 h-5 flex items-center justify-center text-[8px] font-black bg-white/10 rounded uppercase">{lib.Name[0]}</div>} 
                            label={lib.Name} 
                            active={!showSettings && previewLib?.Id === lib.Id} 
                            onFocus={() => handlePreviewSwitch(lib)} 
                            onClick={() => enterLibrary(lib)} 
                            showLabel={shouldSidebarExpand}
                        />
                    ))}
                </div>
            </div>
            <div className="space-y-1 w-full pt-2 border-t border-white/5 shrink-0">
                <NavItem id="nav-item-settings" icon={<Settings size={16} />} label={t.settings} active={showSettings} onFocus={() => { if (switchTimer.current) clearTimeout(switchTimer.current); }} onClick={() => setShowSettings(!showSettings)} showLabel={shouldSidebarExpand} />
                <NavItem icon={<LogOut size={16} />} label={t.logout} active={false} onClick={handleLogout} showLabel={shouldSidebarExpand} />
            </div>
        </nav>
      )}

      <main className="flex-1 relative bg-black h-full tv-main-canvas overflow-hidden">
        {selectedVideoIndex !== null ? (
            <TVVideoPlayer videos={videos} initialIndex={selectedVideoIndex} onBack={() => setSelectedVideoIndex(null)} client={client} libraryName={previewLib?.Name || "收藏"} language={language} />
        ) : showSettings ? (
            <TVSettings 
                config={config} libraries={libraries} hiddenLibIds={hiddenLibIds} onToggleHidden={handleToggleHidden}
                orientationMode={orientationMode} onOrientationChange={(m) => { setOrientationMode(m); localStorage.setItem('embyOrientationMode', m); }}
                language={language} onToggleLanguage={toggleLanguage} onToggleMode={onToggleMode!} onLogout={handleLogout}
                activeTab={activeTab} onTabChange={setActiveTab}
                version={appVersion}
            />
        ) : (
            <div className="h-full flex flex-col min-h-0">
                {!previewLib ? (
                    <TVDashboard client={client} libraries={visibleLibraries} onSelectVideo={(item) => { setVideos([item]); setSelectedVideoIndex(0); }} onSelectLibrary={enterLibrary} language={language} />
                ) : (
                    <>
                        <header className="absolute top-0 left-0 right-0 h-6 px-4 pt-1 z-30 pointer-events-none flex items-center justify-between">
                            <div className="flex items-center gap-2"><h2 className="text-[8px] font-black tracking-[0.5em] uppercase opacity-10 text-white pl-1">{previewLib.Name}</h2>{loading && <div className="w-1.5 h-1.5 border border-indigo-500 border-t-transparent rounded-full animate-spin opacity-20"></div>}</div>
                        </header>
                        <div className="w-full h-full relative z-10 flex-1 min-h-0">
                            <TVVideoGrid videos={videos} client={client} onSelect={(idx) => { setLastFocusedIndex(idx); setSelectedVideoIndex(idx); }} initialFocusedIndex={lastFocusedIndex} />
                            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-20" />
                        </div>
                    </>
                )}
            </div>
        )}
      </main>

      {!showSettings && previewLib && selectedVideoIndex === null && (
          <div className="tv-right-rail right-action-bar w-10 bg-black/40 border-l border-white/5 flex flex-col items-center justify-center gap-4 z-50 backdrop-blur-md h-full shrink-0">
              <SideTabPill label={t.latest} icon={<Clock size={14} />} active={feedType === 'latest'} onClick={() => setFeedType('latest')} />
              <SideTabPill label={t.favorites} icon={<Star size={14} />} active={feedType === 'favorites'} onClick={() => setFeedType('favorites')} />
              <SideTabPill label={t.random} icon={<RefreshCcw size={14} />} active={feedType === 'random'} onClick={() => setFeedType('random')} />
          </div>
      )}
    </div>
  );
}

function SideTabPill({ label, icon, active, onClick }: { label: string, icon: any, active: boolean, onClick: () => void }) {
    return <button tabIndex={0} onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all outline-none focus:ring-2 focus:ring-white focus:scale-110 ${active ? 'text-indigo-400' : 'text-white/20 hover:text-white/40'}`}><div className={`p-2 rounded-lg ${active ? 'bg-indigo-500/20' : 'bg-white/5'}`}>{icon}</div><span className="text-[8px] font-black uppercase text-white">{label}</span></button>;
}
function NavItem({ id, icon, label, active, onFocus, onClick, showLabel }: { id?: string, icon: any, label: string, active: boolean, onFocus?: () => void, onClick: () => void, showLabel?: boolean }) {
    return (
        <button id={id} tabIndex={0} onFocus={onFocus} onClick={onClick} className={`
            w-full flex items-center p-0 rounded-lg outline-none relative group/item 
            transition-all duration-300 
            focus:bg-white focus:scale-105 hover:bg-white/5 
            ${active ? 'bg-white/10' : ''}
        `}>
            <div className={`
                w-10 h-10 flex items-center justify-center shrink-0 transition-all duration-300
                group-focus/item:text-black group-focus/item:scale-110
                ${active ? 'text-white' : 'text-zinc-500'}
            `}>
                {icon}
            </div>
            <span className={`
                text-sm font-black whitespace-nowrap transition-all duration-300 drop-shadow-md ml-2 overflow-hidden
                group-focus/item:text-black
                ${active ? 'text-white opacity-100' : 'text-zinc-500'}
                ${showLabel ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
            `}>
                {label}
            </span>
            {active && ( 
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-indigo-500 rounded-r-full shadow-lg group-focus/item:hidden" /> 
            )}
        </button>
    );
}

export default TVRoot;
