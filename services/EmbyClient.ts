
import { MediaClient } from './MediaClient';
import { EmbyItem, EmbyLibrary, FeedType, ServerConfig, VideoResponse, OrientationMode } from '../types';

export class EmbyClient extends MediaClient {
    
    private getHeaders() {
        const CLIENT_NAME = "EmbyTok Web";
        const CLIENT_VERSION = "1.0.0";
        const DEVICE_NAME = "Web Browser";
        const DEVICE_ID = "embytok-web-" + this.config.serverType; // rudimentary ID

        return {
            'Content-Type': 'application/json',
            'X-Emby-Authorization': `MediaBrowser Client="${CLIENT_NAME}", Device="${DEVICE_NAME}", DeviceId="${DEVICE_ID}", Version="${CLIENT_VERSION}"${this.config.token ? `, Token="${this.config.token}"` : ''}`,
        };
    }

    private getCleanUrl() {
        return this.config.url.replace(/\/$/, "");
    }

    async authenticate(username: string, password: string): Promise<ServerConfig> {
        const cleanUrl = this.getCleanUrl();
        const response = await fetch(`${cleanUrl}/Users/AuthenticateByName`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                Username: username,
                Pw: password,
            }),
        });

        if (!response.ok) {
            throw new Error('Emby Authentication failed');
        }

        const data = await response.json();
        return {
            url: this.config.url,
            username: data.User.Name,
            userId: data.User.Id,
            token: data.AccessToken,
            serverType: 'emby'
        };
    }

    async getLibraries(): Promise<EmbyLibrary[]> {
        const response = await fetch(`${this.getCleanUrl()}/Users/${this.config.userId}/Views`, {
            headers: this.getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch libraries');
        const data = await response.json();
        return data.Items || [];
    }

    private filterItems(items: EmbyItem[], mode: OrientationMode): EmbyItem[] {
        if (mode === 'both') return items;
        
        return items.filter(item => {
            const w = item.Width || 0;
            const h = item.Height || 0;
            if (w === 0) return true; // Keep items with no info to be safe
            
            if (mode === 'vertical') {
                return h >= w * 0.8; // Allow slightly wide videos that are still "vertical-ish" (4:5)
            } else if (mode === 'horizontal') {
                return w > h;
            }
            return true;
        });
    }

    async getVideos(parentId: string | undefined, libraryName: string, feedType: FeedType, skip: number, limit: number, orientationMode: OrientationMode): Promise<VideoResponse> {
        // --- Favorites Handling ---
        if (feedType === 'favorites') {
            const playlistItems = await this.getTokPlaylistItemsInternal(libraryName);
            
            const filtered = this.filterItems(playlistItems, orientationMode);
            const reversed = filtered.reverse();
            const paged = reversed.slice(skip, skip + limit);
            return {
                items: paged,
                nextStartIndex: skip + limit,
                totalCount: reversed.length
            };
        }

        // --- Standard Feed ---
        // Fetch a bit more if we are filtering
        const FETCH_BATCH_SIZE = feedType === 'random' ? 80 : 50; 
        const params = new URLSearchParams({
            IncludeItemTypes: 'Movie,Video,Episode',
            Recursive: 'true',
            Fields: 'MediaSources,Width,Height,Overview,UserData', 
            Limit: FETCH_BATCH_SIZE.toString(),
            StartIndex: skip.toString(),
            ImageTypeLimit: '1',
            EnableImageTypes: 'Primary,Backdrop,Banner,Thumb',
            _t: Date.now().toString()
        });

        if (feedType === 'random') {
            params.append('SortBy', 'Random');
        } else {
            params.append('SortBy', 'DateCreated');
            params.append('SortOrder', 'Descending');
        }

        if (parentId) {
            params.append('ParentId', parentId);
        }

        const response = await fetch(`${this.getCleanUrl()}/Users/${this.config.userId}/Items?${params.toString()}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch videos');

        const data = await response.json();
        const rawItems: EmbyItem[] = data.Items || [];
        const totalCount = data.TotalRecordCount || 0;

        const filteredItems = this.filterItems(rawItems, orientationMode);

        return {
            items: filteredItems,
            nextStartIndex: skip + rawItems.length,
            totalCount: totalCount
        };
    }

    getVideoUrl(item: EmbyItem): string {
        return `${this.getCleanUrl()}/Videos/${item.Id}/stream.mp4?Static=true&api_key=${this.config.token}`;
    }

    getImageUrl(itemId: string, tag?: string, type: 'Primary' | 'Backdrop' = 'Primary'): string {
        if (!tag) return '';
        return `${this.getCleanUrl()}/Items/${itemId}/Images/${type}?maxWidth=800&tag=${tag}&quality=90`;
    }

    // --- Playlist Helpers for Favorites ---

    private async getTokPlaylistId(libraryName: string): Promise<string> {
        const playlistName = `Tok-${libraryName}`;
        const headers = this.getHeaders();
        const cleanUrl = this.getCleanUrl();

        const searchRes = await fetch(`${cleanUrl}/Users/${this.config.userId}/Items?IncludeItemTypes=Playlist&Recursive=true&Fields=Id,Name`, { headers });
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            const existing = searchData.Items?.find((i: any) => i.Name === playlistName);
            if (existing) return existing.Id;
        }

        const createRes = await fetch(`${cleanUrl}/Playlists?Name=${playlistName}&UserId=${this.config.userId}`, { method: 'POST', headers });
        if (!createRes.ok) throw new Error("Failed to create Tok playlist");
        const createData = await createRes.json();
        return createData.Id;
    }

    private async getTokPlaylistItemsInternal(libraryName: string): Promise<EmbyItem[]> {
        try {
            const pid = await this.getTokPlaylistId(libraryName);
            const response = await fetch(`${this.getCleanUrl()}/Playlists/${pid}/Items?UserId=${this.config.userId}&Fields=MediaSources,Width,Height,Overview,UserData`, {
                headers: this.getHeaders()
            });
            if (!response.ok) return [];
            const data = await response.json();
            return data.Items || [];
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    async getFavorites(libraryName: string): Promise<Set<string>> {
        const items = await this.getTokPlaylistItemsInternal(libraryName);
        return new Set(items.map(i => i.Id));
    }

    async toggleFavorite(itemId: string, isFavorite: boolean, libraryName: string): Promise<void> {
        const pid = await this.getTokPlaylistId(libraryName);
        const cleanUrl = this.getCleanUrl();
        const headers = this.getHeaders();

        if (!isFavorite) {
             // Add
             await fetch(`${cleanUrl}/Playlists/${pid}/Items?Ids=${itemId}&UserId=${this.config.userId}`, {
                method: 'POST',
                headers
            });
        } else {
            // Remove
            const itemsRes = await fetch(`${cleanUrl}/Playlists/${pid}/Items?Fields=Id,PlaylistItemId&UserId=${this.config.userId}`, { headers });
            if (!itemsRes.ok) return;
            const itemsData = await itemsRes.json();
            const entry = itemsData.Items.find((i: any) => i.Id === itemId);
            if (entry && entry.PlaylistItemId) {
                await fetch(`${cleanUrl}/Playlists/${pid}/Items?EntryIds=${entry.PlaylistItemId}`, {
                    method: 'DELETE',
                    headers
                });
            }
        }
    }
}
