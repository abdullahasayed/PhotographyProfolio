import { fetchJson, queryParam, seasonLabel, prettyDate, escapeHtml, imageOrPlaceholder } from './utils.js';

const photoId = queryParam('id');
const titleEl = document.getElementById('photo-title');
const metaEl = document.getElementById('photo-meta');
const backLink = document.getElementById('back-link');
const shell = document.getElementById('photo-shell');

function likeButtonText(photo) {
  const likes = Number(photo.likes || 0);
  return photo.likedByViewer ? `Liked ${likes}` : `Like ${likes}`;
}

function buildPhotoView(photo) {
  backLink.href = `/season.html?season=${encodeURIComponent(photo.season)}&year=${encodeURIComponent(photo.year)}`;
  backLink.textContent = `${seasonLabel[photo.season] || photo.season} ${photo.year}`;
  titleEl.textContent = photo.title;
  metaEl.textContent = `${prettyDate(photo.dateTaken)}${photo.location ? ` | ${photo.location}` : ''}`;

  shell.innerHTML = `
    <article class="media-stage">
      <img src="${escapeHtml(imageOrPlaceholder(photo.imageUrl, photo.title))}" alt="${escapeHtml(photo.title)}" />
      <div class="hover-tools">
        <button id="like" class="min-btn${photo.likedByViewer ? ' is-liked' : ''}" type="button" ${photo.likedByViewer ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(likeButtonText(photo))}</button>
        <button id="print" class="min-btn" type="button">Request Print</button>
      </div>
    </article>
    <p class="photo-caption">Click the image to reveal the field note.</p>
    <section id="blurb" class="blurb-panel">
      <h3>Field Note</h3>
      <p>${escapeHtml(photo.blurb || 'No blurb was provided for this image.')}</p>
    </section>
    <div id="print-modal" class="modal" aria-hidden="true">
      <div class="modal-card">
        <button id="print-close" class="min-btn modal-close" type="button">Close</button>
        <h3>Request Print: ${escapeHtml(photo.title)}</h3>
        <p class="note">This request is saved for the gallery owner to review.</p>
        <form id="print-form" class="form-grid">
          <label>
            Name
            <input name="name" type="text" maxlength="80" required />
          </label>
          <label>
            Email
            <input name="email" type="email" maxlength="120" required />
          </label>
          <label class="full">
            Note
            <textarea name="note" maxlength="800" placeholder="Preferred size, finish, framing details..."></textarea>
          </label>
          <div class="full" style="display: flex; gap: 0.6rem; align-items: center">
            <button type="submit" class="submit-btn">Send Request</button>
            <span id="print-status" class="status"></span>
          </div>
        </form>
      </div>
    </div>
  `;

  const stage = shell.querySelector('.media-stage');
  const blurb = shell.querySelector('#blurb');
  const likeBtn = shell.querySelector('#like');
  const printBtn = shell.querySelector('#print');
  const modal = shell.querySelector('#print-modal');
  const closeBtn = shell.querySelector('#print-close');
  const printForm = shell.querySelector('#print-form');
  const printStatus = shell.querySelector('#print-status');

  stage.addEventListener('click', () => {
    blurb.classList.toggle('open');
  });

  likeBtn.addEventListener('click', async (event) => {
    event.stopPropagation();

    if (likeBtn.disabled) {
      return;
    }

    try {
      const result = await fetchJson(`/api/photos/${photo.id}/like`, { method: 'POST' });
      likeBtn.textContent = `Liked ${result.likes}`;
      likeBtn.disabled = true;
      likeBtn.classList.add('is-liked');
    } catch (error) {
      likeBtn.textContent = error.message;
    }
  });

  function closeModal() {
    printForm.reset();
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  printBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  printForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(printForm);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      note: formData.get('note')
    };

    try {
      await fetchJson(`/api/photos/${photo.id}/request-print`, {
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
}

async function init() {
  if (!photoId) {
    titleEl.textContent = 'Photo not found';
    metaEl.textContent = 'No photo id was provided.';
    return;
  }

  try {
    const photo = await fetchJson(`/api/photos/${encodeURIComponent(photoId)}`);
    buildPhotoView(photo);
  } catch (error) {
    titleEl.textContent = 'Photo not found';
    metaEl.textContent = error.message;
  }
}

init();
