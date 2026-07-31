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
