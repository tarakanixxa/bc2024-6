const fs = require('fs').promises;
const express = require('express');
const { Command } = require('commander');
const multer = require('multer');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'Адреса сервера')
  .requiredOption('-p, --port <port>', 'Порт сервера')
  .requiredOption('-c, --cache <cache>', 'Шлях до директорії для кешованих файлів')
  .parse(process.argv);

const { host, port, cache } = program.opts();

const cacheDirectory = path.isAbsolute(cache) ? cache : path.join(__dirname, cache);

async function createDirectoryIfNotExists(dirPath) {
  try {
    await fs.access(dirPath).catch(() => fs.mkdir(dirPath, { recursive: true }));
    console.log(`Директорія '${dirPath}' готова.`);
  } catch (error) {
    console.error('Помилка при створенні директорії:', error);
  }
}

createDirectoryIfNotExists(cacheDirectory);

const app = express();

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Notes API',
    version: '1.0.0',
    description: 'API для роботи з нотатками',
    contact: {
      name: 'Your Name',
      url: 'http://yourwebsite.com',
      email: 'youremail@example.com',
    },
  },
  servers: [
    {
      url: `http://${host}:${port}`,
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./main.js'],  
};

const swaggerSpec = swaggerJSDoc(options);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer();

/**
 * @swagger
 * /UploadForm.html:
 *   get:
 *     description: Завантажити форму для введення нотатки
 *     responses:
 *       200:
 *         description: Успішно завантажено форму
 */
app.get('/UploadForm.html', (req, res) => {
  const filePath = path.resolve(__dirname, 'UploadForm.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Помилка при відправці файлу:', err);
      res.status(500).send('Помилка при завантаженні файлу');
    }
  });
});

/**
 * @swagger
 * /write:
 *   post:
 *     description: Створити нову нотатку
 *     parameters:
 *       - in: body
 *         name: note
 *         description: Нотатка для збереження
 *         schema:
 *           type: object
 *           required:
 *             - note_name
 *             - note
 *           properties:
 *             note_name:
 *               type: string
 *               description: Ім'я файлу для нотатки
 *             note:
 *               type: string
 *               description: Текст нотатки
 *     responses:
 *       201:
 *         description: Нотатку успішно створено
 *       400:
 *         description: Невірний запит
 */
app.post('/write', upload.none(), async (req, res) => {
  const { note_name, note } = req.body;

  if (!note_name || !note) {
    return res.status(400).send('Note name and content are required');
  }

  const filePath = path.join(cacheDirectory, note_name);
  try {
    await fs.access(filePath).then(() => {
      throw new Error('Note already exists');
    }).catch(async (err) => {
      if (err.message === 'Note already exists') throw err;
      await fs.writeFile(filePath, note);
      return res.status(201).send('Note created');
    });
  } catch (error) {
    console.error('Error creating note:', error);
    return res.status(error.message === 'Note already exists' ? 400 : 500).send(error.message);
  }
});

/**
 * @swagger
 * /notes/{name}:
 *   get:
 *     description: Отримати нотатку за іменем
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         description: Ім'я файлу нотатки
 *     responses:
 *       200:
 *         description: Нотатку знайдено
 *       404:
 *         description: Нотатку не знайдено
 */
app.get('/notes/:name', async (req, res) => {
  const { name } = req.params;
  const filePath = path.join(cacheDirectory, name);

  try {
    const note = await fs.readFile(filePath, 'utf8');
    return res.status(200).send(note);
  } catch (error) {
    return res.status(404).send('Not found');
  }
});

/**
 * @swagger
 * /notes/{name}:
 *   put:
 *     description: Оновити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         description: Ім'я файлу нотатки
 *       - in: body
 *         name: text
 *         description: Новий текст нотатки
 *         schema:
 *           type: object
 *           required:
 *             - text
 *           properties:
 *             text:
 *               type: string
 *     responses:
 *       200:
 *         description: Нотатку успішно оновлено
 *       500:
 *         description: Помилка при оновленні нотатки
 */
app.put('/notes/:name', async (req, res) => {
  const { name } = req.params;
  const { text } = req.body;
  const filePath = path.join(cacheDirectory, name);

  try {
    await fs.writeFile(filePath, text);
    return res.status(200).send('Note updated');
  } catch (error) {
    return res.status(500).send('Error updating note');
  }
});

/**
 * @swagger
 * /notes/{name}:
 *   delete:
 *     description: Видалити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         description: Ім'я файлу нотатки
 *     responses:
 *       200:
 *         description: Нотатку успішно видалено
 *       404:
 *         description: Нотатку не знайдено
 */
app.delete('/notes/:name', async (req, res) => {
  const { name } = req.params;
  const filePath = path.join(cacheDirectory, name);

  try {
    await fs.unlink(filePath);
    return res.status(200).send('Note deleted');
  } catch (error) {
    return res.status(404).send('Not found');
  }
});

app.listen(port, host, () => {
  console.log(`Сервер запущено на http://${host}:${port}`);
});
