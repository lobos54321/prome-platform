// Digital Human Video API Endpoints for A2E Integration
// Add these endpoints to your Express.js server

const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Multer configuration for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Video upload endpoint (temporary storage for A2E training)
app.post('/api/upload/video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '没有找到上传的视频文件' 
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Generate unique filename with timestamp
    const fileName = \`temp-\${Date.now()}-\${req.file.originalname}\`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('digital-human-videos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return res.status(500).json({ 
        success: false, 
        error: '视频上传到存储失败' 
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('digital-human-videos')
      .getPublicUrl(fileName);

    console.log('✅ Video uploaded to Supabase Storage:', publicUrl);

    // Auto-delete after 30 minutes (cleanup for failed/abandoned training sessions)
    setTimeout(async () => {
      try {
        await supabase.storage.from('digital-human-videos').remove([fileName]);
        console.log(\`🗑️ Auto-deleted temp video: \${fileName}\`);
      } catch (deleteError) {
        console.error('⚠️ Failed to auto-delete temp video:', deleteError);
      }
    }, 30 * 60 * 1000); // 30 minutes

    res.json({
      success: true,
      fileName: fileName,
      url: publicUrl,
      message: '视频上传成功'
    });

  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || '视频上传失败'
    });
  }
});

// A2E Digital Human Training API
app.post('/api/digital-human/train', async (req, res) => {
  try {
    const { 
      userId, 
      name,
      imageUrl,
      gender,
      backgroundColor,
      tempVideoFileName
    } = req.body;

    if (!userId || !name || !imageUrl) {
      return res.status(400).json({ 
        error: 'Missing required parameters: userId, name, imageUrl' 
      });
    }

    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL || 'https://video.a2e.ai';

    if (!A2E_API_KEY) {
      console.log('⚠️ A2E API Key not configured, using mock response');
      
      // Clean up temporary video file in mock mode too
      if (tempVideoFileName) {
        try {
          const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
          );
          
          await supabase.storage.from('digital-human-videos').remove([tempVideoFileName]);
          console.log(\`🗑️ Mock training started, cleaned up temp video: \${tempVideoFileName}\`);
        } catch (cleanupError) {
          console.error('⚠️ Failed to cleanup temp video file in mock mode:', cleanupError);
        }
      }

      return res.json({
        success: true,
        trainingId: \`mock-\${Date.now()}\`,
        message: 'Digital human training started (simulated)',
        estimatedTime: '5-10 minutes'
      });
    }

    // Call real A2E training API
    const trainingPayload = {
      name,
      image_url: imageUrl,
      gender,
      isTranscoding: true,
    };

    // Add optional parameters
    if (tempVideoFileName) {
      // Convert Supabase URL to direct video URL for A2E
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data: { publicUrl } } = supabase.storage
        .from('digital-human-videos')
        .getPublicUrl(tempVideoFileName);
      
      trainingPayload.video_url = publicUrl;
    }

    if (backgroundColor) {
      trainingPayload.video_backgroud_color = backgroundColor;
    }

    console.log('📤 Sending training request to A2E:', trainingPayload);

    const response = await fetch(\`\${A2E_API_URL}/api/v1/userVideoTwin/startTraining\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${A2E_API_KEY}\`
      },
      body: JSON.stringify(trainingPayload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'A2E training request failed');
    }

    console.log('✅ A2E training response:', result);

    // Clean up temporary video file after successful training request
    if (tempVideoFileName) {
      try {
        const supabase = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
        );
        
        await supabase.storage.from('digital-human-videos').remove([tempVideoFileName]);
        console.log(\`🗑️ Training started, cleaned up temp video: \${tempVideoFileName}\`);
      } catch (cleanupError) {
        console.error('⚠️ Failed to cleanup temp video file:', cleanupError);
        // Don't fail the training request due to cleanup issues
      }
    }

    res.json({
      success: true,
      trainingId: result.task_id || result.id,
      data: result,
      message: 'Digital human training started successfully'
    });

  } catch (error) {
    console.error('Digital human training error:', error);
    res.status(500).json({ 
      error: 'Training request failed',
      details: error.message 
    });
  }
});

// A2E Digital Human Video Generation API
app.post('/api/digital-human/generate', async (req, res) => {
  try {
    const { 
      userId, 
      trainingId,
      textScript, 
      voiceModel,
      emotion,
      language = 'zh-CN'
    } = req.body;

    if (!userId || !trainingId || !textScript) {
      return res.status(400).json({ 
        error: 'Missing required parameters: userId, trainingId, textScript' 
      });
    }

    // Credit deduction logic (implement based on your system)
    const credits = 10; // Cost per video generation
    
    try {
      const { data: userData, error: balanceError } = await supabase
        .from('user_balance')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (balanceError || !userData) {
        throw new Error('User balance not found');
      }

      if (userData.balance < credits) {
        return res.status(400).json({ 
          error: \`Insufficient credits. Required: \${credits}, Available: \${userData.balance}\` 
        });
      }

      // Deduct credits
      const { error: deductError } = await supabase
        .from('user_balance')
        .update({ 
          balance: userData.balance - credits,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (deductError) {
        throw new Error('Failed to deduct credits');
      }

      console.log('✅ Credits deducted successfully:', { userId, credits, remainingBalance: userData.balance - credits });
    }

    // A2E API call for video generation
    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL || 'https://video.a2e.ai';

    if (!A2E_API_KEY) {
      console.log('🎥 Simulating A2E API call...');
      
      // Simulate processing time
      const processingDelay = Math.random() * 2000 + 1000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, processingDelay));

      // Mock video URL
      const mockVideoUrl = \`https://mock-a2e-cdn.com/videos/\${userId}_\${Date.now()}.mp4\`;
      
      console.log('✅ Digital human video generated (simulated):', mockVideoUrl);
      return res.json({
        success: true,
        videoUrl: mockVideoUrl,
        taskId: \`mock-task-\${Date.now()}\`,
        message: 'Video generation completed (simulated)'
      });
    }

    // Real A2E API integration
    const generationPayload = {
      training_id: trainingId,
      text: textScript,
      language: language,
      emotion: emotion || 'neutral'
    };

    if (voiceModel) {
      generationPayload.voice_model = voiceModel;
    }

    console.log('📤 Sending generation request to A2E:', generationPayload);

    const response = await fetch(\`\${A2E_API_URL}/api/v1/userVideoTwin/generateVideo\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${A2E_API_KEY}\`
      },
      body: JSON.stringify(generationPayload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'A2E video generation failed');
    }

    console.log('✅ A2E video generation response:', result);

    res.json({
      success: true,
      taskId: result.task_id || result.id,
      data: result,
      message: 'Video generation started successfully'
    });

  } catch (error) {
    console.error('Digital human generation error:', error);
    res.status(500).json({ 
      error: 'Video generation failed',
      details: error.message 
    });
  }
});

// A2E Video Status Check API
app.get('/api/digital-human/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const A2E_API_KEY = process.env.A2E_API_KEY;
    const A2E_API_URL = process.env.A2E_API_URL || 'https://video.a2e.ai';

    if (!A2E_API_KEY) {
      // Mock response for development
      return res.json({
        success: true,
        status: 'completed',
        videoUrl: \`https://mock-a2e-cdn.com/videos/\${taskId}.mp4\`,
        progress: 100
      });
    }

    const response = await fetch(\`\${A2E_API_URL}/api/v1/task/\${taskId}\`, {
      headers: {
        'Authorization': \`Bearer \${A2E_API_KEY}\`
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'A2E status check failed');
    }

    res.json({
      success: true,
      status: result.status,
      videoUrl: result.result_url,
      progress: result.progress || 0,
      data: result
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      error: 'Status check failed',
      details: error.message 
    });
  }
});

module.exports = {
  // Export functions for use in other modules if needed
  upload
};