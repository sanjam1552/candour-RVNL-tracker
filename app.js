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
    
    // Daily Briefing event listeners
    const btnRunBriefing = document.getElementById("btn-run-briefing");
    if (btnRunBriefing) {
        btnRunBriefing.addEventListener("click", handleRunBriefing);
    }
    const briefingStartDateInput = document.getElementById("briefing-start-date");
    const briefingEndDateInput = document.getElementById("briefing-end-date");
    if (briefingStartDateInput) {
        briefingStartDateInput.addEventListener("change", updateBriefingTimeRangeLabel);
    }
    if (briefingEndDateInput) {
        briefingEndDateInput.addEventListener("change", updateBriefingTimeRangeLabel);
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
    } else if (tabName === 'briefing') {
        initBriefingTab();
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
function openDrawer(taskId = null, prefillData = null) {
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
    } else if (prefillData) {
        title.textContent = "Add Strategy Item to Tracker";
        document.getElementById("task-type").value = prefillData.type;
        togglePRFormFields(prefillData.type);
        
        if (prefillData.subType) document.getElementById("task-sub-type").value = prefillData.subType;
        if (prefillData.title) document.getElementById("task-title").value = prefillData.title;
        if (prefillData.remarks) document.getElementById("task-remarks").value = prefillData.remarks;
        if (prefillData.status) document.getElementById("task-status").value = prefillData.status;
        if (prefillData.owner) document.getElementById("task-owner").value = prefillData.owner;
        if (prefillData.month) document.getElementById("task-month").value = prefillData.month;
        if (prefillData.week) document.getElementById("task-week").value = prefillData.week;
        if (prefillData.date) document.getElementById("task-date").value = prefillData.date;
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
    
    if (startDateInput && !startDateInput.value) {
        startDateInput.value = "2026-06-01";
    }
    if (endDateInput && !endDateInput.value) {
        endDateInput.value = "2026-06-10";
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
    if (cachedBriefing) {
        currentBriefingData = cachedBriefing;
        renderBriefingResults(cachedBriefing);
        if (statusContainer) {
            document.getElementById("briefing-status-text").textContent = "✓ Saved briefing loaded from database.";
            document.getElementById("briefing-status-text").style.color = "var(--accent-green)";
            document.getElementById("briefing-spinner").style.display = "none";
        }
    } else {
        currentBriefingData = null;
        if (statusContainer) {
            document.getElementById("briefing-status-text").textContent = "No briefing exists for this range. Click 'Run AI Briefing' to generate.";
            document.getElementById("briefing-status-text").style.color = "var(--text-muted)";
            document.getElementById("briefing-spinner").style.display = "none";
        }
    }
}

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

    const statusContainer = document.getElementById("briefing-status-container");
    const statusText = document.getElementById("briefing-status-text");
    const spinner = document.getElementById("briefing-spinner");
    const queryLog = document.getElementById("briefing-status-queries");
    const resultsContainer = document.getElementById("briefing-results");

    if (statusContainer) statusContainer.style.display = "block";
    if (statusText) {
        statusText.textContent = "Compiling range strategy plan...";
        statusText.style.color = "var(--text-secondary)";
    }
    if (spinner) spinner.style.display = "inline-block";
    if (queryLog) queryLog.innerHTML = "";
    if (resultsContainer) resultsContainer.classList.add("hidden");

    // Clear previous results view
    document.getElementById("briefing-exec-summary").textContent = "";
    document.getElementById("briefing-detailed-report").innerHTML = "";
    document.getElementById("briefing-sources").innerHTML = "";
    document.getElementById("briefing-strategy-list").innerHTML = "";

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

    if (queryLog) {
        queryLog.innerHTML = `<div>🔍 Found ${gatheredItems.length} curated milestones in reporting database.</div>`;
    }

    // 2. Query Google News RSS for this range to see if there is any live content
    try {
        const pad = (n) => String(n).padStart(2, '0');
        const afterStr = `${startLimit.getFullYear()}-${pad(startLimit.getMonth()+1)}-${pad(startLimit.getDate())}`;
        const beforeStr = `${endLimit.getFullYear()}-${pad(endLimit.getMonth()+1)}-${pad(endLimit.getDate())}`;
        
        const query = `RVNL OR "Rail Vikas Nigam" after:${afterStr} before:${beforeStr}`;
        const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
        
        if (queryLog) queryLog.innerHTML += `<div style="margin-top:5px;">🔍 Querying Google News RSS for live updates...</div>`;
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok' && Array.isArray(data.items)) {
                let liveCount = 0;
                data.items.forEach(item => {
                    // Extract Date
                    let pubDateStr = item.pubDate;
                    let parsedDate = new Date(pubDateStr);
                    if (isNaN(parsedDate.getTime())) parsedDate = new Date();
                    
                    const itemDateStr = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth()+1)}-${pad(parsedDate.getDate())}`;
                    
                    // Simple check if this looks like a milestone
                    const tLower = item.title.toLowerCase();
                    const isRelevant = tLower.includes("rvnl") || tLower.includes("rail vikas") || tLower.includes("railway");
                    
                    if (isRelevant) {
                        // De-duplicate against curated
                        const exists = gatheredItems.some(c => c.title.toLowerCase().substring(0, 30) === item.title.toLowerCase().substring(0, 30));
                        if (!exists) {
                            // Extract metrics or build fallback
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
                if (queryLog && liveCount > 0) {
                    queryLog.innerHTML += `<div style="margin-top:5px; color:var(--accent-green);">✓ Merged ${liveCount} live news items from Google News.</div>`;
                }
            }
        }
    } catch (err) {
        console.warn("RSS date range fetch failed:", err);
    }

    // 3. Sort chronologically (date wise)
    gatheredItems.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (gatheredItems.length === 0) {
        if (statusText) {
            statusText.textContent = "⚠ No news or milestones found for this range.";
            statusText.style.color = "var(--accent-amber)";
        }
        if (spinner) spinner.style.display = "none";
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
            
            // 1. Static Card
            const staticTitle = `Celebrate ${projectValue} Win`;
            const staticConcept = `A premium corporate creative celebrating the milestone: "${item.title}".
Layout: High-contrast split layout. Left side shows rail infrastructure. Right side holds typography: "${projectValue} project milestone in ${divisionName}".
Accents: Neon blue gradients.
Branding: Integrate the RVNL logo with Candour PR tagging.`;
            const staticCaption = `Delivering rail modernization! 🚄

We are pleased to highlight the milestone: ${item.title}.

This represents our ongoing commitment to building state-of-the-art rail infrastructure for the nation.

#RVNL #IndianRailways #Infrastructure #${subTypeTag.replace(/\s+/g, '')} #Engineering #Growth`;

            // 2. Reel Card
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

            // 3. PR Card
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
            detailedReport += `#### ${idx + 1}. [${dateStr}] ${b.title}\n`;
            detailedReport += `- **Division/Zone**: **${b.division}** (${b.zone})\n`;
            detailedReport += `- **Milestone Type**: ${b.type} (${b.value})\n`;
            detailedReport += `- **Operational Focus**: ${b.desc.charAt(0).toUpperCase() + b.desc.slice(1)}.\n\n`;
        });

        const briefingData = {
            rangeId: `${startVal}_${endVal}`,
            execSummary,
            detailedReport,
            sources: dayBriefings.map(d => ({ title: d.title, url: d.url })),
            days: dayBriefings
        };

        // Cache globally and save in database
        currentBriefingData = briefingData;
        await saveBriefingToFirestore(briefingData.rangeId, briefingData);

        // Render to UI
        renderBriefingResults(briefingData);

        if (statusText) {
            statusText.textContent = "✓ Briefing generated and saved successfully!";
            statusText.style.color = "var(--accent-green)";
        }
        if (spinner) spinner.style.display = "none";
    } catch (err) {
        console.error("Briefing execution error: ", err);
        if (statusText) {
            statusText.textContent = "✗ Error running briefing: " + err.message;
            statusText.style.color = "var(--accent-red)";
        }
        if (spinner) spinner.style.display = "none";
    }
}

// Render the briefing results object to the UI elements
function renderBriefingResults(data) {
    document.getElementById("briefing-exec-summary").textContent = data.execSummary.trim();
    document.getElementById("briefing-detailed-report").innerHTML = convertMarkdownToHtml(data.detailedReport);

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

    // Dynamic Strategy Cards Render
    const stratContainer = document.getElementById("briefing-strategy-list");
    stratContainer.innerHTML = "";

    if (data.days && data.days.length > 0) {
        data.days.forEach((day, dIdx) => {
            const dayDateStr = new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            
            // Create day wrapper
            const daySection = document.createElement("div");
            daySection.className = "day-strategy-section";
            daySection.style.display = "flex";
            daySection.style.flexDirection = "column";
            daySection.style.gap = "14px";
            daySection.style.borderBottom = "1px solid var(--border-color)";
            daySection.style.paddingBottom = "20px";
            daySection.style.marginBottom = "10px";

            daySection.innerHTML = `
                <h4 style="font-size: 14px; font-weight: 700; color: var(--accent-purple); display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-calendar-day"></i> ${dayDateStr} &mdash; ${day.value} Project
                </h4>
                <p style="font-size: 12.5px; color: var(--text-muted); margin-top: -6px; line-height: 1.4;">${day.title}</p>
                
                <!-- Static Creative Card -->
                <div class="strategy-card border-left-blue" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-blue); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <div class="strategy-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="strat-card-badge badge-blue" style="background-color: rgba(59, 130, 246, 0.1); color: var(--accent-blue); padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase;">Static Creative</span>
                        <button class="btn btn-secondary btn-sm" onclick="addDynamicBriefingStrategyToTracker(${dIdx}, 'static')" style="padding: 3px 6px; font-size: 10px;">
                            <i class="fa-solid fa-plus"></i> Add to Tracker
                        </button>
                    </div>
                    <h5 style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin: 0;">${day.static.title}</h5>
                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${day.static.concept}</p>
                    <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 11.5px; color: var(--text-primary); white-space: pre-wrap; font-style: italic;">${day.static.caption}</div>
                </div>

                <!-- Reel Concept Card -->
                <div class="strategy-card border-left-amber" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-amber); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <div class="strategy-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="strat-card-badge badge-amber" style="background-color: rgba(245, 158, 11, 0.1); color: var(--accent-amber); padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase;">Reel / Video</span>
                        <button class="btn btn-secondary btn-sm" onclick="addDynamicBriefingStrategyToTracker(${dIdx}, 'reel')" style="padding: 3px 6px; font-size: 10px;">
                            <i class="fa-solid fa-plus"></i> Add to Tracker
                        </button>
                    </div>
                    <h5 style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin: 0;">${day.reel.title}</h5>
                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${day.reel.concept}</p>
                    <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 11.5px; color: var(--text-primary); white-space: pre-wrap; font-style: italic;">${day.reel.caption}</div>
                </div>

                <!-- PR Card -->
                <div class="strategy-card border-left-purple" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-purple); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                    <div class="strategy-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="strat-card-badge badge-purple" style="background-color: rgba(139, 92, 246, 0.1); color: var(--accent-purple); padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase;">PR Update</span>
                        <button class="btn btn-secondary btn-sm" onclick="addDynamicBriefingStrategyToTracker(${dIdx}, 'pr')" style="padding: 3px 6px; font-size: 10px;">
                            <i class="fa-solid fa-plus"></i> Add to Tracker
                        </button>
                    </div>
                    <h5 style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin: 0;">${day.pr.title}</h5>
                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${day.pr.concept}</p>
                    <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; font-size: 11.5px; color: var(--text-primary); white-space: pre-wrap; font-style: italic;">${day.pr.caption}</div>
                </div>
            `;
            stratContainer.appendChild(daySection);
        });
    } else {
        stratContainer.innerHTML = `<p class="text-muted" style="font-size: 13.5px; text-align: center; margin-top: 20px;">No strategy recommended yet.</p>`;
    }

    // Show Results
    document.getElementById("briefing-results").classList.remove("hidden");
}

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


