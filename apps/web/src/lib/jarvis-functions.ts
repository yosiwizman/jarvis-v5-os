/**
 * Function definitions for Jarvis assistant
 * Each function defines what Jarvis can do across the application
 */

export interface JarvisFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  strict?: boolean;
  handler: (args: any) => Promise<FunctionResult>;
}

export interface FunctionResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Available functions that Jarvis can call
 */
export const jarvisFunctions: JarvisFunction[] = [
  {
    name: 'create_image',
    description: 'Generate an AI image using DALL-E based on a text description. Use this when the user asks to create, generate, or make an image.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed description of the image to generate (e.g., "a cat in a hat sitting on a red couch")'
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1024x1792', '1792x1024'],
          description: 'Size of the image. Use 1024x1024 for square, 1024x1792 for portrait, 1792x1024 for landscape'
        }
      },
      required: ['prompt'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      // Handler will be implemented in the component
      return { success: true, message: 'Creating image...', data: args };
    }
  },
  {
    name: 'create_3d_model',
    description: 'Generate a 3D model using AI based on a text description. Use this when the user asks to create, generate, or make a 3D model or object.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed description of the 3D model to generate (e.g., "a futuristic hammer with glowing edges")'
        }
      },
      required: ['prompt'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Creating 3D model...', data: args };
    }
  },
  {
    name: 'navigate_to_page',
    description: 'Navigate to a different page in the application. Use this when the user asks to go to, open, or show a specific page.',
    parameters: {
      type: 'object',
      properties: {
      page: {
        type: 'string',
        enum: [
          '/menu',
          '/jarvis',
          '/3dmodel',
          '/3dViewer',
          '/3dprinters',
          '/createimage',
          '/files',
          '/chat',
          '/security',
          '/camera',
          '/functions',
          '/settings',
          '/holomat'
        ],
        description: 'The page path to navigate to'
      }
      },
      required: ['page'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: `Navigating to ${args.page}...`, data: args };
    }
  },
  {
    name: 'search_files',
    description: 'Search for files in the library by name or description. Use this FIRST when the user asks to open, view, or show a specific file (e.g., "open the pickleball paddle file", "show me the hammer model"). Returns a list of matching files with their names and types.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to match against file names (e.g., "pickleball", "hammer", "sunset"). Leave empty to list all files.'
        }
      },
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Searching files...', data: args };
    }
  },
  {
    name: 'open_file',
    description: 'Open and display a specific file in the Jarvis interface. Use this AFTER search_files to open a file by its exact filename. Displays images directly and renders 3D models with Three.js.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The exact filename to open (e.g., "pickleball-paddle-20231118-143022.stl")'
        },
        file_type: {
          type: 'string',
          enum: ['image', 'model', 'other'],
          description: 'Type of file: "image" for PNG/JPG, "model" for STL/GLB/OBJ, "other" for unknown types'
        }
      },
      required: ['filename', 'file_type'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Opening file...', data: args };
    }
  },
  {
    name: 'capture_images',
    description: 'Capture images from all connected cameras. Use this when the user asks to take photos or capture from cameras.',
    parameters: {
      type: 'object',
      properties: {
        tag: {
          type: ['string', 'null'],
          description: 'Optional tag to label the captured images'
        }
      },
      required: ['tag'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Capturing images from cameras...', data: args };
    }
  },
  {
    name: 'analyze_camera_view',
    description: 'Analyze what the camera is currently seeing using vision AI. Use this when the user asks "what is this?", "what do you see?", "look at this", "can you see that?", or asks questions about their physical surroundings. Returns a detailed description of what is visible in the camera.',
    parameters: {
      type: 'object',
      properties: {
        camera_id: {
          type: ['string', 'null'],
          description: 'Optional specific camera ID to use. If not provided, uses the first available camera.'
        },
        question: {
          type: ['string', 'null'],
          description: 'Optional specific question about the image (e.g., "what color is this?", "how many people are there?"). If not provided, gives a general description.'
        }
      },
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Analyzing camera view...', data: args };
    }
  }
];

/**
 * Convert functions to OpenAI tool format
 * Note: Realtime API doesn't support 'strict' parameter
 */
export function getFunctionTools() {
  return jarvisFunctions.map((func) => ({
    type: 'function' as const,
    name: func.name,
    description: func.description,
    parameters: func.parameters
  }));
}

/**
 * Get handler for a function by name
 */
export function getFunctionHandler(name: string): JarvisFunction['handler'] | null {
  const func = jarvisFunctions.find((f) => f.name === name);
  return func?.handler ?? null;
}

