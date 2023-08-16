import * as fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import { spawn } from "child_process";
import minimist from "minimist";
import { parseString } from "xml2js";
import { format } from "date-fns";
import os from "os";
import { parse } from "path";

async function isLighthouseInstalled() {
  return new Promise((resolve, reject) => {
    const lighthouseCommand = os.platform() === "win32" ? "where" : "which";
    const lighthouseProcess = spawn(lighthouseCommand, ["lighthouse"]);

    lighthouseProcess.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

async function runLighthouse(url, flags = []) {
  return new Promise((resolve, reject) => {
    const lighthouseProcess = spawn("lighthouse", [url,...flags, "--output=json", 
    "--chrome-flags=\"--headless --disable-gpu\""]);

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
      console.error(`Error opening file ${filename}:`, error.message)
   }
  } else {
    // URLs provided directly as positional arguments
    urls = args._;
  }

  if (urls.length === 0) {
    console.error("Usage: node script.js [-f <file>] <url1> <url2> ...");
    return;
  }
  return urls
}
async function createDirectory() {
  return new Promise((resolve, reject) => {
    const currentDate = new Date();
    const directoryName = `lighthouse-audit_${format(currentDate, "yyyy-MM-dd'T'HHmmssXXX")}`;
    try {
      fs.mkdirSync(directoryName)
      resolve(directoryName);
     } catch (error) {
       reject( error);
     }
  });
}

async function main() {

  //check for lighthouse installation
  const lighthouseIsInstalled = await isLighthouseInstalled();
  if (!lighthouseIsInstalled) {
    console.error("The Lighthouse package does not seem to be installed. Please run \"npm i --location=global lighthouse\" to install it globally");
    return;
  }
  let urls = parseArgs();

  const directoryName = await createDirectory();
  // Set the directory as the working directory
  process.chdir(directoryName);

  //create CSV Summary for Mobile
  const csvWriterMobile = createObjectCsvWriter({
    path: "lighthouse-scores.csv",
    header: [
      { id: "url", title: "URL" },
      { id: "score_performance", title: "Performance Score" },
      { id: "score_accessibility", title: "Accessibility Score" },
      { id: "score_best_practices", title: "Best Practices Score" },
      { id: "score_seo", title: "SEO Score" },
      { id: "score_pwa", title: "PWA Score" },
      
    ],
    append: true,
  });

  //create CSV Summary for Desktop
  const csvWriterDesktop = createObjectCsvWriter({
    path: "lighthouse-scores-desktop.csv",
    header: [
      { id: "url", title: "URL" },
      { id: "score_performance", title: "Performance Score" },
      { id: "score_accessibility", title: "Accessibility Score" },
      { id: "score_best_practices", title: "Best Practices Score" },
      { id: "score_seo", title: "SEO Score" },
      { id: "score_pwa", title: "PWA Score" },
      
    ],
    append: true,
  });

  for (const url of urls) {
    try {
      // Run Lighthouse with default settings
      const reportMobile = await runLighthouse(url);

      // Run Lighthouse with "--preset desktop" flag
      const reportDesktop = await runLighthouse(url, ["--preset", "desktop"]);

      // Save the reports as JSON files
      const filenameMobile = 
        `${url.toLowerCase().replace("https://www.", "").replace(/[^a-zA-Z0-9]/g, "_")}_mobile.json`;
      const filenameDesktop = 
        `${url.toLowerCase().replace("https://www.", "").replace(/[^a-zA-Z0-9]/g, "_")}_desktop.json`;

      fs.writeFileSync(filenameMobile, JSON.stringify(reportMobile, null, 2));
      fs.writeFileSync(filenameDesktop, JSON.stringify(reportDesktop, null, 2));
      console.log(`Reports for ${url} written to JSON files`)

      //extract summary scores (mobile)
      const scorePerformanceMobile = reportMobile.categories.performance.score * 100;
      const scoreAccessibilityMobile = reportMobile.categories.accessibility.score * 100
      const scoreBestPracticesMobile = reportMobile.categories["best-practices"].score * 100
      const scoreSEOMobile =  reportMobile.categories.seo.score * 100
      const scorePWAMobile = reportMobile.categories.pwa.score * 100

      // Write scores to CSV
      const mobileSummary = {
        url: url,
        score_performance: scorePerformanceMobile,
        score_accessibility: scoreAccessibilityMobile,
        score_best_practices: scoreBestPracticesMobile,
        score_seo: scoreSEOMobile,
        score_pwa: scorePWAMobile,
      };

      csvWriterMobile
        .writeRecords([mobileSummary])
        .then(() =>
          console.log(
            `${url} CSV Summary (Mobile) written`
          )
        )
        .catch((error) => console.error(error));

      //extract summary scores (desktop)
      const scorePerformanceDesktop = reportDesktop.categories.performance.score * 100;
      const scoreAccessibilityDesktop = reportDesktop.categories.accessibility.score * 100
      const scoreBestPracticesDesktop = reportDesktop.categories["best-practices"].score * 100
      const scoreSEODesktop =  reportDesktop.categories.seo.score * 100
      const scorePWADesktop = reportDesktop.categories.pwa.score * 100

      const desktopSummary = {
        url: url,
        score_performance: scorePerformanceDesktop,
        score_accessibility: scoreAccessibilityDesktop,
        score_best_practices: scoreBestPracticesDesktop,
        score_seo: scoreSEODesktop,
        score_pwa: scorePWADesktop,
      }

      csvWriterDesktop
        .writeRecords([desktopSummary])
        .then(() =>
          console.log(
            `${url} CSV Summary (Desktop) written`
          )
        )
        .catch((error) => console.error(error));
    } catch (error) {
      console.error(`Error running Lighthouse for ${url}:`, error);
    }
  }

  // Restore the original working directory
  process.chdir("..");
}


main();
