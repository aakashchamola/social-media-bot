const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

class ProjectSetup {
  constructor() {
    this.dbURL = process.env.MONGO_URI || 'mongodb://localhost:27017/social-media-bot';
    this.requiredEnvVars = [
      'MONGO_URI',
      'TWITTER_API_KEY',
      'TWITTER_API_SECRET', 
      'JWT_SECRET'
    ];
    this.optionalEnvVars = [
      'TWITTER_BEARER_TOKEN'
    ];
  }

  checkEnvironmentVariables() {
    console.log('🔍 Checking environment variables...\n');
    
    const missing = [];
    const placeholder = [];
    
    // Check required variables
    this.requiredEnvVars.forEach(varName => {
      const value = process.env[varName];
      if (!value) {
        missing.push(varName);
      } else if (value.includes('your_') || value.includes('_here')) {
        placeholder.push(varName);
      } else {
        console.log(`✅ ${varName}: Set`);
      }
    });

    // Check optional variables
    this.optionalEnvVars.forEach(varName => {
      const value = process.env[varName];
      if (!value || value.includes('your_') || value.includes('_here')) {
        console.log(`⚠️  ${varName}: Not configured (optional)`);
      } else {
        console.log(`✅ ${varName}: Set`);
      }
    });

    if (missing.length > 0) {
      console.log(`\n❌ Missing required environment variables:`);
      missing.forEach(varName => console.log(`   - ${varName}`));
      return false;
    }

    if (placeholder.length > 0) {
      console.log(`\n⚠️  Environment variables with placeholder values:`);
      placeholder.forEach(varName => console.log(`   - ${varName}`));
      console.log(`\n📖 Please update these in your .env file with real API credentials.`);
      console.log(`📚 See PLATFORM_SETUP.md for detailed instructions.`);
      return false;
    }

    console.log('\n✅ All required environment variables are configured!\n');
    return true;
  }

  async testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    try {
      await mongoose.connect(this.dbURL);
      console.log('✅ MongoDB connected successfully');
      await mongoose.connection.close();
      return true;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      return false;
    }
  }

  async testAPIConnections() {
    console.log('\n🔍 Testing API connections...\n');
    
    const results = {
      twitter: await this.testTwitterAPI()
    };

    const successCount = Object.values(results).filter(Boolean).length;
    console.log(`\n📊 API Test Results: ${successCount}/1 platform connected\n`);
    
    return results;
  }

  async testTwitterAPI() {
    try {
      if (!process.env.TWITTER_API_KEY || process.env.TWITTER_API_KEY.includes('your_')) {
        console.log('⚠️  Twitter: Credentials not configured');
        return false;
      }

      // Simple API test - verify credentials
      const response = await axios.get('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        },
        timeout: 5000
      });

      console.log('✅ Twitter API: Connected successfully');
      return true;
    } catch (error) {
      console.log('❌ Twitter API: Connection failed');
      if (error.response?.status === 401) {
        console.log('   └─ Invalid credentials');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   └─ Network error');
      } else {
        console.log(`   └─ ${error.message}`);
      }
      return false;
    }
  }

  async setupDatabase() {
    console.log('🔄 Setting up database...\n');
    
    try {
      await mongoose.connect(this.dbURL);
      
      // Create collections
      const collections = ['users', 'posts', 'tasks', 'analytics'];
      for (const collectionName of collections) {
        const exists = await mongoose.connection.db.listCollections({ name: collectionName }).hasNext();
        if (!exists) {
          await mongoose.connection.db.createCollection(collectionName);
          console.log(`✅ Created collection: ${collectionName}`);
        }
      }

      // Create indexes
      await mongoose.connection.db.collection('users').createIndex({ username: 1 }, { unique: true });
      await mongoose.connection.db.collection('posts').createIndex({ scheduledTime: 1 });
      await mongoose.connection.db.collection('tasks').createIndex({ status: 1 });
      
      // Seed sample data
      const userCount = await mongoose.connection.db.collection('users').countDocuments();
      if (userCount === 0) {
        const sampleUser = {
          username: 'bot_admin',
          email: 'admin@twitterbot.com',
          platforms: {
            twitter: { connected: false }
          },
          settings: {
            autoPost: true,
            autoInteract: false,
            maxPostsPerDay: 10
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await mongoose.connection.db.collection('users').insertOne(sampleUser);
        console.log('✅ Sample data created');
      }

      await mongoose.connection.close();
      console.log('✅ Database setup completed\n');
      return true;
    } catch (error) {
      console.error('❌ Database setup failed:', error.message);
      return false;
    }
  }

  async run() {
    console.log('🚀 Twitter Bot Setup\n');
    console.log('═'.repeat(50));
    
    // Step 1: Check environment variables
    const envOk = this.checkEnvironmentVariables();
    
    // Step 2: Test database connection
    const dbOk = await this.testDatabaseConnection();
    
    // Step 3: Test API connections (only if env vars are set)
    let apiResults = {};
    if (envOk) {
      apiResults = await this.testAPIConnections();
    }
    
    // Step 4: Setup database (if connection works)
    let dbSetup = false;
    if (dbOk) {
      dbSetup = await this.setupDatabase();
    }

    // Final report
    console.log('═'.repeat(50));
    console.log('📋 Setup Summary:\n');
    
    console.log(`Environment Variables: ${envOk ? '✅' : '❌'}`);
    console.log(`Database Connection: ${dbOk ? '✅' : '❌'}`);
    console.log(`Database Setup: ${dbSetup ? '✅' : '❌'}`);
    
    if (Object.keys(apiResults).length > 0) {
      console.log('\nPlatform Connections:');
      Object.entries(apiResults).forEach(([platform, status]) => {
        console.log(`  ${platform}: ${status ? '✅' : '❌'}`);
      });
    }

    console.log('\n📚 Next Steps:');
    if (!envOk) {
      console.log('1. Update your .env file with real API credentials');
      console.log('2. See PLATFORM_SETUP.md for detailed instructions');
    } else if (Object.values(apiResults).some(Boolean)) {
      console.log('1. Start the server: npm start');
      console.log('2. Test the APIs: npm run test:platforms');
      console.log('3. Visit: http://localhost:3000');
    } else {
      console.log('1. Check your API credentials');
      console.log('2. Verify network connectivity');
      console.log('3. See PLATFORM_SETUP.md for help');
    }
    
    console.log('\n🎉 Setup completed!');
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  const setup = new ProjectSetup();
  setup.run().catch(console.error);
}

module.exports = ProjectSetup;
