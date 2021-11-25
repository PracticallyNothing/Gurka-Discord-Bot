FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./
COPY config.json ./
RUN npm install

COPY dist/ .

EXPOSE 80
EXPOSE 443

CMD [ "node", "index.js" ]
