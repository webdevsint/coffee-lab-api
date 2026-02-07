const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const optimizeImages = async (req, res, next) => {
  if (!req.files && !req.file) return next();

  const processFile = async (file) => {
    const originalPath = file.path;
    const optimizedFilename = `opt-${Date.now()}-${file.originalname.split(".")[0]}.webp`;
    const optimizedPath = path.join(
      path.dirname(originalPath),
      optimizedFilename,
    );

    try {
      await sharp(originalPath)
        .resize({ width: 1200, withoutEnlargement: true })
        .toFormat("webp")
        .webp({ quality: 80 })
        .toFile(optimizedPath);

      // Remove original file
      fs.unlinkSync(originalPath);

      // Update file info
      file.path = optimizedPath;
      file.filename = optimizedFilename;
      file.mimetype = "image/webp";
    } catch (err) {
      console.error("Error optimizing image:", err);
    }
  };

  if (req.files) {
    await Promise.all(req.files.map(processFile));
  } else if (req.file) {
    await processFile(req.file);
  }

  next();
};

module.exports = optimizeImages;
