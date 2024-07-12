import express from 'express';
import chalk from 'chalk';
import { createServer } from './src/createServer.js';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const PORT = process.env.PORT || 5000;
  const app = await createServer();
    app.listen(PORT, () => {
        // console.log(chalk.green(`Server running on port ${PORT}`));
    });
}

startServer();