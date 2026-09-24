const gallery = document.querySelector('#gallery');
const total = document.querySelector('#total');
const message = document.querySelector('#message');
const pagination = document.querySelector('#pagination');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const pageInfo = document.querySelector('#page-info');
const modal = document.querySelector('#modal');
const confirmModal = document.querySelector('#confirm-modal');
let currentPage = 1, paginationData = null, pendingDelete = null;
document.querySelector('#refresh').addEventListener('click', () => loadPhotos(1));
previous.addEventListener('click', () => loadPhotos(currentPage - 1));
next.addEventListener('click', () => loadPhotos(currentPage + 1));
document.querySelector('#close-modal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.querySelector('#cancel-delete').addEventListener('click', () => confirmModal.hidden = true);
document.querySelector('#confirm-delete').addEventListener('click', deletePhoto);
document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeModal(); confirmModal.hidden = true; } });

async function loadPhotos(page) {
  message.className = 'message'; message.textContent = 'Loading photos…';
  try { const response = await fetch(`/api/photos?page=${page}&limit=30`); const result = await response.json(); if (!response.ok) throw new Error(result.error); currentPage = result.pagination.page; paginationData = result.pagination; render(result.data); total.textContent = `Total Images: ${result.pagination.total.toLocaleString()}`; pageInfo.textContent = `Page ${currentPage} of ${result.pagination.totalPages}`; previous.disabled = currentPage <= 1; next.disabled = currentPage >= result.pagination.totalPages; pagination.hidden = result.pagination.total === 0; message.textContent = ''; } catch (error) { message.className = 'message error'; message.textContent = error.message || 'Unable to load photos.'; }
}
function render(photos) {
  gallery.replaceChildren();
  if (!photos.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No photos have been uploaded yet.'; gallery.append(empty); return; }
  photos.forEach(photo => {
    const card = document.createElement('article'); card.className = 'photo-card';
    const image = document.createElement('img'); image.src = photo.url; image.alt = photo.originalName || 'Uploaded photo'; image.loading = 'lazy'; image.addEventListener('click', () => showPreview(photo)); card.append(image);
    const details = document.createElement('div'); details.className = 'details';
    const title = document.createElement('h2'); title.textContent = photo.originalName || 'Unnamed photo'; const stored = document.createElement('p'); stored.textContent = photo.filename; const info = document.createElement('p'); info.textContent = `${formatBytes(photo.size)} · ${new Date(photo.uploadedAt).toLocaleString()}`;
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const view = button('View', () => showPreview(photo)); const download = document.createElement('a'); download.textContent = 'Download'; download.href = `/api/photos/${encodeURIComponent(photo.filename)}/download`; const remove = button('Delete', () => { closeModal(); pendingDelete = photo; confirmModal.hidden = false; }); remove.className = 'delete';
    actions.append(view, download, remove); details.append(title, stored, info, actions); card.append(details); gallery.append(card);
  });
}
function button(label, handler) { const value = document.createElement('button'); value.type = 'button'; value.textContent = label; value.addEventListener('click', handler); return value; }
function formatBytes(bytes) { if (!bytes) return '0 B'; const units = ['B','KB','MB','GB']; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
function showPreview(photo) { document.querySelector('#modal-image').src = photo.url; document.querySelector('#modal-image').alt = photo.originalName || 'Uploaded photo'; document.querySelector('#modal-title').textContent = photo.originalName || photo.filename; document.querySelector('#modal-meta').textContent = `${formatBytes(photo.size)} · ${new Date(photo.uploadedAt).toLocaleString()}`; document.querySelector('#modal-download').href = `/api/photos/${encodeURIComponent(photo.filename)}/download`; modal.hidden = false; }
function closeModal() { modal.hidden = true; document.querySelector('#modal-image').removeAttribute('src'); }
async function deletePhoto() { if (!pendingDelete) return; const photo = pendingDelete; confirmModal.hidden = true; pendingDelete = null; try { const response = await fetch(`/api/photos/${encodeURIComponent(photo.filename)}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await loadPhotos(currentPage); } catch (error) { message.className = 'message error'; message.textContent = error.message || 'Unable to delete photo.'; } }
loadPhotos(currentPage);
