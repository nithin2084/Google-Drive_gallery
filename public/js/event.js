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
  const downloadAllBtn = document.getElementById("download-all");
  const paginationEl = document.getElementById("pagination");
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
  document.getElementById("sortBySelect").onchange = (e) => { sortBy = e.target.value; renderGallery(); };
  document.getElementById("sortOrderSelect").onchange = (e) => { sortOrder = e.target.value; renderGallery(); };

  // Sort items
  function sortItems(arr) {
    return arr.slice().sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "date") cmp = (a.createdTime || "").localeCompare(b.createdTime || "");
      else if (sortBy === "type") cmp = (a.type || "").localeCompare(b.type || "");
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }

  // Render folders and images
  function renderGallery() {
    galleryEl.innerHTML = "";
    // Folders first, sorted
    sortItems(items.filter(i => i.type === "folder")).forEach(folder => {
      const div = document.createElement("div");
      div.className = "photo-card folder-card";
      div.innerHTML = `<div class='folder-icon'>${folder.folderIcon}</div><div class='photo-actions'><strong>${folder.name}</strong></div>`;
      div.style.cursor = "pointer";
      div.onclick = () => {
        folderStack.push({ id: folder.id, name: folder.name });
        currentFolderId = folder.id;
        loadFolderContents(currentFolderId);
      };
      galleryEl.appendChild(div);
    });
    // Images with pagination, sorted
    const imageItems = sortItems(items.filter(i => i.type === "image"));
    const totalPages = Math.ceil(imageItems.length / IMAGES_PER_PAGE);
    const startIdx = (currentPage - 1) * IMAGES_PER_PAGE;
    const pageImages = imageItems.slice(startIdx, startIdx + IMAGES_PER_PAGE);
    if (!selectMode) {
      pageImages.forEach((photo, idx) => {
        const a = document.createElement("a");
        a.href = `/api/imageproxy/${photo.id}?size=w1200`;
        a.setAttribute("data-lg-size", "1200-800");
        a.setAttribute("data-src", `/api/imageproxy/${photo.id}?size=w1200`);
        a.setAttribute("data-sub-html", `<h4>${photo.name}</h4>`);
        a.className = "gallery-item";
        a.innerHTML = `<img src="/api/imageproxy/${photo.id}?size=w400" alt="${photo.name}" class="photo-img" loading="lazy">`;
        galleryEl.appendChild(a);
      });
      // Initialize LightGallery
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
      pageImages.forEach((photo, idx) => {
        const div = document.createElement("div");
        div.className = "photo-card";
        div.innerHTML = `
          <img src="/api/imageproxy/${photo.id}?size=w400" alt="${photo.name}" class="photo-img" loading="lazy">
          <div class="photo-actions"></div>
        `;
        const actions = div.querySelector(".photo-actions");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "photo-checkbox";
        checkbox.dataset.id = photo.id;
        actions.appendChild(checkbox);
        div.querySelector("img").onclick = (e) => {
          e.preventDefault();
          checkbox.checked = !checkbox.checked;
        };
        galleryEl.appendChild(div);
      });
      // Destroy LightGallery if present
      if (galleryInstance) {
        galleryInstance.destroy();
        galleryInstance = null;
      }
    }
    // Pagination controls
    renderPagination(totalPages);
    if (!galleryEl.innerHTML) {
      galleryEl.innerHTML = `<div class='empty-state'><i class='fas fa-images'></i><h3>No folders or images</h3></div>`;
    }
  }

  function renderPagination(totalPages) {
    paginationEl.innerHTML = "";
    if (totalPages <= 1) return;
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Prev";
    prevBtn.className = "btn-primary";
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        renderGallery();
      }
    };
    paginationEl.appendChild(prevBtn);
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = "btn-primary" + (i === currentPage ? " active" : "");
      btn.onclick = () => {
        currentPage = i;
        renderGallery();
      };
      paginationEl.appendChild(btn);
    }
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.className = "btn-primary";
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderGallery();
      }
    };
    paginationEl.appendChild(nextBtn);
  }

  // Create subfolder
  createFolderBtn.addEventListener("click", async () => {
    const folderName = newFolderNameInput.value.trim();
    const adminKey = adminKeyFolderInput.value.trim();
    if (!folderName || !adminKey) {
      alert("Please provide a folder name and admin key.");
      return;
    }
    try {
      const res = await fetch(`/api/folders/${currentFolderId}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, adminKey })
      });
      const data = await res.json();
      if (data.success) {
        newFolderNameInput.value = "";
        alert("Subfolder created.");
        loadFolderContents(currentFolderId);
      } else {
        alert(data.error || "Failed to create subfolder");
      }
    } catch (e) {
      alert("Error creating subfolder");
    }
  });

  // Upload images
  uploadFilesBtn.addEventListener("click", () => uploadFilesInput.click());
  uploadFilesInput.addEventListener("change", async () => {
    const files = uploadFilesInput.files;
    const adminKey = adminKeyFolderInput.value.trim();
    if (!files.length || !adminKey) {
      alert("Select files and enter admin key.");
      return;
    }
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append("photos", f));
    formData.append("adminKey", adminKey);
    try {
      const res = await fetch(`/api/folders/${currentFolderId}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert("Images uploaded.");
        uploadFilesInput.value = "";
        loadFolderContents(currentFolderId);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (e) {
      alert("Error uploading images");
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
    const ids = Array.from(document.querySelectorAll(".photo-checkbox:checked")).map(cb => cb.dataset.id);
    if (!ids.length) {
      alert("Select at least one image.");
      return;
    }
    window.location.href = `/api/events/${eventId}/download?ids=${ids.join(",")}`;
  });

  // Download all
  downloadAllBtn.addEventListener("click", () => {
    window.location.href = `/api/events/${eventId}/download?recursive=true`;
  });

  // Initial load
  loadEventInfo();
  loadFolderContents(currentFolderId);
});
