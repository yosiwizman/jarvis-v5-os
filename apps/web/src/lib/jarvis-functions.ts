import { BRAND } from '@/lib/brand';

/**
 * Function definitions for AKIOR assistant
 * Each function defines what AKIOR can do across the application
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
    description: `Open and display a specific file in the ${BRAND.productName} interface. Use this AFTER search_files to open a file by its exact filename. Displays images directly and renders 3D models with Three.js.`,
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
  },
  // Email
  {
    name: 'compose_email',
    description: 'Compose and send an email using Gmail. Use this when the user asks to send an email, email someone, or compose a message. Extract recipient email address, subject, and body from user\'s request.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address (e.g., "john@example.com")'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'The main content/body of the email'
        },
        cc: {
          type: 'string',
          description: 'Optional CC email addresses (comma-separated if multiple)'
        },
        bcc: {
          type: 'string',
          description: 'Optional BCC email addresses (comma-separated if multiple)'
        }
      },
      required: ['to', 'subject', 'body'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Composing email...', data: args };
    }
  },
  {
    name: 'check_email',
    description: 'Check and list recent emails from Gmail inbox. Use this when the user asks to check their email, read emails, or see new messages.',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of recent emails to retrieve (default: 5, max: 20)'
        }
      },
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Checking email...', data: args };
    }
  },
  // Weather
  {
    name: 'get_weather',
    description: 'Get current weather information for a specific location. Use this when the user asks about weather, temperature, or weather conditions.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Location to get weather for (e.g., "Miami", "London,GB", "Tokyo,JP"). If not specified, uses user\'s default location.'
        }
      },
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Getting weather...', data: args };
    }
  },
  // Notes
  {
    name: 'create_note',
    description: 'Create a quick note. Use this when the user says things like "take a note", "remember this", or "write down".',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The content of the note'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags to categorize the note'
        }
      },
      required: ['content'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Creating note...', data: args };
    }
  },
  {
    name: 'list_notes',
    description: 'List all saved notes. Use this when the user asks to "show my notes", "what are my notes", or "read my notes".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Retrieving notes...', data: args };
    }
  },
  {
    name: 'delete_note',
    description: 'Delete a specific note. Use this when the user says "delete note", "remove my last note", etc.',
    parameters: {
      type: 'object',
      properties: {
        note_id: {
          type: 'string',
          description: 'The ID of the note to delete. Use "last" to delete the most recent note.'
        }
      },
      required: ['note_id'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Deleting note...', data: args };
    }
  },
  // Reminders
  {
    name: 'set_reminder',
    description: 'Set a reminder for a specific time. Use this when the user says "remind me to", "set a reminder", etc.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'What to be reminded about'
        },
        time_expression: {
          type: 'string',
          description: 'When to be reminded (e.g., "in 30 minutes", "at 6 PM", "tomorrow at 9 AM")'
        }
      },
      required: ['message', 'time_expression'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Setting reminder...', data: args };
    }
  },
  {
    name: 'list_reminders',
    description: 'List all active reminders. Use this when the user asks to "show my reminders" or "what reminders do I have".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Retrieving reminders...', data: args };
    }
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel a specific reminder. Use this when the user says "cancel the reminder" or "delete my reminder".',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to cancel'
        }
      },
      required: ['reminder_id'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Cancelling reminder...', data: args };
    }
  },
  // Alarms
  {
    name: 'set_alarm',
    description: 'Set an alarm. Use this when the user says "set an alarm", "wake me up", or "alert me".',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name/description of the alarm'
        },
        type: {
          type: 'string',
          enum: ['time', 'motion'],
          description: 'Type of alarm: "time" for time-based, "motion" for camera motion detection'
        },
        time_expression: {
          type: 'string',
          description: 'When the alarm should trigger (for time-based alarms, e.g., "7 AM", "tomorrow at 6:30")'
        },
        location: {
          type: 'string',
          description: 'Location for motion-based alarms (e.g., "backyard", "front door")'
        }
      },
      required: ['name', 'type'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Setting alarm...', data: args };
    }
  },
  {
    name: 'list_alarms',
    description: 'List all alarms. Use this when the user asks to "show my alarms" or "what alarms do I have".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Retrieving alarms...', data: args };
    }
  },
  {
    name: 'toggle_alarm',
    description: 'Enable or disable an alarm. Use this when the user says "turn off the alarm" or "enable my alarm".',
    parameters: {
      type: 'object',
      properties: {
        alarm_id: {
          type: 'string',
          description: 'The ID of the alarm to toggle'
        }
      },
      required: ['alarm_id'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Toggling alarm...', data: args };
    }
  },
  {
    name: 'delete_alarm',
    description: 'Delete an alarm permanently. Use this when the user says "delete the alarm" or "remove my alarm".',
    parameters: {
      type: 'object',
      properties: {
        alarm_id: {
          type: 'string',
          description: 'The ID of the alarm to delete'
        }
      },
      required: ['alarm_id'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Deleting alarm...', data: args };
    }
  },
  // Smart Home - Lights
  {
    name: 'control_lights',
    description: 'Control smart lights (Philips Hue, LIFX). Turn lights on/off, adjust brightness, or change colors. Use this when the user asks to "turn on the lights", "dim the lights", "set bedroom lights to 50%", etc.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['on', 'off', 'toggle', 'brightness', 'color'],
          description: 'Action to perform: "on", "off", "toggle", "brightness" (adjust brightness), "color" (change color)'
        },
        room: {
          type: 'string',
          description: 'Optional room or light name (e.g., "living room", "bedroom", "kitchen"). If not specified, controls all lights.'
        },
        brightness: {
          type: 'number',
          description: 'Brightness level 0-100 (only used when action is "brightness" or "on")'
        },
        color: {
          type: 'string',
          description: 'Color name or hex code (e.g., "red", "blue", "#FF5733") - only used when action is "color"'
        }
      },
      required: ['action'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Controlling lights...', data: args };
    }
  },
  // Smart Home - Thermostat
  {
    name: 'control_thermostat',
    description: 'Control Nest thermostat temperature and mode. Use this when the user asks to "set the temperature to 72", "turn on the heat", "what\'s the temperature", etc.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set_temperature', 'get_temperature', 'set_mode'],
          description: 'Action: "set_temperature" (change temp), "get_temperature" (check current temp), "set_mode" (change heating/cooling mode)'
        },
        temperature: {
          type: 'number',
          description: 'Target temperature (used with "set_temperature" action)'
        },
        unit: {
          type: 'string',
          enum: ['F', 'C'],
          description: 'Temperature unit: "F" for Fahrenheit, "C" for Celsius (default: F)'
        },
        mode: {
          type: 'string',
          enum: ['HEAT', 'COOL', 'HEATCOOL', 'OFF'],
          description: 'Thermostat mode (used with "set_mode" action): HEAT, COOL, HEATCOOL (auto), or OFF'
        }
      },
      required: ['action'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Controlling thermostat...', data: args };
    }
  },
  // Smart Home - Vacuum
  {
    name: 'control_vacuum',
    description: 'Control iRobot Roomba vacuum cleaner. Use this when the user says "start the vacuum", "stop cleaning", "send the robot to dock", "where is the vacuum", etc.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'pause', 'dock', 'status'],
          description: 'Action: "start" (begin cleaning), "pause" (stop cleaning), "dock" (return to charging station), "status" (check current status)'
        },
        room: {
          type: 'string',
          description: 'Optional: specific room or area to clean (e.g., "kitchen", "bedroom")'
        }
      },
      required: ['action'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Controlling vacuum...', data: args };
    }
  },
  // Memory & Context Recall
  {
    name: 'recall_memory',
    description: 'Search through past conversations and actions to recall previous interactions, generated content, or events. Use this when the user asks about past conversations, previous requests, what was discussed before, or to find something they created/did earlier. Examples: "What did we discuss yesterday?", "Show me images I generated last week", "What was that 3D model I made?", "Did I already create something similar?"',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find in past conversations and actions (e.g., "hammer", "image generation", "discussion about AI")'
        },
        time_range: {
          type: 'string',
          enum: ['today', 'yesterday', 'last_week', 'last_month', 'all_time'],
          description: 'Time range to search within. Default is "all_time" if not specified.'
        },
        content_type: {
          type: 'string',
          enum: ['all', 'conversations', 'actions', 'images', '3d_models'],
          description: 'Type of content to search. Default is "all" for both conversations and actions.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10, max: 50)'
        }
      },
      required: ['query'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Searching memories...', data: args };
    }
  },
  // Smart Home - Alexa Devices
  {
    name: 'control_alexa_device',
    description: 'Control Alexa-enabled smart home devices. Use this for generic device control like "turn on the fan", "lock the door", "turn off the TV", etc.',
    parameters: {
      type: 'object',
      properties: {
        device_name: {
          type: 'string',
          description: 'Name of the device to control (e.g., "fan", "door lock", "TV", "plug")'
        },
        action: {
          type: 'string',
          enum: ['turn_on', 'turn_off', 'lock', 'unlock'],
          description: 'Action to perform on the device'
        }
      },
      required: ['device_name', 'action'],
      additionalProperties: false
    },
    strict: true,
    handler: async (args) => {
      return { success: true, message: 'Controlling device...', data: args };
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

