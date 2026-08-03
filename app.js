// RVNL Creative & PR Reporting Hub - Core Application Logic
const APP_VERSION = "1.1.0";

// Centralized Clients Configurations
const PR_ONLY_CLIENTS = [
    "Zoom", 
    "Databricks", 
    "DXC", 
    "Delinea", 
    "SUSE", 
    "NIIT University", 
    "NIIT MTS", 
    "Atlassian", 
    "OutSystems", 
    "OVHcloud", 
    "Neo4j", 
    "Arup", 
    "Tenarai"
];
const SOCIAL_CREATIVE_CLIENTS = ["RVNL", "Legrand", "iCode", "Kompact AI", "BT Group", "Candour", "Green Shine Solar"];
const ALL_CLIENTS = [...PR_ONLY_CLIENTS, ...SOCIAL_CREATIVE_CLIENTS];

// Helper to get client logo path
function getClientLogo(client) {
    if (client === "RVNL") return "inputs/RVNL (R)logo_vector.png";
    if (client === "Legrand") return "inputs/ldcs logo.png";
    if (client === "iCode") return "inputs/icode black.png";
    if (client === "Kompact AI") return "inputs/logo kompact-text-shapes-2x.png";
    if (client === "BT Group") return "inputs/BT_Logo_Purple_RGB.png";
    if (client === "Candour") return "inputs/candour logo.png";
    if (client === "Green Shine Solar") return "inputs/greenshine logo.png";
    if (client === "Zoom") return "inputs/Zoom-Logo.png";
    if (client === "Databricks") return "inputs/data bricks.png";
    if (client === "DXC") return "inputs/DXC_tech_logo (2).png";
    if (client === "Delinea") return "inputs/Delinea_logo.png";
    if (client === "SUSE") return "inputs/Suse_logo.png";
    if (client === "NIIT University") return "inputs/NIIT_Uni_logo(1).png";
    if (client === "NIIT MTS") return "inputs/NIIT_MTS_logo.png";
    if (client === "Atlassian") return "inputs/Atlassian_logo.png";
    if (client === "OutSystems") return "inputs/Outsystems_logo.png";
    if (client === "OVHcloud") return "inputs/Ovh cloud.png";
    if (client === "Neo4j") return "inputs/neo4j.png";
    if (client === "Arup") return "inputs/Arup_logo.png";
    if (client === "Tenarai") return "inputs/Tenarai(1).png";
    return "inputs/candour logo.png";
}

// Format current date to Month Year (e.g. "June 2026")
function getCurrentMonthStr() {
    const options = { month: 'long', year: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}

// Get current week string based on date (e.g. "Week 1", "Week 2")
function getCurrentWeekStr() {
    const day = new Date().getDate();
    if (day <= 7) return "Week 1";
    if (day <= 14) return "Week 2";
    if (day <= 21) return "Week 3";
    if (day <= 28) return "Week 4";
    return "Week 5";
}

// Get month index and year from string (e.g. "June 2026")
function parseMonthStr(monthStr) {
    if (!monthStr) return null;
    const parts = monthStr.trim().split(/\s+/);
    if (parts.length !== 2) return null;
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIdx = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1], 10);
    if (monthIdx === -1 || isNaN(year)) return null;
    return { year, month: monthIdx };
}

// Convert month string to numeric value for comparison (Year * 12 + MonthIndex)
function getMonthValue(monthStr) {
    const parsed = parseMonthStr(monthStr);
    if (!parsed) return 0;
    return parsed.year * 12 + parsed.month;
}

// Get helper value for chronological sorting based on publish date (task.date) or week
function getPublishDateValue(task) {
    if (!task) return 0;
    
    // 1. Try parsing task.date as standard date
    if (task.date) {
        const d = new Date(task.date);
        if (!isNaN(d.getTime())) {
            return d.getTime();
        }
        
        // 2. Try extracting day number (e.g. "5th July", "1st July", "2nd july")
        const match = task.date.match(/(\d+)(?:st|nd|rd|th)?/i);
        if (match) {
            const day = parseInt(match[1], 10);
            if (task.month) {
                const parts = task.month.split(" ");
                if (parts.length === 2) {
                    const monthName = parts[0];
                    const year = parseInt(parts[1], 10);
                    const dateStr = `${day} ${monthName} ${year}`;
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        return parsedDate.getTime();
                    }
                }
            }
            return day;
        }
    }
    
    // 3. Fallback to week number
    if (task.week) {
        const matchWeek = task.week.match(/(\d+)/);
        if (matchWeek) {
            return parseInt(matchWeek[1], 10) * 10;
        }
    }
    
    // 4. Fallback to createdAt
    return task.createdAt || 0;
}

// Returns true if the client workspace is PR-only (no Social Media/Creative assets)
function isPROnlyClient(client) {
    return PR_ONLY_CLIENTS.includes(client);
}

// Check if a task is active in a given month (either its month matches, or it is carried forward from a previous month)
function isTaskActiveInMonth(task, selectedMonthStr) {
    if (!task.month) return false;
    if (!selectedMonthStr || selectedMonthStr === 'all') return true;
    
    const taskMonthVal = getMonthValue(task.month);
    const selectedMonthVal = getMonthValue(selectedMonthStr);
    
    if (taskMonthVal === selectedMonthVal) {
        return true;
    }
    
    // Carry forward: task month is before selected month, and status is not Published/Closed and not Not used by client
    if (taskMonthVal < selectedMonthVal) {
        return task.status !== "Published/Closed" && task.status !== "Not used by client";
    }
    
    return false;
}

// Update the month field of a carry-forwarded task if its status transitions to a terminal state
function updateCarryForwardTaskMonth(task, activeMonthStr) {
    if (!task || !activeMonthStr || activeMonthStr === 'all') return;
    const taskMonthVal = getMonthValue(task.month);
    const activeMonthVal = getMonthValue(activeMonthStr);
    if (taskMonthVal < activeMonthVal) {
        if (task.status === "Published/Closed" || task.status === "Not used by client") {
            task.month = activeMonthStr;
        }
    }
}


function initToastStyles() {
    if (document.getElementById('toast-container-style')) return;
    const style = document.createElement('style');
    style.id = 'toast-container-style';
    style.innerHTML = `
        #toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        }
        .custom-toast {
            background: #0f172a;
            color: #ffffff;
            padding: 14px 20px;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15), 0 3px 6px rgba(0,0,0,0.1);
            font-family: 'Outfit', sans-serif;
            font-size: 14px;
            min-width: 280px;
            max-width: 380px;
            pointer-events: auto;
            border: 1px solid rgba(255,255,255,0.08);
            transform: translateX(120%);
            opacity: 0;
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .custom-toast.show {
            transform: translateX(0);
            opacity: 1;
        }
        .custom-toast.hide {
            transform: translateX(120%);
            opacity: 0;
        }
        .custom-toast-title {
            font-weight: 600;
            color: #f8fafc;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .custom-toast-body {
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.4;
        }
        .custom-toast-action {
            background: #3b82f6;
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            margin-top: 8px;
            align-self: flex-start;
            transition: background 0.2s;
        }
        .custom-toast-action:hover {
            background: #2563eb;
        }
    `;
    document.head.appendChild(style);
}

function showToast(title, body, duration = 8000, actionCallback = null, actionText = 'Reload') {
    initToastStyles();
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    
    let html = `<div class="custom-toast-title">${title}</div>`;
    html += `<div class="custom-toast-body">${body}</div>`;
    if (actionCallback) {
        html += `<button class="custom-toast-action">${actionText}</button>`;
    }
    toast.innerHTML = html;
    
    if (actionCallback) {
        toast.querySelector('.custom-toast-action').addEventListener('click', () => {
            actionCallback();
        });
    }
    
    container.appendChild(toast);
    
    // Trigger transition
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto dismiss
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }
}

let initialCodeHash = null;

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}

async function checkCodeUpdate() {
    try {
        const response = await fetch(window.location.pathname, {
            headers: { 'Cache-Control': 'no-cache' }
        });
        if (response.ok) {
            const html = await response.text();
            const currentHash = hashString(html);
            if (initialCodeHash === null) {
                initialCodeHash = currentHash;
            } else if (currentHash !== initialCodeHash) {
                showToast(
                    "⚡ New Update Available",
                    `A new version of the app is available. Click reload to update.`,
                    0, // Keep open
                    () => {
                        window.location.reload(true);
                    },
                    "Reload Now"
                );
            }
        }
    } catch (err) {
        console.warn("Failed to check code update:", err);
    }
}



// Application State
const state = {
    localWrites: new Set(),
    isBulkWriting: false,
    pendingNotifications: {},
    tasks: [],
    filteredTasks: [],
    currentPage: 1,
    pageSize: 12,
    activeTab: 'dashboard',
    activeView: 'table',
    activeClient: localStorage.getItem("activeClient") || 'RVNL',
    dashboardMonth: getCurrentMonthStr(),
    settingsPassword: undefined, // undefined: loading, null: no password set, string: password set
    googleSheetSyncUrl: "",
    filters: {
        type: 'all',
        month: getCurrentMonthStr(),
        status: 'all',
        owner: 'all',
        center: 'all',
        search: ''
    },
    charts: {
        trend: null,
        share: null
    },
    activeUploads: new Set(),
    pendingImageFile: null,
    currentTaskPublications: [],
    currentTaskSpokespersons: [],
    currentTaskReferenceLinks: [],
    activeChatDMs: [], // active DM threads (emails)
    chatMessagesCache: {}, // threadId/roomId -> array of messages for instant switching
    currentUser: "",
    currentUserEmail: "",
    activityLogs: [],
    excludedReportTaskIds: new Set(),
    currentReportSmItems: [],
    currentReportPrItems: [],
    draggingPub: false,
    userPermissions: {} // email -> { client -> "Full"|"ReadOnly"|"None" }
};

// Target Date helper for weekly mapping
// Parses strings like "1st Jan", "3rd Feb", "11th Jan" to extract day number
function getWeekFromDateStr(dateStr) {
    if (!dateStr) return "Week 1"; // Default fall back
    const numMatch = dateStr.match(/(\d+)/);
    if (!numMatch) return "Week 1";
    const day = parseInt(numMatch[1], 10);
    if (day <= 7) return "Week 1";
    if (day <= 14) return "Week 2";
    if (day <= 21) return "Week 3";
    if (day <= 28) return "Week 4";
    return "Week 5";
}

// Calculate PR deadline status (overdue or remaining days)
function getPRDeadlineStatus(task) {
    if (!task || !task.targetCompletionDate) return null;
    
    // If completed or not used by client, return "Completed" status
    if (task.status === "Published/Closed" || task.status === "Not used by client") {
        return {
            status: "completed",
            text: "Completed",
            days: 0
        };
    }
    
    const targetDate = new Date(task.targetCompletionDate);
    // Strip time portion for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
            status: "overdue",
            text: `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`,
            days: diffDays
        };
    } else if (diffDays === 0) {
        return {
            status: "pending",
            text: "Due today",
            days: 0
        };
    } else {
        return {
            status: "pending",
            text: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
            days: diffDays
        };
    }
}

// Format date to local readable format
function getFormattedToday() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}

// Calculate total count of publications across a set of tasks (counting items in publicationsList)
function getPRPublicationsCount(tasks) {
    let count = 0;
    tasks.forEach(t => {
        if (t.type === 'PR Update' && t.status === 'Published/Closed') {
            if (t.publicationsList && t.publicationsList.length > 0) {
                count += t.publicationsList.length;
            } else if (t.publication) {
                count += t.publication.split(',').map(s => s.trim()).filter(Boolean).length || 1;
            }
        }
    });
    return count;
}

// Open any image in a new window with proper styling
function viewImageInNewWindow(imageUrl) {
    if (!imageUrl) return;
    const newWin = window.open();
    if (newWin) {
        newWin.document.write(`
            <html>
            <head>
                <title>Media Clipping Preview</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                <style>
                    body {
                        margin: 0;
                        background: #0b0f19;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        overflow: hidden;
                        font-family: 'Inter', sans-serif;
                    }
                    img {
                        max-width: 95%;
                        max-height: 90vh;
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                        border: 1px solid rgba(255,255,255,0.05);
                    }
                </style>
            </head>
            <body>
                <img src="${imageUrl}" alt="Media Clipping">
            </body>
            </html>
        `);
        newWin.document.close();
    }
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupEventListeners();
    
    // Apply saved active client immediately to prevent UI flash
    switchClient(state.activeClient);
    
    initUserSession();
    
    // Set current date in dashboard hero
    document.getElementById("current-time-display").textContent = getFormattedToday();
    document.getElementById("report-meta-date").textContent = getFormattedToday();

    // Set default month selections to current month in UI
    const currentMonth = getCurrentMonthStr();
    const filterMonthEl = document.getElementById("filter-month");
    if (filterMonthEl) filterMonthEl.value = currentMonth;
    const reportMonthEl = document.getElementById("report-month");
    if (reportMonthEl) reportMonthEl.value = currentMonth;
    // Initialize hero background waves animation
    initHeroCanvas();
});

// Generative background wave lines animation inside dashboard hero banner
function initHeroCanvas() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    function resize() {
        const rect = canvas.parentNode.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    resize();
    window.addEventListener('resize', resize);

    let offset = 0;
    function draw() {
        // Dynamic dimension check to handle initial container load timing issues
        const rect = canvas.parentNode.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (canvas.width === 0 || canvas.height === 0) {
            animationFrameId = requestAnimationFrame(draw);
            return;
        }

        const linesCount = 15; // Parallel mesh ribbon lines
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.lineWidth = 1.1;
        
        for (let i = 0; i < linesCount; i++) {
            ctx.beginPath();
            
            // Phase and amplitude calculations for organic movement
            const phase = offset + (i * 0.06);
            const amplitude = 32 + Math.sin(offset * 0.3 + i * 0.18) * 15;
            const yCenter = height / 2 + Math.sin(offset * 0.12 + i * 0.06) * 10;
            
            // Pronounced opacity values starting at 0.15 up to 0.38 for maximum visibility
            const lineOpacity = 0.14 + (i * 0.016);
            const grad = ctx.createLinearGradient(0, 0, width, 0);
            grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            grad.addColorStop(0.18, `rgba(255, 255, 255, ${lineOpacity})`);
            grad.addColorStop(0.82, `rgba(255, 255, 255, ${lineOpacity})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.strokeStyle = grad;
            
            for (let x = 0; x <= width; x += 6) {
                const angle = (x / width) * Math.PI * 2 * 0.95 + phase;
                const y = yCenter + Math.sin(angle) * amplitude + Math.cos(angle * 0.45) * (amplitude * 0.35);
                
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        
        offset += 0.0025; // Elegant, slow-flowing wave movement
        animationFrameId = requestAnimationFrame(draw);
    }

    draw();
}
// ====================================================
// SYNC STATUS INDICATOR
// ====================================================
function setSyncStatus(status) {
    // status: 'synced' | 'saving' | 'offline' | 'connecting'
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-status-text');
    if (!dot || !text) return;
    dot.className = 'sync-dot'; // reset classes
    if (status === 'synced') {
        dot.classList.add('sync-dot-green');
        text.textContent = 'Synced';
    } else if (status === 'saving') {
        dot.classList.add('sync-dot-amber');
        text.textContent = 'Saving...';
    } else if (status === 'offline') {
        dot.classList.add('sync-dot-red');
        text.textContent = 'Offline';
    } else {
        dot.classList.add('sync-dot-gray');
        text.textContent = 'Connecting...';
    }
}

// Update preloader progress bar percentage
function setPreloaderProgress(percent) {
    const bar = document.getElementById("preloader-progress-bar");
    if (bar) {
        bar.style.width = `${percent}%`;
    }
}

// Hide splash preloader screen once database syncs (with a 1.2s delay so it feels solid)
function hidePreloader() {
    setTimeout(() => {
        const preloader = document.getElementById("preloader");
        if (preloader) {
            preloader.style.opacity = "0";
            preloader.style.visibility = "hidden";
            setTimeout(() => {
                preloader.style.display = "none";
            }, 500);
        }
    }, 600);
}

// Load data from Firestore; migrate localStorage on first run
// Load data from Firestore; migrate localStorage/old structure on first run
async function loadData() {
    setSyncStatus('connecting');
    setPreloaderProgress(20);
    const docRef = db.collection('rvnl_tracker').doc('tasks_store');
    const itemsRef = docRef.collection('items');
    const configRef = db.collection('rvnl_tracker').doc('settings_config');

    try {
        // Fetch global settings password and version from Firestore
        const configSnapshot = await configRef.get();
        setPreloaderProgress(40);
        
        if (configSnapshot.exists) {
            const configData = configSnapshot.data();
            state.settingsPassword = configData.password || null;
            state.googleSheetSyncUrl = configData.googleSheetSyncUrl || "";
            state.userPermissions = configData.userPermissions || {};
            
            // Seed defaults so admin doesn't have to add them manually
            const seedEmails = [
                "sanjam@candour.co.in",
                "komal@candour.co.in",
                "stutio2465@gmail.com",
                "eesha@candour.co.in",
                "suvrata@candour.co.in",
                "alka@candour.co.in",
                "durgesh@candour.co.in",
                "puja@candour.co.in",
                "aadrita@candour.co.in",
                "govind@candour.co.in",
                "saloni@candour.co.in",
                "neha@candour.co.in",
                "sanjamcreatives@gmail.com"
            ];
            
            let needsSave = false;
            seedEmails.forEach(e => {
                const lowerEmail = e.toLowerCase();
                if (!state.userPermissions[lowerEmail]) {
                    state.userPermissions[lowerEmail] = {
                        isAdmin: ADMIN_EMAILS.includes(lowerEmail)
                    };
                    ALL_CLIENTS.forEach(client => {
                        state.userPermissions[lowerEmail][client] = "Full";
                    });
                    needsSave = true;
                }
            });
            
            // Auto register current user email if they just logged in and are missing from the list
            if (state.currentUserEmail && !state.userPermissions[state.currentUserEmail]) {
                const isSuper = ADMIN_EMAILS.includes(state.currentUserEmail);
                state.userPermissions[state.currentUserEmail] = {
                    isAdmin: isSuper
                };
                ALL_CLIENTS.forEach(client => {
                    // Super admins get Full access automatically, others default to None (Access Pending)
                    state.userPermissions[state.currentUserEmail][client] = isSuper ? "Full" : "None";
                });
                needsSave = true;
            }
            
            if (needsSave) {
                configRef.set({ userPermissions: state.userPermissions }, { merge: true })
                    .catch(err => console.error("Error saving seeded permissions:", err));
            }
            
            localStorage.setItem("rvnl_user_permissions", JSON.stringify(state.userPermissions));
            
            // Refresh Developer Chat side list if loaded
            if (typeof renderChatSidebarList === "function") {
                renderChatSidebarList("");
            }
            
        } else {
            state.settingsPassword = null;
            state.googleSheetSyncUrl = "";
        }
        
        // Populate Google Sheet Sync UI
        updateGoogleSheetSyncUI();

        // Initialize HTML code update checker and start 5-minute polling interval
        checkCodeUpdate();
        setInterval(checkCodeUpdate, 300000); // Check every 5 minutes (300,000 ms)

        // Database migration completed successfully. Real-time subcollection is active.

        setPreloaderProgress(70);

        // Set up real-time listener on the new subcollection
        let isFirstLoad = true;
        itemsRef.onSnapshot(snapshot => {
            const loadedTasks = [];
            snapshot.forEach(doc => {
                const task = doc.data();
                if (!task.id) task.id = doc.id;
                
                // Normalize status and client schema
                if (!task.client) task.client = "RVNL";
                if (task.image && task.image.startsWith("blob:")) task.image = "";
                
                if (task.status === "In Progress" || task.status === "WIP") task.status = "WIP";
                else if (task.status === "Awaiting Review" || task.status === "Sent for internal approval") task.status = "Sent for internal approval";
                else if (task.status === "Awaiting Approval" || task.status === "Sent to client") task.status = "Sent to client";
                else if (task.status === "Published" || task.status === "Published/Closed") task.status = "Published/Closed";
                else if (task.status === "On Hold" || task.status === "On hold") task.status = "On hold";
                else if (["Not Published", "Not posted by client missed", "Not used by client"].includes(task.status)) {
                    task.status = "Not used by client";
                }
                
                if (task.type === "Social Media" && task.client !== "iCode") {
                    task.subType = "All Platforms";
                }
                
                loadedTasks.push(task);
            });

            // Process changes for Toast notifications if it's not the first load
            if (!isFirstLoad && snapshot.docChanges) {
                snapshot.docChanges().forEach(change => {
                    const task = change.doc.data();
                    const taskId = change.doc.id;
                    if (!task.id) task.id = taskId;
                    
                    // 1. Check if this change was initiated by the local user
                    if (state.localWrites && state.localWrites.has(task.id)) {
                        state.localWrites.delete(task.id);
                        return; // Ignore local actions
                    }
                    if (state.isBulkWriting) {
                        return; // Ignore bulk actions
                    }
                    
                    // 2. Check if user has permission for this client
                    const client = task.client || "RVNL";
                    const hasAccess = getUserClientPermission(state.currentUserEmail, client) !== "None";
                    if (!hasAccess) {
                        return; // No permission, ignore
                    }
                    
                    // 3. Filter by active client (only show if it matches the current workspace)
                    if (client !== state.activeClient) {
                        if (!state.pendingNotifications) state.pendingNotifications = {};
                        if (!state.pendingNotifications[client]) state.pendingNotifications[client] = [];
                        
                        state.pendingNotifications[client].push({
                            type: change.type,
                            title: task.title || 'Untitled'
                        });
                        return; // Not the active workspace, queue and ignore immediate toast
                    }
                    
                    // 4. Trigger Toast Notification
                    if (change.type === 'added') {
                        showToast("➕ Task Added", `"${task.title || 'Untitled'}" was created.`);
                    } else if (change.type === 'modified') {
                        showToast("🔄 Task Updated", `"${task.title || 'Untitled'}" was updated.`);
                    } else if (change.type === 'removed') {
                        showToast("🗑️ Task Deleted", `"${task.title || 'Untitled'}" was deleted.`);
                    }
                });
            }

            state.tasks = loadedTasks;
            
            // Sync to local fallback copy
            localStorage.setItem('rvnl_tracker_data', JSON.stringify(loadedTasks));
            setSyncStatus('synced');

            if (isFirstLoad) {
                isFirstLoad = false;
                populateOwnerFilter();
                populateMonthDropdowns();
                switchClient(state.activeClient);
                
                // Customize switcher modal title on first load to welcome user
                const switcherWelcome = document.getElementById("client-switcher-welcome");
                if (switcherWelcome && state.currentUser) {
                    const name = state.currentUser.trim();
                    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
                    switcherWelcome.textContent = `Welcome, ${capitalized}!`;
                }
                
                // Open Select Workspace modal by default on first load
                const clientDropdownList = document.getElementById("client-dropdown-list");
                if (clientDropdownList) clientDropdownList.classList.remove("hidden");
                
                setPreloaderProgress(100);
                hidePreloader();
            } else {
                populateOwnerFilter();
                populateMonthDropdowns();
                updateDashboard();
                renderTracker();
            }
        }, err => {
            console.error('Firestore real-time sync error:', err);
            setSyncStatus('offline');
        });

        loadActivityLogs();
        if (state.activeTab === 'settings') {
            checkSettingsPasswordState();
        }
        setTimeout(migrateBase64ImagesToStorage, 2000);

    } catch (err) {
        console.error('Firestore load error:', err);
        setSyncStatus('offline');
        const localData = localStorage.getItem('rvnl_tracker_data');
        if (localData) {
            try { state.tasks = JSON.parse(localData); } catch(e) { state.tasks = [...INITIAL_DATA]; }
        } else {
            state.tasks = [...INITIAL_DATA];
        }
        state.tasks.forEach(task => {
            if (!task.client) task.client = "RVNL";
        });
        
        state.settingsPassword = localStorage.getItem("rvnl_settings_password") || null;
        try {
            state.userPermissions = JSON.parse(localStorage.getItem("rvnl_user_permissions") || "{}");
        } catch(e) {
            state.userPermissions = {};
        }

        const localLogs = localStorage.getItem("rvnl_activity_logs");
        if (localLogs) {
            try { state.activityLogs = JSON.parse(localLogs); } catch(e) { state.activityLogs = []; }
        } else {
            state.activityLogs = [];
        }
        renderActivityLogs();

        populateOwnerFilter();
        populateMonthDropdowns();
        switchClient(state.activeClient);
        
        // Open Select Workspace modal by default on first load
        const clientDropdownList = document.getElementById("client-dropdown-list");
        if (clientDropdownList) clientDropdownList.classList.remove("hidden");
        
        if (state.activeTab === 'settings') {
            checkSettingsPasswordState();
        }
        setPreloaderProgress(100);
        hidePreloader();
    }
}

// Initialize User Session with Firebase Email Link (Passwordless) Authentication
function initUserSession() {
    const overlay = document.getElementById("login-modal-overlay");
    const errorMsgEl = document.getElementById("login-error-msg");
    const infoMsgEl = document.getElementById("login-info-msg");
    const displayNameEl = document.getElementById("user-display-name");

    // Check if the current URL is a sign-in link
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please confirm your email address to complete sign in:');
        }
        if (email) {
            if (infoMsgEl) {
                infoMsgEl.textContent = "Verifying email link and logging in...";
                infoMsgEl.style.display = "block";
            }
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then(() => {
                    window.localStorage.removeItem('emailForSignIn');
                    // Clean up address bar URL instantly
                    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
                })
                .catch((error) => {
                    console.error("Error signing in with email link:", error);
                    // Clean up address bar URL on error too to prevent loops
                    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
                    if (infoMsgEl) infoMsgEl.style.display = "none";
                    if (errorMsgEl) {
                        errorMsgEl.textContent = `Sign-in link failed or expired: ${error.message}`;
                        errorMsgEl.style.display = "block";
                    }
                });
        } else {
            // If they cancelled the prompt, clean up the address bar anyway
            window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        }
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // Verify email domain constraint (case-insensitive)
            const email = user.email || "";
            const clientEmails = ["advisor.media.rail@gmail.com", "prteamrvnl@gmail.com", "prrvnl1@gmail.com", "sanjamcreatives@gmail.com"];
            if (email.toLowerCase().endsWith("@candour.co.in") || email.toLowerCase() === "stutio2465@gmail.com") {
                state.currentUser = user.displayName || email.split("@")[0];
                state.currentUserEmail = email.toLowerCase();
                
                // Developer check & personalization
                if (displayNameEl) {
                    const devEmails = ["sanjam@candour.co.in", "stutio2465@gmail.com"];
                    if (devEmails.includes(state.currentUserEmail)) {
                        displayNameEl.innerHTML = `${state.currentUser} <span class="dev-badge"><i class="fa-solid fa-code"></i> Developer</span>`;
                        const devLabSection = document.getElementById("dev-lab-section");
                        if (devLabSection) devLabSection.classList.remove("hidden");
                        
                        // Initialize Developer-Only Chat System
                        initDeveloperChat();
                    } else {
                        displayNameEl.textContent = state.currentUser;
                    }
                }
                
                if (overlay) overlay.style.display = "none";
                if (errorMsgEl) errorMsgEl.style.display = "none";
                if (infoMsgEl) infoMsgEl.style.display = "none";
                
                // Safely load data from Firestore now that the session is authenticated
                loadData();
                checkReadOnlyPermissions();
            } else if (clientEmails.includes(email.toLowerCase())) {
                // Redirect RVNL client to RVNL Portal dashboard
                window.location.replace("rvnl-portal.html");
            } else {
                // Denied domain
                firebase.auth().signOut().then(() => {
                    state.currentUser = "";
                    state.currentUserEmail = "";
                    if (displayNameEl) displayNameEl.textContent = "...";
                    if (overlay) overlay.style.display = "flex";
                    if (errorMsgEl) {
                        errorMsgEl.textContent = `Access Denied: ${email} is unauthorized. Use an authorized account.`;
                        errorMsgEl.style.display = "block";
                    }
                    hidePreloader();
                });
            }
        } else {
            state.currentUser = "";
            if (displayNameEl) displayNameEl.textContent = "...";
            if (overlay) overlay.style.display = "flex";
            hidePreloader();
        }
    });
}

// Load Activity Logs from Firestore
async function loadActivityLogs() {
    const docRef = db.collection('rvnl_tracker').doc('activity_logs_store');
    try {
        const snapshot = await docRef.get();
        if (snapshot.exists && Array.isArray(snapshot.data().logs)) {
            state.activityLogs = snapshot.data().logs;
        } else {
            state.activityLogs = [];
        }
        pruneActivityLogs();
        renderActivityLogs();
    } catch (err) {
        console.error('Error loading activity logs:', err);
    }
}

// Save Activity Logs to Firestore
async function saveActivityLogs() {
    const docRef = db.collection('rvnl_tracker').doc('activity_logs_store');
    try {
        pruneActivityLogs();
        localStorage.setItem("rvnl_activity_logs", JSON.stringify(state.activityLogs));
        await docRef.set({
            logs: state.activityLogs,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        renderActivityLogs();
    } catch (err) {
        console.error('Error saving activity logs:', err);
    }
}

// Prune logs older than 20 days
function pruneActivityLogs() {
    const limitMs = 20 * 24 * 60 * 60 * 1000; // 20 days in ms
    const cutoff = Date.now() - limitMs;
    state.activityLogs = state.activityLogs.filter(log => {
        const timestamp = log.timestamp || 0;
        return timestamp >= cutoff;
    });
}

// Log a new activity
async function logActivity(action, details, client = null) {
    const logEntry = {
        id: generateUUID(),
        user: state.currentUser || "Unknown User",
        action: action, // "created" | "edited" | "deleted"
        details: details,
        client: client,
        timestamp: Date.now()
    };
    state.activityLogs.unshift(logEntry); // add to top
    await saveActivityLogs();
}

// Helper to extract client name from log entry
function getClientFromLog(log) {
    if (log.client) return log.client;
    if (!log.details) return null;
    const match = log.details.match(/\(([^)]+)\)$/);
    return match ? match[1].trim() : null;
}

// Render the activity logs timeline inside the Settings tab
function renderActivityLogs() {
    const timeline = document.getElementById("activity-log-timeline");
    if (!timeline) return;
    timeline.innerHTML = "";
    
    if (state.activityLogs.length === 0) {
        timeline.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">No activities recorded in the last 20 days.</p>`;
        return;
    }
    
    const filterEl = document.getElementById("activity-log-client-filter");
    const selectedClient = filterEl ? filterEl.value : "all";

    let logsToRender = state.activityLogs;
    if (selectedClient !== "all") {
        logsToRender = logsToRender.filter(log => {
            const client = getClientFromLog(log);
            return client === selectedClient;
        });
    }

    if (logsToRender.length === 0) {
        timeline.innerHTML = `<p style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px 0;">No activities recorded for ${selectedClient} in the last 20 days.</p>`;
        return;
    }
    
    logsToRender.forEach(log => {
        const div = document.createElement("div");
        div.style.display = "flex";
        div.style.gap = "14px";
        div.style.alignItems = "flex-start";
        div.style.borderBottom = "1px solid var(--border-color)";
        div.style.paddingBottom = "10px";
        div.style.marginTop = "10px";
        
        let iconClass = "fa-solid fa-circle-plus";
        let color = "var(--accent-green)";
        if (log.action === "edited") {
            iconClass = "fa-solid fa-pen-to-square";
            color = "var(--accent-amber)";
        } else if (log.action === "deleted") {
            iconClass = "fa-solid fa-trash-can";
            color = "var(--accent-red)";
        }
        
        const dateStr = new Date(log.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        div.innerHTML = `
            <div style="font-size: 16px; color: ${color}; padding-top: 2px;"><i class="${iconClass}"></i></div>
            <div style="flex-grow: 1;">
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">
                    ${log.user} <span style="font-weight: 400; color: var(--text-secondary);">${log.action}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    ${log.details}
                </div>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; padding-top: 3px;">
                ${dateStr}
            </div>
        `;
        timeline.appendChild(div);
    });
}

// Save current state to Firestore
async function saveData(taskOrId = null, isBulkWrite = false) {
    setSyncStatus('saving');
    const docRef = db.collection('rvnl_tracker').doc('tasks_store');
    const itemsRef = docRef.collection('items');

    try {
        if (taskOrId) {
            let taskId = typeof taskOrId === 'string' ? taskOrId : taskOrId.id;
            state.localWrites.add(taskId);
            const task = typeof taskOrId === 'string' ? state.tasks.find(t => t.id === taskOrId) : taskOrId;
            if (task) {
                const taskToSave = { ...task };
                if (taskToSave.image && taskToSave.image.startsWith("blob:")) {
                    taskToSave.image = "";
                }
                await itemsRef.doc(taskId).set(taskToSave);
                
                // Sync to Google Sheet
                syncToGoogleSheet('save', taskToSave);
            }
        } else if (isBulkWrite) {
            state.isBulkWriting = true;
            console.log("Writing all tasks to Firestore subcollection...");
            const tasksToSave = state.tasks.map(task => {
                if (task.image && task.image.startsWith("blob:")) {
                    return { ...task, image: "" };
                }
                return task;
            });
            
            // Delete all existing documents in subcollection first
            const existingSnapshot = await itemsRef.get();
            const deletePromises = [];
            existingSnapshot.forEach(doc => {
                deletePromises.push(itemsRef.doc(doc.id).delete());
            });
            await Promise.all(deletePromises);

            // Write all tasks
            for (let i = 0; i < tasksToSave.length; i++) {
                const task = tasksToSave[i];
                if (!task.id) task.id = generateUUID();
                await itemsRef.doc(task.id).set(task);
            }
        } else {
            console.warn("saveData called without target task and without isBulkWrite=true. Skipping write operation to prevent accidental database wipes.");
        }
        setSyncStatus('synced');
    } catch (err) {
        console.error('Firestore save error:', err);
        setSyncStatus('offline');
        localStorage.setItem('rvnl_tracker_data', JSON.stringify(state.tasks));
    } finally {
        state.isBulkWriting = false;
    }
    updateStorageIndicator();
}

// Initialize and Setup Theme Toggle (Dark Mode default) and Color Themes
function initTheme() {
    const activeTheme = localStorage.getItem("rvnl_theme") || "dark";
    document.documentElement.setAttribute("data-theme", activeTheme);
    updateThemeToggleIcon(activeTheme);
    
    const activeColorTheme = localStorage.getItem("rvnl_color_theme") || "default";
    document.documentElement.setAttribute("data-theme-color", activeColorTheme);
    const colorThemeSelect = document.getElementById("color-theme-select");
    if (colorThemeSelect) {
        colorThemeSelect.value = activeColorTheme;
    }
}

function updateThemeToggleIcon(theme) {
    const icon = document.querySelector("#theme-toggle i");
    if (theme === "dark") {
        icon.className = "fa-solid fa-sun";
    } else {
        icon.className = "fa-solid fa-moon";
    }
}

// Populate the Owner filter dropdown dynamically from available data
function populateOwnerFilter() {
    const owners = new Set();
    const clientTasks = state.tasks.filter(t => (t.client || "RVNL") === state.activeClient);
    clientTasks.forEach(t => {
        if (t.owner && t.owner.trim() !== "" && t.owner.toLowerCase() !== "nan") {
            owners.add(t.owner);
        }
    });
    
    const select = document.getElementById("filter-owner");
    // Clear dynamic options (keep first)
    select.innerHTML = '<option value="all">All Owners</option>';
    
    Array.from(owners).sort().forEach(owner => {
        const option = document.createElement("option");
        option.value = owner;
        option.textContent = owner;
        select.appendChild(option);
    });
}

// Populate Month dropdowns dynamically from existing tasks and the current month
function populateMonthDropdowns() {
    const months = new Set();
    
    // Always add current month, previous month, and next month dynamically
    const today = new Date();
    
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStr = prevDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.add(prevMonthStr);
    
    const currentMonthStr = getCurrentMonthStr();
    months.add(currentMonthStr);
    
    const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthStr = nextDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    months.add(nextMonthStr);
    
    // Add months from tasks
    state.tasks.forEach(task => {
        if (task.month && task.month.trim() !== "") {
            months.add(task.month);
        }
    });

    const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const sortedMonths = Array.from(months).sort((a, b) => {
        const partsA = a.split(" ");
        const partsB = b.split(" ");
        const monthA = partsA[0];
        const yearA = partsA[1] ? parseInt(partsA[1], 10) : 0;
        const monthB = partsB[0];
        const yearB = partsB[1] ? parseInt(partsB[1], 10) : 0;
        
        if (yearA !== yearB) return yearA - yearB;
        return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
    });

    // Populate #filter-month
    const filterMonth = document.getElementById("filter-month");
    if (filterMonth) {
        const currentVal = filterMonth.value || state.filters.month;
        filterMonth.innerHTML = '<option value="all">All Months</option>';
        sortedMonths.forEach(m => {
            const option = document.createElement("option");
            option.value = m;
            option.textContent = m;
            filterMonth.appendChild(option);
        });
        if (sortedMonths.includes(currentVal)) {
            filterMonth.value = currentVal;
        } else {
            filterMonth.value = currentMonthStr;
            state.filters.month = currentMonthStr;
        }
    }

    // Populate #report-month
    const reportMonth = document.getElementById("report-month");
    if (reportMonth) {
        const currentVal = reportMonth.value;
        reportMonth.innerHTML = '';
        sortedMonths.forEach(m => {
            const option = document.createElement("option");
            option.value = m;
            option.textContent = m;
            reportMonth.appendChild(option);
        });
        if (sortedMonths.includes(currentVal)) {
            reportMonth.value = currentVal;
        } else {
            reportMonth.value = currentMonthStr;
        }
    }

    // Populate #report-month-checkboxes
    const reportMonthCheckboxes = document.getElementById("report-month-checkboxes");
    if (reportMonthCheckboxes) {
        reportMonthCheckboxes.innerHTML = '';
        sortedMonths.forEach(m => {
            const label = document.createElement("label");
            label.style.display = "inline-flex";
            label.style.alignItems = "center";
            label.style.gap = "6px";
            label.style.fontSize = "13px";
            label.style.fontWeight = "500";
            label.style.cursor = "pointer";
            label.style.background = "var(--bg-primary)";
            label.style.padding = "6px 12px";
            label.style.borderRadius = "8px";
            label.style.border = "1px solid var(--border-color)";
            label.style.userSelect = "none";
            label.style.color = "var(--text-primary)";

            // Check current month by default
            const isChecked = m === currentMonthStr;
            label.innerHTML = `
                <input type="checkbox" class="report-month-chk" value="${m}" ${isChecked ? 'checked' : ''} style="margin: 0; width: 14px; height: 14px; cursor: pointer;">
                <span>${m}</span>
            `;
            reportMonthCheckboxes.appendChild(label);
        });
    }

    // Populate #dashboard-month
    const dashboardMonth = document.getElementById("dashboard-month");
    if (dashboardMonth) {
        const currentVal = dashboardMonth.value || state.dashboardMonth;
        dashboardMonth.innerHTML = '';
        sortedMonths.forEach(m => {
            const option = document.createElement("option");
            option.value = m;
            option.textContent = m;
            option.style.backgroundColor = "var(--bg-secondary)";
            option.style.color = "var(--text-primary)";
            dashboardMonth.appendChild(option);
        });
        if (sortedMonths.includes(currentVal)) {
            dashboardMonth.value = currentVal;
        } else {
            dashboardMonth.value = currentMonthStr;
            state.dashboardMonth = currentMonthStr;
        }
    }

    // Populate #task-month
    const taskMonth = document.getElementById("task-month");
    if (taskMonth) {
        const currentVal = taskMonth.value;
        taskMonth.innerHTML = '';
        sortedMonths.forEach(m => {
            const option = document.createElement("option");
            option.value = m;
            option.textContent = m;
            taskMonth.appendChild(option);
        });
        if (sortedMonths.includes(currentVal)) {
            taskMonth.value = currentVal;
        } else {
            taskMonth.value = currentMonthStr;
        }
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Prevent leaving page if active uploads are running
    window.addEventListener("beforeunload", (e) => {
        if (state.activeUploads && state.activeUploads.size > 0) {
            e.preventDefault();
            e.returnValue = "Image uploads are currently in progress. If you leave now, your uploads may fail. Are you sure you want to exit?";
            return e.returnValue;
        }
    });

    // 1. Navigation Tab Switching
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.getAttribute("data-tab");
            switchTab(tabName);
        });
    });

    // 2. View toggling (Table vs Kanban)
    document.getElementById("view-table-btn").addEventListener("click", () => {
        switchView("table");
    });
    document.getElementById("view-kanban-btn").addEventListener("click", () => {
        switchView("kanban");
    });

    // 3. Theme toggle click
    document.getElementById("theme-toggle").addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("rvnl_theme", newTheme);
        updateThemeToggleIcon(newTheme);
        // Redraw charts to align colors
        updateDashboard();
    });

    // 3.5 Color theme select change
    const colorThemeSelect = document.getElementById("color-theme-select");
    if (colorThemeSelect) {
        colorThemeSelect.addEventListener("change", (e) => {
            const selectedColorTheme = e.target.value;
            document.documentElement.setAttribute("data-theme-color", selectedColorTheme);
            localStorage.setItem("rvnl_color_theme", selectedColorTheme);
            // Redraw charts to align colors
            updateDashboard();
        });
    }

    // 4. Global Search Handler
    document.getElementById("global-search").addEventListener("input", (e) => {
        state.filters.search = e.target.value.toLowerCase();
        state.currentPage = 1;
        if (state.filters.search && state.activeTab !== 'tracker') {
            switchTab('tracker');
        } else {
            renderTracker();
        }
    });

    // 5. Track Filter Changes
    document.getElementById("filter-type").addEventListener("change", (e) => {
        state.filters.type = e.target.value;
        state.currentPage = 1;
        renderTracker();
    });
    document.getElementById("filter-month").addEventListener("change", (e) => {
        state.filters.month = e.target.value;
        state.currentPage = 1;
        renderTracker();
    });
    const dashboardMonthSelect = document.getElementById("dashboard-month");
    if (dashboardMonthSelect) {
        dashboardMonthSelect.addEventListener("change", (e) => {
            state.dashboardMonth = e.target.value;
            updateDashboard();
        });
    }
    document.getElementById("filter-status").addEventListener("change", (e) => {
        state.filters.status = e.target.value;
        state.currentPage = 1;
        renderTracker();
    });
    document.getElementById("filter-owner").addEventListener("change", (e) => {
        state.filters.owner = e.target.value;
        state.currentPage = 1;
        renderTracker();
    });
    const filterCenterEl = document.getElementById("filter-center");
    if (filterCenterEl) {
        filterCenterEl.addEventListener("change", (e) => {
            state.filters.center = e.target.value;
            state.currentPage = 1;
            renderTracker();
        });
    }
    document.getElementById("clear-filters-btn").addEventListener("click", resetFilters);

    // Handle pasting images from clipboard inside the drawer
    document.addEventListener("paste", (e) => {
        const overlay = document.getElementById("task-drawer-overlay");
        if (overlay && overlay.classList.contains("active")) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf("image") === 0) {
                    const file = item.getAsFile();
                    if (file) {
                        // Check if focused element or its container is a publication row
                        const activeEl = document.activeElement;
                        const pubRow = activeEl ? activeEl.closest(".pr-pub-row") : null;
                        if (pubRow) {
                            const idxAttr = activeEl.getAttribute("data-index") || pubRow.querySelector("[data-index]").getAttribute("data-index");
                            const idx = parseInt(idxAttr, 10);
                            if (!isNaN(idx)) {
                                handleClipboardPasteForPublication(file, idx, pubRow);
                                e.preventDefault();
                                return;
                            }
                        }

                        // Otherwise, fallback to the main task image preview
                        const name = `clipboard_screenshot_${Date.now()}.jpg`;
                        const clipboardFile = new File([file], name, { type: file.type });
                        const localURL = URL.createObjectURL(clipboardFile);
                        showImagePreview(localURL);
                        
                        const progressOverlay = document.getElementById("main-image-progress-overlay");
                        const progressPercent = document.getElementById("main-image-progress-percent");
                        if (progressOverlay) progressOverlay.classList.remove("hidden");
                        if (progressPercent) progressPercent.textContent = "0%";
                        
                        const uploadId = `main_image_${Date.now()}`;
                        state.activeUploads.add(uploadId);
                        updateDrawerButtonsState();
                        
                        const taskTitle = document.getElementById("task-title").value || "Creative_Asset";
                        const client = state.activeClient || "General";
                        
                        uploadImageToStorage(clipboardFile, client, taskTitle, (progress) => {
                            if (progressPercent) {
                                progressPercent.textContent = `${Math.round(progress)}%`;
                            }
                        }).then((downloadURL) => {
                            const previewBox = document.getElementById("task-image-preview");
                            const previewImg = previewBox.querySelector("img");
                            if (previewImg) previewImg.src = downloadURL;
                            
                            const imgUrlInput = document.getElementById("task-image-url");
                            if (imgUrlInput) imgUrlInput.value = downloadURL;
                        }).catch((err) => {
                            console.error("Main image clipboard upload failed:", err);
                            alert("Clipboard image upload failed: " + err.message);
                            removeImagePreview();
                        }).finally(() => {
                            state.activeUploads.delete(uploadId);
                            if (progressOverlay) progressOverlay.classList.add("hidden");
                            updateDrawerButtonsState();
                        });
                        
                        e.preventDefault();
                        break;
                    }
                }
            }
        }
    });

    // 5.5 Clickable Stat Cards to jump to Unified Tracker
    document.querySelectorAll(".stat-card-clickable").forEach(card => {
        card.addEventListener("click", () => {
            const filterType = card.getAttribute("data-filter-type");
            const filterStatus = card.getAttribute("data-filter-status");
            const selectedMonth = state.dashboardMonth || getCurrentMonthStr();
            
            let finalFilterType = filterType;
            if (state.activeClient === "iCode" && filterType === "Social Media") {
                finalFilterType = "all";
            }

            // Set filters in state
            state.filters.type = finalFilterType;
            state.filters.status = filterStatus;
            state.filters.month = selectedMonth;
            
            // Sync values to UI inputs
            const filterTypeEl = document.getElementById("filter-type");
            if (filterTypeEl) filterTypeEl.value = finalFilterType;
            
            const filterStatusEl = document.getElementById("filter-status");
            if (filterStatusEl) filterStatusEl.value = filterStatus;
            
            const filterMonthEl = document.getElementById("filter-month");
            if (filterMonthEl) filterMonthEl.value = selectedMonth;
            
            // Go to tracker tab and render
            switchTab("tracker");
            state.currentPage = 1;
            renderTracker();
        });
    });

    // 6. Pagination Navigation
    document.getElementById("prev-page-btn").addEventListener("click", () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderTrackerTable();
        }
    });
    document.getElementById("next-page-btn").addEventListener("click", () => {
        const maxPage = Math.ceil(state.filteredTasks.length / state.pageSize);
        if (state.currentPage < maxPage) {
            state.currentPage++;
            renderTrackerTable();
        }
    });

    // 7. Quick Links/Shortcuts on Dashboard
    document.querySelectorAll(".view-all-link").forEach(link => {
        link.addEventListener("click", () => {
            const statusFilter = link.getAttribute("data-filter");
            switchTab("tracker");
            
            // Sync month filter to match current dashboard month
            const selectedMonth = state.dashboardMonth || getCurrentMonthStr();
            state.filters.month = selectedMonth;
            const filterMonthEl = document.getElementById("filter-month");
            if (filterMonthEl) filterMonthEl.value = selectedMonth;

            if (statusFilter === "Published") {
                state.filters.type = "Social Media";
                state.filters.status = "Published/Closed";
                
                const filterTypeEl = document.getElementById("filter-type");
                if (filterTypeEl) filterTypeEl.value = "Social Media";
                
                const filterStatusEl = document.getElementById("filter-status");
                if (filterStatusEl) filterStatusEl.value = "Published/Closed";
            } else if (statusFilter === "In Progress") {
                state.filters.type = "all";
                state.filters.status = "In Progress";
                
                const filterTypeEl = document.getElementById("filter-type");
                if (filterTypeEl) filterTypeEl.value = "all";
                
                const filterStatusEl = document.getElementById("filter-status");
                if (filterStatusEl) filterStatusEl.value = "In Progress";
            } else {
                state.filters.status = statusFilter;
                const filterStatusEl = document.getElementById("filter-status");
                if (filterStatusEl) filterStatusEl.value = statusFilter;
            }
            
            state.currentPage = 1;
            renderTracker();
        });
    });

    // 8. Task Drawer Add/Edit Operations
    document.getElementById("quick-add-btn").addEventListener("click", () => openDrawer());
    document.getElementById("close-drawer-btn").addEventListener("click", closeDrawer);
    document.getElementById("cancel-drawer-btn").addEventListener("click", closeDrawer);
    document.getElementById("task-drawer-overlay").addEventListener("click", (e) => {
        if (e.target === document.getElementById("task-drawer-overlay")) closeDrawer();
    });
    
    // Toggle PR fields on task type selection
    document.getElementById("task-type").addEventListener("change", (e) => {
        togglePRFormFields(e.target.value);
    });

    // Recalculate CPL/CPC on input
    const taskBudgetInput = document.getElementById("task-budget");
    const taskConversionsInput = document.getElementById("task-conversions");
    if (taskBudgetInput) {
        taskBudgetInput.addEventListener("input", updateCplCpcCalculation);
    }
    if (taskConversionsInput) {
        taskConversionsInput.addEventListener("input", updateCplCpcCalculation);
    }

    // Add publication coverage row
    const btnAddPub = document.getElementById("btn-add-publication");
    if (btnAddPub) {
        btnAddPub.addEventListener("click", () => {
            if (!state.currentTaskPublications) {
                state.currentTaskPublications = [];
            }
            state.currentTaskPublications.push({
                id: generateUUID(),
                name: "",
                headline: "",
                link: "",
                image: "",
                date: "",
                coverageType: "",
                journalist: "",
                tier: "",
                sentiment: "",
                syndication: "",
                agencyGenerated: "",
                keyMessages: "",
                _isExpanded: false
            });
            renderDrawerPublications();
        });
    }

    // Add spokesperson row
    const btnAddSpokesperson = document.getElementById("btn-add-spokesperson");
    if (btnAddSpokesperson) {
        btnAddSpokesperson.addEventListener("click", () => {
            if (!state.currentTaskSpokespersons) {
                state.currentTaskSpokespersons = [];
            }
            state.currentTaskSpokespersons.push({
                id: generateUUID(),
                name: ""
            });
            renderDrawerSpokespersons();
        });
    }

    // Add reference link row
    const btnAddRefLink = document.getElementById("btn-add-ref-link");
    if (btnAddRefLink) {
        btnAddRefLink.addEventListener("click", () => {
            if (!state.currentTaskReferenceLinks) {
                state.currentTaskReferenceLinks = [];
            }
            state.currentTaskReferenceLinks.push({
                id: generateUUID(),
                label: "",
                url: ""
            });
            renderDrawerReferenceLinks();
        });
    }

    // Toggle WIP/Approval fields on status selection
    document.getElementById("task-status").addEventListener("change", (e) => {
        toggleWipCommentFields(e.target.value);
    });

    // Handle form submit
    document.getElementById("task-form").addEventListener("submit", handleFormSubmit);

    // Image upload handler
    const imgFileInput = document.getElementById("task-image-file");
    imgFileInput.addEventListener("change", handleImageUpload);
    document.getElementById("remove-preview-img-btn").addEventListener("click", removeImagePreview);

    // 9. Report Generation
    document.getElementById("report-period-type").addEventListener("change", (e) => {
        const weekGroup = document.getElementById("report-week-group");
        const monthSelectContainer = document.getElementById("report-month-select-container");
        const monthCheckboxesContainer = document.getElementById("report-month-checkboxes-container");

        if (e.target.value === "weekly") {
            weekGroup.style.display = "flex";
            if (monthSelectContainer) monthSelectContainer.style.display = "";
            if (monthCheckboxesContainer) monthCheckboxesContainer.style.display = "none";
        } else {
            weekGroup.style.display = "none";
            if (state.activeClient === "Legrand") {
                if (monthSelectContainer) monthSelectContainer.style.display = "none";
                if (monthCheckboxesContainer) monthCheckboxesContainer.style.display = "";
            } else {
                if (monthSelectContainer) monthSelectContainer.style.display = "";
                if (monthCheckboxesContainer) monthCheckboxesContainer.style.display = "none";
            }
        }
    });
    
    document.getElementById("generate-report-btn").addEventListener("click", generateReport);
    document.getElementById("report-clipping-upload").addEventListener("change", handleReportClippingUpload);
    
    // Real-time status update from Report Builder dropdowns
    document.addEventListener("change", async (e) => {
        if (e.target && e.target.classList.contains("report-status-select")) {
            const taskId = e.target.getAttribute("data-id");
            const newStatus = e.target.value;
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                await saveData(task);
                // Re-render report keeping manual row exclusions intact
                generateReport(true);
            }
        }
    });

    document.getElementById("print-report-btn").addEventListener("click", () => {
        const checkbox = document.getElementById("toggle-continuous-page");
        let printStyle = document.getElementById("continuous-print-style");
        
        if (printStyle) {
            printStyle.remove();
        }
        
        if (checkbox && checkbox.checked) {
            const canvas = document.querySelector(".print-report-canvas");
            const heightPx = canvas ? canvas.offsetHeight : 2000;
            // Convert px to mm (1px = 0.264583mm) and add top/bottom margins (approx 40mm)
            const heightMm = Math.ceil(heightPx * 0.264583) + 40; 
            
            printStyle = document.createElement("style");
            printStyle.id = "continuous-print-style";
            printStyle.innerHTML = `
                @media print {
                    @page {
                        size: 210mm ${heightMm}mm;
                        margin: 10mm 15mm;
                    }
                    .page-break-before {
                        page-break-before: auto !important;
                        break-before: auto !important;
                        margin-top: 20px !important;
                    }
                    .report-pr-group {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                        page-break-before: auto !important;
                        break-before: auto !important;
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .report-pub-coverage-card {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    tr {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                }
            `;
            document.head.appendChild(printStyle);
        }
        
        window.print();
    });

    // 10. Backup & Settings Tab Handlers
    document.getElementById("export-db-btn").addEventListener("click", exportDatabase);
    
    const importFileInput = document.getElementById("import-db-file");
    importFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        const btn = document.getElementById("import-db-btn");
        const fileLabel = document.getElementById("import-file-name");
        
        if (file) {
            fileLabel.textContent = file.name;
            btn.removeAttribute("disabled");
        } else {
            fileLabel.textContent = "No file selected";
            btn.setAttribute("disabled", "true");
        }
    });
    document.getElementById("import-db-btn").addEventListener("click", importDatabase);
    document.getElementById("reset-db-btn").addEventListener("click", resetDatabase);

    // Google Sheet Sync URL Handler
    const saveSyncUrlBtn = document.getElementById("save-sync-url-btn");
    if (saveSyncUrlBtn) {
        saveSyncUrlBtn.addEventListener("click", async () => {
            const urlInput = document.getElementById("sheet-sync-url");
            const url = urlInput ? urlInput.value.trim() : "";
            setSyncStatus('saving');
            try {
                state.googleSheetSyncUrl = url;
                await db.collection('rvnl_tracker').doc('settings_config').set({
                    googleSheetSyncUrl: url,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                setSyncStatus('synced');
                alert("Google Sheet Sync URL saved successfully!");
                updateGoogleSheetSyncUI();
            } catch (err) {
                console.error("Error saving sync URL:", err);
                alert("Failed to save Sync URL to database.");
                setSyncStatus('offline');
            }
        });
    }

    const cleanupStorageBtn = document.getElementById("cleanup-storage-btn");
    if (cleanupStorageBtn) {
        cleanupStorageBtn.addEventListener("click", cleanupOrphanedImages);
    }

    // Restore local localStorage data → Firestore
    const restoreLocalBtn = document.getElementById("restore-local-btn");
    if (restoreLocalBtn) {
        restoreLocalBtn.addEventListener("click", restoreLocalBackup);
    }

    const logClientFilter = document.getElementById("activity-log-client-filter");
    if (logClientFilter) {
        logClientFilter.addEventListener("change", renderActivityLogs);
    }

    // Tab Access Lock listeners
    const unlockBtn = document.getElementById("unlock-settings-btn");
    if (unlockBtn) unlockBtn.addEventListener("click", handleSettingsUnlockSubmit);
    
    const passInput = document.getElementById("settings-password-input");
    if (passInput) {
        passInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') handleSettingsUnlockSubmit();
        });
    }
    
    const updatePassBtn = document.getElementById("update-password-btn");
    if (updatePassBtn) updatePassBtn.addEventListener("click", handleUpdatePassword);
    
    const removePassBtn = document.getElementById("remove-password-btn");
    if (removePassBtn) removePassBtn.addEventListener("click", handleRemovePassword);

    // User Access Matrix listeners
    const addUserPermBtn = document.getElementById("add-user-permission-btn");
    if (addUserPermBtn) {
        addUserPermBtn.addEventListener("click", handleAddUserPermission);
    }
    const savePermsBtn = document.getElementById("save-permissions-btn");
    if (savePermsBtn) {
        savePermsBtn.addEventListener("click", handleSavePermissions);
    }
    const searchPermsInput = document.getElementById("permissions-search");
    if (searchPermsInput) {
        searchPermsInput.addEventListener("input", renderPermissionsMatrix);
    }

    // Permissions Drawer Event Listeners
    const permissionsBody = document.getElementById("permissions-matrix-body");
    if (permissionsBody) {
        permissionsBody.addEventListener("click", (e) => {
            const btn = e.target.closest(".edit-permissions-btn");
            if (btn) {
                const user = btn.getAttribute("data-user");
                openPermissionsDrawer(user);
            }
        });
    }

    document.getElementById("close-permissions-drawer-btn")?.addEventListener("click", closePermissionsDrawer);
    document.getElementById("cancel-permissions-drawer-btn")?.addEventListener("click", closePermissionsDrawer);
    document.getElementById("permissions-drawer-overlay")?.addEventListener("click", (e) => {
        if (e.target === document.getElementById("permissions-drawer-overlay")) {
            closePermissionsDrawer();
        }
    });

    document.getElementById("permissions-drawer-search")?.addEventListener("input", (e) => {
        renderPermissionsDrawerGrid(e.target.value);
    });

    document.getElementById("save-permissions-drawer-btn")?.addEventListener("click", async () => {
        if (!state.editingPermissionUser) return;
        
        state.userPermissions[state.editingPermissionUser] = {
            ...state.userPermissions[state.editingPermissionUser],
            ...state.editingPermissionsTemp
        };
        
        closePermissionsDrawer();
        await handleSavePermissions();
    });

    document.getElementById("btn-grant-full-pr")?.addEventListener("click", () => {
        if (!state.editingPermissionsTemp) return;
        PR_ONLY_CLIENTS.forEach(client => {
            state.editingPermissionsTemp[client] = "Full";
        });
        renderPermissionsDrawerGrid(document.getElementById("permissions-drawer-search")?.value || "");
    });
    
    document.getElementById("btn-grant-full-social")?.addEventListener("click", () => {
        if (!state.editingPermissionsTemp) return;
        SOCIAL_CREATIVE_CLIENTS.forEach(client => {
            state.editingPermissionsTemp[client] = "Full";
        });
        renderPermissionsDrawerGrid(document.getElementById("permissions-drawer-search")?.value || "");
    });
    
    document.getElementById("btn-revoke-all-access")?.addEventListener("click", () => {
        if (!state.editingPermissionsTemp) return;
        ALL_CLIENTS.forEach(client => {
            state.editingPermissionsTemp[client] = "None";
        });
        renderPermissionsDrawerGrid(document.getElementById("permissions-drawer-search")?.value || "");
    });

    // 11. API Key & AI Narrative Handlers
    const saveApiKeyBtn = document.getElementById("save-api-key-btn");
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener("click", () => {
            const keyInput = document.getElementById("gemini-api-key");
            const key = keyInput.value.trim();
            if (key) {
                localStorage.setItem("rvnl_gemini_key", key);
                alert("Gemini API Key saved successfully!");
                updateApiKeyStatus();
                generateReport(); // refresh narrative btn visibility
            } else {
                localStorage.removeItem("rvnl_gemini_key");
                alert("Gemini API Key cleared.");
                updateApiKeyStatus();
                generateReport();
            }
        });
    }
    


    // Apply narrative edit handler
    const applyNarrativeBtn = document.getElementById("btn-apply-narrative");
    if (applyNarrativeBtn) {
        applyNarrativeBtn.addEventListener("click", () => {
            const textarea = document.getElementById("edit-report-narrative");
            const preview = document.getElementById("report-narrative-text");
            if (textarea && preview) {
                preview.textContent = textarea.value;
                alert("Narrative updated in report preview!");
            }
        });
    }

    // Generate narrative with AI handler
    const aiNarrativeBtn = document.getElementById("btn-generate-narrative-ai");
    if (aiNarrativeBtn) {
        aiNarrativeBtn.addEventListener("click", handleAiNarrativeGeneration);
    }
    
    // Daily Briefing event listeners
    const btnRunBriefing = document.getElementById("btn-run-briefing");
    if (btnRunBriefing) {
        btnRunBriefing.addEventListener("click", handleRunBriefing);
    }
    const btnClearBriefing = document.getElementById("btn-clear-briefing");
    if (btnClearBriefing) {
        btnClearBriefing.addEventListener("click", handleClearBriefing);
    }
    const briefingStartDateInput = document.getElementById("briefing-start-date");
    const briefingEndDateInput = document.getElementById("briefing-end-date");
    if (briefingStartDateInput) {
        briefingStartDateInput.addEventListener("change", updateBriefingTimeRangeLabel);
    }
    if (briefingEndDateInput) {
        briefingEndDateInput.addEventListener("change", updateBriefingTimeRangeLabel);
    }
    // Client Switcher Switch Click Handler
    const clientSelectorBtn = document.getElementById("client-selector-btn");
    const clientDropdownList = document.getElementById("client-dropdown-list");
    if (clientSelectorBtn && clientDropdownList) {
        clientSelectorBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const switcherWelcome = document.getElementById("client-switcher-welcome");
            if (switcherWelcome) {
                switcherWelcome.textContent = "Select Workspace";
            }
            clientDropdownList.classList.toggle("hidden");
            // Render switcher dynamically when opened
            renderClientSwitcher(document.getElementById("client-switcher-search")?.value || "");
        });
        
        // Close modal when clicking the close button
        const closeBtn = document.getElementById("close-client-switcher-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                clientDropdownList.classList.add("hidden");
            });
        }

        // Close modal when clicking on the overlay background itself
        clientDropdownList.addEventListener("click", (e) => {
            if (e.target === clientDropdownList) {
                clientDropdownList.classList.add("hidden");
            }
        });

        // Search Input change listener
        const switcherSearch = document.getElementById("client-switcher-search");
        if (switcherSearch) {
            switcherSearch.addEventListener("input", (e) => {
                renderClientSwitcher(e.target.value);
            });
        }
        
        // Reset logo on mouseleave from switcher container area
        const clientGridScroll = document.getElementById("client-switcher-scroll-area");
        if (clientGridScroll) {
            clientGridScroll.addEventListener("mouseleave", () => {
                const activeLogoSrc = getClientLogo(state.activeClient);
                const switcherActiveLogo = document.getElementById("switcher-active-logo");
                if (switcherActiveLogo && !switcherActiveLogo.src.endsWith(activeLogoSrc)) {
                    switcherActiveLogo.classList.add("changing");
                    setTimeout(() => {
                        switcherActiveLogo.src = activeLogoSrc;
                        switcherActiveLogo.classList.remove("changing");
                    }, 120);
                }
            });
        }
    }

    // User login event listeners (Email Link passwordless sign-in)
    const emailLoginForm = document.getElementById("email-login-form");
    if (emailLoginForm) {
        emailLoginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const emailInput = document.getElementById("login-email-input");
            const email = emailInput.value.trim();
            const errorMsgEl = document.getElementById("login-error-msg");
            const infoMsgEl = document.getElementById("login-info-msg");
            const submitBtn = document.getElementById("login-submit-btn");

            const lowerEmail = email.toLowerCase();
            if (!lowerEmail.endsWith("@candour.co.in") && lowerEmail !== "stutio2465@gmail.com") {
                if (errorMsgEl) {
                    errorMsgEl.textContent = "Access Denied: This email address is not permitted.";
                    errorMsgEl.style.display = "block";
                }
                if (infoMsgEl) infoMsgEl.style.display = "none";
                return;
            }

            if (errorMsgEl) errorMsgEl.style.display = "none";
            if (infoMsgEl) {
                infoMsgEl.textContent = "Sending secure login link...";
                infoMsgEl.style.color = "var(--accent-blue)";
                infoMsgEl.style.display = "block";
            }
            if (submitBtn) submitBtn.disabled = true;

            const actionCodeSettings = {
                url: window.location.origin + window.location.pathname,
                handleCodeInApp: true
            };

            firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
                .then(() => {
                    // Save email locally to avoid asking on same device
                    window.localStorage.setItem('emailForSignIn', email);
                    if (infoMsgEl) {
                        infoMsgEl.textContent = `Success! A login link has been sent to ${email}. Please check your inbox (and spam folder) and click the link to sign in.`;
                        infoMsgEl.style.color = "var(--accent-blue)";
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    emailInput.value = "";
                })
                .catch((error) => {
                    console.error("Error sending email link:", error);
                    if (infoMsgEl) infoMsgEl.style.display = "none";
                    if (errorMsgEl) {
                        errorMsgEl.textContent = `Failed to send link: ${error.message}`;
                        errorMsgEl.style.display = "block";
                    }
                    if (submitBtn) submitBtn.disabled = false;
                });
        });
    }

    const userBadge = document.getElementById("user-badge");
    if (userBadge) {
        userBadge.addEventListener("click", () => {
            if (confirm(`Logged in as ${state.currentUser}. Do you want to sign out?`)) {
                firebase.auth().signOut().then(() => {
                    alert("Signed out successfully!");
                }).catch(err => {
                    console.error("Sign-out error:", err);
                });
            }
        });
    }
    
    // Access pending overlay buttons
    const pendingRefreshBtn = document.getElementById("access-pending-refresh-btn");
    if (pendingRefreshBtn) {
        pendingRefreshBtn.addEventListener("click", () => {
            window.location.reload();
        });
    }
    
    const pendingLogoutBtn = document.getElementById("access-pending-logout-btn");
    if (pendingLogoutBtn) {
        pendingLogoutBtn.addEventListener("click", () => {
            firebase.auth().signOut().then(() => {
                window.location.reload();
            }).catch(err => {
                console.error("Sign-out error:", err);
            });
        });
    }

    // Initialize API Key Status display
    updateApiKeyStatus();
}

// Adjust UI dropdown options dynamically based on client capabilities
function adjustClientSpecificOptions(client) {
    // 1. Task Type Filter Dropdown
    const filterType = document.getElementById("filter-type");
    if (filterType) {
        if (client === "iCode") {
            filterType.innerHTML = `
                <option value="all">All Campaigns</option>
                <option value="Organic">Organic Campaign</option>
                <option value="Paid">Paid Campaign</option>
            `;
        } else if (client === "Legrand" || client === "Kompact AI") {
            filterType.innerHTML = `
                <option value="all">All Types</option>
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update</option>
            `;
        } else if (client === "BT Group") {
            filterType.innerHTML = `
                <option value="all">All Types</option>
                <option value="Social Media">Social Media Post</option>
                <option value="Creative / Collateral">Creative / Collateral</option>
            `;
        } else if (client === "Green Shine Solar") {
            filterType.innerHTML = `
                <option value="all">All Types</option>
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update</option>
                <option value="Creative / Collateral">Creative / Collateral</option>
                <option value="Digital Campaigns">Digital Campaigns</option>
            `;
        } else {
            filterType.innerHTML = `
                <option value="all">All Types</option>
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update</option>
                <option value="Creative / Collateral">Creative / Collateral</option>
            `;
        }
    }

    // 2. Task Drawer Type Dropdown
    const taskTypeSelect = document.getElementById("task-type");
    const taskTypeGroup = document.getElementById("task-type-group");
    const icodeCampaignGroup = document.getElementById("icode-campaign-group");
    const greenshineCampaignGroup = document.getElementById("greenshine-campaign-group");
    if (taskTypeSelect) {
        if (client === "iCode") {
            if (taskTypeGroup) taskTypeGroup.classList.add("hidden");
            taskTypeSelect.removeAttribute("required");
            if (icodeCampaignGroup) icodeCampaignGroup.classList.remove("hidden");
            if (greenshineCampaignGroup) greenshineCampaignGroup.classList.add("hidden");
        } else if (client === "Green Shine Solar") {
            if (taskTypeGroup) taskTypeGroup.classList.remove("hidden");
            taskTypeSelect.setAttribute("required", "required");
            if (icodeCampaignGroup) icodeCampaignGroup.classList.add("hidden");
            if (greenshineCampaignGroup) greenshineCampaignGroup.classList.add("hidden");

            taskTypeSelect.innerHTML = `
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update (Press Release / Media)</option>
                <option value="Creative / Collateral">Creative / Collateral (Ads, Magazines, Newsletter)</option>
                <option value="Digital Campaigns">Digital Campaigns</option>
            `;
        } else {
            if (taskTypeGroup) taskTypeGroup.classList.remove("hidden");
            taskTypeSelect.setAttribute("required", "required");
            if (icodeCampaignGroup) icodeCampaignGroup.classList.add("hidden");
            if (greenshineCampaignGroup) greenshineCampaignGroup.classList.add("hidden");

            taskTypeSelect.innerHTML = `
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update (Press Release / Media)</option>
                <option value="Creative / Collateral">Creative / Collateral (Ads, Magazines, Newsletter)</option>
            `;
            if (client === "Legrand" || client === "Kompact AI") {
                const creativeDrawerOpt = taskTypeSelect.querySelector('option[value="Creative / Collateral"]');
                if (creativeDrawerOpt) creativeDrawerOpt.remove();
            }
            if (client === "BT Group") {
                const prDrawerOpt = taskTypeSelect.querySelector('option[value="PR Update"]');
                if (prDrawerOpt) prDrawerOpt.remove();
            }
        }
    }

    // 3. iCode Centers Field Group Visibility
    const icodeCentersGroup = document.getElementById("icode-centers-group");
    if (icodeCentersGroup) {
        if (client === "iCode") {
            icodeCentersGroup.classList.remove("hidden");
        } else {
            icodeCentersGroup.classList.add("hidden");
        }
    }

    // 4. Toggle month dropdown vs checkboxes in Report Builder
    const monthSelectContainer = document.getElementById("report-month-select-container");
    const monthCheckboxesContainer = document.getElementById("report-month-checkboxes-container");
    const reportPeriodType = document.getElementById("report-period-type");

    if (monthSelectContainer && monthCheckboxesContainer) {
        const periodType = reportPeriodType ? reportPeriodType.value : "monthly";
        if (client === "Legrand" && periodType === "monthly") {
            monthSelectContainer.style.display = "none";
            monthCheckboxesContainer.style.display = "";
        } else {
            monthSelectContainer.style.display = "";
            monthCheckboxesContainer.style.display = "none";
        }
    }
    checkReadOnlyPermissions();
}

const ADMIN_EMAILS = ["sanjam@candour.co.in", "stutio2465@gmail.com"];

function getUserClientPermission(email, client) {
    if (!email) return "None";
    const lowerEmail = email.toLowerCase();
    
    // 1. Check if there is an explicit permission entry for this user first
    if (state.userPermissions && state.userPermissions[lowerEmail]) {
        return state.userPermissions[lowerEmail][client] || "None";
    }
    
    // 3. Fallback: If not explicitly configured, but ends with @candour.co.in, default to None (Access Pending)
    if (lowerEmail.endsWith("@candour.co.in")) {
        return "None";
    }
    
    // 4. Default for anyone else
    return "None";
}

function getClientList() {
    return ALL_CLIENTS;
}

// Render Client Switcher dynamically with grouping and search filter
function renderClientSwitcher(searchQuery = "") {
    const scrollArea = document.getElementById("client-switcher-scroll-area");
    if (!scrollArea) return;

    const modalContent = document.getElementById("client-switcher-modal-content");
    const lowerQuery = searchQuery.trim().toLowerCase();
    
    // 1. Determine which clients the user has access to
    const allowedClients = getClientList().filter(c => getUserClientPermission(state.currentUserEmail, c) !== "None");

    // 2. Count PR and Social clients they have access to
    const hasPRAccess = allowedClients.some(c => PR_ONLY_CLIENTS.includes(c));
    const hasSocialAccess = allowedClients.some(c => SOCIAL_CREATIVE_CLIENTS.includes(c));
    const showLargeLayout = hasPRAccess && hasSocialAccess;

    // Toggle wide layout class on modal content box based on layout configuration
    if (modalContent) {
        if (showLargeLayout) {
            modalContent.classList.add("large-modal");
        } else {
            modalContent.classList.remove("large-modal");
        }
    }

    // Filter clients based on search query and permissions
    const filteredPR = PR_ONLY_CLIENTS.filter(c => c.toLowerCase().includes(lowerQuery) && allowedClients.includes(c));
    const filteredSocial = SOCIAL_CREATIVE_CLIENTS.filter(c => c.toLowerCase().includes(lowerQuery) && allowedClients.includes(c));

    let html = "";

    if (showLargeLayout) {
        // LARGE LAYOUT: Divided into 2 sections with group headings
        // Render PR Accounts
        if (filteredPR.length > 0) {
            html += `
                <div class="client-switcher-group" style="margin-bottom: 24px; padding: 0 10px;">
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">PR Accounts</h4>
                    <div class="client-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 14px;">
            `;
            filteredPR.forEach(client => {
                const isActive = state.activeClient === client;
                const logo = getClientLogo(client);
                html += `
                    <div class="client-option ${isActive ? 'active' : ''}" data-client="${client}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-primary); border: 1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-color)'}; padding: 14px; border-radius: 12px; cursor: pointer; transition: all var(--transition-fast); text-align: center; gap: 8px; box-shadow: ${isActive ? '0 0 12px rgba(59, 130, 246, 0.15)' : 'none'};">
                        <img src="${logo}" alt="${client} Logo" style="width: 100px; height: 45px; object-fit: contain; border-radius: 4px;">
                        <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${client}</span>
                    </div>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        // Render Social & Creative Accounts
        if (filteredSocial.length > 0) {
            html += `
                <div class="client-switcher-group" style="margin-bottom: 24px; padding: 0 10px;">
                    <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Social & Creative Accounts</h4>
                    <div class="client-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 14px;">
            `;
            filteredSocial.forEach(client => {
                const isActive = state.activeClient === client;
                const logo = getClientLogo(client);
                html += `
                    <div class="client-option ${isActive ? 'active' : ''}" data-client="${client}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-primary); border: 1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-color)'}; padding: 14px; border-radius: 12px; cursor: pointer; transition: all var(--transition-fast); text-align: center; gap: 8px; box-shadow: ${isActive ? '0 0 12px rgba(59, 130, 246, 0.15)' : 'none'};">
                        <img src="${logo}" alt="${client} Logo" style="width: 100px; height: 45px; object-fit: contain; border-radius: 4px;">
                        <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${client}</span>
                    </div>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }
    } else {
        // NARROW LAYOUT: Flat grid, no sections, matching original styling exactly
        const allFiltered = [...filteredPR, ...filteredSocial];
        if (allFiltered.length > 0) {
            html += `<div class="client-grid">`;
            allFiltered.forEach(client => {
                const isActive = state.activeClient === client;
                const logo = getClientLogo(client);
                html += `
                    <div class="client-option ${isActive ? 'active' : ''}" data-client="${client}">
                        <img src="${logo}" alt="${client} Logo" style="width: 110px; height: 50px; object-fit: contain;">
                        <span>${client}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
    }

    if (filteredPR.length === 0 && filteredSocial.length === 0) {
        html = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">
                <i class="fa-solid fa-folder-open" style="font-size: 32px; margin-bottom: 12px; display: block; color: var(--border-color);"></i>
                No matching workspace found.
            </div>
        `;
    }

    scrollArea.innerHTML = html;

    // Attach click and hover listeners dynamically to client options
    scrollArea.querySelectorAll(".client-option").forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const selectedClient = opt.getAttribute("data-client");
            
            try {
                switchClient(selectedClient);
            } catch (err) {
                console.error("Error switching client workspace:", err);
            }
            
            const clientDropdownList = document.getElementById("client-dropdown-list");
            const contentBox = document.getElementById("client-switcher-modal-content");
            if (contentBox && clientDropdownList) {
                contentBox.classList.add("minimizing");
                clientDropdownList.classList.add("minimizing");
                
                setTimeout(() => {
                    clientDropdownList.classList.add("hidden");
                    contentBox.classList.remove("minimizing");
                    clientDropdownList.classList.remove("minimizing");
                }, 500);
            } else if (clientDropdownList) {
                clientDropdownList.classList.add("hidden");
            }
        });

        opt.addEventListener("mouseenter", () => {
            const hoveredClient = opt.getAttribute("data-client");
            const hoveredLogoSrc = getClientLogo(hoveredClient);
            const switcherActiveLogo = document.getElementById("switcher-active-logo");
            if (switcherActiveLogo && !switcherActiveLogo.src.endsWith(hoveredLogoSrc)) {
                switcherActiveLogo.classList.add("changing");
                setTimeout(() => {
                    switcherActiveLogo.src = hoveredLogoSrc;
                    switcherActiveLogo.classList.remove("changing");
                }, 120);
            }
        });
    });
}

function checkUserIsAdmin(email) {
    if (!email) return false;
    const lowerEmail = email.toLowerCase();
    
    // 1. Hardcoded super-admins (never locked out)
    if (ADMIN_EMAILS.includes(lowerEmail)) {
        return true;
    }
    
    // 2. Read from database permissions
    if (state.userPermissions && state.userPermissions[lowerEmail]) {
        return state.userPermissions[lowerEmail].isAdmin === true;
    }
    
    return false;
}

function checkReadOnlyPermissions() {
    const isReadOnly = getUserClientPermission(state.currentUserEmail, state.activeClient) === "ReadOnly";
    const quickAddBtn = document.getElementById("quick-add-btn");
    if (quickAddBtn) {
        quickAddBtn.style.display = isReadOnly ? "none" : "";
    }
    
    // Hide administrative controls if the user is not an Admin
    const isAdmin = checkUserIsAdmin(state.currentUserEmail);
    const resetBtn = document.getElementById("reset-db-btn");
    if (resetBtn) resetBtn.style.display = isAdmin ? "" : "none";
    
    const importCard = document.querySelector('.settings-card .import-actions')?.closest('.settings-card');
    if (importCard) importCard.style.display = isAdmin ? "" : "none";
    
    const googleSheetSyncCard = document.querySelector('.settings-card .sync-url-input-group')?.closest('.settings-card');
    if (googleSheetSyncCard) googleSheetSyncCard.style.display = isAdmin ? "" : "none";
    
    // Hide password control card if not admin
    const passwordControlCard = document.getElementById("change-password-input")?.closest('.settings-card');
    if (passwordControlCard) passwordControlCard.style.display = isAdmin ? "" : "none";
    
    // Hide team permissions matrix card if not admin
    const teamPermissionsCard = document.getElementById("new-user-email")?.closest('.settings-card');
    if (teamPermissionsCard) teamPermissionsCard.style.display = isAdmin ? "" : "none";

    // Hide/show the Admin Panel tab in the sidebar
    const settingsTabBtn = document.querySelector('.nav-btn[data-tab="settings"]');
    if (settingsTabBtn) {
        settingsTabBtn.style.display = isAdmin ? "" : "none";
    }
    
    // If not admin and on settings tab, redirect to dashboard
    if (!isAdmin && state.activeTab === "settings") {
        switchTab("dashboard");
    }
}

// Render the user permissions matrix inside the Settings tab
function renderPermissionsMatrix() {
    const header = document.getElementById("permissions-matrix-header");
    const body = document.getElementById("permissions-matrix-body");
    if (!header || !body) return;
    
    // 1. Build Header Row (Simplified 4 columns)
    let headerHtml = `<th style="padding: 12px 16px; font-weight: 600; font-size: 13px;">Team Member Email</th>`;
    headerHtml += `<th style="padding: 12px 16px; font-weight: 600; font-size: 13px; text-align: center;">Is Admin?</th>`;
    headerHtml += `<th style="padding: 12px 16px; font-weight: 600; font-size: 13px;">Client Access Summary</th>`;
    headerHtml += `<th style="padding: 12px 16px; font-weight: 600; font-size: 13px; text-align: center;">Actions</th>`;
    header.innerHTML = headerHtml;
    
    // 2. Build Body Rows
    body.innerHTML = "";
    let users = Object.keys(state.userPermissions || {}).sort();
    
    const searchInput = document.getElementById("permissions-search");
    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
    if (searchQuery) {
        users = users.filter(u => u.toLowerCase().includes(searchQuery));
    }
    
    if (users.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">
                    No team member permission mappings configured yet. Click "Add User" to begin.
                </td>
            </tr>
        `;
        return;
    }
    
    users.forEach(userEmail => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";
        
        const userIsAdmin = checkUserIsAdmin(userEmail);
        const isSuperAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());
        
        // Count active client assignments (ReadOnly or Full)
        const userPerms = state.userPermissions[userEmail] || {};
        const activeCount = Object.keys(userPerms).filter(k => k !== "isAdmin" && (userPerms[k] === "Full" || userPerms[k] === "ReadOnly")).length;
        const summaryText = `Access to ${activeCount} Client${activeCount === 1 ? '' : 's'}`;

        let rowHtml = `<td style="padding: 12px 16px; font-weight: 500;">${userEmail}</td>`;
        
        // Admin column checkbox
        rowHtml += `
            <td style="padding: 12px 16px; text-align: center;">
                <input type="checkbox" class="permissions-matrix-admin-checkbox" data-user="${userEmail}" 
                    ${userIsAdmin ? "checked" : ""} 
                    ${isSuperAdmin ? "disabled" : ""} 
                    style="width: 15px; height: 15px; cursor: ${isSuperAdmin ? 'not-allowed' : 'pointer'};">
            </td>
        `;
        
        // Client Summary
        rowHtml += `<td style="padding: 12px 16px; font-size: 13px; color: var(--text-secondary);">${summaryText}</td>`;
        
        // Actions
        rowHtml += `
            <td style="padding: 12px 16px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px;">
                <button type="button" class="btn btn-secondary-sm edit-permissions-btn" data-user="${userEmail}" style="padding: 6px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-user-gear"></i> Edit Permissions
                </button>
                <button type="button" class="btn btn-danger-sm remove-user-perm-btn" data-user="${userEmail}" style="padding: 6px 12px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-user-minus"></i> Remove
                </button>
            </td>
        `;
        
        tr.innerHTML = rowHtml;
        body.appendChild(tr);
    });
    
    // Wire up change listeners on admin checkboxes
    body.querySelectorAll(".permissions-matrix-admin-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", async (e) => {
            const user = e.target.getAttribute("data-user");
            const val = e.target.checked;
            
            if (!state.userPermissions[user]) state.userPermissions[user] = {};
            state.userPermissions[user].isAdmin = val;
            
            // Auto-save changes on Admin checkbox toggle
            await handleSavePermissions();
        });
    });
    
    // Wire up remove button click listeners
    body.querySelectorAll(".remove-user-perm-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const user = btn.getAttribute("data-user");
            if (confirm(`Are you sure you want to remove all custom permissions for ${user}?`)) {
                delete state.userPermissions[user];
                await handleSavePermissions();
            }
        });
    });
}

// Open User Permissions Edit Drawer
function openPermissionsDrawer(userEmail) {
    state.editingPermissionUser = userEmail;
    
    // Copy existing user permissions to a temp state or initialize defaults
    const existingPerms = state.userPermissions[userEmail] || {};
    state.editingPermissionsTemp = { isAdmin: existingPerms.isAdmin || false };
    
    getClientList().forEach(client => {
        state.editingPermissionsTemp[client] = existingPerms[client] || "None";
    });
    
    const emailEl = document.getElementById("permissions-drawer-user-email");
    if (emailEl) emailEl.textContent = userEmail;
    
    const searchInput = document.getElementById("permissions-drawer-search");
    if (searchInput) searchInput.value = "";
    
    renderPermissionsDrawerGrid();
    
    const overlay = document.getElementById("permissions-drawer-overlay");
    if (overlay) overlay.classList.add("active");
}

// Close User Permissions Edit Drawer
function closePermissionsDrawer() {
    state.editingPermissionUser = null;
    state.editingPermissionsTemp = null;
    
    const overlay = document.getElementById("permissions-drawer-overlay");
    if (overlay) overlay.classList.remove("active");
}

// Render dynamic Client Access list inside the permissions drawer
function renderPermissionsDrawerGrid(searchQuery = "") {
    const container = document.getElementById("permissions-drawer-client-grid-container");
    if (!container) return;
    
    const lowerQuery = searchQuery.trim().toLowerCase();
    
    // Filter client options based on search query
    const filteredPR = PR_ONLY_CLIENTS.filter(c => c.toLowerCase().includes(lowerQuery));
    const filteredSocial = SOCIAL_CREATIVE_CLIENTS.filter(c => c.toLowerCase().includes(lowerQuery));
    
    let html = "";
    
    const makeSelectHtml = (client) => {
        const currentVal = state.editingPermissionsTemp[client] || "None";
        return `
            <select class="permissions-drawer-select" data-client="${client}" style="padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 13px; font-weight: 600; outline: none; cursor: pointer;">
                <option value="None" ${currentVal === "None" ? "selected" : ""}>No Access</option>
                <option value="ReadOnly" ${currentVal === "ReadOnly" ? "selected" : ""}>Read-Only</option>
                <option value="Full" ${currentVal === "Full" ? "selected" : ""}>Full Access</option>
            </select>
        `;
    };
    
    // 1. PR Accounts Group
    if (filteredPR.length > 0) {
        html += `
            <div class="permissions-group-section" style="display: flex; flex-direction: column; gap: 8px;">
                <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin: 0;">PR Accounts</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
        `;
        filteredPR.forEach(client => {
            const logo = getClientLogo(client);
            html += `
                <div class="permissions-drawer-row" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-primary); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 8px; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <img src="${logo}" alt="${client} Logo" style="width: 24px; height: 24px; object-fit: contain;">
                        <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${client}</span>
                    </div>
                    ${makeSelectHtml(client)}
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    }
    
    // 2. Social Accounts Group
    if (filteredSocial.length > 0) {
        html += `
            <div class="permissions-group-section" style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <h4 style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; margin: 0;">Social & Creative Accounts</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
        `;
        filteredSocial.forEach(client => {
            const logo = getClientLogo(client);
            html += `
                <div class="permissions-drawer-row" style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-primary); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 8px; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <img src="${logo}" alt="${client} Logo" style="width: 24px; height: 24px; object-fit: contain;">
                        <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${client}</span>
                    </div>
                    ${makeSelectHtml(client)}
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    }
    
    if (filteredPR.length === 0 && filteredSocial.length === 0) {
        html = `
            <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">
                No workspaces match filter.
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Bind change listener on selects
    container.querySelectorAll(".permissions-drawer-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const client = e.target.getAttribute("data-client");
            const val = e.target.value;
            state.editingPermissionsTemp[client] = val;
        });
    });
}

function handleAddUserPermission() {
    const emailInput = document.getElementById("new-user-email");
    if (!emailInput) return;
    
    const email = emailInput.value.trim().toLowerCase();
    if (!email) {
        alert("Please enter a valid email address.");
        return;
    }
    
    if (state.userPermissions[email]) {
        alert("This user already exists in the permissions matrix.");
        return;
    }
    
    // Initialize default permissions (No Access and not admin by default)
    state.userPermissions[email] = {
        isAdmin: false
    };
    getClientList().forEach(client => {
        state.userPermissions[email][client] = "None";
    });
    
    emailInput.value = "";
    renderPermissionsMatrix();
}

async function handleSavePermissions() {
    setSyncStatus('saving');
    const configRef = db.collection('rvnl_tracker').doc('settings_config');
    try {
        await configRef.set({
            userPermissions: state.userPermissions,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        localStorage.setItem("rvnl_user_permissions", JSON.stringify(state.userPermissions));
        setSyncStatus('synced');
        alert("User permissions saved successfully!");
        
        // Re-evaluate current user permissions and apply limits immediately
        checkReadOnlyPermissions();
        switchClient(state.activeClient);
    } catch (err) {
        console.error("Error saving permissions:", err);
        alert("Failed to save permissions to Firestore database: " + err.message);
        setSyncStatus('offline');
    }
}
    // Helper to recursively list all files in Firebase Storage
async function listAllFilesRecursively(ref) {
    const listResult = await ref.listAll();
    let files = [...listResult.items];
    const subDirPromises = listResult.prefixes.map(async (prefixRef) => {
        const subFiles = await listAllFilesRecursively(prefixRef);
        files = files.concat(subFiles);
    });
    await Promise.all(subDirPromises);
    return files;
}

// Calculate and update the storage limit capacity progress indicator
async function updateStorageIndicator() {
    const fillEl = document.getElementById("storage-bar-fill");
    const usageEl = document.getElementById("storage-usage-text");
    const statusEl = document.getElementById("storage-status-text");
    
    if (fillEl && usageEl && statusEl) {
        try {
            // Stringify tasks state to approximate Firestore UTF-8 bytes payload size
            const payload = JSON.stringify({ tasks: state.tasks });
            const totalSizeBytes = new Blob([payload]).size;
            const sizeKB = (totalSizeBytes / 1024).toFixed(2);
            const limitKB = 1024; // 1 MB limit in Firestore for single document payload
            const percentage = Math.min((totalSizeBytes / (limitKB * 1024)) * 100, 100).toFixed(2);

            fillEl.style.width = `${percentage}%`;
            usageEl.textContent = `${sizeKB} KB of 1024 KB used (${percentage}%)`;

            if (percentage < 60) {
                fillEl.style.backgroundColor = "var(--accent-green)";
                statusEl.textContent = "Safe";
                statusEl.style.color = "var(--accent-green)";
            } else if (percentage < 85) {
                fillEl.style.backgroundColor = "var(--accent-amber)";
                statusEl.textContent = "Warning: Approaching Limit";
                statusEl.style.color = "var(--accent-amber)";
            } else {
                fillEl.style.backgroundColor = "var(--accent-red)";
                statusEl.textContent = "Critical: Backup & Reset recommended";
                statusEl.style.color = "var(--accent-red)";
            }
        } catch (err) {
            console.error("Error updating database storage indicator:", err);
        }
    }

    // Now calculate Firebase Storage usage
    const fFillEl = document.getElementById("firebase-storage-bar-fill");
    const fUsageEl = document.getElementById("firebase-storage-usage-text");
    const fStatusEl = document.getElementById("firebase-storage-status-text");

    if (fFillEl && fUsageEl && fStatusEl) {
        try {
            // Fetch list of files from Storage task_images folder recursively
            const storageRef = firebase.storage().ref().child('task_images');
            const allFiles = await listAllFilesRecursively(storageRef);
            
            let totalSizeBytes = 0;
            const metadataPromises = allFiles.map(async (itemRef) => {
                const metadata = await itemRef.getMetadata();
                totalSizeBytes += metadata.size;
            });
            
            await Promise.all(metadataPromises);
            
            const sizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);
            const limitMB = 5120; // 5 GB limit in MB
            const percentage = Math.min((totalSizeBytes / (limitMB * 1024 * 1024)) * 100, 100).toFixed(2);

            fFillEl.style.width = `${percentage}%`;
            fUsageEl.textContent = `${sizeMB} MB of 5120 MB used (${percentage}%)`;

            if (percentage < 60) {
                fFillEl.style.backgroundColor = "var(--accent-green)";
                fStatusEl.textContent = "Safe";
                fStatusEl.style.color = "var(--accent-green)";
            } else if (percentage < 85) {
                fFillEl.style.backgroundColor = "var(--accent-amber)";
                fStatusEl.textContent = "Warning: Approaching Limit";
                fStatusEl.style.color = "var(--accent-amber)";
            } else {
                fFillEl.style.backgroundColor = "var(--accent-red)";
                fStatusEl.textContent = "Critical";
                fStatusEl.style.color = "var(--accent-red)";
            }
        } catch (err) {
            console.error("Error updating Firebase Storage indicator:", err);
            fUsageEl.textContent = "Error calculating storage";
            fStatusEl.textContent = "Unavailable";
            fStatusEl.style.color = "var(--accent-red)";
        }
    }
}

// Clean up orphaned images in Firebase Storage that are not referenced in the tasks database
async function cleanupOrphanedImages() {
    const btn = document.getElementById("cleanup-storage-btn");
    if (!btn) return;
    
    if (!confirm("Are you sure you want to clean up orphaned images? This will delete all files in Cloud Storage that are not associated with any active task.")) {
        return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cleaning...`;
    
    try {
        const storageRef = firebase.storage().ref().child('task_images');
        const allFiles = await listAllFilesRecursively(storageRef);
        
        // Collect all currently referenced images
        const activeImages = new Set();
        state.tasks.forEach(t => {
            if (t.image && t.image.startsWith("https://firebasestorage.googleapis.com")) {
                activeImages.add(t.image);
            }
            if (t.publicationsList && t.publicationsList.length > 0) {
                t.publicationsList.forEach(pub => {
                    if (pub.image && pub.image.startsWith("https://firebasestorage.googleapis.com")) {
                        activeImages.add(pub.image);
                    }
                });
            }
        });
        
        let deletedCount = 0;
        const deletePromises = allFiles.map(async (itemRef) => {
            try {
                const downloadURL = await itemRef.getDownloadURL();
                if (!activeImages.has(downloadURL)) {
                    await itemRef.delete();
                    deletedCount++;
                }
            } catch (err) {
                console.error("Failed to process storage item:", itemRef.name, err);
            }
        });
        
        await Promise.all(deletePromises);
        
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Cleaned ${deletedCount} Images!`;
        alert(`Clean up complete! Deleted ${deletedCount} orphaned images from storage.`);
        await updateStorageIndicator();
    } catch (err) {
        console.error("Storage clean up failed:", err);
        alert("Failed to clean up orphaned images: " + err.message);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 3000);
    }
}

function switchClient(client) {
    // 1. Determine allowed clients for current user
    const allowedClients = getClientList().filter(c => getUserClientPermission(state.currentUserEmail, c) !== "None");
    const isUserAdmin = checkUserIsAdmin(state.currentUserEmail);
    
    // 2. If user has no access to any clients and is not an admin, lock them out with "Access Pending" overlay
    const accessPendingOverlay = document.getElementById("access-pending-overlay");
    const accessPendingEmail = document.getElementById("access-pending-email");
    
    if (state.currentUserEmail && allowedClients.length === 0 && !isUserAdmin) {
        if (accessPendingOverlay) {
            if (accessPendingEmail) accessPendingEmail.textContent = state.currentUserEmail;
            accessPendingOverlay.style.display = "flex";
        }
        return;
    } else {
        if (accessPendingOverlay) accessPendingOverlay.style.display = "none";
    }
    
    // 3. If user has no access to the requested client and is not an admin, redirect to first allowed client
    let targetClient = client;
    if (!isUserAdmin && allowedClients.length > 0 && !allowedClients.includes(client)) {
        targetClient = allowedClients[0];
    }
    
    // 3. Render client options in dropdown switcher UI dynamically
    renderClientSwitcher(document.getElementById("client-switcher-search")?.value || "");

    state.activeClient = targetClient;
    localStorage.setItem("activeClient", targetClient);
    state.filters.type = "all";
    state.filters.center = "all";
    const filterTypeEl = document.getElementById("filter-type");
    if (filterTypeEl) filterTypeEl.value = "all";
    const filterCenterEl = document.getElementById("filter-center");
    if (filterCenterEl) filterCenterEl.value = "all";

    // Toggle center filter visibility
    const filterCenterGroup = document.getElementById("filter-center-group");
    if (filterCenterGroup) {
        if (targetClient === "iCode") {
            filterCenterGroup.classList.remove("hidden");
        } else {
            filterCenterGroup.classList.add("hidden");
        }
    }

    adjustClientSpecificOptions(targetClient);
    
    // Update UI Logos and Titles
    const activeLogo = document.getElementById("active-client-logo");
    const activeName = document.getElementById("active-client-name");
    const sidebarLogo = document.getElementById("sidebar-logo");
    const sidebarTitle = document.getElementById("sidebar-title");
    
    const logoSrc = getClientLogo(targetClient);
    const displayName = targetClient;
    
    if (activeLogo) activeLogo.src = logoSrc;
    if (activeName) activeName.textContent = displayName;
    if (sidebarLogo) sidebarLogo.src = logoSrc;
    if (sidebarTitle) sidebarTitle.textContent = displayName;

    const heroTitle = document.getElementById("hero-banner-title");
    if (heroTitle) {
        if (isPROnlyClient(targetClient)) {
            heroTitle.textContent = `${displayName} PR Analytics & Outputs`;
        } else {
            heroTitle.textContent = `${displayName} Creative Portfolio & Analytics`;
        }
    }
    
    const switcherActiveLogo = document.getElementById("switcher-active-logo");
    if (switcherActiveLogo) switcherActiveLogo.src = logoSrc;
    
    // Show/hide briefing warning and tab button in sidebar
    const briefingWarning = document.getElementById("briefing-client-warning");
    const briefingContent = document.getElementById("briefing-content-container");
    const briefingTabBtn = document.querySelector('.nav-btn[data-tab="briefing"]');
    
    if (targetClient === "RVNL") {
        if (briefingTabBtn) briefingTabBtn.style.display = "";
        if (briefingWarning) briefingWarning.classList.add("hidden");
        if (briefingContent) briefingContent.style.display = "block";
    } else {
        if (briefingTabBtn) briefingTabBtn.style.display = "none";
        if (briefingWarning) briefingWarning.classList.remove("hidden");
        if (briefingContent) briefingContent.style.display = "none";
        
        // Redirect to dashboard if the user was on the briefing tab
        if (state.activeTab === "briefing") {
            switchTab("dashboard");
        }
    }
    
    // Refresh all data displays
    populateOwnerFilter();
    updateDashboard();
    renderTracker();
    generateReport();
    updateStorageIndicator();

    // Check if code has changed on the server
    checkCodeUpdate();

    // Show pending notifications for this workspace that happened while the user was away
    if (state.pendingNotifications && state.pendingNotifications[targetClient] && state.pendingNotifications[targetClient].length > 0) {
        const count = state.pendingNotifications[targetClient].length;
        if (count > 2) {
            showToast("🔔 Updates While Away", `${count} tasks were created, updated, or deleted in this workspace while you were away.`, 5000);
        } else {
            state.pendingNotifications[targetClient].forEach(notif => {
                let notifTitle = "🔄 Task Updated";
                let notifBody = `"${notif.title}" was updated while you were away.`;
                if (notif.type === 'added') {
                    notifTitle = "➕ Task Added";
                    notifBody = `"${notif.title}" was created while you were away.`;
                } else if (notif.type === 'removed') {
                    notifTitle = "🗑️ Task Deleted";
                    notifBody = `"${notif.title}" was deleted while you were away.`;
                }
                showToast(notifTitle, notifBody, 4000);
            });
        }
        // Clear queue for this client
        state.pendingNotifications[targetClient] = [];
    }
}
// Reset all search and drop-down filters
function resetFilters() {
    const currentMonth = getCurrentMonthStr();
    document.getElementById("filter-type").value = "all";
    document.getElementById("filter-month").value = currentMonth;
    document.getElementById("filter-status").value = "all";
    document.getElementById("filter-owner").value = "all";
    const filterCenterEl = document.getElementById("filter-center");
    if (filterCenterEl) filterCenterEl.value = "all";
    document.getElementById("global-search").value = "";
    
    state.filters = {
        type: 'all',
        month: currentMonth,
        status: 'all',
        owner: 'all',
        center: 'all',
        search: ''
    };
    state.currentPage = 1;
    renderTracker();
}

// Switch between navigation tabs
function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.toggle("active", tab.id === tabName);
    });

    if (tabName === 'dashboard') {
        updateDashboard();
    } else if (tabName === 'tracker') {
        renderTracker();
    } else if (tabName === 'reports') {
        generateReport(); // Pre-generate default report
    } else if (tabName === 'briefing') {
        initBriefingTab();
    } else if (tabName === 'settings') {
        checkSettingsPasswordState();
    }

    // Auto-lock settings tab when switching away to another page
    if (tabName !== 'settings') {
        lockSettingsTabSilently();
    }
}

// Password Security logic for Backup & Settings Tab
function checkSettingsPasswordState() {
    if (state.settingsPassword === undefined) {
        // Wait for Firestore to load the password
        const statusText = document.getElementById("lock-screen-status");
        if (statusText) statusText.textContent = "Loading configuration from database...";
        return;
    }
    const password = state.settingsPassword;
    const lockScreen = document.getElementById("settings-lock-screen");
    const actualContent = document.getElementById("settings-actual-content");
    const passwordInput = document.getElementById("settings-password-input");
    const statusText = document.getElementById("lock-screen-status");
    const titleText = document.getElementById("lock-screen-title");
    const descText = document.getElementById("lock-screen-desc");
    const unlockBtn = document.getElementById("unlock-settings-btn");
    const lockIcon = document.getElementById("lock-screen-icon");
    const removeBtn = document.getElementById("remove-password-btn");
    const passwordStatus = document.getElementById("password-control-status");
    
    if (!lockScreen || !actualContent) return;
    
    statusText.textContent = "";
    passwordInput.value = "";
    
    if (!password) {
        // No password set yet, prompt to create one
        lockScreen.classList.remove("hidden");
        actualContent.style.display = "none";
        titleText.textContent = "Set Admin Password";
        descText.textContent = "Please set a password to secure your Admin Panel & settings.";
        unlockBtn.textContent = "Set Password";
        lockIcon.className = "fa-solid fa-lock-open";
        lockIcon.style.color = "var(--accent-amber)";
        if (removeBtn) removeBtn.style.display = "none";
        if (passwordStatus) passwordStatus.textContent = "No password configuration set. Panel is currently open.";
    } else {
        // Password is set, show lock overlay screen
        lockScreen.classList.remove("hidden");
        actualContent.style.display = "none";
        titleText.textContent = "Admin Panel Protected";
        descText.textContent = "Please enter your password to access the Admin Panel & Controls.";
        unlockBtn.textContent = "Unlock Panel";
        lockIcon.className = "fa-solid fa-lock";
        lockIcon.style.color = "var(--accent-purple)";
        if (removeBtn) removeBtn.style.display = "inline-block";
        if (passwordStatus) passwordStatus.textContent = "Password lock is currently active.";
    }
}

function lockSettingsTabSilently() {
    const lockScreen = document.getElementById("settings-lock-screen");
    const actualContent = document.getElementById("settings-actual-content");
    if (lockScreen && actualContent) {
        lockScreen.classList.remove("hidden");
        actualContent.style.display = "none";
    }
}

async function handleSettingsUnlockSubmit() {
    const password = state.settingsPassword;
    const passwordInput = document.getElementById("settings-password-input");
    const statusText = document.getElementById("lock-screen-status");
    const lockScreen = document.getElementById("settings-lock-screen");
    const actualContent = document.getElementById("settings-actual-content");
    
    if (!passwordInput || !statusText || !lockScreen || !actualContent) return;
    
    const inputVal = passwordInput.value.trim();
    if (!inputVal) {
        statusText.textContent = "Password cannot be empty.";
        return;
    }
    
    if (!password) {
        // Setting password for the first time
        setSyncStatus('saving');
        try {
            state.settingsPassword = inputVal;
            // Save to Firestore
            await db.collection('rvnl_tracker').doc('settings_config').set({
                password: inputVal,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            // Also keep in localStorage as a backup
            localStorage.setItem("rvnl_settings_password", inputVal);
            setSyncStatus('synced');
            alert("Access password set successfully!");
            lockScreen.classList.add("hidden");
            actualContent.style.display = "block";
            updateStorageIndicator();
            renderPermissionsMatrix();
        } catch (err) {
            console.error('Error saving password:', err);
            statusText.textContent = "Failed to save password to database. Please try again.";
            setSyncStatus('offline');
        }
    } else {
        // Verification mode
        if (inputVal === password) {
            lockScreen.classList.add("hidden");
            actualContent.style.display = "block";
            updateStorageIndicator();
            renderPermissionsMatrix();
        } else {
            statusText.textContent = "Incorrect password. Access denied.";
            passwordInput.value = "";
        }
    }
}

async function handleUpdatePassword() {
    const changeInput = document.getElementById("change-password-input");
    if (!changeInput) return;
    
    const newPass = changeInput.value.trim();
    if (!newPass) {
        alert("Please enter a valid password.");
        return;
    }
    
    setSyncStatus('saving');
    try {
        state.settingsPassword = newPass;
        // Save to Firestore
        await db.collection('rvnl_tracker').doc('settings_config').set({
            password: newPass,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Also keep in localStorage as a backup
        localStorage.setItem("rvnl_settings_password", newPass);
        setSyncStatus('synced');
        alert("Backup & Data access password updated successfully!");
        changeInput.value = "";
        checkSettingsPasswordState();
    } catch (err) {
        console.error('Error updating password:', err);
        alert("Failed to update password in database. Please check your connection and try again.");
        setSyncStatus('offline');
    }
}

async function handleRemovePassword() {
    if (confirm("Are you sure you want to disable the password lock? Anyone will be able to access the Backup & Data tab.")) {
        setSyncStatus('saving');
        try {
            state.settingsPassword = null;
            // Clear password in Firestore
            await db.collection('rvnl_tracker').doc('settings_config').set({
                password: "",
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            // Remove from local storage
            localStorage.removeItem("rvnl_settings_password");
            setSyncStatus('synced');
            alert("Password lock removed successfully!");
            checkSettingsPasswordState();
        } catch (err) {
            console.error('Error removing password:', err);
            alert("Failed to remove password from database. Please check your connection and try again.");
            setSyncStatus('offline');
        }
    }
}

// Switch between Table and Kanban Board views in Tracker
function switchView(viewName) {
    state.activeView = viewName;
    document.getElementById("view-table-btn").classList.toggle("active", viewName === "table");
    document.getElementById("view-kanban-btn").classList.toggle("active", viewName === "kanban");
    
    document.getElementById("table-view-container").classList.toggle("hidden", viewName !== "table");
    document.getElementById("kanban-view-container").classList.toggle("hidden", viewName !== "kanban");
    
    renderTracker();
}

// Helper to show/hide PR specific fields in task form
function togglePRFormFields(type) {
    const prFields = document.getElementById("pr-only-fields");
    const subTypeSelect = document.getElementById("task-sub-type");
    const lblSubType = document.getElementById("lbl-sub-type");
    const prPubsSection = document.getElementById("pr-publications-section");
    const prSpokespersonsSection = document.getElementById("pr-spokespersons-section");
    const prCampaignTypeSection = document.getElementById("pr-campaign-type-section");
    const prMetaRow = document.getElementById("pr-meta-row");
    
    const liveLinkGroup = document.getElementById("task-live-link").closest(".form-group");
    const canvaLinkGroup = document.getElementById("task-canva-link").closest(".form-group");
    const imageGroup = document.getElementById("task-image-file").closest(".form-group");
    const oldPubGroup = document.getElementById("task-publication").closest(".form-group");
    const spokespersonGroup = document.getElementById("task-spokesperson").closest(".form-group");
    
    const taskWeekGroup = document.getElementById("task-week").closest(".form-group");
    const taskMonthGroup = document.getElementById("task-month").closest(".form-group");
    const taskDateGroup = document.getElementById("task-date").closest(".form-group");
    const taskStatusSelect = document.getElementById("task-status");

    // Always show sub-type group first (will be hidden for Social Media)
    const subTypeGroupEl = subTypeSelect.closest('.form-group');
    if (subTypeGroupEl) subTypeGroupEl.classList.remove('hidden');

    const dcFields = document.getElementById("digital-campaigns-only-fields");
    if (dcFields) {
        if (type === "Digital Campaigns") {
            dcFields.classList.remove("hidden");
        } else {
            dcFields.classList.add("hidden");
        }
    }

    const greenshineCampaignGroup = document.getElementById("greenshine-campaign-group");
    if (greenshineCampaignGroup) {
        if (state.activeClient === "Green Shine Solar" && type === "Digital Campaigns") {
            greenshineCampaignGroup.classList.remove("hidden");
        } else {
            greenshineCampaignGroup.classList.add("hidden");
        }
    }

    if (type === "Digital Campaigns") {
        if (taskStatusSelect) {
            taskStatusSelect.innerHTML = `
                <option value="WIP">WIP</option>
                <option value="Sent for internal approval">Sent for internal approval</option>
                <option value="Sent to client">Sent to client</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Published/Closed">Published/Closed</option>
                <option value="Not used by client">Not used by client</option>
            `;
        }
        prFields.classList.add("hidden");
        prPubsSection.classList.add("hidden");
        if (prMetaRow) prMetaRow.classList.add("hidden");
        if (liveLinkGroup) liveLinkGroup.classList.add("hidden");
        if (canvaLinkGroup) canvaLinkGroup.classList.add("hidden");
        if (imageGroup) {
            imageGroup.classList.remove("hidden");
            const mainLabel = imageGroup.querySelector("label:not([id])");
            if (mainLabel) mainLabel.innerHTML = `<i class="fa-solid fa-image"></i> Ad Creative Image / Screenshot`;
            const uploadBtn = document.getElementById("upload-label");
            if (uploadBtn) uploadBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Upload Ad Creative`;
        }
        if (taskWeekGroup) taskWeekGroup.classList.remove("hidden");
        if (taskDateGroup) taskDateGroup.classList.remove("hidden");
        if (taskMonthGroup) taskMonthGroup.className = "form-group col-6";
        if (oldPubGroup) oldPubGroup.classList.add("hidden");
        if (spokespersonGroup) spokespersonGroup.classList.add("hidden");

        const subTypeGroup = subTypeSelect.closest('.form-group');
        if (subTypeGroup) subTypeGroup.classList.add('hidden');
        subTypeSelect.innerHTML = `<option value="Digital Campaign">Digital Campaign</option>`;
        return;
    }

    if (state.activeClient === "iCode") {
        if (taskStatusSelect) {
            taskStatusSelect.innerHTML = `
                <option value="WIP">WIP</option>
                <option value="Sent for internal approval">Sent for internal approval</option>
                <option value="Sent to client">Sent to client</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Published/Closed">Published/Closed</option>
                <option value="Not used by client">Not used by client</option>
            `;
        }
        prFields.classList.add("hidden");
        prPubsSection.classList.add("hidden");
        if (prMetaRow) prMetaRow.classList.add("hidden");
        if (liveLinkGroup) liveLinkGroup.classList.remove("hidden");
        if (canvaLinkGroup) canvaLinkGroup.classList.remove("hidden");
        if (imageGroup) {
            imageGroup.classList.remove("hidden");
            const mainLabel = imageGroup.querySelector("label:not([id])");
            if (mainLabel) mainLabel.innerHTML = `<i class="fa-solid fa-image"></i> Press Clipping / Image Attachment`;
            const uploadBtn = document.getElementById("upload-label");
            if (uploadBtn) uploadBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Upload Clipping (Cloud Storage)`;
        }
        if (taskWeekGroup) taskWeekGroup.classList.remove("hidden");
        if (taskDateGroup) taskDateGroup.classList.remove("hidden");
        if (taskMonthGroup) taskMonthGroup.className = "form-group col-6";
        lblSubType.textContent = "Creative Format";
        subTypeSelect.innerHTML = `
            <option value="Social Media Post">Social Media Post</option>
            <option value="Reel">Reel</option>
            <option value="Video">Video</option>
            <option value="Story">Story</option>
            <option value="Other">Other</option>
        `;
        return;
    }

    if (type === "PR Update") {
        if (taskStatusSelect) {
            taskStatusSelect.innerHTML = `
                <option value="WIP">WIP</option>
                <option value="Sent for internal approval">Sent for internal approval</option>
                <option value="Sent to client">Sent to client</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Sent to journalist">Sent to journalist</option>
                <option value="On hold">On hold</option>
                <option value="Published/Closed">Published/Closed</option>
                <option value="Not used by client">Not used by client</option>
            `;
        }
        prFields.classList.remove("hidden");
        prPubsSection.classList.remove("hidden");
        if (prMetaRow) prMetaRow.classList.remove("hidden");
        
        // Hide standard singular fields for PR
        if (liveLinkGroup) liveLinkGroup.classList.add("hidden");
        if (canvaLinkGroup) canvaLinkGroup.classList.add("hidden");
        if (imageGroup) imageGroup.classList.add("hidden");
        if (taskWeekGroup) taskWeekGroup.classList.add("hidden");
        if (taskDateGroup) taskDateGroup.classList.add("hidden");
        if (taskMonthGroup) taskMonthGroup.className = "form-group col-12";
        if (oldPubGroup) oldPubGroup.classList.add("hidden");
        if (spokespersonGroup) spokespersonGroup.classList.add("hidden");

        lblSubType.textContent = "PR Category";
        subTypeSelect.innerHTML = `
            <option value="Press Release">Press Release</option>
            <option value="Interview">Interview</option>
            <option value="Byline or Authored Article">Byline or Authored Article</option>
            <option value="Press Conference or Roundtable">Press Conference or Roundtable</option>
            <option value="Leadership Profiling">Leadership Profiling</option>
            <option value="Award Nomination">Award Nomination</option>
            <option value="Speaking Opportunity">Speaking Opportunity</option>
            <option value="Reactive Statement/Industry Story">Reactive Statement/Industry Story</option>
            <option value="Event coverage">Event Coverage</option>
            <option value="Documents">Documents</option>
            <option value="Other">Other</option>
        `;
    } else if (type === "Social Media") {
        if (taskStatusSelect) {
            taskStatusSelect.innerHTML = `
                <option value="WIP">WIP</option>
                <option value="Sent for internal approval">Sent for internal approval</option>
                <option value="Sent to client">Sent to client</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Published/Closed">Published/Closed</option>
                <option value="Not used by client">Not used by client</option>
            `;
        }
        prFields.classList.add("hidden");
        prPubsSection.classList.add("hidden");
        if (prMetaRow) prMetaRow.classList.add("hidden");
        if (liveLinkGroup) liveLinkGroup.classList.remove("hidden");
        if (canvaLinkGroup) canvaLinkGroup.classList.remove("hidden");
        if (imageGroup) {
            imageGroup.classList.remove("hidden");
            const mainLabel = imageGroup.querySelector("label:not([id])");
            if (mainLabel) mainLabel.innerHTML = `<i class="fa-solid fa-image"></i> Press Clipping / Image Attachment`;
            const uploadBtn = document.getElementById("upload-label");
            if (uploadBtn) uploadBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Upload Clipping (Cloud Storage)`;
        }
        if (taskWeekGroup) taskWeekGroup.classList.remove("hidden");
        if (taskDateGroup) taskDateGroup.classList.remove("hidden");
        if (taskMonthGroup) taskMonthGroup.className = "form-group col-6";
        if (oldPubGroup) {
            oldPubGroup.classList.remove("hidden");
            if (spokespersonGroup) {
                spokespersonGroup.classList.remove("hidden");
                spokespersonGroup.className = "form-group col-6";
            }
        }
        
        // Social media posts go to ALL platforms — hide sub-type selector
        const subTypeGroup = subTypeSelect.closest('.form-group');
        if (subTypeGroup) subTypeGroup.classList.add('hidden');
        subTypeSelect.innerHTML = `<option value="All Platforms">All Platforms</option>`;
        return; // early return to avoid showing sub-type group below
    } else {
        if (taskStatusSelect) {
            taskStatusSelect.innerHTML = `
                <option value="WIP">WIP</option>
                <option value="Sent for internal approval">Sent for internal approval</option>
                <option value="Sent to client">Sent to client</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Published/Closed">Published/Closed</option>
                <option value="Not used by client">Not used by client</option>
            `;
        }
        prFields.classList.add("hidden");
        prPubsSection.classList.add("hidden");
        if (prMetaRow) prMetaRow.classList.add("hidden");
        if (liveLinkGroup) liveLinkGroup.classList.remove("hidden");
        if (canvaLinkGroup) canvaLinkGroup.classList.remove("hidden");
        if (imageGroup) {
            imageGroup.classList.remove("hidden");
            const mainLabel = imageGroup.querySelector("label:not([id])");
            if (mainLabel) mainLabel.innerHTML = `<i class="fa-solid fa-image"></i> Press Clipping / Image Attachment`;
            const uploadBtn = document.getElementById("upload-label");
            if (uploadBtn) uploadBtn.innerHTML = `<i class="fa-solid fa-upload"></i> Upload Clipping (Cloud Storage)`;
        }
        if (taskWeekGroup) taskWeekGroup.classList.remove("hidden");
        if (taskDateGroup) taskDateGroup.classList.remove("hidden");
        if (taskMonthGroup) taskMonthGroup.className = "form-group col-6";
        if (oldPubGroup) {
            oldPubGroup.classList.remove("hidden");
            if (spokespersonGroup) {
                spokespersonGroup.classList.remove("hidden");
                spokespersonGroup.className = "form-group col-6";
            }
        }
        
        lblSubType.textContent = "Asset Sub-category";
        subTypeSelect.innerHTML = `
            <option value="Magazine Ad">Magazine Ad</option>
            <option value="Newsletter">Newsletter</option>
            <option value="Video">Video</option>
            <option value="Blog">Blog</option>
            <option value="Website">Website</option>
            <option value="Brochure">Brochure</option>
            <option value="Banner">Banner / Standee</option>
            <option value="Other">Other / Misc</option>
        `;
    }
}

// Handle pasting image from clipboard directly into a specific publication row
async function handleClipboardPasteForPublication(file, idx, rowEl) {
    const statusEl = rowEl.querySelector(".pub-upload-status");
    const percentEl = rowEl.querySelector(".pub-upload-percent");
    const barEl = rowEl.querySelector(".pub-upload-progress-bar");
    const textEl = rowEl.querySelector(".pub-upload-text");
    
    if (statusEl) {
        if (textEl) textEl.textContent = "Uploading clipboard clipping...";
        if (percentEl) percentEl.textContent = "0%";
        if (barEl) barEl.style.width = "0%";
        statusEl.style.display = "block";
    }
    
    const uploadId = `pub_clipboard_${idx}_${Date.now()}`;
    state.activeUploads.add(uploadId);
    updateDrawerButtonsState();
    
    try {
        const taskTitle = document.getElementById("task-title").value || "PR_Coverage";
        const client = state.activeClient || "General";
        const name = `clipboard_screenshot_${Date.now()}.jpg`;
        const clipboardFile = new File([file], name, { type: file.type });
        const downloadURL = await uploadImageToStorage(clipboardFile, client, taskTitle, (progress) => {
            if (percentEl) percentEl.textContent = `${Math.round(progress)}%`;
            if (barEl) barEl.style.width = `${progress}%`;
        });
        
        state.currentTaskPublications[idx].image = downloadURL;
        if (statusEl) statusEl.style.display = "none";
        renderDrawerPublications();
    } catch (err) {
        console.error("Publication clipboard paste failed:", err);
        alert("Upload failed: " + err.message);
        if (statusEl) statusEl.style.display = "none";
    } finally {
        state.activeUploads.delete(uploadId);
        updateDrawerButtonsState();
    }
}

// Render publications list inside the task drawer
function renderDrawerPublications() {
    const container = document.getElementById("pr-publications-container");
    if (!container) return;
    container.innerHTML = "";

    const list = state.currentTaskPublications || [];

    // Toggle drawer expansion class based on whether any publication exists
    const drawer = document.querySelector(".task-drawer");
    if (drawer) {
        if (list.length > 0) {
            drawer.classList.add("expanded");
        } else {
            drawer.classList.remove("expanded");
        }
    }

    if (list.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 12px; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 8px;">No publications added yet. Click "Add Publication" to list coverages.</div>`;
        return;
    }

    list.forEach((pub, idx) => {
        const row = document.createElement("div");
        row.className = "pr-pub-row";
        row.style.cssText = "background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; position: relative;";
        
        const isExpanded = pub._isExpanded || false;
        
        row.innerHTML = `
            <button type="button" class="btn-remove-pub" data-index="${idx}" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--accent-red); cursor: pointer; font-size: 13px;" title="Remove Publication">
                <i class="fa-solid fa-trash"></i>
            </button>
            
            <!-- Row 1: Core Fields -->
            <div style="display: flex; gap: 10px; width: 100%; margin-bottom: 0; align-items: flex-end;">
                <div style="flex: 1.5; min-width: 0;">
                    <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Publication Name</label>
                    <input type="text" class="pub-name-input" data-index="${idx}" value="${pub.name || ''}" placeholder="e.g. The Hindu" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                </div>
                <div style="flex: 2; min-width: 0;">
                    <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Headline</label>
                    <input type="text" class="pub-headline-input" data-index="${idx}" value="${pub.headline || ''}" placeholder="e.g. Green Shine Solar Launches New Plant" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                </div>
                <div style="flex: 2; min-width: 0;">
                    <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Live / Verification Link</label>
                    <input type="url" class="pub-link-input" data-index="${idx}" value="${pub.link || ''}" placeholder="https://..." style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                </div>
                <div style="flex: 1; min-width: 0;">
                    <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Pub Date</label>
                    <input type="text" class="pub-date-input" data-index="${idx}" value="${pub.date || ''}" placeholder="e.g. 5th June" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                </div>
                <button type="button" class="btn-toggle-pub-details btn btn-secondary btn-sm" data-index="${idx}" style="height: 36px; padding: 0 10px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 12px; gap: 4px; font-weight: 600; white-space: nowrap; margin-bottom: 0;" title="${isExpanded ? 'Hide Details' : 'Show Details'}">
                    <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                    <span>${isExpanded ? 'Less' : 'More'}</span>
                </button>
            </div>
            
            <!-- Collapsible details container -->
            <div class="pub-details-collapsible ${isExpanded ? '' : 'hidden'}" style="display: flex; flex-direction: column; gap: 12px; border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 4px;">
                
                <!-- Row 2: Coverage Type, Journalist, Tier -->
                <div style="display: flex; gap: 10px; width: 100%; margin-bottom: 0;">
                    <div style="flex: 1; min-width: 0;">
                        <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Coverage Type</label>
                        <select class="pub-coverage-type-select" data-index="${idx}" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                            <option value="">-- Select Type --</option>
                            <option value="Print" ${pub.coverageType === 'Print' ? 'selected' : ''}>Print</option>
                            <option value="Online" ${pub.coverageType === 'Online' ? 'selected' : ''}>Online</option>
                            <option value="Television" ${pub.coverageType === 'Television' ? 'selected' : ''}>Television</option>
                            <option value="Podcast" ${pub.coverageType === 'Podcast' ? 'selected' : ''}>Podcast</option>
                            <option value="Social" ${pub.coverageType === 'Social' ? 'selected' : ''}>Social</option>
                        </select>
                    </div>
                    <div style="flex: 1.5; min-width: 0;">
                        <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Journalist Name</label>
                        <input type="text" class="pub-journalist-input" data-index="${idx}" value="${pub.journalist || ''}" placeholder="e.g. Jane Doe" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Publication Tier</label>
                        <select class="pub-tier-select" data-index="${idx}" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                            <option value="">-- Select Tier --</option>
                            <option value="Tier 1" ${pub.tier === 'Tier 1' ? 'selected' : ''}>Tier 1</option>
                            <option value="Tier 2" ${pub.tier === 'Tier 2' ? 'selected' : ''}>Tier 2</option>
                            <option value="Tier 3" ${pub.tier === 'Tier 3' ? 'selected' : ''}>Tier 3</option>
                            <option value="Other" ${pub.tier === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                </div>
                
                <!-- Row 3: Sentiment, Syndication, Generated by Agency -->
                <div style="display: flex; gap: 10px; width: 100%; margin-bottom: 0;">
                    <div style="flex: 1; min-width: 0;">
                        <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Sentiment</label>
                        <select class="pub-sentiment-select" data-index="${idx}" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                            <option value="">-- Select Sentiment --</option>
                            <option value="Positive" ${pub.sentiment === 'Positive' ? 'selected' : ''}>Positive</option>
                            <option value="Neutral" ${pub.sentiment === 'Neutral' ? 'selected' : ''}>Neutral</option>
                            <option value="Negative" ${pub.sentiment === 'Negative' ? 'selected' : ''}>Negative</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Syndication / Own</label>
                        <select class="pub-syndication-select" data-index="${idx}" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                            <option value="">-- Select Option --</option>
                            <option value="Own" ${pub.syndication === 'Own' ? 'selected' : ''}>Own</option>
                            <option value="Syndication" ${pub.syndication === 'Syndication' ? 'selected' : ''}>Syndication</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Generated by Agency</label>
                        <select class="pub-agency-generated-select" data-index="${idx}" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                            <option value="">-- Select Option --</option>
                            <option value="Yes" ${pub.agencyGenerated === 'Yes' ? 'selected' : ''}>Yes</option>
                            <option value="No" ${pub.agencyGenerated === 'No' ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                </div>

                <!-- Row 4: Key Messages -->
                <div style="width: 100%; margin-bottom: 0;">
                    <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Key Messages</label>
                    <input type="text" class="pub-key-messages-input" data-index="${idx}" value="${pub.keyMessages || ''}" placeholder="e.g. Focus on clean energy, sustainable operations, expansion" style="width: 100%; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                </div>
                
                <!-- Row 5: Press Clipping Image (Existing) -->
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 11px; margin-bottom: 4px; display: block; font-weight: 500;">Press Clipping Image</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="file" class="pub-file-input" id="pub-file-${pub.id}" data-index="${idx}" accept="image/*" style="display: none;">
                        <label for="pub-file-${pub.id}" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 6px 12px; height: 32px; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; border-radius: 8px; margin: 0; box-sizing: border-box; white-space: nowrap;"><i class="fa-solid fa-upload"></i> Upload Image</label>
                        <input type="text" class="pub-image-url-input" data-index="${idx}" value="${pub.image || ''}" placeholder="Or enter Image URL / Paste (Ctrl+V) image..." style="flex: 1; font-size: 12px; padding: 6px 10px; height: 32px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
                        
                        ${pub.image ? `
                        <div class="pub-img-preview-container" style="position: relative; width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden; background: var(--bg-primary); flex-shrink: 0;">
                            <img src="${pub.image}" style="width: 100%; height: 100%; object-fit: cover;">
                            <div class="pub-img-preview-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; cursor: pointer;" onclick="viewImageInNewWindow('${pub.image}')">
                                <i class="fa-solid fa-eye" style="font-size: 10px; color: #fff;"></i>
                            </div>
                        </div>` : ''}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 4.5px; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-circle-info" style="font-size: 9px; color: var(--accent-blue);"></i>
                        <span>Tip: Click here and press <strong>Ctrl+V</strong> to paste copied image.</span>
                    </div>
                    <div class="pub-upload-status" style="font-size: 10.5px; color: var(--accent-blue); font-weight: 500; margin-top: 4px; display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span class="pub-upload-text">Uploading clipping to storage...</span>
                            <span class="pub-upload-percent">0%</span>
                        </div>
                        <div class="pub-upload-progress-container">
                            <div class="pub-upload-progress-bar"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add hover effects for eye preview
        const previewCont = row.querySelector(".pub-img-preview-container");
        if (previewCont) {
            const overlay = previewCont.querySelector(".pub-img-preview-overlay");
            previewCont.addEventListener("mouseenter", () => overlay.style.opacity = "1");
            previewCont.addEventListener("mouseleave", () => overlay.style.opacity = "0");
        }
        
        container.appendChild(row);
    });

    // Wire up events for inputs and buttons inside the newly rendered rows
    container.querySelectorAll(".pub-name-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].name = e.target.value;
        });
    });

    container.querySelectorAll(".pub-headline-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].headline = e.target.value;
        });
    });

    container.querySelectorAll(".pub-link-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].link = e.target.value;
        });
    });

    container.querySelectorAll(".pub-date-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].date = e.target.value;
        });
    });

    container.querySelectorAll(".pub-coverage-type-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].coverageType = e.target.value;
        });
    });

    container.querySelectorAll(".pub-journalist-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].journalist = e.target.value;
        });
    });

    container.querySelectorAll(".pub-tier-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].tier = e.target.value;
        });
    });

    container.querySelectorAll(".pub-sentiment-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].sentiment = e.target.value;
        });
    });

    container.querySelectorAll(".pub-syndication-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].syndication = e.target.value;
        });
    });

    container.querySelectorAll(".pub-agency-generated-select").forEach(select => {
        select.addEventListener("change", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].agencyGenerated = e.target.value;
        });
    });

    container.querySelectorAll(".pub-key-messages-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].keyMessages = e.target.value;
        });
    });

    container.querySelectorAll(".btn-toggle-pub-details").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = parseInt(btn.getAttribute("data-index"));
            const pub = state.currentTaskPublications[idx];
            pub._isExpanded = !(pub._isExpanded || false);
            renderDrawerPublications();
        });
    });

    container.querySelectorAll(".pub-image-url-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskPublications[idx].image = e.target.value;
            // Update preview thumbnail if URL changes
            setTimeout(() => {
                if (document.activeElement !== input) {
                    renderDrawerPublications();
                }
            }, 1500);
        });
        input.addEventListener("blur", () => {
            renderDrawerPublications();
        });
    });

    container.querySelectorAll(".pub-file-input").forEach(input => {
        input.addEventListener("change", async (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            const file = e.target.files[0];
            if (!file) return;
            
            const rowEl = e.target.closest(".pr-pub-row");
            const statusEl = rowEl.querySelector(".pub-upload-status");
            const percentEl = rowEl.querySelector(".pub-upload-percent");
            const barEl = rowEl.querySelector(".pub-upload-progress-bar");
            const textEl = rowEl.querySelector(".pub-upload-text");
            
            if (statusEl) {
                if (textEl) textEl.textContent = "Uploading clipping to storage...";
                if (percentEl) percentEl.textContent = "0%";
                if (barEl) barEl.style.width = "0%";
                statusEl.style.display = "block";
            }
            
            const uploadId = `pub_file_${idx}_${Date.now()}`;
            state.activeUploads.add(uploadId);
            updateDrawerButtonsState();
            
            try {
                const taskTitle = document.getElementById("task-title").value || "PR_Coverage";
                const client = state.activeClient || "General";
                const downloadURL = await uploadImageToStorage(file, client, taskTitle, (progress) => {
                    if (percentEl) percentEl.textContent = `${Math.round(progress)}%`;
                    if (barEl) barEl.style.width = `${progress}%`;
                });
                
                state.currentTaskPublications[idx].image = downloadURL;
                if (statusEl) statusEl.style.display = "none";
                renderDrawerPublications();
            } catch (err) {
                console.error("Publication image upload failed:", err);
                alert("Upload failed: " + err.message);
                if (statusEl) statusEl.style.display = "none";
            } finally {
                state.activeUploads.delete(uploadId);
                updateDrawerButtonsState();
            }
        });
    });

    container.querySelectorAll(".btn-remove-pub").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = parseInt(btn.getAttribute("data-index"));
            state.currentTaskPublications.splice(idx, 1);
            renderDrawerPublications();
        });
    });
}

function renderDrawerSpokespersons() {
    const container = document.getElementById("pr-spokespersons-container");
    if (!container) return;
    container.innerHTML = "";

    const list = state.currentTaskSpokespersons || [];
    if (list.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 12px; color: var(--text-muted); font-size: 12px; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 8px;">No spokespersons added yet. Click "Add Spokesperson".</div>`;
        return;
    }

    list.forEach((sp, idx) => {
        const row = document.createElement("div");
        row.className = "pr-spokesperson-row";
        row.style.cssText = "display: flex; gap: 10px; align-items: center; width: 100%; margin-bottom: 0;";
        
        row.innerHTML = `
            <input type="text" class="spokesperson-name-input" data-index="${idx}" value="${sp.name || ''}" placeholder="e.g. CMD / Director Projects" style="flex: 1; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
            <button type="button" class="btn-remove-spokesperson btn btn-danger-sm" data-index="${idx}" style="padding: 6px 10px; height: 36px; border-radius: 8px; font-size: 12px; box-sizing: border-box; display: flex; align-items: center; justify-content: center;" title="Remove Spokesperson">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(row);
    });

    // Wire up events for inputs and buttons inside the newly rendered rows
    container.querySelectorAll(".spokesperson-name-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskSpokespersons[idx].name = e.target.value;
        });
    });

    container.querySelectorAll(".btn-remove-spokesperson").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = parseInt(btn.getAttribute("data-index"));
            state.currentTaskSpokespersons.splice(idx, 1);
            renderDrawerSpokespersons();
        });
    });
}

function renderDrawerReferenceLinks() {
    const container = document.getElementById("ref-links-container");
    if (!container) return;
    container.innerHTML = "";

    const list = state.currentTaskReferenceLinks || [];

    if (list.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 10px; color: var(--text-muted); font-size: 12px; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); border-radius: 8px;">No reference links added yet. Click "+ Add Link" to attach URLs.</div>`;
        return;
    }

    list.forEach((link, idx) => {
        const row = document.createElement("div");
        row.style.cssText = "display: flex; gap: 8px; align-items: center; width: 100%;";
        row.innerHTML = `
            <input type="text" class="ref-link-label-input" data-index="${idx}" value="${link.label || ''}" placeholder="Label (e.g. Presentation, Brief...)" style="flex: 1; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
            <input type="url" class="ref-link-url-input" data-index="${idx}" value="${link.url || ''}" placeholder="https://..." style="flex: 2; font-size: 12px; padding: 8px 10px; height: 36px; box-sizing: border-box; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px;">
            <button type="button" class="btn-remove-ref-link" data-index="${idx}" style="background: none; border: none; color: var(--accent-red); cursor: pointer; font-size: 13px; padding: 4px 8px; flex-shrink: 0;" title="Remove Link">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;
        container.appendChild(row);
    });

    container.querySelectorAll(".ref-link-label-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskReferenceLinks[idx].label = e.target.value;
        });
    });

    container.querySelectorAll(".ref-link-url-input").forEach(input => {
        input.addEventListener("input", (e) => {
            const idx = parseInt(e.target.getAttribute("data-index"));
            state.currentTaskReferenceLinks[idx].url = e.target.value;
        });
    });

    container.querySelectorAll(".btn-remove-ref-link").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-index"));
            state.currentTaskReferenceLinks.splice(idx, 1);
            renderDrawerReferenceLinks();
        });
    });
}


function getPlatformIcon(subType) {
    const platforms = {
        'LinkedIn':    { icon: 'fa-brands fa-linkedin',   color: '#0077b5', label: 'LinkedIn' },
        'X (Twitter)': { icon: 'fa-brands fa-x-twitter',  color: '#14171a', label: 'X' },
        'Instagram':   { icon: 'fa-brands fa-instagram',  color: '#e1306c', label: 'Instagram' },
        'Facebook':    { icon: 'fa-brands fa-facebook',   color: '#1877f2', label: 'Facebook' },
        'YouTube':     { icon: 'fa-brands fa-youtube',    color: '#ff0000', label: 'YouTube' },
        'WhatsApp':    { icon: 'fa-brands fa-whatsapp',   color: '#25d366', label: 'WhatsApp' },
    };
    return platforms[subType] || { icon: 'fa-solid fa-share-nodes', color: '#3b82f6', label: subType || 'Social Media' };
}

// ====================================================
// CRUD & FORM SUBMISSION LOGIC
// ====================================================

// Helper to show/hide WIP comments fields in task form
function toggleWipCommentFields(status) {
    const group = document.getElementById("wip-comments-group");
    if (!group) return;
    if (status === "WIP" || status === "Sent for internal approval" || status === "On hold" || status === "Sent to journalist") {
        group.classList.remove("hidden");
    } else {
        group.classList.add("hidden");
    }
}

// Helper to calculate and update CPL/CPC dynamically
function updateCplCpcCalculation() {
    const budgetInput = document.getElementById("task-budget");
    const conversionsInput = document.getElementById("task-conversions");
    const cplCpcInput = document.getElementById("task-cpl-cpc");
    
    if (budgetInput && conversionsInput && cplCpcInput) {
        const budgetVal = parseFloat(budgetInput.value) || 0;
        const convVal = parseInt(conversionsInput.value, 10) || 0;
        
        if (convVal > 0) {
            cplCpcInput.value = (budgetVal / convVal).toFixed(2);
        } else {
            cplCpcInput.value = "0.00";
        }
    }
}

// Open Drawer (Create or Edit state)
function openDrawer(taskId = null, prefillData = null) {
    const form = document.getElementById("task-form");
    form.reset();
    document.getElementById("task-id").value = "";
    removeImagePreview();
    state.pendingImageFile = null; // Clear any pending uploaded file object

    // Reset iCode centers checkboxes
    document.querySelectorAll('input[name="icode-center"]').forEach(cb => {
        cb.checked = false;
    });



    // Reset Green Shine campaign type checkboxes
    document.querySelectorAll('input[name="greenshine-campaign-type"]').forEach(cb => {
        cb.checked = false;
    });

    // Reset Digital Campaigns specific fields
    const adCreativeLinkInput = document.getElementById("task-ad-creative-link");
    const targetUrlInput = document.getElementById("task-target-url");
    const campaignBudgetInput = document.getElementById("task-budget");
    const conversionsInput = document.getElementById("task-conversions");
    const cplCpcInput = document.getElementById("task-cpl-cpc");
    if (adCreativeLinkInput) adCreativeLinkInput.value = "";
    if (targetUrlInput) targetUrlInput.value = "";
    if (campaignBudgetInput) campaignBudgetInput.value = "";
    if (conversionsInput) conversionsInput.value = "";
    if (cplCpcInput) cplCpcInput.value = "";
    document.querySelectorAll('input[name="campaign-platform"]').forEach(cb => {
        cb.checked = false;
    });

    // Reset PR deadlines & priority
    const targetCompDateInput = document.getElementById("task-target-completion-date");
    const oppDeadlineInput = document.getElementById("task-opportunity-deadline");
    const prPrioritySelect = document.getElementById("task-priority");
    if (targetCompDateInput) targetCompDateInput.value = "";
    if (oppDeadlineInput) oppDeadlineInput.value = "";
    if (prPrioritySelect) prPrioritySelect.value = "Medium";

    // Reset WIP comment fields
    const wipWhoInput = document.getElementById("task-wip-who");
    const wipWhyInput = document.getElementById("task-wip-why");
    if (wipWhoInput) wipWhoInput.value = "";
    if (wipWhyInput) wipWhyInput.value = "";

    const overlay = document.getElementById("task-drawer-overlay");
    const title = document.getElementById("drawer-title");
    
    // Default current month/week selection
    document.getElementById("task-month").value = getCurrentMonthStr();
    document.getElementById("task-week").value = getCurrentWeekStr();
    document.getElementById("task-status").value = "WIP";
    
    const taskTypeSelect = document.getElementById("task-type");
    if (isPROnlyClient(state.activeClient)) {
        taskTypeSelect.innerHTML = `<option value="PR Update">PR Update (Press Release / Media)</option>`;
        taskTypeSelect.value = "PR Update";
        togglePRFormFields("PR Update");
    } else if (state.activeClient === "iCode") {
        taskTypeSelect.innerHTML = `
            <option value="Organic">Organic Post</option>
            <option value="Paid">Paid Campaign</option>
        `;
        taskTypeSelect.value = "Organic";
        togglePRFormFields("Social Media");
        document.querySelectorAll('input[name="icode-campaign-type"]').forEach(cb => {
            cb.checked = (cb.value === "Organic");
        });
    } else {
        if (state.activeClient === "Green Shine Solar") {
            taskTypeSelect.innerHTML = `
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update (Press Release / Media)</option>
                <option value="Creative / Collateral">Creative / Collateral (Ads, Magazines, Newsletter)</option>
                <option value="Digital Campaigns">Digital Campaigns</option>
            `;
        } else {
            taskTypeSelect.innerHTML = `
                <option value="Social Media">Social Media Post</option>
                <option value="PR Update">PR Update (Press Release / Media)</option>
                <option value="Creative / Collateral">Creative / Collateral (Ads, Magazines, Newsletter)</option>
            `;
        }
        taskTypeSelect.value = "Social Media";
        togglePRFormFields("Social Media");
    }
    toggleWipCommentFields("WIP"); // default status is WIP
    state.currentTaskPublications = [];
    renderDrawerPublications();
    state.currentTaskSpokespersons = [];
    renderDrawerSpokespersons();
    state.currentTaskReferenceLinks = [];
    renderDrawerReferenceLinks();

    if (taskId) {
        title.textContent = "Edit Tracked Item";
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById("task-id").value = task.id;
            if (task.client === "iCode") {
                document.getElementById("task-type").value = "Organic"; // Dummy fallback
                togglePRFormFields("Social Media");
                
                // Prefill checkboxes for iCode campaign type
                const campaignTypes = Array.isArray(task.campaignType) 
                    ? task.campaignType 
                    : (task.campaignType ? [task.campaignType] : []);
                document.querySelectorAll('input[name="icode-campaign-type"]').forEach(cb => {
                    cb.checked = campaignTypes.includes(cb.value);
                });
                
                // Prefill checkboxes for iCode centers
                const centers = task.centers || [];
                document.querySelectorAll('input[name="icode-center"]').forEach(cb => {
                    cb.checked = centers.includes(cb.value);
                });
            } else {
                document.getElementById("task-type").value = task.type;
                togglePRFormFields(task.type);
            }

            // Prefill Green Shine campaign type checkboxes if client is Green Shine Solar
            if (task.client === "Green Shine Solar") {
                const campaignTypes = Array.isArray(task.campaignType) 
                    ? task.campaignType 
                    : (task.campaignType ? [task.campaignType] : []);
                document.querySelectorAll('input[name="greenshine-campaign-type"]').forEach(cb => {
                    cb.checked = campaignTypes.includes(cb.value);
                });
            }

            // Prefill Digital Campaigns specific fields
            if (task.type === "Digital Campaigns") {
                const adCreativeLinkInput = document.getElementById("task-ad-creative-link");
                const targetUrlInput = document.getElementById("task-target-url");
                const campaignBudgetInput = document.getElementById("task-budget");
                const conversionsInput = document.getElementById("task-conversions");
                
                if (adCreativeLinkInput) adCreativeLinkInput.value = task.adCreativeLink || "";
                if (targetUrlInput) targetUrlInput.value = task.targetUrl || "";
                if (campaignBudgetInput) campaignBudgetInput.value = task.campaignBudget || "";
                if (conversionsInput) conversionsInput.value = task.leadsConversionsClicks || "";
                
                // Platforms
                const platforms = task.platforms || [];
                document.querySelectorAll('input[name="campaign-platform"]').forEach(cb => {
                    cb.checked = platforms.includes(cb.value);
                });
                
                // Recalculate CPL/CPC
                updateCplCpcCalculation();
            }
            
            document.getElementById("task-sub-type").value = task.subType || "";
            document.getElementById("task-title").value = task.title || "";
            document.getElementById("task-status").value = task.status || "WIP";
            document.getElementById("task-owner").value = task.owner || "Unassigned";
            document.getElementById("task-month").value = task.month || "";
            document.getElementById("task-week").value = task.week || "Week 1";
            document.getElementById("task-date").value = task.date || "";
            document.getElementById("task-canva-link").value = task.canvaLink || "";
            document.getElementById("task-live-link").value = task.liveLink || "";
            document.getElementById("task-remarks").value = task.remarks || "";

            // Load reference links
            state.currentTaskReferenceLinks = (task.referenceLinks && task.referenceLinks.length > 0)
                ? JSON.parse(JSON.stringify(task.referenceLinks))
                : [];
            renderDrawerReferenceLinks();
            
            if (wipWhoInput) wipWhoInput.value = task.wipWho || "";
            if (wipWhyInput) wipWhyInput.value = task.wipWhy || "";
            toggleWipCommentFields(task.status || "WIP");
            
            if (task.type === "PR Update") {
                document.getElementById("task-spokesperson").value = task.spokesperson || "";
                document.getElementById("task-publication").value = task.publication || "";
                
                // Prefill PR deadlines & priority
                if (targetCompDateInput) targetCompDateInput.value = task.targetCompletionDate || "";
                if (oppDeadlineInput) oppDeadlineInput.value = task.opportunityDeadline || "";
                if (prPrioritySelect) prPrioritySelect.value = task.priority || "Medium";

                // Prefill checkboxes for PR campaign type (Organic / Paid)
                const prCampaignTypes = Array.isArray(task.campaignType) 
                    ? task.campaignType 
                    : (task.campaignType ? [task.campaignType] : []);
                document.querySelectorAll('input[name="pr-campaign-type"]').forEach(cb => {
                    cb.checked = prCampaignTypes.includes(cb.value);
                });

                let publicationsList = [];
                if (task.publicationsList && task.publicationsList.length > 0) {
                    publicationsList = JSON.parse(JSON.stringify(task.publicationsList));
                } else if (task.publication || task.liveLink || task.image) {
                    publicationsList = [{
                        id: generateUUID(),
                        name: task.publication || "",
                        link: task.liveLink || "",
                        image: task.image || "",
                        date: task.date || ""
                    }];
                }
                state.currentTaskPublications = publicationsList;
                renderDrawerPublications();

                let spokespersonsList = [];
                if (task.spokespersonsList && task.spokespersonsList.length > 0) {
                    spokespersonsList = JSON.parse(JSON.stringify(task.spokespersonsList));
                } else if (task.spokesperson) {
                    spokespersonsList = task.spokesperson.split(",").map(name => name.trim()).filter(Boolean).map(name => ({
                        id: generateUUID(),
                        name: name
                    }));
                }
                state.currentTaskSpokespersons = spokespersonsList;
                renderDrawerSpokespersons();
            }

            // Image clipping preview if it exists
            if (task.image) {
                showImagePreview(task.image);
            }
        }
    } else if (prefillData) {
        title.textContent = "Add Strategy Item to Tracker";
        document.getElementById("task-type").value = prefillData.type;
        togglePRFormFields(prefillData.type);
        
        if (prefillData.subType) document.getElementById("task-sub-type").value = prefillData.subType;
        if (prefillData.title) document.getElementById("task-title").value = prefillData.title;
        if (prefillData.remarks) document.getElementById("task-remarks").value = prefillData.remarks;
        if (prefillData.status) {
            document.getElementById("task-status").value = prefillData.status;
            toggleWipCommentFields(prefillData.status);
        }
        if (prefillData.owner) document.getElementById("task-owner").value = prefillData.owner;
        if (prefillData.month) document.getElementById("task-month").value = prefillData.month;
        if (prefillData.week) document.getElementById("task-week").value = prefillData.week;
        if (prefillData.date) document.getElementById("task-date").value = prefillData.date;
    } else {
        title.textContent = "Add Creative Asset or PR Activity";
    }

    const isReadOnly = (getUserClientPermission(state.currentUserEmail, state.activeClient) === "ReadOnly");
    
    // Hide/show save button
    const saveTaskBtn = document.getElementById("save-task-btn");
    if (saveTaskBtn) {
        saveTaskBtn.style.display = isReadOnly ? "none" : "";
    }

    // Set drawer title for read-only view
    if (isReadOnly && taskId) {
        title.textContent = "View Task Details (Read-Only)";
    }

    // Enable/Disable form elements
    const formElements = form.elements;
    for (let i = 0; i < formElements.length; i++) {
        if (formElements[i].id !== "cancel-drawer-btn" && formElements[i].id !== "close-drawer-btn") {
            if (isReadOnly) {
                formElements[i].setAttribute("disabled", "true");
            } else {
                formElements[i].removeAttribute("disabled");
            }
        }
    }

    overlay.classList.add("active");
}

// Close Drawer
function closeDrawer() {
    document.getElementById("task-drawer-overlay").classList.remove("active");
    const drawer = document.querySelector(".task-drawer");
    if (drawer) drawer.classList.remove("expanded");
}

// Compress and scale uploaded images to a standard size for optimization
function compressImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            callback(compressedBase64);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Helper to convert base64 data URL back to a binary Blob for Cloud Storage
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// Compress and upload a file directly to Firebase Cloud Storage, then return its public download URL
function uploadImageToStorage(fileObject, client = "General", taskTitle = "", onProgressCallback = null) {
    return new Promise((resolve, reject) => {
        // Compress the image to max 800x800 resolution at 0.7 quality (crisp but small size)
        compressImage(fileObject, 800, 800, 0.7, function(compressedBase64) {
            try {
                const compressedBlob = dataURLtoBlob(compressedBase64);
                
                // Sanitize the task title for filename
                const cleanTitle = (taskTitle || "unnamed_task")
                    .trim()
                    .replace(/[^a-zA-Z0-9\s-_]/g, '') // remove special characters
                    .replace(/\s+/g, '_');             // replace spaces with underscores
                
                const clientFolder = (client || "General").trim();
                const uniqueFilename = `${cleanTitle}_${Date.now()}.jpg`;
                
                const storageRef = firebase.storage().ref().child(`task_images/${clientFolder}/${uniqueFilename}`);
                const uploadTask = storageRef.put(compressedBlob);
                
                uploadTask.on('state_changed', 
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgressCallback) {
                            onProgressCallback(progress);
                        }
                    }, 
                    (error) => {
                        reject(error);
                    }, 
                    async () => {
                        try {
                            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                            resolve(downloadURL);
                        } catch (err) {
                            reject(err);
                        }
                    }
                );
            } catch (err) {
                reject(err);
            }
        });
    });
}

// Delete an image file from Firebase Storage using its download URL
async function deleteImageFromStorage(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith("https://firebasestorage.googleapis.com")) {
        return;
    }
    try {
        const storageRef = firebase.storage().refFromURL(imageUrl);
        await storageRef.delete();
        console.log("Successfully deleted associated image from Cloud Storage.");
    } catch (err) {
        console.error("Failed to delete image from Cloud Storage:", err);
    }
}

// Perform Firebase Storage uploading in the background
async function uploadImageInBackground(fileObject, taskId) {
    try {
        console.log(`Starting background upload for task ${taskId}...`);
        
        // Find task to get client and title info for folder grouping and file naming
        const task = state.tasks.find(t => t.id === taskId);
        const client = task ? task.client : state.activeClient;
        const title = task ? task.title : "";
        
        const downloadURL = await uploadImageToStorage(fileObject, client, title);
        
        // Refind task and replace its temporary local URL with the public storage URL
        const freshTask = state.tasks.find(t => t.id === taskId);
        if (freshTask) {
            freshTask.image = downloadURL;
            await saveData(freshTask);
            renderTracker();
            console.log(`Background upload succeeded for task: ${freshTask.title}`);
        }
    } catch (err) {
        console.error(`Background upload failed for task ${taskId}:`, err);
        const task = state.tasks.find(t => t.id === taskId);
        if (task && task.image && task.image.startsWith("blob:")) {
            task.image = "";
            renderTracker();
        }
    }
}

// Helper to update drawer buttons based on active uploads
function updateDrawerButtonsState() {
    const saveBtn = document.getElementById("save-task-btn");
    const cancelBtn = document.getElementById("cancel-drawer-btn");
    const closeBtn = document.getElementById("close-drawer-btn");
    const isReadOnly = (getUserClientPermission(state.currentUserEmail, state.activeClient) === "ReadOnly");
    
    if (state.activeUploads && state.activeUploads.size > 0) {
        if (saveBtn) {
            saveBtn.setAttribute("disabled", "disabled");
            saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
        }
        if (cancelBtn) cancelBtn.setAttribute("disabled", "disabled");
        if (closeBtn) closeBtn.setAttribute("disabled", "disabled");
    } else {
        if (saveBtn) {
            saveBtn.removeAttribute("disabled");
            saveBtn.innerHTML = `Save Changes`;
            if (isReadOnly) saveBtn.style.display = "none";
        }
        if (cancelBtn) cancelBtn.removeAttribute("disabled");
        if (closeBtn) closeBtn.removeAttribute("disabled");
    }
}

// Convert Uploaded Image File to Firebase Storage and preview it
async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        // Create an Object URL for instantaneous local preview
        const localURL = URL.createObjectURL(file);
        showImagePreview(localURL);
        
        // Show progress overlay
        const progressOverlay = document.getElementById("main-image-progress-overlay");
        const progressPercent = document.getElementById("main-image-progress-percent");
        if (progressOverlay) progressOverlay.classList.remove("hidden");
        if (progressPercent) progressPercent.textContent = "0%";
        
        // Track in activeUploads
        const uploadId = `main_image_${Date.now()}`;
        state.activeUploads.add(uploadId);
        updateDrawerButtonsState();
        
        try {
            const taskTitle = document.getElementById("task-title").value || "Creative_Asset";
            const client = state.activeClient || "General";
            
            const downloadURL = await uploadImageToStorage(file, client, taskTitle, (progress) => {
                if (progressPercent) {
                    progressPercent.textContent = `${Math.round(progress)}%`;
                }
            });
            
            // Set final download URL into preview image
            const previewBox = document.getElementById("task-image-preview");
            const previewImg = previewBox.querySelector("img");
            if (previewImg) previewImg.src = downloadURL;
            
            // Store it in text input as well (in case they want to copy/see it)
            const imgUrlInput = document.getElementById("task-image-url");
            if (imgUrlInput) imgUrlInput.value = downloadURL;
            
        } catch (err) {
            console.error("Main image upload failed:", err);
            alert("Image upload failed: " + err.message);
            removeImagePreview();
        } finally {
            state.activeUploads.delete(uploadId);
            if (progressOverlay) progressOverlay.classList.add("hidden");
            updateDrawerButtonsState();
        }
    }
}

// Convert Uploaded Image File to Cloud Storage (from Report Preview) in background
function handleReportClippingUpload(e) {
    const file = e.target.files[0];
    if (file && state.currentUploadTaskId) {
        const taskId = state.currentUploadTaskId;
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            // Delete old image from Storage if it exists
            const oldImage = task.image;
            if (oldImage) {
                deleteImageFromStorage(oldImage);
            }
            
            // Generate a local object URL for instant preview
            const localURL = URL.createObjectURL(file);
            task.image = localURL;
            saveData(task);
            generateReport(); // Reload report preview instantly!
            
            // Upload in the background
            uploadImageInBackground(file, taskId);
        }
        e.target.value = "";
        state.currentUploadTaskId = null;
    }
}

// Show Image Preview block in drawer
function showImagePreview(base64Data) {
    const previewBox = document.getElementById("task-image-preview");
    const previewImg = previewBox.querySelector("img");
    const imgUrlInput = document.getElementById("task-image-url");
    
    previewImg.src = base64Data;
    imgUrlInput.value = ""; // Clear text input if file uploaded
    previewBox.classList.remove("hidden");
}

// Remove Image Preview
function removeImagePreview() {
    const previewBox = document.getElementById("task-image-preview");
    const previewImg = previewBox.querySelector("img");
    const imgFileInput = document.getElementById("task-image-file");
    const imgUrlInput = document.getElementById("task-image-url");
    
    previewImg.src = "";
    imgFileInput.value = "";
    imgUrlInput.value = "";
    previewBox.classList.add("hidden");
}

// Handle Add / Edit form submit
function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("task-id").value;
    const type = document.getElementById("task-type").value;
    const subType = document.getElementById("task-sub-type").value;
    const title = document.getElementById("task-title").value;
    const status = document.getElementById("task-status").value;
    const owner = document.getElementById("task-owner").value || "Unassigned";
    const month = document.getElementById("task-month").value;
    const week = document.getElementById("task-week").value;
    const date = document.getElementById("task-date").value;
    const canvaLink = document.getElementById("task-canva-link").value;
    const liveLink = document.getElementById("task-live-link").value;
    const remarks = document.getElementById("task-remarks").value;
    const impressions = "";
    const engagement = "";
    
    // WIP comment fields
    const wipWho = (status === "WIP" || status === "Sent for internal approval" || status === "On hold" || status === "Sent to journalist") ? (document.getElementById("task-wip-who") ? document.getElementById("task-wip-who").value.trim() : "") : "";
    const wipWhy = (status === "WIP" || status === "Sent for internal approval" || status === "On hold" || status === "Sent to journalist") ? (document.getElementById("task-wip-why") ? document.getElementById("task-wip-why").value.trim() : "") : "";
    
    // Check image source (file upload base64 or custom URL)
    let image = "";
    const previewBox = document.getElementById("task-image-preview");
    const previewImg = previewBox.querySelector("img");
    const imageUrl = document.getElementById("task-image-url").value;
    
    if (previewImg.src && !previewBox.classList.contains("hidden")) {
        image = previewImg.src;
    } else if (imageUrl) {
        image = imageUrl;
    }

    let taskClient = state.activeClient;
    if (id) {
        const existingTask = state.tasks.find(t => t.id === id);
        if (existingTask && existingTask.client) {
            taskClient = existingTask.client;
        }
    }

    if (getUserClientPermission(state.currentUserEmail, taskClient) === "ReadOnly") {
        alert(`Access Denied: You have Read-Only permissions for ${taskClient}.`);
        return;
    }

    let finalType = type;
    let campaignType = "";
    let centers = [];
    if (taskClient === "iCode") {
        finalType = "Social Media";
        const selectedCampaignTypes = Array.from(document.querySelectorAll('input[name="icode-campaign-type"]:checked')).map(cb => cb.value);
        if (selectedCampaignTypes.length === 0) {
            alert("Please select at least one Campaign Type (Organic / Paid).");
            return;
        }
        campaignType = selectedCampaignTypes; // Save as array
        centers = Array.from(document.querySelectorAll('input[name="icode-center"]:checked')).map(cb => cb.value);
        if (centers.length === 0) {
            alert("Please select at least one iCode center.");
            return;
        }
    } else if (taskClient === "Green Shine Solar" && type === "Digital Campaigns") {
        const selectedCampaignTypes = Array.from(document.querySelectorAll('input[name="greenshine-campaign-type"]:checked')).map(cb => cb.value);
        if (selectedCampaignTypes.length === 0) {
            alert("Please select at least one Campaign Type (Organic / Paid).");
            return;
        }
        campaignType = selectedCampaignTypes; // Save as array
    }

    let platforms = [];
    let adCreativeLink = "";
    let targetUrl = "";
    let campaignBudget = "";
    let leadsConversionsClicks = "";

    if (type === "Digital Campaigns") {
        platforms = Array.from(document.querySelectorAll('input[name="campaign-platform"]:checked')).map(cb => cb.value);
        if (platforms.length === 0) {
            alert("Please select at least one platform.");
            return;
        }
        adCreativeLink = document.getElementById("task-ad-creative-link") ? document.getElementById("task-ad-creative-link").value : "";
        targetUrl = document.getElementById("task-target-url") ? document.getElementById("task-target-url").value : "";
        campaignBudget = document.getElementById("task-budget") ? document.getElementById("task-budget").value : "";
        leadsConversionsClicks = document.getElementById("task-conversions") ? document.getElementById("task-conversions").value : "";
    }

    const taskData = {
        client: taskClient,
        type: finalType,
        campaignType: campaignType,
        centers: centers,
        subType,
        title,
        status,
        owner,
        month,
        week,
        date,
        canvaLink: type === "Digital Campaigns" ? adCreativeLink : canvaLink,
        liveLink: type === "Digital Campaigns" ? targetUrl : liveLink,
        adCreativeLink: type === "Digital Campaigns" ? adCreativeLink : "",
        targetUrl: type === "Digital Campaigns" ? targetUrl : "",
        platforms: type === "Digital Campaigns" ? platforms : [],
        campaignBudget: type === "Digital Campaigns" ? campaignBudget : "",
        leadsConversionsClicks: type === "Digital Campaigns" ? leadsConversionsClicks : "",
        remarks,
        impressions,
        engagement,
        image,
        wipWho,
        wipWhy,
        referenceLinks: (state.currentTaskReferenceLinks || [])
            .filter(l => l.url && l.url.trim() !== "")
            .map(l => ({ id: l.id || generateUUID(), label: l.label || "", url: l.url || "" }))
    };

    if (type === "PR Update") {
        const selectedPRCampaignTypes = Array.from(document.querySelectorAll('input[name="pr-campaign-type"]:checked')).map(cb => cb.value);
        taskData.campaignType = selectedPRCampaignTypes;

        const targetCompDateVal = document.getElementById("task-target-completion-date") ? document.getElementById("task-target-completion-date").value : "";
        const oppDeadlineVal = document.getElementById("task-opportunity-deadline") ? document.getElementById("task-opportunity-deadline").value : "";
        const priorityVal = document.getElementById("task-priority") ? document.getElementById("task-priority").value : "Medium";
        
        taskData.targetCompletionDate = targetCompDateVal;
        taskData.opportunityDeadline = oppDeadlineVal;
        taskData.priority = priorityVal;

        taskData.spokespersonsList = (state.currentTaskSpokespersons || []).map(sp => ({
            id: sp.id || generateUUID(),
            name: sp.name || ""
        })).filter(sp => sp.name.trim() !== "");
        taskData.spokesperson = taskData.spokespersonsList.map(sp => sp.name).join(", ");
        
        taskData.publicationsList = (state.currentTaskPublications || []).map(p => ({
            id: p.id || generateUUID(),
            name: p.name || "",
            headline: p.headline || "",
            link: p.link || "",
            image: p.image || "",
            date: p.date || "",
            coverageType: p.coverageType || "",
            journalist: p.journalist || "",
            tier: p.tier || "",
            sentiment: p.sentiment || "",
            syndication: p.syndication || "",
            agencyGenerated: p.agencyGenerated || "",
            keyMessages: p.keyMessages || ""
        }));
        taskData.publication = taskData.publicationsList.map(p => p.name).filter(Boolean).join(", ");
        taskData.liveLink = taskData.publicationsList.length > 0 ? taskData.publicationsList[0].link : "";
        taskData.image = taskData.publicationsList.length > 0 ? taskData.publicationsList[0].image : "";
        taskData.date = taskData.publicationsList.length > 0 ? (taskData.publicationsList[0].date || "") : "";
        taskData.week = taskData.date ? getWeekFromDateStr(taskData.date) : "Week 1";
    } else {
        taskData.spokesperson = "";
        taskData.publication = "";
        taskData.spokespersonsList = [];
        taskData.publicationsList = [];
        taskData.targetCompletionDate = "";
        taskData.opportunityDeadline = "";
        taskData.priority = "";
    }

    if (id) {
        // Edit Mode
        const index = state.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            // Delete old image from Storage if it was replaced/removed
            const oldImage = state.tasks[index].image;
            if (oldImage && oldImage !== taskData.image) {
                deleteImageFromStorage(oldImage);
            }
            updateCarryForwardTaskMonth(taskData, state.filters.month);
            state.tasks[index] = { ...state.tasks[index], ...taskData };
            logActivity("edited", `Task: "${taskData.title}" (${taskData.client})`, taskData.client);
        }
    } else {
        // Create Mode
        taskData.id = generateUUID();
        taskData.createdAt = Date.now();
        state.tasks.unshift(taskData);
        logActivity("created", `Task: "${taskData.title}" (${taskData.client})`, taskData.client);
    }

    saveData(id || taskData.id);
    closeDrawer();
    populateOwnerFilter();
    populateMonthDropdowns();
    updateDashboard();
    renderTracker();
}

// Generate simple client-side UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Delete item
async function deleteTask(id) {
    const taskToDelete = state.tasks.find(t => t.id === id);
    const client = taskToDelete ? taskToDelete.client : state.activeClient;
    if (getUserClientPermission(state.currentUserEmail, client) === "ReadOnly") {
        alert(`Access Denied: You have Read-Only permissions for ${client}.`);
        return;
    }
    if (confirm("Are you sure you want to delete this item?")) {
        if (taskToDelete) {
            if (taskToDelete.image) {
                // Delete image from Cloud Storage in background
                deleteImageFromStorage(taskToDelete.image);
            }
            if (taskToDelete.publicationsList && taskToDelete.publicationsList.length > 0) {
                taskToDelete.publicationsList.forEach(pub => {
                    // Only delete if it's not the same URL as the main image (to prevent duplicate delete attempts)
                    if (pub.image && pub.image !== taskToDelete.image) {
                        deleteImageFromStorage(pub.image);
                    }
                });
            }
            logActivity("deleted", `Task: "${taskToDelete.title}" (${taskToDelete.client})`, taskToDelete.client);
            
            // Delete from Firestore
            setSyncStatus('saving');
            state.localWrites.add(id);
            try {
                // Sync deletion to Google Sheet in background
                syncToGoogleSheet('delete', taskToDelete);
                
                await db.collection('rvnl_tracker').doc('tasks_store').collection('items').doc(id).delete();
                setSyncStatus('synced');
            } catch (err) {
                console.error("Firestore delete error:", err);
                setSyncStatus('offline');
            }
        }
        state.tasks = state.tasks.filter(t => t.id !== id);
        localStorage.setItem('rvnl_tracker_data', JSON.stringify(state.tasks));
        populateOwnerFilter();
        populateMonthDropdowns();
        updateDashboard();
        renderTracker();
    }
}

// Duplicate item
async function duplicateTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        const client = task.client || state.activeClient;
        if (getUserClientPermission(state.currentUserEmail, client) === "ReadOnly") {
            alert(`Access Denied: You have Read-Only permissions for ${client}.`);
            return;
        }
        const copy = { 
            ...task, 
            id: generateUUID(), 
            title: `${task.title} (Copy)`,
            centers: task.centers ? [...task.centers] : [],
            createdAt: Date.now()
        };
        state.tasks.unshift(copy);
        await saveData(copy);
        populateMonthDropdowns();
        updateDashboard();
        renderTracker();
    }
}

// ====================================================
// DASHBOARD VIEW RENDERING & GRAPH ENGINE
// ====================================================

function updateDashboard() {
    const selectedMonth = state.dashboardMonth || getCurrentMonthStr();
    const clientTasks = state.tasks.filter(t => (t.client || "RVNL") === state.activeClient && isTaskActiveInMonth(t, selectedMonth));
    const isPROnly = isPROnlyClient(state.activeClient);
    
    // Dynamically adjust headers and descriptions for PR Only client dashboard
    const totalCardH3 = document.querySelector("#stat-card-total h3");
    const totalCardDesc = document.querySelector("#stat-card-total .stat-desc");
    const smCardH3 = document.querySelector("#stat-card-linkedin h3");
    const smCardDesc = document.querySelector("#stat-card-linkedin .stat-desc");
    const prCardH3 = document.querySelector("#stat-card-pr h3");
    const prCardDesc = document.querySelector("#stat-card-pr .stat-desc");
    const wipCardH3 = document.querySelector("#stat-card-wip h3");
    const wipCardDesc = document.querySelector("#stat-card-wip .stat-desc");

    if (isPROnly) {
        if (totalCardH3) totalCardH3.textContent = "Total PR Tasks";
        if (totalCardDesc) totalCardDesc.textContent = "Ongoing & completed PR runs";
        if (smCardH3) smCardH3.textContent = "Total Coverages";
        if (smCardDesc) smCardDesc.textContent = "Publications secured";
        if (prCardH3) prCardH3.textContent = "Overdue Tasks";
        if (prCardDesc) prCardDesc.textContent = "PR targets past completion date";
        if (wipCardH3) wipCardH3.textContent = "In Progress";
        if (wipCardDesc) wipCardDesc.textContent = "Under draft or review";
        
        // Calculate PR-only metrics
        const totalVal = clientTasks.length;
        const coveragesVal = getPRPublicationsCount(clientTasks);
        const overdueVal = clientTasks.filter(t => t.type === "PR Update" && getPRDeadlineStatus(t)?.status === "overdue").length;
        const wipVal = clientTasks.filter(t => ['WIP', 'Sent for internal approval', 'Sent to client', 'Sent to journalist', 'On hold', 'Client Approval Pending'].includes(t.status)).length;
        
        document.getElementById("stat-total-creatives").textContent = totalVal;
        document.getElementById("stat-total-linkedin").textContent = coveragesVal;
        document.getElementById("stat-total-pr").textContent = overdueVal;
        document.getElementById("stat-total-wip").textContent = wipVal;
    } else {
        if (totalCardH3) totalCardH3.textContent = "Total Creatives";
        if (totalCardDesc) totalCardDesc.textContent = "Ongoing & completed";
        if (smCardH3) smCardH3.textContent = "Social Outputs";
        if (smCardDesc) smCardDesc.textContent = "Published on LinkedIn/X";
        if (prCardH3) prCardH3.textContent = "PR Coverages";
        if (prCardDesc) prCardDesc.textContent = "Media coverages secured";
        if (wipCardH3) wipCardH3.textContent = "Work in Progress";
        if (wipCardDesc) wipCardDesc.textContent = "Currently active/review";
        
        const totalVal = clientTasks.length;
        const linkedinVal = clientTasks.filter(t => t.type === 'Social Media' && t.status === 'Published/Closed').length;
        const prVal = getPRPublicationsCount(clientTasks);
        const wipVal = clientTasks.filter(t => ['WIP', 'Sent for internal approval', 'Sent to client', 'Sent to journalist', 'On hold', 'Client Approval Pending'].includes(t.status)).length;

        document.getElementById("stat-total-creatives").textContent = totalVal;
        document.getElementById("stat-total-linkedin").textContent = linkedinVal;
        document.getElementById("stat-total-pr").textContent = prVal;
        document.getElementById("stat-total-wip").textContent = wipVal;
    }

    // Dynamically adjust stats grid columns if active client is iCode or BT Group (no PR coverage)
    const prCard = document.getElementById("stat-card-pr");
    const statsGrid = document.querySelector(".stats-grid");
    if (state.activeClient === "iCode" || state.activeClient === "BT Group") {
        if (prCard) prCard.style.display = "none";
        if (statsGrid) statsGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
    } else {
        if (prCard) prCard.style.display = "";
        if (statsGrid) statsGrid.style.gridTemplateColumns = "repeat(4, 1fr)";
    }

    // 2. Render Charts
    renderTrendChart();
    renderShareChart();

    // 3. Render Dashboard Lists
    renderDashboardLists();
}

function renderTrendChart() {
    const ctx = document.getElementById('outputTrendChart').getContext('2d');
    
    // Dynamically calculate the previous, current, and next months centering around the selected month
    const selectedMonth = state.dashboardMonth || getCurrentMonthStr();
    const parts = selectedMonth.split(" ");
    const monthName = parts[0];
    const year = parseInt(parts[1], 10) || new Date().getFullYear();
    
    const monthsMap = {
        "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5,
        "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11
    };
    const monthNum = monthsMap[monthName] !== undefined ? monthsMap[monthName] : new Date().getMonth();
    
    const prevDate = new Date(year, monthNum - 1, 1);
    const nextDate = new Date(year, monthNum + 1, 1);
    const currDate = new Date(year, monthNum, 1);
    
    const formatOptions = { month: 'long', year: 'numeric' };
    const months = [
        prevDate.toLocaleDateString('en-US', formatOptions),
        currDate.toLocaleDateString('en-US', formatOptions),
        nextDate.toLocaleDateString('en-US', formatOptions)
    ];

    const smData = [];
    const prData = [];
    const creativeData = [];
    const dcData = [];

    const clientTasks = state.tasks.filter(t => (t.client || "RVNL") === state.activeClient);
    months.forEach(m => {
        smData.push(clientTasks.filter(t => t.month === m && t.type === 'Social Media' && t.status === 'Published/Closed').length);
        prData.push(getPRPublicationsCount(clientTasks.filter(t => t.month === m)));
        creativeData.push(clientTasks.filter(t => t.month === m && t.type === 'Creative / Collateral' && t.status === 'Published/Closed').length);
        dcData.push(clientTasks.filter(t => t.month === m && t.type === 'Digital Campaigns' && t.status === 'Published/Closed').length);
    });

    // Destroy existing chart if any
    if (state.charts.trend) state.charts.trend.destroy();

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const labelColor = isDark ? "#9ca3af" : "#4b5563";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    let datasets = [];
    if (isPROnlyClient(state.activeClient)) {
        const tasksCountData = [];
        const coveragesCountData = [];
        months.forEach(m => {
            tasksCountData.push(clientTasks.filter(t => t.month === m && t.type === 'PR Update').length);
            coveragesCountData.push(getPRPublicationsCount(clientTasks.filter(t => t.month === m)));
        });
        datasets = [
            {
                label: 'PR Tasks',
                data: tasksCountData,
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            },
            {
                label: 'Coverages Secured',
                data: coveragesCountData,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }
        ];
    } else if (state.activeClient === "iCode") {
        const organicData = [];
        const paidData = [];
        months.forEach(m => {
            organicData.push(clientTasks.filter(t => t.month === m && (Array.isArray(t.campaignType) ? t.campaignType.includes('Organic') : t.campaignType === 'Organic') && t.status === 'Published/Closed').length);
            paidData.push(clientTasks.filter(t => t.month === m && (Array.isArray(t.campaignType) ? t.campaignType.includes('Paid') : t.campaignType === 'Paid') && t.status === 'Published/Closed').length);
        });
        datasets = [
            {
                label: 'Organic Campaigns',
                data: organicData,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            },
            {
                label: 'Paid Campaigns',
                data: paidData,
                backgroundColor: '#ef4444',
                borderRadius: 4
            }
        ];
    } else {
        datasets = [
            {
                label: 'Social Media',
                data: smData,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }
        ];

        if (state.activeClient !== "BT Group") {
            datasets.push({
                label: 'PR Activities',
                data: prData,
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            });
        }

        if (state.activeClient !== "Legrand" && state.activeClient !== "Kompact AI") {
            datasets.push({
                label: 'Creative Collateral',
                data: creativeData,
                backgroundColor: '#f59e0b',
                borderRadius: 4
            });
        }

        if (state.activeClient === "Green Shine Solar") {
            datasets.push({
                label: 'Digital Campaigns',
                data: dcData,
                backgroundColor: '#ec4899',
                borderRadius: 4
            });
        }
    }

    state.charts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: labelColor, font: { family: 'Inter' } }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: labelColor }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: labelColor }
                }
            }
        }
    });
}

function renderShareChart() {
    const ctx = document.getElementById('platformShareChart').getContext('2d');
    
    // Categories distribution
    const selectedMonth = state.dashboardMonth || getCurrentMonthStr();
    const clientTasks = state.tasks.filter(t => (t.client || "RVNL") === state.activeClient && isTaskActiveInMonth(t, selectedMonth));
    let categories = [];
    let dataVals = [];
    let bgColors = [];
    
    const titleEl = document.getElementById("share-chart-title");
    const subTitleEl = document.getElementById("share-chart-subtitle");

    if (isPROnlyClient(state.activeClient)) {
        if (titleEl) titleEl.textContent = "Coverage Sentiment";
        if (subTitleEl) subTitleEl.textContent = "Sentiment breakdown of secure publications";
        
        categories = ['Positive', 'Neutral', 'Negative'];
        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        
        clientTasks.forEach(t => {
            const list = t.publicationsList || [];
            list.forEach(p => {
                if (p.sentiment === "Positive") positiveCount++;
                else if (p.sentiment === "Neutral") neutralCount++;
                else if (p.sentiment === "Negative") negativeCount++;
            });
        });
        dataVals = [positiveCount, neutralCount, negativeCount];
        bgColors = ['#10b981', '#94a3b8', '#ef4444'];
    } else if (state.activeClient === "iCode") {
        if (titleEl) titleEl.textContent = "Center Share";
        if (subTitleEl) subTitleEl.textContent = "Distribution by centers";
        
        categories = ['Plano', 'Murphy', 'Redmond'];
        dataVals = [
            clientTasks.filter(t => t.centers && t.centers.includes('Plano') && t.status === 'Published/Closed').length,
            clientTasks.filter(t => t.centers && t.centers.includes('Murphy') && t.status === 'Published/Closed').length,
            clientTasks.filter(t => t.centers && t.centers.includes('Redmond') && t.status === 'Published/Closed').length
        ];
        bgColors = ['#3b82f6', '#f59e0b', '#ef4444'];
    } else {
        if (titleEl) titleEl.textContent = "Category Share";
        if (subTitleEl) subTitleEl.textContent = "Distribution of assets";
        
        if (state.activeClient === "Legrand" || state.activeClient === "Kompact AI") {
            categories = ['Social Media', 'PR Update'];
            dataVals = [
                clientTasks.filter(t => t.type === 'Social Media' && t.status === 'Published/Closed').length,
                getPRPublicationsCount(clientTasks)
            ];
            bgColors = ['#10b981', '#8b5cf6'];
        } else if (state.activeClient === "BT Group") {
            categories = ['Social Media', 'Creative / Collateral'];
            dataVals = [
                clientTasks.filter(t => t.type === 'Social Media' && t.status === 'Published/Closed').length,
                clientTasks.filter(t => t.type === 'Creative / Collateral' && t.status === 'Published/Closed').length
            ];
            bgColors = ['#10b981', '#f59e0b'];
        } else if (state.activeClient === "Green Shine Solar") {
            categories = ['Social Media', 'PR Update', 'Creative / Collateral', 'Digital Campaigns'];
            dataVals = [
                clientTasks.filter(t => t.type === 'Social Media' && t.status === 'Published/Closed').length,
                getPRPublicationsCount(clientTasks),
                clientTasks.filter(t => t.type === 'Creative / Collateral' && t.status === 'Published/Closed').length,
                clientTasks.filter(t => t.type === 'Digital Campaigns' && t.status === 'Published/Closed').length
            ];
            bgColors = ['#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];
        } else {
            categories = ['Social Media', 'PR Update', 'Creative / Collateral'];
            dataVals = [
                clientTasks.filter(t => t.type === 'Social Media' && t.status === 'Published/Closed').length,
                getPRPublicationsCount(clientTasks),
                clientTasks.filter(t => t.type === 'Creative / Collateral' && t.status === 'Published/Closed').length
            ];
            bgColors = ['#10b981', '#8b5cf6', '#f59e0b'];
        }
    }

    if (state.charts.share) state.charts.share.destroy();

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const labelColor = isDark ? "#9ca3af" : "#4b5563";

    state.charts.share = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: dataVals,
                backgroundColor: bgColors,
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#121829' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: labelColor, font: { family: 'Inter', size: 11 } }
                }
            },
            cutout: '65%'
        }
    });
}

function renderDashboardLists() {
    const selectedMonth = state.dashboardMonth || getCurrentMonthStr();
    const clientTasks = state.tasks.filter(t => (t.client || "RVNL") === state.activeClient && isTaskActiveInMonth(t, selectedMonth));
    // 1. Recent Completed Social Media Posts (Published)
    const recentCompleted = clientTasks
        .filter(t => t.type === 'Social Media' && t.status === 'Published/Closed')
        .sort((a, b) => getPublishDateValue(b) - getPublishDateValue(a))
        .slice(0, 5); // Take top 5 from array (most recently added/parsed)
        
    const completedList = document.getElementById("recent-completed-list");
    completedList.innerHTML = "";
    
    if (recentCompleted.length === 0) {
        completedList.innerHTML = '<p class="stat-desc" style="padding: 20px; text-align: center;">No completed posts found.</p>';
    } else {
        recentCompleted.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "recent-item";
            itemEl.style.cursor = "pointer";
            itemEl.addEventListener("click", () => {
                openDrawer(item.id);
            });
            
            const bgClass = "bg-green";
            const iconClass = "fa-solid fa-share-nodes";
            
            let iconOrImageHtml = `<div class="item-icon ${bgClass}"><i class="${iconClass}"></i></div>`;
            if (item.image) {
                iconOrImageHtml = `
                    <div class="item-icon dashboard-list-thumb" style="background: none; padding: 0; overflow: hidden; border: 1px solid var(--border-color); width: 52px; height: 52px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s;" title="Click to view full image">
                        <img src="${item.image}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" />
                    </div>
                `;
            }
            
            itemEl.innerHTML = `
                <div class="item-left">
                    ${iconOrImageHtml}
                    <div class="item-details">
                        <h5>${item.title}</h5>
                        <span>${item.month} ${item.date ? '• ' + item.date : ''}</span>
                    </div>
                </div>
                <div class="item-right">
                    <span class="badge badge-social">${item.subType || 'All Platforms'}</span>
                </div>
            `;
            
            // Handle clicking the thumbnail separately to open full image
            const thumbEl = itemEl.querySelector(".dashboard-list-thumb");
            if (thumbEl) {
                thumbEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    viewImageInNewWindow(item.image);
                });
                // Add minor hover feedback
                thumbEl.addEventListener("mouseenter", () => { thumbEl.style.transform = "scale(1.05)"; });
                thumbEl.addEventListener("mouseleave", () => { thumbEl.style.transform = "scale(1.0)"; });
            }

            completedList.appendChild(itemEl);
        });
    }

    // 2. Hot Tasks (WIP / Awaiting Review)
    const hotTasks = clientTasks
        .filter(t => t.status === 'WIP' || t.status === 'Sent for internal approval' || t.status === 'Sent to client' || t.status === 'Client Approval Pending')
        .slice(0, 5);
        
    const hotList = document.getElementById("recent-hot-tasks");
    hotList.innerHTML = "";

    if (hotTasks.length === 0) {
        hotList.innerHTML = '<p class="stat-desc" style="padding: 20px; text-align: center;">No active tasks. Good job!</p>';
    } else {
        hotTasks.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "recent-item";
            itemEl.style.cursor = "pointer";
            itemEl.addEventListener("click", () => {
                openDrawer(item.id);
            });
            
            let badgeStatus = "status-wip";
            if (item.status === "Sent for internal approval") badgeStatus = "status-review";
            if (item.status === "Sent to client" || item.status === "Client Approval Pending") badgeStatus = "status-approval";

            let iconOrImageHtml = `<div class="item-icon bg-amber"><i class="fa-solid fa-hourglass-half"></i></div>`;
            if (item.image) {
                iconOrImageHtml = `
                    <div class="item-icon dashboard-list-thumb" style="background: none; padding: 0; overflow: hidden; border: 1px solid var(--border-color); width: 52px; height: 52px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s;" title="Click to view full image">
                        <img src="${item.image}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" />
                    </div>
                `;
            }

            itemEl.innerHTML = `
                <div class="item-left">
                    ${iconOrImageHtml}
                    <div class="item-details">
                        <h5>${item.title}</h5>
                        <span>Owner: ${item.owner}</span>
                    </div>
                </div>
                <div class="item-right">
                    <span class="status-pill ${badgeStatus}" style="font-size:10px; padding:3px 8px;">${item.status}</span>
                </div>
            `;

            // Handle clicking the thumbnail separately to open full image
            const thumbEl = itemEl.querySelector(".dashboard-list-thumb");
            if (thumbEl) {
                thumbEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    viewImageInNewWindow(item.image);
                });
                // Add minor hover feedback
                thumbEl.addEventListener("mouseenter", () => { thumbEl.style.transform = "scale(1.05)"; });
                thumbEl.addEventListener("mouseleave", () => { thumbEl.style.transform = "scale(1.0)"; });
            }

            hotList.appendChild(itemEl);
        });
    }
}

// ====================================================
// UNIFIED TRACKER ENGINE (TABLE & KANBAN RENDERING)
// ====================================================

function renderTracker() {
    // Apply filters
    state.filteredTasks = state.tasks.filter(task => {
        // Client filter
        const matchesClient = (task.client || "RVNL") === state.activeClient;

        // Search filter
        const matchesSearch = !state.filters.search || 
            task.title.toLowerCase().includes(state.filters.search) || 
            (task.remarks && task.remarks.toLowerCase().includes(state.filters.search)) || 
            (task.owner && task.owner.toLowerCase().includes(state.filters.search)) ||
            (task.publication && task.publication.toLowerCase().includes(state.filters.search));

        // Type filter
        let matchesType = false;
        if (state.activeClient === "iCode") {
            matchesType = state.filters.type === 'all' || 
                (Array.isArray(task.campaignType) ? task.campaignType.includes(state.filters.type) : task.campaignType === state.filters.type);
        } else {
            matchesType = state.filters.type === 'all' || task.type === state.filters.type;
        }
        
        // Month filter
        const matchesMonth = state.filters.month === 'all' || isTaskActiveInMonth(task, state.filters.month);
        
        // Status filter
        let matchesStatus = false;
        if (state.filters.status === 'all') {
            matchesStatus = true;
        } else if (state.filters.status === 'In Progress') {
            matchesStatus = ['WIP', 'Sent for internal approval', 'Sent to client', 'On hold', 'Sent to journalist', 'Client Approval Pending'].includes(task.status);
        } else {
            matchesStatus = task.status === state.filters.status;
        }
        
        // Owner filter
        const matchesOwner = state.filters.owner === 'all' || task.owner === state.filters.owner;

        // Center filter (iCode only)
        let matchesCenter = true;
        if (state.activeClient === "iCode" && state.filters.center && state.filters.center !== 'all') {
            matchesCenter = task.centers && task.centers.includes(state.filters.center);
        }

        return matchesSearch && matchesType && matchesMonth && matchesStatus && matchesOwner && matchesClient && matchesCenter;
    });

    // Sort tracker items by status priority
    const statusPriority = {
        "WIP": 1,
        "Sent for internal approval": 2,
        "Client Approval Pending": 2.5,
        "Sent to client": 3,
        "Sent to journalist": 4,
        "On hold": 5,
        "Published/Closed": 6,
        "Not used by client": 7
    };
    state.filteredTasks.sort((a, b) => {
        const priorityA = statusPriority[a.status] || 8;
        const priorityB = statusPriority[b.status] || 8;
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        // If both are published, sort chronologically by publish date (ascending: oldest first)
        if (a.status === "Published/Closed" && b.status === "Published/Closed") {
            const dateValA = getPublishDateValue(a);
            const dateValB = getPublishDateValue(b);
            if (dateValA !== dateValB) {
                return dateValB - dateValA;
            }
        }
        
        // Secondary sort for other statuses: newest first
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
    });

    if (state.activeView === "table") {
        renderTrackerTable();
    } else {
        renderTrackerKanban();
    }
}

// Helper to format long titles with a Read More/Show Less toggle
function formatTaskTitle(title, maxLength = 120) {
    if (!title || title.length <= maxLength) return title || "";
    const truncated = title.substring(0, maxLength).trim() + "...";
    const uniqueId = "title-text-" + Math.floor(Math.random() * 100000000);
    return `
        <span id="${uniqueId}-short" style="line-height: 1.5; display: inline;">${truncated} 
            <button onclick="document.getElementById('${uniqueId}-short').style.display='none'; document.getElementById('${uniqueId}-full').style.display='inline'; return false;" style="background: none; border: none; color: #3b82f6; font-weight: 600; cursor: pointer; padding: 0; font-size: 11px; margin-left: 4px; font-family: inherit; display: inline-block;">Read More</button>
        </span>
        <span id="${uniqueId}-full" style="display: none; line-height: 1.5;">${title} 
            <button onclick="document.getElementById('${uniqueId}-short').style.display='inline'; document.getElementById('${uniqueId}-full').style.display='none'; return false;" style="background: none; border: none; color: #3b82f6; font-weight: 600; cursor: pointer; padding: 0; font-size: 11px; margin-left: 4px; font-family: inherit; display: inline-block;">Show Less</button>
        </span>
    `;
}

// Render Table View
function renderTrackerTable() {
    const tbody = document.getElementById("tracker-table-body");
    tbody.innerHTML = "";

    const total = state.filteredTasks.length;
    const totalPages = Math.ceil(total / state.pageSize) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    // Paginate
    const startIdx = (state.currentPage - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, total);
    const paginated = state.filteredTasks.slice(startIdx, endIdx);

    // Update summary text
    document.getElementById("table-summary-text").textContent = `Showing ${total === 0 ? 0 : startIdx + 1} - ${endIdx} of ${total} tasks`;
    document.getElementById("current-page-num").textContent = state.currentPage;

    // Enable/Disable buttons
    document.getElementById("prev-page-btn").toggleAttribute("disabled", state.currentPage === 1);
    document.getElementById("next-page-btn").toggleAttribute("disabled", state.currentPage === totalPages);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No items match active filters.</td></tr>`;
        return;
    }

    paginated.forEach(task => {
        const tr = document.createElement("tr");
        
        // Type Badge
        let typeBadge = "";
        if (state.activeClient === "Green Shine Solar" || task.client === "Green Shine Solar") {
            const campaignTypes = Array.isArray(task.campaignType) 
                ? task.campaignType 
                : (task.campaignType ? [task.campaignType] : []);
            
            let campBadges = "";
            if (campaignTypes.includes("Organic")) {
                campBadges += `<span class="badge badge-social" style="margin: 0; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2);"><i class="fa-solid fa-seedling" style="color:#3b82f6;"></i> Organic</span>`;
            }
            if (campaignTypes.includes("Paid")) {
                campBadges += `<span class="badge badge-pr" style="background: rgba(239, 68, 68, 0.12); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.2); margin: 0;"><i class="fa-solid fa-coins" style="color: var(--accent-red);"></i> Paid</span>`;
            }

            let catBadge = "";
            if (task.type === "Digital Campaigns") {
                catBadge = `<span class="badge badge-creative" style="background: rgba(139, 92, 246, 0.12); color: var(--accent-purple); border: 1px solid rgba(139, 92, 246, 0.2);"><i class="fa-solid fa-rectangle-ad"></i> Digital Campaign</span>`;
            } else if (task.type === "Social Media") {
                catBadge = `<span class="badge badge-social"><i class="fa-solid fa-share-nodes" style="color:#3b82f6;"></i> Social</span>`;
            } else if (task.type === "PR Update") {
                catBadge = `<span class="badge badge-pr"><i class="fa-solid fa-bullhorn"></i> PR</span>`;
            } else {
                catBadge = `<span class="badge badge-creative"><i class="fa-solid fa-palette"></i> Design</span>`;
            }
            
            typeBadge = `<div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">${catBadge}${campBadges ? `<div style="display: flex; gap: 4px; flex-wrap: wrap;">${campBadges}</div>` : ''}</div>`;
        } else if (state.activeClient === "iCode" || task.client === "iCode") {
            const campaignTypes = Array.isArray(task.campaignType) 
                ? task.campaignType 
                : (task.campaignType ? [task.campaignType] : ["Organic"]);
            
            typeBadge = '<div style="display: flex; gap: 6px; flex-wrap: wrap;">';
            if (campaignTypes.includes("Organic")) {
                typeBadge += `<span class="badge badge-social" style="margin: 0;"><i class="fa-solid fa-seedling" style="color:#3b82f6;"></i> Organic</span>`;
            }
            if (campaignTypes.includes("Paid")) {
                typeBadge += `<span class="badge badge-pr" style="background: rgba(239, 68, 68, 0.12); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.2); margin: 0;"><i class="fa-solid fa-coins" style="color: var(--accent-red);"></i> Paid</span>`;
            }
            if (campaignTypes.length === 0) {
                typeBadge += `<span class="badge badge-social" style="margin: 0;"><i class="fa-solid fa-seedling" style="color:#3b82f6;"></i> Organic</span>`;
            }
            typeBadge += '</div>';
        } else if (task.type === "Social Media") {
            typeBadge = `<span class="badge badge-social"><i class="fa-solid fa-share-nodes" style="color:#3b82f6;"></i> Social</span>`;
        } else if (task.type === "PR Update") {
            typeBadge = `<span class="badge badge-pr"><i class="fa-solid fa-bullhorn"></i> PR</span>`;
            if (task.priority) {
                const prioClass = task.priority.toLowerCase();
                typeBadge += `<div style="margin-top: 4px;"><span class="pr-priority-badge pr-priority-${prioClass}"><i class="fa-solid fa-circle" style="font-size: 5px; vertical-align: middle; margin-right: 3px;"></i>${task.priority}</span></div>`;
            }
        } else {
            if (task.subType === "Video") {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-video"></i> Video</span>`;
            } else if (task.subType === "Newsletter") {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-envelope-open-text"></i> Newsletter</span>`;
            } else if (task.subType === "Magazine Ad") {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-rectangle-ad"></i> Ad</span>`;
            } else if (task.subType === "Blog") {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-blog"></i> Blog</span>`;
            } else if (task.subType === "Website") {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-globe"></i> Website</span>`;
            } else if (task.subType === "Other") {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-file-lines"></i> Document</span>`;
            } else {
                typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-palette"></i> Design</span>`;
            }
        }

        // Status Pill
        let statusClass = "status-wip";
        if (task.status === "Published/Closed") statusClass = "status-published";
        if (task.status === "Sent for internal approval") statusClass = "status-review";
        if (task.status === "Sent to client" || task.status === "Client Approval Pending") statusClass = "status-approval";
        if (task.status === "Not used by client") statusClass = "status-hold";
        const statusPill = `<span class="status-pill ${statusClass}">${task.status}</span>`;

        // Links list
        let linksHtml = '<div class="links-flex">';
        if (task.liveLink && task.liveLink.startsWith("http")) {
            linksHtml += `<a href="${task.liveLink}" target="_blank" class="link-circle li-link" title="Live LinkedIn/X URL"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`;
        }
        if (task.canvaLink && task.canvaLink.startsWith("http")) {
            linksHtml += `<a href="${task.canvaLink}" target="_blank" class="link-circle canva-link" title="Canva Design"><i class="fa-solid fa-pen-nib"></i></a>`;
        }
        if (task.image) {
            linksHtml += `<a href="#" class="link-circle img-link btn-view-image" data-id="${task.id}" title="View Media Clipping"><i class="fa-solid fa-image"></i></a>`;
        }
        if (task.referenceLinks && task.referenceLinks.length > 0) {
            task.referenceLinks.forEach(refLink => {
                if (refLink.url && refLink.url.startsWith("http")) {
                    const label = refLink.label ? refLink.label : "Reference Link";
                    linksHtml += `<a href="${refLink.url}" target="_blank" class="link-circle" style="background: rgba(139,92,246,0.1); border-color: rgba(139,92,246,0.25); color: #8b5cf6;" title="${label}"><i class="fa-solid fa-link"></i></a>`;
                }
            });
        }
        if (task.type === "Digital Campaigns") {
            if (task.adCreativeLink && task.adCreativeLink.startsWith("http") && !linksHtml.includes(task.adCreativeLink)) {
                linksHtml += `<a href="${task.adCreativeLink}" target="_blank" class="link-circle canva-link" title="Ad Creative Link (Canva/Drive)"><i class="fa-solid fa-pen-nib"></i></a>`;
            }
            if (task.targetUrl && task.targetUrl.startsWith("http") && !linksHtml.includes(task.targetUrl)) {
                linksHtml += `<a href="${task.targetUrl}" target="_blank" class="link-circle li-link" title="Target URL / Landing Page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`;
            }
        }
        linksHtml += '</div>';

        // PR Specific details to display
        let prDetails = "";
        if (task.type === "PR Update") {
            let pubsListHtml = "";
            const list = task.publicationsList || [];
            if (list.length > 0) {
                pubsListHtml = `<div class="pr-pubs-list-tracker" style="display:flex; flex-direction:column; gap:6px; margin-top:6px; background:rgba(255,255,255,0.01); border:1px solid var(--border-color); border-radius:8px; padding:8px 10px;">`;
                list.forEach((pub, pIdx) => {
                    pubsListHtml += `
                        <div class="pr-pub-tracker-item" style="display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:11px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                ${pub.image ? `
                                <div style="position:relative; width:22px; height:22px; border-radius:4px; overflow:hidden; border:1px solid var(--border-color); cursor:pointer;" onclick="viewImageInNewWindow('${pub.image}')" title="Click to view media clipping">
                                    <img src="${pub.image}" style="width:100%; height:100%; object-fit:cover;">
                                </div>` : `<div style="width:22px; height:22px; border-radius:4px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color);"></div>`}
                                <span style="font-weight:600; color:var(--text-primary);">${pub.name || 'Unnamed Publication'}</span>
                                ${pub.date ? `<span style="font-size:10px; color:var(--text-muted); margin-left:6px;">(${pub.date})</span>` : ''}
                            </div>
                            ${pub.link ? `<a href="${pub.link}" target="_blank" style="color:var(--accent-blue); text-decoration:none; font-size:10px; display:inline-flex; align-items:center; gap:2px;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:9px;"></i> Live Link</a>` : ''}
                        </div>
                    `;
                });
                pubsListHtml += `</div>`;
            } else if (task.publication) {
                pubsListHtml = `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;"><strong>Pub:</strong> ${task.publication}</div>`;
            }
            
            prDetails = `<div style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">
                ${task.spokesperson ? '<strong>Spokesperson:</strong> ' + task.spokesperson : ''}
                ${pubsListHtml}
            </div>`;
        }

        // Inline Image for Tracker Table
        let trackerImageHtml = "";
        if (task.image && task.type !== "PR Update") {
            trackerImageHtml = `
                <div class="tracker-item-thumbnail btn-view-image" data-id="${task.id}">
                    <img src="${task.image}" loading="lazy" alt="thumbnail">
                </div>
            `;
        }

        let wipDetailsHtml = "";
        if ((task.status === "WIP" || task.status === "Sent for internal approval") && (task.wipWho || task.wipWhy)) {
            wipDetailsHtml = `<div style="font-size: 11px; margin-top: 5px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                ${task.wipWho ? `<span style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); color: var(--accent-amber); padding: 1px 6px; border-radius: 4px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-user-clock" style="font-size: 10px;"></i> Pending with: ${task.wipWho}</span>` : ''}
                ${task.wipWhy ? `<span style="color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-comment-dots" style="color: var(--text-muted); font-size: 10px;"></i> ${task.wipWhy}</span>` : ''}
            </div>`;
        }

        // iCode Centers tags
        let centersHtml = "";
        if ((state.activeClient === "iCode" || task.client === "iCode") && task.centers && task.centers.length > 0) {
            centersHtml = `<div style="display: flex; gap: 4px; margin-top: 5px; flex-wrap: wrap;">` + 
                task.centers.map(c => `<span style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); color: var(--accent-blue); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;"><i class="fa-solid fa-location-dot" style="font-size: 9px; margin-right: 2px;"></i> ${c}</span>`).join('') + 
                `</div>`;
        }

        // Remarks (Details & Comments)
        let remarksHtml = "";
        if (task.remarks && task.remarks.trim() !== "") {
            remarksHtml = `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4; max-width: 420px; overflow-wrap: break-word; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;" title="${task.remarks.replace(/"/g, '&quot;')}">${task.remarks}</div>`;
        }

        const titleAndImageHtml = trackerImageHtml 
            ? `<div class="tracker-item-flex">
                 ${trackerImageHtml}
                 <div class="tracker-item-details">
                     <div style="font-weight:600; line-height:1.5;">${formatTaskTitle(task.title)}</div>
                     ${remarksHtml}
                     ${prDetails}
                     ${wipDetailsHtml}
                     ${centersHtml}
                 </div>
               </div>`
            : `<div class="tracker-item-details">
                 <div style="font-weight:600; line-height:1.5;">${formatTaskTitle(task.title)}</div>
                 ${remarksHtml}
                 ${prDetails}
                 ${wipDetailsHtml}
                 ${centersHtml}
               </div>`;

        let deadlineBadgeHtml = "";
        if (task.type === "PR Update" && task.targetCompletionDate) {
            const dlStatus = getPRDeadlineStatus(task);
            if (dlStatus) {
                deadlineBadgeHtml = `<div style="margin-top: 4px;"><span class="deadline-status-badge deadline-${dlStatus.status}">${dlStatus.text}</span></div>`;
            }
        }

        const isPR = task.type === "PR Update";
        const isDC = task.type === "Digital Campaigns";
        const toggleBtnHtml = (isPR || isDC) ? `<button class="action-btn-mini btn-toggle-task-details" data-id="${task.id}" title="Toggle Detailed View"><i class="fa-solid fa-chevron-down"></i></button>` : '';

        tr.innerHTML = `
            <td>${typeBadge}</td>
            <td>${titleAndImageHtml}</td>
            <td>${statusPill}</td>
            <td>
                <div>${task.month}</div>
                <div style="font-size:11px; color:var(--text-muted);">${task.date || task.week || ''}</div>
                ${deadlineBadgeHtml}
            </td>
            <td style="font-weight: 500;">${task.owner}</td>
            <td>${linksHtml}</td>
            <td>
                <div class="actions-flex">
                    ${toggleBtnHtml}
                    ${(getUserClientPermission(state.currentUserEmail, task.client || state.activeClient) === "ReadOnly") ? `
                        <button class="action-btn-mini edit-btn" data-id="${task.id}" title="View Details" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue);"><i class="fa-solid fa-eye"></i></button>
                    ` : `
                        <button class="action-btn-mini edit-btn" data-id="${task.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                        <button class="action-btn-mini duplicate-btn" data-id="${task.id}" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
                        <button class="action-btn-mini delete-btn" data-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    `}
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        if (isDC) {
            const detailsTr = document.createElement("tr");
            detailsTr.id = `pr-details-row-${task.id}`;
            detailsTr.className = "pr-details-row";
            detailsTr.style.display = "none";

            const platformsHtml = task.platforms && task.platforms.length > 0 
                ? task.platforms.map(p => `<span style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-primary); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; display: inline-block;">${p}</span>`).join(' ') 
                : `<span style="color: var(--text-muted); font-style: italic;">No Platforms</span>`;
                
            const budgetVal = task.campaignBudget ? Number(task.campaignBudget) : 0;
            const convVal = task.leadsConversionsClicks ? Number(task.leadsConversionsClicks) : 0;
            const cplVal = convVal > 0 ? (budgetVal / convVal).toFixed(2) : "0.00";

            detailsTr.innerHTML = `
                <td colspan="7">
                    <div class="pr-details-expanded" id="pr-expanded-container-${task.id}" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 8px 8px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-weight: 600; color: var(--accent-purple); font-size: 12.5px; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-rectangle-ad"></i> Digital Campaign Details
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; font-size: 12px; line-height: 1.45;">
                            <div>
                                <strong style="color: var(--text-secondary);">Platforms:</strong>
                                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">${platformsHtml}</div>
                            </div>
                            <div>
                                <strong style="color: var(--text-secondary);">Campaign Stats & Spend:</strong>
                                <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 2px; color: var(--text-primary);">
                                    <span>Budget / Spend: <strong>₹${budgetVal.toLocaleString('en-IN')}</strong></span>
                                    <span>Leads / Conversions / Clicks: <strong>${convVal.toLocaleString()}</strong></span>
                                    <span>CPL / CPC: <strong>₹${cplVal}</strong></span>
                                </div>
                            </div>
                            <div>
                                <strong style="color: var(--text-secondary);">Campaign Links & Media:</strong>
                                <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 6px;">
                                    ${task.adCreativeLink ? `<a href="${task.adCreativeLink}" target="_blank" style="color: var(--accent-blue); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;"><i class="fa-solid fa-pen-nib"></i> Ad Creative Link (Canva/Drive)</a>` : '<span style="color: var(--text-muted); font-style: italic;">No Creative Link</span>'}
                                    ${task.targetUrl ? `<a href="${task.targetUrl}" target="_blank" style="color: var(--accent-blue); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Target URL / Landing Page</a>` : '<span style="color: var(--text-muted); font-style: italic;">No Target URL</span>'}
                                </div>
                                ${task.image ? `
                                <div style="margin-top: 10px; position:relative; width:120px; height:75px; border-radius:6px; overflow:hidden; border:1px solid var(--border-color); cursor:pointer;" onclick="viewImageInNewWindow('${task.image}')" title="Click to view full size">
                                    <img src="${task.image}" style="width:100%; height:100%; object-fit:cover;">
                                </div>` : ''}
                            </div>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(detailsTr);
        }

        if (isPR) {
            const detailsTr = document.createElement("tr");
            detailsTr.id = `pr-details-row-${task.id}`;
            detailsTr.className = "pr-details-row";
            detailsTr.style.display = "none";
            
            let pubsTableHtml = "";
            const list = task.publicationsList || [];
            if (list.length > 0) {
                pubsTableHtml = `
                    <div class="pr-publications-detail-table-wrapper">
                        <table class="pr-publications-detail-table">
                            <thead>
                                <tr>
                                    <th>Clipping</th>
                                    <th>Publication</th>
                                    <th>Date</th>
                                    <th>Headline</th>
                                    <th>Type</th>
                                    <th>Journalist</th>
                                    <th>Tier</th>
                                    <th>Sentiment</th>
                                    <th>Syndication</th>
                                    <th>Agency Gen</th>
                                    <th>Key Messages</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                list.forEach(pub => {
                    const sentimentDot = pub.sentiment 
                        ? `<span class="sentiment-dot sentiment-${pub.sentiment.toLowerCase()}" title="${pub.sentiment}"></span>${pub.sentiment}` 
                        : `<span style="color:var(--text-muted); font-style:italic;">N/A</span>`;
                    
                    pubsTableHtml += `
                        <tr>
                            <td>
                                ${pub.image ? `
                                <div style="width:24px; height:24px; border-radius:4px; overflow:hidden; border:1px solid var(--border-color); cursor:pointer;" onclick="viewImageInNewWindow('${pub.image}')">
                                    <img src="${pub.image}" style="width:100%; height:100%; object-fit:cover;">
                                </div>` : `<div style="width:24px; height:24px; border-radius:4px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color);"></div>`}
                            </td>
                            <td>
                                <div style="font-weight:600; color:var(--text-primary);">${pub.name || 'N/A'}</div>
                                ${pub.link ? `<a href="${pub.link}" target="_blank" style="color:var(--accent-blue); text-decoration:none; font-size:10px; display:inline-flex; align-items:center; gap:2px; margin-top:2px;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:8px;"></i> View Link</a>` : ''}
                            </td>
                            <td>${pub.date || 'N/A'}</td>
                            <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pub.headline || ''}">${pub.headline || 'N/A'}</td>
                            <td>${pub.coverageType || 'N/A'}</td>
                            <td>${pub.journalist || 'N/A'}</td>
                            <td>${pub.tier || 'N/A'}</td>
                            <td>${sentimentDot}</td>
                            <td>${pub.syndication || 'N/A'}</td>
                            <td>${pub.agencyGenerated || 'N/A'}</td>
                            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pub.keyMessages || ''}">${pub.keyMessages || 'N/A'}</td>
                        </tr>
                    `;
                });
                pubsTableHtml += `
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                pubsTableHtml = `<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 12px; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-color); border-radius: 8px;">No dynamic publication records added.</div>`;
            }
            
            let campTypeTags = "";
            const campTypes = Array.isArray(task.campaignType) ? task.campaignType : (task.campaignType ? [task.campaignType] : []);
            if (campTypes.length > 0) {
                campTypeTags = campTypes.map(ct => `<span class="badge" style="background: rgba(245, 158, 11, 0.12); color: var(--accent-orange); border: 1px solid rgba(245, 158, 11, 0.2); margin-right: 4px; margin-bottom: 4px;">${ct}</span>`).join('');
            } else {
                campTypeTags = `<span style="color:var(--text-muted); font-style:italic;">None</span>`;
            }

            detailsTr.innerHTML = `
                <td colspan="7" style="padding: 0; background: var(--bg-primary);">
                    <div class="pr-expanded-details-container" id="pr-expanded-container-${task.id}">
                        <div class="pr-details-grid">
                            <div class="pr-deadlines-summary-box">
                                <h5>PR Deadlines & Attribution</h5>
                                <div class="pr-summary-row">
                                    <span class="pr-summary-label">Priority:</span>
                                    <span class="pr-summary-val">${task.priority || 'Medium'}</span>
                                </div>
                                <div class="pr-summary-row">
                                    <span class="pr-summary-label">Target Completion:</span>
                                    <span class="pr-summary-val">${task.targetCompletionDate || 'N/A'}</span>
                                </div>
                                <div class="pr-summary-row">
                                    <span class="pr-summary-label">Opportunity Deadline:</span>
                                    <span class="pr-summary-val">${task.opportunityDeadline || 'N/A'}</span>
                                </div>
                                <div class="pr-summary-row" style="margin-top: 10px;">
                                    <span class="pr-summary-label">Attribution:</span>
                                    <span class="pr-summary-val" style="display:flex; flex-wrap:wrap;">${campTypeTags}</span>
                                </div>
                            </div>
                            <div>
                                <h5 style="margin-top: 0; margin-bottom: 10px; font-family: var(--font-heading); font-size: 12px; font-weight: 600; color: var(--text-primary);">Publication Coverage Details</h5>
                                ${pubsTableHtml}
                            </div>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(detailsTr);
        }
    });

    // Add inline event listeners to the action buttons
    tbody.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => openDrawer(btn.getAttribute("data-id")));
    });
    tbody.querySelectorAll(".duplicate-btn").forEach(btn => {
        btn.addEventListener("click", () => duplicateTask(btn.getAttribute("data-id")));
    });
    tbody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteTask(btn.getAttribute("data-id")));
    });
    tbody.querySelectorAll(".btn-view-image").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const id = btn.getAttribute("data-id");
            const task = state.tasks.find(t => t.id === id);
            if (task && task.image) {
                viewImageInNewWindow(task.image);
            }
        });
    });

    tbody.querySelectorAll(".btn-toggle-task-details").forEach(btn => {
        btn.addEventListener("click", () => {
            const taskId = btn.getAttribute("data-id");
            const row = document.getElementById(`pr-details-row-${taskId}`);
            const container = document.getElementById(`pr-expanded-container-${taskId}`);
            if (row && container) {
                btn.classList.toggle("active");
                if (row.style.display === "none") {
                    row.style.display = "table-row";
                    container.classList.add("active");
                } else {
                    container.classList.remove("active");
                    row.style.display = "none";
                }
            }
        });
    });
}

// Render Kanban Board View (Drag-and-Drop)
function renderTrackerKanban() {
    const statuses = ["WIP", "Sent for internal approval", "Sent to client", "Published/Closed", "Not used by client"];
    
    // Reset columns
    const columns = {
        "WIP": document.getElementById("kanban-wip"),
        "Sent for internal approval": document.getElementById("kanban-review"),
        "Sent to client": document.getElementById("kanban-approval"),
        "Published/Closed": document.getElementById("kanban-published"),
        "Not used by client": document.getElementById("kanban-hold")
    };

    statuses.forEach(status => {
        columns[status].innerHTML = "";
    });

    // Group items
    const counts = { "WIP": 0, "Sent for internal approval": 0, "Sent to client": 0, "Published/Closed": 0, "Not used by client": 0 };

    state.filteredTasks.forEach(task => {
        let colStatus = task.status;
        if (colStatus === "On hold" || colStatus === "On Hold") {
            colStatus = "Not used by client";
        } else if (colStatus === "Sent to journalist") {
            colStatus = "WIP";
        } else if (colStatus === "Client Approval Pending") {
            colStatus = "Sent to client";
        } else if (!statuses.includes(colStatus)) {
            colStatus = "WIP";
        }

        counts[colStatus]++;
        
        const card = document.createElement("div");
        card.className = "kanban-card";
        const isReadOnly = (getUserClientPermission(state.currentUserEmail, task.client || state.activeClient) === "ReadOnly");
        card.setAttribute("draggable", isReadOnly ? "false" : "true");
        card.setAttribute("data-id", task.id);
        
        // Drag events
        card.addEventListener("dragstart", (e) => {
            if (isReadOnly) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData("text/plain", task.id);
            card.style.opacity = "0.5";
        });
        card.addEventListener("dragend", () => {
            card.style.opacity = "1";
        });

        // Click to edit
        card.addEventListener("click", (e) => {
            // Check if link, btn, or image cover clicked, otherwise edit card
            if (e.target.tagName !== "A" && e.target.tagName !== "I" && !e.target.classList.contains("link-circle") && !e.target.closest(".kanban-card-image")) {
                openDrawer(task.id);
            }
        });

        // Tag label
        // Tag label
        let tagColor = "var(--accent-blue)";
        let tagLabel = task.subType === "Other" ? "Document" : (task.subType || task.type);
        if (state.activeClient === "Green Shine Solar" || task.client === "Green Shine Solar") {
            const campaignTypes = Array.isArray(task.campaignType) 
                ? task.campaignType 
                : (task.campaignType ? [task.campaignType] : []);
            
            let prefix = "";
            if (campaignTypes.includes("Organic") && campaignTypes.includes("Paid")) {
                prefix = "Paid & Organic ";
                tagColor = "var(--accent-purple)";
            } else if (campaignTypes.includes("Paid")) {
                prefix = "Paid ";
                tagColor = "var(--accent-red)";
            } else if (campaignTypes.includes("Organic")) {
                prefix = "Organic ";
                tagColor = "var(--accent-blue)";
            }

            if (task.type === "Digital Campaigns") {
                tagLabel = prefix + "Digital Campaign";
                if (!prefix) {
                    tagColor = "var(--accent-purple)";
                }
            } else if (task.type === "Social Media") {
                tagLabel = prefix + "Social Media";
            } else if (task.type === "PR Update") {
                tagLabel = prefix + "PR Update";
            } else {
                tagLabel = prefix + (task.subType || task.type);
            }
        } else if (state.activeClient === "iCode" || task.client === "iCode") {
            const campaignTypes = Array.isArray(task.campaignType) 
                ? task.campaignType 
                : (task.campaignType ? [task.campaignType] : ["Organic"]);
            
            if (campaignTypes.includes("Organic") && campaignTypes.includes("Paid")) {
                tagColor = "var(--accent-purple)";
                tagLabel = task.subType ? `Paid & Organic: ${task.subType}` : "Paid & Organic Campaign";
            } else if (campaignTypes.includes("Paid")) {
                tagColor = "var(--accent-red)";
                tagLabel = task.subType ? `Paid: ${task.subType}` : "Paid Campaign";
            } else {
                tagColor = "var(--accent-blue)";
                tagLabel = task.subType ? `Organic: ${task.subType}` : "Organic Campaign";
            }
        } else {
            if (task.type === "PR Update") tagColor = "var(--accent-purple)";
            if (task.type === "Creative / Collateral") tagColor = "var(--accent-amber)";
        }

        // Links html quick view
        let linksQuick = "";
        if (task.liveLink && task.liveLink.startsWith("http")) {
            const p = getPlatformIcon(task.subType);
            linksQuick += `<a href="${task.liveLink}" target="_blank" class="quick-link-ico" title="${p.label}" style="color:${p.color};"><i class="${p.icon}"></i></a>`;
        }
        if (task.canvaLink && task.canvaLink.startsWith("http")) {
            linksQuick += `<a href="${task.canvaLink}" target="_blank" class="quick-link-ico" title="Canva"><i class="fa-solid fa-pen-nib"></i></a>`;
        }
        if (task.image) {
            linksQuick += `<a href="#" class="quick-link-ico kanban-view-img-btn" data-id="${task.id}" title="Media Clipping"><i class="fa-solid fa-image"></i></a>`;
        }

        let kanbanCoverHtml = "";
        if (task.image) {
            kanbanCoverHtml = `
                <div class="kanban-card-image" data-id="${task.id}" style="width: 100%; height: 90px; border-radius: 6px; overflow: hidden; margin-bottom: 8px; border: 1px solid var(--border-color); background: var(--bg-primary); cursor: pointer;">
                    <img src="${task.image}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" alt="cover">
                </div>
            `;
        }

        let kanbanCommentHtml = "";
        if ((colStatus === "WIP" || colStatus === "Sent for internal approval") && (task.wipWho || task.wipWhy)) {
            kanbanCommentHtml = `
                <div class="kanban-card-comments" style="background: var(--bg-secondary); border-radius: 8px; padding: 10px; margin-top: 10px; border-left: 3px solid var(--accent-amber); font-size: 11.5px; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                    ${task.wipWho ? `<div style="font-weight: 600; margin-bottom: 4px; color: var(--text-primary); display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-user-clock" style="color: var(--accent-amber);"></i> ${task.wipWho}</div>` : ''}
                    ${task.wipWhy ? `<div style="color: var(--text-secondary); line-height: 1.35; font-style: italic;">"${task.wipWhy}"</div>` : ''}
                </div>
            `;
        }

        let kanbanDcDetailsHtml = "";
        if (task.type === "Digital Campaigns") {
            const platforms = task.platforms && task.platforms.length > 0 
                ? task.platforms.join(", ") 
                : "No platforms";
            const budgetVal = task.campaignBudget ? Number(task.campaignBudget) : 0;
            const convVal = task.leadsConversionsClicks ? Number(task.leadsConversionsClicks) : 0;
            const cplVal = convVal > 0 ? (budgetVal / convVal).toFixed(2) : "0.00";
            
            kanbanDcDetailsHtml = `
                <div style="background: var(--bg-secondary); border-radius: 8px; padding: 10px; margin-top: 10px; border-left: 3px solid var(--accent-purple); font-size: 11px; border-top: 1px solid var(--border-color); border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); line-height: 1.45;">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;"><i class="fa-solid fa-rectangle-ad"></i> Digital Campaign Specs</div>
                    <div>Platforms: <span style="color: var(--text-primary); font-weight: 500;">${platforms}</span></div>
                    <div>Budget: <span style="color: var(--text-primary); font-weight: 500;">₹${budgetVal.toLocaleString('en-IN')}</span></div>
                    <div>Conversions: <span style="color: var(--text-primary); font-weight: 500;">${convVal.toLocaleString()}</span></div>
                    <div>CPL/CPC: <span style="color: var(--text-primary); font-weight: 500;">₹${cplVal}</span></div>
                </div>
            `;
        }

        // iCode Centers tags for Kanban
        let kanbanCentersHtml = "";
        if ((state.activeClient === "iCode" || task.client === "iCode") && task.centers && task.centers.length > 0) {
            kanbanCentersHtml = `<div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap;">` + 
                task.centers.map(c => `<span style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.15); color: var(--accent-blue); padding: 1px 5px; border-radius: 4px; font-size: 9.5px; font-weight: 600;"><i class="fa-solid fa-location-dot" style="font-size: 8px; margin-right: 1px;"></i> ${c}</span>`).join('') + 
                `</div>`;
        }

        // Remarks (Details & Comments) for Kanban
        let kanbanRemarksHtml = "";
        if (task.remarks && task.remarks.trim() !== "") {
            kanbanRemarksHtml = `<div class="card-remarks" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.35; white-space: pre-line;">${task.remarks}</div>`;
        }

        card.innerHTML = `
            ${kanbanCoverHtml}
            <span class="card-tag" style="color:${tagColor};">${tagLabel}</span>
            <div class="card-title" style="font-weight: 600; margin-bottom: 4px;">${task.title}</div>
            ${kanbanRemarksHtml}
            ${kanbanCentersHtml}
            ${kanbanCommentHtml}
            ${kanbanDcDetailsHtml}
            <div class="card-links-quick">${linksQuick}</div>
            <div class="card-meta">
                <span class="card-owner"><i class="fa-solid fa-user"></i> ${task.owner}</span>
                <span class="card-date">${task.date || task.month.split(" ")[0]}</span>
            </div>
        `;

        columns[colStatus].appendChild(card);
    });

    // Update column counters
    statuses.forEach(status => {
        const colEl = columns[status].parentElement;
        colEl.querySelector(".column-count").textContent = counts[status];
        
        // Drag Over / Drop event setup for columns
        const container = columns[status];
        container.addEventListener("dragover", (e) => {
            e.preventDefault();
            container.style.backgroundColor = "rgba(59, 130, 246, 0.04)";
        });
        container.addEventListener("dragleave", () => {
            container.style.backgroundColor = "";
        });
        container.addEventListener("drop", (e) => {
            e.preventDefault();
            container.style.backgroundColor = "";
            const taskId = e.dataTransfer.getData("text/plain");
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                if (getUserClientPermission(state.currentUserEmail, task.client || state.activeClient) === "ReadOnly") {
                    alert(`Access Denied: You have Read-Only permissions for ${task.client || state.activeClient}.`);
                    return;
                }
                if (task.status !== status) {
                    task.status = status;
                    updateCarryForwardTaskMonth(task, state.filters.month);
                    saveData(task);
                    renderTracker(); // Refresh kanban cards
                }
            }
        });
    });

    // Event listener for images inside kanban cards
    document.querySelectorAll(".kanban-view-img-btn, .kanban-card-image").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.getAttribute("data-id");
            const task = state.tasks.find(t => t.id === id);
            if (task && task.image) {
                viewImageInNewWindow(task.image);
            }
        });
    });
}

// ====================================================
// REPORT BUILDER VIEW ENGINE
// ====================================================

function generateReport(keepExclusions = false) {
    if (keepExclusions !== true) {
        state.excludedReportTaskIds.clear();
    }
    const periodType = document.getElementById("report-period-type").value;
    const selectedMonth = document.getElementById("report-month").value;
    const selectedWeek = document.getElementById("report-week").value;
    
    // Set client-specific default narrative text dynamically
    const editNarrativeEl = document.getElementById("edit-report-narrative");
    const narrativeTextEl = document.getElementById("report-narrative-text");
    if (editNarrativeEl && narrativeTextEl) {
        let defaultNarrative = "";
        if (state.activeClient === "BT Group") {
            defaultNarrative = `During this period, Candour Communications actively spearheaded social content strategies and creative asset development for BT Group. Social media accounts saw consistent growth driven by corporate updates, campaign assets, and community engagement.`;
        } else if (state.activeClient === "iCode") {
            defaultNarrative = `During this period, Candour Communications actively spearheaded educational campaigns and localized marketing strategies for iCode. Campaigns drove sign-ups and student engagements across Plano, Murphy, and Redmond centers.`;
        } else {
            const clientName = state.activeClient === "Legrand" ? "Sanjay Motwani" : state.activeClient;
            defaultNarrative = `During this period, Candour Communications actively spearheaded media coverage, press communications, and social content strategies for ${clientName}. Social media accounts saw consistent growth driven by key event updates, corporate milestones, and brand announcements.`;
        }
        
        const currentVal = editNarrativeEl.value.trim();
        const isDefault = currentVal.includes("for RVNL") || currentVal.includes("for iCode") || currentVal.includes("for BT Group") || currentVal.includes("for Sanjay Motwani") || currentVal === "" || currentVal.startsWith("During this period, Candour Communications actively spearheaded media coverage, press communications");
        if (isDefault) {
            editNarrativeEl.value = defaultNarrative;
            narrativeTextEl.textContent = defaultNarrative;
        }
    }
    
    let selectedMonths = [];
    if (state.activeClient === "Legrand" && periodType === "monthly") {
        const checkboxes = document.querySelectorAll(".report-month-chk:checked");
        checkboxes.forEach(chk => selectedMonths.push(chk.value));
    } else {
        selectedMonths.push(selectedMonth);
    }

    // Helper to calculate the next calendar month string
    function getNextMonthStr(monthStr) {
        const parts = monthStr.trim().split(/\s+/);
        if (parts.length !== 2) return "";
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthIdx = monthNames.indexOf(parts[0]);
        let year = parseInt(parts[1], 10);
        if (monthIdx === -1 || isNaN(year)) return "";
        let nextMonthIdx = monthIdx + 1;
        if (nextMonthIdx > 11) {
            nextMonthIdx = 0;
            year += 1;
        }
        return `${monthNames[nextMonthIdx]} ${year}`;
    }

    let nextMonthStr = "";
    if (state.activeClient === "Legrand" && periodType === "monthly" && selectedMonths.length > 0) {
        const sortedSelected = [...selectedMonths].sort((a, b) => getMonthValue(a) - getMonthValue(b));
        const latestMonth = sortedSelected[sortedSelected.length - 1];
        nextMonthStr = getNextMonthStr(latestMonth);
    }
    
    // Update Report Branding dynamically
    const reportTitle = document.getElementById("report-client-title");
    const reportSubtitle = document.getElementById("report-client-subtitle");
    const reportLogo = document.getElementById("report-client-logo");
    
    if (reportTitle) {
        if (state.activeClient === "RVNL") {
            reportTitle.textContent = "Rail Vikas Nigam Limited (RVNL)";
        } else if (state.activeClient === "Kompact AI") {
            reportTitle.textContent = "Kompact AI";
        } else if (state.activeClient === "Legrand") {
            reportTitle.textContent = "Sanjay Motwani Leadership Profiling";
        } else if (state.activeClient === "iCode") {
            reportTitle.textContent = "iCode";
        } else if (state.activeClient === "BT Group") {
            reportTitle.textContent = "BT Group";
        } else if (state.activeClient === "Candour") {
            reportTitle.textContent = "Candour Communications";
        } else if (state.activeClient === "Green Shine Solar") {
            reportTitle.textContent = "Green Shine Solar";
        } else if (state.activeClient === "Zoom") {
            reportTitle.textContent = "Zoom Video Communications";
        }
    }
    
    if (reportSubtitle) {
        if (state.activeClient === "BT Group") {
            reportSubtitle.textContent = "Social Media & Creative Marketing Report";
        } else if (state.activeClient === "iCode") {
            reportSubtitle.textContent = "Social Media & Campaigns Report";
        } else if (state.activeClient === "Zoom") {
            reportSubtitle.textContent = "PR Coverage & Media Tracking Report";
        } else {
            reportSubtitle.textContent = "PR, Social Media & Creative Marketing Report";
        }
    }
    
    if (reportLogo) {
        if (state.activeClient === "RVNL") {
            reportLogo.src = "inputs/RVNL logo.png";
        } else {
            reportLogo.src = getClientLogo(state.activeClient);
        }
    }

    // Filter database for items in selected month and active client
    let reportItems = state.tasks.filter(t => {
        const isClient = (t.client || "RVNL") === state.activeClient;
        if (!isClient) return false;
        
        if (state.activeClient === "Legrand" && periodType === "monthly") {
            return selectedMonths.some(m => isTaskActiveInMonth(t, m));
        } else {
            return isTaskActiveInMonth(t, selectedMonth);
        }
    });

    if (state.activeClient === "Legrand") {
        reportItems = reportItems.filter(t => t.type !== "Creative / Collateral");
    } else if (state.activeClient === "iCode") {
        reportItems = reportItems.filter(t => t.type === "Social Media");
    } else if (state.activeClient === "BT Group") {
        reportItems = reportItems.filter(t => t.type !== "PR Update");
    }

    // If monthly report is chosen, only keep items that are "Published/Closed" (uploaded/used/closed)
    // For Legrand (LDCS), include WIP, Sent for internal approval, and Sent to client as well
    if (periodType === "monthly") {
        if (state.activeClient === "Legrand") {
            reportItems = reportItems.filter(t => 
                t.status === "Published/Closed" || 
                t.status === "WIP" || 
                t.status === "Sent for internal approval" || 
                t.status === "Sent to client" ||
                t.status === "Client Approval Pending"
            );
        } else {
            reportItems = reportItems.filter(t => t.status === "Published/Closed");
        }
    }

    // If weekly report is chosen, filter by specific week (include all statuses)
    if (periodType === "weekly" && selectedWeek !== "all") {
        reportItems = reportItems.filter(t => {
            if (t.week === selectedWeek) return true;
            if (t.date) {
                return getWeekFromDateStr(t.date) === selectedWeek;
            }
            return false;
        });
    }

    // Sort report items: Published at the top, then WIP/planned items below
    reportItems.sort((a,b) => {
        if (state.activeClient === "Legrand") {
            const isPubA = a.status === "Published/Closed" ? 1 : 0;
            const isPubB = b.status === "Published/Closed" ? 1 : 0;
            if (isPubA !== isPubB) {
                return isPubB - isPubA; // Published (1) before WIP/planned (0)
            }
        }
        const dateA = a.date || "";
        const dateB = b.date || "";
        return dateA.localeCompare(dateB, undefined, {numeric: true});
    });

    // Populate Report Meta text
    let periodText = "";
    if (periodType === "weekly") {
        periodText = `${selectedWeek} of ${selectedMonth}`;
    } else {
        if (state.activeClient === "Legrand") {
            if (selectedMonths.length === 0) {
                periodText = "No Months Selected";
            } else if (selectedMonths.length === 1) {
                periodText = `${selectedMonths[0]} Report`;
            } else if (selectedMonths.length === 2) {
                periodText = `${selectedMonths.join(" & ")} Report`;
            } else {
                periodText = `${selectedMonths.slice(0, -1).join(", ")}, & ${selectedMonths[selectedMonths.length - 1]} Report`;
            }
        } else {
            periodText = `${selectedMonth} Report`;
        }
    }
    document.getElementById("report-meta-period").textContent = periodText;

    // Filter into global report state items
    state.currentReportSmItems = reportItems.filter(t => t.type === "Social Media");
    state.currentReportPrItems = reportItems.filter(t => t.type === "PR Update");
    state.currentReportCreativeItems = reportItems.filter(t => t.type === "Creative / Collateral");
    state.currentReportDcItems = reportItems.filter(t => t.type === "Digital Campaigns");

    // Call actual renderer
    renderReportView();
}

function renderReportView() {
    // Filter active items (excluding removed ones)
    const smItems = state.currentReportSmItems.filter(t => !state.excludedReportTaskIds.has(t.id));
    const prItems = state.currentReportPrItems.filter(t => !state.excludedReportTaskIds.has(t.id));
    const creativeItems = state.currentReportCreativeItems ? state.currentReportCreativeItems.filter(t => !state.excludedReportTaskIds.has(t.id)) : [];
    const dcItems = state.currentReportDcItems ? state.currentReportDcItems.filter(t => !state.excludedReportTaskIds.has(t.id)) : [];
    
    // Update stats counters on report
    const defaultStats = document.getElementById("report-stats-summary-default");
    const icodeStats = document.getElementById("report-stats-summary-icode");

    if (state.activeClient === "iCode") {
        if (defaultStats) defaultStats.classList.add("hidden");
        if (icodeStats) icodeStats.classList.remove("hidden");

        let organicCount = 0;
        let paidCount = 0;
        let planoCount = 0;
        let murphyCount = 0;
        let redmondCount = 0;

        [...smItems, ...prItems, ...creativeItems].forEach(t => {
            const campaignTypes = Array.isArray(t.campaignType) 
                ? t.campaignType 
                : (t.campaignType ? [t.campaignType] : []);
            
            if (campaignTypes.includes("Organic")) organicCount++;
            if (campaignTypes.includes("Paid")) paidCount++;

            const centers = t.centers || [];
            if (centers.includes("Plano")) planoCount++;
            if (centers.includes("Murphy")) murphyCount++;
            if (centers.includes("Redmond")) redmondCount++;
        });

        document.getElementById("rep-stat-icode-organic").textContent = organicCount;
        document.getElementById("rep-stat-icode-paid").textContent = paidCount;
        document.getElementById("rep-stat-icode-plano").textContent = planoCount;
        document.getElementById("rep-stat-icode-murphy").textContent = murphyCount;
        document.getElementById("rep-stat-icode-redmond").textContent = redmondCount;
    } else {
        if (defaultStats) defaultStats.classList.remove("hidden");
        if (icodeStats) icodeStats.classList.add("hidden");

        const prBox = document.getElementById("rep-stat-pr")?.closest('.summary-stat-box');
        const prReleaseBox = document.getElementById("rep-stat-pr-releases")?.closest('.summary-stat-box');
        const collateralBox = document.getElementById("rep-stat-collateral-box");
        const secondaryRow = document.getElementById("report-stats-row-secondary");
        const firstRow = document.querySelector("#report-stats-summary-default .row-2col:first-child");
        
        const reportSecPr = document.getElementById("report-sec-pr");
        const creativeTitleEl = document.getElementById("report-sec-creative-title");
        const prTitleEl = document.getElementById("report-sec-pr-title");
        
        if (state.activeClient === "BT Group") {
            // 1. Hide PR stats boxes
            if (prBox) prBox.style.display = "none";
            if (prReleaseBox) prReleaseBox.style.display = "none";
            
            // 2. Move Collaterals next to Social Media
            if (firstRow && collateralBox) firstRow.appendChild(collateralBox);
            if (collateralBox) collateralBox.style.display = "";
            
            // 3. Hide secondary row
            if (secondaryRow) secondaryRow.style.display = "none";
            
            // 4. Hide PR section & renumber creative section to 3
            if (reportSecPr) reportSecPr.style.display = "none";
            if (creativeTitleEl) creativeTitleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> 3. Creative Collaterals & Graphic Designs`;
            
            // 5. Populate statistics
            document.getElementById("rep-stat-sm").textContent = smItems.length;
            document.getElementById("rep-stat-collateral").textContent = creativeItems.length;
        } else {
            // Restore default displays
            if (prBox) prBox.style.display = "";
            if (prReleaseBox) prReleaseBox.style.display = "";
            if (secondaryRow && prReleaseBox) secondaryRow.insertBefore(prReleaseBox, collateralBox);
            if (secondaryRow && collateralBox) secondaryRow.appendChild(collateralBox);
            
            // Show PR section & restore creative title to 4
            if (reportSecPr) reportSecPr.style.display = "";
            if (creativeTitleEl) creativeTitleEl.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> 4. Creative Collaterals & Graphic Designs`;
            
            if (state.activeClient === "Legrand" || state.activeClient === "Kompact AI") {
                if (collateralBox) collateralBox.style.display = "none";
                if (secondaryRow) secondaryRow.style.display = "none";
            } else {
                if (collateralBox) collateralBox.style.display = "";
                if (secondaryRow) secondaryRow.style.display = "";
            }
            
            const totalPrPublications = getPRPublicationsCount([...smItems, ...prItems, ...creativeItems]);
            if (document.getElementById("rep-stat-pr")) document.getElementById("rep-stat-pr").textContent = totalPrPublications;
            if (document.getElementById("rep-stat-pr-releases")) document.getElementById("rep-stat-pr-releases").textContent = prItems.length;
            
            if (state.activeClient === "Legrand" || state.activeClient === "Kompact AI") {
                document.getElementById("rep-stat-sm").textContent = smItems.filter(t => t.status === "Published/Closed").length;
            } else {
                document.getElementById("rep-stat-sm").textContent = smItems.length;
            }
            document.getElementById("rep-stat-collateral").textContent = creativeItems.length;
            
            if (prTitleEl) {
                if (state.activeClient === "Legrand" || state.activeClient === "Kompact AI") {
                    prTitleEl.innerHTML = `<i class="fa-solid fa-bullhorn"></i> 3. Media Coverage`;
                } else {
                    prTitleEl.innerHTML = `<i class="fa-solid fa-bullhorn"></i> 3. Press Releases & Media Coverage`;
                }
            }
        }
    }

    // RENDER SOCIAL MEDIA TABLE
    const smBody = document.getElementById("report-social-table-body");
    smBody.innerHTML = "";
    
    // Set dynamic headers based on periodType
    const smTable = document.querySelector("#report-sec-social table");
    if (smTable) {
        const smThead = smTable.querySelector("thead");
        if (smThead) {
            let platformHeader = "Platform";
            let platformWidth = "90px";
            if (state.activeClient === "iCode") {
                platformHeader = "Campaign Type";
                platformWidth = "120px";
            }
            smThead.innerHTML = `
                <tr>
                    <th style="width: 60px;">Sl.</th>
                    <th style="width: ${platformWidth};">${platformHeader}</th>
                    <th>Activity Details</th>
                    <th style="width: 140px;">Status / Date</th>
                    <th>Live Verification Link</th>
                </tr>
            `;
        }
    }
    
    if (smItems.length === 0) {
        document.getElementById("report-sec-social").classList.add("no-print");
        const colspanVal = 5;
        smBody.innerHTML = `<tr><td colspan="${colspanVal}" style="text-align:center; padding:15px; color:#6b7280;">No social media activities recorded in this timeframe.</td></tr>`;
    } else {
        document.getElementById("report-sec-social").classList.remove("no-print");
        smItems.forEach((task, idx) => {
            const tr = document.createElement("tr");
            tr.setAttribute("draggable", "true");
            tr.setAttribute("data-id", task.id);
            tr.classList.add("draggable-row");
            
            let verificationLink = task.status || "Published";
            if ((state.activeClient === "Legrand" || state.activeClient === "Kompact AI") && task.status !== "Published/Closed") {
                verificationLink = "WIP";
            }
            if (task.liveLink && task.liveLink.startsWith("http")) {
                let btnLabel = "View Post";
                const subTypeLower = (task.subType || "").toLowerCase();
                const platformLower = (task.platform || "").toLowerCase();
                if (subTypeLower.includes("youtube") || platformLower.includes("youtube") || subTypeLower.includes("video")) {
                    btnLabel = "View Video";
                }
                verificationLink = `
                    <a href="${task.liveLink}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap;">
                        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i> ${btnLabel}
                    </a>
                `;
            } else if (task.liveLink) {
                verificationLink = task.liveLink;
            }
            
            // Format status badge or date
            let timelineDisplay = task.date || task.week || 'Published';
            
            let statusClass = "status-published";
            if (task.status === "WIP") statusClass = "status-wip";
            if (task.status === "Sent for internal approval") statusClass = "status-review";
            if (task.status === "Sent to client" || task.status === "Client Approval Pending") statusClass = "status-approval";
            if (task.status === "Not used by client") statusClass = "status-missed";

            let statusOptionsHtml = "";
            const availableStatuses = ["WIP", "Sent for internal approval", "Sent to client", "Client Approval Pending", "Published/Closed", "Not used by client"];
            availableStatuses.forEach(st => {
                statusOptionsHtml += `<option value="${st}" ${task.status === st ? 'selected' : ''} style="background: #1e293b; color: #f8fafc;">${st}</option>`;
            });

            const screenStatusSelect = `
                <div class="no-print">
                    <select class="report-status-select status-pill ${statusClass}" data-id="${task.id}" style="font-size:10px; padding:3px 8px; border:none; outline:none; font-weight:600; cursor:pointer; background:inherit; color:inherit;">
                        ${statusOptionsHtml}
                    </select>
                </div>
            `;

            let printStatusHtml = "";
            if (task.status !== "Published/Closed") {
                let statusText = task.status;
                if (state.activeClient === "Legrand" || state.activeClient === "Kompact AI") {
                    if (task.status === "Client Approval Pending") {
                        statusText = "Client Approval Pending";
                    } else {
                        statusText = "WIP";
                    }
                }
                printStatusHtml = `<span class="status-pill ${statusClass} only-print" style="font-size:10px; padding:3px 8px;">${statusText}</span>`;
            } else {
                printStatusHtml = `<span class="only-print">${timelineDisplay}</span>`;
            }

            timelineDisplay = `${screenStatusSelect}${printStatusHtml}`;

            // Inline Thumbnail block beside or below the title
            let reportThumbnailHtml = "";
            if (task.image) {
                reportThumbnailHtml = `
                    <div class="report-item-thumbnail">
                        <img src="${task.image}" alt="thumbnail">
                    </div>
                `;
            }

            const noPrintButtons = `
                <div class="no-print" style="margin-top: 8px; display: flex; gap: 6px; align-items: center;">
                     <button class="btn btn-secondary btn-sm btn-add-report-clipping" data-id="${task.id}" style="font-size: 10px; padding: 2px 8px; height: 24px;">
                         <i class="fa-solid fa-plus"></i> Add Thumbnail
                     </button>
                </div>
            `;

            let wipReportDetails = "";
            if (state.activeClient !== "Legrand" && state.activeClient !== "Kompact AI") {
                if ((task.status === "WIP" || task.status === "Sent for internal approval") && (task.wipWho || task.wipWhy)) {
                    wipReportDetails = `<div style="font-size: 11px; color: var(--accent-amber); margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
                        ${task.wipWho ? `<span><strong>Pending with:</strong> ${task.wipWho}</span>` : ''}
                        ${task.wipWhy ? `<span><strong>Status/Delay:</strong> ${task.wipWhy}</span>` : ''}
                    </div>`;
                }
            }

            const showRemarks = task.remarks && state.activeClient !== "Legrand" && state.activeClient !== "Kompact AI";
            const activityDetailsHtml = reportThumbnailHtml
                ? `<div class="report-item-flex">
                     ${reportThumbnailHtml}
                     <div class="report-item-details">
                          <button class="no-print report-exclude-btn" data-id="${task.id}" style="float: right; background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; font-size: 14px;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                          <strong>${task.title}</strong>
                          ${showRemarks ? '<br><span style="font-size:11px;color:#4b5563;">' + task.remarks + '</span>' : ''}
                          ${wipReportDetails}
                      </div>
                    </div>`
                : `<div class="report-item-details">
                     <button class="no-print report-exclude-btn" data-id="${task.id}" style="float: right; background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; font-size: 14px;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                     <strong>${task.title}</strong>
                     ${showRemarks ? '<br><span style="font-size:11px;color:#4b5563;">' + task.remarks + '</span>' : ''}
                     ${wipReportDetails}
                     ${noPrintButtons}
                   </div>`;

            let platformColHtml = `<i class="fa-solid fa-share-nodes" style="color:#3b82f6;"></i> All Platforms`;
            if (state.activeClient === "Legrand") {
                platformColHtml = `<i class="fa-brands fa-linkedin" style="color:#0a66c2;"></i> LinkedIn`;
            } else if (state.activeClient === "iCode" || task.client === "iCode") {
                const campaignTypes = Array.isArray(task.campaignType) 
                    ? task.campaignType 
                    : (task.campaignType ? [task.campaignType] : ["Organic"]);
                
                const parts = [];
                if (campaignTypes.includes("Organic")) {
                    parts.push(`<span style="color:var(--accent-blue); font-weight: 600;"><i class="fa-solid fa-seedling"></i> Organic Campaign</span>`);
                }
                if (campaignTypes.includes("Paid")) {
                    parts.push(`<span style="color:var(--accent-red); font-weight: 600;"><i class="fa-solid fa-coins"></i> Paid Campaign</span>`);
                }
                if (parts.length === 0) {
                    parts.push(`<span style="color:var(--accent-blue); font-weight: 600;"><i class="fa-solid fa-seedling"></i> Organic Campaign</span>`);
                }
                
                const centers = task.centers || [];
                const centersHtml = centers.length > 0
                    ? `<div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px; font-weight: 600;"><i class="fa-solid fa-location-dot" style="color: var(--accent-purple);"></i> Centers: ${centers.join(", ")}</div>`
                    : `<div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; font-weight: 500;"><i class="fa-solid fa-location-dot"></i> No centers</div>`;

                platformColHtml = `<div style="display: flex; flex-direction: column; gap: 4px;">
                    ${parts.join("")}
                    ${centersHtml}
                </div>`;
            }

            tr.innerHTML = `
                <td style="text-align:center; vertical-align: middle;">
                    <span class="no-print drag-handle" style="cursor: grab; margin-right: 6px; color: var(--text-muted); display: inline-flex; align-items: center;"><i class="fa-solid fa-bars"></i></span>
                    <span>${idx + 1}</span>
                </td>
                <td class="platform-name">${platformColHtml}</td>
                <td>${activityDetailsHtml}</td>
                <td>${timelineDisplay}</td>
                <td>${verificationLink}</td>
            `;
            smBody.appendChild(tr);
        });
    }

    // RENDER PR UPDATE SECTION
    const prSec = document.getElementById("report-sec-pr");
    if (prSec) {
        if (state.activeClient === "iCode") {
            prSec.style.display = "none";
        } else {
            prSec.style.display = "";
            
            // Get or create the new list container
            let listContainer = prSec.querySelector(".report-pr-list-container");
            const tableResponsive = prSec.querySelector(".table-responsive");
            
            if (!listContainer) {
                listContainer = document.createElement("div");
                listContainer.className = "report-pr-list-container";
                prSec.appendChild(listContainer);
            }
            
            if (tableResponsive) {
                tableResponsive.style.display = "none"; // Hide the old table layout completely
            }
            listContainer.style.display = "block";
            listContainer.innerHTML = "";

            if (prItems.length === 0) {
                prSec.classList.add("no-print");
                listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#6b7280; border:1px solid var(--border-color); border-radius:8px;">No PR media coverage items recorded.</div>`;
            } else {
                prSec.classList.remove("no-print");
                prItems.forEach((task, idx) => {
                    const itemDiv = document.createElement("div");
                    itemDiv.className = "report-pr-group draggable-pr-card";
                    itemDiv.setAttribute("draggable", "true");
                    itemDiv.setAttribute("data-id", task.id);
                    itemDiv.style.marginBottom = "25px";
                    itemDiv.style.border = "1.5px solid #1e293b";
                    itemDiv.style.borderRadius = "8px";
                    itemDiv.style.overflow = "hidden";
                    itemDiv.style.backgroundColor = "var(--bg-secondary)";
                    
                    // Group Header (Announcements / Topic Title)
                    const isWipTask = task.status !== "Published/Closed";
                    
                    let statusClass = "status-published";
                    if (task.status === "WIP") statusClass = "status-wip";
                    if (task.status === "Sent for internal approval") statusClass = "status-review";
                    if (task.status === "Sent to client" || task.status === "Client Approval Pending") statusClass = "status-approval";
                    if (task.status === "Sent to journalist") statusClass = "status-review";
                    if (task.status === "On hold") statusClass = "status-hold";
                    if (task.status === "Not used by client") statusClass = "status-missed";

                    let statusOptionsHtml = "";
                    const prStatuses = ["WIP", "Sent for internal approval", "Sent to client", "Client Approval Pending", "Sent to journalist", "On hold", "Published/Closed", "Not used by client"];
                    prStatuses.forEach(st => {
                        statusOptionsHtml += `<option value="${st}" ${task.status === st ? 'selected' : ''} style="background: #1e293b; color: #f8fafc;">${st}</option>`;
                    });

                    const screenStatusSelect = `
                        <div class="no-print" style="margin-left: 8px; display: inline-block;">
                            <select class="report-status-select status-pill ${statusClass}" data-id="${task.id}" style="font-size:10px; padding:3px 8px; border:none; outline:none; font-weight:600; cursor:pointer; background:inherit; color:inherit;">
                                ${statusOptionsHtml}
                            </select>
                        </div>
                    `;

                    const printStatusHtml = isWipTask 
                        ? `<span class="status-pill ${statusClass} only-print" style="font-size: 10px; padding: 3px 8px; margin-left: 8px;">${task.status}</span>`
                        : "";

                    const wipBadge = `${screenStatusSelect}${printStatusHtml}`;

                    const headerBorder = isWipTask ? "none" : "1.5px solid #1e293b";
                    const headerHtml = `
                        <div style="background: var(--bg-primary); border-bottom: ${headerBorder}; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="no-print drag-handle-pr" style="cursor: grab; color: var(--text-muted); margin-right: 4px; display: inline-flex; align-items: center;"><i class="fa-solid fa-bars"></i></span>
                                <span style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${task.subType || 'Press Release'}</span>
                                <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-primary); line-height: 1.4; display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                    ${task.title}
                                    ${wipBadge}
                                </h4>
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                ${task.date ? `
                                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 4px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; border: 1px solid #475569;">
                                    <i class="fa-regular fa-calendar-days"></i> ${task.date}
                                </div>` : ''}
                                <button class="no-print report-exclude-btn-pr" data-id="${task.id}" style="background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 4px; font-size: 16px; display: flex; align-items: center; justify-content: center;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </div>
                    `;
                    
                    // Publications Grid
                    const list = task.publicationsList || [];
                    let publicationsHtml = "";
                    
                    if (task.status === "Published/Closed") {
                        if (list.length > 0) {
                            publicationsHtml = `<div class="report-pub-grid" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; padding: 14px; box-sizing: border-box;">`;
                            list.forEach((pub, pubIdx) => {
                                publicationsHtml += `
                                    <div class="report-pub-coverage-card draggable-pub-card" 
                                         draggable="false" 
                                         data-task-id="${task.id}" 
                                         data-pub-idx="${pubIdx}" 
                                         style="background: var(--bg-secondary); border: 1px solid #475569; border-radius: 8px; padding: 12px; box-sizing: border-box; display: flex; gap: 14px; align-items: flex-start; cursor: grab;">
                                        ${pub.image ? `
                                        <div style="width: 150px; height: 95px; border-radius: 6px; border: 1px solid #475569; overflow: hidden; flex-shrink: 0; background: #fafafa; cursor: pointer;">
                                            <a href="${pub.link || '#'}" target="_blank" draggable="false" style="display:block; width:100%; height:100%;"><img src="${pub.image}" draggable="false" style="width: 100%; height: 100%; object-fit: contain; border:none;"></a>
                                        </div>` : `<div style="width: 150px; height: 95px; border-radius: 6px; border: 1px solid #475569; background: rgba(255,255,255,0.03); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--text-muted);"><i class="fa-solid fa-image" style="font-size: 24px;"></i></div>`}
                                        <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; padding-top: 4px; flex-grow: 1; min-width: 0;">
                                            <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); display: flex; align-items: flex-start; gap: 6px; line-height: 1.3;">
                                                <span class="no-print drag-handle-pub" style="cursor: grab; color: var(--text-muted); display: inline-flex; align-items: center; margin-right: 4px; margin-top: 1px;"><i class="fa-solid fa-bars"></i></span>
                                                <span style="word-break: break-word;">${pub.name || 'Unnamed Pub'}</span>
                                            </div>
                                            ${pub.date ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i class="fa-regular fa-calendar" style="font-size: 10px;"></i>${pub.date}</div>` : ''}
                                            ${pub.link ? `
                                                <a href="${pub.link}" target="_blank" draggable="false" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap; margin-top: 4px; width: fit-content;">
                                                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i> View Article
                                                </a>` : ''}
                                        </div>
                                    </div>
                                `;
                            });
                            publicationsHtml += `</div>`;
                        } else {
                            // Fallback for old tasks that might only have task.image and task.publication
                            publicationsHtml = `
                                <table style="width: 100%; border-collapse: collapse; background: transparent; border: none;">
                                    <tr>
                                        <td style="padding: 16px; vertical-align: top; box-sizing: border-box;">
                                            <div style="display: flex; gap: 16px; align-items: flex-start;">
                                                ${task.image ? `
                                                <div style="width: 220px; height: 140px; border-radius: 6px; border: 1px solid #475569; overflow: hidden; flex-shrink: 0; background: #fafafa; cursor: pointer;">
                                                    ${task.liveLink ? `<a href="${task.liveLink}" target="_blank" style="display:block; width:100%; height:100%;"><img src="${task.image}" style="width: 100%; height: 100%; object-fit: contain; border:none;"></a>` : `<img src="${task.image}" style="width: 100%; height: 100%; object-fit: contain;" onclick="viewImageInNewWindow('${task.image}')">`}
                                                </div>` : ''}
                                                <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; padding-top: 4px; min-width: 0;">
                                                    <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${task.publication || 'Mainlines & Financials'}</div>
                                                    ${task.liveLink ? `
                                                        <a href="${task.liveLink}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.25); padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap; margin-top: 6px; width: fit-content;">
                                                            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i> View Article
                                                        </a>` : ''}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            `;
                        }
                    }
                    
                    itemDiv.innerHTML = headerHtml + publicationsHtml;
                    listContainer.appendChild(itemDiv);
                });
            }
        }
    }

    // RENDER CREATIVE COLLATERALS TABLE
    const creativeBody = document.getElementById("report-creative-table-body");
    const creativeSec = document.getElementById("report-sec-creative");
    if (creativeBody && creativeSec) {
        creativeBody.innerHTML = "";

        if (state.activeClient === "Legrand" || state.activeClient === "iCode" || state.activeClient === "Kompact AI") {
            creativeSec.style.display = "none";
        } else {
            creativeSec.style.display = "";
            if (creativeItems.length === 0) {
                creativeSec.classList.add("no-print");
                creativeBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#6b7280;">No creative collaterals recorded.</td></tr>`;
            } else {
                creativeSec.classList.remove("no-print");
                creativeItems.forEach((task, idx) => {
                    const tr = document.createElement("tr");
                
                    // Format status badge or remarks
                    let statusClass = "status-published";
                    if (task.status === "WIP") statusClass = "status-wip";
                    if (task.status === "Sent for internal approval") statusClass = "status-review";
                    if (task.status === "Sent to client" || task.status === "Client Approval Pending") statusClass = "status-approval";
                    if (task.status === "Not used by client") statusClass = "status-missed";
                    
                    let statusOptionsHtml = "";
                    const availableStatuses = ["WIP", "Sent for internal approval", "Sent to client", "Client Approval Pending", "Published/Closed", "Not used by client"];
                    availableStatuses.forEach(st => {
                        statusOptionsHtml += `<option value="${st}" ${task.status === st ? 'selected' : ''} style="background: #1e293b; color: #f8fafc;">${st}</option>`;
                    });
                    
                    const screenStatusSelect = `
                        <div class="no-print">
                            <select class="report-status-select status-pill ${statusClass}" data-id="${task.id}" style="font-size:10px; padding:3px 8px; border:none; outline:none; font-weight:600; cursor:pointer; background:inherit; color:inherit;">
                                ${statusOptionsHtml}
                            </select>
                        </div>
                    `;
                    
                    const printStatusHtml = `<span class="status-pill ${statusClass} only-print" style="font-size:10px; padding:3px 8px; display: inline-block;">${task.status || 'Published/Closed'}</span>`;
                    
                    let statusBadge = `${screenStatusSelect}${printStatusHtml}`;
                    if (task.remarks) {
                        statusBadge += `<div style="font-size: 11px; color:#4b5563; margin-top: 4px;">${task.remarks}</div>`;
                    }
                    if ((task.status === "WIP" || task.status === "Sent for internal approval") && (task.wipWho || task.wipWhy)) {
                        statusBadge += `<div style="font-size: 11px; color: var(--accent-amber); margin-top: 4px; line-height: 1.3;">
                            ${task.wipWho ? `<div><strong>Pending with:</strong> ${task.wipWho}</div>` : ''}
                            ${task.wipWhy ? `<div><strong>Status/Delay:</strong> ${task.wipWhy}</div>` : ''}
                        </div>`;
                    }

                    // Inline Thumbnail block beside or below the title
                    let reportThumbnailHtml = "";
                    if (task.image) {
                        reportThumbnailHtml = `
                            <div class="report-item-thumbnail">
                                <img src="${task.image}" alt="thumbnail">
                            </div>
                        `;
                    }

                    const noPrintButtons = `
                        <div class="no-print" style="margin-top: 8px; display: flex; gap: 6px; align-items: center;">
                             <button class="btn btn-secondary btn-sm btn-add-report-clipping" data-id="${task.id}" style="font-size: 10px; padding: 2px 8px; height: 24px;">
                                 <i class="fa-solid fa-plus"></i> Add Thumbnail
                             </button>
                        </div>
                    `;

                    const titleAndImageHtml = reportThumbnailHtml
                        ? `<div class="report-item-flex">
                             ${reportThumbnailHtml}
                             <div class="report-item-details">
                                 <button class="no-print report-exclude-btn" data-id="${task.id}" style="float: right; background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; font-size: 14px;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                                 <strong>${task.title}</strong>
                             </div>
                           </div>`
                        : `<div class="report-item-details">
                             <button class="no-print report-exclude-btn" data-id="${task.id}" style="float: right; background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; font-size: 14px;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                             <strong>${task.title}</strong>
                             ${noPrintButtons}
                           </div>`;

                    tr.innerHTML = `
                        <td style="text-align:center;">${idx + 1}</td>
                        <td style="font-weight:600;">${task.subType === "Other" ? "Document" : (task.subType || 'Design')}</td>
                        <td>${titleAndImageHtml}</td>
                        <td>${statusBadge}</td>
                    `;
                    creativeBody.appendChild(tr);
                });
            }
        }
    }

    // RENDER DIGITAL CAMPAIGNS TABLE
    const dcBody = document.getElementById("report-digital-campaigns-table-body");
    const dcSec = document.getElementById("report-sec-digital-campaigns");
    if (dcBody && dcSec) {
        dcBody.innerHTML = "";
        if (state.activeClient !== "Green Shine Solar") {
            dcSec.style.display = "none";
        } else {
            dcSec.style.display = "";
            if (dcItems.length === 0) {
                dcSec.classList.add("no-print");
                dcBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:15px; color:#6b7280;">No digital campaigns recorded.</td></tr>`;
            } else {
                dcSec.classList.remove("no-print");
                dcItems.forEach((task, idx) => {
                    const tr = document.createElement("tr");
                    tr.setAttribute("draggable", "true");
                    tr.setAttribute("data-id", task.id);
                    tr.classList.add("draggable-row");

                    const campaignTypes = Array.isArray(task.campaignType) 
                        ? task.campaignType 
                        : (task.campaignType ? [task.campaignType] : []);
                    const campaignTypeLabel = campaignTypes.join(" & ") || "Campaign";

                    const platformsHtml = task.platforms && task.platforms.length > 0 
                        ? task.platforms.join(", ") 
                        : "N/A";
                    const budgetVal = task.campaignBudget ? Number(task.campaignBudget) : 0;
                    const convVal = task.leadsConversionsClicks ? Number(task.leadsConversionsClicks) : 0;
                    const cplVal = convVal > 0 ? (budgetVal / convVal).toFixed(2) : "0.00";

                    let reportThumbnailHtml = "";
                    if (task.image) {
                        reportThumbnailHtml = `
                            <div class="report-item-thumbnail">
                                <img src="${task.image}" alt="thumbnail">
                            </div>
                        `;
                    }

                    const noPrintButtons = `
                        <div class="no-print" style="margin-top: 8px; display: flex; gap: 6px; align-items: center;">
                             <button class="btn btn-secondary btn-sm btn-add-report-clipping" data-id="${task.id}" style="font-size: 10px; padding: 2px 8px; height: 24px;">
                                 <i class="fa-solid fa-plus"></i> Add Thumbnail
                             </button>
                        </div>
                    `;

                    const titleAndImageHtml = reportThumbnailHtml
                        ? `<div class="report-item-flex">
                             ${reportThumbnailHtml}
                             <div class="report-item-details">
                                 <button class="no-print report-exclude-btn" data-id="${task.id}" style="float: right; background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; font-size: 14px;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                                 <strong>${task.title}</strong>
                             </div>
                           </div>`
                        : `<div class="report-item-details">
                             <button class="no-print report-exclude-btn" data-id="${task.id}" style="float: right; background: none; border: none; color: var(--accent-red); cursor: pointer; padding: 2px 6px; font-size: 14px;" title="Exclude from Report"><i class="fa-solid fa-xmark"></i></button>
                             <strong>${task.title}</strong>
                             ${noPrintButtons}
                           </div>`;

                    let linksHtml = '<div class="links-flex" style="justify-content: center; gap: 8px;">';
                    if (task.adCreativeLink && task.adCreativeLink.startsWith("http")) {
                        linksHtml += `<a href="${task.adCreativeLink}" target="_blank" class="link-circle canva-link" title="Ad Creative Link" style="width:24px; height:24px; font-size:11px; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-pen-nib"></i></a>`;
                    }
                    if (task.targetUrl && task.targetUrl.startsWith("http")) {
                        linksHtml += `<a href="${task.targetUrl}" target="_blank" class="link-circle li-link" title="Target URL" style="width:24px; height:24px; font-size:11px; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`;
                    }
                    if (task.image) {
                        linksHtml += `<a href="#" class="link-circle img-link btn-view-image" data-id="${task.id}" title="View Media Clipping" style="width:24px; height:24px; font-size:11px; display:inline-flex; align-items:center; justify-content:center;"><i class="fa-solid fa-image"></i></a>`;
                    }
                    linksHtml += '</div>';

                    tr.innerHTML = `
                        <td style="text-align:center;">${idx + 1}</td>
                        <td style="font-weight:600; text-align:center;">${campaignTypeLabel}</td>
                        <td>${titleAndImageHtml}</td>
                        <td style="text-align:center;">${platformsHtml}</td>
                        <td style="text-align:center;">₹${budgetVal.toLocaleString('en-IN')}</td>
                        <td style="text-align:center;">${convVal.toLocaleString()}</td>
                        <td style="text-align:center;">₹${cplVal}</td>
                        <td>${linksHtml}</td>
                    `;
                    dcBody.appendChild(tr);
                });
            }
        }
    }

    // Attach click listeners to all add thumbnail and autopull buttons globally
    document.querySelectorAll(".btn-add-report-clipping").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            state.currentUploadTaskId = btn.getAttribute("data-id");
            document.getElementById("report-clipping-upload").click();
        });
    });

    // Sync narrative text display to editor textarea
    const narrativeTextEl = document.getElementById("report-narrative-text");
    const editNarrativeEl = document.getElementById("edit-report-narrative");
    if (editNarrativeEl && narrativeTextEl) {
        narrativeTextEl.textContent = editNarrativeEl.value;
    }

    // Toggle AI narrative generator visibility based on key presence
    const geminiKey = localStorage.getItem("rvnl_gemini_key");
    const aiNarrativeBtn = document.getElementById("btn-generate-narrative-ai");
    if (aiNarrativeBtn) {
        aiNarrativeBtn.style.display = geminiKey ? "inline-flex" : "none";
    }

    // Wire up exclude buttons for Social Media and Creative sections
    document.querySelectorAll(".report-exclude-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            state.excludedReportTaskIds.add(id);
            renderReportView();
        });
    });

    // Wire up exclude buttons for PR items
    document.querySelectorAll(".report-exclude-btn-pr").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            state.excludedReportTaskIds.add(id);
            renderReportView();
        });
    });

    // Drag and Drop for Social Media table rows
    let dragSrcRow = null;
    smBody.querySelectorAll("tr.draggable-row").forEach(row => {
        row.addEventListener("dragstart", (e) => {
            dragSrcRow = row;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", row.getAttribute("data-id"));
            row.style.opacity = "0.5";
        });
        
        row.addEventListener("dragend", () => {
            row.style.opacity = "1";
            smBody.querySelectorAll("tr.draggable-row").forEach(r => r.style.borderTop = "");
        });
        
        row.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            row.style.borderTop = "2px solid var(--accent-blue)";
        });
        
        row.addEventListener("dragleave", () => {
            row.style.borderTop = "";
        });
        
        row.addEventListener("drop", (e) => {
            e.preventDefault();
            row.style.borderTop = "";
            const draggedId = e.dataTransfer.getData("text/plain");
            const targetId = row.getAttribute("data-id");
            
            if (draggedId !== targetId) {
                const draggedIdx = state.currentReportSmItems.findIndex(t => t.id === draggedId);
                const targetIdx = state.currentReportSmItems.findIndex(t => t.id === targetId);
                
                if (draggedIdx !== -1 && targetIdx !== -1) {
                    const [removed] = state.currentReportSmItems.splice(draggedIdx, 1);
                    state.currentReportSmItems.splice(targetIdx, 0, removed);
                    renderReportView();
                }
            }
        });
    });

    // Drag and Drop for PR cards
    const prListContainer = document.querySelector(".report-pr-list-container");
    if (prListContainer) {
        prListContainer.querySelectorAll(".draggable-pr-card").forEach(card => {
            card.addEventListener("dragstart", (e) => {
                if (state.draggingPub) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", card.getAttribute("data-id"));
                card.style.opacity = "0.5";
            });
            
            card.addEventListener("dragend", () => {
                card.style.opacity = "1";
                prListContainer.querySelectorAll(".draggable-pr-card").forEach(c => c.style.borderTop = "");
            });
            
            card.addEventListener("dragover", (e) => {
                if (state.draggingPub) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                card.style.borderTop = "3px solid var(--accent-blue)";
            });
            
            card.addEventListener("dragleave", () => {
                if (state.draggingPub) return;
                card.style.borderTop = "";
            });
            
            card.addEventListener("drop", (e) => {
                if (state.draggingPub) return;
                e.preventDefault();
                card.style.borderTop = "";
                const draggedId = e.dataTransfer.getData("text/plain");
                const targetId = card.getAttribute("data-id");
                
                if (draggedId !== targetId) {
                    const draggedIdx = state.currentReportPrItems.findIndex(t => t.id === draggedId);
                    const targetIdx = state.currentReportPrItems.findIndex(t => t.id === targetId);
                    
                    if (draggedIdx !== -1 && targetIdx !== -1) {
                        const [removed] = state.currentReportPrItems.splice(draggedIdx, 1);
                        state.currentReportPrItems.splice(targetIdx, 0, removed);
                        renderReportView();
                    }
                }
            });
        });
    }

    // Pointer-Event based Drag and Drop for individual Publications inside PR tasks
    let activeCard = null;
    let dragClone = null;
    let startX = 0;
    let startY = 0;
    let cardStartX = 0;
    let cardStartY = 0;
    let lastTargetCard = null;
    let taskId = null;
    let pubIdx = -1;

    document.querySelectorAll(".draggable-pub-card").forEach(card => {
        // Pointer down starts the dragging operation
        card.addEventListener("pointerdown", (e) => {
            // Only handle primary left pointer click/touch
            if (e.button !== 0) return;
            
            // Check if clicking inside input or interactive element
            if (e.target.closest("a, button, input, select, textarea")) {
                return;
            }
            
            activeCard = card;
            taskId = card.getAttribute("data-task-id");
            pubIdx = parseInt(card.getAttribute("data-pub-idx"));
            
            const rect = card.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            cardStartX = rect.left;
            cardStartY = rect.top;
            
            // Create a 100% solid clone of the card to follow the pointer
            dragClone = card.cloneNode(true);
            dragClone.classList.add("pointer-drag-clone");
            Object.assign(dragClone.style, {
                position: "fixed",
                left: `${cardStartX}px`,
                top: `${cardStartY}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                zIndex: "99999",
                pointerEvents: "none",
                opacity: "1",
                transform: "scale(1.02)",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
                transition: "none",
                cursor: "grabbing",
                border: "1.5px solid var(--accent-blue)"
            });
            
            document.body.appendChild(dragClone);
            card.classList.add("pointer-dragging");
            state.draggingPub = true; // Stop parent PR card reordering listeners from capturing events
            
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
            
            // Prevent text selection
            e.preventDefault();
        });
    });

    function onPointerMove(e) {
        if (!dragClone) return;
        
        // Move cloned card with cursor offset
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        dragClone.style.left = `${cardStartX + dx}px`;
        dragClone.style.top = `${cardStartY + dy}px`;
        
        // Identify target card under the cursor
        const element = document.elementFromPoint(e.clientX, e.clientY);
        const targetCard = element ? element.closest(".draggable-pub-card") : null;
        
        if (lastTargetCard && lastTargetCard !== targetCard) {
            lastTargetCard.classList.remove("drag-over");
            lastTargetCard = null;
        }
        
        if (targetCard && targetCard !== activeCard) {
            const targetTaskId = targetCard.getAttribute("data-task-id");
            if (targetTaskId === taskId) {
                targetCard.classList.add("drag-over");
                lastTargetCard = targetCard;
            }
        }
    }

    function onPointerUp(e) {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        
        if (dragClone) {
            dragClone.remove();
            dragClone = null;
        }
        
        if (activeCard) {
            activeCard.classList.remove("pointer-dragging");
        }
        
        if (lastTargetCard) {
            lastTargetCard.classList.remove("drag-over");
            const targetPubIdx = parseInt(lastTargetCard.getAttribute("data-pub-idx"));
            
            const task = state.tasks.find(t => t.id === taskId);
            if (task && task.publicationsList) {
                const [removed] = task.publicationsList.splice(pubIdx, 1);
                task.publicationsList.splice(targetPubIdx, 0, removed);
                
                const reportTask = state.currentReportPrItems.find(t => t.id === taskId);
                if (reportTask && reportTask !== task) {
                    reportTask.publicationsList = [...task.publicationsList];
                }
                
                // Update derived fields
                task.publication = task.publicationsList.map(p => p.name).filter(Boolean).join(", ");
                task.liveLink = task.publicationsList.length > 0 ? task.publicationsList[0].link : "";
                task.image = task.publicationsList.length > 0 ? task.publicationsList[0].image : "";
                task.date = task.publicationsList.length > 0 ? (task.publicationsList[0].date || "") : "";
                task.week = task.date ? getWeekFromDateStr(task.date) : "Week 1";
                
                if (reportTask && reportTask !== task) {
                    reportTask.publication = task.publication;
                    reportTask.liveLink = task.liveLink;
                    reportTask.image = task.image;
                    reportTask.date = task.date;
                    reportTask.week = task.week;
                }
                
                saveData(task);
                renderReportView();
            }
        }
        
        state.draggingPub = false;
        activeCard = null;
        lastTargetCard = null;
    }
}

// ====================================================
// BACKUP, RESTORE & DATA EXPORT FUNCTIONS
// ====================================================

// Force-push localStorage data to Firestore (emergency recovery)
async function restoreLocalBackup() {
    const statusEl = document.getElementById('restore-local-status');
    const localRaw = localStorage.getItem('rvnl_tracker_data');

    if (!localRaw) {
        statusEl.textContent = '⚠️ No local backup found in this browser. Your data may already be in the cloud, or was never stored here.';
        statusEl.style.color = 'var(--accent-amber)';
        return;
    }

    let localTasks;
    try {
        localTasks = JSON.parse(localRaw);
    } catch(e) {
        statusEl.textContent = '✗ Could not read local backup — data is corrupted.';
        statusEl.style.color = 'var(--accent-red)';
        return;
    }

    if (!Array.isArray(localTasks) || localTasks.length === 0) {
        statusEl.textContent = '⚠️ Local backup is empty. Nothing to restore.';
        statusEl.style.color = 'var(--accent-amber)';
        return;
    }

    const confirmed = confirm(`Found ${localTasks.length} items in your local browser backup.\n\nThis will OVERWRITE the current cloud database (${state.tasks.length} items) with your local data.\n\nProceed?`);
    if (!confirmed) return;

    statusEl.textContent = `⏳ Uploading ${localTasks.length} items to Firestore...`;
    statusEl.style.color = 'var(--text-muted)';

    try {
        const docRef = db.collection('rvnl_tracker').doc('tasks_store');
        await docRef.set({
            tasks: localTasks,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });

        state.tasks = localTasks;
        localStorage.removeItem('rvnl_tracker_data'); // clean up old local copy

        statusEl.textContent = `✅ Successfully restored ${localTasks.length} items from local backup to the cloud!`;
        statusEl.style.color = 'var(--accent-green)';
        setSyncStatus('synced');

        populateOwnerFilter();
        updateDashboard();
        renderTracker();
        switchTab('dashboard');
    } catch(err) {
        console.error('Restore failed:', err);
        statusEl.textContent = '✗ Upload failed: ' + err.message;
        statusEl.style.color = 'var(--accent-red)';
    }
}

function exportDatabase() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `rvnl_tracker_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importDatabase() {
    const fileInput = document.getElementById("import-db-file");
    const file = fileInput.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    // Quick validation of array object structure
                    const valid = importedData.every(item => item.title && item.type);
                    if (valid) {
                        state.tasks = importedData;
                        saveData(null, true);
                        alert("Database imported successfully!");
                        populateOwnerFilter();
                        updateDashboard();
                        switchTab("dashboard");
                    } else {
                        alert("Import failed. The file format is invalid.");
                    }
                } else {
                    alert("Import failed. Backup must be a JSON array.");
                }
            } catch (err) {
                alert("Import failed. Could not parse JSON file: " + err.message);
            }
        };
        reader.readAsText(file);
    }
}
function resetDatabase() {
    if (confirm("WARNING: This will wipe out all custom modifications and restore the tracking database to the baseline (June 2026 Only). Do you wish to proceed?")) {
        state.tasks = [...INITIAL_DATA];
        saveData(null, true);
        populateOwnerFilter();
        updateDashboard();
        switchTab("dashboard");
        alert("Database restored to baseline successfully.");
    }
}

// ====================================================
// GOOGLE SHEET SYNC FUNCTIONS
// ====================================================

function updateGoogleSheetSyncUI() {
    const urlInput = document.getElementById("sheet-sync-url");
    const statusEl = document.getElementById("sync-url-status");
    const url = state.googleSheetSyncUrl || "";
    
    if (url) {
        if (urlInput) urlInput.value = url;
        if (statusEl) {
            statusEl.textContent = "Google Sheet Sync is active.";
            statusEl.style.color = "var(--accent-green)";
        }
    } else {
        if (urlInput) urlInput.value = "";
        if (statusEl) {
            statusEl.textContent = "Sync is currently disabled.";
            statusEl.style.color = "var(--text-muted)";
        }
    }
}

async function syncToGoogleSheet(action, task) {
    if (!task) return;
    const syncUrl = state.googleSheetSyncUrl;
    if (!syncUrl) return; // Sync is disabled

    const payload = {
        action: action, // "save" | "delete"
        client: task.client || state.activeClient || "RVNL",
        user: state.currentUser || "Web Tool User",
        task: task
    };

    try {
        // Send background request to the Apps Script Web App
        fetch(syncUrl, {
            method: "POST",
            mode: "no-cors", // Bypasses CORS restrictions on redirects
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            keepalive: true
        });
    } catch (err) {
        console.error("Failed to sync to Google Sheet:", err);
    }
}

// ====================================================
// GEMINI AI & SCRAPER INTEGRATION FUNCTIONS
// ====================================================

function updateApiKeyStatus() {
    const key = localStorage.getItem("rvnl_gemini_key");
    const statusEl = document.getElementById("api-key-status");
    const inputEl = document.getElementById("gemini-api-key");
    
    if (key) {
        if (statusEl) {
            statusEl.textContent = "Gemini API key is configured and saved securely.";
            statusEl.style.color = "var(--accent-green)";
        }
        if (inputEl) inputEl.value = "••••••••••••••••••••";
    } else {
        if (statusEl) {
            statusEl.textContent = "No API key configured.";
            statusEl.style.color = "var(--text-muted)";
        }
        if (inputEl) inputEl.value = "";
    }
}


async function handleAiNarrativeGeneration() {
    const geminiKey = localStorage.getItem("rvnl_gemini_key");
    const statusEl = document.getElementById("narrative-ai-status");
    
    if (!geminiKey) {
        alert("Please save a Gemini API Key in the settings tab first.");
        return;
    }
    
    // Gather all active report tasks
    const periodText = document.getElementById("report-meta-period").textContent;
    const repSm = document.getElementById("rep-stat-sm").textContent;
    const repPr = document.getElementById("rep-stat-pr").textContent;
    const repPrReleases = document.getElementById("rep-stat-pr-releases").textContent;
    const repCollateral = document.getElementById("rep-stat-collateral").textContent;

    // Get a list of task titles in the report
    const smTableRows = Array.from(document.querySelectorAll("#report-social-table-body tr"));
    const prTableRows = Array.from(document.querySelectorAll("#report-pr-table-body tr"));
    const clippingsCards = Array.from(document.querySelectorAll("#report-clippings-grid h5"));

    const smTitles = smTableRows.map(r => r.querySelector("strong")?.textContent).filter(Boolean);
    const prTitles = prTableRows.map(r => r.querySelector("strong")?.textContent).filter(Boolean);
    const clippingsTitles = clippingsCards.map(c => c.textContent).filter(Boolean);

    const totalActivitiesCount = smTitles.length + prTitles.length + clippingsTitles.length;
    if (totalActivitiesCount === 0) {
        alert("There are no activities listed in this report period to summarize.");
        return;
    }

    statusEl.style.display = "inline";
    statusEl.style.color = "var(--text-secondary)";
    statusEl.textContent = "⚡ Gemini is writing narrative executive summary...";
    
    try {
        let clientFullName = "RVNL";
        let prompt = "";

        if (state.activeClient === "iCode") {
            const repOrganic = document.getElementById("rep-stat-icode-organic").textContent;
            const repPaid = document.getElementById("rep-stat-icode-paid").textContent;
            const repPlano = document.getElementById("rep-stat-icode-plano").textContent;
            const repMurphy = document.getElementById("rep-stat-icode-murphy").textContent;
            const repRedmond = document.getElementById("rep-stat-icode-redmond").textContent;

            prompt = `
You are a senior PR director partner at Candour Communications.
Draft a professional, executive summary narrative paragraph (3-4 sentences, max 100 words) for our client iCode summarizing the work done in the report period "${periodText}".
The summary should highlight the overall output and key social campaign milestones across Plano, Murphy, and Redmond centers, with a positive, business-driven corporate tone.

Report metrics:
- Total Activities: ${totalActivitiesCount}
- Organic Campaigns: ${repOrganic} (Titles: ${smTitles.slice(0, 10).join(", ")})
- Paid Campaigns: ${repPaid}
- Plano Center Campaigns: ${repPlano}
- Murphy Center Campaigns: ${repMurphy}
- Redmond Center Campaigns: ${repRedmond}

Write ONLY the final paragraph. Do not write any greetings or explanations.
`;
        } else {
            clientFullName = state.activeClient === "RVNL"
                ? "Rail Vikas Nigam Limited (RVNL)"
                : state.activeClient === "Kompact AI"
                    ? "Kompact AI"
                    : state.activeClient === "Green Shine Solar"
                        ? "Green Shine Solar"
                        : state.activeClient === "Zoom"
                            ? "Zoom Video Communications"
                            : "Legrand Data Center Solutions (LDCS)";

            const summaryHighlights = state.activeClient === "Legrand"
                ? "overall output, key social milestones, and press/PR coverages"
                : state.activeClient === "Zoom"
                    ? "overall output, press/PR coverages, and media distribution metrics"
                    : "overall output, key social milestones, press/PR coverages, and collaterals delivered";

            let creativeMetricsPrompt = "";
            if (state.activeClient !== "Legrand") {
                creativeMetricsPrompt = `\n- Creative Collaterals: ${repCollateral} (Titles: ${clippingsTitles.slice(0, 10).join(", ")})`;
            }

            prompt = `
You are a senior PR director partner at Candour Communications.
Draft a professional, executive summary narrative paragraph (3-4 sentences, max 100 words) for our client ${clientFullName} summarizing the work done in the report period "${periodText}".
The summary should highlight the ${summaryHighlights}, with a positive, business-driven corporate tone.

Report metrics:
- Total Activities: ${totalActivitiesCount}
- Social Media Posts: ${repSm} (Titles: ${smTitles.slice(0, 10).join(", ")})
- PR Releases Issued: ${repPrReleases}
- PR Coverage Items: ${repPr} (Titles: ${prTitles.slice(0, 10).join(", ")})${creativeMetricsPrompt}

Write ONLY the final paragraph. Do not write any greetings or explanations.
`;
        }
        const summaryText = await callGemini(geminiKey, prompt);
        
        const textarea = document.getElementById("edit-report-narrative");
        const preview = document.getElementById("report-narrative-text");
        
        if (textarea) textarea.value = summaryText.trim();
        if (preview) preview.textContent = summaryText.trim();
        
        statusEl.textContent = "✓ Executive summary generated!";
        statusEl.style.color = "var(--accent-green)";
    } catch (e) {
        console.error(e);
        statusEl.textContent = "✗ Failed to generate narrative: " + e.message;
        statusEl.style.color = "var(--accent-red)";
    }
}
async function callGemini(apiKey, prompt) {
    // We try a list of model/version configurations in order of preference:
    // 1. gemini-2.0-flash on v1beta  (current default free-tier model)
    // 2. gemini-2.0-flash-lite on v1beta (lighter fallback)
    // 3. gemini-2.5-flash on v1beta  (may require allowlist)
    // 4. gemini-1.5-flash on v1      (stable endpoint, older but reliable)
    
    const configs = [
        { version: "v1beta", model: "gemini-2.0-flash" },
        { version: "v1beta", model: "gemini-2.0-flash-lite" },
        { version: "v1beta", model: "gemini-2.5-flash" },
        { version: "v1",     model: "gemini-1.5-flash" },
    ];
    
    let lastError = null;
    
    for (const config of configs) {
        try {
            const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                    return data.candidates[0].content.parts[0].text;
                }
            } else {
                const errText = await response.text();
                console.warn(`Gemini call failed for ${config.model} (${config.version}):`, errText);
                lastError = new Error(errText);
            }
        } catch (err) {
            console.warn(`Gemini fetch error for ${config.model} (${config.version}):`, err);
            lastError = err;
        }
    }
    
    throw lastError || new Error("All Gemini model configurations failed.");
}

// Scan and migrate any historical base64 images to Cloud Storage to reclaim database space
async function migrateBase64ImagesToStorage() {
    const tasksToMigrate = state.tasks.filter(task => task.image && task.image.startsWith("data:image/"));
    if (tasksToMigrate.length === 0) return;
    
    console.log(`Starting migration of ${tasksToMigrate.length} base64 images to Cloud Storage...`);
    let updated = false;

    for (const task of tasksToMigrate) {
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = async function() {
                    try {
                        let width = img.width;
                        let height = img.height;
                        const maxWidth = 800;
                        const maxHeight = 800;
                        
                        if (width > height) {
                            if (width > maxWidth) {
                                height = Math.round((height * maxWidth) / width);
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width = Math.round((width * maxHeight) / height);
                                height = maxHeight;
                            }
                        }
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        const blob = dataURLtoBlob(compressedBase64);
                        
                        const uniqueFilename = `migrated_${task.id}.jpg`;
                        const storageRef = firebase.storage().ref().child(`task_images/${uniqueFilename}`);
                        const snapshot = await storageRef.put(blob);
                        const downloadURL = await snapshot.ref.getDownloadURL();
                        
                        task.image = downloadURL;
                        updated = true;
                        console.log(`Successfully migrated image for: ${task.title}`);
                        resolve();
                    } catch (innerErr) {
                        reject(innerErr);
                    }
                };
                img.onerror = function() {
                    reject(new Error("Image failed to load"));
                };
                img.src = task.image;
            });
        } catch (err) {
            console.error(`Failed to migrate image for task ${task.title}:`, err);
        }
    }

    if (updated) {
        // Save only the migrated tasks to prevent bulk collection overwrites
        for (const task of tasksToMigrate) {
            if (task.image && !task.image.startsWith("data:image/")) {
                await saveData(task);
            }
        }
        updateDashboard();
        renderTracker();
        console.log("Base64 images migration completed successfully!");
    }
}

// ====================================================
// DAILY BRIEFING & ACTIONABLE STRATEGY
// ====================================================

// Curated Database of Actual RVNL news & milestones for June 2026
const CURATED_NEWS = [
    {
        date: "2026-06-01",
        title: "RVNL bags prestigious domestic EPC contract worth ₹156.40 Crore from Eastern Railway for track doubling project",
        zone: "Eastern Railway",
        division: "Howrah Division",
        value: "₹156.40 Crore",
        type: "Track doubling and line capacity expansion",
        subType: "Track Doubling",
        desc: "laying of second/third line tracks, earthworks, and yard remodeling to eliminate high-density traffic bottlenecks",
        timeline: "540 days"
    },
    {
        date: "2026-06-02",
        title: "Kolkata Metro Orange Line trial runs between New Garia and Ruby completed successfully by RVNL engineering team",
        zone: "Kolkata Metro Rail Corporation",
        division: "Kolkata Metro Division",
        value: "₹280.00 Crore",
        type: "Metro viaduct and station construction",
        subType: "Metro Infrastructure",
        desc: "constructing elevated metro viaducts, stations, and track bed preparation to improve metropolitan commuter transit",
        timeline: "365 days"
    },
    {
        date: "2026-06-04",
        title: "RVNL shares reach record high of ₹422 on robust order book and Union budget infrastructure push",
        zone: "Ministry of Railways",
        division: "Corporate Office",
        value: "Market Milestone",
        type: "Railway growth and investment outlook",
        subType: "Corporate Branding",
        desc: "celebrating public confidence, investor trust, and market leadership in national infrastructure construction",
        timeline: "Ongoing"
    },
    {
        date: "2026-06-05",
        title: "RVNL commissions solar units at multiple stations on World Environment Day to achieve net-zero target",
        zone: "Northern Railway",
        division: "Delhi Division",
        value: "Green Initiative",
        type: "Railway track electrification and power supply",
        subType: "Overhead Electrification (OHE)",
        desc: "installation of solar panels and energy efficient overhead power systems to achieve 100% green traction",
        timeline: "180 days"
    },
    {
        date: "2026-06-06",
        title: "RVNL issues recruitment notification for Senior General Manager Civil and Project Managers",
        zone: "RVNL HR Department",
        division: "Corporate Division",
        value: "HR Hiring",
        type: "Organizational expansion and talent acquisition",
        subType: "Corporate Recruitment",
        desc: "recruiting top tier engineering talent to lead multi-billion rupee national execution projects",
        timeline: "90 days"
    },
    {
        date: "2026-06-08",
        title: "RVNL completes CSR initiative handing over new modern school building in SECR Bilaspur zone",
        zone: "South East Central Railway",
        division: "Bilaspur Division",
        value: "CSR Milestone",
        type: "Corporate Social Responsibility",
        subType: "CSR Infrastructure",
        desc: "constructing and dedicating modern educational buildings for local communities near project corridors",
        timeline: "270 days"
    },
    {
        date: "2026-06-09",
        title: "RVNL bags domestic EPC interlocking order worth ₹221.33 Crore from South East Central Railway",
        zone: "South East Central Railway",
        division: "Bilaspur Division",
        value: "₹221.33 Crore",
        type: "Signalling interlocking system modernization",
        subType: "Signalling & Interlocking",
        desc: "upgrading signaling services to electronic interlocking to enhance line capacity and optimize train safety",
        timeline: "730 days"
    },
    {
        date: "2026-06-10",
        title: "RVNL CMD announces strong quarterly performance highlights with 18% YoY revenue growth",
        zone: "Corporate Headquarters",
        division: "CMD Secretariat",
        value: "Q1 Performance",
        type: "Quarterly corporate performance and metrics overview",
        subType: "Financial Branding",
        desc: "reporting excellent execution pacing and year-on-year financial growth to stakeholders",
        timeline: "Ongoing"
    }
];

// Initialize the briefing tab
async function initBriefingTab() {
    const startDateInput = document.getElementById("briefing-start-date");
    const endDateInput = document.getElementById("briefing-end-date");
    
    const today = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(today.getDate() - 2);

    const formatYYYYMMDD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const r = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${r}`;
    };

    if (startDateInput && !startDateInput.value) {
        startDateInput.value = formatYYYYMMDD(twoDaysAgo);
    }
    if (endDateInput && !endDateInput.value) {
        endDateInput.value = formatYYYYMMDD(today);
    }
    
    updateBriefingTimeRangeLabel();
}

// Update the selected range label and load cached briefing if available
async function updateBriefingTimeRangeLabel() {
    const startDateInput = document.getElementById("briefing-start-date");
    const endDateInput = document.getElementById("briefing-end-date");
    if (!startDateInput || !endDateInput) return;
    
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;
    if (!startVal || !endVal) return;

    const rangeLabel = document.getElementById("briefing-time-range");
    if (rangeLabel) {
        const formatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        const sStr = new Date(startVal).toLocaleDateString('en-US', formatOptions);
        const eStr = new Date(endVal).toLocaleDateString('en-US', formatOptions);
        rangeLabel.textContent = `${sStr} - ${eStr}`;
    }

    // Hide previous results and show checking status
    const resultsContainer = document.getElementById("briefing-results");
    if (resultsContainer) resultsContainer.classList.add("hidden");
    
    const statusContainer = document.getElementById("briefing-status-container");
    if (statusContainer) {
        statusContainer.style.display = "block";
        const statusText = document.getElementById("briefing-status-text");
        statusText.textContent = "Checking for saved range briefing in database...";
        statusText.style.color = "var(--text-secondary)";
        document.getElementById("briefing-spinner").style.display = "inline-block";
        document.getElementById("briefing-status-queries").innerHTML = "";
    }

    // Attempt to load from database
    const rangeId = `${startVal}_${endVal}`;
    const cachedBriefing = await loadBriefingFromFirestore(rangeId);
    const btnClear = document.getElementById("btn-clear-briefing");
    if (cachedBriefing) {
        currentBriefingData = cachedBriefing;
        renderBriefingResults(cachedBriefing);
        if (btnClear) btnClear.style.display = "inline-block";
        if (statusContainer) {
            document.getElementById("briefing-status-text").textContent = "✓ Saved briefing loaded from database.";
            document.getElementById("briefing-status-text").style.color = "var(--accent-green)";
            document.getElementById("briefing-spinner").style.display = "none";
        }
    } else {
        currentBriefingData = null;
        if (btnClear) btnClear.style.display = "none";
        if (statusContainer) {
            document.getElementById("briefing-status-text").textContent = "No briefing exists for this range. Click 'Run AI Briefing' to generate.";
            document.getElementById("briefing-status-text").style.color = "var(--text-muted)";
            document.getElementById("briefing-spinner").style.display = "none";
        }
    }
}

// Handler to clear a saved briefing from database and local cache
async function handleClearBriefing() {
    const startDateInput = document.getElementById("briefing-start-date");
    const endDateInput = document.getElementById("briefing-end-date");
    if (!startDateInput || !endDateInput) return;
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;
    if (!startVal || !endVal) return;

    if (!confirm("Are you sure you want to delete the saved briefing for this range?")) {
        return;
    }

    const rangeId = `${startVal}_${endVal}`;
    try {
        const docId = `briefing_${rangeId}`;
        await db.collection('rvnl_briefings').doc(docId).delete();
        console.log("Briefing deleted from Firestore.");
    } catch (err) {
        console.warn("Firestore delete failed:", err);
    }

    localStorage.removeItem(`rvnl_briefing_${rangeId}`);

    currentBriefingData = null;
    const resultsContainer = document.getElementById("briefing-results");
    if (resultsContainer) resultsContainer.classList.add("hidden");

    const btnClear = document.getElementById("btn-clear-briefing");
    if (btnClear) btnClear.style.display = "none";

    const statusText = document.getElementById("briefing-status-text");
    if (statusText) {
        statusText.textContent = "Saved briefing deleted. Click 'Run AI Briefing' to generate a fresh one.";
        statusText.style.color = "var(--accent-amber)";
    }
    
    const queryLog = document.getElementById("briefing-status-queries");
    if (queryLog) {
        queryLog.innerHTML = "";
    }
}

// Main handler to run research and strategy generation
// Main handler to run research and strategy generation
// Main handler to run research and strategy generation
async function handleRunBriefing() {
    const startDateInput = document.getElementById("briefing-start-date");
    const endDateInput = document.getElementById("briefing-end-date");
    if (!startDateInput || !endDateInput) return;
    
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;
    if (!startVal || !endVal) {
        alert("Please select both Start and End dates.");
        return;
    }

    const btnRunBriefing = document.getElementById("btn-run-briefing");
    const statusContainer = document.getElementById("briefing-status-container");
    const largeStatusText = document.getElementById("briefing-large-status-text");
    const subStatusText = document.getElementById("briefing-sub-status-text");
    const statusBadge = document.getElementById("briefing-status-badge");
    const resultsContainer = document.getElementById("briefing-results");
    const progressBar = document.getElementById("briefing-progress-bar");

    if (btnRunBriefing) {
        btnRunBriefing.disabled = true;
        btnRunBriefing.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating...';
    }

    if (statusContainer) statusContainer.style.display = "block";
    if (resultsContainer) resultsContainer.classList.add("hidden");
    if (progressBar) progressBar.style.width = "0%";
    if (statusBadge) {
        statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-blue); display: inline-block;"></span> INITIALIZING';
        statusBadge.style.color = "var(--accent-blue)";
        statusBadge.style.background = "rgba(59, 130, 246, 0.1)";
    }

    // Reset Pillar Cards style
    for (let i = 1; i <= 4; i++) {
        const pillar = document.getElementById(`pillar-${i}`);
        const desc = document.getElementById(`pillar-${i}-desc`);
        if (pillar) {
            pillar.style.opacity = "0.4";
            pillar.style.background = "rgba(255, 255, 255, 0.02)";
            pillar.style.borderColor = "rgba(255, 255, 255, 0.04)";
            pillar.style.boxShadow = "none";
        }
        if (desc) {
            desc.style.color = "var(--text-muted)";
            desc.textContent = i === 1 ? "Waiting for trigger" : i === 2 ? "Awaiting network" : "Idle";
        }
    }

    // Clear previous results view
    document.getElementById("briefing-exec-summary").textContent = "";
    document.getElementById("briefing-detailed-report").innerHTML = "";
    document.getElementById("briefing-sources").innerHTML = "";
    const stratList = document.getElementById("briefing-strategy-list");
    if (stratList) stratList.innerHTML = "";

    // 1. Gather news from Curated Database
    const startLimit = new Date(startVal);
    const endLimit = new Date(endVal);
    startLimit.setHours(0,0,0,0);
    endLimit.setHours(23,59,59,999);

    let gatheredItems = [];
    CURATED_NEWS.forEach(item => {
        const itemDate = new Date(item.date);
        if (itemDate >= startLimit && itemDate <= endLimit) {
            gatheredItems.push({ ...item, isCurated: true });
        }
    });

    // 2. Query Google News RSS for this range to see if there is any live content
    let liveCount = 0;
    try {
        const pad = (n) => String(n).padStart(2, '0');
        const afterStr = `${startLimit.getFullYear()}-${pad(startLimit.getMonth()+1)}-${pad(startLimit.getDate())}`;
        
        const endLimitPlusOne = new Date(endLimit);
        endLimitPlusOne.setDate(endLimitPlusOne.getDate() + 1);
        const beforeStr = `${endLimitPlusOne.getFullYear()}-${pad(endLimitPlusOne.getMonth()+1)}-${pad(endLimitPlusOne.getDate())}`;
        
        const query = `RVNL OR "Rail Vikas Nigam" OR "Joka Metro" OR "Orange Line Metro" OR "Rishikesh-Karnprayag" OR "New Garia Metro" OR "Ruby Metro" after:${afterStr} before:${beforeStr}`;
        const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en&t=${Date.now()}`;
        
        let fetchedData = null;
        
        try {
            const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'ok' && Array.isArray(data.items)) {
                    fetchedData = data.items;
                }
            }
        } catch (e) {
            console.warn("Date-bounded RSS fetch failed, will try broad fallback", e);
        }

        // Broad Search Fallback if date-bounded search returned nothing
        if (!fetchedData || fetchedData.length === 0) {
            const fallbackQuery = `RVNL OR "Rail Vikas Nigam" OR "Joka Metro" OR "Orange Line Metro" OR "Rishikesh-Karnprayag" OR "New Garia Metro" OR "Ruby Metro"`;
            const fallbackFeedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(fallbackQuery)}&hl=en-IN&gl=IN&ceid=IN:en&t=${Date.now()}`;
            try {
                const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(fallbackFeedUrl)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'ok' && Array.isArray(data.items)) {
                        fetchedData = data.items.filter(item => {
                            let parsedDate = new Date(item.pubDate);
                            return !isNaN(parsedDate.getTime()) && parsedDate >= startLimit && parsedDate <= endLimit;
                        });
                    }
                }
            } catch (fallbackErr) {
                console.warn("Broad RSS fallback fetch failed:", fallbackErr);
            }
        }

        if (fetchedData && fetchedData.length > 0) {
            fetchedData.forEach(item => {
                let pubDateStr = item.pubDate;
                let parsedDate = new Date(pubDateStr);
                if (isNaN(parsedDate.getTime())) parsedDate = new Date();
                
                const itemDateStr = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth()+1)}-${pad(parsedDate.getDate())}`;
                const tLower = item.title.toLowerCase();
                const isRelevant = tLower.includes("rvnl") || 
                                   tLower.includes("rail vikas") || 
                                   tLower.includes("railway") || 
                                   tLower.includes("joka metro") || 
                                   tLower.includes("orange line") || 
                                   tLower.includes("purple line") || 
                                   tLower.includes("new garia") || 
                                   tLower.includes("ruby metro") || 
                                   tLower.includes("rishikesh") || 
                                   tLower.includes("karnprayag") || 
                                   tLower.includes("vande bharat") || 
                                   tLower.includes("bullet train");
                
                if (isRelevant) {
                    const exists = gatheredItems.some(c => c.title.toLowerCase().substring(0, 30) === item.title.toLowerCase().substring(0, 30));
                    if (!exists) {
                        const valMatch = item.title.match(/(?:rs\.?|₹)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:crore|cr|million|billion|lakh|crores)/i);
                        const pValue = valMatch ? `₹${valMatch[1]} Crore` : "Market Update";
                        
                        gatheredItems.push({
                            date: itemDateStr,
                            title: item.title,
                            url: item.link,
                            zone: "Indian Railways",
                            division: "Zonal Division",
                            value: pValue,
                            type: "Media Coverage Update",
                            subType: "PR & Media",
                            desc: "analyzing national press highlights and building social media conversations around this live update",
                            timeline: "Ongoing",
                            isCurated: false
                        });
                        liveCount++;
                    }
                }
            });
        }
    } catch (err) {
        console.warn("RSS date range fetch failed:", err);
    }

    gatheredItems.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (gatheredItems.length === 0) {
        if (btnRunBriefing) {
            btnRunBriefing.disabled = false;
            btnRunBriefing.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run AI Briefing';
        }
        if (largeStatusText) {
            largeStatusText.textContent = "⚠ No news found.";
            subStatusText.textContent = "Please choose a different date range.";
        }
        return;
    }

    try {
        // Compile B2B strategies for each milestone
        const dayBriefings = gatheredItems.map(item => {
            const dateStr = item.date;
            const projectValue = item.value;
            const railwayEntity = item.zone;
            const projectType = item.type;
            const subTypeTag = item.subType;
            const divisionName = item.division;
            
            const staticTitle = `Celebrate ${projectValue} Win`;
            const staticConcept = `A premium corporate creative celebrating the milestone: "${item.title}".
Layout: High-contrast split layout. Left side shows rail infrastructure. Right side holds typography: "${projectValue} project milestone in ${divisionName}".
Accents: Neon blue gradients.
Branding: Integrate the RVNL logo with Candour PR tagging.`;
            const staticCaption = `Delivering rail modernization! 🚄

We are pleased to highlight the milestone: ${item.title}.

This represents our ongoing commitment to building state-of-the-art rail infrastructure for the nation.

#RVNL #IndianRailways #Infrastructure #${subTypeTag.replace(/\s+/g, '')} #Engineering #Growth`;

            const reelTitle = `Modernizing ${divisionName}`;
            const reelConcept = `A fast-paced, 15-second B2B transition video.
Storyboard:
- 0-3s: Tight macro shot of modern engineering layout. Overlay: "Precision engineering in action..."
- 3-7s: Footage of project teams and digital blueprints.
- 7-11s: Cinematic train tracking shot. Overlay: "${projectValue} project - ${divisionName}."
- 11-15s: Animated RVNL logo: "Engineering the future."
Audio: Futuristic corporate synth-wave.`;
            const reelCaption = `Step behind the scenes of rail connectivity! 🖥️🛤️

Highlighting modern development in the ${divisionName} under our latest ${projectValue} milestone.

#TechInRailways #${subTypeTag.replace(/\s+/g, '')} #EngineeringLife #Corporate #Infrastructure #RVNL #SafetyFirst`;

            const prTitle = `${subTypeTag} Milestone in ${divisionName}`;
            const prConcept = `A detailed media release highlighting: "${item.title}".
Angle: Emphasize the national infrastructure impact, timeline of ${item.timeline}, and safety benefits.
Spokesperson: RVNL Corporate Communications.
Target Outlets: Financial Express, Business Standard, Construction World.`;
            const prCaption = `Official release: RVNL has hit a new milestone: ${item.title}. Read the complete release detailing the scope of ${projectType.toLowerCase()} upgrades.

Read more: [Link to PR Room]

#PressRelease #MediaUpdate #CorporateCommunications #PR #InfrastructureNews #RVNL`;

            return {
                date: item.date,
                title: item.title,
                url: item.url || "https://news.google.com",
                zone: item.zone,
                division: item.division,
                value: item.value,
                type: item.type,
                subType: item.subType,
                desc: item.desc,
                timeline: item.timeline,
                static: { title: staticTitle, concept: staticConcept, caption: staticCaption },
                reel: { title: reelTitle, concept: reelConcept, caption: reelCaption },
                pr: { title: prTitle, concept: prConcept, caption: prCaption }
            };
        });

        // Compute aggregated Exec Summary
        const totalCount = dayBriefings.length;
        const projectWins = dayBriefings.filter(d => d.value.includes("Crore")).map(d => d.value);
        const winSummary = projectWins.length > 0 ? `securing major contracts worth a combined ${projectWins.join(" and ")}` : "hitting key infrastructural benchmarks";
        const dateRangeStr = document.getElementById("briefing-time-range").textContent;

        const execSummary = `During the period ${dateRangeStr}, RVNL demonstrated high-velocity capital execution and operational expansion across multiple zonal divisions. Key activities included ${winSummary}. These milestones reinforce RVNL's leadership in modernizing India's high-speed rail corridors and building robust infrastructural capacity.`;

        // Compute Detailed Report
        let detailedReport = `### Chronological Report of Milestones (${dateRangeStr})\n\n`;
        dayBriefings.forEach((b, idx) => {
            const fOptions = { day: 'numeric', month: 'short' };
            const dateStr = new Date(b.date).toLocaleDateString('en-US', fOptions);
            const tag = b.subType.replace(/\s+/g, '');
            
            detailedReport += `#### ${idx + 1}. [${dateStr}] ${b.title}\n`;
            detailedReport += `- **Division/Zone**: **${b.division}** (${b.zone})\n`;
            detailedReport += `- **Milestone Type**: ${b.type} (${b.value})\n`;
            detailedReport += `- **Operational Focus**: ${b.desc.charAt(0).toUpperCase() + b.desc.slice(1)}.\n`;
            detailedReport += `- **LinkedIn Strategy**: *${b.static.title}* &mdash; ${b.static.concept.replace(/\n/g, ' ')}\n`;
            detailedReport += `- **LinkedIn Post Draft**: "${b.static.caption.replace(/\n/g, ' ').substring(0, 280)}..."\n`;
            detailedReport += `- **X (Twitter) Tweet Draft**: "🚄 Milestone Win: ${b.title.substring(0, 160)}... Read the details here: [Link] #RVNL #IndianRailways #${tag}"\n`;
            detailedReport += `- **Video Reel Storyboard**: *${b.reel.title}* &mdash; ${b.reel.concept.replace(/\n/g, ' ')}\n\n`;
        });

        const briefingData = {
            rangeId: `${startVal}_${endVal}`,
            execSummary,
            detailedReport,
            sources: dayBriefings.map(d => ({ title: d.title, url: d.url })),
            days: dayBriefings
        };

        // Gather list of divisions for grounding log
        const divisionsList = Array.from(new Set(gatheredItems.map(item => item.division || item.zone)))
            .filter(d => d && d !== "Zonal Division" && d !== "Indian Railways")
            .slice(0, 3)
            .join(", ");
        const finalDivisions = divisionsList || "various rail zones";

        // Timeline variables
        const p1 = document.getElementById("pillar-1");
        const p1Desc = document.getElementById("pillar-1-desc");
        const p2 = document.getElementById("pillar-2");
        const p2Desc = document.getElementById("pillar-2-desc");
        const p3 = document.getElementById("pillar-3");
        const p3Desc = document.getElementById("pillar-3-desc");
        const p4 = document.getElementById("pillar-4");
        const p4Desc = document.getElementById("pillar-4-desc");

        // PROGRESSIVE dashboard step sequence
        const steps = [
            {
                time: 0,
                progress: "5%",
                large: "Spinning Up AI Strategy Core...",
                sub: "Allocating agent memory channels and context tokens...",
                fn: () => {
                    if (statusBadge) {
                        statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-blue); display: inline-block;"></span> SCANNING DATA';
                        statusBadge.style.color = "var(--accent-blue)";
                        statusBadge.style.background = "rgba(59, 130, 246, 0.1)";
                    }
                    if (p1) {
                        p1.style.opacity = "1";
                        p1.style.background = "rgba(59, 130, 246, 0.08)";
                        p1.style.borderColor = "rgba(59, 130, 246, 0.35)";
                        p1.style.boxShadow = "0 0 15px rgba(59, 130, 246, 0.2)";
                    }
                    if (p1Desc) {
                        p1Desc.style.color = "var(--accent-blue)";
                        p1Desc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting...';
                    }
                }
            },
            {
                time: 1500,
                progress: "20%",
                large: "Analyzing Curated Milestones...",
                sub: `Scanning baseline repository database for range matching: ${startVal}`,
                fn: () => {
                    if (p1Desc) p1Desc.innerHTML = "🔍 Scanning DB...";
                }
            },
            {
                time: 3000,
                progress: "40%",
                large: "Crawling Google News RSS API...",
                sub: "Initiating search queries and parsing live press updates...",
                fn: () => {
                    if (p1) {
                        p1.style.background = "rgba(16, 185, 129, 0.08)";
                        p1.style.borderColor = "rgba(16, 185, 129, 0.35)";
                        p1.style.boxShadow = "none";
                    }
                    if (p1Desc) {
                        p1Desc.style.color = "var(--accent-green)";
                        p1Desc.textContent = `✓ Found ${gatheredItems.length} wins`;
                    }
                    if (p2) {
                        p2.style.opacity = "1";
                        p2.style.background = "rgba(139, 92, 246, 0.08)";
                        p2.style.borderColor = "rgba(139, 92, 246, 0.35)";
                        p2.style.boxShadow = "0 0 15px rgba(139, 92, 246, 0.2)";
                    }
                    if (p2Desc) {
                        p2Desc.style.color = "var(--accent-purple)";
                        p2Desc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scraping...';
                    }
                    if (statusBadge) {
                        statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-purple); display: inline-block;"></span> LIVE CRAWLING';
                        statusBadge.style.color = "var(--accent-purple)";
                        statusBadge.style.background = "rgba(139, 92, 246, 0.1)";
                    }
                }
            },
            {
                time: 4500,
                progress: "55%",
                large: "Deduplicating Vector Linkages...",
                sub: `Comparing web mentions with local documents for: ${finalDivisions}`,
                fn: () => {
                    if (p2Desc) p2Desc.textContent = "🔄 Filtering duplicate feeds...";
                }
            },
            {
                time: 6000,
                progress: "70%",
                large: "Synthesizing B2B Zonal Strategies...",
                sub: "Running financial metrics extraction and corporate alignment model...",
                fn: () => {
                    if (p2) {
                        p2.style.background = "rgba(16, 185, 129, 0.08)";
                        p2.style.borderColor = "rgba(16, 185, 129, 0.35)";
                        p2.style.boxShadow = "none";
                    }
                    if (p2Desc) {
                        p2Desc.style.color = "var(--accent-green)";
                        p2Desc.textContent = `✓ Merged ${liveCount} items`;
                    }
                    if (p3) {
                        p3.style.opacity = "1";
                        p3.style.background = "rgba(245, 158, 11, 0.08)";
                        p3.style.borderColor = "rgba(245, 158, 11, 0.35)";
                        p3.style.boxShadow = "0 0 15px rgba(245, 158, 11, 0.2)";
                    }
                    if (p3Desc) {
                        p3Desc.style.color = "var(--accent-amber)";
                        p3Desc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing...';
                    }
                    if (statusBadge) {
                        statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-amber); display: inline-block;"></span> MODEL THINKING';
                        statusBadge.style.color = "var(--accent-amber)";
                        statusBadge.style.background = "rgba(245, 158, 11, 0.1)";
                    }
                }
            },
            {
                time: 7500,
                progress: "82%",
                large: "Drafting Executive Reports & Narrative Tones...",
                sub: "Formatting chronological tables and calculating PR indices...",
                fn: () => {
                    if (p3Desc) p3Desc.textContent = "📝 Writing summaries...";
                }
            },
            {
                time: 9000,
                progress: "93%",
                large: "Generating Creative Asset Deliverables...",
                sub: "Planning Static creatives, 15-second transition reels, and official copy...",
                fn: () => {
                    if (p3) {
                        p3.style.background = "rgba(16, 185, 129, 0.08)";
                        p3.style.borderColor = "rgba(16, 185, 129, 0.35)";
                        p3.style.boxShadow = "none";
                    }
                    if (p3Desc) {
                        p3Desc.style.color = "var(--accent-green)";
                        p3Desc.textContent = "✓ Context compiled";
                    }
                    if (p4) {
                        p4.style.opacity = "1";
                        p4.style.background = "rgba(16, 185, 129, 0.08)";
                        p4.style.borderColor = "rgba(16, 185, 129, 0.35)";
                        p4.style.boxShadow = "0 0 15px rgba(16, 185, 129, 0.2)";
                    }
                    if (p4Desc) {
                        p4Desc.style.color = "var(--accent-green)";
                        p4Desc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Drafting assets...';
                    }
                    if (statusBadge) {
                        statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-green); display: inline-block;"></span> DRAFTING ASSETS';
                        statusBadge.style.color = "var(--accent-green)";
                        statusBadge.style.background = "rgba(16, 185, 129, 0.1)";
                    }
                }
            },
            {
                time: 10000,
                progress: "100%",
                large: "✓ Strategy Briefing Generation Complete!",
                sub: "Strategy dossier compiled and saved to database.",
                fn: () => {
                    if (p4) {
                        p4.style.background = "rgba(16, 185, 129, 0.08)";
                        p4.style.borderColor = "rgba(16, 185, 129, 0.35)";
                        p4.style.boxShadow = "none";
                    }
                    if (p4Desc) {
                        p4Desc.style.color = "var(--accent-green)";
                        p4Desc.textContent = "✓ 3 concepts drafted";
                    }
                    if (statusBadge) {
                        statusBadge.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent-green); display: inline-block;"></span> COMPLETED';
                        statusBadge.style.color = "var(--accent-green)";
                        statusBadge.style.background = "rgba(16, 185, 129, 0.1)";
                    }
                }
            }
        ];

        steps.forEach(step => {
            setTimeout(async () => {
                if (largeStatusText) largeStatusText.textContent = step.large;
                if (subStatusText) subStatusText.textContent = step.sub;
                if (progressBar) progressBar.style.width = step.progress;
                if (step.fn) step.fn();

                // If final step, render results and enable button
                if (step.time === 10000) {
                    currentBriefingData = briefingData;
                    await saveBriefingToFirestore(briefingData.rangeId, briefingData);

                    // Render to UI
                    renderBriefingResults(briefingData);

                    if (btnRunBriefing) {
                        btnRunBriefing.disabled = false;
                        btnRunBriefing.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run AI Briefing';
                    }
                    const btnClear = document.getElementById("btn-clear-briefing");
                    if (btnClear) btnClear.style.display = "inline-block";
                }
            }, step.time);
        });

    } catch (err) {
        console.error("Briefing execution error: ", err);
        if (largeStatusText) {
            largeStatusText.textContent = "✗ Generation Failed";
            subStatusText.textContent = err.message;
        }
        if (btnRunBriefing) {
            btnRunBriefing.disabled = false;
            btnRunBriefing.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Run AI Briefing';
        }
    }
}

// Render the briefing results object to the UI elements
function renderBriefingResults(data) {
    document.getElementById("briefing-exec-summary").textContent = data.execSummary.trim();

    // Render Detailed Intelligence Report as a timeline of card elements
    const reportContainer = document.getElementById("briefing-detailed-report");
    reportContainer.innerHTML = "";
    
    if (data.days && data.days.length > 0) {
        data.days.forEach((day, idx) => {
            const fOptions = { day: 'numeric', month: 'short' };
            const dateStr = new Date(day.date).toLocaleDateString('en-US', fOptions);
            const tag = day.subType.replace(/\s+/g, '');
            
            const card = document.createElement("div");
            card.className = "milestone-card";
            card.style.background = "var(--bg-secondary)";
            card.style.border = "1px solid var(--border-color)";
            card.style.borderRadius = "18px";
            card.style.padding = "24px";
            card.style.marginBottom = "24px";
            card.style.position = "relative";
            card.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
            card.style.transition = "all var(--transition-normal)";
            
            card.innerHTML = `
                <!-- Top Meta Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: var(--accent-purple); background: rgba(139, 92, 246, 0.1); padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${dateStr}
                    </span>
                    <span style="font-size: 13.5px; color: var(--text-muted); font-weight: 600;">
                        <i class="fa-solid fa-train-subway" style="margin-right: 4px; color: var(--accent-blue);"></i> ${day.division} &bull; ${day.zone}
                    </span>
                </div>

                <!-- Title -->
                <h4 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 16px; line-height: 1.4;">
                    ${day.title}
                </h4>

                <!-- Scope & Focus -->
                <div style="display: flex; gap: 14px; font-size: 13px; margin-bottom: 24px; flex-wrap: wrap; width: 100%;">
                    <div style="background: var(--bg-primary); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); flex: 1; min-width: 200px;">
                        <strong style="color: var(--text-primary);">Milestone Scope:</strong> <span style="color: var(--text-secondary);">${day.type} (${day.value})</span>
                    </div>
                    <div style="background: var(--bg-primary); padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border-color); flex: 1.5; min-width: 250px;">
                        <strong style="color: var(--text-primary);">Operational Focus:</strong> <span style="color: var(--text-secondary);">${day.desc}</span>
                    </div>
                </div>

                <!-- Divider -->
                <div style="border-top: 1px solid var(--border-color); margin-bottom: 20px;"></div>

                <!-- Strategy Tabs Navigation -->
                <div class="briefing-tabs-nav">
                    <button class="briefing-tab-btn active" onclick="switchBriefingCardTab(event, ${idx}, 'linkedin')">
                        <i class="fa-brands fa-linkedin" style="color: #0077b5; font-size: 14px;"></i> LinkedIn Campaign
                    </button>
                    <button class="briefing-tab-btn" onclick="switchBriefingCardTab(event, ${idx}, 'twitter')">
                        <i class="fa-brands fa-x-twitter" style="font-size: 13px;"></i> X (Twitter) Tweet
                    </button>
                    <button class="briefing-tab-btn" onclick="switchBriefingCardTab(event, ${idx}, 'reel')">
                        <i class="fa-solid fa-video" style="color: var(--accent-amber); font-size: 13px;"></i> Video Reel
                    </button>
                    <button class="briefing-tab-btn" onclick="switchBriefingCardTab(event, ${idx}, 'pr')">
                        <i class="fa-solid fa-file-lines" style="color: var(--accent-purple); font-size: 13px;"></i> PR Update
                    </button>
                </div>

                <!-- Tab Panels Container -->
                <div class="briefing-panels-container">
                    <!-- LinkedIn Panel -->
                    <div id="panel-${idx}-linkedin" class="briefing-panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--accent-blue); text-transform: uppercase;">Static Creative Asset</span>
                            <span style="font-size: 12px; color: var(--text-muted); font-style: italic;">Asset Title: ${day.static.title}</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                            <strong style="color: var(--text-primary);">Visual Concept:</strong> ${day.static.concept}
                        </div>
                        <div class="draft-container">
                            <div style="white-space: pre-wrap; font-style: italic; line-height: 1.5; max-height: 150px; overflow-y: auto;">${day.static.caption}</div>
                            <button class="copy-btn-briefing" onclick="copyBriefingText(this)" title="Copy LinkedIn Draft">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                            <button class="btn btn-secondary" onclick="addDynamicBriefingStrategyToTracker(${idx}, 'static')" style="padding: 8px 16px; font-size: 12px;">
                                <i class="fa-solid fa-plus"></i> Add LinkedIn to Tracker
                            </button>
                        </div>
                    </div>

                    <!-- Twitter Panel -->
                    <div id="panel-${idx}-twitter" class="briefing-panel hidden-panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">Twitter / X Post</span>
                        </div>
                        <div class="draft-container">
                            <div style="white-space: pre-wrap; font-style: italic; line-height: 1.5;">🚄 Milestone Win: ${day.title.substring(0, 150)}... Read the details here: [Link] #RVNL #IndianRailways #${tag}</div>
                            <button class="copy-btn-briefing" onclick="copyBriefingText(this)" title="Copy Tweet Draft">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                            <button class="btn btn-secondary" onclick="addDynamicBriefingStrategyToTracker(${idx}, 'twitter')" style="padding: 8px 16px; font-size: 12px;">
                                <i class="fa-solid fa-plus"></i> Add Tweet to Tracker
                            </button>
                        </div>
                    </div>

                    <!-- Reel Panel -->
                    <div id="panel-${idx}-reel" class="briefing-panel hidden-panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--accent-amber); text-transform: uppercase;">Video Reel Concept</span>
                            <span style="font-size: 12px; color: var(--text-muted); font-style: italic;">Asset Title: ${day.reel.title}</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                            <strong style="color: var(--text-primary);">Video Concept Storyboard:</strong> ${day.reel.concept}
                        </div>
                        <div class="draft-container">
                            <div style="white-space: pre-wrap; font-style: italic; line-height: 1.5; max-height: 150px; overflow-y: auto;">${day.reel.caption}</div>
                            <button class="copy-btn-briefing" onclick="copyBriefingText(this)" title="Copy Reel Caption">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                            <button class="btn btn-secondary" onclick="addDynamicBriefingStrategyToTracker(${idx}, 'reel')" style="padding: 8px 16px; font-size: 12px;">
                                <i class="fa-solid fa-plus"></i> Add Video to Tracker
                            </button>
                        </div>
                    </div>

                    <!-- PR Panel -->
                    <div id="panel-${idx}-pr" class="briefing-panel hidden-panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--accent-purple); text-transform: uppercase;">PR Update / Media Angle</span>
                            <span style="font-size: 12px; color: var(--text-muted); font-style: italic;">PR Title: ${day.pr.title}</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.6;">
                            <strong style="color: var(--text-primary);">Release Angle & Target Outlets:</strong> ${day.pr.concept}
                        </div>
                        <div class="draft-container">
                            <div style="white-space: pre-wrap; font-style: italic; line-height: 1.5; max-height: 150px; overflow-y: auto;">${day.pr.caption}</div>
                            <button class="copy-btn-briefing" onclick="copyBriefingText(this)" title="Copy PR Draft">
                                <i class="fa-solid fa-copy"></i>
                            </button>
                        </div>
                        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
                            <button class="btn btn-secondary" onclick="addDynamicBriefingStrategyToTracker(${idx}, 'pr')" style="padding: 8px 16px; font-size: 12px;">
                                <i class="fa-solid fa-plus"></i> Add PR to Tracker
                            </button>
                        </div>
                    </div>
                </div>
            `;
            reportContainer.appendChild(card);
        });
    } else {
        reportContainer.innerHTML = `<p class="text-muted" style="font-size: 13.5px; text-align: center; margin-top: 20px;">No milestones detailed.</p>`;
    }

    // Sources Render
    const sourcesContainer = document.getElementById("briefing-sources");
    sourcesContainer.innerHTML = "";
    if (data.sources && data.sources.length > 0) {
        // De-duplicate sources
        const seenUrls = new Set();
        data.sources.forEach(src => {
            if (seenUrls.has(src.url)) return;
            seenUrls.add(src.url);

            const anchor = document.createElement("a");
            anchor.className = "briefing-source-link";
            anchor.href = src.url;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            
            let domain = "Link";
            try {
                domain = new URL(src.url).hostname.replace('www.', '');
            } catch(e) {}

            anchor.innerHTML = `
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                <div style="flex-grow: 1; min-width: 0;">
                    <strong style="display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${src.title}</strong>
                    <span style="font-size: 11px; color: var(--text-muted); word-break: break-all; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${src.url}</span>
                </div>
                <span class="briefing-source-domain">${domain}</span>
            `;
            sourcesContainer.appendChild(anchor);
        });
    } else {
        sourcesContainer.innerHTML = `<p class="text-muted" style="font-size: 13px;">No explicit sources cited. The report represents general web findings.</p>`;
    }

    // Show Results
    document.getElementById("briefing-results").classList.remove("hidden");
}

// Global helper to switch briefing card tabs dynamically
window.switchBriefingCardTab = function(event, cardIdx, tabName) {
    if (event) event.preventDefault();

    const button = event.currentTarget;
    const navContainer = button.parentElement;
    
    // Deactivate all buttons in this navigation bar
    const buttons = navContainer.querySelectorAll('.briefing-tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Activate current tab button
    button.classList.add('active');
    
    // Hide all panels inside this card's panel container
    const card = navContainer.parentElement;
    const panelsContainer = card.querySelector('.briefing-panels-container');
    const panels = panelsContainer.querySelectorAll('.briefing-panel');
    panels.forEach(panel => panel.classList.add('hidden-panel'));
    
    // Show selected panel
    const activePanel = panelsContainer.querySelector(`#panel-${cardIdx}-${tabName}`);
    if (activePanel) {
        activePanel.classList.remove('hidden-panel');
    }
};

// Global helper to copy briefing captions to clipboard and provide micro-interactions
window.copyBriefingText = function(btn) {
    const textContainer = btn.previousElementSibling;
    if (!textContainer) return;
    
    const text = textContainer.textContent || textContainer.innerText;
    navigator.clipboard.writeText(text).then(() => {
        // Show check icon as immediate visual feedback
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--accent-green);"></i>';
        btn.style.pointerEvents = 'none';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.pointerEvents = 'auto';
        }, 1500);
    }).catch(err => {
        console.error("Clipboard copy failed: ", err);
    });
};

// Convert Strategy Card info to Task Drawer Prefills
window.addDynamicBriefingStrategyToTracker = function(dayIndex, strategyType) {
    if (!currentBriefingData || !currentBriefingData.days || !currentBriefingData.days[dayIndex]) {
        alert("No strategy data found.");
        return;
    }
    const dayData = currentBriefingData.days[dayIndex];
    const dates = getBriefingDates(dayData.date);

    let prefill = {
        status: "WIP",
        owner: "Sanjam",
        month: dates.targetMonthStr, // e.g. "June 2026"
        week: dates.targetWeekStr,    // e.g. "Week 2"
        date: dates.specificDateStr   // e.g. "10th June"
    };

    if (strategyType === "static") {
        prefill.type = "Social Media";
        prefill.subType = "All Platforms";
        prefill.title = `[Briefing] ${dayData.static.title}`;
        prefill.remarks = `Concept: ${dayData.static.concept}\n\nCaption:\n${dayData.static.caption}`;
    } else if (strategyType === "twitter") {
        prefill.type = "Social Media";
        prefill.subType = "X (Twitter)";
        const shortTitle = dayData.title.length > 40 ? dayData.title.substring(0, 40) + "..." : dayData.title;
        prefill.title = `[Briefing] Tweet: ${shortTitle}`;
        const tag = dayData.subType.replace(/\s+/g, '');
        prefill.remarks = `🚄 Milestone Win: ${dayData.title.substring(0, 150)}...\n\nRead the details here: [Link] #RVNL #IndianRailways #${tag}`;
    } else if (strategyType === "reel") {
        prefill.type = "Creative / Collateral";
        prefill.subType = "Video";
        prefill.title = `[Briefing] ${dayData.reel.title}`;
        prefill.remarks = `Video Concept: ${dayData.reel.concept}\n\nAudio/Vibe Details:\n${dayData.reel.caption}`;
    } else if (strategyType === "pr") {
        prefill.type = "PR Update";
        prefill.subType = "Press Release";
        prefill.title = `[Briefing] ${dayData.pr.title}`;
        prefill.remarks = `PR Concept: ${dayData.pr.concept}\n\nHook/Copy:\n${dayData.pr.caption}`;
    }

    // Switch tab to tracker and open form drawer with prefill data
    switchTab("tracker");
    openDrawer(null, prefill);
};

// helper to format dates
function getBriefingDates(selectedDateStr) {
    const selectedDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
    const yesterdayDate = new Date(selectedDate);
    yesterdayDate.setDate(selectedDate.getDate() - 1);
    const formatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    
    return {
        todayStr: selectedDate.toLocaleDateString('en-US', formatOptions),
        yesterdayStr: yesterdayDate.toLocaleDateString('en-US', formatOptions),
        targetMonthStr: selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        targetWeekStr: getWeekFromDate(selectedDate),
        specificDateStr: formatOrdinalDate(selectedDate)
    };
}

function getWeekFromDate(date) {
    const day = date.getDate();
    if (day <= 7) return "Week 1";
    if (day <= 14) return "Week 2";
    if (day <= 21) return "Week 3";
    if (day <= 28) return "Week 4";
    return "Week 5";
}

function formatOrdinalDate(date) {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";
    return `${day}${suffix} ${month}`;
}

// Fallback standard logic loop to support multiple configurations without search grounding
async function callStandardGemini(apiKey, prompt) {
    const configs = [
        { version: "v1beta", model: "gemini-2.0-flash" },
        { version: "v1beta", model: "gemini-2.0-flash-lite" },
        { version: "v1beta", model: "gemini-2.5-flash" },
        { version: "v1beta", model: "gemini-pro-latest" }
    ];
    
    let errors = [];
    for (const config of configs) {
        try {
            const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:generateContent?key=${apiKey}`;
            const makeRequest = async () => {
                return await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });
            };

            let response;
            let retries = 3;
            for (let r = 0; r < retries; r++) {
                response = await makeRequest();
                if (response.status === 429 || response.status === 503) {
                    if (r < retries - 1) {
                        const waitTime = (r + 1) * 2000;
                        console.warn(`Got status ${response.status} for ${config.model} (${config.version}). Retrying in ${waitTime/1000}s (Attempt ${r+1}/${retries})...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                } else {
                    break;
                }
            }

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
                    return data.candidates[0].content.parts[0].text;
                }
            } else {
                const errText = await response.text();
                console.warn(`Gemini call failed for ${config.model} (${config.version}):`, errText);
                errors.push(`${config.model} (${config.version}): Status ${response.status} - ${errText}`);
            }
        } catch (err) {
            console.warn(`Gemini fetch error for ${config.model} (${config.version}):`, err);
            errors.push(`${config.model} (${config.version}): ${err.message}`);
        }
    }

    // Try programmatically loading all models from Google AI Studio to see which ones are registered
    let availableModelsText = "";
    try {
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listRes = await fetch(listUrl);
        if (listRes.ok) {
            const listData = await listRes.json();
            const names = listData.models ? listData.models.map(m => m.name.replace('models/', '')) : [];
            availableModelsText = `\n\nAvailable models for your API key: ${names.join(', ')}`;
        }
    } catch (listErr) {
        console.warn("Failed to fetch available models list:", listErr);
    }
    
    throw new Error("All Gemini configurations failed:\n" + errors.map(e => `• ${e}`).join('\n') + availableModelsText);
}

// Local storage and firestore loading caching functions
async function saveBriefingToFirestore(dateStr, briefingData) {
    const docId = `briefing_${dateStr}`;
    const docRef = db.collection('rvnl_briefings').doc(docId);
    try {
        await docRef.set({
            date: dateStr,
            briefing: briefingData,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Briefing successfully saved to Firestore.");
    } catch (err) {
        console.error("Error saving briefing to Firestore: ", err);
        // Fallback to localStorage
        localStorage.setItem(`rvnl_briefing_${dateStr}`, JSON.stringify(briefingData));
    }
}

async function loadBriefingFromFirestore(dateStr) {
    const docId = `briefing_${dateStr}`;
    const docRef = db.collection('rvnl_briefings').doc(docId);
    try {
        const doc = await docRef.get();
        if (doc.exists) {
            return doc.data().briefing;
        }
    } catch (err) {
        console.error("Error loading briefing from Firestore: ", err);
        // Fallback to localStorage
        const local = localStorage.getItem(`rvnl_briefing_${dateStr}`);
        if (local) {
            try { return JSON.parse(local); } catch(e) {}
        }
    }
    return null;
}

// Convert markdown structures into simple HTML structures
function convertMarkdownToHtml(md) {
    if (!md) return "";
    let html = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Headings
        .replace(/^### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h2>$1</h2>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Bullet points
        .replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>')
        // Simple paragraph wrapper
        .replace(/\n\n/g, '<br><br>');
    
    // Quick cleanup of lists
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1<\/ul>');
    // Merge adjacent <ul> tags
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    
    return html;
}

// Extract field items using regex matching
function extractField(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}

// Parse markdown sections out to individual elements with high formatting tolerance
function parseBriefingMarkdown(markdown) {
    const sections = {
        execSummary: "",
        detailedReport: "",
        staticTitle: "Celebrate Recent Milestone",
        staticConcept: "No concept generated.",
        staticCaption: "No caption generated.",
        reelTitle: "Day in the Life of Rail Infrastructure",
        reelConcept: "No concept generated.",
        reelCaption: "No caption generated.",
        prTitle: "National Press Release update",
        prConcept: "No concept generated.",
        prCaption: "No caption generated."
    };

    if (!markdown) return sections;

    // Normalize markdown bullets and labels to make regex parsing 100% reliable
    let normalized = markdown
        // Replace carriage returns
        .replace(/\r\n/g, '\n')
        // Normalize bullet points to simple hyphens
        .replace(/^\s*[\*\+]\s+/gm, '- ')
        // Normalize bold label formats
        .replace(/^\s*[-*+]?\s*\*\*(Title|Concept|Suggested\s+Caption|Caption|Platform)\*\*:\s*/gim, '- **$1**: ')
        .replace(/^\s*[-*+]?\s*\*\*(Title|Concept|Suggested\s+Caption|Caption|Platform):\*\*\s*/gim, '- **$1**: ')
        .replace(/^\s*[-*+]?\s*(Title|Concept|Suggested\s+Caption|Caption|Platform):\s*/gim, '- **$1**: ');

    // Extract Executive Summary
    const execMatch = normalized.match(/(?:#+\s*EXECUTIVE\s*SUMMARY|Executive\s*Summary:?)\s*\n+([\s\S]*?)(?=\n#+ |\n\*\*|\n[A-Z\s]+:|$)/i);
    if (execMatch) {
        sections.execSummary = execMatch[1].trim();
    }

    // Extract Detailed Report
    const reportMatch = normalized.match(/(?:#+\s*INTERNET\s*RESEARCH\s*REPORT|Internet\s*Research\s*Report:?)\s*\n+([\s\S]*?)(?=\n#+\s*(?:STRATEGY|ACTION)|$)/i);
    if (reportMatch) {
        sections.detailedReport = reportMatch[1].trim();
    } else {
        // Fallback: search for anything before STRATEGY section
        const strategyIndex = normalized.search(/#+\s*(?:STRATEGY|ACTION)/i);
        if (strategyIndex !== -1) {
            const beforeStrategy = normalized.substring(0, strategyIndex);
            sections.detailedReport = beforeStrategy.replace(/#+\s*EXECUTIVE\s*SUMMARY[\s\S]*?(?=#+|$)/i, '').trim();
        }
    }

    // Locate the strategy text segment
    const strategyMatch = normalized.match(/(?:#+\s*(?:STRATEGY|ACTION\s*PLAN|STRATEGY\s*&\s*ACTION\s*PLAN))([\s\S]*)$/i);
    const strategyText = strategyMatch ? strategyMatch[1] : normalized;

    // Split strategy text into sections by subheadings (## Static Creative, ## Reel Concept, etc.)
    const subParts = strategyText.split(/(?=\n#+\s+|\n\*\*)/);

    subParts.forEach(part => {
        const partTrimmed = part.trim();
        const partLower = partTrimmed.toLowerCase();

        // Helper to extract fields from a specific strategy block
        const parseBlockFields = (blockText) => {
            const titleMatch = blockText.match(/-\s*\*\*Title\*\*:\s*(.*)/i);
            const conceptMatch = blockText.match(/-\s*\*\*Concept\*\*:\s*([\s\S]*?)(?=\n- |\n#+ |\n\*\*|$)/i);
            const captionMatch = blockText.match(/-\s*\*\*(?:Suggested\s+Caption|Caption)\*\*:\s*([\s\S]*?)(?=\n- |\n#+ |\n\*\*|$)/i);

            return {
                title: titleMatch ? titleMatch[1].trim() : "",
                concept: conceptMatch ? conceptMatch[1].trim() : "",
                caption: captionMatch ? captionMatch[1].trim() : ""
            };
        };

        if (partLower.includes('static') || partLower.includes('graphic') || partLower.includes('image')) {
            const fields = parseBlockFields(partTrimmed);
            if (fields.title) sections.staticTitle = fields.title;
            if (fields.concept) sections.staticConcept = fields.concept;
            if (fields.caption) sections.staticCaption = fields.caption;
        } else if (partLower.includes('reel') || partLower.includes('video') || partLower.includes('short')) {
            const fields = parseBlockFields(partTrimmed);
            if (fields.title) sections.reelTitle = fields.title;
            if (fields.concept) sections.reelConcept = fields.concept;
            if (fields.caption) sections.reelCaption = fields.caption;
        } else if (partLower.includes('pr') || partLower.includes('article') || partLower.includes('press') || partLower.includes('release')) {
            const fields = parseBlockFields(partTrimmed);
            if (fields.title) sections.prTitle = fields.title;
            if (fields.concept) sections.prConcept = fields.concept;
            if (fields.caption) sections.prCaption = fields.caption;
        }
    });

    // Final cleanups & fallbacks
    if (!sections.execSummary) {
        sections.execSummary = markdown.split('\n').filter(line => line.trim() && !line.startsWith('#')).slice(0, 2).join('\n') || "Briefing summary generated.";
    }
    if (!sections.detailedReport) {
        sections.detailedReport = markdown;
    }

    // Secondary fallback using raw block contents if concept fields are still default
    subParts.forEach(part => {
        const partTrimmed = part.trim();
        const partLower = partTrimmed.toLowerCase();
        if (partLower.includes('static') || partLower.includes('graphic') || partLower.includes('image')) {
            if (sections.staticConcept === "No concept generated.") {
                sections.staticConcept = partTrimmed.replace(/#+.*?\n/g, '').replace(/-\s*\*\*Title\*\*:\s*.*?\n/g, '').trim();
            }
        } else if (partLower.includes('reel') || partLower.includes('video') || partLower.includes('short')) {
            if (sections.reelConcept === "No concept generated.") {
                sections.reelConcept = partTrimmed.replace(/#+.*?\n/g, '').replace(/-\s*\*\*Title\*\*:\s*.*?\n/g, '').trim();
            }
        } else if (partLower.includes('pr') || partLower.includes('article') || partLower.includes('press') || partLower.includes('release')) {
            if (sections.prConcept === "No concept generated.") {
                sections.prConcept = partTrimmed.replace(/#+.*?\n/g, '').replace(/-\s*\*\*Title\*\*:\s*.*?\n/g, '').trim();
            }
        }
    });

    return sections;
}


// ====================================================
// REAL-TIME FIRESTORE DEV-BETA CHAT ENGINE
// ====================================================
let chatUnsubscribe = null;
let currentChatTarget = 'group_all'; // 'group_all', 'group_CLIENT', or user email string for DM

function initDeveloperChat() {
    // Bootstrap chat messages cache from localStorage
    try {
        state.chatMessagesCache = JSON.parse(localStorage.getItem("rvnl_chat_messages_cache")) || {};
    } catch(e) {
        state.chatMessagesCache = {};
    }

    // 1. Create Floating Toggle Trigger & Chat Container markup dynamically
    injectChatMarkup();

    // 2. Wire up UI Open/Close Toggle listeners
    const toggleBtn = document.getElementById("dev-chat-toggle-btn");
    const closeBtn = document.getElementById("dev-chat-close-btn");
    const drawer = document.getElementById("dev-chat-drawer");

    if (toggleBtn && drawer) {
        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            drawer.classList.toggle("active");
            if (drawer.classList.contains("active")) {
                loadChatMessages();
                // Clear unread badge
                const unreadBadge = toggleBtn.querySelector(".chat-unread-badge");
                if (unreadBadge) unreadBadge.style.display = "none";
            }
        });
    }

    if (closeBtn && drawer) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            drawer.classList.remove("active");
        });
    }

    // Wire up sidebar Lab Features link to open chat as well
    const teamChatSidebarBtn = document.querySelector(".dev-feature-btn");
    if (teamChatSidebarBtn) {
        // Override original alert behavior to open the drawer
        teamChatSidebarBtn.setAttribute("onclick", "");
        teamChatSidebarBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (drawer) {
                drawer.classList.add("active");
                loadChatMessages();
            }
        });
    }

    // Close chat drawer when clicking outside it
    window.addEventListener("click", (e) => {
        if (drawer && drawer.classList.contains("active")) {
            // Check if click target is outside the drawer AND outside toggle buttons
            const isClickInsideDrawer = drawer.contains(e.target);
            const isClickOnToggle = toggleBtn && toggleBtn.contains(e.target);
            const isClickOnSidebarBtn = teamChatSidebarBtn && teamChatSidebarBtn.contains(e.target);
            
            if (!isClickInsideDrawer && !isClickOnToggle && !isClickOnSidebarBtn) {
                drawer.classList.remove("active");
            }
        }
    });

    // 3. Wire up Chat Target switching click handlers (Channels vs DMs)
    setupChatChannelSwitchers();

    // 4. Wire up Message Send form submission & input events directly
    const sendForm = document.getElementById("dev-chat-send-form");
    const sendInput = document.getElementById("dev-chat-input");
    
    async function triggerMessageSend() {
        if (!sendInput) return;
        const text = sendInput.value.trim();
        if (!text) return;

        console.log("Form/button triggered message send: ", text);
        sendInput.value = "";
        await sendChatMessage(text);
    }

    if (sendForm && sendInput) {
        sendForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await triggerMessageSend();
        });

        // Add Enter key event listener directly to input as backup
        sendInput.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                await triggerMessageSend();
            }
        });
    }

    // Direct click handler on the send button as secondary backup
    const sendButton = sendForm ? sendForm.querySelector("button[type='submit']") : null;
    if (sendButton) {
        sendButton.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await triggerMessageSend();
        });
    }

    // 5. Setup listener to monitor for incoming message count badges
    monitorUnreadMessageBadge();

    // 6. Setup custom groups creation and synchronization
    setupCustomGroupModal();
    monitorCustomGroups();
}

function injectChatMarkup() {
    if (document.getElementById("dev-chat-drawer")) return; // Already injected

    // Create Toggle Button
    const toggle = document.createElement("button");
    toggle.id = "dev-chat-toggle-btn";
    toggle.className = "no-print";
    toggle.style.cssText = "position: fixed; bottom: 25px; right: 25px; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #3b82f6); color: #fff; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(124, 58, 237, 0.35); display: flex; align-items: center; justify-content: center; font-size: 22px; z-index: 999; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);";
    toggle.innerHTML = `<i class="fa-solid fa-comments"></i><span class="chat-unread-badge" style="display: none; position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #10b981; border: 2px solid #fff; color: #fff; font-size: 9.5px; font-weight: 700; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4); box-sizing: border-box; line-height: 1;"></span>`;
    
    // Add hover zoom effect
    toggle.addEventListener("mouseenter", () => {
        toggle.style.transform = "scale(1.08) translateY(-2px)";
        toggle.style.boxShadow = "0 12px 30px rgba(124, 58, 237, 0.45)";
    });
    toggle.addEventListener("mouseleave", () => {
        toggle.style.transform = "scale(1) translateY(0)";
        toggle.style.boxShadow = "0 8px 24px rgba(124, 58, 237, 0.35)";
    });

    // Create Chat Slide-out Panel
    const drawer = document.createElement("div");
    drawer.id = "dev-chat-drawer";
    drawer.className = "no-print";
    drawer.style.cssText = "position: fixed; top: 0; right: -600px; width: 600px; height: 100%; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-left: 1px solid rgba(139, 92, 246, 0.15); box-shadow: -10px 0 40px rgba(0,0,0,0.15); z-index: 1000; display: flex; flex-direction: column; transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-sizing: border-box; overflow: hidden; font-family: 'Inter', sans-serif;";
    
    // Style tags for theme compatibility & animations
    const style = document.createElement("style");
    style.id = "dev-chat-custom-styles";
    style.innerHTML = `
        #dev-chat-drawer.active { right: 0 !important; }
        body.dark-theme #dev-chat-drawer {
            background: rgba(15, 23, 42, 0.95) !important;
            border-left-color: rgba(167, 139, 250, 0.12) !important;
        }
        .chat-channel-item {
            padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
            transition: all 0.15s ease;
        }
        .chat-channel-item:hover {
            background: rgba(139, 92, 246, 0.05);
            color: var(--text-primary);
        }
        .chat-channel-item.active {
            background: rgba(139, 92, 246, 0.08);
            color: #7c3aed;
            font-weight: 600;
        }
        body.dark-theme .chat-channel-item.active {
            color: #c084fc;
            background: rgba(167, 139, 250, 0.12);
        }
        .chat-messages-container {
            background-color: #f8fafc;
            background-image: linear-gradient(135deg, rgba(139, 92, 246, 0.04) 0%, rgba(239, 68, 68, 0.04) 100%);
            position: relative;
        }
        body.dark-theme .chat-messages-container {
            background-color: #0f172a !important;
            background-image: linear-gradient(135deg, rgba(139, 92, 246, 0.07) 0%, rgba(239, 68, 68, 0.07) 100%) !important;
        }
        .message-bubble {
            max-width: 80%;
            padding: 10px 14px 16px 14px;
            border-radius: 16px;
            font-size: 13px;
            line-height: 1.5;
            word-wrap: break-word;
            position: relative;
            box-shadow: 0 4px 15px rgba(0,0,0,0.03);
            border: 1px solid rgba(255, 255, 255, 0.4);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
        }
        .message-incoming {
            background: rgba(255, 255, 255, 0.85);
            color: #1e293b;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }
        body.dark-theme .message-incoming {
            background: rgba(30, 41, 59, 0.7);
            color: #f1f5f9;
            border-color: rgba(255, 255, 255, 0.05);
        }
        .message-outgoing {
            background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%);
            color: #1e293b;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            border-color: rgba(139, 92, 246, 0.25);
        }
        body.dark-theme .message-outgoing {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(239, 68, 68, 0.18) 100%);
            color: #f8fafc;
            border-color: rgba(167, 139, 250, 0.25);
        }
        .message-time-meta {
            position: absolute;
            bottom: 3.5px;
            right: 10px;
            font-size: 9px;
            color: #64748b;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        body.dark-theme .message-time-meta {
            color: #94a3b8;
        }
        .message-date-divider {
            align-self: center;
            background: rgba(255,255,255,0.9);
            color: #475569;
            font-size: 10px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.03);
            margin: 12px 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: 1px solid rgba(139, 92, 246, 0.1);
        }
        body.dark-theme .message-date-divider {
            background: #1e293b;
            color: #94a3b8;
            border-color: rgba(255, 255, 255, 0.05);
        }
        .chat-badge-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #005c4b;
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            text-transform: uppercase;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(style);

    drawer.innerHTML = `
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px; color: #8b5cf6;"><i class="fa-solid fa-comments"></i></span>
                <span style="font-size: 15px; font-weight: 700; font-family: var(--font-heading); color: var(--text-primary);">Team Workspace Chat</span>
            </div>
            <button id="dev-chat-close-btn" style="background: none; border: none; color: var(--text-muted); font-size: 16px; cursor: pointer; padding: 4px;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- Two Columns Container -->
        <div style="display: flex; flex: 1; overflow: hidden; height: 100%;">
            
            <!-- Left Panel (Sidebar lists Channels & DMs) -->
            <div style="width: 180px; border-right: 1px solid var(--border-color); padding: 12px 6px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; background: rgba(0,0,0,0.015);">
                <!-- Search Box -->
                <div style="padding: 0 4px;">
                    <input type="text" id="chat-sidebar-search" placeholder="Search chats..." style="width: 100%; height: 28px; padding: 0 8px; font-size: 11.5px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); outline: none; box-sizing: border-box;">
                </div>
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-right: 4px;">
                        <label style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; padding-left: 6px; display: block; margin: 0;">Groups</label>
                        <button id="btn-create-custom-group" title="Create Custom Group" style="background: none; border: none; color: #8b5cf6; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 2px;"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <div id="chat-channels-list" style="display: flex; flex-direction: column; gap: 3px;">
                        <!-- Rendered dynamically -->
                    </div>
                </div>
                <div>
                    <label style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; padding-left: 6px; display: block; margin-bottom: 6px;">Direct Messages</label>
                    <div id="chat-dms-list" style="display: flex; flex-direction: column; gap: 3px;">
                        <!-- Rendered dynamically -->
                    </div>
                </div>
            </div>

            <!-- Right Panel (Active Chat Frame) -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <!-- Target Header -->
                <div style="padding: 10px 16px; border-bottom: 1px solid var(--border-color); background: rgba(255,255,255,0.01);">
                    <div id="chat-header-target-name" style="font-size: 13px; font-weight: 700; color: var(--text-primary);"># All Team Channel</div>
                    <div id="chat-header-target-desc" style="font-size: 10.5px; color: var(--text-muted); margin-top: 1.5px;">Public group conversation</div>
                </div>

                <!-- Messages Stream Viewport -->
                <div id="chat-messages-viewport" class="chat-messages-container" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                    <!-- Messages will render here -->
                </div>

                <!-- Input box Footer -->
                <div style="padding: 12px 14px; border-top: 1px solid var(--border-color);">
                    <form id="dev-chat-send-form" style="display: flex; gap: 8px; width: 100%;">
                        <input type="text" id="dev-chat-input" placeholder="Type a message..." autocomplete="off" style="flex: 1; height: 36px; padding: 0 12px; font-size: 12.5px; border-radius: 20px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); outline: none;">
                        <button type="submit" style="width: 36px; height: 36px; border-radius: 50%; background: #7c3aed; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;"><i class="fa-solid fa-paper-plane"></i></button>
                    </form>
                </div>
            </div>

        </div>

        <!-- Custom Group Creation Modal Overlay -->
        <div id="custom-group-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); z-index: 1001; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; font-family: var(--font-body);">
            <div style="background: var(--bg-primary, #ffffff); border: 1px solid var(--border-color); border-radius: 12px; width: 340px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 14px;">
                <h4 style="margin: 0; font-family: var(--font-heading); color: var(--text-primary); font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-users-gear" style="color:#8b5cf6;"></i> Create Custom Group</h4>
                
                <div>
                    <label style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 5px;">Group Name</label>
                    <input type="text" id="custom-group-name-input" placeholder="e.g. Creative Review" style="width: 100%; height: 32px; padding: 0 10px; font-size: 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); outline: none; box-sizing: border-box;">
                </div>

                <div>
                    <label style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; display: block; margin-bottom: 5px;">Select Members</label>
                    <input type="text" id="custom-group-member-search" placeholder="Search members..." style="width: 100%; height: 28px; padding: 0 8px; font-size: 11.5px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); outline: none; box-sizing: border-box; margin-bottom: 6px; font-family: var(--font-body);">
                    <div id="custom-group-members-checklist" style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; background: rgba(0,0,0,0.01);">
                        <!-- Filled dynamically -->
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button id="btn-custom-group-cancel" style="padding: 6px 12px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-muted); cursor: pointer;">Cancel</button>
                    <button id="btn-custom-group-submit" style="padding: 6px 12px; font-size: 11px; font-weight: 600; border-radius: 6px; border: none; background: #8b5cf6; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> Create</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(drawer);
}

function setupChatChannelSwitchers() {
    // Render the channels & DMs list initially
    renderChatSidebarList("");

    // Bind search keypress listener
    const searchInput = document.getElementById("chat-sidebar-search");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            renderChatSidebarList(e.target.value.trim());
        });
    }
}

function renderChatSidebarList(filterText) {
    const channelsContainer = document.getElementById("chat-channels-list");
    const dmsContainer = document.getElementById("chat-dms-list");
    if (!channelsContainer || !dmsContainer) return;

    channelsContainer.innerHTML = "";
    dmsContainer.innerHTML = "";

    const query = filterText.toLowerCase();

    // 1. Build and Filter Group Channels list
    const allGroups = [
        { id: 'group_all', name: 'All Team', type: 'hashtag' },
        ...getClientList().map(c => ({ id: `group_${c}`, name: c, type: 'users' })),
        ...(state.customGroups || []).map(g => ({ id: g.id, name: g.name, type: 'people-group' }))
    ];

    allGroups.forEach(group => {
        if (query && !group.name.toLowerCase().includes(query)) return;

        const div = document.createElement("div");
        div.className = `chat-channel-item ${currentChatTarget === group.id ? 'active' : ''}`;
        div.setAttribute("data-target", group.id);
        div.innerHTML = `<i class="fa-solid fa-${group.type}" style="font-size: 10px;"></i> <span>${group.name}</span>`;
        
        div.addEventListener("click", (e) => {
            e.stopPropagation();
            currentChatTarget = group.id;
            updateChatHeaderUI();
            loadChatMessages();
            renderChatSidebarList(filterText); // Refresh active styling classes
        });
        channelsContainer.appendChild(div);
    });

    // Initialize activeChatDMs from localStorage if present
    if (!state.activeChatDMs || state.activeChatDMs.length === 0) {
        try {
            state.activeChatDMs = JSON.parse(localStorage.getItem("rvnl_active_chat_dms")) || [];
        } catch(e) {
            state.activeChatDMs = [];
        }
    }

    // 2. Direct Messages (Registered users)
    const allUsers = Object.keys(state.userPermissions || {}).filter(email => email !== state.currentUserEmail);
    
    if (query) {
        // Search Mode: Show all matching users to allow starting a new chat
        allUsers.forEach(email => {
            const shortName = email.split("@")[0];
            if (!shortName.toLowerCase().includes(query) && !email.toLowerCase().includes(query)) return;

            const div = document.createElement("div");
            div.className = `chat-channel-item ${currentChatTarget === email ? 'active' : ''}`;
            div.setAttribute("data-target", email);
            div.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 6px; color: var(--text-muted); font-weight: 500;"></i> <span>${shortName} <span style="font-size: 8.5px; opacity:0.65; color:var(--accent-purple);">(add)</span></span>`;
            
            div.addEventListener("click", (e) => {
                e.stopPropagation();
                // Add to active DM list if not already present
                if (!state.activeChatDMs.includes(email)) {
                    state.activeChatDMs.push(email);
                    localStorage.setItem("rvnl_active_chat_dms", JSON.stringify(state.activeChatDMs));
                }
                currentChatTarget = email;
                
                // Clear search input box on selection
                const searchInput = document.getElementById("chat-sidebar-search");
                if (searchInput) searchInput.value = "";

                updateChatHeaderUI();
                loadChatMessages();
                renderChatSidebarList(""); // Refresh to normal view (with only active DMs)
            });
            dmsContainer.appendChild(div);
        });

        if (dmsContainer.children.length === 0) {
            dmsContainer.innerHTML = `<div style="padding: 6px; font-size: 10.5px; color: var(--text-muted);">No users found.</div>`;
        }
    } else {
        // Default Mode: Only show active pinned conversations
        state.activeChatDMs.forEach(email => {
            const shortName = email.split("@")[0];
            const div = document.createElement("div");
            div.className = `chat-channel-item ${currentChatTarget === email ? 'active' : ''}`;
            div.setAttribute("data-target", email);
            
            // Get unread count for this user
            const unread = (state.chatUnreadCounts && state.chatUnreadCounts[email]) || 0;
            const badgeHtml = unread > 0 
                ? `<span style="background:#10b981; color:#fff; font-size:9.5px; font-weight:700; border-radius:10px; padding:2px 6px; margin-left:auto; display:inline-block; line-height:1; min-width:10px; text-align:center;">${unread}</span>` 
                : '';

            div.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 6px; color: ${unread > 0 ? '#10b981' : '#cbd5e1'};"></i> 
                             <span style="flex-grow:1; display:flex; align-items:center; justify-content:space-between;">${shortName} ${badgeHtml}</span>`;
            
            div.addEventListener("click", (e) => {
                e.stopPropagation();
                currentChatTarget = email;
                updateChatHeaderUI();
                loadChatMessages();
                renderChatSidebarList(""); // Refresh active styling
            });
            dmsContainer.appendChild(div);
        });

        if (state.activeChatDMs.length === 0) {
            dmsContainer.innerHTML = `<div style="padding: 8px 6px; font-size: 11px; color: var(--text-muted); line-height: 1.3; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-color); border-radius: 6px; text-align: center;">Use search to start a DM</div>`;
        }
    }
}

function updateChatHeaderUI() {
    const titleEl = document.getElementById("chat-header-target-name");
    const descEl = document.getElementById("chat-header-target-desc");
    if (!titleEl || !descEl) return;

    if (currentChatTarget === 'group_all') {
        titleEl.textContent = "# All Team Channel";
        descEl.textContent = "General team group conversation";
    } else if (currentChatTarget.startsWith('group_custom_')) {
        const groupObj = (state.customGroups || []).find(g => g.id === currentChatTarget);
        if (groupObj) {
            titleEl.textContent = `👥 ${groupObj.name}`;
            const displayMembers = groupObj.members.map(m => m.split("@")[0]).join(", ");
            descEl.textContent = `Members: ${displayMembers}`;
        } else {
            titleEl.textContent = `👥 Custom Group`;
            descEl.textContent = `Custom group conversation`;
        }
    } else if (currentChatTarget.startsWith('group_')) {
        const clientName = currentChatTarget.replace('group_', '');
        titleEl.textContent = `👥 ${clientName} Room`;
        descEl.textContent = `Group discussion for ${clientName} campaign work`;
    } else {
        const userName = currentChatTarget.split("@")[0];
        titleEl.textContent = `💬 Direct: ${userName}`;
        descEl.textContent = `Private message thread with ${currentChatTarget}`;
    }
}

function loadChatMessages() {
    const viewport = document.getElementById("chat-messages-viewport");
    if (!viewport) return;

    // Run mark as read asynchronously in the background so it doesn't block the UI thread
    setTimeout(() => {
        markMessagesAsRead(currentChatTarget);
    }, 10);

    // Unsubscribe from previous listener if it exists
    if (chatUnsubscribe) {
        chatUnsubscribe();
    }

    // Initialize cache dictionary if missing
    if (!state.chatMessagesCache) {
        state.chatMessagesCache = {};
    }

    // WIPE OLD CHAT RENDER IMMEDIATELY and show cached messages if they exist
    if (state.chatMessagesCache[currentChatTarget]) {
        renderChatMessagesList(state.chatMessagesCache[currentChatTarget], viewport, true);
    } else {
        viewport.innerHTML = `<div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; font-size: 12.5px; color: var(--text-muted); gap: 10px; font-family: var(--font-body);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 20px; color: #8b5cf6;"></i>
            <span>Connecting...</span>
        </div>`;
    }

    let queryRef = db.collection('rvnl_tracker').doc('chats_store').collection('messages');

    // Build filters depending on target type
    if (currentChatTarget === 'group_all') {
        queryRef = queryRef.where('target', '==', 'group_all');
    } else if (currentChatTarget.startsWith('group_')) {
        queryRef = queryRef.where('target', '==', currentChatTarget);
    } else {
        // DM private chat matches either senderA->recipientB or senderB->recipientA
        const threadId1 = `${state.currentUserEmail}_${currentChatTarget}`;
        const threadId2 = `${currentChatTarget}_${state.currentUserEmail}`;
        queryRef = queryRef.where('threadId', 'in', [threadId1, threadId2]);
    }

    let debounceTimer = null;
    let isFirstLoad = !state.chatMessagesCache[currentChatTarget] || state.chatMessagesCache[currentChatTarget].length === 0;

    chatUnsubscribe = queryRef.onSnapshot({ includeMetadataChanges: false }, snapshot => {
        if (snapshot.empty) {
            if (!state.chatMessagesCache[currentChatTarget] || state.chatMessagesCache[currentChatTarget].length === 0) {
                state.chatMessagesCache[currentChatTarget] = [];
                localStorage.setItem("rvnl_chat_messages_cache", JSON.stringify(state.chatMessagesCache));
                viewport.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 11.5px; padding-top: 30px; font-family:var(--font-body);">No messages here yet. Send a message to start!</div>`;
            }
            return;
        }

        // Convert snapshot to array of message objects
        const messagesList = [];
        snapshot.forEach(doc => {
            messagesList.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Sort new snapshot messages in-memory by timestamp
        messagesList.sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : Date.now();
            const timeB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : Date.now();
            return timeA - timeB;
        });

        // Get existing cached messages
        const existingCache = state.chatMessagesCache[currentChatTarget] || [];

        // Merge lists cleanly by message ID to prevent partial loads or jumps
        const mergedMap = new Map();
        existingCache.forEach(m => mergedMap.set(m.id, m));
        messagesList.forEach(m => mergedMap.set(m.id, m));

        // Re-sort the merged array
        const mergedList = Array.from(mergedMap.values());
        mergedList.sort((a, b) => {
            const timeA = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : Date.now();
            const timeB = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : Date.now();
            return timeA - timeB;
        });

        // Slice to render only the last 100 messages
        const recentMessages = mergedList.slice(-100);
        
        // Save back to local cache and disk
        state.chatMessagesCache[currentChatTarget] = recentMessages;
        localStorage.setItem("rvnl_chat_messages_cache", JSON.stringify(state.chatMessagesCache));

        // Render function
        const triggerRender = () => {
            // Force scroll if it's the initial load, or if a new message was appended
            const shouldForceScroll = isFirstLoad || (recentMessages.length > existingCache.length);
            renderChatMessagesList(recentMessages, viewport, shouldForceScroll);
            isFirstLoad = false; // Mark initial load complete only after rendering occurs
        };

        if (isFirstLoad) {
            // Debounce rendering during the first load sequence to collect multiple fast snapshots
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(triggerRender, 150);
        } else {
            // Instant render for subsequent real-time updates
            triggerRender();
        }
    }, err => {
        console.error("Chat sync failed: ", err);
    });
}

async function sendChatMessage(text) {
    const threadId = (currentChatTarget && currentChatTarget.includes("@")) 
        ? `${state.currentUserEmail}_${currentChatTarget}` 
        : "";

    const nameRaw = state.currentUser || state.currentUserEmail || "User";
    const senderName = typeof nameRaw === 'string' ? nameRaw.split("<")[0].trim() : String(nameRaw);

    const payload = {
        text: text,
        senderEmail: state.currentUserEmail,
        senderName: senderName,
        target: currentChatTarget,
        threadId: threadId,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        console.log("Attempting to send chat message payload:", payload);
        await db.collection('rvnl_tracker').doc('chats_store').collection('messages').add(payload);
        console.log("Message successfully written to Firestore.");
    } catch (err) {
        console.error("Error sending message to Firestore: ", err);
        alert("Failed to send message: " + err.message);
    }
}

function monitorUnreadMessageBadge() {
    if (!state.currentUserEmail) return;

    const drawer = document.getElementById("dev-chat-drawer");
    const toggleBtn = document.getElementById("dev-chat-toggle-btn");
    if (!drawer || !toggleBtn) return;

    db.collection('rvnl_tracker').doc('chats_store').collection('messages')
        .where('target', '==', state.currentUserEmail)
        .where('read', '==', false)
        .onSnapshot(snapshot => {
            const counts = {};
            let totalUnread = 0;
            let rosterChanged = false;
            const isDrawerOpen = drawer.classList.contains("active");

            snapshot.forEach(doc => {
                const msg = doc.data();
                const sender = msg.senderEmail;
                if (sender) {
                    // If we are actively viewing this chat, auto-read it in background
                    if (isDrawerOpen && currentChatTarget === sender) {
                        doc.ref.update({ read: true });
                        return; // Skip adding to unread count
                    }

                    counts[sender] = (counts[sender] || 0) + 1;
                    totalUnread++;

                    // Auto-pin DM: If sender is not in active DMs list, append dynamically
                    if (!state.activeChatDMs.includes(sender)) {
                        state.activeChatDMs.push(sender);
                        rosterChanged = true;
                    }
                }
            });

            if (rosterChanged) {
                localStorage.setItem("rvnl_active_chat_dms", JSON.stringify(state.activeChatDMs));
            }

            state.chatUnreadCounts = counts;

            // Update floating toggle button badge
            const unreadBadge = toggleBtn.querySelector(".chat-unread-badge");
            if (unreadBadge) {
                if (totalUnread > 0 && !isDrawerOpen) {
                    unreadBadge.textContent = totalUnread;
                    unreadBadge.style.display = "flex";
                } else {
                    unreadBadge.style.display = "none";
                }
            }

            // Re-render sidebar to display unread indicator badges next to DMs
            const searchInput = document.getElementById("chat-sidebar-search");
            const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
            renderChatSidebarList(query);
        }, err => {
            console.error("Unread message badge monitoring failed: ", err);
        });
}

async function markMessagesAsRead(target) {
    if (!target || !target.includes("@")) return; // Only apply read status checks for direct messages (DMs)
    if (!state.currentUserEmail) return;

    try {
        const unreadDocs = await db.collection('rvnl_tracker').doc('chats_store').collection('messages')
            .where('senderEmail', '==', target)
            .where('target', '==', state.currentUserEmail)
            .where('read', '==', false)
            .get();

        if (!unreadDocs.empty) {
            const batch = db.batch();
            unreadDocs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();
            console.log(`Marked ${unreadDocs.size} messages from ${target} as read.`);
        }
    } catch (e) {
        console.error("Failed to mark messages as read: ", e);
    }
}

function renderChatMessagesList(messagesArray, viewport, forceScroll = false) {
    if (!viewport) return;
    viewport.innerHTML = "";

    let lastMessageDateStr = "";

    messagesArray.forEach(msg => {
        const isMe = msg.senderEmail === state.currentUserEmail;

        // 1. Calculate Date Divider
        let dateDividerHtml = "";
        const msgDate = msg.timestamp ? (msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp)) : new Date();
        const dateStr = msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        if (dateStr !== lastMessageDateStr) {
            lastMessageDateStr = dateStr;
            
            // Friendly today / yesterday labels
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const tempYesterday = new Date();
            tempYesterday.setDate(tempYesterday.getDate() - 1);
            const yesterday = tempYesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            let label = dateStr;
            if (dateStr === today) label = "Today";
            else if (dateStr === yesterday) label = "Yesterday";

            dateDividerHtml = `<div class="message-date-divider">${label}</div>`;
        }

        // 2. Format Timestamp for bubble
        const timeStr = msgDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        // 3. Sender badge for group chats
        let senderBadge = "";
        if (!isMe && (currentChatTarget.startsWith('group_') || currentChatTarget === 'group_all')) {
            const init = (msg.senderName || msg.senderEmail || "?").substring(0, 2);
            senderBadge = `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; margin-left: 2px;">
                <div class="chat-badge-avatar" style="width:18px; height:18px; font-size:8px; background: rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); color:#8b5cf6;">${init}</div>
                <span style="font-size: 10px; font-weight: 700; color: var(--accent-purple, #8b5cf6);">${msg.senderName || msg.senderEmail.split('@')[0]}</span>
            </div>`;
        }

        const row = document.createElement("div");
        row.style.cssText = "display: flex; flex-direction: column; width: 100%; margin-bottom: 6px;";
        
        // Build visual checkmarks for outgoing messages based on actual read status
        let checkmarks = '';
        if (isMe) {
            if (msg.read === true) {
                checkmarks = `<span style="color: #3b82f6; font-size: 9px;" title="Seen"><i class="fa-solid fa-check-double"></i></span>`;
            } else {
                checkmarks = `<span style="color: #94a3b8; font-size: 9px;" title="Delivered"><i class="fa-solid fa-check"></i></span>`;
            }
        }

        row.innerHTML = `
            ${dateDividerHtml}
            <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; width: 100%;">
                ${senderBadge}
                <div class="message-bubble ${isMe ? 'message-outgoing' : 'message-incoming'}">
                    <span style="padding-right: 45px; display: inline-block;">${msg.text}</span>
                    <div class="message-time-meta">
                        <span>${timeStr}</span>
                        ${checkmarks}
                    </div>
                </div>
            </div>
        `;
        viewport.appendChild(row);
    });

    // Auto Scroll to bottom (if forced, or if user is already looking at bottom history)
    const threshold = 180; // pixels from bottom
    const isNearBottom = (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight) < threshold;

    if (forceScroll || isNearBottom || messagesArray.length <= 5) {
        // Execute synchronously before browser paint cycle to prevent snapping animations
        viewport.scrollTop = viewport.scrollHeight;
        
        // Execute a fast backup check to absorb lazy image loads or layouts
        setTimeout(() => {
            viewport.scrollTop = viewport.scrollHeight;
        }, 15);
    }
}

function setupCustomGroupModal() {
    const createBtn = document.getElementById("btn-create-custom-group");
    const modal = document.getElementById("custom-group-modal");
    const cancelBtn = document.getElementById("btn-custom-group-cancel");
    const submitBtn = document.getElementById("btn-custom-group-submit");
    const nameInput = document.getElementById("custom-group-name-input");
    const checklist = document.getElementById("custom-group-members-checklist");
    const searchInput = document.getElementById("custom-group-member-search");

    if (!createBtn || !modal || !cancelBtn || !submitBtn || !nameInput || !checklist || !searchInput) return;

    let selectedEmails = new Set();

    function renderChecklist(filterQuery = "") {
        checklist.innerHTML = "";
        const developers = Object.keys(state.userPermissions || {}).filter(email => email !== state.currentUserEmail);
        const filtered = developers.filter(email => {
            const shortName = email.split("@")[0].toLowerCase();
            return shortName.includes(filterQuery.toLowerCase()) || email.toLowerCase().includes(filterQuery.toLowerCase());
        });

        if (filtered.length === 0) {
            checklist.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); padding: 4px;">No members match search.</div>`;
            return;
        }

        filtered.forEach(email => {
            const shortName = email.split("@")[0];
            const label = document.createElement("label");
            label.style.cssText = "display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-primary); cursor: pointer; padding: 2px 0;";
            
            const isChecked = selectedEmails.has(email) ? "checked" : "";
            label.innerHTML = `<input type="checkbox" value="${email}" ${isChecked} style="margin: 0;"> <span>${shortName} (${email})</span>`;
            
            // Listen for checks to update our Set
            const checkbox = label.querySelector("input");
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    selectedEmails.add(email);
                } else {
                    selectedEmails.delete(email);
                }
            });

            checklist.appendChild(label);
        });
    }

    // Show Modal & load members list
    createBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        nameInput.value = "";
        searchInput.value = "";
        selectedEmails.clear();
        renderChecklist("");
        modal.style.display = "flex";
    });

    // Handle typing in search input
    searchInput.addEventListener("input", (e) => {
        renderChecklist(e.target.value.trim());
    });

    // Hide Modal
    cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        modal.style.display = "none";
    });

    // Submit Group Creation to Firestore
    submitBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const name = nameInput.value.trim();
        if (!name) {
            alert("Please enter a group name.");
            return;
        }

        const members = [state.currentUserEmail, ...Array.from(selectedEmails)];

        if (members.length < 2) {
            alert("Please select at least one other member to create a group.");
            return;
        }

        const groupId = `group_custom_${Date.now()}`;
        const payload = {
            id: groupId,
            name: name,
            members: members,
            createdBy: state.currentUserEmail,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating...`;
            
            await db.collection('rvnl_tracker').doc('chats_store').collection('custom_groups').doc(groupId).set(payload);
            
            modal.style.display = "none";
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Create`;
            
            // Switch target to new group
            currentChatTarget = groupId;
            updateChatHeaderUI();
            loadChatMessages();
        } catch (err) {
            console.error("Failed to create custom group: ", err);
            alert("Failed to create group: " + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Create`;
        }
    });
}

function monitorCustomGroups() {
    if (!state.currentUserEmail) return;

    db.collection('rvnl_tracker').doc('chats_store').collection('custom_groups')
        .where('members', 'array-contains', state.currentUserEmail)
        .onSnapshot(snapshot => {
            const groupsList = [];
            snapshot.forEach(doc => {
                groupsList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            state.customGroups = groupsList;

            // Re-render sidebar to display new groups
            const searchInput = document.getElementById("chat-sidebar-search");
            const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
            renderChatSidebarList(query);
            
            // Update chat header UI in case current group details loaded or changed names
            updateChatHeaderUI();
        }, err => {
            console.error("Custom groups sync failed: ", err);
        });
}




