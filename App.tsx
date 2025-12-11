
import React, { useState, useEffect, useMemo } from 'react';
import Login from './components/Login';
import VideoFeed from './components/VideoFeed';
import VideoGrid from './components/VideoGrid';
import LibrarySelect from './components/LibrarySelect';
import { ServerConfig, EmbyLibrary, EmbyItem, FeedType, OrientationMode } from './types';
import { ClientFactory } from './services/clientFactory';
import { Menu, LayoutGrid, Smartphone, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

type ViewMode = 'feed' | 'grid';
const PAGE_SIZE = 15;

function App() {
  const [config, setConfig] = useState<ServerConfig | null>(() => {
    const saved = localStorage.getItem('embyConfig');
    return saved ? JSON.parse(saved) : null;
  });

  // Client Instance
  const client = useMemo(() => {
    return config ? ClientFactory.create(config) : null;
  }, [config]);

  const [libraries, setLibraries] = useState<EmbyLibrary[]>([]);
  const [selectedLib, setSelectedLib] = useState<EmbyLibrary | null>(null);
  
  // Content State
  const [videos, setVideos] = useState<EmbyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [serverStartIndex, setServerStartIndex] = useState(0); 
  
  // UI State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [feedType, setFeedType] = useState<FeedType>('latest');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false); // New Auto-play State
  
  // Initial Detection for TV/Landscape
  const [isLandscape, setIsLandscape] = useState(() => 
     typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );

  // Orientation Filter State
  const [orientationMode, setOrientationMode] = useState<OrientationMode>(() => {
      const saved = localStorage.getItem('embyOrientationMode');
      if (saved) return saved as OrientationMode;
      // Default behavior logic based on initial load
      if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) {
          return 'both';
      }
      return 'vertical';
  });
  
  const [viewMode, setViewMode] = useState<ViewMode>(isLandscape ? 'grid' : 'feed');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Settings State
  const [hiddenLibIds, setHiddenLibIds] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('embyHiddenLibs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Audio State
  const [isMuted, setIsMuted] = useState(true);

  // Handle Orientation Change
  useEffect(() => {
    const handleResize = () => {
        setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Fullscreen Events
  useEffect(() => {
      const handleFullScreenChange = () => {
          setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullScreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  useEffect(() => {
    if (config) {
      localStorage.setItem('embyConfig', JSON.stringify(config));
    } else {
      localStorage.removeItem('embyConfig');
    }
  }, [config]);

  useEffect(() => {
      localStorage.setItem('embyHiddenLibs', JSON.stringify(Array.from(hiddenLibIds)));
  }, [hiddenLibIds]);

  useEffect(() => {
      localStorage.setItem('embyOrientationMode', orientationMode);
  }, [orientationMode]);

  useEffect(() => {
    if (client) {
      fetchLibraries();
    }
  }, [client]);

  const fetchLibraries = async () => {
    if (!client) return;
    try {
      const libs = await client.getLibraries();
      setLibraries(libs);
    } catch (e) {
      console.error("Error fetching libs", e);
    }
  };

  const getCurrentLibraryName = (lib: EmbyLibrary | null) => {
      return lib ? lib.Name : "收藏"; 
  };

  const loadVideos = async (reset: boolean = false) => {
      if (!client) return;
      if (loading) return;

      setLoading(true);
      
      const currentServerSkip = reset ? 0 : serverStartIndex;

      if (reset) {
          setVideos([]);
          setCurrentIndex(0);
          setHasMore(true);
          setServerStartIndex(0);
      }

      const libName = getCurrentLibraryName(selectedLib);

      // 1. Fetch Favorites IDs
      if (reset) {
        try {
            const ids = await client.getFavorites(libName);
            setFavoriteIds(ids);
        } catch (e) {
            console.error("Failed to load favorites list", e);
        }
      }

      // 2. Fetch Videos
      try {
          const { items: newVideos, nextStartIndex, totalCount } = await client.getVideos(
            selectedLib ? selectedLib.Id : undefined,
            libName,
            feedType,
            currentServerSkip,
            PAGE_SIZE,
            orientationMode
          );
          
          if (reset) {
              setVideos(newVideos);
          } else {
              setVideos(prev => [...prev, ...newVideos]);
          }

          setServerStartIndex(nextStartIndex);

          if (nextStartIndex >= totalCount) {
              setHasMore(false);
          } else {
              setHasMore(true);
          }

      } catch (e) {
          console.error("Error fetching videos", e);
          setHasMore(false);
      } finally {
          setLoading(false);
      }
  };

  const refreshContent = () => {
      loadVideos(true);
  };

  const handleLibrarySelect = (lib: EmbyLibrary | null) => {
    setSelectedLib(lib);
  };

  const handleFeedTypeChange = (type: FeedType) => {
      if (type === feedType) return;
      setFeedType(type);
  };

  // Trigger reload if feedType, library, OR orientationMode changes
  useEffect(() => {
     if (client) {
         loadVideos(true);
     }
  }, [feedType, selectedLib, client, orientationMode]); 

  const handleToggleFavorite = async (itemId: string, isCurrentlyFavorite: boolean) => {
      if (!client) return;
      
      const nextFavIds = new Set(favoriteIds);
      if (isCurrentlyFavorite) {
          nextFavIds.delete(itemId);
      } else {
          nextFavIds.add(itemId);
      }
      setFavoriteIds(nextFavIds);

      const libName = getCurrentLibraryName(selectedLib);
      try {
          await client.toggleFavorite(itemId, isCurrentlyFavorite, libName);
      } catch (e) {
          console.error("Failed to toggle favorite", e);
          setFavoriteIds(favoriteIds);
      }
  };

  const handleGridSelect = (index: number) => {
      setCurrentIndex(index);
      setViewMode('feed');
  };

  const handleToggleHideLib = (libId: string) => {
      const newSet = new Set(hiddenLibIds);
      if (newSet.has(libId)) {
          newSet.delete(libId);
      } else {
          newSet.add(libId);
      }
      setHiddenLibIds(newSet);
  };

  const handleLogout = () => {
      setConfig(null);
      localStorage.removeItem('embyConfig');
      setVideos([]);
      setIsMenuOpen(false);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  if (!config || !client) {
    return <Login onLogin={setConfig} />;
  }

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden font-sans text-white">
      
      {/* TOP NAVIGATION BAR - Hidden in Auto Play Mode */}
      <div className={`absolute top-0 left-0 right-0 z-40 h-16 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between px-4 pt-2 transition-opacity duration-300 ${isAutoPlay ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
        >
             <Menu className="w-6 h-6 drop-shadow-md" />
        </button>

        <div className="flex items-center gap-4 font-bold text-md drop-shadow-md transform translate-x-1">
             <button 
                onClick={() => handleFeedTypeChange('favorites')}
                className={`transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 ${feedType === 'favorites' ? 'text-white scale-105' : 'text-white/50 hover:text-white/80'}`}
             >
                 收藏
             </button>
             <div className="w-[1px] h-3 bg-white/20"></div>
             <button 
                onClick={() => handleFeedTypeChange('random')}
                className={`transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 ${feedType === 'random' ? 'text-white scale-105' : 'text-white/50 hover:text-white/80'}`}
             >
                 随机
             </button>
             <div className="w-[1px] h-3 bg-white/20"></div>
             <button 
                onClick={() => handleFeedTypeChange('latest')}
                className={`transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 ${feedType === 'latest' ? 'text-white scale-105' : 'text-white/50 hover:text-white/80'}`}
             >
                 最新
             </button>
        </div>
        
        <div className="flex items-center gap-1">
            <button
                onClick={toggleFullScreen}
                className="p-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
            >
                {isFullscreen ? (
                     <Minimize className="w-6 h-6 drop-shadow-md" />
                ) : (
                     <Maximize className="w-6 h-6 drop-shadow-md" />
                )}
            </button>
            <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
            >
                {isMuted ? (
                     <VolumeX className="w-6 h-6 drop-shadow-md text-red-500" />
                ) : (
                     <Volume2 className="w-6 h-6 drop-shadow-md" />
                )}
            </button>
            <button 
                onClick={() => setViewMode(viewMode === 'feed' ? 'grid' : 'feed')}
                className="p-2 text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
            >
                {viewMode === 'feed' ? (
                    <LayoutGrid className="w-6 h-6 drop-shadow-md" />
                ) : (
                    <Smartphone className="w-6 h-6 drop-shadow-md" />
                )}
            </button>
        </div>
      </div>

      {selectedLib && !isAutoPlay && (
          <div className="absolute top-16 left-0 right-0 z-30 flex justify-center pointer-events-none">
              <span className="bg-black/30 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] text-white/70 border border-white/10 uppercase tracking-widest">
                  {selectedLib.Name}
              </span>
          </div>
      )}

      <div className="w-full h-full bg-black">
        {viewMode === 'grid' ? (
            <VideoGrid 
                videos={videos} 
                client={client}
                onSelect={handleGridSelect} 
                isLoading={loading}
                feedType={feedType}
                hasMore={hasMore}
                onLoadMore={() => loadVideos(false)}
                onRefresh={refreshContent}
                currentIndex={currentIndex}
            />
        ) : (
            <VideoFeed 
                key={`${selectedLib?.Id}-${feedType}-${orientationMode}`} 
                videos={videos} 
                client={client}
                onRefresh={refreshContent}
                isLoading={loading}
                favoriteIds={favoriteIds}
                onToggleFavorite={handleToggleFavorite}
                initialIndex={currentIndex}
                onIndexChange={setCurrentIndex}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                feedType={feedType}
                hasMore={hasMore}
                onLoadMore={() => loadVideos(false)}
                isAutoPlay={isAutoPlay}
                onToggleAutoPlay={() => setIsAutoPlay(!isAutoPlay)}
            />
        )}
      </div>

      <LibrarySelect 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)}
        libraries={libraries}
        selectedId={selectedLib?.Id || null}
        onSelect={handleLibrarySelect}
        hiddenLibIds={hiddenLibIds}
        onToggleHidden={handleToggleHideLib}
        onLogout={handleLogout}
        serverUrl={config.url}
        username={config.username}
        orientationMode={orientationMode}
        onOrientationChange={setOrientationMode}
      />
    </div>
  );
}

export default App;
