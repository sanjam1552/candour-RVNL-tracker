// RVNL Client Portal - Read-Only Logic
const clientEmails = ["advisor.media.rail@gmail.com", "prteamrvnl@gmail.com", "prrvnl1@gmail.com", "sanjamcreatives@gmail.com"];
const APP_VERSION = "1.1.0";

function initToastStyles() {
    if (document.getElementById('toast-container-style')) return;
    const style = document.createElement('style');
    style.id = 'toast-container-style';
    style.innerHTML = `
        #toast-container {
            position: fixed;
            bottom: 20px;
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


const state = {
    tasks: [],
    filteredTasks: [],
    selectedMonth: "",
    selectedCategory: "all",
    selectedStatus: "all",
    searchText: "",
    currentUser: "",
    charts: {
        status: null,
        category: null
    }
};

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


// UI Elements
const preloader = document.getElementById("preloader");
const loginOverlay = document.getElementById("login-modal-overlay");
const loginForm = document.getElementById("client-login-form");
const loginEmailInput = document.getElementById("login-email-input");
const loginInfoMsg = document.getElementById("login-info-msg");
const loginErrorMsg = document.getElementById("login-error-msg");
const clientUserDisplay = document.getElementById("client-user-display");
const adminSwitchPlaceholder = document.getElementById("admin-switch-placeholder");
const logoutBtn = document.getElementById("logout-btn");
const monthFilter = document.getElementById("month-filter");
const typeFilter = document.getElementById("type-filter");
const statusFilter = document.getElementById("status-filter");
const taskTableBody = document.getElementById("task-table-body");
const tasksTableCard = document.getElementById("tasks-table-card");
const prPublicationsCard = document.getElementById("pr-publications-card");
const prPublicationsContainer = document.getElementById("pr-publications-container");

// Initialize Auth listener
function initAuth() {
    // Check for Firebase passwordless sign-in link
    if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please confirm your email address to complete sign in:');
        }
        if (email) {
            loginInfoMsg.textContent = "Verifying email link and logging in...";
            loginInfoMsg.style.display = "block";
            
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then(() => {
                    window.localStorage.removeItem('emailForSignIn');
                    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
                })
                .catch((error) => {
                    console.error("Error signing in:", error);
                    loginInfoMsg.style.display = "none";
                    loginErrorMsg.textContent = `Sign-in link failed or expired: ${error.message}`;
                    loginErrorMsg.style.display = "block";
                });
        }
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            const email = user.email || "";
            const isCandourAdmin = email.toLowerCase().endsWith("@candour.co.in") || email.toLowerCase() === "stutio2465@gmail.com";
            const isClient = clientEmails.includes(email.toLowerCase());

            if (isCandourAdmin || isClient) {
                // Authorized
                state.currentUser = email;
                clientUserDisplay.innerHTML = `<i class="fa-regular fa-user" style="margin-right: 5px;"></i> ${email.split("@")[0]}`;
                loginOverlay.style.display = "none";
                
                // Show Admin switch button if logged in as admin
                if (isCandourAdmin) {
                    adminSwitchPlaceholder.innerHTML = `
                        <a href="index.html" class="btn btn-secondary" style="border-color: var(--accent-purple); color: var(--accent-purple);">
                            <i class="fa-solid fa-user-gear"></i> Admin Panel
                        </a>
                    `;
                } else {
                    adminSwitchPlaceholder.innerHTML = "";
                }

                loadDashboardData();
            } else {
                // Unauthorized
                firebase.auth().signOut().then(() => {
                    showLoginError(`Access Denied: ${email} is not authorized to view this dashboard.`);
                });
            }
        } else {
            // Not logged in
            loginOverlay.style.display = "flex";
            if (preloader) preloader.style.display = "none";
        }
    });
}

function showLoginError(msg) {
    state.currentUser = "";
    loginOverlay.style.display = "flex";
    loginErrorMsg.textContent = msg;
    loginErrorMsg.style.display = "block";
    loginInfoMsg.style.display = "none";
    if (preloader) preloader.style.display = "none";
}

// Passwordless Login Request
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = loginEmailInput.value.trim().toLowerCase();
    
    // Validate if the email entered is one of the authorized client/admin emails
    const isCandourAdmin = email.endsWith("@candour.co.in") || email === "stutio2465@gmail.com";
    const isClient = clientEmails.includes(email);

    if (!isCandourAdmin && !isClient) {
        loginErrorMsg.textContent = "Access Denied: This email address is not authorized.";
        loginErrorMsg.style.display = "block";
        loginInfoMsg.style.display = "none";
        return;
    }

    loginInfoMsg.textContent = "Sending login link to your email...";
    loginInfoMsg.style.display = "block";
    loginErrorMsg.style.display = "none";

    const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true
    };

    firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
        .then(() => {
            window.localStorage.setItem('emailForSignIn', email);
            loginInfoMsg.textContent = "Login link sent! Please check your email inbox (and spam folder) to complete sign-in.";
        })
        .catch((error) => {
            console.error("Error sending email link:", error);
            loginInfoMsg.style.display = "none";
            loginErrorMsg.textContent = `Error: ${error.message}`;
            loginErrorMsg.style.display = "block";
        });
});

// Logout Handler
logoutBtn.addEventListener("click", () => {
    firebase.auth().signOut().then(() => {
        window.location.reload();
    });
});

// Load Data from Firestore
async function loadDashboardData() {
    try {
        // Version Check
        const configRef = db.collection('rvnl_tracker').doc('settings_config');
        const configSnapshot = await configRef.get();
        if (configSnapshot.exists) {
            const configData = configSnapshot.data();
            // Show notification if user is running an older cached version
            if (configData.version && configData.version !== APP_VERSION) {
                showToast(
                    "⚡ New Update Available",
                    `A new version of the RVNL Portal is available. Click reload to update.`,
                    0, // Keep open
                    () => {
                        window.location.reload(true);
                    },
                    "Reload Now"
                );
            }
        }

        // Listen to settings config changes in real-time to detect version updates
        configRef.onSnapshot(snapshot => {
            if (snapshot.exists) {
                const updatedConfig = snapshot.data();
                if (updatedConfig.version && updatedConfig.version !== APP_VERSION) {
                    showToast(
                        "⚡ New Update Available",
                        `A new version of the RVNL Portal is available. Click reload to update.`,
                        0, // Keep open
                        () => {
                            window.location.reload(true);
                        },
                        "Reload Now"
                    );
                }
            }
        });

        const itemsRef = db.collection('rvnl_tracker').doc('tasks_store').collection('items');
        const snapshot = await itemsRef.where('client', '==', 'RVNL').get();
        
        const loadedTasks = [];
        snapshot.forEach(doc => {
            const task = doc.data();
            if (!task.id) task.id = doc.id;
            
            // Normalize task fields
            if (task.status === "In Progress" || task.status === "WIP") task.status = "WIP";
            else if (task.status === "Awaiting Review" || task.status === "Sent for internal approval") task.status = "Sent for internal approval";
            else if (task.status === "Awaiting Approval" || task.status === "Sent to client") task.status = "Sent to client";
            else if (task.status === "Published" || task.status === "Published/Closed") task.status = "Published/Closed";
            else if (["On Hold", "Not Published", "Not posted by client missed", "Not used by client"].includes(task.status)) {
                task.status = "Not used by client";
            }
            loadedTasks.push(task);
        });

        state.tasks = loadedTasks;

        setupFilters();
        updateDashboard();
        
        if (preloader) preloader.style.display = "none";
    } catch (err) {
        console.error("Error loading dashboard data:", err);
        taskTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--accent-red); padding: 30px;">Error loading data: ${err.message}</td></tr>`;
        if (preloader) preloader.style.display = "none";
    }
}

// Setup Dropdown Filters
function setupFilters() {
    // Extract unique months
    const months = [...new Set(state.tasks.map(t => t.month))].filter(Boolean);
    
    // Sort months chronologically if possible (simple reverse chronological sort)
    months.sort((a, b) => {
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateB - dateA;
    });

    monthFilter.innerHTML = "";
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const currentMonthStr = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const hasCurrentMonth = months.includes(currentMonthStr);
    const defaultMonth = hasCurrentMonth ? currentMonthStr : (months[0] || "");

    months.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        if (m === defaultMonth) {
            opt.selected = true;
            state.selectedMonth = m;
        }
        monthFilter.appendChild(opt);
    });

    // Event listeners
    monthFilter.addEventListener("change", (e) => {
        state.selectedMonth = e.target.value;
        updateDashboard();
    });

    typeFilter.addEventListener("change", (e) => {
        state.selectedCategory = e.target.value;
        updateDashboard();
    });

    if (statusFilter) {
        statusFilter.addEventListener("change", (e) => {
            state.selectedStatus = e.target.value;
            updateDashboard();
        });
    }

    const portalSearch = document.getElementById("portal-search");
    if (portalSearch) {
        portalSearch.addEventListener("input", (e) => {
            state.searchText = e.target.value.toLowerCase();
            updateDashboard();
        });
    }

    // Metric Card Click Event Listeners
    const cardTotal = document.getElementById("kpi-card-total");
    const cardPublished = document.getElementById("kpi-card-published");
    const cardProgress = document.getElementById("kpi-card-progress");
    const cardPr = document.getElementById("kpi-card-pr");
    const tableCard = document.getElementById("tasks-table-card");

    const syncFiltersAndScroll = (category, status) => {
        state.selectedCategory = category;
        state.selectedStatus = status;
        if (typeFilter) typeFilter.value = category;
        if (statusFilter) statusFilter.value = status;
        updateDashboard();
        
        const targetCard = category === "PR Update" 
            ? document.getElementById("pr-publications-card") 
            : document.getElementById("tasks-table-card");
            
        if (targetCard && targetCard.style.display !== "none") {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    if (cardTotal) {
        cardTotal.addEventListener("click", () => syncFiltersAndScroll("all", "all"));
    }
    if (cardPublished) {
        cardPublished.addEventListener("click", () => syncFiltersAndScroll("all", "Published/Closed"));
    }
    if (cardProgress) {
        cardProgress.addEventListener("click", () => syncFiltersAndScroll("all", "In Progress"));
    }
    if (cardPr) {
        cardPr.addEventListener("click", () => syncFiltersAndScroll("PR Update", "Published/Closed"));
    }
}

// Get count of publications
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

// Render Dashboard Data & Charts
// Sort portal tasks consistently with admin panel
function updateDashboard() {
    // Filter tasks based on filters and search text
    state.filteredTasks = state.tasks.filter(t => {
        const matchMonth = isTaskActiveInMonth(t, state.selectedMonth);
        const matchCategory = state.selectedCategory === "all" || t.type === state.selectedCategory;
        
        let matchSearch = true;
        if (state.searchText) {
            const query = state.searchText;
            const title = (t.title || "").toLowerCase();
            const remarks = (t.remarks || "").toLowerCase();
            const subType = (t.subType || "").toLowerCase();
            const category = (t.type || "").toLowerCase();
            const pub = (t.publication || "").toLowerCase();
            matchSearch = title.includes(query) || remarks.includes(query) || subType.includes(query) || category.includes(query) || pub.includes(query);
        }
        
        return matchMonth && matchCategory && matchSearch;
    });

    const statusPriority = {
        "WIP": 1,
        "Sent for internal approval": 2,
        "Sent to client": 3,
        "Published/Closed": 4,
        "Not used by client": 5
    };
    state.filteredTasks.sort((a, b) => {
        const priorityA = statusPriority[a.status] || 6;
        const priorityB = statusPriority[b.status] || 6;
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

    // Calculate KPI values
    const total = state.filteredTasks.length;
    const published = state.filteredTasks.filter(t => t.status === "Published/Closed").length;
    const progress = state.filteredTasks.filter(t => ["WIP", "Sent for internal approval", "Sent to client"].includes(t.status)).length;
    const prCount = getPRPublicationsCount(state.filteredTasks);

    // Update UI counters
    document.getElementById("kpi-total").textContent = total;
    document.getElementById("kpi-published").textContent = published;
    document.getElementById("kpi-progress").textContent = progress;
    document.getElementById("kpi-pr").textContent = prCount;

    // Render Table
    renderTable();

    // Render Charts
    renderCharts(published, progress, total - (published + progress));
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

// Render Deliverables Table and separate PR grid
function renderTable() {
    taskTableBody.innerHTML = "";
    prPublicationsContainer.innerHTML = "";
    
    // 1. Filter tasks by status
    const displayTasks = state.filteredTasks.filter(t => {
        if (state.selectedStatus === "all") return true;
        if (state.selectedStatus === "In Progress") {
            return ["WIP", "Sent for internal approval", "Sent to client"].includes(t.status);
        }
        return t.status === state.selectedStatus;
    });

    // 2. Separate PR tasks and table tasks
    const prTasks = displayTasks.filter(t => t.type === "PR Update");
    const tableTasks = displayTasks.filter(t => t.type !== "PR Update");

    // 3. Handle Visibility of Panels depending on Category Selection
    if (state.selectedCategory === "PR Update") {
        if (tasksTableCard) tasksTableCard.style.display = "none";
        if (prPublicationsCard) prPublicationsCard.style.display = "block";
    } else if (state.selectedCategory === "Social Media" || state.selectedCategory === "Creative / Collateral") {
        if (tasksTableCard) tasksTableCard.style.display = "block";
        if (prPublicationsCard) prPublicationsCard.style.display = "none";
    } else { // "all"
        if (tasksTableCard) tasksTableCard.style.display = tableTasks.length > 0 ? "block" : "none";
        if (prPublicationsCard) prPublicationsCard.style.display = prTasks.length > 0 ? "block" : "none";
    }

    // 4. Render Table Tasks (Creatives & Social Media)
    if (tableTasks.length === 0 && state.selectedCategory !== "PR Update") {
        taskTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No deliverables found matching the selected filters.</td></tr>`;
    } else {
        tableTasks.forEach(task => {
            const tr = document.createElement("tr");

            // Format Status Badge
            let statusBadge = "";
            if (task.status === "Published/Closed") {
                statusBadge = `<span class="badge badge-published"><i class="fa-solid fa-circle-check"></i> Published/Used</span>`;
            } else if (task.status === "WIP") {
                statusBadge = `<span class="badge badge-progress"><i class="fa-solid fa-hourglass-half"></i> In Progress</span>`;
            } else if (task.status === "Sent for internal approval") {
                statusBadge = `<span class="badge badge-pending"><i class="fa-solid fa-user-clock"></i> Internal Approval</span>`;
            } else if (task.status === "Sent to client") {
                statusBadge = `<span class="badge badge-approved"><i class="fa-solid fa-paper-plane"></i> Awaiting Client</span>`;
            } else {
                statusBadge = `<span class="badge" style="background: rgba(107, 114, 128, 0.1); color: var(--text-secondary);"><i class="fa-solid fa-circle-minus"></i> On Hold / Not Used</span>`;
            }

            // Format Image preview (larger preview)
            let mediaHtml = "-";
            if (task.image) {
                mediaHtml = `
                    <div class="thumbnail-preview-container" style="display: flex; align-items: center; gap: 10px;">
                        <img src="${task.image}" loading="lazy" class="thumbnail-preview" alt="Clipping" onclick="window.open('${task.image}', '_blank')" title="Click to view full image">
                        <button class="download-btn" data-url="${task.image}" data-title="${task.title}" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: all 0.2s;" title="Download Image">
                            <i class="fa-solid fa-download" style="font-size: 14px;"></i>
                        </button>
                    </div>
                `;
            }

            let remarksHtml = "";
            if (task.remarks && task.remarks.trim() !== "") {
                remarksHtml = `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4; max-width: 500px; white-space: pre-line;">${task.remarks}</div>`;
            }

            // Live Link Button for Published tasks
            let liveLinkBtn = "";
            if (task.status === "Published/Closed" && task.liveLink && task.liveLink.trim() !== "") {
                liveLinkBtn = `
                    <a href="${task.liveLink}" target="_blank" class="live-post-link" style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11px; color: #3b82f6; text-decoration: none; font-weight: 600; padding: 2px 6px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 4px; transition: all 0.2s;" title="View Published Post">
                         <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 9px;"></i> View Post
                    </a>
                `;
            }

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); line-height: 1.5;">${formatTaskTitle(task.title || "-")}</div>
                    ${remarksHtml}
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        ${task.subType ? `<span style="font-size: 11px; color: var(--text-secondary); background: var(--bg-card); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); display: inline-block; margin-top: 6px;">${task.subType}</span>` : ""}
                        ${liveLinkBtn}
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${task.week || "Week 1"}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${task.date || ""}</div>
                </td>
                <td>${mediaHtml}</td>
            `;

            const downloadBtn = tr.querySelector(".download-btn");
            if (downloadBtn) {
                downloadBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const url = downloadBtn.getAttribute("data-url");
                    const title = downloadBtn.getAttribute("data-title") || "image";
                    const sanitizedTitle = title.trim().replace(/[^a-zA-Z0-9]/g, "_") + ".jpg";
                    downloadImage(url, sanitizedTitle);
                });
                // hover style feedback
                downloadBtn.addEventListener("mouseenter", () => {
                    downloadBtn.style.background = "var(--accent-blue)";
                    downloadBtn.style.color = "#ffffff";
                    downloadBtn.style.borderColor = "var(--accent-blue)";
                });
                downloadBtn.addEventListener("mouseleave", () => {
                    downloadBtn.style.background = "var(--bg-card)";
                    downloadBtn.style.color = "var(--text-secondary)";
                    downloadBtn.style.borderColor = "var(--border-color)";
                });
            }

            taskTableBody.appendChild(tr);
        });
    }

    // 5. Render PR Tasks in a Dedicated Grid Section below the table
    if (prTasks.length > 0 && state.selectedCategory !== "Creative / Collateral" && state.selectedCategory !== "Social Media") {
        prTasks.forEach(prTask => {
            const prCardDiv = document.createElement("div");
            prCardDiv.className = "pr-group-card";
            prCardDiv.style.marginBottom = "30px";
            prCardDiv.style.border = "1.5px solid var(--border-color)";
            prCardDiv.style.borderRadius = "16px";
            prCardDiv.style.overflow = "hidden";
            prCardDiv.style.backgroundColor = "var(--bg-secondary)";
            prCardDiv.style.boxShadow = "var(--glass-shadow)";
            prCardDiv.style.boxSizing = "border-box";

            // Status style
            const statusClass = prTask.status === "Published/Closed" ? "badge-published" : prTask.status === "WIP" ? "badge-progress" : "badge-pending";
            
            // Header Bar
            const displayStatus = prTask.status === "Published/Closed" ? "Published/Used" : prTask.status;
            const headerHtml = `
                <div style="background: var(--bg-card); border-bottom: 1.5px solid var(--border-color); padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                        <span style="background: rgba(139, 92, 246, 0.1); color: var(--accent-purple); font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;">${prTask.subType || 'Press Release'}</span>
                        <h3 style="margin: 0; font-family: var(--font-heading); font-size: 15px; font-weight: 700; color: var(--text-primary); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${prTask.title}</h3>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span class="badge ${statusClass}">${displayStatus}</span>
                        ${prTask.spokesperson ? `<span style="font-size: 11px; color: var(--text-secondary); background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 6px;"><strong>Spokesperson:</strong> ${prTask.spokesperson}</span>` : ''}
                        <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600; display: flex; align-items: center; gap: 4px; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border-color);">
                            <i class="fa-regular fa-calendar-days"></i> ${prTask.date || prTask.week || 'Week 1'}
                        </div>
                    </div>
                </div>
            `;

            // Publications Card Grid
            let pubsGridHtml = "";
            const list = prTask.publicationsList || [];
            if (list.length > 0) {
                pubsGridHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; padding: 20px;">`;
                list.forEach((pub) => {
                    pubsGridHtml += `
                        <div class="pr-pub-card" style="display: flex; gap: 14px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 12px; align-items: flex-start; box-shadow: 0 2px 8px rgba(0,0,0,0.02); box-sizing: border-box;">
                            ${pub.image ? `
                            <div style="width: 180px; height: 115px; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden; flex-shrink: 0; background: #ffffff; cursor: pointer;" onclick="window.open('${pub.image}', '_blank')" title="Click to view full clipping">
                                <img src="${pub.image}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>` : `
                            <div style="width: 180px; height: 115px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.03); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--text-muted);"><i class="fa-solid fa-image" style="font-size: 24px;"></i></div>`}
                            <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1; min-width: 0; padding-top: 4px;">
                                <div style="font-weight: 700; font-size: 13px; color: var(--text-primary); line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${pub.name || ''}">${pub.name || 'Unnamed Publication'}</div>
                                ${pub.date ? `<div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; font-weight: 500;"><i class="fa-regular fa-calendar" style="font-size: 10px;"></i> ${pub.date}</div>` : ''}
                                ${pub.link ? `
                                <a href="${pub.link}" target="_blank" style="display: inline-flex; align-items: center; gap: 5px; background: rgba(59, 130, 246, 0.08); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-decoration: none; width: fit-content; margin-top: 4px;">
                                    <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px;"></i> View Article
                                </a>` : ''}
                            </div>
                        </div>
                    `;
                });
                pubsGridHtml += `</div>`;
            } else if (prTask.publication) {
                // Fallback for single publication
                pubsGridHtml = `
                    <div style="padding: 20px; display: flex; gap: 16px; align-items: flex-start; background: var(--bg-secondary);">
                        ${prTask.image ? `
                        <div style="width: 180px; height: 115px; border-radius: 8px; border: 1px solid var(--border-color); overflow: hidden; flex-shrink: 0; background: #ffffff; cursor: pointer;" onclick="window.open('${prTask.image}', '_blank')" title="Click to view full clipping">
                            <img src="${prTask.image}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>` : ''}
                        <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 4px;">
                            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);">${prTask.publication}</div>
                            ${prTask.liveLink ? `
                            <a href="${prTask.liveLink}" target="_blank" style="display: inline-flex; align-items: center; gap: 5px; background: rgba(59, 130, 246, 0.08); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2); padding: 4px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 700; text-decoration: none; width: fit-content; margin-top: 4px;">
                                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 8px;"></i> View Article
                            </a>` : ''}
                        </div>
                    </div>
                `;
            } else {
                pubsGridHtml = `<div style="padding: 20px; color: var(--text-secondary); font-size: 13px;">No publication details logged.</div>`;
            }

            prCardDiv.innerHTML = headerHtml + pubsGridHtml;
            prPublicationsContainer.appendChild(prCardDiv);
        });
    }
}

// Render Chart.js Visuals
function renderCharts(published, progress, other) {
    const statusCtx = document.getElementById('status-chart').getContext('2d');
    const categoryCtx = document.getElementById('category-chart').getContext('2d');

    // Destroy existing charts if they exist to avoid layout conflicts
    if (state.charts.status) state.charts.status.destroy();
    if (state.charts.category) state.charts.category.destroy();

    // 1. Status Doughnut Chart
    state.charts.status = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Published', 'WIP / In Progress', 'Other'],
            datasets: [{
                data: [published, progress, Math.max(0, other)],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#475569',
                        font: { family: 'Inter', size: 11, weight: '600' }
                    }
                }
            },
            cutout: '70%'
        }
    });

    // 2. Category Share Bar Chart
    const categories = ['Creative / Collateral', 'PR Update', 'Social Media'];
    const counts = categories.map(cat => {
        if (cat === 'PR Update') {
            return getPRPublicationsCount(state.filteredTasks);
        }
        return state.filteredTasks.filter(t => t.type === cat && t.status === "Published/Closed").length;
    });

    state.charts.category = new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: ['Creatives & Collaterals', 'PR Updates', 'Social Media'],
            datasets: [{
                label: 'Deliverables Count',
                data: counts,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                borderColor: '#8b5cf6',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#475569', font: { family: 'Inter', weight: '500' }, stepSize: 1 }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569', font: { family: 'Inter', weight: '500' } }
                }
            }
        }
    });
}

// Download image directly as a blob (handles CORS/cross-domain download issues)
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'download.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Failed to download image:', error);
        // Fallback: open in new tab
        window.open(url, '_blank');
    }
}

// Start
document.addEventListener("DOMContentLoaded", () => {
    initAuth();
});
