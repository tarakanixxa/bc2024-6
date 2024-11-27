const fs = require('fs').promises;
const express = require('express');
const { Command } = require('commander');
const multer = require('multer');
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
    await fs.access(dirPath).catch(() => fs.mkdir(dirPath, { recursive: true }));
    console.log(`Директорія '${dirPath}' готова.`);
  } catch (error) {
    console.error('Помилка при створенні директорії:', error);
  }
}

createDirectoryIfNotExists(cacheDirectory);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer();

app.get('/UploadForm.html', (req, res) => {
  const filePath = path.resolve('D:/DZ/bc 2024/bc2024-5/UploadForm.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Помилка при відправці файлу:', err);
      res.status(500).send('Помилка при завантаженні файлу');
    }
  });
});

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
    const notesList = await Promise.all(
      files.map(async (file) => {
        const note = await fs.readFile(path.join(cacheDirectory, file), 'utf8');
        return { name: file, text: note };
      })
    );
    return res.status(200).json(notesList);
  } catch (error) {
    return res.status(500).send('Error reading notes');
  }
});

app.listen(port, host, () => {
  console.log(`Сервер запущено на http://${host}:${port}`);
});
