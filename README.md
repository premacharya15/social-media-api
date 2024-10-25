# Social Media API

This project is a custom API for a social media application built using Node.js and Express. It provides various functionalities such as user authentication, post creation, and interaction, as well as user profile management. The API is designed to handle requests efficiently with features like rate limiting, Redis caching, and error handling.

## Key Features

- **User Authentication**: Sign up, login, and OTP verification for secure access.
- **Post Management**: Create, like, comment, and save posts.
- **Profile Management**: Update user profiles, follow/unfollow users, and discover new people.
- **Caching**: Utilizes Redis for caching frequently accessed data to improve performance.
- **Rate Limiting**: Protects the API from abuse by limiting the number of requests from a single IP.
- **Error Handling**: Centralized error handling for consistent API responses.

## Technologies Used

- **Node.js**: JavaScript runtime for building the server-side application.
- **Express**: Web framework for handling HTTP requests and routing.
- **MongoDB**: NoSQL database for storing user and post data.
- **Redis**: In-memory data structure store for caching.
- **Mongoose**: ODM for MongoDB to manage data models.
- **JWT**: JSON Web Tokens for secure user authentication.
- **Multer**: Middleware for handling file uploads.

## Setup and Installation

1. Clone the repository.
2. Install dependencies using `npm install | yarn install`.
3. Set up environment variables in a `.env` file.
4. Start the server using `node server.js`.

## API Endpoints

- **Auth**: `/api/v1/auth`
- **User**: `/api/v1/user`
- **Post**: `/api/v1/post`
