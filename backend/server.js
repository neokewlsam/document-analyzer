// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdf = require('pdf-parse');
const tesseract = require('node-tesseract-ocr');
const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// OpenAI configuration
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Extract text from PDF
async function extractPDFText(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Error extracting PDF text: ' + error.message);
  }
}

// Perform OCR on images
async function performOCR(buffer) {
  try {
    const config = {
      lang: "eng",
      oem: 1,
      psm: 3,
    };
    return await tesseract.recognize(buffer, config);
  } catch (error) {
    throw new Error('Error performing OCR: ' + error.message);
  }
}

// Route to handle file upload and processing
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    let extractedText = '';

    // Process different file types
    if (file.mimetype === 'application/pdf') {
      extractedText = await extractPDFText(file.buffer);
    } else if (file.mimetype.startsWith('image/')) {
      extractedText = await performOCR(file.buffer);
    } else if (file.mimetype === 'text/plain') {
      extractedText = file.buffer.toString('utf-8');
    } else {
      throw new Error('Unsupported file type');
    }

    res.json({ text: extractedText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route to analyze text using ChatGPT
app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // Get explanation from ChatGPT
    const explanationResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful teacher. Explain the following content in simple terms, highlighting key concepts and providing examples."
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    // Get practice questions from ChatGPT
    const questionsResponse = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Create 3 practice questions with detailed answers based on the content."
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    res.json({
      explanation: explanationResponse.data.choices[0].message.content,
      questions: questionsResponse.data.choices[0].message.content
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});