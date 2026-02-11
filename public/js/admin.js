import { fetchJson, imageOrPlaceholder } from './utils.js';

const loginShell = document.getElementById('login-shell');
const uploadShell = document.getElementById('upload-shell');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const uploadForm = document.getElementById('upload-form');
const uploadStatus = document.getElementById('upload-status');
const profileForm = document.getElementById('profile-form');
const profileStatus = document.getElementById('profile-status');
const profilePreview = document.getElementById('profile-preview');
const logoutBtn = document.getElementById('logout-btn');

const dateTakenInput = uploadForm?.querySelector('input[name="dateTaken"]');
const seasonInput = uploadForm?.querySelector('select[name="season"]');
const yearInput = uploadForm?.querySelector('input[name="year"]');

function setStatus(element, message, type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `status${type ? ` ${type}` : ''}`;
}

function updateProfilePreview(profile) {
  if (!profilePreview) return;

  const label = profile?.displayName || 'Photographer';
  profilePreview.src = imageOrPlaceholder(profile?.imageUrl, label);
  profilePreview.alt = `${label} portrait preview`;
}

async function loadProfile() {
  if (!profileForm) {
    return;
  }

  const profile = await fetchJson('/api/profile');
  profileForm.querySelector('input[name="displayName"]').value = profile.displayName || '';
  profileForm.querySelector('textarea[name="about"]').value = profile.about || '';
  updateProfilePreview(profile);
}

async function refreshAuthState() {
  const me = await fetchJson('/api/me');
  const authed = Boolean(me.authenticated);
  loginShell.hidden = authed;
  uploadShell.hidden = !authed;

  if (authed) {
    await loadProfile();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.getElementById('admin-password').value;

  try {
    await fetchJson('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    setStatus(loginStatus, 'Logged in.', 'success');
    loginForm.reset();
    await refreshAuthState();
  } catch (error) {
    const extra =
      error.message === 'Invalid password.'
        ? ' Check .env ADMIN_PASSWORD value and restart the server after changing it.'
        : '';
    setStatus(loginStatus, `${error.message}${extra}`, 'error');
  }
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);

  try {
    const photo = await fetchJson('/api/photos', {
      method: 'POST',
      body: formData
    });
    uploadForm.reset();
    setStatus(uploadStatus, `Uploaded: ${photo.title}`, 'success');
  } catch (error) {
    setStatus(uploadStatus, error.message, 'error');
  }
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);

  try {
    const profile = await fetchJson('/api/profile', {
      method: 'POST',
      body: formData
    });

    profileForm.querySelector('input[name="profilePhoto"]').value = '';
    updateProfilePreview(profile);
    setStatus(profileStatus, 'Profile updated.', 'success');
  } catch (error) {
    setStatus(profileStatus, error.message, 'error');
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
    await refreshAuthState();
  } catch (error) {
    setStatus(uploadStatus, error.message, 'error');
  }
});

if (yearInput) {
  yearInput.value = String(new Date().getFullYear());
}

if (dateTakenInput && seasonInput && yearInput) {
  dateTakenInput.addEventListener('change', () => {
    const date = new Date(dateTakenInput.value);
    if (Number.isNaN(date.valueOf())) return;
    const month = date.getMonth() + 1;

    if (month >= 3 && month <= 5) seasonInput.value = 'spring';
    else if (month >= 6 && month <= 8) seasonInput.value = 'summer';
    else if (month >= 9 && month <= 11) seasonInput.value = 'autumn';
    else seasonInput.value = 'winter';

    yearInput.value = String(date.getFullYear());
  });
}

refreshAuthState().catch((error) => {
  setStatus(loginStatus, error.message, 'error');
});
