export type SyncStatus = "idle" | "syncing" | "error" | "paused";

export type AuthState = "checking" | "authenticated" | "unauthenticated";

export interface UserInfo {
  blikonId:    string;
  profileName: string;
  email:       string;
  photo:       string;
  firstName:   string;
  lastName:    string;
}

export interface SyncFolder {
  id:           string;
  localPath:    string;
  coreFolderId: string;
  label:        string;
  enabled:      boolean;
}

export interface SyncEntry {
  id:           string;
  syncFolderId: string;
  fileName:     string;
  localPath:    string;
  fileId:       string | null;
  sizeBytes:    number;
  status:       "pending" | "uploading" | "synced" | "error";
  progress:     number;
  error:        string | null;
  updatedAt:    string;
}

export interface AppConfig {
  apiUrl:       string;
  blikonId:     string;
  syncFolders:  SyncFolder[];
  userProfile?: UserInfo;
}
