// ==========================================================================
// 1. INISIALISASI DATABASE LOCAL-FIRST (IndexedDB)
// ==========================================================================
const DB_NAME = 'WriterPWADB';
const DB_VERSION = 1;
let db;

const request = indexedDB.open(DB_NAME, DB_VERSION);

// Membuat tabel/store saat database pertama kali diinisialisasi
request.onupgradeneeded = function(event) {
    const dbInstance = event.target.result;
    
    // Store untuk data Cerita Utama (Judul, Sinopsis, Status, Tag)
    if (!dbInstance.objectStoreNames.contains('stories')) {
        dbInstance.createObjectStore('stories', { keyPath: 'id', autoIncrement: true });
    }
    
    // Store untuk Chapter Cerita
    if (!dbInstance.objectStoreNames.contains('chapters')) {
        dbInstance.createObjectStore('chapters', { keyPath: 'id', autoIncrement: true });
    }
    
    // Store untuk Modul Story Bible (Karakter, Dunia, Dinamika)
    if (!dbInstance.objectStoreNames.contains('story_bible')) {
        dbInstance.createObjectStore('story_bible', { keyPath: 'id', autoIncrement: true });
    }
    
    console.log("Database IndexedDB berhasil disiapkan.");
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("Database berhasil dibuka.");
    // Setelah database siap, kita bisa memuat data ke dashboard
    loadDashboardData();
};

request.onerror = function(event) {
    console.error("Gagal membuka database lokal:", event.target.error);
};

// ==========================================================================
// 2. LOGIKA OPERASI DATA (Fungsi Inti)
// ==========================================================================

// Fungsi mendasar untuk menambah cerita baru
function tambahCerita(judul, sinopsis, tag, status = 'Draft') {
    const transaction = db.transaction(['stories'], 'readwrite');
    const store = transaction.objectStore('stories');
    
    const ceritaBaru = {
        judul: judul,
        sinopsis: sinopsis,
        tag: tag,
        status: status, // Draft, Editing, Complete, Published
        createdAt: new Date().toISOString()
    };
    
    const requestAdd = store.add(ceritaBaru);
    
    requestAdd.onsuccess = function() {
        console.log("Cerita baru berhasil disimpan ke penyimpanan lokal!");
        loadDashboardData(); // Refresh tampilan dashboard
    };
    
    requestAdd.onerror = function() {
        console.error("Gagal menyimpan cerita.");
    };
}

// Fungsi simulasi untuk mengambil dan menghitung data di Dashboard
function loadDashboardData() {
    if (!db) return;

    const transaction = db.transaction(['stories'], 'readonly');
    const store = transaction.objectStore('stories');
    const getAllRequest = store.getAll();

getAllRequest.onsuccess = function(event) {
        const semuaCerita = event.target.result;
        
        // Logika Kalkulasi Indikator Dashboard
        let hitungDraft = 0;
        let hitungEditing = 0;
        let hitungPublished = 0;

        semuaCerita.forEach(cerita => {
            if (cerita.status.toLowerCase() === 'draft') hitungDraft++;
            if (cerita.status.toLowerCase() === 'editing') hitungEditing++;
            if (cerita.status.toLowerCase() === 'published') hitungPublished++;
        });

        // EKSEKUSI DOM: Memasukkan hasil hitungan ke dalam HTML
        const elDraft = document.getElementById('count-draft');
        const elEditing = document.getElementById('count-editing');
        const elPublished = document.getElementById('count-published');
        
        if(elDraft) elDraft.innerText = hitungDraft;
        if(elEditing) elEditing.innerText = hitungEditing;
        if(elPublished) elPublished.innerText = hitungPublished;
        
        // Targetkan area daftar cerita di HTML
        const projectList = document.querySelector('.project-list');
        
        // Bersihkan data dummy, sisakan hanya Judul Section
        projectList.innerHTML = '<h2>Proyek Aktif</h2>';
        
        // Jika database masih kosong
        if (semuaCerita.length === 0) {
            projectList.innerHTML += '<p style="color: #888; font-size: 0.9rem; text-align: center; margin-top: 20px;">Belum ada cerita. Klik tombol di bawah untuk mulai.</p>';
            return;
        }

        // Render data asli dari IndexedDB
        semuaCerita.forEach(cerita => {
            const card = document.createElement('div');
            card.className = 'focus-block project-card';
            card.style.cursor = 'pointer'; // Mengubah kursor jadi telunjuk agar terasa bisa diklik
            
           // SEBELUMNYA: card.onclick = () => { bukaEditor(cerita); };
            // GANTI MENJADI:
            card.onclick = () => {
                bukaDetailCerita(cerita);
            };

            // Status warna badge dinamis
            const statusClass = cerita.status.toLowerCase() === 'editing' ? 'badge-editing' : 'badge-draft';

            card.innerHTML = `
                <h3>${cerita.judul}</h3>
                <p class="meta-data">${cerita.sinopsis.substring(0, 30)}... | Tag: ${cerita.tag}</p>
                <span class="badge ${statusClass}">${cerita.status}</span>
            `;
            
            projectList.appendChild(card);
        });
    };
}

// ==========================================================================
// 3. INTERAKSI UI & MANIPULASI DOM
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnTulis = document.querySelector('.fab-action');
    
    if (btnTulis) {
        btnTulis.addEventListener('click', () => {
            // Logika interaksi: Sesuai panduan One UI, aksi ini memicu transisi halaman atau dialog pop-up.
            // Untuk pengujian awal, kita gunakan prompt browser bawaan terlebih dahulu.
            const judulInput = prompt("Masukkan Judul Cerita:");
            if (!judulInput) return;
            
            const sinopsisInput = prompt("Masukkan Sinopsis Singkat:");
            const tagInput = prompt("Masukkan Tag (Contoh: Misteri, Sci-Fi):");
            
            // Eksekusi penyimpanan ke IndexedDB
            tambahCerita(judulInput, sinopsisInput, tagInput, 'Draft');
        });
    }
});

// ==========================================================================
// 4. REGISTRASI SERVICE WORKER (Syarat Wajib PWA agar bisa Offline)
// ==========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker berhasil didaftarkan!', reg.scope))
            .catch(err => console.error('Pendaftaran Service Worker gagal:', err));
    });
}

// ==========================================================================
// 5. ARSITEKTUR NAVIGASI (SPA Routing)
// ==========================================================================

// Membuka halaman detail cerita dan mengambil daftar chapter dari DB
function bukaDetailCerita(cerita) {
    // Sembunyikan Dashboard
    document.querySelector('.viewing-area').classList.add('hidden');
    document.querySelector('.interaction-area').classList.add('hidden');
    document.querySelector('.fab-action').classList.add('hidden');
    
    // Tampilkan Halaman Detail
    const detailScreen = document.getElementById('story-detail-screen');
    detailScreen.classList.remove('hidden');
    detailScreen.dataset.activeStoryId = cerita.id;
    
    // Set Data Cerita
    document.getElementById('detail-story-title').innerText = cerita.judul;
    document.getElementById('detail-story-synopsis').innerText = cerita.sinopsis;
    
    // Muat daftar chapter milik cerita ini
    muatDaftarChapter(cerita.id);
}

function muatDaftarChapter(storyId) {
    const transaction = db.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    const container = document.getElementById('chapters-container');
    container.innerHTML = ''; // Bersihkan kontainer

    store.getAll().onsuccess = function(event) {
        const semuaChapter = event.target.result;
        // Filter hanya chapter yang memiliki storyId cocok dengan cerita aktif
        const chapterCeritaIni = semuaChapter.filter(ch => ch.storyId === Number(storyId));

        if (chapterCeritaIni.length === 0) {
            container.innerHTML = '<p style="color:#666; font-size:0.9rem; text-align:center; margin-top:20px;">Belum ada chapter. Klik "+ Bab Baru" untuk mulai menulis.</p>';
            return;
        }

        chapterCeritaIni.forEach(ch => {
            const chCard = document.createElement('div');
            chCard.className = 'chapter-card';
            chCard.onclick = () => bukaEditor(storyId, ch); // Buka editor dengan data chapter lama
            
            chCard.innerHTML = `
                <h4>${ch.judulChapter}</h4>
                <span>Terakhir diubah: ${new Date(ch.terakhirDiubah).toLocaleDateString('id-ID')}</span>
            `;
            container.appendChild(chCard);
        });
    };
}

// Fungsi Buka Editor (Modifikasi: Menerima Mode Baru maupun Edit)
function bukaEditor(storyId, dataChapter = null) {
    document.getElementById('story-detail-screen').classList.add('hidden');
    
    const editorScreen = document.getElementById('editor-screen');
    editorScreen.classList.remove('hidden');
    editorScreen.dataset.activeStoryId = storyId;
    
    if (dataChapter) {
        // Mode Edit Chapter Lama
        editorScreen.dataset.activeChapterId = dataChapter.id;
        document.getElementById('editor-title').innerText = "Edit Chapter";
        document.getElementById('chapter-title').value = dataChapter.judulChapter;
        document.getElementById('chapter-content').value = dataChapter.isi;
    } else {
        // Mode Tulis Chapter Baru
        delete editorScreen.dataset.activeChapterId;
        document.getElementById('editor-title').innerText = "Chapter Baru";
        document.getElementById('chapter-title').value = '';
        document.getElementById('chapter-content').value = '';
    }
    
    // Panggil penghitung kata saat editor baru saja dibuka
    hitungKata();
}

function kembaliKeDashboard() {
    document.getElementById('story-detail-screen').classList.add('hidden');
    document.querySelector('.viewing-area').classList.remove('hidden');
    document.querySelector('.interaction-area').classList.remove('hidden');
    document.querySelector('.fab-action').classList.remove('hidden');
    loadDashboardData(); // Refresh data dashboard
}

// Tambahan Modifikasi pada fungsi tutupEditor agar kembali ke Detail Cerita, bukan Dashboard
function tutupEditor() {
    // Membungkus navigasi ke dalam fungsi Callback
    simpanDraftChapter(() => {
        const editorScreen = document.getElementById('editor-screen');
        const storyId = editorScreen.dataset.activeStoryId;
        
        // 1. Sembunyikan layar Editor
        editorScreen.classList.add('hidden');
        
        // Reset memori chapter aktif
        delete editorScreen.dataset.activeChapterId; 
        
        // 2. Cari data cerita saat ini untuk dikembalikan ke layar detail
        const transaction = db.transaction(['stories'], 'readonly');
        transaction.objectStore('stories').get(Number(storyId)).onsuccess = function(event) {
            bukaDetailCerita(event.target.result);
        };
    });
}

// ==========================================================================
// 6. ARSITEKTUR EDITOR & AUTO-SAVE (Debounce)
// ==========================================================================

let waktuKetik;
const JEDA_SIMPAN = 2000; // 2000 milidetik (2 detik)

// Fungsi utama untuk menyimpan data ke IndexedDB
function simpanDraftChapter(callback = null) {
    const editorScreen = document.getElementById('editor-screen');
    const storyId = Number(editorScreen.dataset.activeStoryId);
    let chapterId = editorScreen.dataset.activeChapterId; 
    
    const judulChapter = document.getElementById('chapter-title').value;
    const isiKonten = document.getElementById('chapter-content').value;

    // Jika teks kosong, batalkan simpan dan langsung jalankan callback (kembali)
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
        request = store.put(dataChapter); // Update
    } else {
        request = store.add(dataChapter); // Insert Baru
    }

    request.onsuccess = (event) => {
        if (!chapterId) {
            editorScreen.dataset.activeChapterId = event.target.result; 
        }
        indikatorTersimpan();
        
        // PENTING: Mengeksekusi navigasi hanya SETELAH data sukses disimpan
        if (typeof callback === 'function') callback();
    };
}

// Fungsi memberikan efek visual saat tulisan berhasil disimpan
function indikatorTersimpan() {
    const btnSave = document.getElementById('btn-save');
    const teksAsli = btnSave.innerText;
    
    btnSave.innerText = 'Tersimpan ✓';
    btnSave.style.color = '#4cd964'; // Warna hijau khas sukses

    // Kembalikan tombol ke tulisan 'Simpan' setelah 3 detik
    setTimeout(() => {
        btnSave.innerText = 'Simpan';
        btnSave.style.color = '#007aff';
    }, 3000);
}

// Registrasi Event Listener (Sensor Ketikan & Tombol Simpan Manual)
document.addEventListener('DOMContentLoaded', () => {
    const areaKetikan = document.getElementById('chapter-content');
    const areaJudul = document.getElementById('chapter-title');
    const tombolSimpan = document.getElementById('btn-save');

    // Memicu Auto-Save saat berhenti mengetik di area teks utama
    areaKetikan.addEventListener('keyup', () => {
        clearTimeout(waktuKetik);
        waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
    });

    // Memicu Auto-Save saat berhenti mengetik di area judul chapter
    areaJudul.addEventListener('keyup', () => {
        clearTimeout(waktuKetik);
        waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
    });

    // Memicu Simpan Manual jika tombol "Simpan" diklik
    if (tombolSimpan) {
        tombolSimpan.addEventListener('click', () => {
            clearTimeout(waktuKetik); // Batalkan auto-save agar tidak terjadi simpan ganda
            simpanDraftChapter();
        });
    }
});

// Fungsi untuk menghitung kata secara real-time
function hitungKata() {
    const teks = document.getElementById('chapter-content').value;
    
    // Menghapus spasi berlebih di awal/akhir dan memecah kalimat berdasarkan spasi/enter
    const arrayKata = teks.trim().split(/\s+/);
    
    // Jika teks kosong, hitung 0. Jika tidak, hitung panjang array-nya
    const jumlahKata = teks.trim() === '' ? 0 : arrayKata.length;
    
    document.getElementById('word-count').innerText = `${jumlahKata} Kata`;
}
// ==========================================================================
// 9. ARSITEKTUR STORY BIBLE
// ==========================================================================

function bukaBibleList() {
    // Sembunyikan layar detail cerita
    document.getElementById('story-detail-screen').classList.add('hidden');
    
    // Tampilkan layar daftar Bible
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
            container.innerHTML = '<p style="color:#666; text-align:center; margin-top:30px;">Belum ada data. Klik "+ Entri" untuk menambah karakter atau referensi.</p>';
            return;
        }

        bibleCeritaIni.forEach(bible => {
            const card = document.createElement('div');
            card.className = 'bible-card';
            
            // Klik untuk mengedit (opsional, bisa dikembangkan nanti)
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
        // Mode Edit
        editorScreen.dataset.activeBibleId = dataBible.id;
        document.getElementById('bible-editor-title').innerText = "Edit Entri";
        document.getElementById('bible-category').value = dataBible.kategori;
        document.getElementById('bible-entry-title').value = dataBible.nama;
        document.getElementById('bible-entry-content').value = dataBible.deskripsi;
    } else {
        // Mode Baru
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

    if (!nama.trim()) {
        alert("Nama entri tidak boleh kosong!");
        return;
    }

    const transaction = db.transaction(['story_bible'], 'readwrite');
    const store = transaction.objectStore('story_bible');

    const dataBaru = {
        storyId: storyId,
        kategori: kategori,
        nama: nama,
        deskripsi: deskripsi,
        terakhirDiubah: new Date().toISOString()
    };

    let request;
    if (bibleId) {
        dataBaru.id = Number(bibleId);
        request = store.put(dataBaru);
    } else {
        request = store.add(dataBaru);
    }

    request.onsuccess = () => {
        tutupBibleEditor();
        muatDaftarBible(); // Refresh daftar saat kembali
    };
}
// ==========================================================================
// 7. REGISTRASI SEMUA TOMBOL (Event Listeners)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Tombol Kembali dari Editor ke Detail Cerita
    const btnBackEditor = document.getElementById('btn-back');
    if (btnBackEditor) {
        btnBackEditor.addEventListener('click', tutupEditor);
    }

    // 2. Tombol Kembali dari Detail Cerita ke Dashboard
    const btnBackDashboard = document.getElementById('btn-back-dashboard');
    if (btnBackDashboard) {
        btnBackDashboard.addEventListener('click', kembaliKeDashboard);
    }
    
    // 3. Tombol Buat Bab Baru di Halaman Detail
    const btnNewChapter = document.getElementById('btn-new-chapter');
    if (btnNewChapter) {
        btnNewChapter.addEventListener('click', () => {
            const storyId = document.getElementById('story-detail-screen').dataset.activeStoryId;
            bukaEditor(storyId, null);
        });
        
    }

    // 4. Pastikan fungsi auto-save juga tetap berjalan
    const areaKetikan = document.getElementById('chapter-content');
    const areaJudul = document.getElementById('chapter-title');
    const tombolSimpan = document.getElementById('btn-save');

    if (areaKetikan) {
        areaKetikan.addEventListener('keyup', () => {
            hitungKata();
            clearTimeout(waktuKetik);
            waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
        });
    }

    if (areaJudul) {
        areaJudul.addEventListener('keyup', () => {
            clearTimeout(waktuKetik);
            waktuKetik = setTimeout(simpanDraftChapter, JEDA_SIMPAN);
        });
    }

    if (tombolSimpan) {
        tombolSimpan.addEventListener('click', () => {
            clearTimeout(waktuKetik);
            simpanDraftChapter();
        });
    }
    // (Tambahkan di dalam blok document.addEventListener('DOMContentLoaded', ...) )
    
    // 5. Tombol Export TXT
    const btnExport = document.getElementById('btn-export-txt');
    if (btnExport) {
        btnExport.addEventListener('click', exportCeritaKeTXT);
    }
    // (Tambahkan di dalam blok document.addEventListener('DOMContentLoaded', ...) )
    
    // 6. Navigasi Story Bible
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

// ==========================================================================
// 8. ARSITEKTUR EXPORT & BACKUP
// ==========================================================================
function exportCeritaKeTXT() {
    const detailScreen = document.getElementById('story-detail-screen');
    const storyId = Number(detailScreen.dataset.activeStoryId);
    const judulCerita = document.getElementById('detail-story-title').innerText;

    const transaction = db.transaction(['chapters'], 'readonly');
    const store = transaction.objectStore('chapters');
    
    store.getAll().onsuccess = function(event) {
        const semuaChapter = event.target.result;
        // Ambil hanya chapter dari cerita yang sedang dibuka
        const chapterCeritaIni = semuaChapter.filter(ch => ch.storyId === storyId);

        if (chapterCeritaIni.length === 0) {
            alert("Belum ada teks untuk diekspor!");
            return;
        }

        // Susun format teksnya
        let kontenExport = `=========================================\n`;
        kontenExport += `JUDUL: ${judulCerita.toUpperCase()}\n`;
        kontenExport += `Di-export pada: ${new Date().toLocaleString('id-ID')}\n`;
        kontenExport += `=========================================\n\n`;

        chapterCeritaIni.forEach((ch, index) => {
            kontenExport += `\n--- ${ch.judulChapter.toUpperCase()} ---\n\n`;
            kontenExport += `${ch.isi}\n\n`;
        });

        // Konversi string menjadi file fisik (Blob)
        const blob = new Blob([kontenExport], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        // Buat link rahasia untuk memicu download otomatis
        const elemenDownload = document.createElement('a');
        elemenDownload.href = url;
        elemenDownload.download = `${judulCerita.replace(/\s+/g, '_')}_Backup.txt`; // Ganti spasi jadi underscore untuk nama file
        
        document.body.appendChild(elemenDownload);
        elemenDownload.click();
        
        // Bersihkan memori setelah berhasil download
        document.body.removeChild(elemenDownload);
        URL.revokeObjectURL(url);
    };
}

