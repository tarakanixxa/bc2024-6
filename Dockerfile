
FROM node:18


WORKDIR /app


COPY package*.json ./





COPY . .

EXPOSE 3000


CMD ["npm", "start"]
