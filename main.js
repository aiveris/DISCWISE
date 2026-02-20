const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e2e',
      symbolColor: '#cdd6f4'
    },
    backgroundColor: '#1e1e2e',
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('scan-directory', async (event, dirPath) => {
  return scanDir(dirPath);
});

ipcMain.handle('delete-item', async (event, itemPath) => {
  try {
    fs.rmSync(itemPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    console.error(`Error deleting ${itemPath}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-item', async (event, itemPath) => {
  shell.openPath(itemPath);
});

ipcMain.handle('open-item-location', async (event, itemPath) => {
  shell.showItemInFolder(itemPath);
});

ipcMain.handle('calculate-file-hash', async (event, filePath) => {
  return calculateFileHash(filePath);
});

ipcMain.handle('read-file-content', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 10 * 1024 * 1024) { // 10MB limit
      return { success: false, error: 'File too large to preview' };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-image-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: data.toString('base64') };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

async function scanDir(dirPath) {
  const items = fs.readdirSync(dirPath);
  const results = [];

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    try {
      const stats = fs.statSync(fullPath);
      let size = 0;
      let isDirectory = stats.isDirectory();

      if (isDirectory) {
        size = getFolderSize(fullPath);
      } else {
        size = stats.size;
      }

      const extension = isDirectory ? '' : path.extname(item).toLowerCase();
      const fileType = getFileType(extension);
      
      results.push({
        name: item,
        path: fullPath,
        size: size,
        isDirectory: isDirectory,
        extension: extension,
        fileType: fileType,
        modifiedDate: stats.mtime,
        createdDate: stats.birthtime || stats.ctime
      });
    } catch (err) {
      console.error(`Error scanning ${fullPath}:`, err);
    }
  }

  return results.sort((a, b) => b.size - a.size);
}

function getFolderSize(folderPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        totalSize += getFolderSize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (err) {
    // console.error(err);
  }
  return totalSize;
}

function getFileType(extension) {
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'];
  const videoExts = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
  const docExts = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'];
  const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'];
  
  if (imageExts.includes(extension)) return 'images';
  if (videoExts.includes(extension)) return 'videos';
  if (docExts.includes(extension)) return 'documents';
  if (archiveExts.includes(extension)) return 'archives';
  return 'other';
}

function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (err) {
    console.error(`Error calculating hash for ${filePath}:`, err);
    return null;
  }
}
