'use client';

import { jarvisFunctions } from '@/lib/jarvis-functions';
import { useState } from 'react';
import { useFunctionSettings } from '@/hooks/useFunctionSettings';

export default function FunctionsPage() {
  const [expandedFunction, setExpandedFunction] = useState<string | null>(null);
  const { isFunctionEnabled, toggleFunction: toggleFunctionEnabled, enableAll, disableAll } = useFunctionSettings();

  const toggleExpand = (name: string) => {
    setExpandedFunction(expandedFunction === name ? null : name);
  };

  const getCategoryIcon = (name: string) => {
    if (name.includes('image')) return '🎨';
    if (name.includes('3d') || name.includes('model')) return '🎲';
    if (name.includes('navigate')) return '🧭';
    if (name.includes('file')) return '📁';
    if (name.includes('camera') || name.includes('capture')) return '📷';
    if (name.includes('analyze')) return '👁️';
    return '⚡';
  };

  const getExamples = (name: string): string[] => {
    switch (name) {
      case 'create_image':
        return [
          '"Create an image of a sunset over mountains"',
          '"Generate a portrait of a robot reading a book"',
          '"Make a landscape picture of a futuristic city"',
          '"Draw an image of a cat wearing sunglasses"'
        ];
      case 'create_3d_model':
        return [
          '"Create a 3D model of a hammer"',
          '"Generate a futuristic spaceship model"',
          '"Make a 3D pickleball paddle"',
          '"Build me a 3D trophy"'
        ];
      case 'navigate_to_page':
        return [
          '"Go to the settings page"',
          '"Open the 3D printers dashboard"',
          '"Show me the files page"',
          '"Take me to the menu"'
        ];
      case 'search_files':
        return [
          '"Search for pickleball files"',
          '"Find hammer models"',
          '"List all files"',
          '"Show me sunset images"'
        ];
      case 'open_file':
        return [
          '"Open the pickleball-paddle.glb file"',
          '"Show me hammer-model-20231118.stl"',
          '"Display sunset-photo.png"',
          '"Open trophy-design.obj"'
        ];
      case 'capture_images':
        return [
          '"Take a photo"',
          '"Capture an image from all cameras"',
          '"Take a picture and tag it as \'workspace\'"',
          '"Snap a photo"'
        ];
      case 'analyze_camera_view':
        return [
          '"What do you see?"',
          '"What is this?"',
          '"Can you tell me what color this is?"',
          '"How many objects are on the table?"'
        ];
      default:
        return [];
    }
  };

  const getParameterType = (param: any): string => {
    if (param.enum) {
      return `enum: ${param.enum.join(' | ')}`;
    }
    if (Array.isArray(param.type)) {
      return param.type.join(' | ');
    }
    return param.type || 'any';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">⚡ Jarvis Functions</h1>
        <p className="text-white/70">
          Complete documentation of all functions available to Jarvis AI Assistant
        </p>
      </header>

      {/* Overview Stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="text-4xl font-bold text-cyan-400">{jarvisFunctions.length}</div>
          <div className="text-white/70 mt-2">Total Functions</div>
        </div>
        <div className="card p-6">
          <div className="text-4xl font-bold text-green-400">
            {jarvisFunctions.filter(f => isFunctionEnabled(f.name)).length}
          </div>
          <div className="text-white/70 mt-2">Enabled</div>
        </div>
        <div className="card p-6">
          <div className="text-4xl font-bold text-red-400">
            {jarvisFunctions.filter(f => !isFunctionEnabled(f.name)).length}
          </div>
          <div className="text-white/70 mt-2">Disabled</div>
        </div>
        <div className="card p-6 flex flex-col gap-2">
          <button
            onClick={() => enableAll(jarvisFunctions.map(f => f.name))}
            className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded text-green-400 text-sm transition-colors"
          >
            Enable All
          </button>
          <button
            onClick={() => disableAll(jarvisFunctions.map(f => f.name))}
            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded text-red-400 text-sm transition-colors"
          >
            Disable All
          </button>
        </div>
      </section>

      {/* Function Categories */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold mb-4">Available Functions</h2>
        
        {jarvisFunctions.map((func) => {
          const isExpanded = expandedFunction === func.name;
          const examples = getExamples(func.name);
          const icon = getCategoryIcon(func.name);
          const isEnabled = isFunctionEnabled(func.name);
          
          return (
            <div key={func.name} className={`card overflow-hidden transition-all ${!isEnabled ? 'opacity-60' : ''}`}>
              {/* Function Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{icon}</span>
                      <h3 className="text-xl font-mono text-cyan-400">{func.name}</h3>
                      <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded">
                        {func.parameters.required.length > 0 ? 'Required Params' : 'Optional Params'}
                      </span>
                      {/* Enabled/Disabled Badge */}
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${
                        isEnabled 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {isEnabled ? '● Enabled' : '○ Disabled'}
                      </span>
                    </div>
                    <p className="text-white/70 ml-12">{func.description}</p>
                  </div>
                  
                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFunctionEnabled(func.name);
                      }}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 border-2 ${
                        isEnabled
                          ? 'bg-green-500/30 border-green-500'
                          : 'bg-gray-700 border-gray-600'
                      }`}
                      aria-label={`Toggle ${func.name}`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full transition-all duration-300 ${
                          isEnabled
                            ? 'translate-x-8 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]'
                            : 'translate-x-0 bg-gray-500'
                        }`}
                      />
                    </button>
                    
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleExpand(func.name)}
                      className="text-2xl text-white/50 hover:text-white/80 transition-colors"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-6 pb-6 space-y-6 border-t border-white/10 pt-6">
                  {/* Parameters */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-purple-400">📋 Parameters</h4>
                    <div className="space-y-3">
                      {Object.entries(func.parameters.properties).map(([paramName, paramDef]: [string, any]) => (
                        <div key={paramName} className="bg-black/30 rounded-lg p-4 border border-white/10">
                          <div className="flex items-start justify-between mb-2">
                            <code className="text-sm font-mono text-cyan-300">{paramName}</code>
                            <div className="flex gap-2">
                              {func.parameters.required.includes(paramName) && (
                                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded">
                                  required
                                </span>
                              )}
                              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded font-mono">
                                {getParameterType(paramDef)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-white/60">{paramDef.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Examples */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3 text-green-400">💬 Example Prompts</h4>
                    <div className="space-y-2">
                      {examples.map((example, idx) => (
                        <div key={idx} className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                          <div className="flex items-start gap-3">
                            <span className="text-green-400 font-bold text-sm">→</span>
                            <p className="text-sm text-white/80 font-medium">{example}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Usage Notes */}
                  <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                    <h4 className="text-sm font-semibold mb-2 text-blue-400">💡 Usage Notes</h4>
                    <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                      {func.name === 'search_files' && (
                        <>
                          <li>Always use this BEFORE open_file when user asks to open a file</li>
                          <li>Returns a list of matching files to choose from</li>
                          <li>Leave query empty to list all files</li>
                        </>
                      )}
                      {func.name === 'open_file' && (
                        <>
                          <li>Use AFTER search_files to get the exact filename</li>
                          <li>Automatically renders 3D models (.glb, .obj, .stl) with Three.js</li>
                          <li>Displays images (.png, .jpg) inline</li>
                        </>
                      )}
                      {func.name === 'create_image' && (
                        <>
                          <li>Uses DALL-E 3 for high-quality image generation</li>
                          <li>Choose size based on content: portrait (1024x1792), landscape (1792x1024), or square (1024x1024)</li>
                          <li>Be descriptive in prompts for best results</li>
                        </>
                      )}
                      {func.name === 'create_3d_model' && (
                        <>
                          <li>Generates 3D models using AI (Meshy API)</li>
                          <li>Shows real-time progress during generation</li>
                          <li>Automatically renders in the Jarvis interface</li>
                        </>
                      )}
                      {func.name === 'navigate_to_page' && (
                        <>
                          <li>Instantly navigates to any page in the application</li>
                          <li>Available pages: menu, jarvis, 3D tools, files, chat, security, camera, settings</li>
                        </>
                      )}
                      {func.name === 'capture_images' && (
                        <>
                          <li>Captures from all connected cameras simultaneously</li>
                          <li>Optional tag parameter for organizing captures</li>
                        </>
                      )}
                      {func.name === 'analyze_camera_view' && (
                        <>
                          <li>Uses GPT-4 Vision to analyze what cameras see</li>
                          <li>Can answer specific questions about the view</li>
                          <li>Great for identifying objects, reading text, describing scenes</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Footer Info */}
      <section className="card p-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/20">
        <h3 className="text-lg font-semibold mb-3">🤖 How Function Calling Works</h3>
        <div className="space-y-3 text-white/70">
          <p>
            Jarvis uses OpenAI's function calling feature to intelligently determine which function to execute based on your natural language request. Simply ask Jarvis what you want in plain English, and he'll automatically:
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Analyze your request to understand the intent</li>
            <li>Select the appropriate function(s) to call</li>
            <li>Extract the necessary parameters from your message</li>
            <li>Execute the function and provide real-time feedback</li>
            <li>Show you the results in the best format (visual, text, or interactive)</li>
          </ol>
          <div className="mt-4 p-4 bg-black/30 rounded-lg border border-cyan-500/30">
            <p className="text-cyan-400 font-semibold mb-2">💡 Pro Tip:</p>
            <p className="text-sm">
              You can chain multiple functions together! For example: "Search for hammer files and open the first one" will automatically call search_files, then open_file with the best match.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Reference */}
      <section className="card p-6">
        <h3 className="text-lg font-semibold mb-3">📚 Quick Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {jarvisFunctions.map((func) => (
            <div key={func.name} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
              <span className="text-2xl">{getCategoryIcon(func.name)}</span>
              <code className="text-sm font-mono text-cyan-400">{func.name}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

