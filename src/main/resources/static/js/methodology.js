const Methodology = (() => {

  const ALLOWED_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]);

  const DOM = {
    list: () => document.getElementById('bookList'),
    title: () => document.getElementById('bookTitle'),
    author: () => document.getElementById('bookAuthor'),
    file: () => document.getElementById('bookFile'),
    saveBtn: () => document.getElementById('saveBookBtn'),
    adminPanel: () => document.getElementById('adminPanel'),
    loginBtn: () => document.getElementById('loginBtn'),
    logoutBtn: () => document.getElementById('logoutBtn'),
    loginModal: () => document.getElementById('loginModal'),
    loginModalClose: () => document.getElementById('loginModalClose'),
    loginCancel: () => document.getElementById('loginCancel'),
    loginSubmit: () => document.getElementById('loginSubmit'),
    loginUsername: () => document.getElementById('loginUsername'),
    loginPassword: () => document.getElementById('loginPassword'),
    loginError: () => document.getElementById('loginError'),
    adminName: () => document.getElementById('adminName'),
    accessModal: () => document.getElementById('accessModal'),
    accessInput: () => document.getElementById('accessCodeInput'),
    accessError: () => document.getElementById('accessError'),
    accessSubmit: () => document.getElementById('accessSubmit'),
    accessCancel: () => document.getElementById('accessCancel')
  };

  let books = [];
  let token = null;
  let username = null;
  // Kitab icazəsi serverin verdiyi HttpOnly cookie-dədir; kod brauzerdə saxlanmır və URL-ə yazılmır.
  let hasAccess = false;

  async function loadBooks() {
    try {
      const res = await fetch('/api/books', { credentials: 'same-origin' });
      if (res.status === 403) {
        hasAccess = false;
        DOM.list().innerHTML = '<p class="text-muted">Kitabları görmək üçün giriş kodunu daxil edin.</p>';
        openAccessModal();
        return;
      }
      hasAccess = true;
      if (!res.ok) {
        DOM.list().innerHTML = '<p class="text-muted">Server xətası.</p>';
        return;
      }
      books = await res.json();
      renderBooks();
    } catch (err) {
      DOM.list().innerHTML = '<p class="text-muted">Serverə qoşulmaq mümkün olmadı.</p>';
    }
  }

  function openAccessModal() {
    DOM.accessInput().value = '';
    DOM.accessError().style.display = 'none';
    DOM.accessModal().style.display = 'flex';
    setTimeout(() => DOM.accessInput().focus(), 100);
  }

  function closeAccessModal() {
    DOM.accessModal().style.display = 'none';
  }

  function showAccessError(msg) {
    DOM.accessError().textContent = msg;
    DOM.accessError().style.display = 'block';
  }

  async function handleAccessSubmit() {
    const code = DOM.accessInput().value.trim();
    if (!code) {
      showAccessError('Kodu daxil edin!');
      return;
    }
    try {
      const res = await fetch('/api/books/access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      DOM.accessInput().value = '';
      if (res.status === 429) {
        showAccessError('Çox səhv cəhd edildi. 15 dəqiqə sonra yenidən yoxlayın.');
        return;
      }
      if (!res.ok) {
        showAccessError('Kod yanlışdır.');
        return;
      }
      closeAccessModal();
      loadBooks();
    } catch (err) {
      showAccessError('Serverə qoşulmaq mümkün olmadı.');
    }
  }

  function renderBooks() {
    if (!books.length) {
      DOM.list().innerHTML = '<p class="text-muted">Hələ heç bir kitab əlavə edilməyib.</p>';
      return;
    }

    let html = '';
    for (const b of books) {
      html += `
        <div class="book-item">
          <div class="book-item-main">
            <div class="book-info">
              <h4>${escapeHtml(b.title)}</h4>
              <div class="book-author">${escapeHtml(b.author || 'Müəllif göstərilməyib')}</div>
              <div class="book-preview">${fileIcon(b.fileName)} ${escapeHtml(b.fileName)}</div>
            </div>
            <div class="book-actions">
              <a class="btn btn-sm btn-outline" href="/api/books/${b.id}/file" target="_blank" rel="noopener">Bax</a>
              <a class="btn btn-sm btn-outline" href="/api/books/${b.id}/file?download=1" download="${escapeHtml(b.fileName)}">Yüklə</a>
              ${token ? `<button class="btn btn-sm btn-outline" data-action="delete" data-id="${b.id}" style="color:var(--danger);border-color:var(--danger)">Sil</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }
    DOM.list().innerHTML = html;
  }

  function extOf(fileName) {
    const i = fileName.lastIndexOf('.');
    return i === -1 ? '' : fileName.slice(i + 1).toLowerCase();
  }

  function fileIcon(fileName) {
    const ext = extOf(fileName);
    if (ext === 'pdf') return '📄';
    if (ext === 'doc' || ext === 'docx') return '📝';
    if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return '🖼️';
    return '📎';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function setAdminMode(user, tk) {
    username = user;
    token = tk;
    if (token) {
      DOM.adminPanel().style.display = 'block';
      DOM.loginBtn().textContent = username;
      DOM.loginBtn().style.borderColor = 'var(--success)';
      DOM.loginBtn().style.color = 'var(--success)';
      DOM.adminName().textContent = '👤 ' + username;
    } else {
      DOM.adminPanel().style.display = 'none';
      DOM.loginBtn().textContent = 'Daxil ol';
      DOM.loginBtn().style.borderColor = '';
      DOM.loginBtn().style.color = '';
    }
    renderBooks();
  }

  async function saveBook() {
    const title = DOM.title().value.trim();
    const author = DOM.author().value.trim();
    const file = DOM.file().files[0];

    if (!title) {
      alert('Kitab adı daxil edilməlidir!');
      return;
    }
    if (!file) {
      alert('Fayl seçilməlidir!');
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      alert('Yalnız PDF, Word (.doc/.docx) və şəkil (.jpg/.png) faylları qəbul olunur!');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('author', author);
    formData.append('file', file);

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Authorization': token },
        body: formData
      });
      if (res.status === 401) {
        alert('Sessiya bitmişdir. Yenidən daxil olun.');
        setAdminMode(null, null);
        return;
      }
      if (res.ok) {
        DOM.title().value = '';
        DOM.author().value = '';
        DOM.file().value = '';
        await loadBooks();
      } else {
        alert('Xəta baş verdi: ' + res.status);
      }
    } catch (err) {
      alert('Serverə qoşulmaq mümkün olmadı.');
    }
  }

  async function deleteBook(id) {
    if (!confirm('Bu kitabı silmək istədiyinizə əminsiniz?')) return;
    try {
      const res = await fetch('/api/books/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': token }
      });
      if (res.status === 401) {
        alert('Sessiya bitmişdir. Yenidən daxil olun.');
        setAdminMode(null, null);
        return;
      }
      if (res.ok) {
        await loadBooks();
      }
    } catch (err) {
      alert('Silinərkən xəta baş verdi.');
    }
  }

  function handleListClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'delete') {
      deleteBook(parseInt(btn.dataset.id, 10));
    }
  }

  function openLoginModal() {
    DOM.loginUsername().value = '';
    DOM.loginPassword().value = '';
    DOM.loginError().style.display = 'none';
    DOM.loginModal().style.display = 'flex';
    setTimeout(() => DOM.loginUsername().focus(), 100);
  }

  function closeLoginModal() {
    DOM.loginModal().style.display = 'none';
  }

  async function handleLogin() {
    const user = DOM.loginUsername().value.trim();
    const pass = DOM.loginPassword().value;

    if (!user || !pass) {
      DOM.loginError().textContent = 'İstifadəçi adı və şifrə daxil edin!';
      DOM.loginError().style.display = 'block';
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });

      if (res.ok) {
        const data = await res.json();
        setAdminMode(user, data.token);
        closeLoginModal();
        closeAccessModal();
        loadBooks(); // admin girişi kitab icazəsini də verir
      } else if (res.status === 429) {
        DOM.loginError().textContent = 'Çox səhv cəhd edildi. 15 dəqiqə sonra yenidən yoxlayın.';
        DOM.loginError().style.display = 'block';
      } else if (res.status === 401) {
        DOM.loginError().textContent = 'İstifadəçi adı və ya şifrə yanlışdır.';
        DOM.loginError().style.display = 'block';
      } else {
        DOM.loginError().textContent = 'Server xətası. Yenidən cəhd edin.';
        DOM.loginError().style.display = 'block';
      }
    } catch (err) {
      DOM.loginError().textContent = 'Serverə qoşulmaq mümkün olmadı.';
      DOM.loginError().style.display = 'block';
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (_) {}
    }
    setAdminMode(null, null);
    resetAccess();
  }

  function bindEvents() {
    DOM.saveBtn().addEventListener('click', saveBook);
    DOM.list().addEventListener('click', handleListClick);
    DOM.loginBtn().addEventListener('click', () => { if (token) return; openLoginModal(); });
    DOM.logoutBtn().addEventListener('click', handleLogout);
    DOM.loginModalClose().addEventListener('click', closeLoginModal);
    DOM.loginCancel().addEventListener('click', closeLoginModal);
    DOM.loginSubmit().addEventListener('click', handleLogin);
    DOM.loginModal().addEventListener('click', (e) => { if (e.target === DOM.loginModal()) closeLoginModal(); });

    DOM.loginPassword().addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    DOM.loginUsername().addEventListener('keydown', (e) => {
      if (e.key === 'Enter') DOM.loginPassword().focus();
    });

    DOM.accessSubmit().addEventListener('click', handleAccessSubmit);
    DOM.accessCancel().addEventListener('click', closeAccessModal);
    DOM.accessModal().addEventListener('click', (e) => { if (e.target === DOM.accessModal()) closeAccessModal(); });
    DOM.accessInput().addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAccessSubmit();
    });
  }

  // Kitablar bölməsindən çıxanda həm kitab icazəsi, həm də admin girişi bitir
  function resetAccess() {
    if (hasAccess) {
      hasAccess = false;
      fetch('/api/books/access', { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => {});
    }
    books = [];
    if (token) {
      const oldToken = token;
      fetch('/api/auth/logout', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: oldToken })
      }).catch(() => {});
      setAdminMode(null, null);
      closeLoginModal();
    }
    closeAccessModal();
    DOM.list().innerHTML = '<p class="text-muted">Kitabları görmək üçün giriş kodunu daxil edin.</p>';
  }

  function init() {
    bindEvents();
  }

  return { init, loadBooks, resetAccess };
})();
