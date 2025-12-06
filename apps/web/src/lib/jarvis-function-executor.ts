import { buildServerUrl } from './api';
import { getCameraSocket } from './socket';
import { handleCameraAnalysis } from './camera-handler';
import { readSettings } from '@shared/settings';
import { isFunctionEnabledSync } from '@/hooks/useFunctionSettings';

interface ExecutionContext {
  setDisplayContent?: (content: { type: 'image' | '3d'; url: string } | null) => void;
  setModelProgress?: (progress: number | null) => void;
  setProgressMessage?: (message: string) => void;
  dataChannel?: RTCDataChannel | null;
  router?: any;
}

/**
 * Central function executor - ALL Jarvis function implementations in ONE place
 * This is used by both the full-screen Jarvis page and the mini assistant
 */
export async function executeJarvisFunction(
  name: string,
  args: any,
  context: ExecutionContext
): Promise<any> {
  console.log(`🎯 Executing function: ${name}`, args);

  // Check if function is enabled
  if (!isFunctionEnabledSync(name)) {
    console.warn(`⚠️ Function ${name} is disabled`);
    return {
      success: false,
      message: `The function "${name}" is currently disabled. You can enable it from the Functions page.`
    };
  }

  switch (name) {
    case 'create_image':
      return await handleCreateImage(args, context);
    
    case 'create_3d_model':
      return await handleCreate3DModel(args, context);
    
    case 'navigate_to_page':
      return handleNavigate(args, context);
    
    case 'list_files':
      return await handleListFiles();
    
    case 'search_files':
      return await handleSearchFiles(args);
    
    case 'open_file':
      return await handleOpenFile(args, context);
    
    case 'capture_images':
      return await handleCaptureImages(args);
    
    case 'analyze_camera_view':
      return await handleAnalyzeCameraView(args, context);
    
    case 'open_holomat_app':
      return await handleOpenHolomatApp(args);
    
    case 'open_model_on_holomat':
      return await handleOpenModelOnHolomat(args);
    
    default:
      return { success: false, message: `Unknown function: ${name}` };
  }
}

// ============================================================================
// FUNCTION IMPLEMENTATIONS
// ============================================================================

async function handleCreateImage(args: { prompt: string; size?: string }, context: ExecutionContext) {
  const { prompt, size = '1024x1024' } = args;
  
  try {
    console.log('🎨 Starting image generation:', prompt);
    
    const settings = readSettings();
    const imageSettings = settings.imageGeneration || {
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'high',
      partialImages: 0
    };
    
    const response = await fetch(buildServerUrl('/openai/generate-image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        settings: { ...imageSettings, size }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to generate image: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error('No response body');

    let imageUrl = '';
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'final_image' && parsed.image) {
            imageUrl = `data:image/png;base64,${parsed.image}`;
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error || parsed.message || 'Image generation failed');
          }
        } catch (e) {
          if (e instanceof Error && (e.message.includes('generation failed') || e.message.includes('OpenAI'))) {
            throw e;
          }
        }
      }
    }

    if (imageUrl) {
      context.setDisplayContent?.({ type: 'image', url: imageUrl });
      return { success: true, message: 'Here is your image, Sir.' };
    } else {
      throw new Error('No image generated');
    }
  } catch (error) {
    console.error('❌ Error creating image:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to create image' };
  }
}

async function handleCreate3DModel(args: { prompt: string }, context: ExecutionContext) {
  const { prompt } = args;
  
  try {
    console.log('🎲 Starting 3D model generation...');
    context.setProgressMessage?.('Generating 3D Model');
    context.setModelProgress?.(0);
    
    const createResponse = await fetch(buildServerUrl('/models/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'text',
        prompt,
        settings: { artStyle: 'realistic', outputFormat: 'glb' }
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create 3D model job');
    }

    const { id: jobId } = await createResponse.json();
    console.log('🎲 Job created:', jobId);
    
    let attempts = 0;
    const maxAttempts = 1800;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(buildServerUrl(`/models/${jobId}`));
      if (!statusResponse.ok) throw new Error('Failed to check model status');
      
      const job = await statusResponse.json();
      
      if (typeof job.progress === 'number') {
        context.setModelProgress?.(job.progress);
      }
      
      if (job.status === 'done') {
        const modelUrl = job.outputs?.glbUrl || job.outputs?.objUrl || job.outputs?.usdzUrl;
        if (modelUrl) {
          context.setModelProgress?.(null);
          context.setDisplayContent?.({ type: '3d', url: modelUrl });
          return { success: true, message: '3D model created successfully, Sir.' };
        } else {
          throw new Error('Model completed but no URL in outputs');
        }
      } else if (job.status === 'error') {
        throw new Error(job.error || 'Model generation failed');
      }
      
      attempts++;
    }
    
    throw new Error('Model generation timed out');
  } catch (error) {
    console.error('Error creating 3D model:', error);
    context.setModelProgress?.(null);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to create 3D model' };
  }
}

function handleNavigate(args: { page: string }, context: ExecutionContext) {
  const { page } = args;
  
  if (typeof window !== 'undefined') {
    window.location.href = page;
  }
  
  const pageName = page.split('/').pop() || 'page';
  return { success: true, message: `Opening ${pageName}...` };
}

async function handleListFiles() {
  try {
    const response = await fetch(buildServerUrl('/file-library'));
    if (!response.ok) throw new Error('Failed to fetch files');
    
    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];
    
    if (files.length === 0) {
      return { success: false, message: 'No files available in the library.' };
    }
    
    return {
      success: true,
      message: `Found ${files.length} file${files.length === 1 ? '' : 's'} in the library.`,
      data: { files }
    };
  } catch (error: any) {
    return { success: false, message: `Failed to list files: ${error.message}` };
  }
}

async function handleSearchFiles(args: { query?: string }) {
  try {
    const response = await fetch(buildServerUrl('/file-library'));
    if (!response.ok) throw new Error('Failed to fetch files');
    
    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];
    
    const query = args.query?.toLowerCase() || '';
    const matchingFiles = query
      ? files.filter((f: any) => f.name.toLowerCase().includes(query))
      : files;
    
    if (matchingFiles.length === 0) {
      return {
        success: false,
        message: query 
          ? `No files found matching "${query}".`
          : 'No files available in the library.'
      };
    }
    
    const fileList = matchingFiles.map((f: any) => ({
      name: f.name,
      type: f.category,
      size: f.size,
      extension: f.extension
    }));
    
    return {
      success: true,
      message: `Found ${matchingFiles.length} file${matchingFiles.length === 1 ? '' : 's'}: ${fileList.map((f: any) => f.name).join(', ')}`,
      data: { files: fileList }
    };
  } catch (error: any) {
    return { success: false, message: `Failed to search files: ${error.message}` };
  }
}

async function handleOpenFile(args: { filename: string; file_type: 'image' | 'model' | 'other' }, context: ExecutionContext) {
  const { filename, file_type } = args;
  
  try {
    console.log(`📂 Opening file: ${filename} (type: ${file_type})`);
    
    if (file_type === 'model') {
      context.setProgressMessage?.('Loading 3D Model');
    } else if (file_type === 'image') {
      context.setProgressMessage?.('Loading Image');
    }
    
    context.setModelProgress?.(0);
    for (let i = 0; i <= 100; i += 20) {
      context.setModelProgress?.(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    context.setModelProgress?.(null);
    
    const fileUrl = buildServerUrl(`/files/${filename}`);
    
    if (file_type === 'image') {
      context.setDisplayContent?.({ type: 'image', url: fileUrl });
      return { success: true, message: `Opening ${filename}` };
    } else if (file_type === 'model') {
      context.setDisplayContent?.({ type: '3d', url: fileUrl });
      return { success: true, message: `Rendering ${filename}` };
    } else {
      if (typeof window !== 'undefined') {
        window.open(fileUrl, '_blank');
      }
      return { success: true, message: `Opening ${filename} in new tab` };
    }
  } catch (error: any) {
    context.setModelProgress?.(null);
    return { success: false, message: `Failed to open ${filename}: ${error.message}` };
  }
}

async function handleCaptureImages(args: { tag?: string | null }) {
  try {
    await fetch(buildServerUrl('/tools/invoke'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'cameras.captureAll',
        args: { tag: args.tag || 'jarvis-capture' }
      })
    });
    
    return { success: true, message: 'Capturing images from all cameras...' };
  } catch (error: any) {
    return { success: false, message: `Failed to capture images: ${error.message}` };
  }
}

async function handleAnalyzeCameraView(args: { camera_id?: string | null; question?: string | null }, context: ExecutionContext) {
  return await handleCameraAnalysis(
    args,
    context.dataChannel ?? null,
    (imageUrl, caption) => {
      context.setDisplayContent?.({ type: 'image', url: imageUrl });
    }
  );
}

async function handleOpenHolomatApp(args: { app_name: string }) {
  try {
    const socket = getCameraSocket();
    
    if (!socket) {
      throw new Error('Socket connection not available');
    }

    console.log('🚀 Opening holomat app:', args.app_name);
    
    socket.emit('holomat:openApp', { appName: args.app_name });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      message: `Opening ${args.app_name} on the Holomat...`
    };
  } catch (error: any) {
    console.error('Error in handleOpenHolomatApp:', error);
    return {
      success: false,
      message: `Failed to open holomat app: ${error.message}`
    };
  }
}

async function handleOpenModelOnHolomat(args: { filename: string }) {
  try {
    const socket = getCameraSocket();
    
    if (!socket) {
      throw new Error('Socket connection not available');
    }

    console.log('🎨 Opening model on holomat:', args.filename);
    
    // Construct the model URL from the filename
    const modelUrl = buildServerUrl(`/files/${args.filename}`);
    const modelName = args.filename;
    
    socket.emit('holomat:openModel', { modelUrl, modelName });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      message: `Opening ${args.filename} on the Holomat 3D viewer...`
    };
  } catch (error: any) {
    console.error('Error in handleOpenModelOnHolomat:', error);
    return {
      success: false,
      message: `Failed to open model: ${error.message}`
    };
  }
}
