// Greenshine Solar Client Portal - View-Only Logic
const APP_VERSION = "1.0.0";

// Toast notifications
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
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 6px;
            align-self: flex-start;
        }
    `;
    document.head.appendChild(style);
}

function showToast(title, body, duration = 4000, actionCallback = null, actionText = "Reload") {
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
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// State
const state = {
    tasks: [],
    filteredTasks: [],
    selectedMonth: "",
    selectedCategory: "all",
    selectedStatus: "all",
    searchText: "",
    charts: {
        status: null,
        category: null
    }
};

// Month Parsing & Ordering
function parseMonthStr(monthStr) {
    if (!monthStr) return null;
    const parts = monthStr.trim().split(" ");
    if (parts.length < 2) return null;
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
    const year = parseInt(parts[1], 10);
    if (monthIndex === -1 || isNaN(year)) return null;
    return { monthIndex, year };
}

function getMonthValue(monthStr) {
    const parsed = parseMonthStr(monthStr);
    if (!parsed) return 0;
    return parsed.year * 12 + parsed.monthIndex;
}

function getCurrentMonthStr() {
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

function isTaskActiveInMonth(task, selectedMonthStr) {
    if (!task.month) return false;
    if (!selectedMonthStr || selectedMonthStr === 'all') return true;
    
    const taskMonthVal = getMonthValue(task.month);
    const selectedMonthVal = getMonthValue(selectedMonthStr);
    
    if (taskMonthVal === selectedMonthVal) {
        return true;
    }
    
    // Carry forward unfinished tasks
    if (taskMonthVal < selectedMonthVal) {
        const currentMonthVal = getMonthValue(getCurrentMonthStr());
        if (selectedMonthVal > currentMonthVal) {
            return false;
        }
        return task.status !== "Published/Closed" && task.status !== "Not used by client";
    }
    
    return false;
}

function getPublishDateValue(task) {
    if (task.date) {
        const d = new Date(task.date);
        if (!isNaN(d.getTime())) return d.getTime();
        const match = task.date.match(/(\d+)(?:st|nd|rd|th)?/i);
        if (match) {
            const day = parseInt(match[1], 10);
            if (task.month) {
                const parts = task.month.split(" ");
                if (parts.length === 2) {
                    const parsedDate = new Date(`${day} ${parts[0]} ${parseInt(parts[1], 10)}`);
                    if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
                }
            }
            return day;
        }
    }
    if (task.week) {
        const matchWeek = task.week.match(/(\d+)/);
        if (matchWeek) return parseInt(matchWeek[1], 10) * 10;
    }
    return task.createdAt || 0;
}

// Telegram visit logger
function sendTelegramAlert(email = "Greenshine Client", context = "Greenshine Solar Portal") {
    if (sessionStorage.getItem(`tg_alert_sent_${context}`)) return;
    const BOT_TOKEN = "8990955400:AAE1fd6R6ASL5gtjTUFYEnhL-t9VlmH2gzg";
    const CHAT_ID = "5177384818";
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const message = `🔔 *Tool Access Alert*\n\n👤 *User:* ${email}\n🏢 *Client:* Greenshine Solar View\n⏰ *Time:* ${timeStr} (${dateStr})`;
    
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })
    })
    .then(() => sessionStorage.setItem(`tg_alert_sent_${context}`, "true"))
    .catch(err => console.warn("Telegram alert skipped:", err));
}

// UI Elements
const preloader = document.getElementById("preloader");
const monthFilter = document.getElementById("month-filter");
const typeFilter = document.getElementById("type-filter");
const statusFilter = document.getElementById("status-filter");
const portalSearch = document.getElementById("portal-search");
const taskTableBody = document.getElementById("task-table-body");
const tasksTableCard = document.getElementById("tasks-table-card");
const prPublicationsCard = document.getElementById("pr-publications-card");
const prPublicationsContainer = document.getElementById("pr-publications-container");
const adminSwitchPlaceholder = document.getElementById("admin-switch-placeholder");

// Lightbox Modal
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");

if (lightboxClose) {
    lightboxClose.onclick = () => {
        lightboxModal.style.display = "none";
    };
}
if (lightboxModal) {
    lightboxModal.onclick = (e) => {
        if (e.target === lightboxModal) {
            lightboxModal.style.display = "none";
        }
    };
}

function openLightbox(url) {
    if (!lightboxModal || !lightboxImg) return;
    lightboxImg.src = url;
    lightboxModal.style.display = "flex";
}

// Load Data from Firestore (Zero Login Barrier)
async function loadDashboardData() {
    try {
        sendTelegramAlert();

        // Optional: Check if a Candour Admin is logged in via Firebase
        if (firebase.auth()) {
            firebase.auth().onAuthStateChanged(user => {
                if (user && user.email) {
                    const email = user.email.toLowerCase();
                    if (email.endsWith("@candour.co.in") || email === "stutio2465@gmail.com") {
                        if (adminSwitchPlaceholder) {
                            adminSwitchPlaceholder.innerHTML = `
                                <a href="index.html" class="btn btn-secondary" style="border-color: var(--accent-purple); color: var(--accent-purple);">
                                    <i class="fa-solid fa-user-gear"></i> Admin Panel
                                </a>
                            `;
                        }
                    }
                }
            });
        }

        const itemsRef = db.collection('rvnl_tracker').doc('tasks_store').collection('items');
        
        // Query for both "Greenshine Solar" and "Green Shine Solar"
        const [snap1, snap2] = await Promise.all([
            itemsRef.where('client', '==', 'Greenshine Solar').get(),
            itemsRef.where('client', '==', 'Green Shine Solar').get().catch(() => ({ docs: [] }))
        ]);

        const taskMap = new Map();
        [...snap1.docs, ...snap2.docs].forEach(doc => {
            const task = doc.data();
            task.id = doc.id;

            // Status normalization
            if (task.status === "In Progress" || task.status === "WIP") task.status = "WIP";
            else if (task.status === "Awaiting Review" || task.status === "Sent for internal approval") task.status = "Sent for internal approval";
            else if (task.status === "Awaiting Approval" || task.status === "Sent to client") task.status = "Sent to client";
            else if (task.status === "Published" || task.status === "Published/Closed") task.status = "Published/Closed";
            else if (["On Hold", "Not Published", "Not posted by client missed", "Not used by client"].includes(task.status)) {
                task.status = "Not used by client";
            }
            taskMap.set(task.id, task);
        });

        state.tasks = Array.from(taskMap.values());

        setupFilters();
        updateDashboard();

        if (preloader) {
            preloader.style.opacity = "0";
            setTimeout(() => preloader.style.display = "none", 300);
        }
    } catch (err) {
        console.error("Error loading Greenshine dashboard data:", err);
        taskTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--accent-red); padding: 30px;">Error loading deliverables: ${err.message}</td></tr>`;
        if (preloader) preloader.style.display = "none";
    }
}

// Setup Dropdown Filters
function setupFilters() {
    const months = [...new Set(state.tasks.map(t => t.month))].filter(Boolean);
    
    // Reverse chronological sorting
    months.sort((a, b) => getMonthValue(b) - getMonthValue(a));

    monthFilter.innerHTML = "";
    months.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        monthFilter.appendChild(opt);
    });

    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All Months (Lifetime)";
    monthFilter.appendChild(allOpt);

    // Pick active month
    const curMonth = getCurrentMonthStr();
    if (months.includes(curMonth)) {
        state.selectedMonth = curMonth;
        monthFilter.value = curMonth;
    } else if (months.length > 0) {
        state.selectedMonth = months[0];
        monthFilter.value = months[0];
    } else {
        state.selectedMonth = "all";
        monthFilter.value = "all";
    }

    // Attach listeners
    monthFilter.onchange = (e) => {
        state.selectedMonth = e.target.value;
        updateDashboard();
    };

    typeFilter.onchange = (e) => {
        state.selectedCategory = e.target.value;
        updateDashboard();
    };

    statusFilter.onchange = (e) => {
        state.selectedStatus = e.target.value;
        updateDashboard();
    };

    if (portalSearch) {
        portalSearch.oninput = (e) => {
            state.searchText = e.target.value.trim().toLowerCase();
            updateDashboard();
        };
    }

    // Interactive KPI card clicks
    const cardTotal = document.getElementById("kpi-card-total");
    const cardPublished = document.getElementById("kpi-card-published");
    const cardProgress = document.getElementById("kpi-card-progress");
    const cardPr = document.getElementById("kpi-card-pr");

    const syncFiltersAndScroll = (category, status) => {
        state.selectedCategory = category;
        typeFilter.value = category;
        state.selectedStatus = status;
        statusFilter.value = status;
        updateDashboard();
        const targetCard = category === "PR Update" ? prPublicationsCard : tasksTableCard;
        if (targetCard && targetCard.style.display !== "none") {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    if (cardTotal) cardTotal.onclick = () => syncFiltersAndScroll("all", "all");
    if (cardPublished) cardPublished.onclick = () => syncFiltersAndScroll("all", "Published/Closed");
    if (cardProgress) cardProgress.onclick = () => syncFiltersAndScroll("all", "In Progress");
    if (cardPr) cardPr.onclick = () => syncFiltersAndScroll("all", "all");
}

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

// Update UI & Table
function updateDashboard() {
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
        if (priorityA !== priorityB) return priorityA - priorityB;
        
        if (a.status === "Published/Closed" && b.status === "Published/Closed") {
            return getPublishDateValue(b) - getPublishDateValue(a);
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const total = state.filteredTasks.length;
    const published = state.filteredTasks.filter(t => t.status === "Published/Closed").length;
    const progress = state.filteredTasks.filter(t => ["WIP", "Sent for internal approval", "Sent to client"].includes(t.status)).length;
    const prCount = getPRPublicationsCount(state.filteredTasks);

    document.getElementById("kpi-total").textContent = total;
    document.getElementById("kpi-published").textContent = published;
    document.getElementById("kpi-progress").textContent = progress;
    document.getElementById("kpi-pr").textContent = prCount;

    renderTable();
    renderCharts(published, progress, total - (published + progress));
}

function formatTaskTitle(title, maxLength = 120) {
    if (!title || title.length <= maxLength) return title || "";
    const truncated = title.substring(0, maxLength).trim() + "...";
    const uniqueId = "title-text-" + Math.floor(Math.random() * 100000000);
    return `
        <span id="${uniqueId}-short" style="line-height: 1.5; display: inline;">${truncated} 
            <button onclick="document.getElementById('${uniqueId}-short').style.display='none'; document.getElementById('${uniqueId}-full').style.display='inline'; return false;" style="background: none; border: none; color: #10b981; font-weight: 600; cursor: pointer; padding: 0; font-size: 11px; margin-left: 4px; font-family: inherit; display: inline-block;">Read More</button>
        </span>
        <span id="${uniqueId}-full" style="display: none; line-height: 1.5;">${title} 
            <button onclick="document.getElementById('${uniqueId}-short').style.display='inline'; document.getElementById('${uniqueId}-full').style.display='none'; return false;" style="background: none; border: none; color: #10b981; font-weight: 600; cursor: pointer; padding: 0; font-size: 11px; margin-left: 4px; font-family: inherit; display: inline-block;">Show Less</button>
        </span>
    `;
}

function renderTable() {
    taskTableBody.innerHTML = "";
    prPublicationsContainer.innerHTML = "";
    
    const displayTasks = state.filteredTasks.filter(t => {
        if (state.selectedStatus === "all") return true;
        if (state.selectedStatus === "In Progress") {
            return ["WIP", "Sent for internal approval", "Sent to client"].includes(t.status);
        }
        return t.status === state.selectedStatus;
    });

    const prTasks = displayTasks.filter(t => t.type === "PR Update");
    const tableTasks = displayTasks.filter(t => t.type !== "PR Update");

    if (state.selectedCategory === "PR Update") {
        if (tasksTableCard) tasksTableCard.style.display = "none";
        if (prPublicationsCard) prPublicationsCard.style.display = "block";
    } else if (state.selectedCategory === "Social Media" || state.selectedCategory === "Creative / Collateral") {
        if (tasksTableCard) tasksTableCard.style.display = "block";
        if (prPublicationsCard) prPublicationsCard.style.display = "none";
    } else {
        if (tasksTableCard) tasksTableCard.style.display = tableTasks.length > 0 ? "block" : "none";
        if (prPublicationsCard) prPublicationsCard.style.display = prTasks.length > 0 ? "block" : "none";
    }

    if (tableTasks.length === 0 && state.selectedCategory !== "PR Update") {
        taskTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No deliverables found matching the selected filters.</td></tr>`;
    } else {
        tableTasks.forEach(task => {
            const tr = document.createElement("tr");

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

            let mediaHtml = "-";
            if (task.image) {
                mediaHtml = `
                    <div class="thumbnail-preview-container" style="display: flex; align-items: center; gap: 10px;">
                        <img src="${task.image}" loading="lazy" class="thumbnail-preview" alt="Clipping" onclick="openLightbox('${task.image}')" title="Click to view full preview">
                        <button class="download-btn" data-url="${task.image}" data-title="${task.title}" style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-secondary); cursor: pointer; transition: all 0.2s;" title="Download Asset">
                            <i class="fa-solid fa-download" style="font-size: 14px;"></i>
                        </button>
                    </div>
                `;
            }

            let remarksHtml = "";
            if (task.remarks && task.remarks.trim() !== "") {
                remarksHtml = `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4; max-width: 500px; white-space: pre-line;">${task.remarks}</div>`;
            }

            let liveLinkBtn = "";
            if (task.status === "Published/Closed" && task.liveLink && task.liveLink.trim() !== "") {
                liveLinkBtn = `
                    <a href="${task.liveLink}" target="_blank" class="live-post-link" style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 11px; color: #10b981; text-decoration: none; font-weight: 600; padding: 2px 6px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; transition: all 0.2s;" title="View Live Post">
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
                    const title = downloadBtn.getAttribute("data-title") || "deliverable";
                    const sanitizedTitle = title.trim().replace(/[^a-zA-Z0-9]/g, "_") + ".jpg";
                    downloadImage(url, sanitizedTitle);
                });
            }

            taskTableBody.appendChild(tr);
        });
    }

    // Render PR Publications if present
    if (prTasks.length > 0 && state.selectedCategory !== "Creative / Collateral" && state.selectedCategory !== "Social Media") {
        prTasks.forEach(prTask => {
            const prCardDiv = document.createElement("div");
            prCardDiv.className = "pr-group-card";
            prCardDiv.style.marginBottom = "25px";
            prCardDiv.style.border = "1px solid var(--border-color)";
            prCardDiv.style.borderRadius = "16px";
            prCardDiv.style.overflow = "hidden";
            prCardDiv.style.backgroundColor = "var(--bg-secondary)";

            const pubCount = (prTask.publicationsList && prTask.publicationsList.length) || (prTask.publication ? 1 : 0);

            prCardDiv.innerHTML = `
                <div style="background: var(--bg-card); padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${prTask.title}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">${prTask.date || prTask.month || ""} • ${prTask.status}</div>
                    </div>
                    <span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-purple); font-weight: 600;">
                        <i class="fa-solid fa-newspaper"></i> ${pubCount} Clippings
                    </span>
                </div>
            `;

            prPublicationsContainer.appendChild(prCardDiv);
        });
    }
}

// Chart.js Rendering
function renderCharts(published, progress, onHold) {
    const statusCtx = document.getElementById('status-chart');
    const categoryCtx = document.getElementById('category-chart');
    if (!statusCtx || !categoryCtx) return;

    if (state.charts.status) state.charts.status.destroy();
    if (state.charts.category) state.charts.category.destroy();

    const safeHold = Math.max(0, onHold);
    const hasData = (published + progress + safeHold) > 0;

    state.charts.status = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Published/Used', 'In Progress', 'On Hold/Other'],
            datasets: [{
                data: hasData ? [published, progress, safeHold] : [0, 0, 1],
                backgroundColor: hasData ? ['#10b981', '#3b82f6', '#94a3b8'] : ['#e2e8f0', '#e2e8f0', '#e2e8f0'],
                borderWidth: 0
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

    const categories = ['Creative / Collateral', 'Social Media', 'PR Update'];
    const counts = categories.map(cat => state.filteredTasks.filter(t => t.type === cat && t.status === "Published/Closed").length);

    state.charts.category = new Chart(categoryCtx, {
        type: 'bar',
        data: {
            labels: ['Creatives & Collaterals', 'Social Media', 'PR & Media'],
            datasets: [{
                label: 'Completed Deliverables',
                data: counts,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: '#10b981',
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
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

// Download image helper
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'deliverable.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        window.open(url, '_blank');
    }
}

// Start immediately on load
document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
});
