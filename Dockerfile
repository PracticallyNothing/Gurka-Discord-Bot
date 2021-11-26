FROM ubuntu:20.04

ENV TZ=Europe/Sofia
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update -y
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -

RUN apt-get install -y libtool python3 python3-pip curl nodejs
RUN python3 -m pip install yt-dlp

WORKDIR /usr/src/app

COPY package*.json ./
COPY config.json ./
RUN npm ci
RUN npm install typescript

COPY src/ ./src/
RUN mkdir dist/
RUN npm run build

EXPOSE 80
EXPOSE 443

CMD [ "npm", "start" ]
