// Document state
let documents = [];
let editingDocId = null;

// DOM Elements
const fileUpload = document.getElementById('file-upload');
const documentsGrid = document.getElementById('documents-grid');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');

// Modals
const previewModal = document.getElementById('preview-modal');
const editModal = document.getElementById('edit-modal');
const deleteModal = document.getElementById('delete-modal');
const closeModals = document.querySelectorAll('.close-modal');

// Edit Elements
const newDocNameInput = document.getElementById('new-doc-name');
const saveEditBtn = document.getElementById('save-edit');
const cancelEditBtn = document.getElementById('cancel-edit');

// Delete Elements
let documentToDeleteId = null;
const confirmDeleteBtn = document.getElementById('confirm-delete');
const cancelDeleteBtn = document.getElementById('cancel-delete');

// Initialize IndexedDB for robust local storage of large files
let db;
const request = indexedDB.open('DocVaultDB', 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    loadDocuments();
};

request.onerror = (event) => {
    console.error('IndexedDB error:', event.target.error);
    // Fallback to empty array if DB fails
    renderDocuments();
};

// Handle file upload
fileUpload.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    for (let file of files) {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
        const fileExt = file.name.split('.').pop().toLowerCase();
        const type = getFileType(fileExt, file.type);
        
        // Read file content for preview/download
        const reader = new FileReader();
        reader.onload = (event) => {
            const doc = {
                id,
                name: file.name,
                type,
                size: formatSize(file.size),
                rawSize: file.size,
                date: new Date().toLocaleDateString(),
                content: event.target.result,
                fileExt
            };
            
            saveDocument(doc);
        };
        
        if (type === 'image' || type === 'video' || type === 'pdf') {
            reader.readAsDataURL(file); // Store as Base64 for images/videos/pdfs
        } else {
            reader.readAsDataURL(file); // For download capability of other files
        }
    }
    
    fileUpload.value = ''; // Reset input
});

// Helper functions
function getFileType(ext, mimeType) {
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
    if (mimeType.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
    if (mimeType === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (ext === 'doc' || ext === 'docx') return 'word';
    if (ext === 'xml') return 'xml';
    if (ext === 'txt') return 'text';
    return 'unknown';
}

function getIconForType(type) {
    const icons = {
        'image': '<i class="fa-solid fa-image" style="color: #3b82f6;"></i>',
        'video': '<i class="fa-solid fa-video" style="color: #ef4444;"></i>',
        'pdf': '<i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i>',
        'word': '<i class="fa-solid fa-file-word" style="color: #3b82f6;"></i>',
        'xml': '<i class="fa-solid fa-file-code" style="color: #10b981;"></i>',
        'text': '<i class="fa-solid fa-file-lines" style="color: #94a3b8;"></i>',
        'unknown': '<i class="fa-solid fa-file" style="color: #94a3b8;"></i>'
    };
    return icons[type] || icons['unknown'];
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// DB Operations
function saveDocument(doc) {
    const transaction = db.transaction(['documents'], 'readwrite');
    const store = transaction.objectStore('documents');
    store.add(doc);
    
    transaction.oncomplete = () => {
        documents.push(doc);
        renderDocuments();
        updateStorageInfo();
    };
}

function updateDocumentInDb(doc) {
    const transaction = db.transaction(['documents'], 'readwrite');
    const store = transaction.objectStore('documents');
    store.put(doc);
}

function deleteDocumentFromDb(id) {
    const transaction = db.transaction(['documents'], 'readwrite');
    const store = transaction.objectStore('documents');
    store.delete(id);
    
    transaction.oncomplete = () => {
        documents = documents.filter(d => d.id !== id);
        renderDocuments();
        updateStorageInfo();
    };
}

function loadDocuments() {
    const transaction = db.transaction(['documents'], 'readonly');
    const store = transaction.objectStore('documents');
    const request = store.getAll();
    
    request.onsuccess = () => {
        documents = request.result || [];
        renderDocuments();
        updateStorageInfo();
    };
}

// UI Rendering
function renderDocuments(filterText = '') {
    // Clear grid except empty state
    const cards = documentsGrid.querySelectorAll('.doc-card');
    cards.forEach(card => card.remove());

    const filteredDocs = documents.filter(doc => 
        doc.name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filteredDocs.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        
        filteredDocs.forEach(doc => {
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.onclick = (e) => {
                // Prevent opening preview if clicking action buttons
                if (!e.target.closest('.doc-actions')) {
                    openPreview(doc.id);
                }
            };
            
            let iconHtml = getIconForType(doc.type);
            if (doc.type === 'image' && doc.content) {
                iconHtml = `<img src="${doc.content}" alt="${doc.name}">`;
            }

            card.innerHTML = `
                <div class="doc-icon">
                    ${iconHtml}
                </div>
                <div class="doc-info">
                    <div class="doc-name" title="${doc.name}">${doc.name}</div>
                    <div class="doc-meta">
                        <span>${doc.date}</span>
                        <span>${doc.size}</span>
                    </div>
                </div>
                <div class="doc-actions">
                    <div class="action-icon edit" onclick="openEditModal('${doc.id}', event)">
                        <i class="fa-solid fa-pen"></i>
                    </div>
                    <div class="action-icon delete" onclick="deleteDocument('${doc.id}', event)">
                        <i class="fa-solid fa-trash"></i>
                    </div>
                    <div class="action-icon download" onclick="downloadDocument('${doc.id}', event)">
                        <i class="fa-solid fa-download"></i>
                    </div>
                </div>
            `;
            
            documentsGrid.appendChild(card);
        });
    }
}

function updateStorageInfo() {
    let totalSize = documents.reduce((sum, doc) => sum + doc.rawSize, 0);
    const usedElement = document.getElementById('storage-used');
    usedElement.innerText = formatSize(totalSize);
    
    // Assuming 50MB quote for local storage demo
    const percent = Math.min((totalSize / (50 * 1024 * 1024)) * 100, 100);
    document.querySelector('.progress').style.width = `${percent}%`;
}

// Search
searchInput.addEventListener('input', (e) => {
    renderDocuments(e.target.value);
});

// Actions
function deleteDocument(id, event) {
    if (event) event.stopPropagation();
    documentToDeleteId = id;
    deleteModal.classList.add('active');
}

cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.remove('active');
    documentToDeleteId = null;
});

confirmDeleteBtn.addEventListener('click', () => {
    if (documentToDeleteId) {
        deleteDocumentFromDb(documentToDeleteId);
        deleteModal.classList.remove('active');
        documentToDeleteId = null;
    }
});

function downloadDocument(id, event) {
    if (event) event.stopPropagation();
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    const a = document.createElement('a');
    a.href = doc.content;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Modals Handling
closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        previewModal.classList.remove('active');
        editModal.classList.remove('active');
        deleteModal.classList.remove('active');
        document.getElementById('preview-container').innerHTML = ''; // Clean up media
    });
});

window.addEventListener('click', (e) => {
    if (e.target === previewModal) previewModal.classList.remove('active');
    if (e.target === editModal) editModal.classList.remove('active');
    if (e.target === deleteModal) deleteModal.classList.remove('active');
});

// Edit
function openEditModal(id, event) {
    if (event) event.stopPropagation();
    const doc = documents.find(d => d.id === id);
    if (doc) {
        editingDocId = id;
        newDocNameInput.value = doc.name;
        editModal.classList.add('active');
        newDocNameInput.focus();
    }
}

cancelEditBtn.addEventListener('click', () => {
    editModal.classList.remove('active');
    editingDocId = null;
});

saveEditBtn.addEventListener('click', () => {
    if (editingDocId && newDocNameInput.value.trim() !== '') {
        const doc = documents.find(d => d.id === editingDocId);
        if (doc) {
            doc.name = newDocNameInput.value.trim();
            updateDocumentInDb(doc);
            renderDocuments(searchInput.value);
            editModal.classList.remove('active');
        }
    }
});

// Preview
function openPreview(id) {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    document.getElementById('preview-title').innerText = doc.name;
    const container = document.getElementById('preview-container');
    container.innerHTML = ''; // Clear previous

    if (doc.type === 'image') {
        container.innerHTML = `<img src="${doc.content}" alt="${doc.name}">`;
    } else if (doc.type === 'video') {
        container.innerHTML = `
            <video controls autoplay>
                <source src="${doc.content}" type="video/${doc.fileExt}">
                Your browser does not support the video tag.
            </video>
        `;
    } else if (doc.type === 'pdf') {
        container.innerHTML = `<iframe src="${doc.content}#toolbar=0" frameborder="0"></iframe>`;
    } else {
        container.innerHTML = `
            <div class="no-preview">
                ${getIconForType(doc.type)}
                <p>Preview not available for this file type.</p>
                <p>Please download to view the content.</p>
            </div>
        `;
    }

    // Update download button in preview
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.onclick = () => downloadDocument(id);

    previewModal.classList.add('active');
}
