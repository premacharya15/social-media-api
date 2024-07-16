import express from 'express';
import chalk from 'chalk';
import mongoose from 'mongoose';
import { json, urlencoded } from 'express';
import authRoutes from './routes/authRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import cors from 'cors';

export async function createServer() {
  console.log(' ')
  console.log(chalk.blue('--- Starting Express Server ---'));
  console.log(' ')
  console.log(' ')

  // Initialize the app
  const app = express();

  // Configure CORS
  app.use(cors({
    origin: '*', // This allows all domains. For production, specify allowed domains.
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify HTTP methods allowed.
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Database Connection
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(chalk.yellow('Database:'),chalk.bold.green('connected successfully 🥳'));
  } catch (error) {
    console.log(chalk.yellow('Database:'),chalk.bold.red('Connection Failed:', error));
  }

  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Routes with versioning
  app.use('/api/v1/auth', authRoutes);

  // Basic route
  app.get('/', (req, res) => {
    res.status(200).send('Social Media API');
  });

  // Error handling middleware
  app.use(errorHandler);

  // Start the server
  console.log(chalk.yellow('Express Status:'), chalk.bold.green('Running'));
  console.log(' ')
  console.log(chalk.yellow('App listening on:'), chalk.bold.green(`http://localhost:${process.env.PORT || 5000}`));

  return app;
}