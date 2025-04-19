document.addEventListener("DOMContentLoaded", () => {
  const eventId = window.location.pathname.split("/")[2];
  const eventTitle = document.getElementById("eventTitle");
  const photoGrid = document.getElementById("photoGrid");
  const fileDropArea = document.getElementById("fileDropArea");
  const fileInput = document.getElementById("fileInput");
  const fileInfo = document.getElementById("fileInfo");
  const uploadBtn = document.getElementById("uploadBtn");
  const adminKey = document.getElementById("adminKey");
  const uploadStatus = document.getElementById("uploadStatus");
  const photoModal = document.getElementById("photoModal");
  const modalImage = document.getElementById("modalImage");
  const downloadFull = document.getElementById("downloadFull");
  const closePhoto = document.querySelector(".close-photo");
  const refreshBtn = document.getElementById("refreshBtn");

  // Load event photos with cache busting
  async function loadEventPhotos(bypassCache = false) {
    try {
      photoGrid.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Loading photos...</p>
        </div>
      `;

      // Add cache busting parameter if requested
      const cacheBuster = bypassCache ? `&_t=${new Date().getTime()}` : "";
      const response = await fetch(
        `/api/events/${eventId}/photos${cacheBuster}`
      );
      const photos = await response.json();

      if (photos.length === 0) {
        photoGrid.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-images"></i>
            <h3>No photos yet</h3>
            <p>Upload photos using the admin panel</p>
          </div>
        `;
        return;
      }

      photoGrid.innerHTML = photos
        .map(
          (photo) => `
        <div class="photo-card">
          <img src="/api/imageproxy/${photo.id}?size=w400" 
               alt="${photo.name}" 
               class="photo-img"
               data-full="/api/imageproxy/${photo.id}?size=w1200"
               data-download="${photo.downloadUrl || photo.webContentLink}"
               data-name="${photo.name}"
               loading="lazy"
               onerror="this.onerror=null;this.src='';this.alt='${
                 photo.name
               }';">
          <div class="photo-actions">
            <a href="${photo.downloadUrl || photo.webContentLink}" 
               class="download-btn" 
               download="${photo.name}">
              <i class="fas fa-download"></i> Download
            </a>
          </div>
        </div>
      `
        )
        .join("");

      // Add click event to photos
      document.querySelectorAll(".photo-img").forEach((img) => {
        img.addEventListener("click", () => {
          modalImage.src = img.dataset.full;
          downloadFull.href = img.dataset.download;
          downloadFull.download = img.dataset.name;
          photoModal.style.display = "flex";
        });
      });
    } catch (error) {
      console.error("Error loading photos:", error);
      photoGrid.innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Failed to load photos</h3>
          <p>Please try again later</p>
        </div>
      `;
    }
  }

  // Handle file selection
  if (fileDropArea) {
    fileDropArea.addEventListener("click", () => fileInput.click());

    // Add drag and drop functionality
    fileDropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropArea.classList.add("drag-over");
    });

    fileDropArea.addEventListener("dragleave", () => {
      fileDropArea.classList.remove("drag-over");
    });

    fileDropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      fileDropArea.classList.remove("drag-over");
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateFileInfo();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", updateFileInfo);
  }

  function updateFileInfo() {
    if (fileInput.files.length > 0) {
      fileInfo.innerHTML = `
        <strong>Selected ${fileInput.files.length} file(s):</strong>
        <ul class="file-list">
          ${Array.from(fileInput.files)
            .map(
              (file) => `
            <li>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</li>
          `
            )
            .join("")}
        </ul>
      `;
    } else {
      fileInfo.innerHTML = "";
    }
  }

  // Upload photos
  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      if (!fileInput.files || fileInput.files.length === 0) {
        showStatus("Please select at least one photo", "error");
        return;
      }

      if (!adminKey.value) {
        showStatus("Please enter admin key", "error");
        return;
      }

      const formData = new FormData();
      Array.from(fileInput.files).forEach((file) => {
        formData.append("photos", file);
      });
      formData.append("adminKey", adminKey.value);

      try {
        showStatus("Uploading photos...", "info");
        uploadBtn.disabled = true;

        const response = await fetch(`/api/events/${eventId}/upload`, {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          showStatus(
            `${
              result.uploaded || result.files.length
            } photos uploaded successfully!`,
            "success"
          );
          fileInput.value = "";
          fileInfo.innerHTML = "";
          loadEventPhotos(true); // Force reload without cache after upload
        } else {
          showStatus(result.error || "Upload failed", "error");
        }
      } catch (error) {
        console.error("Upload error:", error);
        showStatus("Network error. Please try again.", "error");
      } finally {
        uploadBtn.disabled = false;
      }
    });
  }

  // Refresh button (force reload)
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadEventPhotos(true); // Force reload without cache
    });
  }

  // Photo modal controls
  if (closePhoto) {
    closePhoto.addEventListener("click", () => {
      photoModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
      if (e.target === photoModal) {
        photoModal.style.display = "none";
      }
    });
  }

  // Show status message
  function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status status-${type}`;
    uploadStatus.style.display = "block";
    setTimeout(() => {
      uploadStatus.textContent = "";
      uploadStatus.className = "upload-status";
      uploadStatus.style.display = "none";
    }, 5000);
  }

  // Initial load
  loadEventPhotos();

  // Set up periodic refresh
  setInterval(() => loadEventPhotos(true), 60000); // Refresh every minute
});
