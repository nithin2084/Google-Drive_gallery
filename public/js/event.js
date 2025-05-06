// NESTED FOLDER FUNCTIONALITY
// This script replaces the default photo-only logic with folder navigation, subfolder creation, and upload to any folder.
document.addEventListener("DOMContentLoaded", () => {
  const eventId = window.location.pathname.split("/")[2];
  const eventNameEl = document.getElementById("event-name");
  const galleryEl = document.getElementById("gallery");
  const loadingEl = document.getElementById("loading");
  const breadcrumbEl = document.getElementById("breadcrumb");
  const newFolderNameInput = document.getElementById("newFolderName");
  const adminKeyFolderInput = document.getElementById("adminKeyFolder");
  const createFolderBtn = document.getElementById("createFolderBtn");
  const uploadFilesInput = document.getElementById("uploadFilesInput");
  const uploadFilesBtn = document.getElementById("uploadFilesBtn");
  const selectMoreBtn = document.getElementById("select-more");
  const downloadSelectedBtn = document.getElementById("download-selected");
  const paginationEl = document.getElementById("pagination");
  const backBtn = document.getElementById("backBtn");
  let selectMode = false;
  let currentFolderId = eventId;
  let folderStack = [{ id: eventId, name: "Event Root" }];
  let items = [];
  let galleryInstance = null;
  let currentPage = 1;
  const IMAGES_PER_PAGE = 20;

  // Add sort state
  let sortBy = "date"; // or "name" or "type"
  let sortOrder = "desc"; // or "asc"

  // Modal for image preview
  let photoModal = document.getElementById("photoModal");
  if (!photoModal) {
    photoModal = document.createElement("div");
    photoModal.id = "photoModal";
    photoModal.className = "photo-modal modal";
    photoModal.innerHTML = `
      <div class="modal-content">
        <span class="close-photo" style="position:absolute;top:10px;right:18px;font-size:2rem;cursor:pointer">&times;</span>
        <img id="modalImage" src="" style="max-width:90vw;max-height:70vh;display:block;margin:0 auto;" />
        <a id="downloadFull" class="btn-primary" href="#" download style="margin-top:18px;display:inline-block;">Download Full Image</a>
      </div>
    `;
    document.body.appendChild(photoModal);
  }
  const modalImage = document.getElementById("modalImage");
  const downloadFull = document.getElementById("downloadFull");
  const closePhoto = photoModal.querySelector(".close-photo");
  closePhoto.onclick = () => (photoModal.style.display = "none");
  window.addEventListener("click", (e) => {
    if (e.target === photoModal) photoModal.style.display = "none";
  });

  // Admin panel toggle logic
  const adminToggleBtn = document.getElementById("adminToggleEvent");
  const adminPanel = document.getElementById("adminPanelEvent");
  if (adminToggleBtn && adminPanel) {
    adminToggleBtn.addEventListener("click", function () {
      adminPanel.classList.toggle("active");
    });
  }

  // Back button logic
  if (backBtn) {
    backBtn.addEventListener("click", () => window.history.back());
  }

  // Notification logic
  function showNotification(message, type = "success") {
    let notification = document.getElementById("notification");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "notification";
      notification.className = `notification ${type}`;
      document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = "block";
    setTimeout(() => {
      notification.style.display = "none";
    }, 3000);
  }

  // Load event info
  async function loadEventInfo() {
    try {
      const res = await fetch("/api/events");
      const events = await res.json();
      const event = events.find((e) => e.id === eventId);
      if (event) {
        eventNameEl.textContent = event.name;
        document.title = `Photos - ${event.name}`;
        folderStack[0].name = event.name;
      }
    } catch (error) {
      console.error("Error loading event info:", error);
    }
  }

  // Load contents (folders and images) of the current folder
  async function loadFolderContents(folderId) {
    currentPage = 1;
    loadingEl.style.display = "block";
    galleryEl.innerHTML = "";
    try {
      const res = await fetch(`/api/folders/${folderId}/contents`);
      items = await res.json();
      renderBreadcrumb();
      renderGallery();
      loadingEl.style.display = "none";
    } catch (error) {
      console.error("Error loading folder contents:", error);
      galleryEl.innerHTML = `<div class='error-state'><i class='fas fa-exclamation-triangle'></i><h3>Failed to load folder</h3></div>`;
      loadingEl.style.display = "none";
    }
  }

  // Render breadcrumb navigation
  function renderBreadcrumb() {
    breadcrumbEl.innerHTML = "";
    folderStack.forEach((folder, idx) => {
      const span = document.createElement("span");
      span.textContent = folder.name;
      span.className = "breadcrumb-item";
      if (idx < folderStack.length - 1) {
        span.style.cursor = "pointer";
        span.onclick = () => {
          folderStack = folderStack.slice(0, idx + 1);
          currentFolderId = folder.id;
          loadFolderContents(currentFolderId);
        };
      }
      breadcrumbEl.appendChild(span);
      if (idx < folderStack.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = " / ";
        breadcrumbEl.appendChild(sep);
      }
    });
  }

  // Add sort UI
  const sortBar = document.createElement("div");
  sortBar.className = "sort-bar";
  sortBar.innerHTML = `
    <label>Sort by: </label>
    <select id="sortBySelect">
      <option value="date">Date</option>
      <option value="name">Name</option>
      <option value="type">Type</option>
    </select>
    <select id="sortOrderSelect">
      <option value="desc">Desc</option>
      <option value="asc">Asc</option>
    </select>
  `;
  breadcrumbEl.parentNode.insertBefore(sortBar, breadcrumbEl.nextSibling);
  document.getElementById("sortBySelect").onchange = (e) => {
    sortBy = e.target.value;
    renderGallery();
  };
  document.getElementById("sortOrderSelect").onchange = (e) => {
    sortOrder = e.target.value;
    renderGallery();
  };

  // Sort items
  function sortItems(arr) {
    return arr.slice().sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "date")
        cmp = (a.createdTime || "").localeCompare(b.createdTime || "");
      else if (sortBy === "type")
        cmp = (a.type || "").localeCompare(b.type || "");
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }

  // Render folders and images
  function renderGallery() {
    galleryEl.innerHTML = "";
    // Folders first, sorted
    sortItems(items.filter((i) => i.type === "folder")).forEach((folder) => {
      const div = document.createElement("div");
      div.className = "photo-card folder-card";
      div.innerHTML = `
        <div class="folder-cover-container" style="width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:12px 12px 0 0;">
          ${
            folder.coverId
              ? `<img class='folder-cover-img' src='/api/imageproxy/${folder.coverId}?size=w400' alt='${folder.name}' style='width:100%;height:100%;object-fit:cover;'>`
              : `<div class='folder-icon' style='width:100%;height:100%;display:flex;align-items:center;justify-content:center;'>${folder.folderIcon}</div>`
          }
        </div>
        <div class='photo-actions'><strong>${folder.name}</strong></div>
      `;
      div.style.cursor = "pointer";
      div.onclick = () => {
        folderStack.push({ id: folder.id, name: folder.name });
        currentFolderId = folder.id;
        loadFolderContents(currentFolderId);
      };
      galleryEl.appendChild(div);
    });

    // Images with pagination, sorted
    const imageItems = sortItems(items.filter((i) => i.type === "image"));
    const totalPages = Math.ceil(imageItems.length / IMAGES_PER_PAGE);
    const startIdx = (currentPage - 1) * IMAGES_PER_PAGE;
    const pageImages = imageItems.slice(startIdx, startIdx + IMAGES_PER_PAGE);

    if (!selectMode) {
      pageImages.forEach((photo) => {
        const a = document.createElement("a");
        a.href = `/api/imageproxy/${photo.id}?size=w1200`;
        a.setAttribute("data-lg-size", "1200-800");
        a.setAttribute("data-src", `/api/imageproxy/${photo.id}?size=w1200`);
        a.setAttribute("data-sub-html", `<h4>${photo.name}</h4>`);
        a.className = "gallery-item";
        a.innerHTML = `
          <img src="/api/imageproxy/${photo.id}?size=w400" alt="${photo.name}" class="photo-img" loading="lazy">
          <div class="img-overlay">
            <span class="img-title">${photo.name}</span>
            <span class="img-actions">
              <a href="/api/imageproxy/${photo.id}?size=w1200" target="_blank" title="View Full" tabindex="-1"><i class="fas fa-search-plus"></i></a>
              <a href="/api/imageproxy/${photo.id}?size=w1200" download title="Download" tabindex="-1"><i class="fas fa-download"></i></a>
            </span>
          </div>
        `;
        galleryEl.appendChild(a);
      });

      if (galleryInstance) {
        galleryInstance.destroy();
        galleryInstance = null;
      }
      galleryInstance = lightGallery(galleryEl, {
        selector: ".gallery-item",
        plugins: [lgZoom, lgThumbnail],
        speed: 500,
        download: true,
        counter: true,
        enableDrag: true,
        enableTouch: true,
      });
    } else {
      pageImages.forEach((photo) => {
        const div = document.createElement("div");
        div.className = "gallery-item";
        div.dataset.id = photo.id;
        div.innerHTML = `
          <img src="/api/imageproxy/${photo.id}?size=w400" alt="${photo.name}" class="photo-img" loading="lazy">
          <div class="img-overlay">
            <span class="img-title">${photo.name}</span>
          </div>
        `;

        // Add click handler for selection
        div.addEventListener("click", () => {
          div.classList.toggle("selected");
          const checkbox = div.querySelector('input[type="checkbox"]');
          if (checkbox) {
            checkbox.checked = div.classList.contains("selected");
          }
        });

        // Add checkbox for selection
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "checkbox-container";
        checkbox.dataset.id = photo.id;
        checkbox.addEventListener("change", (e) => {
          div.classList.toggle("selected", e.target.checked);
          e.stopPropagation();
        });
        div.appendChild(checkbox);

        galleryEl.appendChild(div);
      });

      if (galleryInstance) {
        galleryInstance.destroy();
        galleryInstance = null;
      }
    }

    renderPagination(totalPages);
    if (!galleryEl.innerHTML) {
      galleryEl.innerHTML = `<div class='empty-state'><i class='fas fa-images'></i><h3>No folders or images</h3></div>`;
    }
  }

  function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination-controls');
    paginationContainer.innerHTML = ''; // Clear existing pagination buttons
    paginationContainer.style.marginTop = '32px'; // Add spacing from gallery
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'center';
    paginationContainer.style.flexWrap = 'wrap';
    paginationContainer.style.gap = '10px';

    // Previous Button
    const prevBtn = document.createElement('button');
    prevBtn.innerText = 'Previous';
    prevBtn.className = 'btn btn-outline-secondary';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderGallery();
        }
    };
    paginationContainer.appendChild(prevBtn);

    // Page number buttons
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.innerText = i;
        pageBtn.className = `btn ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`;
        pageBtn.onclick = () => {
            currentPage = i;
            renderGallery();
        };
        paginationContainer.appendChild(pageBtn);
    }

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.innerText = 'Next';
    nextBtn.className = 'btn btn-outline-secondary';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderGallery();
        }
    };
    paginationContainer.appendChild(nextBtn);
  }

  // Create subfolder
  createFolderBtn.addEventListener("click", async () => {
    const folderName = newFolderNameInput.value.trim();
    const adminKey = adminKeyFolderInput.value.trim();
    if (!folderName || !adminKey) {
      showNotification("Please provide a folder name and admin key.", "error");
      return;
    }
    try {
      const res = await fetch(`/api/folders/${currentFolderId}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, adminKey }),
      });
      const data = await res.json();
      if (data.success) {
        newFolderNameInput.value = "";
        showNotification("Subfolder created.", "success");
        loadFolderContents(currentFolderId);
      } else {
        showNotification(data.error || "Failed to create subfolder", "error");
      }
    } catch (e) {
      showNotification("Error creating subfolder", "error");
    }
  });

  // Upload images
  uploadFilesBtn.addEventListener("click", () => uploadFilesInput.click());
  uploadFilesInput.addEventListener("change", async () => {
    const files = uploadFilesInput.files;
    const adminKey = adminKeyFolderInput.value.trim();
    if (!files.length || !adminKey) {
      showNotification("Select files and enter admin key.", "error");
      return;
    }
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("photos", f));
    formData.append("adminKey", adminKey);
    try {
      const res = await fetch(`/api/folders/${currentFolderId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showNotification("Images uploaded.", "success");
        uploadFilesInput.value = "";
        loadFolderContents(currentFolderId);
      } else {
        showNotification(data.error || "Upload failed", "error");
      }
    } catch (e) {
      showNotification("Error uploading images", "error");
    }
  });

  // Select mode
  selectMoreBtn.addEventListener("click", () => {
    selectMode = !selectMode;
    selectMoreBtn.classList.toggle("active", selectMode);
    selectMoreBtn.textContent = selectMode ? "Done selecting" : "Select more";
    renderGallery();
  });

  // Download selected
  downloadSelectedBtn.addEventListener("click", () => {
    const ids = Array.from(
      document.querySelectorAll(".gallery-item.selected")
    ).map((el) => el.dataset.id);

    if (!ids.length) {
      showNotification("Select at least one image.", "error");
      return;
    }
    window.location.href = `/api/events/${eventId}/download?ids=${ids.join(
      ","
    )}`;
  });

  // Initial load
  loadEventInfo();
  loadFolderContents(currentFolderId);
});
