const selectBtn = document.getElementById('select-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const resultsScreen = document.getElementById('results-screen');
const resultsList = document.getElementById('results-list');
const loader = document.getElementById('loader');
const currentPathSpan = document.getElementById('current-path');
const contextMenu = document.getElementById('context-menu');
const menuOpen = document.getElementById('menu-open');
const menuPreview = document.getElementById('menu-preview');
const menuReveal = document.getElementById('menu-reveal');
const openText = document.getElementById('open-text');
const menuDelete = document.getElementById('menu-delete');
const modalOverlay = document.getElementById('modal-overlay');
const deleteItemName = document.getElementById('delete-item-name');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const backBtn = document.getElementById('back-btn');
const searchInput = document.getElementById('search-input');
const typeFilter = document.getElementById('type-filter');
const minSizeInput = document.getElementById('min-size-input');
const sizeUnit = document.getElementById('size-unit');
const findDuplicatesBtn = document.getElementById('find-duplicates-btn');
const sortName = document.getElementById('sort-name');
const sortSize = document.getElementById('sort-size');
const sortDate = document.getElementById('sort-date');
const totalSizeSpan = document.getElementById('total-size');
const fileCountSpan = document.getElementById('file-count');
const folderCountSpan = document.getElementById('folder-count');
const previewOverlay = document.getElementById('preview-overlay');
const previewContent = document.getElementById('preview-content');
const previewTitle = document.getElementById('preview-title');
const closePreview = document.getElementById('close-preview');
const duplicatesOverlay = document.getElementById('duplicates-overlay');
const duplicatesList = document.getElementById('duplicates-list');
const closeDuplicates = document.getElementById('close-duplicates');

let currentData = [];
let filteredData = [];
let itemToInteract = null;
let currentFolderPath = '';
let navigationHistory = [];
let sortColumn = 'size';
let sortDirection = 'desc';
let duplicateMarkers = new Set();

// Event Listeners
searchInput.addEventListener('input', () => applyFilters());
typeFilter.addEventListener('change', () => applyFilters());
minSizeInput.addEventListener('input', () => applyFilters());
sizeUnit.addEventListener('change', () => applyFilters());

sortName.addEventListener('click', () => setSort('name'));
sortSize.addEventListener('click', () => setSort('size'));
sortDate.addEventListener('click', () => setSort('date'));

findDuplicatesBtn.addEventListener('click', async () => {
    await findDuplicates();
});

closePreview.addEventListener('click', () => {
    previewOverlay.classList.add('hidden');
});

closeDuplicates.addEventListener('click', () => {
    duplicatesOverlay.classList.add('hidden');
});

selectBtn.addEventListener('click', async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
        navigationHistory = [];
        currentFolderPath = path;
        searchInput.value = '';
        minSizeInput.value = '';
        typeFilter.value = 'all';
        duplicateMarkers.clear();
        startScan(path);
    }
});

backBtn.addEventListener('click', () => {
    if (navigationHistory.length > 0) {
        currentFolderPath = navigationHistory.pop();
        searchInput.value = '';
        minSizeInput.value = '';
        typeFilter.value = 'all';
        duplicateMarkers.clear();
        startScan(currentFolderPath, false);
    }
});

async function startScan(path, addToHistory = true) {
    showLoader();
    currentPathSpan.textContent = path;

    if (navigationHistory.length > 0 || (addToHistory && currentFolderPath !== path)) {
        backBtn.classList.remove('hidden');
    } else {
        backBtn.classList.add('hidden');
    }

    try {
        const results = await window.electronAPI.scanDirectory(path);
        currentData = results;
        updateStatistics(results);
        applyFilters();
        showResults();
    } catch (error) {
        console.error('Scan failed:', error);
        alert('Failed to scan directory');
    } finally {
        hideLoader();
    }
}

function updateStatistics(items) {
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;

    items.forEach(item => {
        totalSize += item.size;
        if (item.isDirectory) {
            folderCount++;
        } else {
            fileCount++;
        }
    });

    totalSizeSpan.textContent = formatSize(totalSize);
    fileCountSpan.textContent = fileCount;
    folderCountSpan.textContent = folderCount;
}

function applyFilters() {
    let filtered = [...currentData];

    // Search filter (advanced)
    const searchQuery = searchInput.value.trim();
    if (searchQuery) {
        filtered = filtered.filter(item => {
            const name = item.name.toLowerCase();
            const ext = item.extension.toLowerCase();
            const pathLower = item.path.toLowerCase();
            
            // Check if it's a regex pattern
            try {
                const regex = new RegExp(searchQuery, 'i');
                return regex.test(name) || regex.test(ext) || regex.test(pathLower);
            } catch (e) {
                // Not a valid regex, use simple search
                return name.includes(searchQuery.toLowerCase()) || 
                       ext.includes(searchQuery.toLowerCase()) ||
                       pathLower.includes(searchQuery.toLowerCase());
            }
        });
    }

    // Type filter
    const selectedType = typeFilter.value;
    if (selectedType !== 'all') {
        if (selectedType === 'folders') {
            filtered = filtered.filter(item => item.isDirectory);
        } else {
            filtered = filtered.filter(item => !item.isDirectory && item.fileType === selectedType);
        }
    }

    // Size filter
    const minSizeValue = parseFloat(minSizeInput.value);
    if (!isNaN(minSizeValue) && minSizeValue > 0) {
        const unit = sizeUnit.value;
        const multiplier = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        }[unit] || 1;
        const minBytes = minSizeValue * multiplier;
        filtered = filtered.filter(item => item.size >= minBytes);
    }

    // Apply sorting
    filtered = sortData(filtered);

    filteredData = filtered;
    renderResults(filtered);
    updateStatistics(filtered);
}

function setSort(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'desc';
    }
    updateSortHeaders();
    applyFilters();
}

function updateSortHeaders() {
    [sortName, sortSize, sortDate].forEach(header => {
        header.textContent = header.textContent.replace(/ [↕↑↓]/, '') + ' ↕';
    });

    const arrow = sortDirection === 'asc' ? ' ↑' : ' ↓';
    if (sortColumn === 'name') sortName.textContent = sortName.textContent.replace(' ↕', arrow);
    if (sortColumn === 'size') sortSize.textContent = sortSize.textContent.replace(' ↕', arrow);
    if (sortColumn === 'date') sortDate.textContent = sortDate.textContent.replace(' ↕', arrow);
}

function sortData(data) {
    const sorted = [...data];
    sorted.sort((a, b) => {
        let comparison = 0;
        
        switch (sortColumn) {
            case 'name':
                comparison = a.name.localeCompare(b.name);
                break;
            case 'size':
                comparison = a.size - b.size;
                break;
            case 'date':
                comparison = new Date(a.modifiedDate) - new Date(b.modifiedDate);
                break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
}

async function findDuplicates() {
    showLoader();
    const files = currentData.filter(item => !item.isDirectory);
    
    if (files.length === 0) {
        hideLoader();
        alert('No files to check for duplicates');
        return;
    }

    const hashMap = new Map();
    const duplicates = [];

    for (const file of files) {
        try {
            const hash = await window.electronAPI.calculateFileHash(file.path);
            if (hash) {
                if (hashMap.has(hash)) {
                    const existing = hashMap.get(hash);
                    if (!duplicates.find(d => d.hash === hash)) {
                        duplicates.push({
                            hash: hash,
                            files: [existing, file]
                        });
                    } else {
                        const dupGroup = duplicates.find(d => d.hash === hash);
                        dupGroup.files.push(file);
                    }
                } else {
                    hashMap.set(hash, file);
                }
            }
        } catch (err) {
            console.error(`Error processing ${file.path}:`, err);
        }
    }

    hideLoader();
    duplicateMarkers.clear();
    
    if (duplicates.length === 0) {
        alert('No duplicate files found!');
        return;
    }

    duplicates.forEach(dup => {
        dup.files.forEach(file => {
            duplicateMarkers.add(file.path);
        });
    });

    displayDuplicates(duplicates);
    applyFilters(); // Re-render to show markers
}

function displayDuplicates(duplicates) {
    duplicatesList.innerHTML = '';
    
    duplicates.forEach((dup, index) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'duplicate-group';
        
        const header = document.createElement('div');
        header.className = 'duplicate-group-header';
        header.textContent = `Duplicate Group ${index + 1} (${dup.files.length} files, ${formatSize(dup.files[0].size)} each)`;
        groupDiv.appendChild(header);

        dup.files.forEach(file => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'duplicate-item';
            itemDiv.innerHTML = `
                <div class="duplicate-item-path">${file.path}</div>
                <div class="duplicate-item-size">${formatSize(file.size)}</div>
            `;
            groupDiv.appendChild(itemDiv);
        });

        duplicatesList.appendChild(groupDiv);
    });

    duplicatesOverlay.classList.remove('hidden');
}

function renderResults(items) {
    resultsList.innerHTML = '';

    if (items.length === 0) {
        resultsList.innerHTML = '<div class="hero"><p>No items found or access denied.</p></div>';
        return;
    }

    const maxSize = items[0].size > 0 ? items[0].size : 1;

    items.forEach((item, index) => {
        const percentage = (item.size / maxSize) * 100;
        const div = document.createElement('div');
        div.className = 'result-item';
        if (duplicateMarkers.has(item.path)) {
            div.classList.add('duplicate');
        }
        div.style.animationDelay = `${index * 0.05}s`;

        const dateStr = item.modifiedDate ? formatDate(item.modifiedDate) : 'N/A';

        div.innerHTML = `
            <div class="item-icon">
                ${item.isDirectory ?
                '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/></svg>' :
                '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z"/></svg>'
            }
            </div>
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-path">${truncatePath(item.path)}</div>
            </div>
            <div class="item-size">${formatSize(item.size)}</div>
            <div class="item-date">${dateStr}</div>
            <div class="size-bar-container">
                <div class="size-bar" style="width: ${percentage}%"></div>
            </div>
        `;

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            itemToInteract = item;
            showContextMenu(e.pageX, e.pageY);
        });

        div.addEventListener('dblclick', async () => {
            if (item.isDirectory) {
                navigationHistory.push(currentFolderPath);
                currentFolderPath = item.path;
                searchInput.value = '';
                minSizeInput.value = '';
                typeFilter.value = 'all';
                duplicateMarkers.clear();
                startScan(currentFolderPath);
            } else {
                // Preview file
                await previewFile(item);
            }
        });

        resultsList.appendChild(div);
    });
}

async function previewFile(item) {
    if (!item.fileType) return;

    previewOverlay.classList.remove('hidden');
    previewTitle.textContent = item.name;
    previewContent.innerHTML = '<div class="loader"><div class="spinner"></div><p>Loading preview...</p></div>';

    try {
        if (item.fileType === 'images') {
            const result = await window.electronAPI.readImageFile(item.path);
            if (result.success) {
                previewContent.innerHTML = `<img src="data:image/${item.extension.slice(1)};base64,${result.data}" alt="${item.name}">`;
            } else {
                previewContent.innerHTML = `<p>Could not load image: ${result.error}</p>`;
            }
        } else if (item.fileType === 'documents' && ['.txt', '.md', '.json', '.js', '.css', '.html', '.xml'].includes(item.extension)) {
            const result = await window.electronAPI.readFileContent(item.path);
            if (result.success) {
                previewContent.innerHTML = `<pre>${escapeHtml(result.content)}</pre>`;
            } else {
                previewContent.innerHTML = `<p>Could not load file: ${result.error}</p>`;
            }
        } else {
            previewContent.innerHTML = `<p>Preview not available for this file type. Double-click to open with default application.</p>`;
        }
    } catch (err) {
        previewContent.innerHTML = `<p>Error loading preview: ${err.message}</p>`;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Context Menu Logic
function showContextMenu(x, y) {
    if (itemToInteract) {
        openText.textContent = itemToInteract.isDirectory ? 'Open Folder' : 'Open File';
        // Show preview option only for files that can be previewed
        if (!itemToInteract.isDirectory && (itemToInteract.fileType === 'images' || 
            (itemToInteract.fileType === 'documents' && ['.txt', '.md', '.json', '.js', '.css', '.html', '.xml'].includes(itemToInteract.extension)))) {
            menuPreview.style.display = 'flex';
        } else {
            menuPreview.style.display = 'none';
        }
    }
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    contextMenu.classList.add('hidden');
}

document.addEventListener('click', () => {
    hideContextMenu();
});

menuOpen.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (itemToInteract) {
        if (itemToInteract.isDirectory) {
            navigationHistory.push(currentFolderPath);
            currentFolderPath = itemToInteract.path;
            searchInput.value = '';
            minSizeInput.value = '';
            typeFilter.value = 'all';
            duplicateMarkers.clear();
            startScan(currentFolderPath);
        } else {
            window.electronAPI.openItem(itemToInteract.path);
        }
        hideContextMenu();
    }
});

menuPreview.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (itemToInteract && !itemToInteract.isDirectory) {
        await previewFile(itemToInteract);
        hideContextMenu();
    }
});

menuReveal.addEventListener('click', (e) => {
    e.stopPropagation();
    if (itemToInteract) {
        window.electronAPI.openItemLocation(itemToInteract.path);
        hideContextMenu();
    }
});

menuDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    if (itemToInteract) {
        deleteItemName.textContent = itemToInteract.name;
        modalOverlay.classList.remove('hidden');
        hideContextMenu();
    }
});

// Modal Logic
cancelDeleteBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    itemToInteract = null;
});

confirmDeleteBtn.addEventListener('click', async () => {
    if (itemToInteract) {
        modalOverlay.classList.add('hidden');
        showLoader();
        const result = await window.electronAPI.deleteItem(itemToInteract.path);
        if (result.success) {
            await startScan(currentFolderPath);
        } else {
            alert(`Delete failed: ${result.error}`);
            hideLoader();
        }
        itemToInteract = null;
    }
});

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncatePath(path) {
    if (path.length > 50) {
        return '...' + path.slice(-47);
    }
    return path;
}

function showLoader() {
    loader.classList.remove('hidden');
    welcomeScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

function showResults() {
    resultsScreen.classList.remove('hidden');
}

// Initialize sort headers
updateSortHeaders();
