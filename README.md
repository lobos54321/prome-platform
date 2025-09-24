# Digital Human Video System

This repository contains the complete digital human video creation system with A2E API integration.

## Features

- **Beautiful UI**: Modern gradient design with 4-step workflow visualization
- **Deep Copywriting Integration**: Automatic import of AI-generated copywriting content
- **A2E API Integration**: Complete integration with A2E digital human training and video generation
- **Supabase Storage**: Temporary video file storage with automatic cleanup
- **Step-by-step Workflow**: Clear progress tracking through the video creation process

## Files Included

1. `DigitalHumanVideoComplete2.tsx` - Main React component with full UI
2. `server-api-endpoints.js` - Backend API endpoints for A2E integration
3. `environment-config.env` - Required environment variables
4. `digital-human-routes.js` - React Router configuration
5. `supabase-setup.sql` - Database configuration and setup

## Setup Instructions

### 1. Environment Variables (.env)
```env
# A2E API Configuration
A2E_API_KEY=your_a2e_api_key_here
A2E_API_URL=https://video.a2e.ai

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Supabase Storage Bucket
Create a storage bucket named `digital-human-videos` in your Supabase project:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('digital-human-videos', 'digital-human-videos', true);
```

### 3. Install Dependencies
```bash
npm install @supabase/supabase-js multer express
```

### 4. React Router Setup
Add the route to your App.tsx:
```typescript
import DigitalHumanVideoComplete2 from './pages/DigitalHumanVideoComplete2';

// In your Routes component:
<Route path="/digital-human-video" element={<DigitalHumanVideoComplete2 />} />
```

## Workflow

### Step 1: Prepare Content
- Users can manually input video script content
- Auto-import from Deep Copywriting results stored in localStorage
- Content validation before proceeding to next step

### Step 2: Train Digital Human (A2E Integration)
- Upload video files to Supabase temporary storage
- Send training request to A2E API with:
  - Name and gender settings
  - Video URL from Supabase storage
  - Background image and color options
- Automatic cleanup of temporary files

### Step 3: Generate Video
- Use trained digital human to generate final video
- Integration with A2E video generation API
- Progress tracking and status updates

### Step 4: Complete
- Video download and final delivery
- Cleanup and resource management

## API Endpoints

### POST /api/upload/video
Upload video files for digital human training
- Accepts multipart/form-data with video file
- Stores in Supabase temporary storage
- Auto-deletes after 30 minutes

### POST /api/digital-human/train
Start digital human training with A2E API
- Integrates with A2E training endpoint
- Handles video URL and configuration parameters
- Manages temporary file cleanup

### POST /api/digital-human/generate
Generate videos using trained digital human
- Calls A2E video generation API
- Credit/balance system integration
- Status tracking and webhook support

## Technical Features

### File Upload & Storage
- Multipart file upload handling
- Supabase Storage integration
- Automatic temporary file cleanup
- Public URL generation for A2E API

### A2E API Integration
- Complete training workflow implementation
- Video generation with customizable parameters
- Error handling and fallback modes
- Mock mode for development/testing

### UI/UX Features
- Responsive design with gradient backgrounds
- Step-by-step progress visualization
- Real-time status updates
- Deep Copywriting content integration
- Form validation and error handling

## Security & Best Practices

- API key protection with environment variables
- Input validation and sanitization
- Automatic resource cleanup
- Error handling with user-friendly messages
- Service role key usage for secure storage operations

## Future Enhancements

- Real-time progress updates via WebSocket
- Advanced video customization options
- Batch processing capabilities
- Enhanced error recovery mechanisms
- Video preview and editing features
