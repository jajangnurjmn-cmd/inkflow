// ==========================================================================
// 1. INISIALISASI DATABASE LOCAL-FIRST (IndexedDB)
// ==========================================================================
const DB_NAME = 'WriterPWADB';
const DB_VERSION = 1;
let db;

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = function(event) {
    const dbInstance = event.target.result;
    
    if (!dbInstance.objectStoreNames.contains('stories')) {
        dbInstance.createObjectStore('stories', { keyPath: 'id', autoIncrement: true });
    }
    if (!dbInstance.objectStoreNames.contains('chapters')) {
        dbInstance.createObjectStore('chapters', { keyPath: 'id', autoIncrement: true });
    }
    if (!dbInstance.objectStoreNames.contains('story_bible')) {
        dbInstance.createObjectStore('story_bible', { keyPath: 'id', autoIncrement: true });
    }
    console.log("Database IndexedDB berhasil disiapkan.");
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("Database berhasil dibuka.");
    loadDashboardData();
};

request.onerror = function(event) {
    console.error("Gagal membuka database lokal:", event.target.error);
};

// ==========================================================================
// 2. LOGIKA OPERASI DATA & DASHBOARD
// ==========================================================================
function tambahCerita(judul, sinopsis, tag, status = 'Draft') {
    const transaction = db.transaction(['stories'], 'readwrite');
    const store = transaction.objectStore('stories');
    
    const ceritaBaru = {
        judul: judul,
        sinopsis: sinopsis,
        tag: tag,
        status: status,
        createdAt: new Date().toISOString()
    };
    
    store.add(ceritaBaru).onsuccess = function() {
        loadDashboardData();
    };
}

function loadDashboardData() {
    if (!db) return;

    const transaction = db.transaction(['stories'], 'readonly');
    const store = transaction.objectStore('stories');
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = function(event) {
        const semuaCerita = event.target.result;
        
        let hitungDraft = 0;
        let hitungEditing = 0;
        let hitungPublished = 0;

        semuaCerita.forEach(cerita => {
            if (cerita.status.toLowerCase() === 'draft') hitungDraft++;
            if (cerita.status.toLowerCase() === 'editing') hitungEditing++;
            if (cerita.status.toLowerCase() === 'published') hitungPublished++;
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

            const statusClass = cerita.status.toLowerCase() === 'editing' ? 'badge-editing' : (cerita.status.toLowerCase() === 'published' ? 'badge-published' : 'badge-draft');

            card.innerHTML = `
                <h3>${cerita.judul}</h3>
                <p class="meta-data">${cerita.sinopsis.substring(0, 30)}... | Tag: ${cerita.tag}</p>
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

                const tx = db.transaction(['stories'], 'readwrite');
                cerita.judul = judulBaru || cerita.judul;
                cerita.sinopsis = sinopsisBaru || cerita.sinopsis;
                cerita.tag = tagBaru || cerita.tag;

                tx.objectStore('stories').put(cerita).onsuccess = () => loadDashboardData();
            };

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-small btn-delete';
            btnDel.innerText = 'Hapus';
            btnDel.onclick = (e) => {
                e.stopPropagation(); 
                if(confirm(`PERINGATAN FATAL!\nYakin ingin menghapus cerita "${cerita.judul}" secara permanen? Seluruh Chapter dan Story Bible di dalamnya akan ikut lenyap.`)) {
                    const tx = db.transaction(['stories', 'chapters', 'story_bible'], 'readwrite');
                    tx.objectStore('stories').delete(cerita.id);
                    
                    tx.objectStore('chapters').openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if(cursor) {
                            if(cursor.value.storyId === cerita.id) cursor.delete();
                            cursor.continue();
                        }
                    };
                    
                    tx.objectStore('story_bible').openCursor().onsuccess = (event) => {
                        const cursor = event.target.result;
                        if(cursor) {
                            if(cursor.value.storyId === cerita.id) cursor.delete();
                            cursor.continue();
                        }
                    };
                    tx.oncomplete = () => loadDashboardData(); 
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
// 3. SERVICE WORKER & UI AWAL
// ==========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .catch(err => console.error('Pendaftaran Service Worker gagal:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
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
});

// ==========================================================================
// 4. ARSITEKTUR NAVIGASI & EDITOR
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
    const transaction = db.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    const container = document.getElementById('chapters-container');
    if (!container) return; // Keamanan tambahan
    container.innerHTML = '';

    store.getAll().onsuccess = function(event) {
        const semuaChapter = event.target.result;
        const chapterCeritaIni = semuaChapter.filter(ch => ch.storyId === Number(storyId));

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
        
        const transaction = db.transaction(['stories'], 'readonly');
        transaction.objectStore('stories').get(Number(storyId)).onsuccess = function(event) {
            bukaDetailCerita(event.target.result);
        };
    });
}

// ==========================================================================
// 5. EDITOR UTAMA & AUTO-SAVE
// ==========================================================================
let waktuKetik;
const JEDA_SIMPAN = 2000;

function simpanDraftChapter(callback = null) {
    const editorScreen = document.getElementById('editor-screen');
    const storyId = Number(editorScreen.dataset.activeStoryId);
    let chapterId = editorScreen.dataset.activeChapterId; 
    
    const judulChapter = document.getElementById('chapter-title').value;
    const isiKonten = document.getElementById('chapter-content').value;

    if (!judulChapter.trim() && !isiKonten.trim()) {
        if (typeof callback === 'function') callback();
        return;
    }

    const transaction = db.transaction(['chapters'], 'readwrite');
    const store = transaction.objectStore('chapters');

    const dataChapter = {
        storyId: storyId,
        judulChapter: judulChapter || 'Chapter Tanpa Judul',
        isi: isiKonten,
        terakhirDiubah: new Date().toISOString()
    };

    let request;
    if (chapterId) {
        dataChapter.id = Number(chapterId);
        request = store.put(dataChapter);
    } else {
        request = store.add(dataChapter);
    }

    request.onsuccess = (event) => {
        if (!chapterId) editorScreen.dataset.activeChapterId = event.target.result; 
        indikatorTersimpan();
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
// 6. STORY BIBLE & EXPORT
// ==========================================================================
function bukaBibleList() {
    document.getElementById('story-detail-screen').classList.add('hidden');
    const detailScreen = document.getElementById('story-detail-screen');
    const bibleScreen = document.getElementById('bible-screen');
    
    bibleScreen.classList.remove('hidden');
    bibleScreen.dataset.activeStoryId = detailScreen.dataset.activeStoryId;
    muatDaftarBible();
}

function muatDaftarBible() {
    const storyId = Number(document.getElementById('bible-screen').dataset.activeStoryId);
    const container = document.getElementById('bible-container');
    container.innerHTML = '';

    const transaction = db.transaction(['story_bible'], 'readonly');
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
    const storyId = Number(document.getElementById('bible-screen').dataset.activeStoryId);
    const editorScreen = document.getElementById('bible-editor-screen');
    const bibleId = editorScreen.dataset.activeBibleId;
    
    const kategori = document.getElementById('bible-category').value;
    const nama = document.getElementById('bible-entry-title').value;
    const deskripsi = document.getElementById('bible-entry-content').value;

    if (!nama.trim()) { alert("Nama tidak boleh kosong!"); return; }

    const transaction = db.transaction(['story_bible'], 'readwrite');
    const store = transaction.objectStore('story_bible');

    const dataBaru = { storyId, kategori, nama, deskripsi, terakhirDiubah: new Date().toISOString() };
    if (bibleId) {
        dataBaru.id = Number(bibleId);
        store.put(dataBaru).onsuccess = () => { tutupBibleEditor(); muatDaftarBible(); };
    } else {
        store.add(dataBaru).onsuccess = () => { tutupBibleEditor(); muatDaftarBible(); };
    }
}

function exportCeritaKeTXT() {
    const detailScreen = document.getElementById('story-detail-screen');
    const storyId = Number(detailScreen.dataset.activeStoryId);
    const judulCerita = document.getElementById('detail-story-title').innerText;

    const transaction = db.transaction(['chapters'], 'readonly');
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
// 7. SEMUA EVENT LISTENER
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
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

    // Auto-Save Editor
    const areaKetikan = document.getElementById('chapter-content');
    const areaJudul = document.getElementById('chapter-title');
    const tombolSimpan = document.getElementById('btn-save');

    if (areaKetikan) areaKetikan.addEventListener('keyup', () => {
        hitungKata();
        clearTimeout(waktuKetik);
        waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
    });

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
            const storyId = Number(document.getElementById('story-detail-screen').dataset.activeStoryId);
            const statusBaru = e.target.value;
            const transaction = db.transaction(['stories'], 'readwrite');
            const store = transaction.objectStore('stories');
            
            store.get(storyId).onsuccess = function(event) {
                const dataCerita = event.target.result;
                if (dataCerita) {
                    dataCerita.status = statusBaru;
                    store.put(dataCerita).onsuccess = () => {
                        statusDropdown.style.color = '#4cd964';
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
