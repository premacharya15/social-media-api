import express from 'express';
import chalk from 'chalk';
import mongoose from 'mongoose';
import { json, urlencoded } from 'express';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import cors from 'cors';
import client from './utils/redisClient.js';

export async function createServer() {
  console.log(' ')
  console.log(chalk.blue('--- Starting Express Server ---'));
  console.log(' ')

  // Initialize the app
  const app = express();

  // Configure CORS
  app.use(cors({
    origin: '*', // This allows all domains. For production, specify allowed domains.
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify HTTP methods allowed.
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Start the server
  console.log(chalk.yellow('Express Status:'), chalk.bold.green('Running'));

  // Database Connection
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(chalk.yellow('Database Status:'), chalk.bold.green('connected'));
  } catch (error) {
    console.log(chalk.yellow('Database Status:'), chalk.bold.red('Connection Failed:', error));
  }


  // Check Redis connection
  client.on('connect', () => {
    console.log(chalk.yellow('Redis Status:'), chalk.bold.green('Connected'));
    console.log(chalk.yellow('Redis listening on:'), chalk.bold.green('http://localhost:8001'));
  });

  client.on('error', (err) => {
    console.log(chalk.yellow('Redis Status:'), chalk.bold.red('Disconnected'));
    console.log(chalk.yellow('Redis Error:'), chalk.bold.red(`Disconnected - ${err}`));
  });

  // Immediately check Redis connection status
  console.log(chalk.yellow('Redis Status:'), client.isOpen ? chalk.bold.green('Connected') : chalk.bold.red('Disconnected'));
  console.log(' ')
  console.log(chalk.yellow('Redis listening on:'), client.isOpen ? chalk.bold.green('http://localhost:8001') : chalk.bold.red('Disconnected'));

  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Routes with versioning
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);

  // Basic route
  app.get('/', (req, res) => {
    res.status(200).send('Social Media API');
  });

  // Error handling middleware
  app.use(errorHandler);

  console.log(chalk.yellow('App listening on:'), chalk.bold.green(`http://localhost:${process.env.PORT || 5000}`));

  return app;
}