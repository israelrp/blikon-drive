use std::path::Path;
use reqwest::Client;
use serde::Deserialize;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

const CHUNK_SIZE: u64 = 4 * 1024 * 1024; // 4 MB

#[derive(Deserialize)]
struct InitResponse { id: String }

#[derive(Deserialize)]
struct ChunkResponse { #[serde(rename = "blockId")] block_id: String }

pub async fn upload_file(
    client: &Client,
    api_url: &str,
    core_folder_id: &str,
    file_path: &Path,
    on_progress: impl Fn(i32),
) -> anyhow::Result<String> {
    let file_name = file_path.file_name().unwrap().to_string_lossy().to_string();
    let metadata  = tokio::fs::metadata(file_path).await?;
    let size_bytes = metadata.len();
    let mime_type  = mime_guess::from_path(file_path).first_or_octet_stream().to_string();

    // 1. Init
    let init: InitResponse = client
        .post(format!("{api_url}/api/files/upload/init"))
        .json(&serde_json::json!({
            "coreFolderId": core_folder_id,
            "fileName":     file_name,
            "mimeType":     mime_type,
            "sizeBytes":    size_bytes,
        }))
        .send().await?
        .json().await?;

    // 2. Chunks
    let mut file       = File::open(file_path).await?;
    let mut block_ids  = Vec::new();
    let total_chunks   = (size_bytes as f64 / CHUNK_SIZE as f64).ceil() as u64;
    let mut buf        = vec![0u8; CHUNK_SIZE as usize];

    for i in 0..total_chunks {
        let offset = i * CHUNK_SIZE;
        let read   = file.read(&mut buf).await?;
        if read == 0 { break; }

        let chunk_data = buf[..read].to_vec();

        let part = reqwest::multipart::Part::bytes(chunk_data)
            .file_name(file_name.clone())
            .mime_str(&mime_type)?;
        let form = reqwest::multipart::Form::new().part("chunk", part);

        let resp: ChunkResponse = client
            .post(format!("{api_url}/api/files/upload/{}/chunk?offset={}&totalSize={}", init.id, offset, size_bytes))
            .multipart(form)
            .send().await?
            .json().await?;

        block_ids.push(resp.block_id);
        let pct = ((i + 1) as f64 / total_chunks as f64 * 90.0) as i32;
        on_progress(pct);
    }

    // 3. Commit
    client
        .post(format!("{api_url}/api/files/upload/{}/commit", init.id))
        .json(&serde_json::json!({ "blockIds": block_ids }))
        .send().await?;

    on_progress(100);
    Ok(init.id)
}
