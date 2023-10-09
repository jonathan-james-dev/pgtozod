<h1 align="center">pgtozod</h1>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![GitHub Issues](https://img.shields.io/github/issues/jonathan-np-dev/pgtozod.svg)](https://github.com/jonathan-np-dev/pgtozod/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/jonathan-np-dev/pgtozod.svg)](https://github.com/jonathan-np-dev/pgtozod/pulls)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)

</div>

---

<p align="center"> Generate Zod schemas's from a PostgreSQL database.
    <br> 
</p>

## Table of Contents

- [About](#about)
- [Getting Started](#getting_started)
- [Usage](#usage)
- [Built Using](#built_using)
- [Authors](#authors)

## About <a name = "about"></a>

An opinionated utility script designed to generate Zod schemas from PostgreSQL tables. It connects to a PostgreSQL database, retrieves table schema information, and generates corresponding Zod schemas.

These generated schemas are useful for form validation, schemas are generated for both inserting and updating,

I mainly create this to save time creating and configuring up zod schemas from my [Sveltekit](https://kit.svelte.dev/) which uses [SuperForms](https://superforms.rocks/) easy form management.

There is plenty of room for improvement:

- Support for other databases
- More modular code
- Handle more datatypes and default values

Feel free to contribute, fork or post an issue...

## Getting Started <a name = "getting_started"></a>

To get started with this npm package, first ensure you have Node.js and npm installed on your system. Once that's done, you can install the package in your terminal.

### Installing

```
npm install -g pgtozod
```

## Usage <a name = "usage"></a>

You can use pgtozod by running the following command:

```
pgtozod --table <table_name> [--exclude-defaults] [--nullable] [--schema <schema_name>] [--output <output_path>] [--reset] [--help] [--ver]
```

Replace `<table_name>` with the name of the table you want to generate a schema for. If you want to generate schemas for all tables, use `all` as the table name.

## Options

- `-t, --table <name>`: Specify the table name. Use 'all' to generate schemas for all tables. This option is required.
- `-e, --exclude-defaults`: Exclude database columns that have a default value configured. This option is optional.
- `-n, --nullable`: Include nullable columns. This option is optional.
- `-s, --schema <name>`: Specify the schema name. The default value is 'public'. This option is optional.
- `-o, --output <path>`: Specify the output path. The default value is './schemas'. This option is optional.

### Additional commands

- `-r, --reset`: Set new database connection details. This option is optional.
- `-h, --help`: Show command help.
- `-v, --ver`: Get current version.

## Examples

Generate a schema for the 'users' table:

```
pgtozod --table users
```

Generate a schema for the 'users' table and include nullable columns:

```
pgtozod --table users --nullable
```

Generate a schema for the 'users' table in the 'public' schema:

```
pgtozod --table users --schema public
```

Generate a schema for the 'users' table and output it to the './schemas' directory:

```
pgtozod --table users --output ./schemas
```

## Datatype Support

pgtozod currenty supports the following coversions. Note that `zodDateOnly` and `zodUtcDate` are custom types that will be included in the generated output.

<br>

| PostgreSQL Data Type     | Converted To | Supported Default Values                                                                                    |
| ------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------- |
| integer                  | z.number()   | Any numeric value, direct number format (e.g., default 1)                                                   |
| bigint                   | z.number()   | Any numeric value, direct number format (e.g., default 1)                                                   |
| numeric                  | z.number()   | Any numeric value, direct number format (e.g., default 1)                                                   |
| smallint                 | z.number()   | Any numeric value, direct number format (e.g., default 1)                                                   |
| double precision         | z.number()   | Any numeric value, direct number format (e.g., default 1)                                                   |
| boolean                  | z.boolean()  | true, false                                                                                                 |
| character varying        | z.string()   | Any string value, minimum length of 1                                                                       |
| text                     | z.string()   | Any string value, minimum length of 1                                                                       |
| character                | z.string()   | Any string value, specific length (e.g., character(5))                                                      |
| date                     | zodDateOnly  | now()::date, current_date, ('now'::text)::date, 'YYYY-MM-DD'::date                                          |
| timestamp with time zone | zodUtcDate   | (now() at time zone 'utc'::text), now(), current_timestamp, 'YYYY-MM-DD HH:MI:SS'::timestamp with time zone |
| enum types               | z.enum()     | Any value from the enum, default value from the enum                                                        |
| array types              | z.array()    | Not specified                                                                                               |
| uuid                     | zodUUID      | Not specified                                                                                               |
| other                    | z.unknown()  | Not specified                                                                                               |

<br>

### Custom schema types

---

**`zodUtcDate`**:

- It checks if the input value is a Date object.
- If the input is a Date object, it transforms it into UTC format. This is done by creating a new Date object with the year, month, date, hours, minutes, and seconds of the input date in UTC.
- If the input is not a Date object, it adds an issue to the context with a custom error message.
- If no value is provided, it defaults to the current date and time.
  <br><br>

Source:

```ts
export const zodUtcDate = z
  .custom((val) => val instanceof Date, { message: "Must be a Date object" })
  .transform((arg: unknown, ctx: RefinementCtx) => {
    if (arg instanceof Date) {
      // Convert the date to UTC
      return new Date(
        Date.UTC(
          arg.getFullYear(),
          arg.getMonth(),
          arg.getDate(),
          arg.getHours(),
          arg.getMinutes(),
          arg.getSeconds()
        )
      );
    }
    return ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be a Date object",
    });
  })
  .default(() => new Date());
```

<br>

**`zodDateOnly`**:

This schema checks if the input value is a Date object representing a date without a time component. This means the hours, minutes, seconds, and milliseconds of the date are all zero. If the input is not a Date object or if it has a time component, it returns false.
<br><br>

Source:

```ts
export const zodDateOnly = z.custom<Date>(
  (value) => {
    if (!(value instanceof Date)) {
      return false;
    }

    return (
      value.getHours() === 0 &&
      value.getMinutes() === 0 &&
      value.getSeconds() === 0 &&
      value.getMilliseconds() === 0
    );
  },
  { message: "Expected a date without time component" }
);
```

<br>

**`zodUUID`**:
<br>
It checks if the input value is a string and matches the UUID format.

- If the input is not a string or does not match the UUID format, it adds an issue to the context with a custom error message.

- The error message includes a readable name for the UUID, which is provided as a parameter to the zodUUID function.
  <br><br>

Source:

```ts
export const zodDateOnly = z.custom<Date>(
  (value) => {
    if (!(value instanceof Date)) {
      return false;
    }

    return (
      value.getHours() === 0 &&
      value.getMinutes() === 0 &&
      value.getSeconds() === 0 &&
      value.getMilliseconds() === 0
    );
  },
  { message: "Expected a date without time component" }
);
```

This custom schema type can be used to validate UUIDs in your data. The `readableName` parameter allows you to customize the error message for better readability and understanding.

## Configuration

The first time you run pgtozod, you will be prompted to enter your PostgreSQL database connection details. These details will be saved in a configuration file in your home directory. If you want to reset these details, run `pgtozod` with only the `--reset` option.

The configuration file includes the following details:

```json
{
  "DB_USER": "<USER>",
  "DB_HOST": "<HOST>",
  "DB_NAME": "<DATABASE_NAME>",
  "DB_PASSWORD": "<PASSWORD>",
  "DB_PORT": "5432"
}
```

## Exit

When the process exits, any database connections will be released.

## Built Using <a name = "built_using"></a>

- [Node](https://nodejs.org/en/)

## Authors <a name = "authors"></a>

- [@jonathan-np-dev](https://github.com/jonathan-np-dev) - Idea & Initial work

See also the list of [contributors](https://github.com/jonathan-np-dev/pgtozod/contributors) who participated in this project.
