use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

use crate::db::RecordingState;

// Global state for the recording thread communication
lazy_static::lazy_static! {
    static ref RECORDING_SAMPLES: Mutex<Option<Arc<Mutex<Vec<f32>>>>> = Mutex::new(None);
    static ref RECORDING_FLAG: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);
}

#[tauri::command]
pub fn start_recording(recording: State<RecordingState>) -> Result<String, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    if recording.is_recording.load(Ordering::SeqCst) {
        return Err("Already recording".to_string());
    }

    // Clear previous samples
    {
        let mut samples = recording.samples.lock().map_err(|e| e.to_string())?;
        samples.clear();
    }

    recording.is_recording.store(true, Ordering::SeqCst);

    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or_else(|| {
            recording.is_recording.store(false, Ordering::SeqCst);
            "No input device available".to_string()
        })?;

    let config = device.default_input_config()
        .map_err(|e| {
            recording.is_recording.store(false, Ordering::SeqCst);
            format!("Failed to get input config: {}", e)
        })?;

    {
        let mut sr = recording.sample_rate.lock().map_err(|e| {
            recording.is_recording.store(false, Ordering::SeqCst);
            e.to_string()
        })?;
        *sr = config.sample_rate().0;
    }

    let is_recording = Arc::new(AtomicBool::new(true));
    let is_recording_clone = is_recording.clone();

    // Spawn recording thread
    let samples_arc: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_for_callback = samples_arc.clone();
    let recording_flag = recording.is_recording.load(Ordering::SeqCst);
    let _ = recording_flag;

    // Build and play the stream in a separate thread
    std::thread::spawn(move || {
        let stream = match config.sample_format() {
            cpal::SampleFormat::F32 => {
                let samples = samples_for_callback.clone();
                let is_rec = is_recording_clone.clone();
                device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if is_rec.load(Ordering::SeqCst) {
                            if let Ok(mut s) = samples.lock() {
                                s.extend_from_slice(data);
                            }
                        }
                    },
                    |err| eprintln!("Recording error: {}", err),
                    None,
                )
            }
            cpal::SampleFormat::I16 => {
                let samples = samples_for_callback.clone();
                let is_rec = is_recording_clone.clone();
                device.build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if is_rec.load(Ordering::SeqCst) {
                            if let Ok(mut s) = samples.lock() {
                                s.extend(data.iter().map(|&v| v as f32 / 32768.0));
                            }
                        }
                    },
                    |err| eprintln!("Recording error: {}", err),
                    None,
                )
            }
            _ => {
                eprintln!("Unsupported sample format");
                return;
            }
        };

        match stream {
            Ok(s) => {
                if let Err(e) = s.play() {
                    eprintln!("Failed to start stream: {}", e);
                    return;
                }
                // Keep thread alive while recording
                while is_recording_clone.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                drop(s);
            }
            Err(e) => {
                eprintln!("Failed to build stream: {}", e);
            }
        }
    });

    // Store the Arc references globally for stop
    RECORDING_SAMPLES.lock().map_err(|e| {
        recording.is_recording.store(false, Ordering::SeqCst);
        e.to_string()
    })?.replace(samples_arc);
    RECORDING_FLAG.lock().map_err(|e| {
        recording.is_recording.store(false, Ordering::SeqCst);
        e.to_string()
    })?.replace(is_recording);

    Ok("Recording started".to_string())
}

#[tauri::command]
pub fn stop_recording(recording: State<RecordingState>) -> Result<Vec<u8>, String> {
    recording.is_recording.store(false, Ordering::SeqCst);

    // Signal the recording thread to stop
    if let Ok(flag_guard) = RECORDING_FLAG.lock() {
        if let Some(flag) = flag_guard.as_ref() {
            flag.store(false, Ordering::SeqCst);
        }
    }

    // Give the thread a moment to flush
    std::thread::sleep(std::time::Duration::from_millis(300));

    // Get the samples
    let samples = if let Ok(samples_guard) = RECORDING_SAMPLES.lock() {
        if let Some(samples_arc) = samples_guard.as_ref() {
            samples_arc.lock().map_err(|e| e.to_string())?.clone()
        } else {
            return Err("No recording data".to_string());
        }
    } else {
        return Err("Failed to access recording data".to_string());
    };

    let sample_rate = *recording.sample_rate.lock().map_err(|e| e.to_string())?;
    if sample_rate == 0 || samples.is_empty() {
        return Err("No audio recorded".to_string());
    }

    // Convert to mono if multi-channel
    let mono = samples.clone();

    // Resample to 16kHz for Whisper
    let target_rate = 16000u32;
    let resampled = if sample_rate != target_rate {
        let ratio = sample_rate as f64 / target_rate as f64;
        let new_len = (mono.len() as f64 / ratio) as usize;
        (0..new_len)
            .map(|i| {
                let src_idx = (i as f64 * ratio) as usize;
                mono.get(src_idx).copied().unwrap_or(0.0)
            })
            .collect::<Vec<f32>>()
    } else {
        mono
    };

    // Build WAV
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: target_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut wav_data = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut wav_data);
        let mut writer = hound::WavWriter::new(cursor, spec)
            .map_err(|e| format!("Failed to create WAV: {}", e))?;
        for &sample in &resampled {
            let s = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(s).map_err(|e| format!("Failed to write sample: {}", e))?;
        }
        writer.finalize().map_err(|e| format!("Failed to finalize WAV: {}", e))?;
    }

    // Clean up globals
    if let Ok(mut g) = RECORDING_SAMPLES.lock() { *g = None; }
    if let Ok(mut g) = RECORDING_FLAG.lock() { *g = None; }

    Ok(wav_data)
}

// Whisper models
struct WhisperModel {
    filename: &'static str,
    url: &'static str,
    label: &'static str,
    size_label: &'static str,
}

const MODELS: &[WhisperModel] = &[
    WhisperModel {
        filename: "ggml-medium.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        label: "Medium",
        size_label: "~1.5 GB",
    },
    WhisperModel {
        filename: "ggml-large-v3.bin",
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
        label: "Large",
        size_label: "~3.1 GB",
    },
];

fn get_model_info(model_size: &str) -> Result<&'static WhisperModel, String> {
    MODELS.iter()
        .find(|m| m.label.eq_ignore_ascii_case(model_size))
        .ok_or_else(|| format!("Unknown model size: {}. Use 'medium' or 'large'.", model_size))
}

fn get_model_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("BrokerageCRM");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn gpu_available() -> bool {
    cfg!(target_os = "macos")
}

#[tauri::command]
pub fn check_whisper_model() -> Result<bool, String> {
    let dir = get_model_dir()?;
    Ok(MODELS.iter().any(|m| dir.join(m.filename).exists()))
}

#[tauri::command]
pub fn get_whisper_model_status() -> Result<serde_json::Value, String> {
    let dir = get_model_dir()?;
    let models: Vec<serde_json::Value> = MODELS.iter().map(|m| {
        let path = dir.join(m.filename);
        let exists = path.exists();
        let size = if exists {
            std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };
        serde_json::json!({
            "id": m.label.to_lowercase(),
            "label": m.label,
            "filename": m.filename,
            "size_label": m.size_label,
            "downloaded": exists,
            "size_bytes": size,
            "path": path.to_string_lossy(),
        })
    }).collect();

    // Find the active model (largest downloaded model)
    let active = MODELS.iter().rev()
        .find(|m| dir.join(m.filename).exists())
        .map(|m| m.label.to_lowercase());

    Ok(serde_json::json!({
        "models": models,
        "active_model": active,
        "gpu_available": gpu_available(),
        "gpu_backend": if cfg!(target_os = "macos") { "Metal" } else { "CPU" },
    }))
}

#[tauri::command]
pub async fn download_whisper_model(app: AppHandle, model_size: Option<String>) -> Result<String, String> {
    let size = model_size.unwrap_or_else(|| "medium".to_string());
    let model_info = get_model_info(&size)?;
    let model_path = get_model_dir()?.join(model_info.filename);

    if model_path.exists() {
        return Ok("Model already downloaded".to_string());
    }

    let temp_path = model_path.with_extension("bin.downloading");

    let client = reqwest::Client::new();
    let resp = client
        .get(model_info.url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed with status: {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);

    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    use std::io::Write;
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;

        // Emit progress event
        if total_size > 0 {
            let pct = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            let _ = app.emit("whisper-download-progress", serde_json::json!({
                "downloaded": downloaded,
                "total": total_size,
                "percent": pct,
            }));
        }
    }

    drop(file);

    // Rename temp file to final path
    std::fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("Failed to finalize download: {}", e))?;

    Ok("Download complete".to_string())
}

#[tauri::command]
pub async fn delete_whisper_model(model_size: String) -> Result<String, String> {
    let model_info = get_model_info(&model_size)?;
    let model_path = get_model_dir()?.join(model_info.filename);
    if model_path.exists() {
        std::fs::remove_file(&model_path)
            .map_err(|e| format!("Failed to delete model: {}", e))?;
    }
    Ok("Model deleted".to_string())
}

#[tauri::command]
pub fn set_active_whisper_model(model_size: String) -> Result<String, String> {
    let model_info = get_model_info(&model_size)?;
    let model_path = get_model_dir()?.join(model_info.filename);
    if !model_path.exists() {
        return Err(format!("{} model is not downloaded yet", model_info.label));
    }
    // Store preference
    let pref_path = get_model_dir()?.join("active_model.txt");
    std::fs::write(&pref_path, model_size.to_lowercase())
        .map_err(|e| format!("Failed to save preference: {}", e))?;
    Ok(format!("Active model set to {}", model_info.label))
}

fn get_active_model_path() -> Result<std::path::PathBuf, String> {
    let dir = get_model_dir()?;
    // Check for saved preference
    let pref_path = dir.join("active_model.txt");
    if let Ok(pref) = std::fs::read_to_string(&pref_path) {
        if let Ok(info) = get_model_info(pref.trim()) {
            let path = dir.join(info.filename);
            if path.exists() {
                return Ok(path);
            }
        }
    }
    // Fallback: use any downloaded model (prefer medium for speed)
    for model in MODELS.iter() {
        let path = dir.join(model.filename);
        if path.exists() {
            return Ok(path);
        }
    }
    Err("No Whisper model downloaded. Go to Settings to download one.".to_string())
}

#[tauri::command]
pub async fn transcribe_audio(audio_data: Vec<u8>) -> Result<String, String> {
    let model_path = get_active_model_path()?;

    // Run the CPU-intensive transcription on a blocking thread
    // so it doesn't freeze the UI / main async runtime
    tokio::task::spawn_blocking(move || {
        // Parse WAV file
        let cursor = std::io::Cursor::new(audio_data);
        let mut reader = hound::WavReader::new(cursor)
            .map_err(|e| format!("Failed to read WAV data: {}", e))?;

        let spec = reader.spec();
        let samples: Vec<f32> = if spec.sample_format == hound::SampleFormat::Float {
            reader.samples::<f32>()
                .filter_map(|s| s.ok())
                .collect()
        } else {
            reader.samples::<i16>()
                .filter_map(|s| s.ok())
                .map(|s| s as f32 / 32768.0)
                .collect()
        };

        // Convert to mono if stereo
        let mono_samples: Vec<f32> = if spec.channels == 2 {
            samples.chunks(2).map(|c| (c[0] + c.get(1).copied().unwrap_or(0.0)) / 2.0).collect()
        } else {
            samples
        };

        // Resample to 16kHz if needed
        let target_rate = 16000;
        let resampled = if spec.sample_rate != target_rate {
            let ratio = spec.sample_rate as f64 / target_rate as f64;
            let new_len = (mono_samples.len() as f64 / ratio) as usize;
            (0..new_len)
                .map(|i| {
                    let src_idx = (i as f64 * ratio) as usize;
                    mono_samples.get(src_idx).copied().unwrap_or(0.0)
                })
                .collect()
        } else {
            mono_samples
        };

        // Initialize whisper with GPU acceleration when available
        let mut ctx_params = whisper_rs::WhisperContextParameters::default();
        if gpu_available() {
            ctx_params.use_gpu(true);
            eprintln!("[Whisper] GPU acceleration enabled");
        }

        let ctx = whisper_rs::WhisperContext::new_with_params(
            model_path.to_str().unwrap(),
            ctx_params,
        )
        .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

        let mut state = ctx.create_state()
            .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

        let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_n_threads(std::thread::available_parallelism().map(|n| n.get() as i32).unwrap_or(4));

        state.full(params, &resampled)
            .map_err(|e| format!("Transcription failed: {}", e))?;

        let num_segments = state.full_n_segments();

        let mut transcript = String::new();
        for i in 0..num_segments {
            if let Some(segment) = state.get_segment(i) {
                if let Ok(text) = segment.to_str_lossy() {
                    transcript.push_str(&text);
                    transcript.push(' ');
                }
            }
        }

        Ok::<String, String>(transcript.trim().to_string())
    })
    .await
    .map_err(|e| format!("Transcription task failed: {}", e))?
}
