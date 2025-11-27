
import { MediaClient } from './MediaClient';
import { EmbyItem, EmbyLibrary, FeedType, ServerConfig, VideoResponse } from '../types';

export class PlexClient extends MediaClient {
    
    private getCleanUrl() {
        return this.config.url.replace(/\/$/, "");
    }

    private getHeaders() {
        return {
            'Accept': 'application/json',
            'X-Plex-Token': this.config.token
        };
    }

    // Helper to robustly get MachineIdentifier, self-healing if config has fallback '1'
    private async getMachineIdentifier(): Promise<string> {
        if (this.config.userId && this.config.userId !== '1') {
            return this.config.userId;
        }
        try {
            const response = await fetch(`${this.getCleanUrl()}/identity`, {
                headers: this.getHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                return data.MediaContainer.machineIdentifier || data.MediaContainer.MachineIdentifier || '1';
            }
        } catch (e) {
            console.warn("Failed to fetch machine identifier", e);
        }
        return '1';
    }

    async authenticate(username: string, password: string): Promise<ServerConfig> {
        const token = password; 
        
        // Fetch Identity to get MachineIdentifier
        const response = await fetch(`${this.getCleanUrl()}/identity`, {
            headers: { 'Accept': 'application/json', 'X-Plex-Token': token }
        });

        if (!response.ok) {
            throw new Error('Plex Connection Failed. Please ensure you are using a valid X-Plex-Token as the password.');
        }

        const data = await response.json();
        // Support both casing conventions
        const machineIdentifier = data.MediaContainer.machineIdentifier || data.MediaContainer.MachineIdentifier;
        
        return {
            url: this.config.url,
            username: username || 'Plex User',
            userId: machineIdentifier || '1', // Store MachineIdentifier as userId for URI construction
            token: token,
            serverType: 'plex'
        };
    }

    async getLibraries(): Promise<EmbyLibrary[]> {
        const response = await fetch(`${this.getCleanUrl()}/library/sections`, { headers: this.getHeaders() });
        if (!response.ok) throw new Error('Failed to fetch Plex libraries');
        const data = await response.json();
        
        return data.MediaContainer.Directory.map((d: any) => ({
            Id: d.key,
            Name: d.title,
            CollectionType: d.type
        }));
    }

    async getVerticalVideos(parentId: string | undefined, libraryName: string, feedType: FeedType, skip: number, limit: number): Promise<VideoResponse> {
        // --- Favorites Handling ---
        if (feedType === 'favorites') {
            const playlist = await this.findPlaylist(libraryName);
            
            if (!playlist) {
                return { items: [], nextStartIndex: 0, totalCount: 0 };
            }

            // Fetch Playlist Items
            // Use ratingKey to construct robust URL. playlist.key often already contains /items which causes double /items/items if appended blindly.
            // Add large container size to ensure we get the latest items (which are appended to end)
            const response = await fetch(`${this.getCleanUrl()}/playlists/${playlist.ratingKey}/items?X-Plex-Container-Start=0&X-Plex-Container-Size=2000`, {
                headers: this.getHeaders()
            });

            if (!response.ok) return { items: [], nextStartIndex: 0, totalCount: 0 };

            const data = await response.json();
            const items = data.MediaContainer.Metadata || [];
            
            // Map to EmbyItem
            const mappedItems = this.mapPlexItems(items);

            // Filter Vertical
            const filtered = mappedItems.filter(item => {
                const w = item.Width || 0;
                const h = item.Height || 0;
                return h >= w * 0.8 && w > 0;
            });

            // Reverse to show newest added first
            const reversed = filtered.reverse();
            
            const paged = reversed.slice(skip, skip + limit);
            return {
                items: paged,
                nextStartIndex: skip + limit,
                totalCount: reversed.length
            };
        }

        // --- Standard Feed Logic ---
        if (!parentId) {
            return { items: [], nextStartIndex: 0, totalCount: 0 };
        }

        const start = skip;
        const size = feedType === 'random' ? 80 : 50; 
        
        let sort = 'addedAt:desc';
        if (feedType === 'random') sort = 'random';
        
        const params = new URLSearchParams({
            type: '1', 
            sort: sort,
            'X-Plex-Container-Start': start.toString(),
            'X-Plex-Container-Size': size.toString()
        });

        const response = await fetch(`${this.getCleanUrl()}/library/sections/${parentId}/all?${params.toString()}`, {
            headers: this.getHeaders()
        });

        if (!response.ok) throw new Error('Failed to fetch Plex videos');
        const data = await response.json();
        const items = data.MediaContainer.Metadata || [];
        const totalSize = data.MediaContainer.totalSize || 0;

        const mappedItems = this.mapPlexItems(items);

        const filtered = mappedItems.filter(item => {
            const w = item.Width || 0;
            const h = item.Height || 0;
            return h >= w * 0.8 && w > 0;
        });

        return {
            items: filtered,
            nextStartIndex: start + items.length, 
            totalCount: totalSize
        };
    }

    // Helper to map Plex JSON to EmbyItem
    private mapPlexItems(items: any[]): EmbyItem[] {
        return items.map((p: any) => {
             const media = p.Media?.[0];
             return {
                 Id: p.ratingKey,
                 Name: p.title,
                 Type: p.type,
                 MediaType: 'Video',
                 Overview: p.summary,
                 ProductionYear: p.year,
                 Width: media?.width,
                 Height: media?.height,
                 RunTimeTicks: p.duration ? p.duration * 10000 : undefined, 
                 ImageTags: {
                     Primary: p.thumb ? 'true' : undefined 
                 },
                 _PlexThumb: p.thumb,
                 _PlexKey: media?.Part?.[0]?.key
             };
        });
    }

    getVideoUrl(item: EmbyItem): string {
        // Prioritize Direct Play if Part Key exists.
        const plexItem = item as any;
        if (plexItem._PlexKey) {
            return `${this.getCleanUrl()}${plexItem._PlexKey}?X-Plex-Token=${this.config.token}`;
        }

        // Fallback to Transcode Universal (HLS)
        return `${this.getCleanUrl()}/video/:/transcode/universal/start?path=${encodeURIComponent('/library/metadata/' + item.Id)}&mediaIndex=0&partIndex=0&protocol=hls&offset=0&fastSeek=1&directPlay=0&directStream=1&subtitleSize=100&audioBoost=100&X-Plex-Token=${this.config.token}`;
    }

    getImageUrl(itemId: string, tag?: string, type?: 'Primary' | 'Backdrop'): string {
        const cleanUrl = this.getCleanUrl();
        const urlParam = `/library/metadata/${itemId}/thumb`; 
        return `${cleanUrl}/photo/:/transcode?url=${encodeURIComponent(urlParam)}&width=800&height=1200&X-Plex-Token=${this.config.token}`;
    }

    // --- Playlist Helpers ---

    private async findPlaylist(libraryName: string): Promise<any | null> {
        const title = `Tok-${libraryName}`;
        try {
            const response = await fetch(`${this.getCleanUrl()}/playlists?title=${encodeURIComponent(title)}`, {
                headers: this.getHeaders()
            });
            if (!response.ok) return null;
            const data = await response.json();
            // Plex fuzzy matches title in search, so double check
            return data.MediaContainer.Metadata?.find((p: any) => p.title === title) || null;
        } catch (e) {
            return null;
        }
    }

    async getFavorites(libraryName: string): Promise<Set<string>> {
        const playlist = await this.findPlaylist(libraryName);
        if (!playlist) return new Set();

        try {
            const response = await fetch(`${this.getCleanUrl()}/playlists/${playlist.ratingKey}/items?X-Plex-Container-Size=2000`, {
                headers: this.getHeaders()
            });
            if (!response.ok) return new Set();
            const data = await response.json();
            const items = data.MediaContainer.Metadata || [];
            return new Set(items.map((i: any) => i.ratingKey));
        } catch (e) {
            return new Set();
        }
    }

    async toggleFavorite(itemId: string, isFavorite: boolean, libraryName: string): Promise<void> {
        const playlist = await this.findPlaylist(libraryName);
        const machineId = await this.getMachineIdentifier();
        const itemUri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${itemId}`;
        const cleanUrl = this.getCleanUrl();

        if (isFavorite) {
            // --- REMOVE ---
            if (!playlist) return;
            
            // We need to find the specific PlaylistItemID (not the video ratingKey) to delete it
            // Using ratingKey for path is safer
            const itemsRes = await fetch(`${cleanUrl}/playlists/${playlist.ratingKey}/items?X-Plex-Container-Size=2000`, { headers: this.getHeaders() });
            if (!itemsRes.ok) return;
            
            const itemsData = await itemsRes.json();
            const entry = itemsData.MediaContainer.Metadata?.find((i: any) => i.ratingKey === itemId);
            
            if (entry && entry.playlistItemID) {
                // DELETE usually works fine with Headers, but let's append token just in case
                await fetch(`${cleanUrl}/playlists/${playlist.ratingKey}/items/${entry.playlistItemID}?X-Plex-Token=${this.config.token}`, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });
            }

        } else {
            // --- ADD ---
            if (playlist) {
                // Add to existing playlist (PUT)
                // Note: PUT requests on some Plex configs require token in Query Param
                await fetch(`${cleanUrl}/playlists/${playlist.ratingKey}/items?uri=${encodeURIComponent(itemUri)}&X-Plex-Token=${this.config.token}`, {
                    method: 'PUT',
                    headers: this.getHeaders()
                });
            } else {
                // Create new playlist with this item (POST)
                const title = `Tok-${libraryName}`;
                await fetch(`${cleanUrl}/playlists?type=video&title=${encodeURIComponent(title)}&smart=0&uri=${encodeURIComponent(itemUri)}&X-Plex-Token=${this.config.token}`, {
                    method: 'POST',
                    headers: this.getHeaders()
                });
            }
        }
    }
}
