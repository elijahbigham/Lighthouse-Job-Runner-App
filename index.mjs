#!/usr/bin/env node

import * as fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { spawn } from "child_process";
import minimist from "minimist";
import { parseString } from "xml2js";
import { format } from "date-fns";
import os from "os";

async function isLighthouseInstalled() {
  return new Promise((resolve, reject) => {
    const lighthouseCommand = os.platform() === "win32" ? "where" : "which";
    const lighthouseProcess = spawn(lighthouseCommand, ["lighthouse"]);

    lighthouseProcess.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function runLighthouseJSON(url, flags = []) {
  return new Promise((resolve, reject) => {
    const lighthouseProcess = spawn("lighthouse", [
      url,
      ...flags,
      "--output=json",
      '--chrome-flags="--headless --disable-gpu"',
    ]);

    let lighthouseOutput = "";
    lighthouseProcess.stdout.on("data", (data) => {
      lighthouseOutput += data.toString();
    });

    lighthouseProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const report = JSON.parse(lighthouseOutput);
          resolve(report);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`Lighthouse process exited with code ${code}`));
      }
    });
  });
}
async function runLighthouseHTML(url, outputPath, flags = []) {
  return new Promise((resolve, reject) => {
    const lighthouseProcess = spawn("lighthouse", [
      url,
      ...flags,
      "--output=html",
      "--output-path=" + outputPath,
      '--chrome-flags="--headless --disable-gpu"',
    ]);

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
function createSummaryRecord(report) {
  return {
    url: report.requestedUrl,
    score_performance: report.categories.performance.score * 100,
    score_accessibility: report.categories.accessibility.score * 100,
    score_best_practices: report.categories["best-practices"].score * 100,
    score_seo: report.categories.seo.score * 100,
    score_pwa: report.categories.pwa.score * 100,
  };
}

function writeJSONReport(report, format) {
  var filename = `${report.requestedUrl
    .toLowerCase()
    .replace("https://", "")
    .replace(/[^a-zA-Z0-9]/g, "_")}${format}.json`;
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
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

  var mobileSummary = [];
  var desktopSummary = [];

  for (const url of urls) {
    try {
      // Run Lighthouse for JSON with default settings
      const reportJSONMobile = await runLighthouseJSON(url);

      // Run Lighthouse for JSON with "--preset desktop" flag
      const reportJSONDesktop = await runLighthouseJSON(url, [
        "--preset desktop",
      ]);

      // Save the reports as JSON files
      writeJSONReport(reportJSONMobile, "mobile");
      writeJSONReport(reportJSONDesktop, "desktop");

      // Create HTML filenames
      const filenameMobile = `${url
        .toLowerCase()
        .replace("https://", "")
        .replace(/[^a-zA-Z0-9]/g, "_")}mobile.html`;
      const filenameDesktop = `${url
        .toLowerCase()
        .replace("https://", "")
        .replace(/[^a-zA-Z0-9]/g, "_")}desktop.html`;

      // Run Lighthouse with default settings
      await runLighthouseHTML(url, filenameMobile);

      // Run Lighthouse with "--preset desktop" flag
      await runLighthouseHTML(url, filenameDesktop, ["--preset desktop"]);

      //Create summaries from reports and add them the CSVs
      mobileSummary.push(createSummaryRecord(reportJSONMobile));
      desktopSummary.push(createSummaryRecord(reportJSONDesktop));
    } catch (error) {
      console.error(`Error running Lighthouse for ${url}:`, error);
    }
    console.log(`${url} Audit Complete`);
  }

  csvWriterMobile
    .writeRecords(mobileSummary)
    .catch((error) => console.error(error));
  csvWriterDesktop
    .writeRecords(desktopSummary)
    .catch((error) => console.error(error));
  console.log("Lighthouse audit complete for all URLs");
  // Restore the original working directory
  process.chdir("..");
}

main();
