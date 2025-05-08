/*(function siteSplashScreen() {
  const SITE_PIN = "0000"; // Change this to your desired PIN
  // const STORAGE_KEY = "site_access_granted";
  // if (localStorage.getItem(STORAGE_KEY) === "true") return;
  // Always show splash for testing
  const splash = document.createElement("div");
  splash.className = "splash-overlay";
  splash.innerHTML = `
    <div class="splash-bg"></div>
    <div class="splash-fade"></div>
    <div class="splash-box" role="dialog" aria-modal="true" aria-label="Access PIN Dialog">
      <div class="splash-logos">
        <img src="/img/falconsblack.png" alt="Media Club Logo" />
      </div>
      <h2 id="splashTitle">Enter Access PIN</h2>
      <div class="splash-error" id="splashError" role="alert"></div>
      <div style="position:relative;width:100%;">
        <input type="password" id="splashInput" placeholder="Access PIN" autofocus autocomplete="off" aria-labelledby="splashTitle" aria-required="true" />
      </div>
      <button id="splashBtn" aria-label="Submit PIN">Enter</button>
    </div>
  `;
  document.body.appendChild(splash);
  const input = splash.querySelector("#splashInput");
  const btn = splash.querySelector("#splashBtn");
  const error = splash.querySelector("#splashError");

  function tryAccess() {
    btn.disabled = true;
    btn.textContent = "Checking...";
    setTimeout(() => {
      if (input.value === SITE_PIN) {
        splash.remove();
      } else {
        error.textContent = "Incorrect PIN. Please try again.";
        input.value = "";
        input.focus();
      }
      btn.disabled = false;
      btn.textContent = "Enter";
    }, 600);
  }
  btn.onclick = tryAccess;
  input.onkeydown = (e) => {
    if (e.key === "Enter") tryAccess();
  };
})();*/

document.addEventListener("DOMContentLoaded", () => {
  // Initialize refreshBtn functionality if it exists
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      loadEvents(true); // Force reload without cache
    });
  }

  // Initialize event loading if on the events page
  const eventsGrid = document.getElementById("events-grid");
  if (eventsGrid) {
    loadEvents(true); // Load with cache busting

    // Periodic refresh for events
    setInterval(() => {
      if (document.getElementById("events-grid")) {
        loadEvents(true);
      }
    }, 60000); // Refresh every minute
  }
});

async function loadEvents(bypassCache = false) {
  const eventsGrid = document.getElementById("events-grid");
  if (!eventsGrid) return;

  eventsGrid.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Loading events...</p>
    </div>
  `;

  try {
    // Add cache busting parameter if requested
    const cacheBuster = bypassCache ? `?_t=${new Date().getTime()}` : "";
    const response = await fetch(`/api/events${cacheBuster}`);
    const events = await response.json();

    if (events.length === 0) {
      eventsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-images"></i>
          <h3>No events found</h3>
          <p>New events will appear here soon</p>
        </div>
      `;
      return;
    }

    eventsGrid.innerHTML = events
      .map(
        (event) => `
          <div class="event-card">
            <a href="/events/${event.id}" class="event-link">
              ${
                event.coverId
                  ? `<div class="event-cover-container"><div class="event-cover" style="background-image: url('/api/imageproxy/${event.coverId}?size=w400${cacheBuster}')"></div></div>`
                  : `<div class="event-cover-container"><div class="folder-icon">${event.folderIcon}</div></div>`
              }
              <div class="event-info">
                <h3>${event.name}</h3>
              </div>
            </a>
          </div>
          `
      )
      .join("");
  } catch (error) {
    console.error("Error loading events:", error);
    eventsGrid.innerHTML = `
      <div class="error-message">Failed to load events. Please try again later.</div>
    `;
  }
}

function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add("show"), 100);
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function setupGlobalNav() {
  // Example of a global nav feature (e.g., hamburger menu)
  const navToggle = document.querySelector(".nav-toggle");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      document.body.classList.toggle("nav-open");
    });
  }
}

function setupScrollToTop() {
  // Scroll-to-top functionality globally
  const scrollToTopBtn = document.getElementById("scrollToTop");
  if (scrollToTopBtn) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 300) {
        scrollToTopBtn.classList.add("show");
      } else {
        scrollToTopBtn.classList.remove("show");
      }
    });

    scrollToTopBtn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }
}

// Set up periodic refresh for events
setInterval(() => {
  if (document.getElementById("events-grid")) {
    loadEvents(true);
  }
}, 60000); // Refresh every minute
