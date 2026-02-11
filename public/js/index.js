import { fetchJson, seasonLabel, escapeHtml, imageOrPlaceholder } from './utils.js';

const timeline = document.getElementById('timeline');
const empty = document.getElementById('timeline-empty');

const profileName = document.getElementById('profile-name');
const profileAbout = document.getElementById('profile-about');
const profileImage = document.getElementById('profile-image');

function createNode(entry, index) {
  const li = document.createElement('li');
  const sideClass = index % 2 === 0 ? 'timeline-left' : 'timeline-right';
  li.className = `timeline-item ${sideClass}`;

  const season = seasonLabel[entry.season] || entry.season;
  const href = `/season.html?season=${encodeURIComponent(entry.season)}&year=${encodeURIComponent(entry.year)}`;

  li.innerHTML = `
    <div class="timeline-spine"><span>${escapeHtml(season)} ${escapeHtml(entry.year)}</span></div>
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

function setupTimelineReveal() {
  const items = [...document.querySelectorAll('.timeline-item')];
  if (!items.length) {
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.22,
      rootMargin: '0px 0px -8% 0px'
    }
  );

  items.forEach((item) => observer.observe(item));
}

function renderProfile(profile) {
  if (!profile) {
    return;
  }

  profileName.textContent = profile.displayName || 'Wildlight Photographer';
  profileAbout.textContent = profile.about || 'A seasonal visual archive built around light, habitat, and patient observation.';
  profileImage.src = imageOrPlaceholder(profile.imageUrl, profile.displayName || 'Photographer');
  profileImage.alt = `${profile.displayName || 'Photographer'} portrait`;
}

async function init() {
  try {
    const [seasons, profile] = await Promise.all([
      fetchJson('/api/seasons'),
      fetchJson('/api/profile').catch(() => null)
    ]);

    renderProfile(profile);

    if (!Array.isArray(seasons) || seasons.length === 0) {
      empty.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();
    seasons.forEach((entry, index) => fragment.appendChild(createNode(entry, index)));
    timeline.appendChild(fragment);
    setupTimelineReveal();
  } catch (error) {
    empty.hidden = false;
    empty.textContent = error.message;
  }
}

init();
