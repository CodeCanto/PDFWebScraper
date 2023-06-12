import puppeteer from "puppeteer";
import inquirer from "inquirer";
import fs from "fs";
import pkg from "pdf-lib";
const PDFDocument = pkg.PDFDocument;

const programPrompt = async () => {
  const enteredValue = await inquirer.prompt({
    type: "input",
    name: "command",
    message:
      "Type 1 for a pdf snapshot of a single web page or 2 for a specific webpage's content and all webpage content it links to.",
  });

  const enteredUrl = await inquirer.prompt({
    type: "input",
    name: "url",
    message: "Enter the URL of the webpage you'd like to snapshot: ",
  });

  const isAccountDetailsRequired = await inquirer.prompt({
    type: "input",
    name: "url",
    message:
      "Does the webpage require a username/email and password log in details? Y for Yes, N for No.",
  });

  let accountUsername = "";
  let accountPassword = "";

  if (isAccountDetailsRequired === "Y" || isAccountDetailsRequired === "y") {
    accountUsername = await inquirer.prompt({
      type: "input",
      name: "userName",
      message: "Please enter your login account/email name: ",
    });

    accountPassword = await inquirer.prompt({
      type: "input",
      name: "password",
      message: "Please enter your login password: ",
    });
  }

  if (enteredValue.command === "1") {
    getPDFpage(
      enteredUrl.url,
      accountUsername.userName,
      accountPassword.password
    );
  } else if (enteredValue.command === "2") {
    getPDFpages(
      enteredUrl.url,
      accountUsername.userName,
      accountPassword.password
    );
  } else {
    console.log("That is not a valid command. Try again, CTRL+C to quit.");
    programPrompt();
  }
};

const getPDFpage = async (userUrl, accountUsername, accountPassword) => {
  const enteredFileName = await inquirer.prompt({
    type: "input",
    name: "fileName",
    message: "Name your PDF file: ",
  });

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  await page.goto(userUrl, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForResponse((response) => response.status() === 200);

  if (accountUsername && accountPassword) {
    await page.waitForSelector("#email");
    await page.type("#email", accountUsername);
    await page.type("#password", accountPassword);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
    });
  }

  await page.pdf({
    path: `PDFfiles/${enteredFileName.fileName}.pdf`,
    fullPage: true,
  });

  await browser.close();

  console.log(`${enteredFileName.fileName} saved.`);
};

const getPDFpages = async (userUrl, accountUsername, accountPassword) => {
  const enteredFileName = await inquirer.prompt({
    type: "input",
    name: "fileName",
    message: "Name your PDF file: ",
  });

  const mergeCheck = await inquirer.prompt({
    type: "input",
    name: "fileName",
    message:
      "Would you like to merge all PDF snapshots into one PDF? Y for Yes, N for No",
  });

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  await page.goto(userUrl, {
    waitUntil: "domcontentloaded",
  });

  let pageNum = 1;

  await page.pdf({
    path: `PDFfiles/${enteredFileName.fileName}${pageNum}.pdf`,
    fullPage: true,
  });
  pageNum++;

  await page.waitForResponse((response) => response.status() === 200);

  //feature: possible selectors
  if (accountUsername && accountPassword) {
    await page.waitForSelector("#email");
    await page.type("#email", accountUsername);
    await page.type("#password", accountPassword);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
    });
  }

  const links = await page.$$("a");
  const hrefs = await Promise.all(
    links.map(async (link) => {
      const hrefProperty = await link.getProperty("href");
      const hrefValue = await hrefProperty.jsonValue();
      return hrefValue;
    })
  );

  for (let link of hrefs) {
    const newPage = await browser.newPage();
    await newPage.goto(link);
    await newPage.pdf({
      path: `PDFfiles/${enteredFileName.fileName}${pageNum}.pdf`,
      fullPage: true,
    });
    pageNum++;
    await newPage.close();
  }

  async function mergePDFs(directory) {
    let files = await fs.promises.readdir(directory);
    files = files.filter((file) => file.endsWith(".pdf"));

    files.sort((a, b) => {
      const numberA = parseInt(a.match(/\d+/g).pop(), 10);
      const numberB = parseInt(b.match(/\d+/g).pop(), 10);
      return numberA - numberB;
    });

    const mergedPdf = await PDFDocument.create();

    for (const pdfFile of files) {
      const pdfBytes = await fs.promises.readFile(`PDFfiles/${pdfFile}`);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(
        pdfDoc,
        pdfDoc.getPageIndices()
      );
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }

    const mergedPdfFile = await mergedPdf.save();
    await fs.promises.writeFile(
      `${enteredFileName.fileName}.pdf`,
      mergedPdfFile
    );

    console.log("PDFs merged successfully.");
  }

  //feature: after merged delete all other pdfs

  if (mergeCheck === "Y" || "y") {
    mergePDFs("PDFfiles");
  }

  console.log(
    "Process finished, please clear directory for next time to accurately merge pdfs."
  );
  await browser.close();
};

programPrompt();
