const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const typeDefs = require('./schema');
const resolvers = require('./resolvers');

class GraphQLServer {
  constructor() {
    this.server = null;
    this.schema = makeExecutableSchema({ typeDefs, resolvers });
  }

  async createServer(httpServer) {
    // Create Apollo Server without WebSocket subscriptions for now
    this.server = new ApolloServer({
      schema: this.schema,
      plugins: [
        // Proper shutdown for HTTP server
        ApolloServerPluginDrainHttpServer({ httpServer }),
      ],
      formatError: (error) => {
        console.error('GraphQL Error:', error);
        return {
          message: error.message,
          locations: error.locations,
          path: error.path,
          extensions: {
            code: error.extensions?.code,
            timestamp: new Date().toISOString(),
          },
        };
      },
      introspection: process.env.NODE_ENV !== 'production',
      csrfPrevention: true,
      cache: 'bounded',
    });

    await this.server.start();
    console.log('🚀 GraphQL Server initialized');
    
    return this.server;
  }

  getMiddleware() {
    if (!this.server) {
      throw new Error('GraphQL Server not initialized. Call createServer() first.');
    }

    return expressMiddleware(this.server, {
      context: async ({ req }) => {
        // Add authentication context here when implementing auth
        return {
          user: null, // Will be populated with authenticated user
          req,
        };
      },
    });
  }

  async stop() {
    if (this.server) {
      await this.server.stop();
      console.log('📡 GraphQL Server stopped');
    }
  }
}

module.exports = GraphQLServer;
