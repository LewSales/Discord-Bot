# Use an official Node runtime as a parent image
FROM node:18-alpine

# Create app directory in container
WORKDIR /usr/src/app

# Copy package manifests and install deps first (leverages Docker cache)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy all remaining source code
COPY . .

# Define the command to run the tracker
CMD ["npm", "start"]
