
import React, { useState, useEffect, useMemo } from 'react';
import Login from '../Login';
import VideoFeed from '../VideoFeed';
import VideoGrid from '../VideoGrid';
import LibrarySelect from '../LibrarySelect';
import { ServerConfig, EmbyLibrary, EmbyItem, FeedType, OrientationMode } from '../../types';
import { ClientFactory } from '../../services/clientFactory';
import { Menu, LayoutGrid, Smartphone, Volume2, VolumeX, Maximize, Minimize, ChevronLeft } from 'lucide-react';

type ViewMode = 'feed' | 'grid';
const PAGE_SIZE = 200;

function MobileRoot() {
  const [config, setConfig] = useState<ServerConfig | null>(() => {
    try { const saved = localStorage.getItem('embyConfig'); return saved ? JSON.parse(saved) : null; } catch(e) { return null; }
  });

  const client = useMemo(() => config ? ClientFactory.create(config) : null, [config]);
  const [libraries, setLibraries] = useState<EmbyLibrary[]>([]);
  const [selectedLib, setSelectedLib] = useState<EmbyLibrary | null>(null);
  const [videos, setVideos] = useState<EmbyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [serverStartIndex, setServerStartIndex] = useState(0); 
  const [navStack, setNavStack] = useState<{id: string, title: string}[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [feedType, setFeedType] = useState<FeedType>('latest');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  
  // 语言状态补全
  const [language, setLanguage] = useState<'zh' | 'en'>(() => (localStorage.getItem('embyLanguage') as any) || 'zh');
  // 版本号
  const [appVersion, setAppVersion] = useState<string>('1.2.3');

  const [orientationMode, setOrientationMode] = useState<OrientationMode>(() => (localStorage.getItem('embyOrientationMode') as OrientationMode) || 'vertical');
  const [hiddenLibIds, setHiddenLibIds] = useState<Set<string>>(() => {
      try { const saved = localStorage.getItem('embyHiddenLibs'); return saved ? new Set(JSON.parse(saved)) : new Set(); } catch(e) { return new Set(); }
  });

  const currentParentId = useMemo(() => navStack.length > 0 ? navStack[navStack.length - 1].id : undefined, [navStack]);
  const currentTitle = useMemo(() => navStack.length > 0 ? navStack[navStack.length - 1].title : '', [navStack]);

  useEffect(() => { if (client) fetchLibraries(); }, [client]);
  const fetchLibraries = async () => { if (client) setLibraries(await client.getLibraries()); };

  const loadVideos = async (reset: boolean = false) => {
      if (!client || loading) return;
      setLoading(true);
      const skip = 0;
      if (reset) { setVideos([]); setHasMore(false); setServerStartIndex(0); }
      const exclude = !selectedLib ? Array.from(hiddenLibIds).join(',') : undefined;
      try {
          const { items: newVideos, totalCount } = await client.getVideos(currentParentId, selectedLib, feedType, skip, PAGE_SIZE, orientationMode, exclude);
          setVideos(newVideos);
          setHasMore(false);
      } catch (e) { setHasMore(false); } finally { setLoading(false); }
  };

  useEffect(() => { if (client) loadVideos(true); }, [navStack, client, feedType, selectedLib, orientationMode, hiddenLibIds]);

  const toggleLanguage = () => {
      const next = language === 'zh' ? 'en' : 'zh';
      setLanguage(next);
      localStorage.setItem('embyLanguage', next);
  };

  if (!config || !client) return <Login onLogin={setConfig} />;

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden text-white device-mobile-ui">
      <div className="absolute top-0 left-0 right-0 z-40 h-16 bg-gradient-to-b from-black/95 to-transparent flex items-center justify-between px-3">
        <button onClick={() => setIsMenuOpen(true)} className="p-2"><Menu /></button>
        <div className="font-bold">{currentTitle || (language === 'zh' ? '发现中心' : 'Discover')}</div>
        <button onClick={() => setViewMode(viewMode === 'feed' ? 'grid' : 'feed')} className="p-2">
            {viewMode === 'feed' ? <LayoutGrid /> : <Smartphone />}
        </button>
      </div>

      <div className="w-full h-full">
        {viewMode === 'grid' ? (
            <VideoGrid videos={videos} client={client} isLoading={loading} feedType={feedType} hasMore={hasMore} onSelect={(idx) => { setCurrentIndex(idx); setViewMode('feed'); }} onLoadMore={() => loadVideos(false)} onRefresh={() => loadVideos(true)} />
        ) : (
            <VideoFeed 
                videos={videos} 
                client={client} 
                onRefresh={() => loadVideos(true)} 
                isLoading={loading} 
                favoriteIds={favoriteIds} 
                onToggleFavorite={() => {}} 
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
                language={language}
            />
        )}
      </div>

      <LibrarySelect 
        isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} libraries={libraries} selectedId={selectedLib?.Id || null} 
        onSelect={setSelectedLib} 
        hiddenLibIds={hiddenLibIds}
        onToggleHidden={(id) => {
            const n = new Set(hiddenLibIds); if (n.has(id)) n.delete(id); else n.add(id);
            setHiddenLibIds(n); localStorage.setItem('embyHiddenLibs', JSON.stringify(Array.from(n)));
        }}
        onLogout={() => { setConfig(null); localStorage.removeItem('embyConfig'); window.location.reload(); }} 
        serverUrl={config.url} username={config.username} orientationMode={orientationMode} onOrientationChange={setOrientationMode}
        language={language} onToggleLanguage={toggleLanguage}
        version={appVersion}
      />
    </div>
  );
}

export default MobileRoot;
