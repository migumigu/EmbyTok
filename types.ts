
export type ServerType = 'emby' | 'plex';

export interface ServerConfig {
  url: string;
  username: string;
  token: string;
  userId: string;
  serverType: ServerType;
}

export interface EmbyAuthResponse {
  User: {
    Id: string;
    Name: string;
    Policy?: {
      IsAdministrator: boolean;
    };
  };
  AccessToken: string;
  ServerId: string;
}

export interface EmbyLibrary {
  Id: string;
  Name: string;
  CollectionType?: string;
}

export interface MediaSource {
  Id: string;
  Container: string;
  Path: string;
  Protocol: string;
}

// Using a generic name but keeping compatibility with existing code structure
export interface EmbyItem {
  Id: string;
  Name: string;
  Type: string;
  MediaType: string;
  Overview?: string;
  ProductionYear?: number;
  Width?: number;
  Height?: number;
  RunTimeTicks?: number;
  MediaSources?: MediaSource[];
  ImageTags?: {
    Primary?: string;
    Logo?: string;
    Thumb?: string;
  };
  UserData?: {
    IsFavorite: boolean;
    PlaybackPositionTicks: number;
    PlayCount: number;
  };
}

export type FeedType = 'latest' | 'random' | 'favorites';

export type OrientationMode = 'vertical' | 'horizontal' | 'both';

export interface VideoResponse {
    items: EmbyItem[];
    nextStartIndex: number;
    totalCount: number;
}
