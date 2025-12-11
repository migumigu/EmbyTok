
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { EmbyItem, FeedType } from '../types';
import { MediaClient } from '../services/MediaClient';
import VideoCard from './VideoCard';
import { RefreshCw, Film, Shuffle, Infinity } from 'lucide-react';

interface VideoFeedProps {
  videos: EmbyItem[];
  client: MediaClient;
  onRefresh?: () => void;
  isLoading?: boolean;
  favoriteIds: Set<string>;
  onToggleFavorite: (itemId: string, isFavorite: boolean) => void;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  feedType: FeedType;
  hasMore: boolean;
  onLoadMore: () => void;
  isAutoPlay?: boolean;
  onToggleAutoPlay?: () => void;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ 
    videos, 
    client, 
    onRefresh, 
    isLoading,
    favoriteIds,
    onToggleFavorite,
    initialIndex = 0,
    onIndexChange,
    isMuted,
    onToggleMute,
    feedType,
    hasMore,
    onLoadMore,
    isAutoPlay = false,
    onToggleAutoPlay = () => {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [showToast, setShowToast] = useState(false);
  const isFirstRender = useRef(true);

  useLayoutEffect(() => {
    if (isFirstRender.current && containerRef.current && initialIndex > 0) {
        const windowHeight = window.innerHeight;
        containerRef.current.scrollTop = windowHeight * initialIndex;
        isFirstRender.current = false;
    }
  }, [initialIndex]);

  // Handle AutoPlay Toast Notification (Global for the feed)
  useEffect(() => {
      if (isAutoPlay) {
          setShowToast(true);
          const timer = setTimeout(() => setShowToast(false), 2000);
          return () => clearTimeout(timer);
      } else {
          setShowToast(false);
      }
  }, [isAutoPlay]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = {
      root: container,
      rootMargin: '0px',
      threshold: 0.85, 
    };

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-index'));
          setActiveIndex(index);
          if (onIndexChange) {
              onIndexChange(index);
          }
          
          if (feedType === 'latest' && index >= videos.length - 2 && hasMore && !isLoading) {
              onLoadMore();
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, options);
    const elements = container.querySelectorAll('.video-card-container');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [videos, onIndexChange, feedType, hasMore, isLoading, onLoadMore]);

  // Handle scrolling to next video when auto-play is on
  const handleNextVideo = () => {
    if (activeIndex < videos.length - 1 && containerRef.current) {
        const nextIndex = activeIndex + 1;
        containerRef.current.scrollTo({
            top: nextIndex * window.innerHeight,
            behavior: 'smooth'
        });
    } else if (activeIndex >= videos.length - 1 && hasMore) {
        // Try to load more if at end
        onLoadMore();
    }
  };

  if (videos.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white bg-black pt-20">
        <Film className="w-16 h-16 text-zinc-800 mb-4" />
        <p className="text-lg mb-2 font-bold">未找到视频</p>
        <p className="text-zinc-500 text-sm mb-6 px-8 text-center">请尝试切换标签或选择其他媒体库</p>
        <button 
            onClick={onRefresh}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-full text-sm font-bold transition-colors"
        >
            <RefreshCw className="w-4 h-4" /> 刷新
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
        {/* Global Toast Notification Overlay */}
        {showToast && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                  <Infinity className="w-5 h-5 text-green-400" />
                  <span className="font-bold">已开启自动连播 (纯净模式)</span>
              </div>
          </div>
        )}

        <div
          ref={containerRef}
          className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
        >
          {videos.map((item, index) => (
            <div
              key={item.Id}
              data-index={index}
              className="video-card-container h-[100dvh] w-full snap-center relative"
            >
              {Math.abs(activeIndex - index) <= 1 ? (
                <VideoCard
                  item={item}
                  client={client}
                  isActive={activeIndex === index}
                  isFavorite={favoriteIds.has(item.Id)}
                  onToggleFavorite={() => onToggleFavorite(item.Id, favoriteIds.has(item.Id))}
                  isMuted={isMuted}
                  onToggleMute={onToggleMute}
                  isAutoPlay={isAutoPlay}
                  onToggleAutoPlay={onToggleAutoPlay}
                  onVideoEnd={handleNextVideo}
                />
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-zinc-800 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          ))}
          
          {feedType === 'random' && videos.length > 0 && (
            <div className="h-[100dvh] w-full snap-center flex flex-col items-center justify-center bg-zinc-900 text-white gap-4">
                <Shuffle className="w-16 h-16 text-zinc-700" />
                <h3 className="text-xl font-bold">看完了？</h3>
                <p className="text-zinc-400 mb-4">重新生成随机列表，发现更多惊喜</p>
                <button 
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-full text-lg font-bold transition-all active:scale-95"
                >
                    <RefreshCw className="w-6 h-6" /> 换一批
                </button>
            </div>
          )}

          {feedType === 'latest' && hasMore && (
              <div className="h-24 w-full flex items-center justify-center bg-black snap-align-none">
                  <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
              </div>
          )}
          
          {feedType === 'latest' && !hasMore && videos.length > 0 && (
              <div className="h-32 w-full flex items-center justify-center bg-black snap-center text-zinc-600 text-sm">
                  - 到底了 -
              </div>
          )}

          {isLoading && videos.length === 0 && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
                  <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
              </div>
          )}
        </div>
    </div>
  );
};

export default VideoFeed;
