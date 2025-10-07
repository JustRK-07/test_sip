/**
 * Python Executor Service
 * Spawns Python processes to make outbound calls
 */

const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

class PythonExecutor {
  constructor() {
    // Path to Python virtual environment
    this.pythonPath = process.env.PYTHON_PATH || path.join(__dirname, '../../../venv/bin/python');

    // Path to Python script
    this.scriptPath = process.env.PYTHON_SCRIPT_PATH || path.join(__dirname, '../../../test_outbound.py');

    logger.info('PythonExecutor initialized', {
      pythonPath: this.pythonPath,
      scriptPath: this.scriptPath,
    });
  }

  /**
   * Make an outbound call using Python script
   * @param {string} phoneNumber - Phone number in E.164 format
   * @returns {Promise<object>} Call result
   */
  async makeCall(phoneNumber) {
    const startTime = Date.now();

    logger.info(`📞 Initiating call to ${phoneNumber}`);

    return new Promise((resolve, reject) => {
      // Get the parent directory (where .env.local is located)
      const workingDirectory = path.join(__dirname, '../../..');

      // Spawn Python process with correct working directory
      const pythonProcess = spawn(this.pythonPath, [this.scriptPath, phoneNumber], {
        cwd: workingDirectory, // Set working directory to test_sip/
      });

      let stdout = '';
      let stderr = '';
      let roomName = null;
      let dispatchId = null;

      // Capture stdout
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        // Log Python output in real-time
        logger.debug(`[Python] ${output.trim()}`);

        // Extract room name
        const roomMatch = output.match(/room: (outbound-call-[a-z0-9]+)/i);
        if (roomMatch) {
          roomName = roomMatch[1];
        }

        // Extract dispatch ID
        const dispatchMatch = output.match(/Dispatch ID: ([A-Z_0-9]+)/i);
        if (dispatchMatch) {
          dispatchId = dispatchMatch[1];
        }

        // Check for success
        if (output.includes('CALL INITIATED SUCCESSFULLY')) {
          logger.info(`✅ Call initiated successfully to ${phoneNumber}`, {
            roomName,
            dispatchId,
            duration: Date.now() - startTime,
          });
        }
      });

      // Capture stderr
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn(`[Python Error] ${data.toString().trim()}`);
      });

      // Handle process exit
      pythonProcess.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code === 0) {
          // Success
          resolve({
            success: true,
            phoneNumber,
            roomName,
            dispatchId,
            duration,
            timestamp: new Date().toISOString(),
            stdout: stdout.trim(),
          });
        } else {
          // Failure
          const error = new Error(`Python process exited with code ${code}`);
          logger.error(`❌ Call failed to ${phoneNumber}`, {
            exitCode: code,
            stderr: stderr.trim(),
            duration,
          });

          reject({
            success: false,
            phoneNumber,
            error: error.message,
            exitCode: code,
            stderr: stderr.trim(),
            duration,
            timestamp: new Date().toISOString(),
          });
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        logger.error(`❌ Failed to spawn Python process for ${phoneNumber}:`, error);

        reject({
          success: false,
          phoneNumber,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  /**
   * Validate Python environment
   * @returns {Promise<boolean>}
   */
  async validateEnvironment() {
    try {
      logger.info('Validating Python environment...');

      // Check if Python executable exists
      const fs = require('fs');
      if (!fs.existsSync(this.pythonPath)) {
        logger.error(`Python executable not found at: ${this.pythonPath}`);
        return false;
      }

      // Check if script exists
      if (!fs.existsSync(this.scriptPath)) {
        logger.error(`Python script not found at: ${this.scriptPath}`);
        return false;
      }

      logger.info('✓ Python environment validated');
      return true;
    } catch (error) {
      logger.error('Python environment validation failed:', error);
      return false;
    }
  }
}

module.exports = PythonExecutor;
