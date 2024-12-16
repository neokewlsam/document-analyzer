const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const tesseract = require('node-tesseract-ocr');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// PDF processing options
const PDF_OPTIONS = {
  pagerender: function(pageData) {
    return pageData.getTextContent()
      .then(function(textContent) {
        let lastY, text = '';
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY){
            text += item.str;
          } else {
            text += '\n' + item.str;
          }    
          lastY = item.transform[5];
        }
        return text;
      });
  }
};

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('File received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const file = req.file;
    let extractedText = '';

    if (file.mimetype === 'application/pdf') {
      console.log('Processing PDF...');
      try {
        const pdfData = await pdfParse(file.buffer, PDF_OPTIONS);
        extractedText = pdfData.text;
        console.log('PDF processing completed. Text length:', extractedText.length);
        
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('PDF appears to be empty or unreadable');
        }
      } catch (pdfError) {
        console.error('PDF Processing Error:', pdfError);
        throw new Error(`Failed to process PDF: ${pdfError.message}`);
      }
    } else if (file.mimetype.startsWith('image/')) {
      console.log('Processing Image...');
      const config = {
        lang: "eng",
        oem: 1,
        psm: 3,
      };
      extractedText = await tesseract.recognize(file.buffer, config);
    } else if (file.mimetype === 'text/plain') {
      console.log('Processing Text file...');
      extractedText = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported file type: ${file.mimetype}`
      });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    console.log('Text extraction successful');
    console.log('Extracted text length:', extractedText.length);
    console.log('First 200 characters:', extractedText.substring(0, 200));

    res.json({ 
      success: true, 
      text: extractedText,
      metadata: {
        length: extractedText.length,
        preview: extractedText.substring(0, 100)
      }
    });

  } catch (error) {
    console.error('File processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error processing file'
    });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    // Get explanation from ChatGPT
    const explanationResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful teacher. Explain the following content in simple terms, breaking down complex concepts and providing examples."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    // Get practice questions
    const questionsResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Create 3 practice questions with detailed answers based on the following content. Format each question with 'Q:' and each answer with 'A:'."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    res.json({
      success: true,
      explanation: explanationResponse.choices[0].message.content,
      questions: questionsResponse.choices[0].message.content
    });
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;