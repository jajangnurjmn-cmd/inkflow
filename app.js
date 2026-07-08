// ==========================================================================
// RICH TEXT EDITOR FUNCTIONS
// ==========================================================================

// Format command (Bold, Italic, dll)
function formatDoc(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('chapter-content').focus();
    hitungKata();
}

// Handle Enter key untuk auto paragraph spacing
// ==========================================================================
// RICH TEXT EDITOR FUNCTIONS
// ==========================================================================

function formatDoc(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('chapter-content').focus();
    hitungKata();
}

function setupRichEditor() {
    const editor = document.getElementById('chapter-content');
    if (!editor) return;
    
    // Handle paste - preserve formatting
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        
        if (html) {
            let cleanHtml = html
                .replace(/font-family:[^;]+;/gi, '')
                .replace(/font-size:[^;]+;/gi, '')
                .replace(/style=""/gi, '')
                .replace(/class="[^"]*"/gi, '')
                .replace(/id="[^"]*"/gi, '');
            
            document.execCommand('insertHTML', false, cleanHtml);
        } else {
            const paragraphs = text.split(/\n\s*\n/).map(p => {
                const lines = p.split('\n').join('<br>');
                return `<p>${lines}</p>`;
            }).join('');
            document.execCommand('insertHTML', false, paragraphs);
        }
        
        setTimeout(hitungKata, 0);
    });
    
    // Handle input (lebih reliable dari keyup di mobile)
    editor.addEventListener('input', () => {
        hitungKata();
        clearTimeout(waktuKetik);
        waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
    });
    
    // Handle Enter untuk auto paragraph
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            setTimeout(() => {
                cleanupParagraphs(editor);
            }, 0);
        }
    });
    
    // Touch events untuk mobile
    editor.addEventListener('touchend', () => {
        setTimeout(hitungKata, 100);
    });
}

function cleanupParagraphs(editor) {
    // Ganti div jadi p
    const divs = editor.querySelectorAll('div');
    divs.forEach(div => {
        if (!div.classList.length && div.id !== 'chapter-content') {
            const p = document.createElement('p');
            p.innerHTML = div.innerHTML;
            div.parentNode.replaceChild(p, div);
        }
    });
    
    // Pastikan selalu ada <p> wrapper
    if (editor.innerHTML === '<br>' || editor.innerHTML === '') {
        editor.innerHTML = '<p><br></p>';
    }
}

function hitungKata() {
    const editor = document.getElementById('chapter-content');
    if (!editor) return;
    
    // Ambil textContent (lebih reliable di mobile)
    const text = editor.textContent || editor.innerText || '';
    const arrayKata = text.trim().split(/\s+/).filter(w => w.length > 0);
    const jumlahKata = text.trim() === '' ? 0 : arrayKata.length;
    
    const el = document.getElementById('word-count');
    if (el) {
        el.innerText = `${jumlahKata} Kata`;
        // Animasi kecil biar keliatan aktif
        el.style.opacity = '0.5';
        setTimeout(() => el.style.opacity = '1', 150);
    }
}

// ==========================================================================
// UPDATED FUNCTIONS
// ==========================================================================

function bukaEditor(storyId, dataChapter = null) {
    document.getElementById('story-detail-screen').classList.add('hidden');
    const editorScreen = document.getElementById('editor-screen');
    editorScreen.classList.remove('hidden');
    editorScreen.dataset.activeStoryId = storyId;
    
    // Setup rich editor
    setupRichEditor();
    
    if (dataChapter) {
        editorScreen.dataset.activeChapterId = dataChapter.id;
        document.getElementById('editor-title').innerText = "Edit Chapter";
        document.getElementById('chapter-title').value = dataChapter.judulChapter || '';
        // Parse HTML atau plain text
        const content = dataChapter.isi || '';
        document.getElementById('chapter-content').innerHTML = content.includes('<') ? content : `<p>${content.replace(/\n/g, '<br>')}</p>`;
    } else {
        delete editorScreen.dataset.activeChapterId;
        document.getElementById('editor-title').innerText = "Chapter Baru";
        document.getElementById('chapter-title').value = '';
        document.getElementById('chapter-content').innerHTML = '<p><br></p>';
    }
    
    // Focus ke editor setelah animasi
    setTimeout(() => {
        document.getElementById('chapter-content').focus();
    }, 300);
    
    hitungKata();
}

function simpanDraftChapter(callback = null) {
    const editorScreen = document.getElementById('editor-screen');
    const storyId = editorScreen.dataset.activeStoryId;
    let chapterId = editorScreen.dataset.activeChapterId; 
    
    const judulChapter = document.getElementById('chapter-title').value;
    const isiKonten = document.getElementById('chapter-content').innerHTML;

    if (!judulChapter.trim() && (isiKonten === '<p><br></p>' || isiKonten === '')) {
        if (typeof callback === 'function') callback();
        return;
    }

    const id = chapterId || ('chapter_' + Date.now());
    const dataChapter = {
        id: id,
        storyId: storyId,
        judulChapter: judulChapter || 'Chapter Tanpa Judul',
        isi: isiKonten,
        terakhirDiubah: new Date().toISOString()
    };

    const tx = localDb.transaction(['chapters'], 'readwrite');
    tx.objectStore('chapters').put(dataChapter).onsuccess = () => {
        if (!chapterId) editorScreen.dataset.activeChapterId = id;
        indikatorTersimpan();
        
        if (currentUser && isOnline) {
            saveToFirestore('chapters', dataChapter, id);
        }
        
        if (typeof callback === 'function') callback();
    };
}

function indikatorTersimpan() {
    const btnSave = document.getElementById('btn-save');
    if (!btnSave) return;
    btnSave.innerText = 'Tersimpan ✓';
    btnSave.style.color = '#4cd964';
    setTimeout(() => {
        btnSave.innerText = 'Simpan';
        btnSave.style.color = '#007aff';
    }, 3000);
}

// Export TXT - convert HTML ke plain text tapi pertahankan struktur
function exportCeritaKeTXT() {
    const detailScreen = document.getElementById('story-detail-screen');
    const storyId = detailScreen.dataset.activeStoryId;
    const judulCerita = document.getElementById('detail-story-title').innerText;

    const transaction = localDb.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    
    store.getAll().onsuccess = function(event) {
        const semuaChapter = event.target.result;
        const chapterCeritaIni = semuaChapter.filter(ch => ch.storyId === storyId);

        if (chapterCeritaIni.length === 0) {
            alert("Belum ada teks untuk diekspor!"); return;
        }

        let kontenExport = `=========================================\n`;
        kontenExport += `JUDUL: ${judulCerita.toUpperCase()}\n`;
        kontenExport += `Di-export pada: ${new Date().toLocaleString('id-ID')}\n`;
        kontenExport += `=========================================\n\n`;

        chapterCeritaIni.forEach((ch) => {
            kontenExport += `\n--- ${ch.judulChapter.toUpperCase()} ---\n\n`;
            // Convert HTML ke plain text dengan formatting markers
            let plainText = ch.isi
                .replace(/<p>/gi, '')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<b>|<strong>/gi, '**')
                .replace(/<\/b>|<\/strong>/gi, '**')
                .replace(/<i>|<em>/gi, '*')
                .replace(/<\/i>|<\/em>/gi, '*')
                .replace(/<u>/gi, '_')
                .replace(/<\/u>/gi, '_')
                .replace(/<[^>]+>/g, ''); // Hapus tag lain
            
            kontenExport += plainText + '\n\n';
        });

        const blob = new Blob([kontenExport], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const elemenDownload = document.createElement('a');
        elemenDownload.href = url;
        elemenDownload.download = `${judulCerita.replace(/\s+/g, '_')}_Backup.txt`; 
        document.body.appendChild(elemenDownload);
        elemenDownload.click();
        document.body.removeChild(elemenDownload);
        URL.revokeObjectURL(url);
    };
}
// ==========================================================================
// FIREBASE (Dari global window object)
// ==========================================================================
const db = window.db;
const auth = window.auth;
const provider = window.provider;

// Firestore methods
const collection = (db, ...path) => db.collection(path.join('/'));
const doc = (db, ...path) => db.doc(path.join('/'));
const setDoc = (ref, data) => ref.set(data, { merge: true });
const getDoc = (ref) => ref.get();
const getDocs = (ref) => ref.get();
const deleteDoc = (ref) => ref.delete();
const onSnapshot = (ref, callback, errorCallback) => ref.onSnapshot(callback, errorCallback);
const query = (ref, ...constraints) => ref; // Simplified
const where = (field, op, value) => null; // Simplified

// Auth methods
const signInWithPopup = (auth, provider) => auth.signInWithPopup(provider);
const onAuthStateChanged = (auth, callback) => auth.onAuthStateChanged(callback);
const signOut = (auth) => auth.signOut();

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let currentUser = null;
let isOnline = navigator.onLine;
let localDb = null;

// ==========================================================================
// INDEXEDDB FALLBACK
// ==========================================================================
const DB_NAME = 'WriterPWADB';
const DB_VERSION = 3;

function initLocalDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('stories')) {
                db.createObjectStore('stories', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('chapters')) {
                db.createObjectStore('chapters', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('story_bible')) {
                db.createObjectStore('story_bible', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// ==========================================================================
// AUTHENTICATION
// ==========================================================================
async function login() {
    try {
        await signInWithPopup(auth, provider);
    } catch (err) {
        console.error("Login gagal:", err);
        alert("Login gagal: " + err.message);
    }
}

async function logout() {
    try {
        await signOut(auth);
        const tx = localDb.transaction(['stories', 'chapters', 'story_bible'], 'readwrite');
        tx.objectStore('stories').clear();
        tx.objectStore('chapters').clear();
        tx.objectStore('story_bible').clear();
        tx.oncomplete = () => location.reload();
    } catch (err) {
        console.error("Logout gagal:", err);
    }
}

function updateAuthUI(user) {
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userName = document.getElementById('user-name');
    const statusEl = document.querySelector('.status-sync');
    
    if (user) {
        currentUser = user;
        if (btnLogin) btnLogin.classList.add('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (userName) userName.innerText = user.displayName || user.email;
        if (statusEl) statusEl.innerText = '🔄 Syncing...';
        setupRealtimeSync();
    } else {
        currentUser = null;
        if (btnLogin) btnLogin.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.add('hidden');
        if (userName) userName.innerText = '';
        if (statusEl) statusEl.innerText = '⚡ Mode Lokal (Login untuk sync)';
    }
}

// ==========================================================================
// SYNC ENGINE
// ==========================================================================
let syncListeners = [];

function setupRealtimeSync() {
    if (!currentUser) return;
    
    const userId = currentUser.uid;
    
    // Listen Stories
    const storiesUnsub = db.collection('users').doc(userId).collection('stories')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                const data = { ...change.doc.data(), id: change.doc.id };
                const tx = localDb.transaction(['stories'], 'readwrite');
                const store = tx.objectStore('stories');
                
                if (change.type === 'removed') {
                    store.delete(change.doc.id);
                } else {
                    store.put(data);
                }
            });
            loadDashboardData();
            updateSyncStatus('✅ Synced');
        }, (err) => {
            console.error("Sync error:", err);
            updateSyncStatus('⚠️ Sync error');
        });
    syncListeners.push(storiesUnsub);
    
    // Listen Chapters
    const chaptersUnsub = db.collection('users').doc(userId).collection('chapters')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                const data = { ...change.doc.data(), id: change.doc.id };
                const tx = localDb.transaction(['chapters'], 'readwrite');
                const store = tx.objectStore('chapters');
                
                if (change.type === 'removed') {
                    store.delete(change.doc.id);
                } else {
                    store.put(data);
                }
            });
            const detailScreen = document.getElementById('story-detail-screen');
            if (!detailScreen.classList.contains('hidden')) {
                muatDaftarChapter(detailScreen.dataset.activeStoryId);
            }
        });
    syncListeners.push(chaptersUnsub);
    
    // Listen Bibles
    const biblesUnsub = db.collection('users').doc(userId).collection('bibles')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                const data = { ...change.doc.data(), id: change.doc.id };
                const tx = localDb.transaction(['story_bible'], 'readwrite');
                const store = tx.objectStore('story_bible');
                
                if (change.type === 'removed') {
                    store.delete(change.doc.id);
                } else {
                    store.put(data);
                }
            });
            const bibleScreen = document.getElementById('bible-screen');
            if (!bibleScreen.classList.contains('hidden')) {
                muatDaftarBible();
            }
        });
    syncListeners.push(biblesUnsub);
}

function updateSyncStatus(status) {
    const statusEl = document.querySelector('.status-sync');
    if (statusEl) {
        statusEl.innerText = status;
        statusEl.style.color = status.includes('✅') ? '#4cd964' : '';
    }
}

// ==========================================================================
// CRUD OPERATIONS
// ==========================================================================
async function saveToFirestore(collectionName, data, docId) {
    if (!currentUser || !isOnline) return;
    
    try {
        const ref = db.collection('users').doc(currentUser.uid).collection(collectionName).doc(docId);
        await ref.set(data, { merge: true });
    } catch (err) {
        console.error("Firestore save error:", err);
    }
}

async function deleteFromFirestore(collectionName, docId) {
    if (!currentUser || !isOnline) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).collection(collectionName).doc(docId).delete();
    } catch (err) {
        console.error("Firestore delete error:", err);
    }
}

// ==========================================================================
// DASHBOARD
// ==========================================================================
function tambahCerita(judul, sinopsis, tag, status = 'Draft') {
    const id = 'story_' + Date.now();
    const ceritaBaru = {
        id: id,
        judul: judul,
        sinopsis: sinopsis,
        tag: tag,
        status: status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    const tx = localDb.transaction(['stories'], 'readwrite');
    tx.objectStore('stories').put(ceritaBaru).onsuccess = () => {
        loadDashboardData();
        if (currentUser && isOnline) {
            saveToFirestore('stories', ceritaBaru, id);
        }
    };
}

function loadDashboardData() {
    if (!localDb) return;

    const transaction = localDb.transaction(['stories'], 'readonly');
    const store = transaction.objectStore('stories');
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = function(event) {
        const semuaCerita = event.target.result;
        
        let hitungDraft = 0;
        let hitungEditing = 0;
        let hitungPublished = 0;

        semuaCerita.forEach(cerita => {
            if (cerita.status?.toLowerCase() === 'draft') hitungDraft++;
            if (cerita.status?.toLowerCase() === 'editing') hitungEditing++;
            if (cerita.status?.toLowerCase() === 'published') hitungPublished++;
        });

        const elDraft = document.getElementById('count-draft');
        const elEditing = document.getElementById('count-editing');
        const elPublished = document.getElementById('count-published');
        
        if(elDraft) elDraft.innerText = hitungDraft;
        if(elEditing) elEditing.innerText = hitungEditing;
        if(elPublished) elPublished.innerText = hitungPublished;
        
        const projectList = document.querySelector('.project-list');
        projectList.innerHTML = '<h2>Proyek Aktif</h2>';
        
        if (semuaCerita.length === 0) {
            projectList.innerHTML += '<p style="color: #888; font-size: 0.9rem; text-align: center; margin-top: 20px;">Belum ada cerita. Klik tombol di bawah untuk mulai.</p>';
            return;
        }

        semuaCerita.forEach(cerita => {
            const card = document.createElement('div');
            card.className = 'focus-block project-card';
            card.style.cursor = 'pointer';
            card.onclick = () => bukaDetailCerita(cerita);

            const statusClass = cerita.status?.toLowerCase() === 'editing' ? 'badge-editing' : 
                               (cerita.status?.toLowerCase() === 'published' ? 'badge-published' : 'badge-draft');

            card.innerHTML = `
                <h3>${cerita.judul}</h3>
                <p class="meta-data">${cerita.sinopsis?.substring(0, 30) || ''}... | Tag: ${cerita.tag}</p>
                <span class="badge ${statusClass}">${cerita.status}</span>
            `;

            const actionDiv = document.createElement('div');
            actionDiv.className = 'card-actions';

            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn-small btn-edit';
            btnEdit.innerText = 'Edit Info';
            btnEdit.onclick = (e) => {
                e.stopPropagation(); 
                const judulBaru = prompt("Edit Judul:", cerita.judul);
                if (judulBaru === null) return; 
                
                const sinopsisBaru = prompt("Edit Sinopsis:", cerita.sinopsis);
                const tagBaru = prompt("Edit Tag:", cerita.tag);

                cerita.judul = judulBaru || cerita.judul;
                cerita.sinopsis = sinopsisBaru || cerita.sinopsis;
                cerita.tag = tagBaru || cerita.tag;
                cerita.updatedAt = new Date().toISOString();

                const tx = localDb.transaction(['stories'], 'readwrite');
                tx.objectStore('stories').put(cerita).onsuccess = () => {
                    loadDashboardData();
                    if (currentUser && isOnline) {
                        saveToFirestore('stories', cerita, cerita.id);
                    }
                };
            };

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-small btn-delete';
            btnDel.innerText = 'Hapus';
            btnDel.onclick = (e) => {
                e.stopPropagation(); 
                if(confirm(`PERINGATAN FATAL!\nYakin ingin menghapus cerita "${cerita.judul}" secara permanen?`)) {
                    const tx = localDb.transaction(['stories', 'chapters', 'story_bible'], 'readwrite');
                    tx.objectStore('stories').delete(cerita.id);
                    
                    tx.objectStore('chapters').openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if(cursor) {
                            if(cursor.value.storyId === cerita.id) {
                                cursor.delete();
                                if (currentUser && isOnline) {
                                    deleteFromFirestore('chapters', cursor.value.id);
                                }
                            }
                            cursor.continue();
                        }
                    };
                    
                    tx.objectStore('story_bible').openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if(cursor) {
                            if(cursor.value.storyId === cerita.id) {
                                cursor.delete();
                                if (currentUser && isOnline) {
                                    deleteFromFirestore('bibles', cursor.value.id);
                                }
                            }
                            cursor.continue();
                        }
                    };
                    
                    tx.oncomplete = () => {
                        loadDashboardData();
                        if (currentUser && isOnline) {
                            deleteFromFirestore('stories', cerita.id);
                        }
                    }; 
                }
            };

            actionDiv.appendChild(btnEdit);
            actionDiv.appendChild(btnDel);
            card.appendChild(actionDiv);
            projectList.appendChild(card);
        });
    };
}

// ==========================================================================
// NAVIGASI & EDITOR
// ==========================================================================
function bukaDetailCerita(cerita) {
    document.querySelector('.viewing-area').classList.add('hidden');
    document.querySelector('.interaction-area').classList.add('hidden');
    document.querySelector('.fab-action').classList.add('hidden');
    
    const detailScreen = document.getElementById('story-detail-screen');
    detailScreen.classList.remove('hidden');
    detailScreen.dataset.activeStoryId = cerita.id;
    
    document.getElementById('detail-story-title').innerText = cerita.judul;
    document.getElementById('detail-story-synopsis').innerText = cerita.sinopsis;
    
    const dropdown = document.getElementById('story-status-dropdown');
    if (dropdown) dropdown.value = cerita.status;
    
    muatDaftarChapter(cerita.id);
}

function muatDaftarChapter(storyId) {
    const transaction = localDb.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    const container = document.getElementById('chapters-container');
    if (!container) return;
    container.innerHTML = '';

    store.getAll().onsuccess = function(event) {
        const semuaChapter = event.target.result;
        const chapterCeritaIni = semuaChapter.filter(ch => ch.storyId === storyId);

        if (chapterCeritaIni.length === 0) {
            container.innerHTML = '<p style="color:#666; font-size:0.9rem; text-align:center; margin-top:20px;">Belum ada chapter. Klik "+ Bab Baru" untuk mulai menulis.</p>';
            return;
        }

        chapterCeritaIni.forEach(ch => {
            const chCard = document.createElement('div');
            chCard.className = 'chapter-card';
            chCard.onclick = () => bukaEditor(storyId, ch);
            
            chCard.innerHTML = `
                <h4>${ch.judulChapter}</h4>
                <span>Terakhir diubah: ${new Date(ch.terakhirDiubah).toLocaleDateString('id-ID')}</span>
            `;
            container.appendChild(chCard);
        });
    };
}

function bukaEditor(storyId, dataChapter = null) {
    document.getElementById('story-detail-screen').classList.add('hidden');
    const editorScreen = document.getElementById('editor-screen');
    editorScreen.classList.remove('hidden');
    editorScreen.dataset.activeStoryId = storyId;
    
    if (dataChapter) {
        editorScreen.dataset.activeChapterId = dataChapter.id;
        document.getElementById('editor-title').innerText = "Edit Chapter";
        document.getElementById('chapter-title').value = dataChapter.judulChapter;
        document.getElementById('chapter-content').value = dataChapter.isi;
    } else {
        delete editorScreen.dataset.activeChapterId;
        document.getElementById('editor-title').innerText = "Chapter Baru";
        document.getElementById('chapter-title').value = '';
        document.getElementById('chapter-content').value = '';
    }
    hitungKata();
}

function kembaliKeDashboard() {
    document.getElementById('story-detail-screen').classList.add('hidden');
    document.querySelector('.viewing-area').classList.remove('hidden');
    document.querySelector('.interaction-area').classList.remove('hidden');
    document.querySelector('.fab-action').classList.remove('hidden');
    loadDashboardData();
}

function tutupEditor() {
    simpanDraftChapter(() => {
        const editorScreen = document.getElementById('editor-screen');
        const storyId = editorScreen.dataset.activeStoryId;
        editorScreen.classList.add('hidden');
        delete editorScreen.dataset.activeChapterId; 
        
        const transaction = localDb.transaction(['stories'], 'readonly');
        transaction.objectStore('stories').get(storyId).onsuccess = function(event) {
            if (event.target.result) {
                bukaDetailCerita(event.target.result);
            }
        };
    });
}

// ==========================================================================
// EDITOR & AUTO-SAVE
// ==========================================================================
let waktuKetik;
const JEDA_SIMPAN = 2000;

function simpanDraftChapter(callback = null) {
    const editorScreen = document.getElementById('editor-screen');
    const storyId = editorScreen.dataset.activeStoryId;
    let chapterId = editorScreen.dataset.activeChapterId; 
    
    const judulChapter = document.getElementById('chapter-title').value;
    const isiKonten = document.getElementById('chapter-content').value;

    if (!judulChapter.trim() && !isiKonten.trim()) {
        if (typeof callback === 'function') callback();
        return;
    }

    const id = chapterId || ('chapter_' + Date.now());
    const dataChapter = {
        id: id,
        storyId: storyId,
        judulChapter: judulChapter || 'Chapter Tanpa Judul',
        isi: isiKonten,
        terakhirDiubah: new Date().toISOString()
    };

    const tx = localDb.transaction(['chapters'], 'readwrite');
    tx.objectStore('chapters').put(dataChapter).onsuccess = () => {
        if (!chapterId) editorScreen.dataset.activeChapterId = id;
        indikatorTersimpan();
        
        if (currentUser && isOnline) {
            saveToFirestore('chapters', dataChapter, id);
        }
        
        if (typeof callback === 'function') callback();
    };
}

function indikatorTersimpan() {
    const btnSave = document.getElementById('btn-save');
    if (!btnSave) return;
    btnSave.innerText = 'Tersimpan ✓';
    btnSave.style.color = '#4cd964';
    setTimeout(() => {
        btnSave.innerText = 'Simpan';
        btnSave.style.color = '#007aff';
    }, 3000);
}

function hitungKata() {
    const teks = document.getElementById('chapter-content').value;
    const arrayKata = teks.trim().split(/\s+/);
    const jumlahKata = teks.trim() === '' ? 0 : arrayKata.length;
    const el = document.getElementById('word-count');
    if(el) el.innerText = `${jumlahKata} Kata`;
}

// ==========================================================================
// STORY BIBLE
// ==========================================================================
function bukaBibleList() {
    document.getElementById('story-detail-screen').classList.add('hidden');
    const bibleScreen = document.getElementById('bible-screen');
    bibleScreen.classList.remove('hidden');
    bibleScreen.dataset.activeStoryId = document.getElementById('story-detail-screen').dataset.activeStoryId;
    muatDaftarBible();
}

function muatDaftarBible() {
    const storyId = document.getElementById('bible-screen').dataset.activeStoryId;
    const container = document.getElementById('bible-container');
    container.innerHTML = '';

    const transaction = localDb.transaction(['story_bible'], 'readonly');
    const store = transaction.objectStore('story_bible');
    
    store.getAll().onsuccess = function(event) {
        const semuaBible = event.target.result;
        const bibleCeritaIni = semuaBible.filter(b => b.storyId === storyId);

        if (bibleCeritaIni.length === 0) {
            container.innerHTML = '<p style="color:#666; text-align:center; margin-top:30px;">Belum ada data.</p>';
            return;
        }

        bibleCeritaIni.forEach(bible => {
            const card = document.createElement('div');
            card.className = 'bible-card';
            card.onclick = () => bukaBibleEditor(bible);
            card.innerHTML = `
                <span class="badge-bible">${bible.kategori}</span>
                <h4>${bible.nama}</h4>
                <p>${bible.deskripsi}</p>
            `;
            container.appendChild(card);
        });
    };
}

function tutupBibleList() {
    document.getElementById('bible-screen').classList.add('hidden');
    document.getElementById('story-detail-screen').classList.remove('hidden');
}

function bukaBibleEditor(dataBible = null) {
    document.getElementById('bible-screen').classList.add('hidden');
    const editorScreen = document.getElementById('bible-editor-screen');
    editorScreen.classList.remove('hidden');

    if (dataBible) {
        editorScreen.dataset.activeBibleId = dataBible.id;
        document.getElementById('bible-editor-title').innerText = "Edit Entri";
        document.getElementById('bible-category').value = dataBible.kategori;
        document.getElementById('bible-entry-title').value = dataBible.nama;
        document.getElementById('bible-entry-content').value = dataBible.deskripsi;
    } else {
        delete editorScreen.dataset.activeBibleId;
        document.getElementById('bible-editor-title').innerText = "Entri Baru";
        document.getElementById('bible-category').value = "Karakter";
        document.getElementById('bible-entry-title').value = "";
        document.getElementById('bible-entry-content').value = "";
    }
}

function tutupBibleEditor() {
    document.getElementById('bible-editor-screen').classList.add('hidden');
    document.getElementById('bible-screen').classList.remove('hidden');
}

function simpanBibleEntry() {
    const storyId = document.getElementById('bible-screen').dataset.activeStoryId;
    const editorScreen = document.getElementById('bible-editor-screen');
    const bibleId = editorScreen.dataset.activeBibleId;
    
    const kategori = document.getElementById('bible-category').value;
    const nama = document.getElementById('bible-entry-title').value;
    const deskripsi = document.getElementById('bible-entry-content').value;

    if (!nama.trim()) { alert("Nama tidak boleh kosong!"); return; }

    const id = bibleId || ('bible_' + Date.now());
    const dataBaru = { 
        id: id,
        storyId, 
        kategori, 
        nama, 
        deskripsi, 
        terakhirDiubah: new Date().toISOString() 
    };
    
    const tx = localDb.transaction(['story_bible'], 'readwrite');
    tx.objectStore('story_bible').put(dataBaru).onsuccess = () => { 
        if (currentUser && isOnline) {
            saveToFirestore('bibles', dataBaru, id);
        }
        tutupBibleEditor(); 
        muatDaftarBible(); 
    };
}

// ==========================================================================
// EXPORT
// ==========================================================================
function exportCeritaKeTXT() {
    const detailScreen = document.getElementById('story-detail-screen');
    const storyId = detailScreen.dataset.activeStoryId;
    const judulCerita = document.getElementById('detail-story-title').innerText;

    const transaction = localDb.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    
    store.getAll().onsuccess = function(event) {
        const semuaChapter = event.target.result;
        const chapterCeritaIni = semuaChapter.filter(ch => ch.storyId === storyId);

        if (chapterCeritaIni.length === 0) {
            alert("Belum ada teks untuk diekspor!"); return;
        }

        let kontenExport = `=========================================\n`;
        kontenExport += `JUDUL: ${judulCerita.toUpperCase()}\n`;
        kontenExport += `Di-export pada: ${new Date().toLocaleString('id-ID')}\n`;
        kontenExport += `=========================================\n\n`;

        chapterCeritaIni.forEach((ch) => {
            kontenExport += `\n--- ${ch.judulChapter.toUpperCase()} ---\n\n${ch.isi}\n\n`;
        });

        const blob = new Blob([kontenExport], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const elemenDownload = document.createElement('a');
        elemenDownload.href = url;
        elemenDownload.download = `${judulCerita.replace(/\s+/g, '_')}_Backup.txt`; 
        document.body.appendChild(elemenDownload);
        elemenDownload.click();
        document.body.removeChild(elemenDownload);
        URL.revokeObjectURL(url);
    };
}

// ==========================================================================
// SERVICE WORKER
// ==========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .catch(err => console.error('Pendaftaran Service Worker gagal:', err));
    });
}

// ==========================================================================
// EVENT LISTENERS & INIT
// ==========================================================================
window.addEventListener('online', () => {
    isOnline = true;
    updateSyncStatus('🔄 Online');
    if (currentUser) syncLocalToCloud();
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateSyncStatus('✈️ Offline Mode');
});

async function syncLocalToCloud() {
    if (!currentUser || !isOnline) return;
    
    const storiesTx = localDb.transaction(['stories'], 'readonly');
    const stories = await new Promise(r => storiesTx.objectStore('stories').getAll().onsuccess = e => r(e.target.result));
    for (const story of stories) {
        await saveToFirestore('stories', story, story.id);
    }
    
    const chaptersTx = localDb.transaction(['chapters'], 'readonly');
    const chapters = await new Promise(r => chaptersTx.objectStore('chapters').getAll().onsuccess = e => r(e.target.result));
    for (const ch of chapters) {
        await saveToFirestore('chapters', ch, ch.id);
    }
    
    const biblesTx = localDb.transaction(['story_bible'], 'readonly');
    const bibles = await new Promise(r => biblesTx.objectStore('story_bible').getAll().onsuccess = e => r(e.target.result));
    for (const bible of bibles) {
        await saveToFirestore('bibles', bible, bible.id);
    }
    
    updateSyncStatus('✅ Synced');
}

document.addEventListener('DOMContentLoaded', async () => {
    // Init IndexedDB
    localDb = await initLocalDb();
    
    // Auth state listener
    onAuthStateChanged(auth, (user) => {
        updateAuthUI(user);
    });
    
    // Login/Logout buttons
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', login);
    
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', logout);

    // Tombol Tulis
    const btnTulis = document.querySelector('.fab-action');
    if (btnTulis) {
        btnTulis.addEventListener('click', () => {
            const judulInput = prompt("Masukkan Judul Cerita:");
            if (!judulInput) return;
            const sinopsisInput = prompt("Masukkan Sinopsis Singkat:");
            const tagInput = prompt("Masukkan Tag (Contoh: Misteri, Sci-Fi):");
            tambahCerita(judulInput, sinopsisInput, tagInput, 'Draft');
        });
    }
    
    // Navigasi
    const btnBackEditor = document.getElementById('btn-back');
    if (btnBackEditor) btnBackEditor.addEventListener('click', tutupEditor);

    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    if (btnBackDashboard) btnBackDashboard.addEventListener('click', kembaliKeDashboard);
    
    const btnNewChapter = document.getElementById('btn-new-chapter');
    if (btnNewChapter) btnNewChapter.addEventListener('click', () => {
        const storyId = document.getElementById('story-detail-screen').dataset.activeStoryId;
        bukaEditor(storyId, null);
    });

   // Auto-Save Editor (Rich Text)
const editorContent = document.getElementById('chapter-content');
const areaJudul = document.getElementById('chapter-title');
const tombolSimpan = document.getElementById('btn-save');

if (editorContent) {
    editorContent.addEventListener('input', () => {
        hitungKata();
        clearTimeout(waktuKetik);
        waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
    });
}

if (areaJudul) areaJudul.addEventListener('keyup', () => {
    clearTimeout(waktuKetik);
    waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
});

if (tombolSimpan) tombolSimpan.addEventListener('click', () => {
    clearTimeout(waktuKetik);
    simpanDraftChapter();
});
    
    // Status Dropdown
    const statusDropdown = document.getElementById('story-status-dropdown');
    if (statusDropdown) {
        statusDropdown.addEventListener('change', (e) => {
            const storyId = document.getElementById('story-detail-screen').dataset.activeStoryId;
            const statusBaru = e.target.value;
            
            const tx = localDb.transaction(['stories'], 'readwrite');
            const store = tx.objectStore('stories');
            
            store.get(storyId).onsuccess = function(event) {
                const dataCerita = event.target.result;
                if (dataCerita) {
                    dataCerita.status = statusBaru;
                    dataCerita.updatedAt = new Date().toISOString();
                    store.put(dataCerita).onsuccess = () => {
                        statusDropdown.style.color = '#4cd964';
                        if (currentUser && isOnline) {
                            saveToFirestore('stories', dataCerita, storyId);
                        }
                        setTimeout(() => { statusDropdown.style.color = '#fff'; }, 1000);
                    };
                }
            };
        });
    }

    // Export & Bible
    const btnExport = document.getElementById('btn-export-txt');
    if (btnExport) btnExport.addEventListener('click', exportCeritaKeTXT);

    const btnOpenBible = document.getElementById('btn-open-bible');
    if (btnOpenBible) btnOpenBible.addEventListener('click', bukaBibleList);

    const btnBackFromBible = document.getElementById('btn-back-detail-from-bible');
    if (btnBackFromBible) btnBackFromBible.addEventListener('click', tutupBibleList);

    const btnNewBible = document.getElementById('btn-new-bible');
    if (btnNewBible) btnNewBible.addEventListener('click', () => bukaBibleEditor(null));

    const btnCancelBible = document.getElementById('btn-cancel-bible');
    if (btnCancelBible) btnCancelBible.addEventListener('click', tutupBibleEditor);

    const btnSaveBible = document.getElementById('btn-save-bible');
    if (btnSaveBible) btnSaveBible.addEventListener('click', simpanBibleEntry);
});
