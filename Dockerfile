FROM keymetrics/pm2:latest-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

RUN npm install -g pm2

# Bundle app source
COPY . .

EXPOSE 9443
CMD pm2-runtime start app.js -i max