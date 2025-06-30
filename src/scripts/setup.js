const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Social Media Bot...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '../../.env');
const envExamplePath = path.join(__dirname, '../../.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📄 Creating .env file from .env.example...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created successfully!');
    console.log('⚠️  Please edit the .env file with your actual API credentials.');
  } else {
    console.log('❌ .env.example file not found');
  }
} else {
  console.log('✅ .env file already exists');
}

// Create necessary directories
const directories = [
  'logs',
  'uploads',
  'temp'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, '../../', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Create .gitignore if it doesn't exist
const gitignorePath = path.join(__dirname, '../../.gitignore');
const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Uploads and temp files
uploads/
temp/

# Database files
*.db
*.sqlite
`;

if (!fs.existsSync(gitignorePath)) {
  fs.writeFileSync(gitignorePath, gitignoreContent);
  console.log('📄 Created .gitignore file');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Edit the .env file with your API credentials');
console.log('2. Run "npm install" to install dependencies');
console.log('3. Start MongoDB on your system');
console.log('4. Run "npm start" to start the bot');
console.log('\n💡 For development, use "npm run dev" to enable auto-restart');

// Display API requirements
console.log('\n🔑 Required API Credentials:');
console.log('├── Twitter API v2 (developer.twitter.com)');
console.log('├── Reddit API (reddit.com/prefs/apps)');
console.log('└── Instagram Graph API (developers.facebook.com)');

console.log('\n🌐 API Endpoints (after starting the server):');
console.log('├── Health Check: GET http://localhost:3000/');
console.log('├── Schedule Posts: POST http://localhost:3000/api/schedule');
console.log('├── Analytics: GET http://localhost:3000/api/analytics');
console.log('└── Users: GET http://localhost:3000/api/users');

console.log('\n📖 For detailed documentation, see README.md');
