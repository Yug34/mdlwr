/**
 * Base test setup for all tests.
 *
 * This file sets up mock environment variables as fallbacks.
 * For integration tests, real database credentials should be provided
 * via TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY environment variables.
 *
 * Unit tests will use these mock values.
 * Integration tests will override with real values in their setup file.
 */

// Set fallback environment variables for unit tests
// Integration tests should set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY
// to use a real test database instance
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-openai-key";
}
