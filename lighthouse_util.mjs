import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';
import { spawn } from 'child_process';
import minimist from 'minimist';

async function runLighthouse(url, flags = []) {
  return new Promise((resolve, reject) => {
    const lighthouseProcess = spawn('lighthouse', [url, ...flags, '--output=json']);

    let lighthouseOutput = '';
    lighthouseProcess.stdout.on('data', (data) => { 
      lighthouseOutput += data.toString();
    });

    lighthouseProcess.on('close', (code) => {
      console.log(lighthouseOutput)
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

async function main() {
  const args = minimist(process.argv.slice(2));
  let urls = [];


  if (args.f || args.file) {
    const filename = args.f || args.file;
    const fileContent = fs.readFileSync(filename, 'utf8');
    urls = fileContent.split('\n').map((url) => url.trim());
  } else {
    urls = args._; // URLs provided directly as positional arguments
  }

  if (urls.length === 0) {
    console.error('Usage: node script.js [-f <file>] <url1> <url2> ...');
    return;
  }

  const csvWriter = createObjectCsvWriter({
    path: "lighthouse-scores.csv",
    header: [
      { id: "url", title: "URL" },
      { id: "score_mobile", title: "Mobile Score" },
      { id: "score_desktop", title: "Desktop Score" },
    ],
    append: true,
  });

  for (const url of urls) {
    try {
      // Run Lighthouse with default settings
      const reportMobile = await runLighthouse(url);

      // Run Lighthouse with "--preset desktop" flag
      const reportDesktop = await runLighthouse(url, ['--preset', 'desktop']);

      const scoreMobile = reportMobile.categories.performance.score * 100;
      const scoreDesktop = reportDesktop.categories.performance.score * 100;

      // Save the reports as JSON files
      const filenameMobile = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_mobile.json`;
      const filenameDesktop = `${url.replace(/[^a-zA-Z0-9]/g, '_')}_desktop.json`;

      fs.writeFileSync(filenameMobile, JSON.stringify(reportMobile, null, 2));
      fs.writeFileSync(filenameDesktop, JSON.stringify(reportDesktop, null, 2));

      // Write scores to CSV
      const record = {
        url: url,
        score_mobile: scoreMobile,
        score_desktop: scoreDesktop,
      };

      csvWriter
        .writeRecords([record])
        .then(() => console.log(`Scores and reports for ${url} written to CSV and JSON files`))
        .catch((error) => console.error(error));
    } catch (error) {
      console.error(`Error running Lighthouse for ${url}:`, error);
    }
  }
}

main();
