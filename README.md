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

This package is a utility script designed to generate Zod schemas from PostgreSQL tables. It connects to a PostgreSQL database, retrieves table schema information, and generates corresponding Zod schemas. Zod is a JavaScript library for data validation, and this script helps automate the process of creating these validation schemas based on existing database structures. The generated schemas are written to TypeScript files and can be used for validating data before it's inserted into the database. The script supports various data types, handles nullable and default values, and even supports enum types. It also provides options to exclude columns with default values and include nullable columns.

## Getting Started <a name = "getting_started"></a>

To get started with this npm package, first ensure you have Node.js and npm installed on your system. Once that's done, you can install the package in your terminal.

### Prerequisites

### Installing

```
npm install -g pgtozod
```

### Usage <a name = "usage"></a>

You can use pgtozod by running the following command:

Replace `<table_name>` with the name of the table you want to generate a schema for. If you want to generate schemas for all tables, use `all` as the table name.

## Options

- `-t, --table <name>`: Specify the table name. Use 'all' to generate schemas for all tables. This option is required.
- `-e, --exclude-defaults`: Exclude database columns that have a default value configured. This option is optional.
- `-n, --nullable`: Include nullable columns. This option is optional.
- `-s, --schema <name>`: Specify the schema name. The default value is 'public'. This option is optional.
- `-o, --output <path>`: Specify the output path. The default value is './schemas'. This option is optional.
- `-r, --reset`: Set new database connection details. This option is optional.

### Additional commands

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
