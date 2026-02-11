import { fetchJson, seasonLabel, escapeHtml, imageOrPlaceholder } from './utils.js';

const timeline = document.getElementById('timeline');
const empty = document.getElementById('timeline-empty');

function createNode(entry) {
  const li = document.createElement('li');
  li.className = 'timeline-item';

  const season = seasonLabel[entry.season] || entry.season;
  const href = `/season.html?season=${encodeURIComponent(entry.season)}&year=${encodeURIComponent(entry.year)}`;

  li.innerHTML = `
    <div class="timeline-spine">${season} ${entry.year}</div>
    <a class="timeline-card" href="${href}" aria-label="Open ${escapeHtml(season)} ${escapeHtml(entry.year)} collection">
      <img class="timeline-cover" src="${escapeHtml(imageOrPlaceholder(entry.coverImage, `${season} ${entry.year}`))}" alt="${escapeHtml(season)} ${escapeHtml(entry.year)} cover" loading="lazy" />
      <div class="timeline-scrim" aria-hidden="true"></div>
      <div class="timeline-content">
        <h3>${escapeHtml(season)} ${escapeHtml(entry.year)}</h3>
        <p>${escapeHtml(entry.count)} Photo${entry.count === 1 ? '' : 's'}</p>
      </div>
    </a>
  `;

  return li;
}

async function init() {
  try {
    const seasons = await fetchJson('/api/seasons');
    if (!Array.isArray(seasons) || seasons.length === 0) {
      empty.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();
    seasons.forEach((entry) => fragment.appendChild(createNode(entry)));
    timeline.appendChild(fragment);
  } catch (error) {
    empty.hidden = false;
    empty.textContent = error.message;
  }
}

init();
