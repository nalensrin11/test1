const input = document.querySelector('#photo-input');
const importButton = document.querySelector('#import-button');
const statusEl = document.querySelector('#status');
const progressArea = document.querySelector('#progress-area');
const progressBar = document.querySelector('#progress-bar');
const progressText = document.querySelector('#progress-text');
const percentage = document.querySelector('#percentage');
const retryButton = document.querySelector('#retry-button');
let failedFiles = [];

importButton.addEventListener('click', () => input.click());
input.addEventListener('change', () => { if (input.files.length) uploadFiles([...input.files]); });
retryButton.addEventListener('click', () => uploadFiles(failedFiles));

async function uploadFiles(files) {
  failedFiles = []; retryButton.hidden = true; importButton.disabled = true;
  progressArea.hidden = false; statusEl.className = 'status';
  let done = 0; let successful = 0;
  const update = () => { const value = Math.round(done / files.length * 100); progressBar.style.width = `${value}%`; percentage.textContent = `${value}%`; progressBar.parentElement.setAttribute('aria-valuenow', value); progressText.textContent = `${done} / ${files.length} processed`; };
  statusEl.textContent = `${files.length} photo${files.length === 1 ? '' : 's'} selected. Uploading…`; update();
  const queue = [...files];
  async function worker() { while (queue.length) { const file = queue.shift(); try { await sendFile(file); successful++; } catch { failedFiles.push(file); } finally { done++; update(); } } }
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  importButton.disabled = false; input.value = '';
  if (failedFiles.length) { statusEl.className = 'status error'; statusEl.textContent = `Upload completed. Successful: ${successful}. Failed: ${failedFiles.length}.`; retryButton.hidden = false; }
  else { statusEl.className = 'status success'; statusEl.textContent = `Upload complete — ${successful} photo${successful === 1 ? '' : 's'} uploaded successfully.`; importButton.textContent = 'Import More Photos'; }
}
function sendFile(file) { const form = new FormData(); form.append('photos', file); return fetch('/api/photos', { method: 'POST', body: form }).then(async response => { if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Upload failed'); }); }
