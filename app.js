// RVNL Creative & PR Reporting Hub - Core Application Logic

// Application State
const state = {
    tasks: [],
    filteredTasks: [],
    currentPage: 1,
    pageSize: 12,
    activeTab: 'dashboard',
    activeView: 'table',
    filters: {
        type: 'all',
        month: 'all',
        status: 'all',
        owner: 'all',
        search: ''
    },
    charts: {
        trend: null,
        share: null
    }
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

// Format date to local readable format
function getFormattedToday() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupEventListeners();
    
    // Set current date in dashboard hero
    document.getElementById("current-time-display").textContent = getFormattedToday();
    document.getElementById("report-meta-date").textContent = getFormattedToday();

    // Load data from Firestore (async)
    loadData();
});
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

// Load data from Firestore; migrate localStorage on first run
async function loadData() {
    setSyncStatus('connecting');
    const docRef = db.collection('rvnl_tracker').doc('tasks_store');

    try {
        const snapshot = await docRef.get();

        if (snapshot.exists && Array.isArray(snapshot.data().tasks) && snapshot.data().tasks.length > 0) {
            // Data already in Firestore — use it
            state.tasks = snapshot.data().tasks;
        } else {
            // Nothing in Firestore yet — check if localStorage has user data to migrate
            const localData = localStorage.getItem('rvnl_tracker_data');
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Migrate localStorage up to Firestore
                        state.tasks = parsed;
                        console.log('Migrating localStorage data to Firestore...');
                        await docRef.set({ tasks: state.tasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
                        localStorage.removeItem('rvnl_tracker_data'); // clean up local copy
                        console.log('Migration complete.');
                    } else {
                        state.tasks = [...INITIAL_DATA];
                        await docRef.set({ tasks: state.tasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
                    }
                } catch(e) {
                    state.tasks = [...INITIAL_DATA];
                    await docRef.set({ tasks: state.tasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
                }
            } else {
                // Fresh start — seed with baseline data
                state.tasks = [...INITIAL_DATA];
                await docRef.set({ tasks: state.tasks, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
            }
        }

        // Migrate statuses to current schema
        state.tasks.forEach(task => {
            if (task.status === "In Progress" || task.status === "WIP") task.status = "WIP";
            else if (task.status === "Awaiting Review" || task.status === "Sent for internal approval") task.status = "Sent for internal approval";
            else if (task.status === "Awaiting Approval" || task.status === "Sent to client") task.status = "Sent to client";
            else if (task.status === "Published" || task.status === "Published/Closed") task.status = "Published/Closed";
            else if (["On Hold", "Not Published", "Not posted by client missed", "Not used by client"].includes(task.status)) {
                task.status = "Not used by client";
            }
            // Normalize Social Media subType: posts go to all platforms
            if (task.type === "Social Media") {
                task.subType = "All Platforms";
            }
        });

        setSyncStatus('synced');
        populateOwnerFilter();
        updateDashboard();
        renderTracker();
        setTimeout(compressExistingLargeImages, 2000);

    } catch (err) {
        console.error('Firestore load error:', err);
        setSyncStatus('offline');
        // Graceful fallback to localStorage if Firestore unreachable
        const localData = localStorage.getItem('rvnl_tracker_data');
        if (localData) {
            try { state.tasks = JSON.parse(localData); } catch(e) { state.tasks = [...INITIAL_DATA]; }
        } else {
            state.tasks = [...INITIAL_DATA];
        }
        populateOwnerFilter();
        updateDashboard();
        renderTracker();
    }
}

// Save current state to Firestore
async function saveData() {
    setSyncStatus('saving');
    const docRef = db.collection('rvnl_tracker').doc('tasks_store');
    try {
        await docRef.set({
            tasks: state.tasks,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        setSyncStatus('synced');
    } catch (err) {
        console.error('Firestore save error:', err);
        setSyncStatus('offline');
        // Fallback: keep a local copy so no data is lost
        localStorage.setItem('rvnl_tracker_data', JSON.stringify(state.tasks));
    }
}

// Initialize and Setup Theme Toggle (Dark Mode default)
function initTheme() {
    const activeTheme = localStorage.getItem("rvnl_theme") || "dark";
    document.documentElement.setAttribute("data-theme", activeTheme);
    updateThemeToggleIcon(activeTheme);
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
    state.tasks.forEach(t => {
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

// Setup Event Listeners
function setupEventListeners() {
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

    // 4. Global Search Handler
    document.getElementById("global-search").addEventListener("input", (e) => {
        state.filters.search = e.target.value.toLowerCase();
        state.currentPage = 1;
        renderTracker();
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
    document.getElementById("clear-filters-btn").addEventListener("click", resetFilters);

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
            document.getElementById("filter-status").value = statusFilter;
            state.filters.status = statusFilter;
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

    // Handle form submit
    document.getElementById("task-form").addEventListener("submit", handleFormSubmit);

    // Image upload handler
    const imgFileInput = document.getElementById("task-image-file");
    imgFileInput.addEventListener("change", handleImageUpload);
    document.getElementById("remove-preview-img-btn").addEventListener("click", removeImagePreview);

    // 9. Report Generation
    document.getElementById("report-period-type").addEventListener("change", (e) => {
        const weekGroup = document.getElementById("report-week-group");
        if (e.target.value === "weekly") {
            weekGroup.style.display = "flex";
        } else {
            weekGroup.style.display = "none";
        }
    });
    
    document.getElementById("generate-report-btn").addEventListener("click", generateReport);
    document.getElementById("report-clipping-upload").addEventListener("change", handleReportClippingUpload);
    document.getElementById("print-report-btn").addEventListener("click", () => {
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

    // Restore local localStorage data → Firestore
    const restoreLocalBtn = document.getElementById("restore-local-btn");
    if (restoreLocalBtn) {
        restoreLocalBtn.addEventListener("click", restoreLocalBackup);
    }

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
    
    // Initialize API Key Status display
    updateApiKeyStatus();
}
// Reset all search and drop-down filters
function resetFilters() {
    document.getElementById("filter-type").value = "all";
    document.getElementById("filter-month").value = "all";
    document.getElementById("filter-status").value = "all";
    document.getElementById("filter-owner").value = "all";
    document.getElementById("global-search").value = "";
    
    state.filters = {
        type: 'all',
        month: 'all',
        status: 'all',
        owner: 'all',
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

    // Always show sub-type group first (will be hidden for Social Media)
    const subTypeGroupEl = subTypeSelect.closest('.form-group');
    if (subTypeGroupEl) subTypeGroupEl.classList.remove('hidden');

    if (type === "PR Update") {
        prFields.classList.remove("hidden");
        lblSubType.textContent = "PR Category";
        subTypeSelect.innerHTML = `
            <option value="Press Release">Press Release</option>
            <option value="Interview">Interview</option>
            <option value="Event coverage">Event Coverage</option>
            <option value="Documents">Documents</option>
        `;
    } else if (type === "Social Media") {
        prFields.classList.add("hidden");
        // Social media posts go to ALL platforms — hide sub-type selector
        const subTypeGroup = subTypeSelect.closest('.form-group');
        if (subTypeGroup) subTypeGroup.classList.add('hidden');
        subTypeSelect.innerHTML = `<option value="All Platforms">All Platforms</option>`;
        return; // early return to avoid showing sub-type group below
    } else {
        prFields.classList.add("hidden");
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

// Returns { icon, color, label } for a given social media platform subType
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

// Open Drawer (Create or Edit state)
function openDrawer(taskId = null) {
    const form = document.getElementById("task-form");
    form.reset();
    document.getElementById("task-id").value = "";
    removeImagePreview();

    const overlay = document.getElementById("task-drawer-overlay");
    const title = document.getElementById("drawer-title");
    
    // Default current month/week selection
    document.getElementById("task-month").value = "June 2026";
    document.getElementById("task-week").value = "Week 1";
    document.getElementById("task-status").value = "WIP";
    
    togglePRFormFields("Social Media"); // default reset

    if (taskId) {
        title.textContent = "Edit Tracked Item";
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            document.getElementById("task-id").value = task.id;
            document.getElementById("task-type").value = task.type;
            togglePRFormFields(task.type);
            
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
            document.getElementById("task-impressions").value = task.impressions || "";
            document.getElementById("task-engagement").value = task.engagement || "";
            
            if (task.type === "PR Update") {
                document.getElementById("task-spokesperson").value = task.spokesperson || "";
                document.getElementById("task-publication").value = task.publication || "";
            }

            // Image clipping preview if it exists
            if (task.image) {
                showImagePreview(task.image);
            }
        }
    } else {
        title.textContent = "Add Creative Asset or PR Activity";
    }

    overlay.classList.add("active");
}

// Close Drawer
function closeDrawer() {
    document.getElementById("task-drawer-overlay").classList.remove("active");
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

// Convert Uploaded Image File to Base64 with compression
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        compressImage(file, 400, 400, 0.7, function(compressedBase64) {
            showImagePreview(compressedBase64);
        });
    }
}

// Convert Uploaded Image File to Base64 (from Report Preview) with compression
function handleReportClippingUpload(e) {
    const file = e.target.files[0];
    if (file && state.currentUploadTaskId) {
        compressImage(file, 400, 400, 0.7, function(compressedBase64) {
            const taskId = state.currentUploadTaskId;
            const task = state.tasks.find(t => t.id === taskId);
            if (task) {
                task.image = compressedBase64;
                saveData();
                generateReport(); // Reload report preview
            }
            // Reset input and state
            e.target.value = "";
            state.currentUploadTaskId = null;
        });
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
    const impressions = document.getElementById("task-impressions").value;
    const engagement = document.getElementById("task-engagement").value;
    
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

    const taskData = {
        type,
        subType,
        title,
        status,
        owner,
        month,
        week,
        date,
        canvaLink,
        liveLink,
        remarks,
        impressions,
        engagement,
        image
    };

    if (type === "PR Update") {
        taskData.spokesperson = document.getElementById("task-spokesperson").value;
        taskData.publication = document.getElementById("task-publication").value;
    } else {
        taskData.spokesperson = "";
        taskData.publication = "";
    }

    if (id) {
        // Edit Mode
        const index = state.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            state.tasks[index] = { ...state.tasks[index], ...taskData };
        }
    } else {
        // Create Mode
        taskData.id = generateUUID();
        state.tasks.unshift(taskData);
    }

    saveData();
    closeDrawer();
    populateOwnerFilter();
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
function deleteTask(id) {
    if (confirm("Are you sure you want to delete this item?")) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveData();
        populateOwnerFilter();
        updateDashboard();
        renderTracker();
    }
}

// Duplicate item
function duplicateTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        const copy = { ...task, id: generateUUID(), title: `${task.title} (Copy)` };
        state.tasks.unshift(copy);
        saveData();
        updateDashboard();
        renderTracker();
    }
}

// ====================================================
// DASHBOARD VIEW RENDERING & GRAPH ENGINE
// ====================================================

function updateDashboard() {
    // 1. Calculate general stats
    const total = state.tasks.length;
    const linkedin = state.tasks.filter(t => t.type === 'Social Media' && t.status === 'Published/Closed').length;
    const pr = state.tasks.filter(t => t.type === 'PR Update').length;
    const wip = state.tasks.filter(t => t.status === 'WIP' || t.status === 'Sent for internal approval').length;

    document.getElementById("stat-total-creatives").textContent = total;
    document.getElementById("stat-total-linkedin").textContent = linkedin;
    document.getElementById("stat-total-pr").textContent = pr;
    document.getElementById("stat-total-wip").textContent = wip;

    // 2. Render Charts
    renderTrendChart();
    renderShareChart();

    // 3. Render Dashboard Lists
    renderDashboardLists();
}

function renderTrendChart() {
    const ctx = document.getElementById('outputTrendChart').getContext('2d');
    
    // Group tasks by Month for Social Media and PR
    const months = ["May 2026", "June 2026", "July 2026"];
    const smData = [];
    const prData = [];
    const creativeData = [];

    months.forEach(m => {
        smData.push(state.tasks.filter(t => t.month === m && t.type === 'Social Media').length);
        prData.push(state.tasks.filter(t => t.month === m && t.type === 'PR Update').length);
        creativeData.push(state.tasks.filter(t => t.month === m && t.type === 'Creative / Collateral').length);
    });

    // Destroy existing chart if any
    if (state.charts.trend) state.charts.trend.destroy();

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const labelColor = isDark ? "#9ca3af" : "#4b5563";
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    state.charts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ["May 2026", "June 2026", "July 2026"],
            datasets: [
                {
                    label: 'Social Media',
                    data: smData,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                },
                {
                    label: 'PR Activities',
                    data: prData,
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                },
                {
                    label: 'Creative Collateral',
                    data: creativeData,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
                }
            ]
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
    const categories = ['Social Media', 'PR Update', 'Creative / Collateral'];
    const dataVals = [
        state.tasks.filter(t => t.type === 'Social Media').length,
        state.tasks.filter(t => t.type === 'PR Update').length,
        state.tasks.filter(t => t.type === 'Creative / Collateral').length
    ];

    if (state.charts.share) state.charts.share.destroy();

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const labelColor = isDark ? "#9ca3af" : "#4b5563";

    state.charts.share = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: dataVals,
                backgroundColor: ['#10b981', '#8b5cf6', '#f59e0b'],
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
    // 1. Recent Completed Social Media Posts (Published)
    const recentCompleted = state.tasks
        .filter(t => t.type === 'Social Media' && t.status === 'Published/Closed')
        .slice(0, 5); // Take top 5 from array (most recently added/parsed)
        
    const completedList = document.getElementById("recent-completed-list");
    completedList.innerHTML = "";
    
    if (recentCompleted.length === 0) {
        completedList.innerHTML = '<p class="stat-desc" style="padding: 20px; text-align: center;">No completed posts found.</p>';
    } else {
        recentCompleted.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "recent-item";
            
            const bgClass = "bg-green";
            const iconClass = "fa-solid fa-share-nodes";
            
            itemEl.innerHTML = `
                <div class="item-left">
                    <div class="item-icon ${bgClass}"><i class="${iconClass}"></i></div>
                    <div class="item-details">
                        <h5>${item.title}</h5>
                        <span>${item.month} ${item.date ? '• ' + item.date : ''}</span>
                    </div>
                </div>
                <div class="item-right">
                    <span class="badge badge-social">All Platforms</span>
                </div>
            `;
            completedList.appendChild(itemEl);
        });
    }

    // 2. Hot Tasks (WIP / Awaiting Review)
    const hotTasks = state.tasks
        .filter(t => t.status === 'WIP' || t.status === 'Sent for internal approval' || t.status === 'Sent to client')
        .slice(0, 5);
        
    const hotList = document.getElementById("recent-hot-tasks");
    hotList.innerHTML = "";

    if (hotTasks.length === 0) {
        hotList.innerHTML = '<p class="stat-desc" style="padding: 20px; text-align: center;">No active tasks. Good job!</p>';
    } else {
        hotTasks.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "recent-item";
            
            let badgeStatus = "status-wip";
            if (item.status === "Sent for internal approval") badgeStatus = "status-review";
            if (item.status === "Sent to client") badgeStatus = "status-approval";

            itemEl.innerHTML = `
                <div class="item-left">
                    <div class="item-icon bg-amber"><i class="fa-solid fa-hourglass-half"></i></div>
                    <div class="item-details">
                        <h5>${item.title}</h5>
                        <span>Owner: ${item.owner}</span>
                    </div>
                </div>
                <div class="item-right">
                    <span class="status-pill ${badgeStatus}" style="font-size:10px; padding:3px 8px;">${item.status}</span>
                </div>
            `;
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
        // Search filter
        const matchesSearch = !state.filters.search || 
            task.title.toLowerCase().includes(state.filters.search) || 
            (task.remarks && task.remarks.toLowerCase().includes(state.filters.search)) || 
            (task.owner && task.owner.toLowerCase().includes(state.filters.search)) ||
            (task.publication && task.publication.toLowerCase().includes(state.filters.search));

        // Type filter
        const matchesType = state.filters.type === 'all' || task.type === state.filters.type;
        
        // Month filter
        const matchesMonth = state.filters.month === 'all' || task.month === state.filters.month;
        
        // Status filter
        const matchesStatus = state.filters.status === 'all' || task.status === state.filters.status;
        
        // Owner filter
        const matchesOwner = state.filters.owner === 'all' || task.owner === state.filters.owner;

        return matchesSearch && matchesType && matchesMonth && matchesStatus && matchesOwner;
    });

    // Sort tracker items by status priority
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
        return priorityA - priorityB;
    });

    if (state.activeView === "table") {
        renderTrackerTable();
    } else {
        renderTrackerKanban();
    }
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
        if (task.type === "Social Media") {
            typeBadge = `<span class="badge badge-social"><i class="fa-solid fa-share-nodes" style="color:#3b82f6;"></i> Social</span>`;
        } else if (task.type === "PR Update") {
            typeBadge = `<span class="badge badge-pr"><i class="fa-solid fa-bullhorn"></i> PR</span>`;
        } else {
            typeBadge = `<span class="badge badge-creative"><i class="fa-solid fa-palette"></i> Design</span>`;
        }

        // Status Pill
        let statusClass = "status-wip";
        if (task.status === "Published/Closed") statusClass = "status-published";
        if (task.status === "Sent for internal approval") statusClass = "status-review";
        if (task.status === "Sent to client") statusClass = "status-approval";
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
        linksHtml += '</div>';

        // PR Specific details to display
        let prDetails = "";
        if (task.type === "PR Update" && (task.spokesperson || task.publication)) {
            prDetails = `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                ${task.spokesperson ? 'Spokesperson: ' + task.spokesperson : ''} 
                ${task.publication ? ' | Pub: ' + task.publication : ''}
            </div>`;
        }

        // Inline Image for Tracker Table
        let trackerImageHtml = "";
        if (task.image) {
            trackerImageHtml = `
                <div class="tracker-item-thumbnail btn-view-image" data-id="${task.id}">
                    <img src="${task.image}" alt="thumbnail">
                </div>
            `;
        }

        const titleAndImageHtml = trackerImageHtml 
            ? `<div class="tracker-item-flex">
                 ${trackerImageHtml}
                 <div class="tracker-item-details">
                     <div style="font-weight:600;">${task.title}</div>
                     ${prDetails}
                 </div>
               </div>`
            : `<div class="tracker-item-details">
                 <div style="font-weight:600;">${task.title}</div>
                 ${prDetails}
               </div>`;

        tr.innerHTML = `
            <td>${typeBadge}</td>
            <td>${titleAndImageHtml}</td>
            <td>${statusPill}</td>
            <td>
                <div>${task.month}</div>
                <div style="font-size:11px; color:var(--text-muted);">${task.date || task.week || ''}</div>
            </td>
            <td style="font-weight: 500;">${task.owner}</td>
            <td>${linksHtml}</td>
            <td>
                <div class="actions-flex">
                    <button class="action-btn-mini edit-btn" data-id="${task.id}" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                    <button class="action-btn-mini duplicate-btn" data-id="${task.id}" title="Duplicate"><i class="fa-solid fa-copy"></i></button>
                    <button class="action-btn-mini delete-btn" data-id="${task.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
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
                // Open visual in new window/tab
                const newWin = window.open();
                newWin.document.write(`<img src="${task.image}" style="max-width:100%; height:auto;" alt="Media Clipping">`);
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
        if (!statuses.includes(colStatus)) {
            colStatus = "WIP";
        }

        counts[colStatus]++;
        
        const card = document.createElement("div");
        card.className = "kanban-card";
        card.setAttribute("draggable", "true");
        card.setAttribute("data-id", task.id);
        
        // Drag events
        card.addEventListener("dragstart", (e) => {
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
        let tagColor = "var(--accent-blue)";
        if (task.type === "PR Update") tagColor = "var(--accent-purple)";
        if (task.type === "Creative / Collateral") tagColor = "var(--accent-amber)";

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
                    <img src="${task.image}" style="width: 100%; height: 100%; object-fit: cover;" alt="cover">
                </div>
            `;
        }

        card.innerHTML = `
            ${kanbanCoverHtml}
            <span class="card-tag" style="color:${tagColor};">${task.subType || task.type}</span>
            <div class="card-title" style="font-weight: 600;">${task.title}</div>
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
            if (task && task.status !== status) {
                task.status = status;
                saveData();
                renderTracker(); // Refresh kanban cards
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
                const newWin = window.open();
                newWin.document.write(`<img src="${task.image}" style="max-width:100%; height:auto;" alt="Media Clipping">`);
            }
        });
    });
}

// ====================================================
// REPORT BUILDER VIEW ENGINE
// ====================================================

function generateReport() {
    const periodType = document.getElementById("report-period-type").value;
    const selectedMonth = document.getElementById("report-month").value;
    const selectedWeek = document.getElementById("report-week").value;
    
    // Filter database for items in selected month
    let reportItems = state.tasks.filter(t => t.month === selectedMonth);

    // If monthly report is chosen, only keep items that are "Published/Closed" (uploaded/used/closed)
    if (periodType === "monthly") {
        reportItems = reportItems.filter(t => t.status === "Published/Closed");
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

    // Sort report items by date/subtype
    reportItems.sort((a,b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        return dateA.localeCompare(dateB, undefined, {numeric: true});
    });

    // Populate Report Meta text
    const periodText = periodType === "weekly" 
        ? `${selectedWeek} of ${selectedMonth}` 
        : `${selectedMonth} Report`;
    document.getElementById("report-meta-period").textContent = periodText;

    // Filter by type
    // If monthly, reportItems is already filtered by status === "Published"
    // If weekly, reportItems has all statuses, which is what we want!
    const smItems = reportItems.filter(t => t.type === "Social Media");
    const prItems = reportItems.filter(t => t.type === "PR Update");
    const creativeItems = reportItems.filter(t => t.type === "Creative / Collateral");

    // Update stats counters on report
    document.getElementById("rep-stat-total").textContent = reportItems.length;
    document.getElementById("rep-stat-sm").textContent = smItems.length;
    document.getElementById("rep-stat-pr").textContent = prItems.length;
    document.getElementById("rep-stat-collateral").textContent = creativeItems.length;    // RENDER SOCIAL MEDIA TABLE
    const smBody = document.getElementById("report-social-table-body");
    smBody.innerHTML = "";
    
    // Set dynamic headers based on periodType
    const smTable = document.querySelector("#report-sec-social table");
    if (smTable) {
        const smThead = smTable.querySelector("thead");
        if (smThead) {
            if (periodType === "weekly") {
                smThead.innerHTML = `
                    <tr>
                        <th style="width: 50px;">Sl.</th>
                        <th style="width: 90px;">Platform</th>
                        <th>Activity Details</th>
                        <th style="width: 140px;">Status / Date</th>
                        <th>Live Verification Link</th>
                    </tr>
                `;
            } else {
                smThead.innerHTML = `
                    <tr>
                        <th style="width: 50px;">Sl.</th>
                        <th style="width: 90px;">Platform</th>
                        <th>Activity Details</th>
                        <th style="width: 140px;">Status / Date</th>
                        <th style="width: 130px;">Metrics</th>
                        <th>Live Verification Link</th>
                    </tr>
                `;
            }
        }
    }
    
    if (smItems.length === 0) {
        document.getElementById("report-sec-social").classList.add("no-print");
        const colspanVal = periodType === "weekly" ? 5 : 6;
        smBody.innerHTML = `<tr><td colspan="${colspanVal}" style="text-align:center; padding:15px; color:#6b7280;">No social media activities recorded in this timeframe.</td></tr>`;
    } else {
        document.getElementById("report-sec-social").classList.remove("no-print");
        smItems.forEach((task, idx) => {
            const tr = document.createElement("tr");
            
            let verificationLink = task.status || "Published";
            if (task.liveLink && task.liveLink.startsWith("http")) {
                verificationLink = `<a href="${task.liveLink}" target="_blank">${task.liveLink}</a>`;
            } else if (task.liveLink) {
                verificationLink = task.liveLink;
            }
            
            // Format status badge or date
            let timelineDisplay = task.date || task.week || 'Published';
            if (task.status !== "Published/Closed") {
                let statusClass = "status-wip";
                if (task.status === "Sent for internal approval") statusClass = "status-review";
                if (task.status === "Sent to client") statusClass = "status-approval";
                if (task.status === "Not used by client") statusClass = "status-missed";
                
                timelineDisplay = `<span class="status-pill ${statusClass}" style="font-size:10px; padding:3px 8px;">${task.status}</span>`;
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

            const activityDetailsHtml = reportThumbnailHtml
                ? `<div class="report-item-flex">
                     ${reportThumbnailHtml}
                     <div class="report-item-details">
                         <strong>${task.title}</strong>
                         ${task.remarks ? '<br><span style="font-size:11px;color:#4b5563;">' + task.remarks + '</span>' : ''}
                     </div>
                   </div>`
                : `<div class="report-item-details">
                     <strong>${task.title}</strong>
                     ${task.remarks ? '<br><span style="font-size:11px;color:#4b5563;">' + task.remarks + '</span>' : ''}
                     ${noPrintButtons}
                   </div>`;

            // Metrics Display
            let metricsDisplay = "-";
            if (task.impressions || task.engagement) {
                metricsDisplay = `
                    <div style="font-size: 11px; line-height: 1.4;">
                        ${task.impressions ? `<strong>Imps:</strong> ${Number(task.impressions).toLocaleString()}` : ''}
                        ${task.impressions && task.engagement ? '<br>' : ''}
                        ${task.engagement ? `<strong>Eng:</strong> ${Number(task.engagement).toLocaleString()}` : ''}
                    </div>
                `;
            }

            if (periodType === "weekly") {
                tr.innerHTML = `
                    <td style="text-align:center;">${idx + 1}</td>
                    <td class="platform-name"><i class="fa-solid fa-share-nodes" style="color:#3b82f6;"></i> All Platforms</td>
                    <td>${activityDetailsHtml}</td>
                    <td>${timelineDisplay}</td>
                    <td>${verificationLink}</td>
                `;
            } else {
                tr.innerHTML = `
                    <td style="text-align:center;">${idx + 1}</td>
                    <td class="platform-name"><i class="fa-solid fa-share-nodes" style="color:#3b82f6;"></i> All Platforms</td>
                    <td>${activityDetailsHtml}</td>
                    <td>${timelineDisplay}</td>
                    <td>${metricsDisplay}</td>
                    <td>${verificationLink}</td>
                `;
            }
            smBody.appendChild(tr);
        });
    }

    // RENDER PR UPDATE TABLE
    const prBody = document.getElementById("report-pr-table-body");
    prBody.innerHTML = "";

    if (prItems.length === 0) {
        document.getElementById("report-sec-pr").classList.add("no-print");
        prBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#6b7280;">No PR media coverage items recorded.</td></tr>`;
    } else {
        document.getElementById("report-sec-pr").classList.remove("no-print");
        prItems.forEach((task, idx) => {
            const tr = document.createElement("tr");

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
                         <strong>${task.title}</strong>
                     </div>
                   </div>`
                : `<div class="report-item-details">
                     <strong>${task.title}</strong>
                     ${noPrintButtons}
                   </div>`;

            tr.innerHTML = `
                <td style="text-align:center;">${idx + 1}</td>
                <td style="font-weight:600;">${task.subType || 'Press Release'}</td>
                <td>${titleAndImageHtml}</td>
                <td>${task.publication || 'Mainlines & Financials'}</td>
                <td>${task.spokesperson || 'CMD'}</td>
                <td>${task.status || 'Release shared'}</td>
            `;
            prBody.appendChild(tr);
        });
    }

    // RENDER CREATIVE COLLATERALS TABLE
    const creativeBody = document.getElementById("report-creative-table-body");
    if (creativeBody) {
        creativeBody.innerHTML = "";

        if (creativeItems.length === 0) {
            document.getElementById("report-sec-creative").classList.add("no-print");
            creativeBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:#6b7280;">No creative collaterals recorded.</td></tr>`;
        } else {
            document.getElementById("report-sec-creative").classList.remove("no-print");
            creativeItems.forEach((task, idx) => {
                const tr = document.createElement("tr");
                
                // Format status badge or remarks
                let statusDisplay = task.status || "Completed";
                let statusClass = "status-published";
                if (task.status === "WIP") statusClass = "status-wip";
                if (task.status === "Sent for internal approval") statusClass = "status-review";
                if (task.status === "Sent to client") statusClass = "status-approval";
                if (task.status === "Not used by client") statusClass = "status-missed";
                
                let statusBadge = `<span class="status-pill ${statusClass}" style="font-size:10px; padding:3px 8px; display: inline-block;">${task.status}</span>`;
                if (task.remarks) {
                    statusBadge += `<div style="font-size: 11px; color:#4b5563; margin-top: 4px;">${task.remarks}</div>`;
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
                             <strong>${task.title}</strong>
                         </div>
                       </div>`
                    : `<div class="report-item-details">
                         <strong>${task.title}</strong>
                         ${noPrintButtons}
                       </div>`;

                tr.innerHTML = `
                    <td style="text-align:center;">${idx + 1}</td>
                    <td style="font-weight:600;">${task.subType || 'Design'}</td>
                    <td>${titleAndImageHtml}</td>
                    <td>${statusBadge}</td>
                `;
                creativeBody.appendChild(tr);
            });
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
                        saveData();
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
        saveData();
        populateOwnerFilter();
        updateDashboard();
        switchTab("dashboard");
        alert("Database restored to baseline successfully.");
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
    const repTotal = document.getElementById("rep-stat-total").textContent;
    const repSm = document.getElementById("rep-stat-sm").textContent;
    const repPr = document.getElementById("rep-stat-pr").textContent;
    const repCollateral = document.getElementById("rep-stat-collateral").textContent;

    // Get a list of task titles in the report
    const smTableRows = Array.from(document.querySelectorAll("#report-social-table-body tr"));
    const prTableRows = Array.from(document.querySelectorAll("#report-pr-table-body tr"));
    const clippingsCards = Array.from(document.querySelectorAll("#report-clippings-grid h5"));

    const smTitles = smTableRows.map(r => r.querySelector("strong")?.textContent).filter(Boolean);
    const prTitles = prTableRows.map(r => r.querySelector("strong")?.textContent).filter(Boolean);
    const clippingsTitles = clippingsCards.map(c => c.textContent).filter(Boolean);

    if (parseInt(repTotal) === 0) {
        alert("There are no activities listed in this report period to summarize.");
        return;
    }

    statusEl.style.display = "inline";
    statusEl.style.color = "var(--text-secondary)";
    statusEl.textContent = "⚡ Gemini is writing narrative executive summary...";
    
    try {
        const prompt = `
You are a senior PR director partner at Candour Communications.
Draft a professional, executive summary narrative paragraph (3-4 sentences, max 100 words) for our client Rail Vikas Nigam Limited (RVNL) summarizing the work done in the report period "${periodText}".
The summary should highlight the overall output, key social milestones, press/PR coverages, and collaterals delivered, with a positive, business-driven corporate tone.

Report metrics:
- Total Activities: ${repTotal}
- Social Media Posts: ${repSm} (Titles: ${smTitles.slice(0, 10).join(", ")})
- PR Coverage Items: ${repPr} (Titles: ${prTitles.slice(0, 10).join(", ")})
- Creative Collaterals: ${repCollateral} (Titles: ${clippingsTitles.slice(0, 10).join(", ")})

Write ONLY the final paragraph. Do not write any greetings or explanations.
`;
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
    // 1. gemini-2.5-flash on v1beta (latest in 2026)
    // 2. gemini-2.0-flash on v1beta
    // 3. gemini-1.5-flash on v1 (stable)
    // 4. gemini-1.5-flash on v1beta
    
    const configs = [
        { version: "v1beta", model: "gemini-2.5-flash" },
        { version: "v1beta", model: "gemini-2.0-flash" },
        { version: "v1", model: "gemini-1.5-flash" },
        { version: "v1beta", model: "gemini-1.5-flash" }
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

// Scan and compress any large historical thumbnails to reclaim localStorage space
function compressExistingLargeImages() {
    let updated = false;
    const compressPromises = [];

    state.tasks.forEach(task => {
        // Find thumbnails larger than 50KB that are data-URLs
        if (task.image && task.image.startsWith("data:image/") && task.image.length > 50000) {
            const promise = new Promise((resolve) => {
                const img = new Image();
                img.onload = function() {
                    let width = img.width;
                    let height = img.height;
                    const maxWidth = 400;
                    const maxHeight = 400;
                    
                    let needsResize = width > maxWidth || height > maxHeight;
                    // If not JPEG or needs resize, compress it
                    if (needsResize || !task.image.startsWith("data:image/jpeg")) {
                        if (needsResize) {
                            if (width > height) {
                                height = Math.round((height * maxWidth) / width);
                                width = maxWidth;
                            } else {
                                width = Math.round((width * maxHeight) / height);
                                height = maxHeight;
                            }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        task.image = canvas.toDataURL('image/jpeg', 0.7);
                        updated = true;
                    }
                    resolve();
                };
                img.onerror = function() {
                    resolve();
                };
                img.src = task.image;
            });
            compressPromises.push(promise);
        }
    });

    if (compressPromises.length > 0) {
        console.log(`Optimizing ${compressPromises.length} historical thumbnails in background...`);
        Promise.all(compressPromises).then(() => {
            if (updated) {
                console.log("Historical thumbnail optimization complete. Saving database.");
                saveData();
                updateDashboard();
                renderTracker();
            }
        });
    }
}


