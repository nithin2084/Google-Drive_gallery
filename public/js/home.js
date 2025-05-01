document.addEventListener("DOMContentLoaded", function () {
  // Initialize admin modal functionality
  initAdminModal();

  // Load all events with cache busting
  loadEvents(true);

  // Set up admin toggle button
  const adminToggleBtn = document.getElementById("adminToggle");
  const adminPanel = document.getElementById("adminPanel");

  if (adminToggleBtn && adminPanel) {
    adminToggleBtn.addEventListener("click", function () {
      adminPanel.classList.toggle("active");
    });
  }
});

function initAdminModal() {
  const modal = document.getElementById("eventModal");
  const createEventBtn = document.getElementById("createEventBtn");
  const closeModal = document.querySelector(".close-modal");
  const confirmCreate = document.getElementById("confirmCreate");

  // Open modal when Create Event button is clicked
  if (createEventBtn) {
    createEventBtn.addEventListener("click", function () {
      // Get values from the admin panel
      const eventName = document.getElementById("newEventName").value;
      const adminKey = document.getElementById("adminKey").value;

      // Copy values to the modal
      document.getElementById("eventNameInput").value = eventName;
      document.getElementById("adminKeyInput").value = adminKey;

      modal.style.display = "flex";
    });
  }

  // Close modal when X is clicked
  if (closeModal) {
    closeModal.addEventListener("click", function () {
      modal.style.display = "none";
    });
  }

  // Close modal when clicking outside
  window.addEventListener("click", function (event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });

  // Handle form submission
  if (confirmCreate) {
    confirmCreate.addEventListener("click", async function () {
      const eventName = document.getElementById("eventNameInput").value.trim();
      const adminKey = document.getElementById("adminKeyInput").value.trim();
      const coverPhotoInput = document.getElementById("coverPhotoInput");
      const coverPhotoFile =
        coverPhotoInput && coverPhotoInput.files.length > 0
          ? coverPhotoInput.files[0]
          : null;

      if (!eventName || !adminKey) {
        alert("Please enter both event name and admin key");
        return;
      }

      try {
        modal.style.display = "none";

        // Show loading indicator
        const eventsGrid = document.getElementById("eventsGrid");
        eventsGrid.innerHTML = `
          <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Creating event...</p>
          </div>
        `;

        let response, data;
        if (coverPhotoFile) {
          // Use FormData if cover photo is present
          const formData = new FormData();
          formData.append("name", eventName);
          formData.append("adminKey", adminKey);
          formData.append("coverPhoto", coverPhotoFile);
          response = await fetch("/api/events", {
            method: "POST",
            body: formData,
          });
        } else {
          // Fallback to JSON if no cover photo
          response = await fetch("/api/events", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: eventName,
              adminKey: adminKey,
            }),
          });
        }
        data = await response.json();

        if (data.success) {
          // Clear form
          document.getElementById("newEventName").value = "";
          document.getElementById("adminKey").value = "";
          if (coverPhotoInput) coverPhotoInput.value = "";

          // Hide admin panel
          const adminPanel = document.getElementById("adminPanel");
          if (adminPanel) {
            adminPanel.classList.remove("active");
          }

          // Show success notification
          showNotification("Event created successfully!");

          // Reload events without cache
          loadEvents(true);
        } else {
          alert(data.error || "Failed to create event");
          loadEvents(true); // Still reload events
        }
      } catch (error) {
        alert("Error creating event");
        console.error(error);
        loadEvents(true); // Still reload events
      }
    });
  }
}

async function loadEvents(bypassCache = false) {
  const eventsGrid = document.getElementById("eventsGrid");

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
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p>No events found. Create a new event to get started.</p>
        </div>
      `;
      return;
    }

    eventsGrid.innerHTML = "";

    events.forEach((event) => {
      const card = document.createElement("div");
      card.className = "event-card";

      // Format date
      const eventDate = new Date(event.createdTime);
      const formattedDate = eventDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Create event card HTML with cache buster for images
      let imageHtml;
      if (event.coverId) {
        // Use our proxy endpoint for the thumbnail with cache buster
        const cacheBuster = bypassCache ? `&_t=${new Date().getTime()}` : "";
        imageHtml = `<img src="/api/imageproxy/${event.coverId}?size=w400${cacheBuster}" alt="${event.name}" loading="lazy" class="event-cover">`;
      } else if (event.folderIcon) {
        // Use the SVG icon if no cover image
        imageHtml = `<div class="event-placeholder">${event.folderIcon}</div>`;
      } else {
        // Default placeholder
        imageHtml = `<div class="event-placeholder"><i class="fas fa-images"></i></div>`;
      }

      card.innerHTML = `
        <div class="event-image">
          ${imageHtml}
        </div>
        <div class="event-info">
          <h3>${event.name}</h3>
          <div class="event-date">${formattedDate}</div>
          <div class="event-actions">
            <a href="/events/${event.id}" class="view-btn">
              <i class="fas fa-eye"></i> View Gallery
            </a>
          </div>
        </div>
      `;

      eventsGrid.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading events:", error);
    eventsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <p>Error loading events. Please try again later.</p>
      </div>
    `;
  }
}

function showNotification(message, type = "success") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 100);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
