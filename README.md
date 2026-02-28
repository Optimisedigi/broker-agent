# Brokerage CRM - MVP

A secure, local-first CRM for mortgage brokers with meeting recording, document management, and bank policy matching.

## Overview

Multi-tenant desktop application for 5-20 brokers. Local data storage with encrypted sync. No Teams license required for recording.

## Tech Stack

- **Frontend:** Tauri (Rust) + React + TypeScript
- **Database:** SQLite (local, encrypted)
- **Recording:** Local screen/audio capture (no Teams license)
- **Transcription:** Whisper.cpp (local)
- **Outlook:** Microsoft Graph API
- **Sync:** mTLS encrypted to shared services

## MVP Features (Phase 1)

### Core
- [x] Client profiles (contact info, financial summary)
- [x] Document vault (encrypted storage for payslips, statements)
- [x] Meeting recorder with client capture
- [x] Email auto-import (documents link to clients automatically)
- [ ] Proposal generator (templates → PDF)
- [x] Basic bank matching (manual policy entry, eligibility check)
- [ ] Outlook integration (read emails, download attachments)

### Security & Compliance
- [ ] Data encryption at rest (AES-256)
- [ ] Consent recording (MFAA/FBAA compliant)
- [ ] Audit trails
- [ ] 7-year data retention

## Architecture

```
┌─────────────────────────────────────────┐
│         BROKER WORKSTATION              │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ Tauri App   │  │ SQLite (Encrypt)│  │
│  │ React UI    │  │                 │  │
│  └──────┬──────┘  └─────────────────┘  │
│         │                               │
│         ├── Screen/Audio Capture        │
│         ├── Whisper.cpp (local)         │
│         └── Outlook Graph API           │
└─────────┬───────────────────────────────┘
          │ mTLS
┌─────────▼───────────────────────────────┐
│      SHARED SERVICES (Self-hosted)      │
│  ┌──────────────┐  ┌────────────────┐  │
│  │ Bank Policy  │  │ Template Store │  │
│  │ Hub          │  │                │  │
│  └──────────────┘  └────────────────┘  │
└─────────────────────────────────────────┘
```

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup (Tauri + React)
- [ ] Database schema design
- [ ] Encryption layer implementation
- [ ] Basic UI shell

### Phase 2: Client Management (Weeks 3-4)
- [ ] Client CRUD operations
- [ ] Document upload/download
- [ ] Document categorization
- [ ] Search functionality

### Phase 3: Proposals (Weeks 5-6)
- [ ] Template system
- [ ] Dynamic field insertion
- [ ] PDF generation
- [ ] Email sending via Outlook

### Phase 4: Bank Matching (Weeks 7-8)
- [ ] Bank policy data model
- [ ] Eligibility calculator
- [ ] Best-fit recommendation
- [ ] Policy update mechanism

## Project Structure

```
brokerage-crm/
├── src/
│   ├── components/     # React components
│   ├── database/       # SQLite operations
│   ├── encryption/     # Crypto utilities
│   ├── outlook/        # MS Graph integration
│   ├── recording/      # Screen/audio capture
│   └── templates/      # Proposal templates
├── src-tauri/          # Rust backend
├── shared-services/    # Bank policy hub (future)
└── docs/              # Documentation
```

## Getting Started

```bash
# Install dependencies
npm install

# Run dev mode
npm run tauri dev

# Build
npm run tauri build
```

## Environment Variables

```env
# Outlook API
OUTLOOK_CLIENT_ID=
OUTLOOK_CLIENT_SECRET=
OUTLOOK_REDIRECT_URI=

# Encryption
MASTER_KEY=

# Shared Services (future)
SHARED_SERVICES_URL=
SHARED_SERVICES_KEY=
```

## Security Notes

- All client data encrypted locally
- No cloud storage of sensitive data
- Consent recording mandatory
- Audit log of all data access
- Secure key management required

## Email Auto-Import Feature

### How It Works

1. **During Meeting:** Broker enters client's name and email before recording
2. **After Meeting:** System asks "Save this client?"
3. **Email Linking:** Once saved, any emails from that address auto-import to their profile

### Flow

```
Client sends email with payslip
         ↓
Outlook webhook triggers
         ↓
System matches sender email to client
         ↓
Document auto-saved to client's vault
         ↓
Broker sees notification in CRM
```

### Document Types Auto-Detected

| Email Subject/Attachment | Document Type | Auto-Action |
|-------------------------|---------------|-------------|
| Contains "payslip" | Payslip | Save to Payslips folder |
| Contains "bank statement" | Bank Statement | Save to Bank Statements folder |
| Contains "ID"/"license"/"passport" | ID Document | Save to ID Documents folder |
| Other | General | Save to Unsorted (manual categorization) |

### Technical Implementation

**Database Schema:**
- `clients` table: stores email as unique identifier
- `email_imports` table: logs all auto-imported emails
- Index on `clients.email` for fast lookups

**Rust Commands:**
- `find_client_by_email` - checks if sender exists
- `import_email_document` - saves doc to client's vault
- `get_recent_email_imports` - shows recent auto-imports

**Security:**
- Email content processed locally
- Only attachments saved (not email body)
- Audit log of all imports
- Broker can disable auto-import per client

## Future Phases (Post-MVP)

### Phase 2: Meeting Intelligence
- [x] Recording with local transcription (UI built)
- [ ] Entity extraction (income, assets, etc.)
- [ ] Auto-populate client profiles from transcripts

### Phase 3: Advanced Bank Matching
- [ ] Automatic policy scraping
- [ ] Rate comparison
- [ ] Change alerts

### Phase 4: Multi-Broker
- [ ] Admin dashboard
- [ ] Broker management
- [ ] Analytics

## Open Questions

1. Which banks to support initially? (Big 4 + ?)
2. Existing CRM integration or replace?
3. Teams recording confirmation
4. Budget confirmation
5. Compliance requirements (MFAA/FBAA/ASIC)

## License

Private - Client Project
