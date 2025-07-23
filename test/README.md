# Test Directory

This directory contains all test files for the Social Media Bot project.

## File Organization

### Test Types
- **Unit Tests**: `*.test.js` - Tests for individual functions/modules
- **Integration Tests**: `*.integration.test.js` - Tests for component interactions
- **API Tests**: `*.api.test.js` - Tests for external API integrations
- **E2E Tests**: `*.e2e.test.js` - End-to-end testing

### Platform-Specific Tests
- **Twitter**: `twitter-*.test.js`

### Utility Tests
- **Database**: `db-*.test.js`
- **Utils**: `utils-*.test.js`
- **Services**: `services-*.test.js`

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test twitter-api.test.js

# Run tests with coverage
npm run test:coverage
```

## Guidelines

1. **ALL test files must be placed in this `/test` directory**
2. **Use descriptive file names** that indicate what's being tested
3. **Follow naming convention**: `[module/feature]-[type].test.js`
4. **Include proper test documentation** at the top of each file
5. **Mock external API calls** in unit tests
6. **Use real API calls only in integration tests** (with proper rate limiting)

## Current Tests

- `twitter-api.test.js` - Twitter API integration tests

## Test Data

Create a `fixtures/` subdirectory for test data files if needed.
