import express from 'express';
import chalk from 'chalk';
import mongoose from 'mongoose';
import { json, urlencoded } from 'express';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import cors from 'cors';
import { isRedisConnected } from './utils/redisClient.js';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import limiter from './utils/rateLimit.js';

// Manually define __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  console.log(' ')
  console.log(chalk.blue('--- Starting Express Server ---'));
  console.log(' ')

  // Initialize the app
  const app = express();

  // Set trust proxy more restrictively
  app.set('trust proxy', 1); // Adjust this based on your actual proxy setup

  // Apply rate limiting middleware globally
  app.use(limiter);

  // Configure CORS
  app.use(cors({
    origin: '*', // This allows all domains. For production, specify allowed domains.
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify HTTP methods allowed.
    allowedHeaders: ['Content-Type', 'Authorization'] // Authorization header is used for JWT
  }));


  // Serve static files from the upload directory
  const uploadDirectory = path.join(__dirname, 'uploads');
  app.use('/uploads', express.static(uploadDirectory));

  // Serve static files from the public directory
  const publicDirectory = path.join(__dirname, 'public');
  app.use(express.static(publicDirectory));

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
  const redisConnected = await isRedisConnected();
  console.log(chalk.yellow('Redis Status:'), redisConnected ? chalk.bold.green('Connected') : chalk.bold.red('Disconnected'));
  console.log(chalk.yellow('Redis listening on:'), redisConnected ? chalk.bold.green('http://localhost:8001') : chalk.bold.red('Not available'));

  app.use(json());
  app.use(urlencoded({ extended: true }));


  // Routes with versioning
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/user', userRoutes);
  app.use('/api/v1/post', postRoutes);

  // Basic route
  app.get('/', (req, res) => {
    res.status(200).send('Social Media API');
  });


  // Error handling middleware
  app.use(errorHandler);
  console.log(chalk.yellow('App listening on:'), chalk.bold.green(`http://localhost:${process.env.PORT || 5000}`));

  function getIPv4Address() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      if (name.includes('Wi-Fi') || name.includes('Wireless') || name.includes('wlp2s0') || name.startsWith('en') || name.startsWith('eth') || name.startsWith('Ethernet')) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }
    return 'localhost';
  }

  console.log(chalk.yellow('App listening on:'), chalk.bold.green(`http://${getIPv4Address()}:${process.env.PORT || 5000}`));

  return app;
}