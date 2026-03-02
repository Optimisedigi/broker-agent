# Brokeragent

A secure, local-first desktop CRM for mortgage brokers. Manage clients, deals, documents, meetings, and bank policy matching, all from your desktop with zero cloud dependency.

## Download

| Platform | Installer | Notes |
|----------|-----------|-------|
| macOS (Apple Silicon) | [Brokeragent.dmg](https://github.com/Optimisedigi/brokerage-crm/releases/latest) | macOS 12+ |
| Windows | [Brokeragent_Setup.exe](https://github.com/Optimisedigi/brokerage-crm/releases/latest) | Windows 10+ |

Download the latest release from the [Releases page](https://github.com/Optimisedigi/brokerage-crm/releases).

## Security and Privacy

- **100% local**: All data is stored in a SQLite database on your machine. Nothing is sent to external servers.
- **No telemetry**: The app collects zero analytics or usage data.
- **On-device transcription**: Meeting recordings are transcribed locally using OpenAI Whisper. Audio never leaves your computer.
- **OAuth tokens stored locally**: Gmail and Outlook credentials are kept in your local database and are never shared.

## Installation

### macOS

1. Download `Brokeragent.dmg` from the Releases page.
2. Open the `.dmg` and drag **Brokeragent** to your Applications folder.
3. On first launch, macOS Gatekeeper will block the app because it is not signed with an Apple Developer certificate.
   - Right-click (or Control-click) the app in Applications and select **Open**.
   - Click **Open** in the dialog that appears. You only need to do this once.

### Windows

1. Download `Brokeragent_Setup.exe` from the Releases page.
2. Run the installer. Windows SmartScreen may show a warning because the app is not code-signed.
   - Click **More info**, then click **Run anyway**.
3. The installer runs per-user and does not require administrator privileges.

## First Launch

On first launch the app will download the Whisper large-v3 model (~3 GB). This is a one-time download. After that, transcription works fully offline.

You can start using all other features (clients, deals, documents, email sync) immediately while the model downloads in the background.

## Data Location and Backup

All application data is stored in a single SQLite file:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/BrokerageCRM/database.db` |
| Windows | `C:\Users\<you>\AppData\Roaming\BrokerageCRM\database.db` |

The Whisper model is stored alongside it in the same directory.

To back up your data, copy the `database.db` file to a safe location.

## System Requirements

| | Minimum | Recommended |
|---|---------|-------------|
| **OS** | macOS 12+ / Windows 10+ | macOS 14+ / Windows 11 |
| **RAM** | 8 GB | 16 GB (for transcription) |
| **Disk** | 4 GB free | 8 GB free |

Transcription is CPU-intensive. 16 GB RAM and a modern multi-core processor are recommended for comfortable real-time use.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Type-check
npx tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

## Creating a Release

Tag a version and push to trigger the CI/CD pipeline:

```bash
git tag v0.1.0
git push --tags
```

This runs GitHub Actions to build macOS `.dmg` and Windows `.exe` installers, attached as a draft release on GitHub.

## License

Private
