import puppeteer from "puppeteer";
import inquirer from "inquirer";
import fs from "fs";
import pdflib from "pdf-lib";
const PDFDocument = pdflib.PDFDocument;

const programPrompt = async () => {
  console.log(
    "Make sure PDFfiles folder is clear if wanting to merge multiple PDF snapshots."
  );
  const enteredValue = await inquirer.prompt({
    type: "input",
    name: "command",
    message:
      "Type 1 for a pdf snapshot of a single web page or 2 for a specific webpage's content and all webpage content it links to.",
    validate: function (input) {
      if (input === "1" || input === "2") {
        return true;
      }
      return "Not a valid command. Please enter 1 or 2.";
    },
  });

  const enteredUrl = await inquirer.prompt({
    type: "input",
    name: "url",
    message: "Enter the URL of the webpage you'd like to snapshot: ",
  });

  const isAccountDetailsRequired = await inquirer.prompt({
    type: "input",
    name: "answer",
    message:
      "Does the webpage require a username/email and password log in details? Y for Yes, N for No.",
    validate: function (input) {
      if (input === "y" || input === "Y" || input === "n" || input === "N") {
        return true;
      }
      return "Not a valid command. Please enter Y, y for Yes or N, n for No.";
    },
  });

  let accountUsername = "";
  let accountPassword = "";

  if (
    isAccountDetailsRequired.answer === "Y" ||
    isAccountDetailsRequired.answer === "y"
  ) {
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
    waitUntil: ["domcontentloaded"],
  });

  await page.waitForResponse((response) => response.status() === 200);

  if (accountUsername && accountPassword) {
    try {
      await page.type('input[type="email"]', accountUsername);
    } catch {
      try {
        await page.type('input[name="email"]', accountUsername);
      } catch (error) {
        await page.waitForSelector("#email");
        await page.type("#email", accountUsername);
        console.log(error);
      }
    }

    try {
      await page.type('input[type="password"]', accountPassword);
    } catch {
      try {
        await page.type('input[name="password"]', accountPassword);
      } catch (error) {
        await page.waitForSelector("#password");
        await page.type("#password", accountPassword);
        console.log(error);
      }
    }

    try {
      await page.click('button[type="submit"]');
    } catch {
      try {
        await page.click('button[name="submit"]');
      } catch {
        await page.waitForSelector("#submit", { visible: true });
        await page.click("#submit");
      }
    }

    await page.waitForNavigation({
      waitUntil: ["domcontentloaded"],
    });
  }

  await page.pdf({
    path: `PDFfiles/${enteredFileName.fileName}.pdf`,
    fullPage: true,
  });

  await browser.close();

  console.log(`${enteredFileName.fileName} saved to /PDFfiles.`);
};

const getPDFpages = async (userUrl, accountUsername, accountPassword) => {
  const enteredFileName = await inquirer.prompt({
    type: "input",
    name: "fileName",
    message: "Name your PDF files: ",
  });

  const mergeCheck = await inquirer.prompt({
    type: "input",
    name: "fileName",
    message:
      "Would you like to merge all PDF snapshots in /PDFfiles directory into one PDF? Y for Yes, N for No",
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

  if (accountUsername && accountPassword) {
    try {
      await page.type('input[type="email"]', accountUsername);
    } catch {
      try {
        await page.type('input[name="email"]', accountUsername);
      } catch {
        await page.waitForSelector("#email");
        await page.type("#email", accountUsername);
      }
    }

    try {
      await page.type('input[type="password"]', accountPassword);
    } catch {
      try {
        await page.type('input[name="password"]', accountPassword);
      } catch (error) {
        await page.waitForSelector("#password");
        await page.type("#password", accountPassword);
        console.log(error);
      }
    }

    try {
      await page.click('button[type="submit"]');
    } catch {
      try {
        await page.click('button[name="submit"]');
      } catch {
        await page.waitForSelector("#submit", { visible: true });
        await page.click("#submit");
      }
    }

    await page.waitForNavigation({
      waitUntil: ["domcontentloaded"],
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
      `PDFfiles/${enteredFileName.fileName}merged.pdf`,
      mergedPdfFile
    );

    console.log("PDFs merged successfully.");
  }

  if (mergeCheck === "Y" || "y") {
    mergePDFs(`PDFfiles`);
  }

  console.log(`PDF saved to ${enteredFileName.fileName}`);
  await browser.close();
};

programPrompt();
