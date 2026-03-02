use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use chrono::Local;
use sha2::{Digest, Sha256};

const HMAC_SECRET: &[u8] = b"ba-crm-license-key-s3cret-2026";

fn hmac_sha256(secret: &[u8], message: &[u8]) -> Vec<u8> {
    let block_size = 64;
    let key = if secret.len() > block_size {
        let mut hasher = Sha256::new();
        hasher.update(secret);
        hasher.finalize().to_vec()
    } else {
        secret.to_vec()
    };

    let mut ipad = vec![0x36u8; block_size];
    let mut opad = vec![0x5cu8; block_size];
    for i in 0..key.len() {
        ipad[i] ^= key[i];
        opad[i] ^= key[i];
    }

    let mut inner = Sha256::new();
    inner.update(&ipad);
    inner.update(message);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(&opad);
    outer.update(inner_hash);
    outer.finalize().to_vec()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let mut email = String::new();
    let mut months: u32 = 12;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--email" => {
                i += 1;
                email = args.get(i).expect("Missing value for --email").clone();
            }
            "--months" => {
                i += 1;
                months = args
                    .get(i)
                    .expect("Missing value for --months")
                    .parse()
                    .expect("--months must be a number");
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    if email.is_empty() {
        eprintln!("Usage: generate_license --email user@example.com [--months 12]");
        std::process::exit(1);
    }

    let now = Local::now().date_naive();
    let exp = now + chrono::Months::new(months);

    let payload = serde_json::json!({
        "email": email,
        "exp": exp.format("%Y-%m-%d").to_string(),
        "iat": now.format("%Y-%m-%d").to_string(),
    });

    let payload_bytes = serde_json::to_vec(&payload).unwrap();
    let payload_b64 = URL_SAFE_NO_PAD.encode(&payload_bytes);
    let sig = hmac_sha256(HMAC_SECRET, &payload_bytes);
    let sig_b64 = URL_SAFE_NO_PAD.encode(&sig);

    let key = format!("BA-v1.{}.{}", payload_b64, sig_b64);

    println!("License Key Generated");
    println!("---------------------");
    println!("Email:   {}", email);
    println!("Issued:  {}", now);
    println!("Expires: {}", exp);
    println!("Months:  {}", months);
    println!();
    println!("{}", key);
}
