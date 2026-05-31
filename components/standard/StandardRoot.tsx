
import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import Login from '../Login';
import VideoFeed from '../VideoFeed';
import VideoGrid from '../VideoGrid';
import LibrarySelect from '../LibrarySelect';
import { ServerConfig, EmbyLibrary, EmbyItem, FeedType, OrientationMode } from '../../types';
import { ClientFactory } from '../../services/clientFactory';
import { Menu, LayoutGrid, Smartphone, Volume2, VolumeX, Maximize, Minimize, ChevronLeft } from 'lucide-react';

type ViewMode = 'feed' | 'grid';
const PAGE_SIZE = 200;

interface NavItem {
    id: string;
    title: string;
}

interface StandardRootProps {
    onToggleMode?: () => void;
}

function StandardRoot({ onToggleMode }: StandardRootProps) {
  const [config, setConfig] = useState<ServerConfig | null>(() => {
    try { const saved = localStorage.getItem('embyConfig'); return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const client = useMemo(() => config ? ClientFactory.create(config) : null, [config]);
  const [libraries, setLibraries] = useState<EmbyLibrary[]>([]);
  const [selectedLib, setSelectedLib] = useState<EmbyLibrary | null>(null);
  const [videos, setVideos] = useState<EmbyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [serverStartIndex, setServerStartIndex] = useState(0); 
  const [navStack, setNavStack] = useState<NavItem[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [feedType, setFeedType] = useState<FeedType>('latest');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  
  // 语言状态
  const [language, setLanguage] = useState<'zh' | 'en'>(() => (localStorage.getItem('embyLanguage') as any) || 'zh');
  // 版本号
  const [appVersion, setAppVersion] = useState<string>('1.2.3');

  const [orientationMode, setOrientationMode] = useState<OrientationMode>(() => (localStorage.getItem('embyOrientationMode') as OrientationMode) || 'vertical');
  const [hiddenLibIds, setHiddenLibIds] = useState<Set<string>>(() => {
      try { const s = localStorage.getItem('embyHiddenLibs'); return s ? new Set(JSON.parse(s)) : new Set(); } catch (e) { return new Set(); }
  });

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (config) localStorage.setItem('embyConfig', JSON.stringify(config));
    else localStorage.removeItem('embyConfig');
  }, [config]);

  useEffect(() => { if (client) fetchLibraries(); }, [client]);
  const fetchLibraries = async () => { if (client) setLibraries(await client.getLibraries()); };

  const loadVideos = async (reset: boolean = false, overrideParentId?: string) => {
      if (!client || loading) return;
      setLoading(true);
      const skip = 0;
      const effectiveParentId = overrideParentId !== undefined ? overrideParentId : (navStack.length > 0 ? navStack[navStack.length - 1].id : undefined);
      if (reset) { setVideos([]); setHasMore(false); setServerStartIndex(0); setCurrentIndex(0); }
      let includeIds = !selectedLib ? libraries.filter(l => !hiddenLibIds.has(l.Id)).map(l => l.Id).join(',') : undefined;
      try {
          if (reset) setFavoriteIds(await client.getFavorites(selectedLib?.Name || "收藏"));
          const { items: newVideos, totalCount } = await client.getVideos(effectiveParentId, selectedLib, feedType, skip, PAGE_SIZE, orientationMode, includeIds);
          setVideos(newVideos);
          setHasMore(false);
          if (reset && effectiveParentId && newVideos.length > 0) {
              const type = (newVideos[0].Type || '').toLowerCase();
              if (['series', 'season', 'folder', 'boxset', 'show'].includes(type) && viewMode === 'feed') setViewMode('grid');
          }
      } catch (e) { setHasMore(false); } finally { setLoading(false); }
  };

  useEffect(() => { if (client) loadVideos(true); }, [navStack, client, feedType, selectedLib, orientationMode, hiddenLibIds]);

  // 处理iOS Safari安全区域
  useLayoutEffect(() => {
    // 检测是否为iOS Safari
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream && /Safari/.test(navigator.userAgent);
    
    if (isIOSSafari) {
      // 为iOS Safari添加特殊样式
      document.documentElement.classList.add('ios-safari');
    }
    
    return () => {
      document.documentElement.classList.remove('ios-safari');
    };
  }, []);

  const toggleLanguage = () => {
      const next = language === 'zh' ? 'en' : 'zh';
      setLanguage(next);
      localStorage.setItem('embyLanguage', next);
  };

  if (!config || !client) return <Login onLogin={setConfig} />;

  const t = {
      zh: { favorites: '收藏', random: '随机', latest: '最新', discover: '发现中心' },
      en: { favorites: 'Fav', random: 'Random', latest: 'Latest', discover: 'Discover' }
  }[language];

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden font-sans text-white">
      <div className={`absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 to-transparent backdrop-blur-sm flex items-center justify-between px-3 transition-all duration-500 ${(viewMode === 'feed' && isAutoPlay) ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100 translate-y-0'}`}
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
          height: 'calc(4rem + env(safe-area-inset-top))'
        }}
      >
        <div className="min-w-[44px] flex items-center">
          {navStack.length > 0 ? (
            <button onClick={() => setNavStack(prev => prev.slice(0, -1))} className="p-2"><ChevronLeft size={24} /></button>
          ) : (
            <button onClick={() => setIsMenuOpen(true)} className="p-2"><Menu size={24} /></button>
          )}
        </div>
        <div className="flex-1 flex justify-center items-center overflow-hidden mx-1">
          {navStack.length > 0 ? (
            <h2 className="font-bold truncate text-[clamp(13px,4vw,15px)] text-center">{navStack[navStack.length - 1].title}</h2>
          ) : (
            <div className="flex items-center font-bold gap-4 sm:gap-8">
                 {['favorites', 'random', 'latest'].map(type => (
                     <button key={type} onClick={() => setFeedType(type as FeedType)} className={`transition-all duration-300 relative py-1 text-sm ${feedType === type ? 'text-white' : 'text-white/40'}`}>
                         {t[type as keyof typeof t]}
                         {feedType === type && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />}
                     </button>
                 ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 justify-end min-w-[90px]">
            <button onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }} className="p-2 text-white/80">{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-white/80">{isMuted ? <VolumeX size={20} className="text-red-500" /> : <Volume2 size={20} />}</button>
            <button onClick={() => setViewMode(viewMode === 'feed' ? 'grid' : 'feed')} className="p-2 text-white/80">{viewMode === 'feed' ? <LayoutGrid size={20} /> : <Smartphone size={20} />}</button>
        </div>
      </div>
      <div className="w-full h-full bg-black relative z-10">
        {viewMode === 'grid' ? (
            <VideoGrid videos={videos} client={client} isLoading={loading} feedType={feedType} hasMore={hasMore} onSelect={(idx) => { setCurrentIndex(idx); setViewMode('feed'); }} onLoadMore={() => loadVideos(false)} onRefresh={() => loadVideos(true)} currentIndex={currentIndex} onNavigate={(id, title) => { setNavStack(prev => [...prev, { id, title }]); setViewMode('grid'); }} />
        ) : (
            <VideoFeed 
                videos={videos} 
                client={client} 
                onRefresh={() => loadVideos(true)} 
                isLoading={loading} 
                favoriteIds={favoriteIds} 
                onToggleFavorite={async (id, fav) => { 
                    await client.toggleFavorite(id, fav, selectedLib?.Name || "收藏"); 
                    setFavoriteIds(prev => { 
                        const n = new Set(prev); 
                        if (fav) n.delete(id); else n.add(id); 
                        return n; 
                    }); 
                }} 
                onDelete={async (itemId) => {
                    try {
                        await client.deleteItem(itemId);
                        setVideos(prev => prev.filter(video => video.Id !== itemId));
                    } catch (error) {
                        console.error('删除视频失败:', error);
                        alert(language === 'zh' ? '删除失败，请检查权限' : 'Deletion failed, please check permissions');
                    }
                }}
                initialIndex={currentIndex} 
                onIndexChange={setCurrentIndex} 
                isMuted={isMuted} 
                onToggleMute={() => setIsMuted(!isMuted)} 
                feedType={feedType} 
                hasMore={hasMore} 
                onLoadMore={() => loadVideos(false)} 
                isAutoPlay={isAutoPlay} 
                onToggleAutoPlay={() => setIsAutoPlay(!isAutoPlay)} 
                language={language}
            />
        )}
      </div>
      <LibrarySelect isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} libraries={libraries} selectedId={selectedLib?.Id || null} onSelect={(lib) => { setSelectedLib(lib); setIsMenuOpen(false); }} hiddenLibIds={hiddenLibIds} onToggleHidden={(id) => {
            const n = new Set(hiddenLibIds); if (n.has(id)) n.delete(id); else n.add(id);
            setHiddenLibIds(n); localStorage.setItem('embyHiddenLibs', JSON.stringify(Array.from(n)));
        }} onLogout={() => { setConfig(null); localStorage.removeItem('embyConfig'); window.location.reload(); }} serverUrl={config.url} username={config.username} orientationMode={orientationMode} onOrientationChange={setOrientationMode} onToggleMode={onToggleMode}
        language={language} onToggleLanguage={toggleLanguage}
        version={appVersion}
      />
    </div>
  );
}

export default StandardRoot;
