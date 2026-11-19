#!/usr/bin/env node

/**
 * Wrapper script for audio generation
 * This ensures Python is available and dependencies are installed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

function printError(message) {
  log(`❌ ${message}`, 'red');
}

function printSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function printWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function printInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function printTip(message) {
  log(`💡 ${message}`, 'cyan');
}

log('Khmer Audio Generator', 'cyan');
log('======================\n');

try {
  // Check if Python is available
  printInfo('Checking Python installation...');
  execSync('python3 --version', { stdio: 'pipe' });
  printSuccess('Python 3 found');
  
  const projectRoot = path.join(__dirname, '..');
  const requirementsPath = path.join(projectRoot, 'tts_server', 'requirements.txt');
  const generateScriptPath = path.join(projectRoot, 'scripts', 'generate_audio.py');
  
  // Check if required files exist
  if (!fs.existsSync(requirementsPath)) {
    printError(`requirements.txt not found at ${requirementsPath}`);
    printTip('Make sure you are in the project root directory');
    process.exit(1);
  }
  
  if (!fs.existsSync(generateScriptPath)) {
    printError(`generate_audio.py not found at ${generateScriptPath}`);
    printTip('Make sure you are in the project root directory');
    process.exit(1);
  }
  
  printSuccess('Project files found');
  
  // Check if virtual environment exists
  const venvPath = path.join(projectRoot, '.venv');
  const venvPython = path.join(venvPath, 'bin', 'python3');
  
  if (fs.existsSync(venvPython)) {
    printInfo('Virtual environment found');
    
    try {
      printInfo('Generating audio files (this may take a while on first run)...\n');
      
      // Set PYTHONPATH and run the Python script
      const pythonPath = venvPython;
      const command = `PYTHONPATH=${projectRoot} ${pythonPath} ${generateScriptPath}`;
      
      printInfo(`Running: ${command}\n`);
      
      execSync(command, {
        stdio: 'inherit',
        cwd: projectRoot,
        shell: true,
        env: {
          ...process.env,
          PYTHONPATH: projectRoot
        }
      });
      
      printSuccess('\nAudio generation complete!');
      printTip('Audio files are saved in public/audio/');
      
    } catch (error) {
      printError('Failed to generate audio files');
      
      // Check if pip dependencies are installed by looking for key files
      let transformersInstalled = false;
      try {
        // Check if transformers is installed in the venv
        execSync(`${venvPython} -c "import transformers"`, { stdio: 'pipe' });
        transformersInstalled = true;
      } catch {
        transformersInstalled = false;
      }
      
      if (!transformersInstalled) {
        printTip('\nPython dependencies may not be installed:');
        log('  1. Activate virtual environment:', 'yellow');
        log('     source .venv/bin/activate', 'yellow');
        log('  2. Install dependencies:', 'yellow');
        log('     pip install -r tts_server/requirements.txt', 'yellow');
        log('  3. Run manually:', 'yellow');
        log('     python3 scripts/generate_audio.py', 'yellow');
      } else {
        printTip('\nTry running manually:');
        log('  source .venv/bin/activate', 'yellow');
        log('  python3 scripts/generate_audio.py', 'yellow');
      }
      process.exit(1);
    }
  } else {
    printWarning('Virtual environment not found');
    
    printTip('Please set up Python environment first:');
    log('  1. Install Python 3.9+ if not already installed', 'yellow');
    log('     On macOS: brew install python', 'yellow');
    log('  2. Create virtual environment:', 'yellow');
    log('     python3 -m venv .venv', 'yellow');
    log('  3. Activate it:', 'yellow');
    log('     source .venv/bin/activate', 'yellow');
    log('  4. Install dependencies:', 'yellow');
    log('     pip install -r tts_server/requirements.txt', 'yellow');
    log('  5. Then run this command again:', 'yellow');
    log('     npm run generate-audio', 'yellow');
    
    process.exit(1);
  }
  
} catch (error) {
  printError('Python 3 not found');
  
  printTip('Please install Python 3.9+ first:');
  log('  On macOS: brew install python', 'yellow');
  log('  On Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip', 'yellow');
  log('  On Windows: Download from python.org', 'yellow');
  
  printTip('\nAfter installing Python, run:');
  log('  python3 -m venv .venv', 'yellow');
  log('  source .venv/bin/activate  # or .\\venv\\Scripts\\activate on Windows', 'yellow');
  log('  pip install -r tts_server/requirements.txt', 'yellow');
  log('  npm run generate-audio', 'yellow');
  
  process.exit(1);
}
