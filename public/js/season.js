import { fetchJson, seasonLabel, queryParam, escapeHtml, imageOrPlaceholder } from './utils.js';

const season = (queryParam('season') || '').toLowerCase();
const year = queryParam('year') || '';
const title = document.getElementById('season-title');
const subtitle = document.getElementById('season-subtitle');
const gallery = document.getElementById('gallery');
const empty = document.getElementById('gallery-empty');

const modal = document.getElementById('print-modal');
const printTitle = document.getElementById('print-title');
const printForm = document.getElementById('print-form');
const printStatus = document.getElementById('print-status');
const closeBtn = document.getElementById('print-close');

let targetPhotoId = null;

function applySeasonMood() {
  const seasonClasses = ['season-spring', 'season-summer', 'season-autumn', 'season-winter'];
  document.body.classList.remove(...seasonClasses);
  document.body.classList.add('season-page');

  if (seasonClasses.includes(`season-${season}`)) {
    document.body.classList.add(`season-${season}`);
  }
}

function openModal(photo) {
  targetPhotoId = photo.id;
  printTitle.textContent = `Request Print: ${photo.title}`;
  printStatus.textContent = '';
  printStatus.className = 'status';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  targetPhotoId = null;
  printForm.reset();
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function likeButtonText(photo) {
  const likes = Number(photo.likes || 0);
  return photo.likedByViewer ? `Liked ${likes}` : `Like ${likes}`;
}

function cardTemplate(photo) {
  return `
    <article class="photo-card" data-photo-id="${escapeHtml(photo.id)}">
      <a href="/photo.html?id=${encodeURIComponent(photo.id)}" aria-label="Open ${escapeHtml(photo.title)}">
        <img src="${escapeHtml(imageOrPlaceholder(photo.imageUrl, photo.title))}" alt="${escapeHtml(photo.title)}" loading="lazy" />
      </a>
      <div class="hover-tools">
        <button class="min-btn like-btn${photo.likedByViewer ? ' is-liked' : ''}" type="button" data-id="${escapeHtml(photo.id)}" ${photo.likedByViewer ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(likeButtonText(photo))}</button>
        <button class="min-btn print-btn" type="button" data-id="${escapeHtml(photo.id)}">Request Print</button>
      </div>
      <div class="photo-meta">
        <h3>${escapeHtml(photo.title)}</h3>
        <p>${escapeHtml(photo.location || `${seasonLabel[photo.season]} ${photo.year}`)}</p>
      </div>
    </article>
  `;
}

async function loadGallery() {
  if (!season || !year) {
    title.textContent = 'Invalid collection';
    subtitle.textContent = 'Select a season and year from the timeline.';
    return;
  }

  applySeasonMood();
  title.textContent = `${seasonLabel[season] || season} ${year}`;

  try {
    const photos = await fetchJson(`/api/photos?season=${encodeURIComponent(season)}&year=${encodeURIComponent(year)}`);
    subtitle.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} in this collection`;

    if (!photos.length) {
      empty.hidden = false;
      return;
    }

    gallery.innerHTML = photos.map(cardTemplate).join('');

    gallery.querySelectorAll('.like-btn').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (button.disabled) {
          return;
        }

        const photoId = button.dataset.id;
        const previousText = button.textContent;
        try {
          const result = await fetchJson(`/api/photos/${photoId}/like`, { method: 'POST' });
          button.textContent = `Liked ${result.likes}`;
          button.disabled = true;
          button.classList.add('is-liked');
        } catch (error) {
          button.textContent = error.message;
          setTimeout(() => {
            button.textContent = previousText;
          }, 1800);
        }
      });
    });

    gallery.querySelectorAll('.print-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const photo = photos.find((item) => item.id === button.dataset.id);
        if (photo) {
          openModal(photo);
        }
      });
    });
  } catch (error) {
    subtitle.textContent = error.message;
  }
}

printForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!targetPhotoId) return;

  const formData = new FormData(printForm);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    note: formData.get('note')
  };

  try {
    await fetchJson(`/api/photos/${targetPhotoId}/request-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    printStatus.textContent = 'Request submitted.';
    printStatus.className = 'status success';
    setTimeout(closeModal, 900);
  } catch (error) {
    printStatus.textContent = error.message;
    printStatus.className = 'status error';
  }
});

closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});

loadGallery();
