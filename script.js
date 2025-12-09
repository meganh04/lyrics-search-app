// Selectors
const form = document.getElementById('form');
const search = document.getElementById('search');
const result = document.getElementById('result');
const more = document.getElementById('more');

// Store the last search/pagination results so we can return to them
let lastResults = null;

const apiURL = 'https://api.lyrics.ovh';

// Search by song or artist
async function searchSongs(term) {
  try {
    const res = await robustFetch(`${apiURL}/suggest/${encodeURIComponent(term)}`);
    const data = await res.json();
    // remember results so we can go back from lyrics view
    lastResults = data;

    showDataSafe(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    result.innerHTML = `<p>Error: ${error.message}. The API might be temporarily unavailable or blocked by CORS.</p>`;
  }
}

// Robust fetch that tries direct fetch then public CORS proxies as fallbacks
async function robustFetch(url) {
  const attempts = [
    async (u) => fetch(u),
    async (u) => fetch('https://corsproxy.io/?' + encodeURIComponent(u)),
    async (u) => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(u)),
    async (u) => fetch('https://thingproxy.freeboard.io/fetch/' + u),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const res = await attempt(url);
      if (!res) throw new Error('No response');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      console.log('robustFetch: succeeded with', res.url);
      return res;
    } catch (err) {
      console.warn('robustFetch attempt failed:', err);
      lastError = err;
    }
  }

  throw lastError || new Error('All fetch attempts failed');
}

// Event listeners
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const searchTerm = search.value.trim();

  if (!searchTerm) {
    alert('Please type in a search term');
  } else {
    searchSongs(searchTerm);
  }
});

// Show song and artist in the DOM
// NOTE: Yes, this uses the insecure .innerHTML.
function showDataUnsafe(lyrics) {
  result.innerHTML = `
    <ul class="songs">
      ${lyrics.data
        .map(
          (song) => `<li>
      <span><strong>${song.artist.name}</strong> - ${song.title}</span>
      <button class="btn" data-artist="${song.artist.name}" data-songtitle="${song.title}">Get Lyrics</button>
    </li>`
        )
        .join('')}
    </ul>
  `;

  if (lyrics.prev || lyrics.next) {
    more.innerHTML = `
      ${
        lyrics.prev
          ? `<button class="btn" onclick="getMoreSongs('${lyrics.prev}')">Prev</button>`
          : ''
      }
      ${
        lyrics.next
          ? `<button class="btn" onclick="getMoreSongs('${lyrics.next}')">Next</button>`
          : ''
      }
    `;
  } else {
    more.innerHTML = '';
  }
}

function showDataSafe(lyrics) {
  result.innerHTML = '';
  more.innerHTML = '';

  const ul = document.createElement('ul');
  ul.className = 'songs';

  lyrics.data.forEach((song) => {
    const li = document.createElement('li');

    const span = document.createElement('span');

    const strong = document.createElement('strong');
    strong.textContent = song.artist.name;

    span.appendChild(strong);
    span.appendChild(document.createTextNode(` - ${song.title}`));
    li.appendChild(span);

    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = 'Get Lyrics';
    button.dataset.artist = song.artist.name;
    button.dataset.songtitle = song.title;

    li.appendChild(button);
    ul.appendChild(li);
  });

  result.appendChild(ul);

  if (lyrics.prev || lyrics.next) {
    if (lyrics.prev) {
      const prevButton = document.createElement('button');
      prevButton.className = 'btn';
      prevButton.textContent = 'Prev';
      prevButton.addEventListener('click', () => getMoreSongs(lyrics.prev));
      more.appendChild(prevButton);
    }

    if (lyrics.next) {
      const nextButton = document.createElement('button');
      nextButton.className = 'btn';
      nextButton.textContent = 'Next';
      nextButton.addEventListener('click', () => getMoreSongs(lyrics.next));
      more.appendChild(nextButton);
    }
  }
}


// Get lyrics button click
result.addEventListener('click', (e) => {
  const clickedEl = e.target;

  if (clickedEl.tagName === 'BUTTON') {
    const artist = clickedEl.getAttribute('data-artist');
    const songTitle = clickedEl.getAttribute('data-songtitle');

    // getLyricsUnsafe(artist, songTitle);
    getLyricsSafe(artist, songTitle);
  }
});

// Get lyrics for song
async function getLyricsUnsafe(artist, songTitle) {
  const res = await robustFetch(`${apiURL}/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songTitle)}`);
  const data = await res.json();

  if (data.error) {
    result.innerHTML = data.error;
  } else {
    const lyrics = data.lyrics.replace(/(\r\n|\r|\n)/g, '<br>');

    result.innerHTML = `
            <h2><strong>${artist}</strong> - ${songTitle}</h2>
            <span>${lyrics}</span>
        `;
      // Add back button
      more.innerHTML = '';
      const backButton = document.createElement('button');
      backButton.className = 'btn';
      backButton.textContent = 'Back to results';
      backButton.addEventListener('click', () => {
        if (lastResults) {
          showDataSafe(lastResults);
        }
      });
      more.appendChild(backButton);
  }

  more.innerHTML = '';
}

async function getLyricsSafe(artist, songTitle) {
  const res = await robustFetch(`${apiURL}/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songTitle)}`);
  const data = await res.json();

  result.innerHTML = '';
  more.innerHTML = '';

  if (data.error) {
    const errorMessage = document.createElement('p');
    errorMessage.textContent = data.error;
    result.append(errorMessage);
    return;
  }

  // Create heading
  const heading = document.createElement('h2');
  const strong = document.createElement('strong');
  strong.textContent = artist;

  heading.append(strong, ` - ${songTitle}`);
  result.append(heading);

  // Create lyrics block with line breaks
  const span = document.createElement('span');
  const lines = data.lyrics.split(/\r\n|\r|\n/);
  lines.forEach((line, index) => {
    span.append(line);
    if (index < lines.length - 1) {
      span.append(document.createElement('br'));
    }
  });

  result.append(span);
    // Add back button
    more.innerHTML = '';
    const backButton = document.createElement('button');
    backButton.className = 'btn';
    backButton.textContent = 'Back to results';
    backButton.addEventListener('click', () => {
      if (lastResults) {
        showDataSafe(lastResults);
      }
    });
    more.appendChild(backButton);
}
  // Pagination handler for Next/Prev buttons
  async function getMoreSongs(url) {
    // Try direct fetch first, then fall back to several public CORS proxies
    const attempts = [
      async (u) => fetch(u),
      async (u) => fetch('https://corsproxy.io/?' + encodeURIComponent(u)),
      async (u) => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(u)),
      async (u) => fetch('https://thingproxy.freeboard.io/fetch/' + u),
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const res = await attempt(url);
        if (!res) throw new Error('No response');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        // remember results so we can go back from lyrics view
        lastResults = data;

        showDataSafe(data);
        return;
      } catch (err) {
        // Keep trying next proxy
        console.warn('Pagination fetch attempt failed:', err);
        lastError = err;
      }
    }

    console.error('All pagination fetch attempts failed:', lastError);
    result.innerHTML = `<p>Error fetching more songs: ${lastError ? lastError.message : 'unknown error'}. Try reloading or try a new search.</p>`;
  }