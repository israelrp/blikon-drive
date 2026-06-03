use std::path::Path;
use reqwest::Client;
use serde::Deserialize;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

const CHUNK_SIZE: u64 = 4 * 1024 * 1024; // 4 MB

#[derive(Deserialize)]
struct InitResponse { id: String }

#[derive(Deserialize)]
struct ChunkResponse { #[serde(rename = "blockId")] block_id: String }

/// Deserializa JSON mostrando el body en caso de error — facilita diagnóstico
async fn parse_json<T: for<'de> Deserialize<'de>>(
    resp: reqwest::Response,
    ctx: &str,
) -> anyhow::Result<T> {
    let status = resp.status();
    let body   = resp.text().await?;
    if !status.is_success() {
        anyhow::bail!("[upload] {ctx} → {status}: {body}");
    }
    serde_json::from_str(&body).map_err(|e| {
        anyhow::anyhow!("[upload] {ctx} decode error: {e} — body: {}", &body[..body.len().min(300)])
    })
}

pub async fn upload_file(
    client: &Client,
    api_url: &str,
    core_folder_id: &str,
    file_path: &Path,
    on_progress: impl Fn(i32),
) -> anyhow::Result<String> {
    let file_name  = file_path.file_name().unwrap().to_string_lossy().to_string();
    let metadata   = tokio::fs::metadata(file_path).await?;
    let size_bytes = metadata.len();
    let mime_type  = mime_guess::from_path(file_path).first_or_octet_stream().to_string();

    // 1. Init
    let resp = client
        .post(format!("{api_url}/api/files/upload/init"))
        .json(&serde_json::json!({
            "coreFolderId": core_folder_id,
            "fileName":     file_name,
            "mimeType":     mime_type,
            "sizeBytes":    size_bytes,
        }))
        .send().await?;
    let init: InitResponse = parse_json(resp, "upload/init").await?;

    // 2. Chunks
    let mut file      = File::open(file_path).await?;
    let mut block_ids = Vec::new();
    let total_chunks  = (size_bytes as f64 / CHUNK_SIZE as f64).ceil() as u64;
    let mut buf       = vec![0u8; CHUNK_SIZE as usize];

    for i in 0..total_chunks {
        let offset = i * CHUNK_SIZE;
        let read   = file.read(&mut buf).await?;
        if read == 0 { break; }

        let chunk_data = buf[..read].to_vec();
        let part = reqwest::multipart::Part::bytes(chunk_data)
            .file_name(file_name.clone())
            .mime_str(&mime_type)?;
        let form = reqwest::multipart::Form::new().part("chunk", part);

        let resp = client
            .post(format!("{api_url}/api/files/upload/{}/chunk?offset={}&totalSize={}", init.id, offset, size_bytes))
            .multipart(form)
            .send().await?;
        let chunk: ChunkResponse = parse_json(resp, "upload/chunk").await?;

        block_ids.push(chunk.block_id);
        on_progress(((i + 1) as f64 / total_chunks as f64 * 90.0) as i32);
    }

    // 3. Commit
    client
        .post(format!("{api_url}/api/files/upload/{}/commit", init.id))
        .json(&serde_json::json!({ "blockIds": block_ids }))
        .send().await?;

    on_progress(100);
    Ok(init.id)
}
