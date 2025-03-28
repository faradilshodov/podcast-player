document.addEventListener("DOMContentLoaded", () => {
    const searchHistory = document.getElementById("searchHistory");
    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");
    const resetButton = document.getElementById("resetButton");
    const loader = document.getElementById("loader");
    const responseContainer = document.getElementById("response");

    // Reset search history
    function resetHistory() {
        searchHistory.innerText = "";
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Select a Previous Search";
        searchHistory.appendChild(option);
    }

    // Load search history from local storage
    function loadSearchHistory() {
        const savedSearches =
            JSON.parse(localStorage.getItem("searchHistory")) || [];
        resetHistory();
        savedSearches.forEach((searchTerm) => {
            const option = document.createElement("option");
            option.value = searchTerm;
            option.textContent = searchTerm;
            searchHistory.appendChild(option);
        });
    }

    // Save the search history to local storage
    function saveSearchHistory(searchTerm) {
        let savedSearches =
            JSON.parse(localStorage.getItem("searchHistory")) || [];
        if (!savedSearches.includes(searchTerm)) {
            savedSearches.push(searchTerm);
            localStorage.setItem(
                "searchHistory",
                JSON.stringify(savedSearches)
            );
        }
    }

    // Event listener for dropdown change
    searchHistory.addEventListener("change", () => {
        const selectedSearch = searchHistory.value;
        if (selectedSearch) {
            searchInput.value = selectedSearch;
            searchPodcast();
        }
    });

    // Event listener for search button, input
    searchButton.addEventListener("click", searchPodcast);
    searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            searchPodcast();
        }
    });

    // Event listener to reset search input
    searchInput.addEventListener("focus", () => {
        searchInput.value = "";
    });

    // Event listener for reset button
    resetButton.addEventListener("click", () => {
        localStorage.removeItem("searchHistory");
        resetHistory();
        searchInput.value = "";
    });

    // Load search history when page loads
    loadSearchHistory();

    // Format Date
    function formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString();
    }

    // Show  loading animation
    function showLoader() {
        loader.style.display = "flex";
        responseContainer.style.display = "none";
    }

    // Hide  loading animation
    function hideLoader() {
        loader.style.display = "none";
        responseContainer.style.display = "flex";
        responseContainer.scrollTo({
            top: 0,
        });
    }

    // Handle fallback image
    function handleFallbackImage(img) {
        const fallbackImage = "./default-podcast.png";
        img.src = fallbackImage;
        return img;
    }

    // Set up to load podcast / episode images
    function handleImageLoad(limit) {
        const images = responseContainer.getElementsByTagName("img");
        let imagesToLoad = Math.min(images.length, limit);

        if (imagesToLoad === 0) {
            hideLoader();
            return;
        }

        Array.from(images)
            .slice(0, limit)
            .forEach((img) => {
                img.onload = img.onerror = () => {
                    imagesToLoad--;

                    if (img.complete && !img.naturalWidth) {
                        img = handleFallbackImage(img);
                    }

                    if (imagesToLoad === 0) {
                        hideLoader();
                        lazyLoadRemainingImages(limit);
                    }
                };
            });
    }

    // Lazy load images after initial load
    function lazyLoadRemainingImages(start) {
        const remainingImages = Array.from(
            responseContainer.getElementsByTagName("img")
        ).slice(start);

        const lazyLoadObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    let img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.onload = img.onerror = () => {
                            if (img.complete && !img.naturalWidth) {
                                img = handleFallbackImage(img);
                            }
                            lazyLoadObserver.unobserve(img);
                        };
                    } else {
                        img = handleFallbackImage(img);
                        lazyLoadObserver.unobserve(img);
                    }
                }
            });
        });

        remainingImages.forEach((img) => {
            lazyLoadObserver.observe(img);
        });
    }

    // Search Podcasts
    async function searchPodcast() {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            console.log("Searched: ", searchTerm);
            saveSearchHistory(searchTerm);
            loadSearchHistory();
        } else {
            responseContainer.innerText = "Please, enter a podcast title.";
            return;
        }

        showLoader();

        try {
            const response = await fetch(
                `/api/search?q=${encodeURIComponent(searchTerm)}`
            );
            const data = await response.json();

            responseContainer.textContent = "";

            const titles = new Set();

            if (data.feeds && data.feeds.length > 0) {
                data.feeds.forEach((podcast, index) => {
                    if (
                        podcast.episodeCount > 0 &&
                        !titles.has(podcast.title)
                    ) {
                        titles.add(podcast.title);
                        const card = createCard(podcast);
                        responseContainer.appendChild(card);

                        if (index >= 25) {
                            card.querySelector("img").dataset.src =
                                card.querySelector("img").src;
                            card.querySelector("img").src = "";
                        }
                    }

                    handleImageLoad(25);
                });
            } else {
                responseContainer.innerText = "No Results Found";
            }
        } catch (error) {
            responseContainer.innerText = `Error: ${error.message}`;
        }
    }

    // Create Podcast Card
    function createCard(podcast) {
        const card = document.createElement("div");
        card.className = "card pointer";

        const img = document.createElement("img");
        img.src = podcast.image || "./default-podcast.png";
        img.alt = podcast.title;

        const content = document.createElement("div");
        content.className = "card-content";

        const title = document.createElement("h3");
        title.innerText = podcast.title;

        const description = document.createElement("p");
        description.innerText = podcast.description;

        const episodeCount = document.createElement("p");
        episodeCount.className = "episode-count";
        episodeCount.innerText = `Episodes: ${podcast.episodeCount}`;

        const pubDate = document.createElement("p");
        pubDate.className = "pub-date";
        pubDate.innerText = `Newest Episode: ${
            podcast.newestItemPubdate
                ? formatDate(podcast.newestItemPubdate)
                : "Not Available"
        }`;

        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(episodeCount);
        content.appendChild(pubDate);

        card.appendChild(img);
        card.appendChild(content);

        card.addEventListener("click", () =>
            loadEpisodes(podcast.itunesId, podcast.episodeCount)
        );

        return card;
    }

    // Load Episodes
    async function loadEpisodes(feedId, count) {
        if (!feedId) return;
        showLoader();

        try {
            const response = await fetch(
                `/api/episodes?feedId=${encodeURIComponent(
                    feedId
                )}&max=${count}`
            );
            const data = await response.json();

            responseContainer.textContent = "";

            if (data.items && data.items.length > 0) {
                data.items.forEach((episode, index) => {
                    const card = createEpisodeCard(episode);
                    responseContainer.appendChild(card);

                    if (index >= 25) {
                        card.querySelector("img").dataset.src =
                            card.querySelector("img").src;
                        card.querySelector("img").src = "";
                    }
                });
            } else {
                responseContainer.innerText = "No Results Found";
            }

            handleImageLoad(25);
        } catch (error) {
            responseContainer.innerText = `Error: ${error.message}`;
        }
    }

    // Create Episode Card
    function createEpisodeCard(episode) {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = episode.image || episode.feedImage || "./default-podcast.png";
        img.alt = episode.title;

        const content = document.createElement("div");
        content.className = "card-content";

        const title = document.createElement("h3");
        title.innerText = episode.title;

        const iconContainer = document.createElement("div");
        iconContainer.className = "icon-container";

        const playBtnIcon = document.createElement("i");
        playBtnIcon.className = "fas fa-play-circle mr-10";
        playBtnIcon.title = "Play Podcast";
        playBtnIcon.addEventListener("click", () => {
            console.log("Episode played: ", episode);
            loadPodcast(episode);
        });

        const queueBtnIcon = document.createElement("i");
        queueBtnIcon.className = "fas fa-list";
        queueBtnIcon.title = "Add to Queue";
        queueBtnIcon.addEventListener("click", () => {
            console.log("Episode queued: ", episode);
        });

        const description = document.createElement("p");
        description.innerHTML = episode.description;

        const pubDate = document.createElement("p");
        pubDate.className = "pub-date-alt";
        pubDate.innerText = `Published: ${
            episode.datePublished
                ? formatDate(episode.datePublished)
                : "Not Available"
        }`;

        iconContainer.appendChild(playBtnIcon);
        iconContainer.appendChild(queueBtnIcon);
        iconContainer.appendChild(pubDate);

        content.appendChild(title);
        content.appendChild(iconContainer);
        content.appendChild(description);

        card.appendChild(img);
        card.appendChild(content);

        return card;
    }

    // Navigation  ---------------------------------------------------------------------------------- //
    const searchLink = document.getElementById("searchLink");
    const listenLink = document.getElementById("listenLink");
    const searchContainer = document.querySelector(".search-container");
    const mainContainer = document.querySelector(".main-container");
    const playerContainer = document.querySelector(".player-container");
    const queueContainer = document.querySelector(".queue");

    searchLink.addEventListener("click", navigateToSearch);
    listenLink.addEventListener("click", navigateToPlayer);

    function navigateToSearch() {
        searchContainer.style.display = "flex";
        mainContainer.style.display = "flex";
        playerContainer.style.display = "none";
        queueContainer.style.display = "none";
        searchLink.classList.add("selected");
        listenLink.classList.remove("selected");
    }

    function navigateToPlayer() {
        searchContainer.style.display = "none";
        mainContainer.style.display = "none";
        playerContainer.style.display = "flex";
        queueContainer.style.display = "flex";
        searchLink.classList.remove("selected");
        listenLink.classList.add("selected");
    }

    // Player ------------------------------------------------------------------------------------------- //
    const image = document.getElementById("image");
    const title = document.getElementById("title");
    const datePublished = document.getElementById("datePublished");
    const player = document.getElementById("player");
    const currentTimeEl = document.getElementById("current-time");
    const durationEl = document.getElementById("duration");
    const progress = document.getElementById("progress");
    const progressContainer = document.getElementById("progress-container");
    const prevBtn = document.getElementById("prev");
    const playBtn = document.getElementById("play");
    const nextBtn = document.getElementById("next");

    // Check if Playing
    let isPlaying = false;

    // Play
    function playPodcast() {
        isPlaying = true;
        playBtn.classList.replace("fa-play", "fa-pause");
        playBtn.setAttribute("title", "Pause");
        player.play();
    }

    // Pause
    function pausePodcast() {
        isPlaying = false;
        playBtn.classList.replace("fa-pause", "fa-play");
        playBtn.setAttribute("title", "Play");
        music.pause();
    }

    // Play or Pause Event Listener
    playBtn.addEventListener("click", () =>
        isPlaying ? pausePodcast() : playPodcast()
    );

    // Update Podcast container
    function loadPodcast(episode) {
        title.textContent = episode.title;
        datePublished.textContent = `${
            episode.datePublished
                ? formatDate(episode.datePublished)
                : "Not Available"
        }`;
        player.src = episode.enclosureUrl;
        image.src = episode.image || episode.feedImage || "./default-podcast.png";

        player.addEventListener("loadedmetadata", () => {
            const duration = player.duration;
            formatTime(duration, durationEl);
            playPodcast();
        });
    }

    // Format Time
    function formatTime(time, elName) {
        // Calculate hours, mins, secs
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        let seconds = Math.floor(time % 60);

        // Format Seconds
        if (seconds < 10) seconds = `0${seconds}`;

        // Format Minutes
        const formattedMinutes =
            hours > 0 && minutes < 10 ? `0${minutes}` : minutes;

        // Display time in hours:minutes:seconds or minutes:seconds
        if (time) {
            elName.textContent =
                hours > 0
                    ? `${hours}:${formattedMinutes}:${seconds}`
                    : `${minutes}:${seconds}`;
        }
    }

    // Skip forward or backward 15 secs
    function skipTime(amount) {
        player.currentTime = Math.max(0, Math.min(player.duration, player.currentTime + amount));
    }

    // Update Progress Bar & Time
    function updateProgressBar(e) {
            const { duration, currentTime } = e.srcElement;
            // Update progress bar width
            const progressPercent = (currentTime / duration) * 100;
            progress.style.width = `${progressPercent}%`;
            // Format Time
            formatTime(duration, durationEl);
            formatTime(currentTime, currentTimeEl);
    }

    // Set Progress Bar
    function setProgressBar(e) {
        const width = this.clientWidth;
        const clickX = e.offsetX;
        const { duration } = player;
        player.currentTime = (clickX / width) * duration;
    }

    // Event Listeners
    player.addEventListener("timeupdate", updateProgressBar);
    progressContainer.addEventListener("click", setProgressBar);
    prevBtn.addEventListener('click', () => skipTime(-15));
    nextBtn.addEventListener('click', () => skipTime(15));
});
