import React, { useState } from 'react';
import { Upload, Card, Spin, message, Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Dragger } = Upload;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DocumentAnalyzer = () => {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [analysis, setAnalysis] = useState(null);

  // Custom upload handler
  const customUpload = async ({ file, onSuccess, onError }) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setExtractedText(response.data.text);
        message.success('File processed successfully');
        onSuccess(response, file);
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.message || 'Error uploading file');
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!extractedText) {
      message.warning('Please upload a document first');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/api/analyze`, {
        text: extractedText
      });

      if (response.data.success) {
        setAnalysis(response.data);
        message.success('Analysis complete');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      message.error('Error analyzing document');
    } finally {
      setAnalyzing(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    accept: '.pdf,.png,.jpg,.jpeg,.txt',
    customRequest: customUpload,
    showUploadList: false,
    beforeUpload: (file) => {
      const validTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'text/plain'
      ];
      
      if (!validTypes.includes(file.type)) {
        message.error('Please upload a PDF, image (PNG/JPG), or text file');
        return false;
      }
      return true;
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '0 20px' }}>
      <Card title="Document Learning Assistant">
        <Dragger {...uploadProps} disabled={loading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Click or drag file to upload
          </p>
          <p className="ant-upload-hint">
            Support for PDF, Image (JPG, PNG), and Text files
          </p>
        </Dragger>

        {loading && (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <Spin size="large" />
            <p>Processing document...</p>
          </div>
        )}

        {extractedText && !loading && (
          <Card 
            style={{ marginTop: '20px' }}
            title="Extracted Text"
            extra={
              <Button 
                type="primary"
                onClick={handleAnalyze}
                loading={analyzing}
              >
                Analyze Content
              </Button>
            }
          >
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              maxHeight: '300px',
              overflow: 'auto',
              backgroundColor: '#f5f5f5',
              padding: '10px',
              borderRadius: '4px'
            }}>
              {extractedText}
            </pre>
          </Card>
        )}

        {analysis && !analyzing && (
          <Card style={{ marginTop: '20px' }} title="Analysis Results">
            <div>
              <h3>Explanation:</h3>
              <div style={{ 
                whiteSpace: 'pre-wrap',
                marginBottom: '20px',
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}>
                {analysis.explanation}
              </div>
              
              <h3>Practice Questions:</h3>
              <div style={{ 
                whiteSpace: 'pre-wrap',
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}>
                {analysis.questions}
              </div>
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default DocumentAnalyzer;