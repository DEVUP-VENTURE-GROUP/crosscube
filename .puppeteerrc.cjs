// Vercel uses the remote PDF service, so its builds skip the Chrome download.
module.exports = {
  skipDownload: process.env.VERCEL === "1" || process.env.PUPPETEER_SKIP_DOWNLOAD === "true",
};
