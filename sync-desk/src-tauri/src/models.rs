use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub blikon_id:    String,
    pub crono_code:   String,
    pub profile_name: String,
    pub email:        String,
    pub photo:        String,
    pub first_name:   String,
    pub last_name:    String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub api_url:      String,
    pub blikon_id:    String,
    pub crono_code:   String,
    pub sync_folders: Vec<SyncFolder>,
    #[serde(default)]
    pub user_profile: Option<UserProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFolder {
    pub id:             String,
    pub local_path:     String,
    pub core_folder_id: String,
    pub label:          String,
    pub enabled:        bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncEntry {
    pub id:             String,
    pub sync_folder_id: String,
    pub file_name:      String,
    pub local_path:     String,
    pub file_id:        Option<String>,
    pub size_bytes:     i64,
    pub status:         String,
    pub progress:       i32,
    pub error:          Option<String>,
    pub updated_at:     String,
}
