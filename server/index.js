// ENHANCED SERVER-SIDE CODE (server.js)
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const archiver = require("archiver"); // Add this dependency for zip functionality

const app = express();
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Google Drive Setup
const SCOPES = ["https://www.googleapis.com/auth/drive"];
const credentials = require("./auth/credentials.json");
const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  SCOPES
);
const drive = google.drive({ version: "v3", auth });

// Helper function for folder icons (keeping your existing function)
function getFolderIcon(folderName) {
  const colors = [
    "#FF9AA2",
    "#FFB7B2",
    "#FFDAC1",
    "#E2F0CB",
    "#B5EAD7",
    "#C7CEEA",
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return `
    <svg width="100" height="100" viewBox="0 0 100 100">
      <rect x="10" y="20" width="80" height="70" rx="5" fill="${color}"/>
      <rect x="10" y="30" width="80" height="10" fill="${color}" opacity="0.7"/>
      <text x="50" y="65" font-family="Arial" font-size="40" text-anchor="middle" fill="#fff">
        ${folderName.charAt(0).toUpperCase()}
      </text>
    </svg>
  `
    .replace(/\n/g, "")
    .replace(/\s+/g, " ");
}

// Recursive function to get files from nested folders
async function getFilesRecursively(folderId, depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return []; // Prevent infinite recursion

  try {
    // Get all files and folders in the current folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: "files(id, name, mimeType)",
      pageSize: 1000,
    });

    let allFiles = [];

    // Process each item
    for (const item of response.data.files) {
      if (item.mimeType === "application/vnd.google-apps.folder") {
        // If folder, recursively get its contents
        const subFiles = await getFilesRecursively(
          item.id,
          depth + 1,
          maxDepth
        );
        // Add folder path to each file
        const filesWithPath = subFiles.map((file) => ({
          ...file,
          folderPath:
            item.name + (file.folderPath ? "/" + file.folderPath : ""),
        }));
        allFiles = [...allFiles, ...filesWithPath];
      } else if (item.mimeType.includes("image/")) {
        // If image, add to results
        allFiles.push({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          folderPath: "",
        });
      }
    }

    return allFiles;
  } catch (error) {
    console.error("Error getting files recursively:", error);
    return [];
  }
}

// API Endpoints (keeping your existing endpoints)
// Enhanced event creation: support cover photo upload
const eventUpload = multer({
  dest: "uploads/",
  limits: { fileSize: 20 * 1024 * 1024 },
});
app.post("/api/events", eventUpload.single("coverPhoto"), async (req, res) => {
  try {
    // Accept both JSON and multipart/form-data
    const adminKey =
      req.body.adminKey || (req.body && JSON.parse(req.body).adminKey);
    const eventName = req.body.name || (req.body && JSON.parse(req.body).name);
    if (adminKey !== process.env.ADMIN_KEY) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Invalid admin key" });
    }
    // Create the event folder
    const folder = await drive.files.create({
      resource: {
        name: eventName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [process.env.ROOT_FOLDER_ID],
      },
      fields: "id,name,createdTime",
    });
    let coverId = null;
    // If a cover photo is uploaded, upload it to Drive and set as coverId
    if (req.file) {
      const cover = await drive.files.create({
        resource: {
          name: "_cover_" + req.file.originalname,
          parents: [folder.data.id],
        },
        media: {
          mimeType: req.file.mimetype,
          body: fs.createReadStream(req.file.path),
        },
        fields: "id",
      });
      coverId = cover.data.id;
      fs.unlinkSync(req.file.path);
      // Set the coverId as an appProperty on the folder
      await drive.files.update({
        fileId: folder.data.id,
        resource: {
          appProperties: { coverId },
        },
      });
    }
    res.json({
      success: true,
      event: {
        ...folder.data,
        coverId,
        folderIcon: getFolderIcon(eventName),
      },
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// Update /api/events to use custom coverId if set
app.get("/api/events", async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${process.env.ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id,name,createdTime,appProperties)",
      orderBy: "createdTime desc",
    });
    const events = await Promise.all(
      response.data.files.map(async (event) => {
        let coverId = event.appProperties && event.appProperties.coverId;
        if (!coverId) {
          const images = await drive.files.list({
            q: `'${event.id}' in parents and mimeType contains 'image/'`,
            pageSize: 1,
            fields: "files(id)",
          });
          coverId = images.data.files[0]?.id || null;
        }
        return {
          ...event,
          coverId,
          folderIcon: coverId ? null : getFolderIcon(event.name),
        };
      })
    );
    res.set("Cache-Control", "public, max-age=3600");
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to load events" });
  }
});

app.get("/api/events/:eventId/photos", async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${req.params.eventId}' in parents and mimeType contains 'image/'`,
      fields: "files(id,name,mimeType,webViewLink)",
      orderBy: "createdTime desc",
    });

    const photos = response.data.files.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w400-h400`,
      displayUrl: `https://drive.google.com/file/d/${file.id}/view`, // Use webViewLink
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    }));

    res.set("Cache-Control", "public, max-age=3600");
    res.json(photos);
  } catch (error) {
    console.error("Failed to load photos:", error);
    res.status(500).json({ error: "Failed to load photos" });
  }
});

// NEW: Batch download endpoint
app.get("/api/events/:eventId/download", async (req, res) => {
  try {
    const recursive = req.query.recursive === "true";
    const fileIds = req.query.ids ? req.query.ids.split(",") : [];

    // If specific files are requested, download those
    // Otherwise download all files in the folder (and subfolders if recursive)
    let filesToDownload = [];

    if (fileIds.length > 0) {
      // Get info for specified files
      filesToDownload = await Promise.all(
        fileIds.map(async (id) => {
          const fileInfo = await drive.files.get({
            fileId: id,
            fields: "id,name,mimeType",
          });
          return fileInfo.data;
        })
      );
    } else {
      // Get all files from folder (and subfolders if recursive)
      if (recursive) {
        filesToDownload = await getFilesRecursively(req.params.eventId);
      } else {
        const response = await drive.files.list({
          q: `'${req.params.eventId}' in parents and mimeType contains 'image/'`,
          fields: "files(id,name,mimeType)",
        });
        filesToDownload = response.data.files;
      }
    }

    // Set up the ZIP file
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=photos.zip");

    const archive = archiver("zip", {
      zlib: { level: 5 }, // Compression level
    });

    archive.pipe(res);

    // Add each file to the ZIP
    for (const file of filesToDownload) {
      try {
        const fileStream = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "stream" }
        );

        // Use folder path if available
        const filePath = file.folderPath
          ? `${file.folderPath}/${file.name}`
          : file.name;

        archive.append(fileStream.data, { name: filePath });
      } catch (error) {
        console.error(`Error downloading file ${file.name}:`, error);
        // Continue with other files if one fails
      }
    }

    archive.finalize();
  } catch (error) {
    console.error("Batch download error:", error);
    res.status(500).json({ error: "Failed to create download package" });
  }
});

app.post(
  "/api/events/:eventId/upload",
  upload.array("photos", 50),
  async (req, res) => {
    try {
      if (req.body.adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Invalid admin key" });
      }

      const uploadResults = await Promise.all(
        req.files.map(async (file) => {
          const result = await drive.files.create({
            resource: {
              name: file.originalname,
              parents: [req.params.eventId],
            },
            media: {
              mimeType: file.mimetype,
              body: fs.createReadStream(file.path),
            },
            fields: "id,name,webContentLink,mimeType",
          });
          fs.unlinkSync(file.path);
          return result.data;
        })
      );

      res.json({
        success: true,
        files: uploadResults.map((file) => ({
          ...file,
          displayUrl: `https://drive.google.com/uc?export=view&id=${file.id}`,
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

app.get("/events/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/event.html"));
});

app.get("/api/imageproxy/:id", async (req, res) => {
  try {
    const fileId = req.params.id;
    const size = req.query.size || "w400";

    // Get the file metadata to verify it exists and is an image
    const fileInfo = await drive.files.get({
      fileId: fileId,
      fields: "mimeType,name",
    });

    if (!fileInfo.data.mimeType.startsWith("image/")) {
      return res.status(400).send("Not an image file");
    }

    // Get the actual file content
    const response = await drive.files.get(
      { fileId: fileId, alt: "media" },
      { responseType: "stream" }
    );

    // Set appropriate headers
    res.set("Content-Type", fileInfo.data.mimeType);
    res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours

    // Pipe the image data to response
    response.data.pipe(res);
  } catch (error) {
    console.error("Image proxy error:", error);
    res.status(404).send("Image not found or access denied");
  }
});

// --- NESTED FOLDER FUNCTIONALITY ---
// Create a subfolder inside any folder (event or subfolder)
app.post("/api/folders/:parentId/create", async (req, res) => {
  try {
    const { name, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Invalid admin key" });
    }
    const folder = await drive.files.create({
      resource: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [req.params.parentId],
      },
      fields: "id,name,createdTime",
    });
    res.json({
      success: true,
      folder: {
        ...folder.data,
        folderIcon: getFolderIcon(name),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create subfolder" });
  }
});

// List contents (folders and images) of any folder
app.get("/api/folders/:folderId/contents", async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${req.params.folderId}' in parents`,
      fields: "files(id,name,mimeType,createdTime,appProperties)",
      orderBy: "createdTime desc",
    });
    const items = await Promise.all(
      response.data.files.map(async (item) => {
        if (item.mimeType === "application/vnd.google-apps.folder") {
          return {
            ...item,
            type: "folder",
            folderIcon: getFolderIcon(item.name),
          };
        } else if (item.mimeType.includes("image/")) {
          return {
            ...item,
            type: "image",
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${item.id}&sz=w400-h400`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${item.id}`,
          };
        } else {
          return null;
        }
      })
    );
    res.json(items.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: "Failed to list folder contents" });
  }
});

// Upload images to any folder (not just event root)
app.post(
  "/api/folders/:folderId/upload",
  upload.array("photos", 50),
  async (req, res) => {
    try {
      if (req.body.adminKey !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Invalid admin key" });
      }
      const uploadResults = await Promise.all(
        req.files.map(async (file) => {
          const result = await drive.files.create({
            resource: {
              name: file.originalname,
              parents: [req.params.folderId],
            },
            media: {
              mimeType: file.mimetype,
              body: fs.createReadStream(file.path),
            },
            fields: "id,name,webContentLink,mimeType",
          });
          fs.unlinkSync(file.path);
          return result.data;
        })
      );
      res.json({
        success: true,
        files: uploadResults.map((file) => ({
          ...file,
          displayUrl: `https://drive.google.com/uc?export=view&id=${file.id}`,
          thumbnailUrl: `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`,
          downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
