FROM node:18

WORKDIR /app


COPY package*.json ./


RUN npm install


COPY . .


EXPOSE 3000


RUN npm install --save-dev nodemon


ENV PORT 3000
ENV HOST 0.0.0.0
ENV CACHE /app/cache


CMD ["npx", "nodemon", "main.js", "--host", "0.0.0.0", "--port", "3000", "--cache", "/app/cache"]
