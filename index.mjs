#!/usr/bin/env node

import * as fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { spawn } from "child_process";
import minimist from "minimist";
import { parseString } from "xml2js";
import { format } from "date-fns";
import os from "os";
import path from "path";

async function isLighthouseInstalled() {
  return new Promise((resolve, reject) => {
    const lighthouseCommand = os.platform() === "win32" ? "where" : "which";
    const lighthouseProcess = spawn(lighthouseCommand, ["lighthouse"]);

    lighthouseProcess.on("close", (code) => {
      resolve(code === 0);
    });
  });
}
async function runLighthouse(url, outputPath, flags = []) {
  const commonFlags = [
    url,
    "--output=json",
    "--output=html",
    "--output-path=" + outputPath,
    '--chrome-flags="--headless --disable-gpu"',
  ];

  const allFlags = [...commonFlags, ...flags];
  return new Promise((resolve, reject) => {
    const lighthouseProcess = spawn("lighthouse", allFlags);

    lighthouseProcess.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`Lighthouse process exited with code ${code}`));
      }
    });
  });
}
function parseArgs() {
  const args = minimist(process.argv.slice(2));
  let urls = [];

  if (args.f || args.file) {
    const filename = args.f || args.file;
    try {
      const fileContent = fs.readFileSync(filename, "utf8");

      // Detect if the file is an XML sitemap
      if (filename.endsWith(".xml")) {
        // Parse XML sitemap using xml2js
        parseString(fileContent, (err, result) => {
          if (err) {
            console.error("Error parsing XML:", err);
            return;
          }
          // Extract URLs from the XML structure
          urls = result.urlset.url.map((urlObj) => urlObj.loc[0]);
        });
      } else {
        //plain text file
        urls = fileContent.split("\n").map((url) => url.trim());
      }
    } catch (error) {
      console.error(`Error opening file ${filename}:`, error.message);
    }
  } else {
    // URLs provided directly as positional arguments
    urls = args._;
  }

  if (urls.length === 0) {
    console.error("Usage: node script.js [-f <file>] <url1> <url2> ...");
    return;
  }
  return urls;
}
async function createDirectory() {
  return new Promise((resolve, reject) => {
    const currentDate = new Date();
    const directoryName = `lighthouse-audit_${format(
      currentDate,
      "yyyy-MM-dd_HH-mm"
    )}`.replace(/[^a-zA-Z0-9]/g, "_");
    try {
      fs.mkdirSync(directoryName);
      resolve(directoryName);
    } catch (error) {
      reject(error);
    }
  });
}
function createCSVWriter(csvPath) {
  return createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "url", title: "URL" },
      { id: "score_performance", title: "Performance Score" },
      { id: "score_accessibility", title: "Accessibility Score" },
      { id: "score_best_practices", title: "Best Practices Score" },
      { id: "score_seo", title: "SEO Score" },
      { id: "score_pwa", title: "PWA Score" },
    ],
  });
}
function createSummaryRecord(reportJSON) {
  return {
    url: reportJSON.requestedUrl,
    score_performance: reportJSON.categories.performance.score * 100,
    score_accessibility: reportJSON.categories.accessibility.score * 100,
    score_best_practices: reportJSON.categories["best-practices"].score * 100,
    score_seo: reportJSON.categories.seo.score * 100,
    score_pwa: reportJSON.categories.pwa.score * 100,
  };
}

async function parseJSONFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", (readErr, data) => {
      if (readErr) {
        reject(new Error(`Error reading data for ${file}`, readErr));
        return;
      }
      try {
        const parsedData = JSON.parse(data);
        resolve(parsedData);
      } catch (parseError) {
        reject(new Error(`Error parsing JSON for ${file}`, parseError));
      }
    });
  });
}
async function buildSummaryData() {
  const mobileSummary = [];
  const desktopSummary = [];

  try {
    const files = await fs.promises.readdir(process.cwd());
    for (const file of files) {
      if (path.extname(file) === ".json") {
        const jsonData = await parseJSONFile(file);
        if (file.includes("mobile")) {
          mobileSummary.push(createSummaryRecord(jsonData));
        } else {
          desktopSummary.push(createSummaryRecord(jsonData));
        }
      }
    }
    return { mobileSummary, desktopSummary };
  } catch (err) {
    console.error("Error reading directory or parsing JSON:", err);
    return null;
  }
}
async function main() {
  //check for lighthouse installation
  const lighthouseIsInstalled = await isLighthouseInstalled();
  if (!lighthouseIsInstalled) {
    console.error(
      'The Lighthouse package does not seem to be installed. Please run "npm i --location=global lighthouse" to install it globally'
    );
    return;
  }
  let urls = parseArgs();

  const directoryName = await createDirectory();
  // Set the directory as the working directory
  process.chdir(directoryName);

  //create CSV Summary for Mobile
  const csvWriterMobile = createCSVWriter("lighthouse-scores.csv");

  //create CSV Summary for Desktop
  const csvWriterDesktop = createCSVWriter("lighthouse-scores-desktop.csv");

  for (const url of urls) {
    try {
      const filenameMobile = `${url
        .toLowerCase()
        .replace("https://", "")
        .replace(/[^a-zA-Z0-9]/g, "_")}_mobile`;
      const filenameDesktop = `${url
        .toLowerCase()
        .replace("https://", "")
        .replace(/[^a-zA-Z0-9]/g, "_")}_desktop`;
      // Run Lighthouse with default settings
      await runLighthouse(url, filenameMobile);

      // Run Lighthouse with "--preset desktop" flag
      await runLighthouse(url, filenameDesktop, ["--preset", "desktop"]);
    } catch (error) {
      console.error(`Error running Lighthouse for ${url}:`, error);
    }
    console.log(`${url} Audit Complete`);
  }
  const summaryData = await buildSummaryData();
  csvWriterMobile
    .writeRecords(summaryData.mobileSummary)
    .catch((error) => console.error(error));
  csvWriterDesktop
    .writeRecords(summaryData.desktopSummary)
    .catch((error) => console.error(error));
  console.log("Lighthouse audit complete for all URLs");
  // Restore the original working directory
  process.chdir("..");
}

main();
