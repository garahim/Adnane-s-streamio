const TMDB_API_KEY = "ad577d0ed0f075c367f6040a7defda1c"; 
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

let currentMedia = { id: null, type: 'movie', season: 1, episode: 1, currentServer: 1 };

// Load popular movies & series on startup
async function fetchPopular() {
    const gridTitle = document.getElementById('gridTitle');
    if (gridTitle) gridTitle.innerText = "Popular Movies & Series";
    
    try {
        const res = await fetch(`${TMDB_BASE_URL}/trending/all/day?api_key=${TMDB_API_KEY}`);
        if (!res.ok) throw new Error("API network error");
        const data = await res.json();
        
        const filtered = (data.results || []).map(item => ({
            ...item,
            media_type: item.media_type || (item.title ? 'movie' : 'tv')
        }));
        
        renderGrid(filtered);
    } catch (err) {
        console.error("Fetch Error:", err);
        showEmptyState("Failed to load trending content. Check your API key or network.");
    }
}

// Search Handler
async function handleSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) { 
        fetchPopular(); 
        return; 
    }

    document.getElementById('gridTitle').innerText = `Results for "${query}"`;
    
    try {
        const res = await fetch(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error("Search API network error");
        const data = await res.json();
        
        const processedResults = (data.results || [])
            .map(item => ({
                ...item,
                media_type: item.media_type || (item.title ? 'movie' : 'tv')
            }))
            .filter(item => item.media_type === 'movie' || item.media_type === 'tv');

        if (processedResults.length === 0) {
            showEmptyState(`No results found for "${query}"`);
        } else {
            renderGrid(processedResults);
        }
    } catch (err) {
        console.error("Search Error:", err);
        showEmptyState("Error searching database.");
    }
}

// Render Content Cards
function renderGrid(items) {
    const grid = document.getElementById('movieGrid');
    if (!grid) return;
    grid.innerHTML = '';

    items.forEach(item => {
        const title = item.title || item.name || "Untitled";
        const releaseYear = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
        const poster = item.poster_path 
            ? `${IMAGE_BASE_URL}${item.poster_path}` 
            : 'https://via.placeholder.com/300x450/1f2833/ffffff?text=No+Poster';
        const type = item.media_type || 'movie';

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => openStream(item.id, type);
        card.innerHTML = `
            <img src="${poster}" alt="${title}">
            <div class="movie-info">
                <div class="movie-title">${title}</div>
                <div class="movie-meta">
                    <span>${releaseYear}</span>
                    <span class="badge">${type.toUpperCase()}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function showEmptyState(message) {
    const grid = document.getElementById('movieGrid');
    if (grid) {
        grid.innerHTML = `<div style="color: #c5c6c7; padding: 20px; font-size: 1.1rem;">${message}</div>`;
    }
}

// Stream Modal Handlers
async function openStream(id, type) {
    currentMedia = { id, type, season: 1, episode: 1, currentServer: 1 };
    
    const tvControls = document.getElementById('tvControls');
    if (type === 'tv') {
        if (tvControls) tvControls.style.display = 'flex';
        await loadTVSeasons(id);
    } else {
        if (tvControls) tvControls.style.display = 'none';
    }

    changeServer(1);
    const modal = document.getElementById('videoModal');
    if (modal) modal.style.display = 'flex';
}

async function loadTVSeasons(id) {
    try {
        const res = await fetch(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`);
        const showData = await res.json();
        const seasonSelect = document.getElementById('seasonSelect');
        if (!seasonSelect) return;
        
        seasonSelect.innerHTML = '';
        (showData.seasons || []).forEach(s => {
            if (s.season_number > 0) {
                seasonSelect.innerHTML += `<option value="${s.season_number}">Season ${s.season_number}</option>`;
            }
        });

        currentMedia.season = 1;
        await loadTVEpisodes(id, 1);
    } catch (err) { 
        console.error("TV Season Error:", err); 
    }
}

async function loadTVEpisodes(id, seasonNum) {
    try {
        const res = await fetch(`${TMDB_BASE_URL}/tv/${id}/season/${seasonNum}?api_key=${TMDB_API_KEY}`);
        const seasonData = await res.json();
        const episodeSelect = document.getElementById('episodeSelect');
        if (!episodeSelect) return;
        
        episodeSelect.innerHTML = '';
        (seasonData.episodes || []).forEach(e => {
            episodeSelect.innerHTML += `<option value="${e.episode_number}">Episode ${e.episode_number}: ${e.name}</option>`;
        });

        currentMedia.episode = 1;
    } catch (err) { 
        console.error("TV Episode Error:", err); 
    }
}

function onSeasonChange() {
    const seasonSelect = document.getElementById('seasonSelect');
    if (!seasonSelect) return;
    const seasonNum = seasonSelect.value;
    currentMedia.season = seasonNum;
    loadTVEpisodes(currentMedia.id, seasonNum).then(() => {
        changeServer(currentMedia.currentServer);
    });
}

function onEpisodeChange() {
    const episodeSelect = document.getElementById('episodeSelect');
    if (!episodeSelect) return;
    currentMedia.episode = episodeSelect.value;
    changeServer(currentMedia.currentServer);
}

function changeServer(server) {
    currentMedia.currentServer = server;
    const { id, type, season, episode } = currentMedia;
    let url = "";

    if (server === 1) {
        // VidLink Gateway (Supports auto-subtitles & HD streams)
        url = type === "movie" 
            ? `https://vidlink.pro/movie/${id}`
            : `https://vidlink.pro/tv/${id}/${season}/${episode}`;
    } else if (server === 2) {
        // VidSrc.me Gateway
        url = type === "movie" 
            ? `https://vidsrc.me/embed/movie?tmdb=${id}`
            : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`;
    } else if (server === 3) {
        // Embed.su Gateway
        url = type === "movie" 
            ? `https://embed.su/embed/movie/${id}` 
            : `https://embed.su/embed/tv/${id}/${season}/${episode}`;
    } else if (server === 4) {
        // 2Embed Gateway
        url = type === "movie" 
            ? `https://www.2embed.cc/embed/${id}` 
            : `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
    }

    const streamFrame = document.getElementById('streamFrame');
    if (streamFrame) streamFrame.src = url;
}

function closeStream() {
    const streamFrame = document.getElementById('streamFrame');
    const modal = document.getElementById('videoModal');
    if (streamFrame) streamFrame.src = '';
    if (modal) modal.style.display = 'none';
}

// Initial fetch on page load
fetchPopular();