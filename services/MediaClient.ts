
import { EmbyItem, EmbyLibrary, FeedType, ServerConfig, VideoResponse, OrientationMode } from '../types';

export abstract class MediaClient {
    config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
    }

    abstract authenticate(username: string, password: string): Promise<ServerConfig>;
    
    abstract getLibraries(): Promise<EmbyLibrary[]>;
    
    abstract getVideos(
        parentId: string | undefined, 
        libraryName: string, 
        feedType: FeedType, 
        skip: number, 
        limit: number,
        orientationMode: OrientationMode
    ): Promise<VideoResponse>;

    abstract getVideoUrl(item: EmbyItem): string;
    
    abstract getImageUrl(itemId: string, tag?: string, type?: 'Primary' | 'Backdrop'): string;

    // Favorite Logic (Playlist based)
    abstract getFavorites(libraryName: string): Promise<Set<string>>;
    abstract toggleFavorite(itemId: string, isFavorite: boolean, libraryName: string): Promise<void>;
}
