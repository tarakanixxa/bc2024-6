const fs = require('fs').promises;
const express = require('express');
const { Command } = require('commander');
const path = require('path');

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
    const dirExists = await fs.access(dirPath).then(() => true).catch(() => false);
    if (dirExists) {
      console.log(`Директорія '${dirPath}' вже існує.`);
    } else {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`Директорія '${dirPath}' створена.`);
    }
  } catch (error) {
    console.error('Помилка при доступі до директорії:', error);
  }
}

createDirectoryIfNotExists(cacheDirectory);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


async function checkFileExistence(filePath) {
  try {
    await fs.access(filePath);
    return true; 
  } catch (error) {
    return false; 
  }
}

app.get('/notes/:name', async (req, res) => {
  const { name } = req.params;
  const filePath = path.join(cacheDirectory, name);

  console.log(`Шлях до нотатки: ${filePath}`);

  const fileExists = await checkFileExistence(filePath);

  if (fileExists) {
    try {
      const note = await fs.readFile(filePath, 'utf8');
      return res.status(200).send(note);
    } catch (error) {
      return res.status(500).send('Error reading note');
    }
  } else {
    return res.status(404).send('Not found');
  }
});

app.put('/notes/:name', async (req, res) => {
  const { name } = req.params;
  const { text } = req.body;
  const filePath = path.join(cacheDirectory, name);

  try {
    await fs.writeFile(filePath, text);
    return res.status(200).send('Note updated');
  } catch (error) {
    return res.status(404).send('Not found');
  }
});

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

app.get('/notes', async (req, res) => {
  try {
    const files = await fs.readdir(cacheDirectory);
    const notesList = [];

    for (const file of files) {
      const filePath = path.join(cacheDirectory, file);
      const note = await fs.readFile(filePath, 'utf8');
      notesList.push({ name: file, text: note });
    }

    return res.status(200).json(notesList);
  } catch (error) {
    return res.status(500).send('Error reading notes');
  }
});

app.post('/write', async (req, res) => {
  const { note_name, note } = req.body;
  console.log('Received data:', note_name, note);  

  const filePath = path.join(cacheDirectory, note_name);

  try {
    await fs.writeFile(filePath, note);
    return res.status(201).send('Note created');
  } catch (error) {
    console.error('Error writing file:', error);  
    return res.status(400).send('Bad Request');
  }
});

app.get('/UploadForm.html', (req, res) => {
  res.status(200).send(`
    <html>
      <body>
        <form action="/write" method="POST">
          <label for="note_name">Note Name:</label><br>
          <input type="text" id="note_name" name="note_name" required><br><br>
          <label for="note">Note Text:</label><br>
          <textarea id="note" name="note" required></textarea><br><br>
          <button type="submit">Submit</button>
        </form>
      </body>
    </html>
  `);
});

app.listen(port, host, () => {
  console.log(`Сервер запущено на http://${host}:${port}`);
});
  