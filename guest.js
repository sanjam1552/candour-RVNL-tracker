// RVNL Client Dashboard - Read-Only Logic
const clientEmails = ["advisor.media.rail@gmail.com", "prteamrvnl@gmail.com", "prrvnl1@gmail.com", "sanjamcreatives@gmail.com"];
const APP_VERSION = "1.1.0";

const state = {
    tasks: [],
    filteredTasks: [],
    selectedMonth: "",
    selectedCategory: "all",
    selectedStatus: "all",
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
            if (configData.version && configData.version !== APP_VERSION) {
                console.log(`New version detected (${configData.version}). Force reloading...`);
                alert("A new version of the Guest Dashboard is available. The page will reload automatically to update.");
                window.location.reload(true);
                return;
            }
        }

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
    months.forEach((m, idx) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        if (idx === 0) {
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
        if (tableCard) {
            tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
function updateDashboard() {
    // Filter tasks based on filters
    state.filteredTasks = state.tasks.filter(t => {
        const matchMonth = isTaskActiveInMonth(t, state.selectedMonth);
        const matchCategory = state.selectedCategory === "all" || t.type === state.selectedCategory;
        return matchMonth && matchCategory;
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

// Render Deliverables Table
function renderTable() {
    taskTableBody.innerHTML = "";
    
    const displayTasks = state.filteredTasks.filter(t => {
        if (state.selectedStatus === "all") return true;
        if (state.selectedStatus === "In Progress") {
            return ["WIP", "Sent for internal approval", "Sent to client"].includes(t.status);
        }
        return t.status === state.selectedStatus;
    });
    
    if (displayTasks.length === 0) {
        taskTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No deliverables found matching the selected filters.</td></tr>`;
        return;
    }

    displayTasks.forEach(task => {
        const tr = document.createElement("tr");

        // Format Status Badge
        let statusBadge = "";
        if (task.status === "Published/Closed") {
            statusBadge = `<span class="badge badge-published"><i class="fa-solid fa-circle-check"></i> Published</span>`;
        } else if (task.status === "WIP") {
            statusBadge = `<span class="badge badge-progress"><i class="fa-solid fa-hourglass-half"></i> In Progress</span>`;
        } else if (task.status === "Sent for internal approval") {
            statusBadge = `<span class="badge badge-pending"><i class="fa-solid fa-user-clock"></i> Internal Approval</span>`;
        } else if (task.status === "Sent to client") {
            statusBadge = `<span class="badge badge-approved"><i class="fa-solid fa-paper-plane"></i> Awaiting Client</span>`;
        } else {
            statusBadge = `<span class="badge" style="background: rgba(107, 114, 128, 0.1); color: var(--text-secondary);"><i class="fa-solid fa-circle-minus"></i> On Hold / Not Used</span>`;
        }

        // Format Image preview or media list (larger preview)
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
