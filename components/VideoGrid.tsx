
import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { EmbyItem, FeedType } from '../types';
import { MediaClient } from '../services/MediaClient';
import { PlayCircle, Clock, RefreshCw, Shuffle } from 'lucide-react';

interface VideoGridProps {
  videos: EmbyItem[];
  client: MediaClient;
  onSelect: (index: number) => void;
  isLoading?: boolean;
  feedType: FeedType;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  currentIndex?: number;
}

const VideoGrid: React.FC<VideoGridProps> = ({ 
    videos, 
    client, 
    onSelect, 
    isLoading,
    feedType,
    hasMore,
    onLoadMore,
    onRefresh,
    currentIndex = 0
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const formatTime = (ticks?: number) => {
    if (!ticks) return '';
    const minutes = Math.round(ticks / 10000000 / 60);
    return `${minutes}m`;
  };

  // Scroll to current index on mount
  useLayoutEffect(() => {
    if (currentIndex > 0 && videos.length > 0) {
        const element = document.getElementById(`grid-item-${currentIndex}`);
        if (element) {
            element.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    }
  }, []); // Run once on mount to restore position

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoading && feedType === 'latest') {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [hasMore, isLoading, feedType, onLoadMore]);

  if (videos.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 pt-20">
        <p className="mb-4">暂无内容</p>
        <button 
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full text-sm hover:bg-zinc-700 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
            <RefreshCw className="w-4 h-4" /> 刷新
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-black p-2 pb-24">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-16">
        {videos.map((item, index) => {
          const posterSrc = item.ImageTags?.Primary
            ? client.getImageUrl(item.Id, item.ImageTags.Primary, 'Primary')
            : undefined;

          return (
            <div 
              key={item.Id}
              id={`grid-item-${index}`}
              tabIndex={0}
              onClick={() => onSelect(index)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter') onSelect(index);
              }}
              className={`relative aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden cursor-pointer transition-all group focus:scale-105 focus:ring-4 focus:ring-indigo-500 outline-none z-10 ${index === currentIndex ? 'ring-2 ring-white/50' : ''}`}
            >
              {posterSrc ? (
                <img 
                  src={posterSrc} 
                  alt={item.Name} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                   Media
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                  <PlayCircle className="w-10 h-10 text-white/80 fill-black/50" />
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-2">
                 <h3 className="text-white text-xs font-bold line-clamp-2 drop-shadow-md mb-1">
                    {item.Name}
                 </h3>
                 <div className="flex items-center gap-1 text-[10px] text-zinc-300">
                    {item.RunTimeTicks && (
                        <>
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(item.RunTimeTicks)}</span>
                        </>
                    )}
                 </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="w-full py-8 flex flex-col items-center justify-center text-zinc-500 gap-4" ref={loadMoreRef}>
          {isLoading && (
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          )}

          {!isLoading && feedType === 'random' && (
              <button 
                onClick={onRefresh}
                className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full text-white text-sm font-bold transition-all active:scale-95 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                 <Shuffle className="w-4 h-4" /> 换一批
              </button>
          )}

          {!isLoading && feedType === 'latest' && !hasMore && (
              <span className="text-xs">- 到底了 -</span>
          )}
      </div>
    </div>
  );
};

export default VideoGrid;
