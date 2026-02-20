const selectBtn = document.getElementById('select-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const resultsScreen = document.getElementById('results-screen');
const resultsList = document.getElementById('results-list');
const loader = document.getElementById('loader');
const currentPathSpan = document.getElementById('current-path');
const contextMenu = document.getElementById('context-menu');
const menuOpen = document.getElementById('menu-open');
const menuReveal = document.getElementById('menu-reveal');
const openText = document.getElementById('open-text');
const menuDelete = document.getElementById('menu-delete');
const modalOverlay = document.getElementById('modal-overlay');
const deleteItemName = document.getElementById('delete-item-name');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const backBtn = document.getElementById('back-btn');
const searchInput = document.getElementById('search-input');

let currentData = [];
let filteredData = [];
let itemToInteract = null;
let currentFolderPath = '';
let navigationHistory = [];

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    filteredData = currentData.filter(item =>
        item.name.toLowerCase().includes(query)
    );
    renderResults(filteredData);
});

selectBtn.addEventListener('click', async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
        navigationHistory = [];
        currentFolderPath = path;
        searchInput.value = ''; // Reset search
        startScan(path);
    }
});

backBtn.addEventListener('click', () => {
    if (navigationHistory.length > 0) {
        currentFolderPath = navigationHistory.pop();
        searchInput.value = ''; // Reset search
        startScan(currentFolderPath, false);
    }
});

async function startScan(path, addToHistory = true) {
    showLoader();
    currentPathSpan.textContent = path;

    // Show/hide back button based on history
    if (navigationHistory.length > 0 || (addToHistory && currentFolderPath !== path)) {
        backBtn.classList.remove('hidden');
    } else {
        backBtn.classList.add('hidden');
    }

    try {
        const results = await window.electronAPI.scanDirectory(path);
        currentData = results;
        renderResults(results);
        showResults();
    } catch (error) {
        console.error('Scan failed:', error);
        alert('Failed to scan directory');
    } finally {
        hideLoader();
    }
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
        div.style.animationDelay = `${index * 0.05}s`;

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
            <div class="size-bar-container">
                <div class="size-bar" style="width: ${percentage}%"></div>
            </div>
        `;

        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            itemToInteract = item;
            showContextMenu(e.pageX, e.pageY);
        });

        div.addEventListener('dblclick', () => {
            if (item.isDirectory) {
                navigationHistory.push(currentFolderPath);
                currentFolderPath = item.path;
                searchInput.value = ''; // Reset search
                startScan(currentFolderPath);
            }
        });

        resultsList.appendChild(div);
    });
}

// Context Menu Logic
function showContextMenu(x, y) {
    if (itemToInteract) {
        openText.textContent = itemToInteract.isDirectory ? 'Open Folder' : 'Open File';
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

menuOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    if (itemToInteract) {
        window.electronAPI.openItem(itemToInteract.path);
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
            // Re-scan after deletion
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
