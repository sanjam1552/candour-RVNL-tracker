# Workspace Rules & Context - Candour Creative & PR Reporting Hub

## Future Work: PR Clients & Admin Permissions Drawer Redesign

When requested to add the 20 PR clients or optimize the Admin Panel, follow these instructions:

### 1. Centralized PR Clients Configuration
Add the following 20 new clients as "PR-Only" clients in the `PR_ONLY_CLIENTS` configuration array inside [app.js](file:///f:/work%20candour/tools%20for%20work/reporting%20tool/app.js) so that `isPROnlyClient(client)` evaluates to `true` for all of them:
`"Zoom", "Databricks", "DXC", "Delinea", "RVNL", "SUSE", "DEP", "IIIT Hyd", "LDCS", "NIIT University", "NIIT MTS", "Atlassian", "OutSystems", "Ziroh Labs", "OVHcloud", "TalentSprint", "Neo4j", "Arup", "WSA", "Tenarai"`

### 2. Client Switcher UI Clean Up
To prevent dropdown clutter in the sidebar client selector:
- Group the clients in the selector popup under two headings: "PR Accounts" and "Social & Creative Accounts".
- Add a search/filter input at the top of the client list popup so the user can quickly type to filter client names.

### 3. Admin Panel Redesign (Scaling to 25+ Clients)
To prevent horizontal overflow and clutter on smaller screen laptops:
- **Main Admin User Table**: Simplify the main user grid to just 4 columns: `Team Member Email` | `Is Admin?` (Checkbox) | `Client Access Summary` (e.g., "Access to 8 Clients") | `Edit Permissions` (Button).
- **Edit Permissions Drawer**: Clicking `Edit Permissions` opens a slide-out drawer matching the design of `.task-drawer`. Inside the drawer:
  1. Add **Quick-Assign Template Buttons** at the top:
     - `[ Grant Full PR Access ]` (Instantly sets all 20 PR clients to Full Access)
     - `[ Grant Full Social Access ]` (Instantly sets all social/creative clients to Full Access)
     - `[ Revoke All Access ]`
  2. Add a **Search Box** to filter client list items in real-time.
  3. Render a **Vertical Client Grid** grouped by category ("PR ACCOUNTS" vs. "SOCIAL & CREATIVE ACCOUNTS") with dropdowns next to each (`No Access`, `Read-Only`, `Full Access`).

## Future Work: Resource Hub & Google Drive Integration

When requested to fully build out the Resource Hub and Google Drive backend connection, adhere to the following specifications:

### 1. Adaptive Client Workspaces (PR vs. Marketing)
Ensure the library content, folder trees, and contacts tables adapt dynamically based on whether `isPROnlyClient(client)` evaluates to `true` or `false`:
*   **PR Clients (PR-Only)**:
    *   **Resource Library**: Render categories for *Business Pitches*, *Case Studies*, *Press Release Kits*, and *MoMs* (90-Day Retention Badge).
    *   **Contacts Directory**: Show **Journalist Contacts** table: `Journalist Name` | `Publication` | `Beat/Niche` | `Pitch Status`.
    *   **Drive Folders**: Simulates `/Clients/[Client Name]/Pitches/`, `Case Studies/`, `Press Releases/`, and `MoMs/`.
*   **Marketing & Creative Clients**:
    *   **Resource Library**: Render categories for *Business Pitches*, *Case Studies*, *Logos & Brand Identity*, *Creative Templates* (with links to Canva), *Photo Gallery* (grid with lightbox preview), and *MoMs* (60-Day Retention Badge).
    *   **Contacts Directory**: Show **Social Media Influencers** table: `Creator Name` | `Platform` | `Niche` | `Reach` | `Engagement Rate`.
    *   **Drive Folders**: Simulates `/Clients/[Client Name]/Logos & Brand/`, `Photo Gallery/`, `Creative Assets/`, `Pitches/`, and `MoMs/`.

### 2. Google Drive Storage Integration Pipeline
*   **Authentication & Tokens**: Set up Google Workspace OAuth2 API client credentials. Store token payloads securely in Firestore or read them via Vercel env variables, wrapping API routes in a serverless proxy `/api/drive` to prevent frontend CORS blockages.
*   **Smart Folder Router**: The file uploader must auto-detect:
    1.  The active client workspace name.
    2.  The file extension (e.g. `.png` image goes to `/Photo Gallery/`, `.psd` design layout goes to `/Creative Assets/`, `.docx` notes go to `/Press Releases/` or `/Pitches/`).
    It then streams the binary chunk directly to that specific folder ID in your Google Drive workspace.
*   **Metadata Auto-Fill**: On successful upload, automatically save metadata in Firestore (`fileName`, `fileSize`, `uploadDate`, `ownerEmail`, `driveFileLink`, `category`).

### 3. Automated MoM Retention Manager
*   Configure a daily cron scheduler (or Firestore TTL rules) checking the creation timestamp of logged MoMs.
*   After **60 days** (for Marketing clients) or **90 days** (for PR clients), the system must:
    1. Change status from `Active` to `Archived`.
    2. Programmatically move the file on Google Drive to `/Archives/[Client Name]/MoMs/`.
    3. Remove the MoM from the main active dashboard view.

## Future Work: AI Integration & Automation (Gemini & Claude)

When requested to deploy the AI features (summarization, pitch writing, copywriting, or analytics summaries), adhere to the following specifications:

### 1. API Security & Access Configuration
*   **Key Storage**: Use the browser key `localStorage.getItem("rvnl_gemini_key")` for client-side API requests. For secure backend processes or high-stakes generation (e.g. Claude), wrap requests in a serverless endpoint `/api/ai` to keep keys hidden from the client browser.
*   **Model Selection**:
    *   **Gemini 1.5 Flash**: Use for low-cost, fast structured JSON extractions (MoMs, task listing, file parsing).
    *   **Gemini 1.5 Pro**: Use when ingesting large multimodal datasets (e.g. processing audio logs of meetings or multi-month historical archives).
    *   **Claude 3.5 Sonnet**: Use specifically for the **AI PR Writer** to draft external emails or creative social copywriting where human-like tone is critical.

### 2. Core Automation Pipelines

#### A. MoM Smart Action-Item Extractor
*   **Input**: Text notes pasted by users or document files parsed via the backend.
*   **AI Prompting**: Direct Gemini to return a structured JSON object containing:
    1.  `meetingTitle`: Short, context-aware title.
    2.  `actionItems`: Array of objects with `taskName`, `assignee` (must match configured team members), and `dueDate` (calculated relative to today).
    3.  `nextSyncDate`: Extracted next sync timestamp.
*   **Action**: Automatically write these extracted action items as individual `In Progress` task documents directly into the Firestore tracking collections.

#### B. Personalised PR Pitch Generator
*   **Input**: Stored **Leadership Profile** details (headshot bio, background) and chosen **Media Outlet Contact** (journalist name, beat, publication).
*   **Action**: Prompt Claude to draft a personalized outreach email framing the client's announcement specifically to match the journalist’s beat, injecting relevant quotes from the leadership team bios.

#### C. Competitor & Trend Analyst
*   **Input**: Retrieve brand citation rates and AI search engine visibility charts from **Otterly**.
*   **Action**: Summarize market shifts and generate recommended strategies (e.g., *"We recommend publishing a new blog targeting Perplexity Search for keyword X"*).

