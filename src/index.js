#!/usr/bin/env node

/*
 * This file is part of ProjectName, licensed under the MIT License (MIT).
 * See the LICENSE file in the project root for more information.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const { program } = require("commander");
const readline = require("readline");
const createPool = require("./db.js");
const utilFilePath = path.resolve(__dirname, "types.ts.txt"); // Path to util.ts.txt file

let client;

function camelCase(str) {
  return str.replace(/_([a-z])/g, function (g) {
    return g[1].toUpperCase();
  });
}

function getReadableNameFromSnakeCase(snakeCaseName) {
  let nameWithoutId = snakeCaseName;
  if (snakeCaseName.toLowerCase().endsWith("id")) {
    nameWithoutId = snakeCaseName.slice(0, -2); // remove 'Id' from the end
  }
  return nameWithoutId.trim().split("_").map(capitalizeFirstLetter).join(" ");
}

async function getAllTables(schema) {
  const tableQuery = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schema}';
  `;

  const res = await client.query(tableQuery);
  return res.rows.map((row) => row.table_name);
}

async function getEnumTypes() {
  const enumQuery = `
    SELECT t.typname AS enum_name, e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    ORDER BY t.typname, e.enumsortorder;
  `;

  const res = await client.query(enumQuery);
  const enums = {};

  res.rows.forEach((row) => {
    if (!enums[row.enum_name]) enums[row.enum_name] = [];
    enums[row.enum_name].push(row.enum_value);
  });

  return enums;
}

function parseDefaultValue(value, dataType, enums) {
  switch (dataType) {
    case "integer":
    case "bigint":
    case "numeric":
    case "smallint":
    case "double precision":
      const numberMatch = value.match(
        /^'([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)'::\w+$/
      );
      if (numberMatch) {
        return Number(numberMatch[1]);
      } else {
        // Direct number format like: default 1
        const directNumberMatch = value.match(
          /^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)$/
        );
        if (directNumberMatch) {
          return Number(directNumberMatch[1]);
        }
      }
      console.warn(`Unhandled default value format for numeric type: ${value}`);
      return undefined;
    case "boolean":
      return value === "true";
    case "character varying":
    case "text":
      // strip single quotes from string default values
      return `'${value.replace(/^'(.*)'$/, "$1")}'`;
    case "date":
      if (value.toLowerCase() === "now()::date") {
        return "new Date()";
      } else if (value.toLowerCase() === "current_date") {
        return "new Date()";
      } else if (value.toLowerCase() === "('now'::text)::date") {
        return "new Date()";
      } else if (value.toLowerCase().match(/^'(\d{4}-\d{2}-\d{2})'::date$/)) {
        // Matches date strings in the format 'YYYY-MM-DD'
        const dateMatch = value
          .toLowerCase()
          .match(/^'(\d{4}-\d{2}-\d{2})'::date$/);
        return `new Date('${dateMatch[1]}')`;
      }
      console.warn(`Unhandled default value for date type: ${value}`);
      return undefined;
    case "timestamp with time zone":
      if (
        value.toLowerCase() === "(now() at time zone 'utc'::text)".toLowerCase()
      ) {
        return "new Date()";
      } else if (value.toLowerCase() === "now()") {
        return "new Date()";
      } else if (value.toLowerCase() === "current_timestamp") {
        return "new Date()";
      } else if (
        value
          .toLowerCase()
          .match(
            /^'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'::timestamp with time zone$/
          )
      ) {
        // Matches timestamp strings in the format 'YYYY-MM-DD HH:MI:SS'
        const timestampMatch = value
          .toLowerCase()
          .match(
            /^'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})'::timestamp with time zone$/
          );
        return `new Date('${timestampMatch[1]}')`;
      }
      console.warn(
        `Unhandled default value for timestamp with time zone type: ${value}`
      );
      return undefined;
    default:
      // Check if the column_default is an enum type
      for (const enumName in enums) {
        if (value.endsWith(`::${enumName}`)) {
          // Extract and return the enum value
          return `'${value.split("'")[1]}'`;
        }
      }
      console.warn(`Unhandled data type for default value: ${dataType}`);
      return undefined;
  }
}

async function getTableSchema(tableName, includeNullable = false) {
  console.log(chalk.gray(`Generating schema for table: ${tableName}`));

  const columnQuery = `
    SELECT column_name, data_type, is_nullable, column_default, udt_name, is_identity
    FROM information_schema.columns 
    WHERE table_name = '${tableName}';
  `;

  const res = await client.query(columnQuery);
  const enums = await getEnumTypes();
  const excludeDefaults = options.excludeDefaults;

  let schema = `import { z } from 'zod';\nimport { zodUtcDate, zodDateOnly } from './types';\n\n`;
  let schemaEntries = [];
  let identityColumnEntry = null;

  schema += `const ${tableName}Schema = z.object({\n`;

  res.rows.forEach((column) => {
    const { column_name, data_type, is_nullable, column_default, udt_name } =
      column;

    if (excludeDefaults && column_default !== null) {
      return;
    }

    if (is_nullable === "NO" || includeNullable) {
      let type;
      if (enums[udt_name]) {
        type = `z.enum([${enums[udt_name].map((v) => `'${v}'`).join(", ")}])`;
      } else if (data_type.endsWith("[]")) {
        type = `z.array(${getTypeForDataType(
          data_type.slice(0, -2),
          enums,
          column_name,
          udt_name
        )})`;
      } else {
        type = getTypeForDataType(data_type, enums, column_name, udt_name);
      }

      if (column_default !== null) {
        const defaultValue = parseDefaultValue(
          column_default,
          data_type,
          enums
        );
        if (defaultValue !== undefined && defaultValue !== NaN) {
          type += `.default(${defaultValue})`; // Set default here only once.
        }
      }

      if (is_nullable === "YES") {
        type += `.optional()`;
      }

      const entry = { key: camelCase(column_name), value: type };

      // Check if the column is an identity column
      if (column.is_identity && column.is_identity === "YES") {
        identityColumnEntry = entry;
      } else {
        schemaEntries.push(entry);
      }
    }
  });

  schemaEntries.sort((a, b) => a.key.localeCompare(b.key));

  if (identityColumnEntry) {
    schemaEntries.unshift(identityColumnEntry);
  }

  console.log(chalk.gray(`Processed ${schemaEntries.length} columns`));

  const tableData = res.rows
    .filter((x) =>
      schemaEntries.some((entry) => entry.key === camelCase(x.column_name))
    )
    .map((column) => ({
      "Column Name": column.column_name,
      "Data Type": column.data_type,
      "Is Nullable": column.is_nullable,
      "Column Default": column.column_default,
      "UDT Name": column.udt_name,
      "Is Identity": column.is_identity,
    }));

  console.table(tableData);

  schema += schemaEntries
    .map((entry) => `  ${entry.key}: ${entry.value},`)
    .join("\n");

  schema += `});\n\nexport type ${capitalizeFirstLetter(
    tableName
  )}Type = z.infer<typeof ${tableName}Schema>;\n`;

  // Write the schema to a file
  const schemaDir = path.resolve(__dirname, options.output); // Use the output option
  fs.mkdirSync(schemaDir, { recursive: true }); // Ensure the directory exists
  fs.writeFileSync(path.join(schemaDir, `${tableName}.ts`), schema);

  console.log(
    chalk.gray(
      `Added schema to the output directory: ${chalk.white(
        path.join(schemaDir, `${tableName}.ts`)
      )}`
    )
  );
}

function getTypeForDataType(dataType, enums, columnName, udt_name) {
  let readableName = getReadableNameFromSnakeCase(columnName);

  if (enums[udt_name]) {
    const defaultEnum = column_default
      ? parseDefaultValue(column_default, data_type, enums)
      : `'${enums[udt_name][0]}'`;
    return `z.enum([${enums[udt_name]
      .map((v) => `'${v}'`)
      .join(", ")}]).default(${defaultEnum})`;
  } else if (dataType.startsWith("character varying") || dataType === "text") {
    return `z.string().min(1, '${readableName} is required')`;
  } else if (
    dataType === "integer" ||
    dataType === "bigint" ||
    dataType === "numeric" ||
    dataType === "smallint" ||
    dataType === "double precision"
  ) {
    return `z.number().gt(0, '${readableName} is required')`;
  } else if (dataType === "boolean") {
    return "z.boolean()";
  } else if (dataType === "timestamp with time zone") {
    return "zodUtcDate";
  } else if (dataType === "date") {
    return "zodDateOnly";
  } else {
    console.warn(
      chalk.warn(`Unsupported data type: ${dataType} for column: ${columnName}`)
    );
    return "z.unknown()";
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function validateTableName(tableName) {
  // Check for invalid characters
  const invalidChars = /[^a-zA-Z0-9_-]/g;
  if (invalidChars.test(tableName)) {
    return false;
  }

  // Check for reserved words
  const reservedWords = ["select", "delete", "update"]; // Add more reserved words here
  if (reservedWords.includes(tableName.toLowerCase())) {
    return false;
  }

  return true;
}

async function main() {
  try {
    console.log(chalk.gray("Connecting to database..."));
    client = await createPool().connect();
    const tableName = options.table;
    const includeNullable = options.nullable;
    const schemaName = options.schema;

    if (tableName === "all") {
      const allTables = await getAllTables(schemaName);
      for (const table of allTables) {
        await getTableSchema(table, includeNullable);
      }
    } else {
      await getTableSchema(tableName, includeNullable);
    }

    // Copy util.ts.txt to output directory and rename it to util.ts
    const schemaDir = path.resolve(__dirname, options.output); // Use the output option
    fs.copyFile(utilFilePath, path.join(schemaDir, "types.ts"), (err) => {
      if (err) throw err;
      console.log(
        chalk.gray(
          `Added custom zod types to the output directory: ${chalk.white(
            path.join(schemaDir, "types.ts")
          )}`
        )
      );
    });
  } catch (err) {
    console.error(chalk.red("Error running script", err));
  } finally {
    await client.end();
  }
}

program
  .version("0.0.1", "-v, --vers", chalk.yellow("Output the current version"))
  .helpOption("-h, --help", chalk.yellow("Display help for commands"))
  .description(
    chalk.green("pgtozod: Generate zod schemas from postgresql tables")
  )
  .option(
    "-t, --table <name>",
    chalk.yellow(
      "Table name. Use 'all' to generate schemas for all tables - " +
        chalk.dim.bold.italic("(Required)")
    )
  )
  .option(
    "-e, --exclude-defaults",
    chalk.yellow(
      "Exclude db columns that have a default value configured - " +
        chalk.dim.italic("(Optional)")
    ),
    false
  )
  .option(
    "-n, --nullable",
    chalk.yellow(
      "Include nullable columns - " + chalk.dim.italic("(Optional)")
    ),
    false
  )
  .option(
    "-s, --schema <name>",
    chalk.yellow("Schema name - " + chalk.dim.italic("(Optional)")),
    "public"
  )
  .option(
    "-o, --output <path>",
    chalk.yellow("Output path - " + chalk.dim.italic("(Optional)")),
    "./schemas"
  ) // Default to './schemas'
  .option(
    "-r, --reset",
    chalk.yellow(
      "Set new database connection details - " + chalk.dim.italic("(Optional)")
    )
  )
  .on("--help", () => {
    console.log(chalk.cyan("\nExamples:"));
    console.log(chalk.magenta("  $ npm pgtozod --table users"));
    console.log(chalk.magenta("  $ npm pgtozod --table users --nullable"));
    console.log(chalk.magenta("  $ npm pgtozod --table users --schema public"));
    console.log(
      chalk.magenta("  $ npm pgtozod --table users --output ./schemas")
    );
  })
  .parse(process.argv);

const options = program.opts();

if (!options.table || !validateTableName(options.table)) {
  console.error(
    chalk.red(
      "Error: The --table option is required and must be a valid table name."
    )
  );
  console.log(program.helpInformation());
  process.exit(1);
}

const configDir = path.join(os.homedir(), ".pgtozod");
if (!fs.existsSync(configDir)) {
  console.log(chalk.gray("Creating config directory: "), configDir);
  fs.mkdirSync(configDir);
}

const configPath = path.join(configDir, "config.json");
let config = {};

if (fs.existsSync(configPath)) {
  console.log(chalk.gray("Reading config file: "), configPath);
  const rawData = fs.readFileSync(configPath);
  config = JSON.parse(rawData);
}

if (
  options.reset ||
  !config ||
  !config.DB_USER ||
  !config.DB_HOST ||
  !config.DB_NAME ||
  !config.DB_PASSWORD ||
  !config.DB_PORT
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    "You first need to provide your PostgreSQL database connection details.\n\n"
  );

  rl.question("Enter your PostgreSQL user: ", (user) => {
    config.DB_USER = user;
    rl.question("Enter your PostgreSQL host: ", (host) => {
      config.DB_HOST = host;
      rl.question("Enter your PostgreSQL database name: ", (database) => {
        config.DB_NAME = database;
        rl.question("Enter your PostgreSQL password: ", (password) => {
          config.DB_PASSWORD = password;
          rl.question("Enter your PostgreSQL port: ", (port) => {
            config.DB_PORT = port;
            rl.close();
            console.log(chalk.gray("Saving config file: "), configPath, config);
            fs.writeFileSync(configPath, JSON.stringify(config));
            main();
          });
        });
      });
    });
  });
} else {
  main();
}

process.on("exit", () => {
  if (client) {
    client.release();
  }
});
