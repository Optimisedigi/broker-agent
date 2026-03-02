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

// Whisper model
const WHISPER_MODEL_FILENAME: &str = "ggml-large-v3.bin";
const WHISPER_MODEL_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin";

fn get_model_dir() -> Result<std::path::PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or("Failed to get data directory")?
        .join("BrokerageCRM");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn get_model_path() -> Result<std::path::PathBuf, String> {
    Ok(get_model_dir()?.join(WHISPER_MODEL_FILENAME))
}

#[tauri::command]
pub fn check_whisper_model() -> Result<bool, String> {
    let path = get_model_path()?;
    Ok(path.exists())
}

#[tauri::command]
pub fn get_whisper_model_status() -> Result<serde_json::Value, String> {
    let path = get_model_path()?;
    let exists = path.exists();
    let size = if exists {
        std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };
    Ok(serde_json::json!({
        "downloaded": exists,
        "model_name": WHISPER_MODEL_FILENAME,
        "size_bytes": size,
        "path": path.to_string_lossy(),
    }))
}

#[tauri::command]
pub async fn download_whisper_model(app: AppHandle) -> Result<String, String> {
    let model_path = get_model_path()?;
    if model_path.exists() {
        return Ok("Model already downloaded".to_string());
    }

    let temp_path = model_path.with_extension("bin.downloading");

    let client = reqwest::Client::new();
    let resp = client
        .get(WHISPER_MODEL_URL)
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
pub fn transcribe_audio(audio_data: Vec<u8>) -> Result<String, String> {
    let model_path = get_model_path()?;
    if !model_path.exists() {
        return Err("Whisper model not downloaded. Go to Settings to download it.".to_string());
    }

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

    // Initialize whisper
    let ctx = whisper_rs::WhisperContext::new_with_params(
        model_path.to_str().unwrap(),
        whisper_rs::WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to load Whisper model: {}", e))?;

    let mut state = ctx.create_state()
        .map_err(|e| format!("Failed to create Whisper state: {}", e))?;

    let mut params = whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    state.full(params, &resampled)
        .map_err(|e| format!("Transcription failed: {}", e))?;

    let num_segments = state.full_n_segments()
        .map_err(|e| format!("Failed to get segments: {}", e))?;

    let mut transcript = String::new();
    for i in 0..num_segments {
        if let Ok(text) = state.full_get_segment_text(i) {
            transcript.push_str(&text);
            transcript.push(' ');
        }
    }

    Ok(transcript.trim().to_string())
}
