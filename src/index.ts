import fs from "fs";
import path, { join } from "path";
import csv from "csv-parser";
import FormData from "form-data";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CITY_DATA_FOLDER=/Users/o2ux_violet/Downloads/moyo/cities
// 폴더 안에 cities.csv 및 도시별 이미지가 각각의 폴더 안에 있어야 한다.
const cityDataDirName = process.env.CITY_DATA_FOLDER;

const strapiUrl = process.env.STRAPI_URL || "http://localhost:1337"; // Strapi URL
const apiToken = process.env.STRAPI_API_TOKEN;

if (!apiToken) {
  throw new Error("env.STRAPI_API_TOKEN is required");
}

const initDefaultData = async () => {
  // await run(`${strapiUrl}/api/travel-types`, "travel_types");
  // await run(`${strapiUrl}/api/companion-types`, "companion_types");
  // await run(`${strapiUrl}/api/companion-review-types`, "companion_review_types");
  // await run(`${strapiUrl}/api/notification-types`, "notification_types");

  if (cityDataDirName && fs.existsSync(cityDataDirName)) {
    await uploadCities(cityDataDirName, "cities.csv");
  }
};

const run = async (apiUrl: string, filename: string) => {
  try {
    console.log(`Initialize table with default values:: ${apiUrl}`);

    const existingEntitiesResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });
    const existingEntities = (await existingEntitiesResponse.json()) as {
      data: Record<string, any>[];
    };

    if (existingEntities.data.length > 0) {
      console.log("Table is not empty, no data inserted.");
      return;
    }

    const results: ({ name: string } & Record<string, unknown>)[] = [];
    const filePath = path.join(process.cwd(), `data/${filename}.csv`);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        console.log("@@@ inserting", results);

        for (const row of results) {
          if (!row.name) continue;

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${apiToken}`,
            },
            body: JSON.stringify({ data: row }),
          });
          if (!response.ok) {
            console.log(
              `${row.data} Data inserting failed.`,
              response.status,
              await response.text(),
            );
            continue;
          }
          console.log("Data inserted successfully.");
        }
      });
  } catch (error) {
    console.error("An error occurred while inserting data.", error);
  }
};
type CityRow = {
  category1: string;
  category2: string;
  country: string;
  city?: string | null;
  image_exists: string;
  filepath: string;
  updated_at: string;
};

const checkIfFileExists = (filepath: string) => {
  const absolutePath = path.resolve(__dirname, filepath); // Use absolute path
  if (!fs.existsSync(absolutePath))
    throw new Error(`File is not exists: ${absolutePath}`);
  try {
    fs.accessSync(absolutePath, fs.constants.R_OK);
  } catch (err) {
    throw new Error(`File not readable: ${absolutePath}`);
  }
  return absolutePath;
};

const uploadCities = async (dirname: string, filename: string) => {
  const prefix = "[City Data Update] ";
  const apiUrl = `${strapiUrl}/api/destinations`;

  try {
    console.log(prefix + `Upload cities with default values:: ${apiUrl}`);

    let lastUpdatedAt = "2025-01-01";
    const lastDateFilePath = join(process.cwd(), "data/city_updated_at.txt");

    if (fs.existsSync(lastDateFilePath)) {
      const savedDate = fs.readFileSync(lastDateFilePath, "utf-8");
      lastUpdatedAt = savedDate;
    }
    console.log(prefix + "[lastUpdatedAt]", lastUpdatedAt, lastDateFilePath);

    const results: CityRow[] = [];
    const filePath = path.join(dirname, filename);
    if (!fs.existsSync(filePath)) {
      console.log(prefix + "No data file found.");
      return;
    }

    const rows = await new Promise<CityRow[]>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", async () => {
          resolve(
            results
              .filter((e) => e.updated_at.localeCompare(lastUpdatedAt) > 0)
              .filter(
                (e) =>
                  e.category1 &&
                  e.category2 &&
                  e.country &&
                  e.image_exists.toLowerCase() === "o" &&
                  e.filepath &&
                  e.updated_at,
              ),
          );
        })
        .on("error", (err) => reject(err));
    });

    if (rows.length === 0) {
      console.log(
        prefix + "There's no new cities after updated on ",
        lastUpdatedAt,
      );
      return;
    }

    console.log(
      prefix + "Found cities to update",
      rows.map(
        (e) =>
          `${e.country}/${e.city} - image: ${e.filepath} - updated_at: ${e.updated_at}`,
      ),
      `${apiUrl}/${apiToken}`,
    );

    rows.forEach((row) => checkIfFileExists(row.filepath));

    const existingEntitiesResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
    });

    if (!existingEntitiesResponse.ok) {
      // Check for HTTP errors (status codes outside 200-299)
      const errorText = await existingEntitiesResponse.text(); // Get the error message
      console.error(
        `Strapi API Error: ${existingEntitiesResponse.status} - ${errorText}`,
      );
      // Handle the error appropriately (e.g., throw an exception, return an empty array)
      return; // Or throw new Error(`Strapi API Error: ${existingEntitiesResponse.status}`);
    }
    const existingEntities = (await existingEntitiesResponse.json()) as {
      data: Record<string, any>[];
    };

    for (const row of rows) {
      const chunk = row.filepath.split("/");
      const mediaUploaded = await uploadFile(
        join(dirname, row.filepath),
        chunk.at(-1)!,
      );

      if (!mediaUploaded?.id) continue;

      const category1 = chunk[0];
      const category2 = chunk[1];

      const existingEntity = existingEntities.data.find(
        (e: any) =>
          e.country === row.country && (e.city ? e.city === row.city : true),
      );

      if (existingEntity) {
        console.log(
          prefix +
            ` ${row.country}/${row.city} already exists. It updates image only...`,
        );

        await fetch(`${apiUrl}/${existingEntity.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ data: { image: mediaUploaded.id } }),
        });
      } else {
        console.log(prefix + `${row.country}/${row.city} will be created...`);

        await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            data: {
              country: row.country,
              city: row.city ?? null,
              disabled: false,
              category1,
              category2,
              image: mediaUploaded.id,
            },
          }),
        });
      }
    }
    console.log(prefix + "City updated successfully.");

    const todayDate = new Date().toISOString().split("T")[0];

    fs.writeFileSync(lastDateFilePath, todayDate, "utf-8");
  } catch (error) {
    console.error(prefix + "An error occurred while inserting cities.", error);
  }
};

const uploadFile = async (
  filepath: string,
  filename: string,
  mimeType = "image/png",
) => {
  if (!apiToken) throw new Error("env.STRAPI_API_TOKEN is needed");

  try {
    const absolutePath = checkIfFileExists(filepath);

    const form = new FormData();
    // const readStream = fs.createReadStream(absolutePath);
    // readStream.on("error", (err) => {
    //   console.error("File stream error:", err);
    //   return; // Or throw the error
    // });
    // const fileSize = readStream.readableLength;
    // form.append("files", readStream, {
    //   filename,
    //   contentType: mimeType,
    //   knownLength: fileSize,
    // });
    form.append("files", fs.createReadStream(absolutePath));

    const headers = form.getHeaders();
    console.log("headers", headers, "readable", form.readable);

    const response = await fetch(`${strapiUrl}/api/upload`, {
      method: "POST",
      body: form,
      headers: {
        ...headers,
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      // Check for HTTP errors (status codes outside 200-299)
      const errorText = await response.text(); // Get the error message
      console.error(`Strapi API Error: ${response.status} - ${errorText}`);
      // Handle the error appropriately (e.g., throw an exception, return an empty array)
      throw new Error(`Strapi API Error: ${response.status} - ${errorText}`);
    }

    const json = (await response.json()) as { id: number }[];

    console.log(">>> file uploaded successfully", json);
    return json[0] as { id: number };
  } catch (error) {
    console.error(">>> file uploading failed", error);
    throw error;
  }
};

// Call the initialization function (e.g., in your main app file)
initDefaultData();
